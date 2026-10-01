import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HOURS = 24;

export class InvitationError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409) {
    super(message);
  }
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitation(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  email: string;
  role: Exclude<MembershipRole, "ADMIN">;
}) {
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + HOURS * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new InvitationError("Somente ADMIN ativo pode criar convites.", 403);
    }
    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true, active: true } });
    if (existingUser && (!existingUser.active || await tx.membership.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId: input.organizationId } },
      select: { id: true },
    }))) throw new InvitationError("Este e-mail já possui vínculo ou está indisponível.", 409);
    const pending = await tx.organizationInvitation.findFirst({
      where: { organizationId: input.organizationId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pending) throw new InvitationError("Já existe um convite válido para este e-mail.", 409);

    const created = await tx.organizationInvitation.create({
      data: {
        organizationId: input.organizationId, invitedById: input.actorUserId,
        name: input.name.trim(), email, role: input.role, tokenHash: tokenDigest(token), expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId, userId: input.actorUserId,
        action: "ORGANIZATION_INVITATION_CREATED", entity: "OrganizationInvitation", entityId: created.id,
        metadata: { email, role: input.role, expiresAt: expiresAt.toISOString() },
      },
    });
    return created;
  });

  return { token, expiresAt: invitation.expiresAt };
}

export async function listOrganizationInvitations(organizationId: string) {
  const invitations = await prisma.organizationInvitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, name: true, email: true, role: true,
      createdAt: true, expiresAt: true, acceptedAt: true, revokedAt: true,
    },
  });
  const now = Date.now();
  return invitations.map((invite) => ({
    ...invite,
    state: invite.acceptedAt ? "Aceito" : invite.revokedAt ? "Revogado" : invite.expiresAt.getTime() > now ? "Pendente" : "Expirado",
  }));
}

export async function revokeInvitation(input: {
  organizationId: string; actorUserId: string; invitationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Serialize with invitation creation and role changes in this organization.
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new InvitationError("Somente ADMIN ativo pode revogar convites.", 403);
    }
    // The activation transaction locks this row too; exactly one operation wins.
    const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OrganizationInvitation"
      WHERE "id" = ${input.invitationId} AND "organizationId" = ${input.organizationId} FOR UPDATE
    `;
    if (!locked) throw new InvitationError("Convite não encontrado.", 404);
    const invitation = await tx.organizationInvitation.findUniqueOrThrow({ where: { id: locked.id } });
    if (invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
      throw new InvitationError("Este convite não está pendente.", 409);
    }
    const revokedAt = new Date();
    await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { revokedAt } });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId, userId: input.actorUserId,
        action: "ORGANIZATION_INVITATION_REVOKED", entity: "OrganizationInvitation", entityId: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      },
    });
    return { revokedAt };
  });
}

export async function replaceInvitation(input: {
  organizationId: string;
  actorUserId: string;
  invitationId: string;
  name: string;
  email: string;
  role: Exclude<MembershipRole, "ADMIN">;
}) {
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + HOURS * 60 * 60 * 1000);

  const created = await prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new InvitationError("Somente ADMIN ativo pode substituir convites.", 403);
    }
    const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OrganizationInvitation"
      WHERE "id" = ${input.invitationId} AND "organizationId" = ${input.organizationId} FOR UPDATE
    `;
    if (!locked) throw new InvitationError("Convite não encontrado.", 404);
    const previous = await tx.organizationInvitation.findUniqueOrThrow({ where: { id: locked.id } });
    if (previous.acceptedAt || previous.revokedAt || previous.expiresAt <= new Date()) {
      throw new InvitationError("Este convite não está pendente.", 409);
    }
    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true, active: true } });
    if (existingUser && (!existingUser.active || await tx.membership.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId: input.organizationId } },
      select: { id: true },
    }))) throw new InvitationError("Este e-mail já possui vínculo ou está indisponível.", 409);
    const conflicting = await tx.organizationInvitation.findFirst({
      where: { organizationId: input.organizationId, email, id: { not: previous.id },
        acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (conflicting) throw new InvitationError("Já existe um convite válido para este e-mail.", 409);

    await tx.organizationInvitation.update({ where: { id: previous.id }, data: { revokedAt: new Date() } });
    const replacement = await tx.organizationInvitation.create({ data: {
      organizationId: input.organizationId, invitedById: input.actorUserId,
      name: input.name.trim(), email, role: input.role, tokenHash: tokenDigest(token), expiresAt,
    } });
    await tx.auditLog.createMany({ data: [
      { organizationId: input.organizationId, userId: input.actorUserId,
        action: "ORGANIZATION_INVITATION_REVOKED", entity: "OrganizationInvitation", entityId: previous.id,
        metadata: { email: previous.email, role: previous.role, reason: "REPLACED", replacementId: replacement.id } },
      { organizationId: input.organizationId, userId: input.actorUserId,
        action: "ORGANIZATION_INVITATION_CREATED", entity: "OrganizationInvitation", entityId: replacement.id,
        metadata: { email, role: input.role, expiresAt: expiresAt.toISOString(), replacedInvitationId: previous.id } },
    ] });
    return replacement;
  });
  return { token, expiresAt: created.expiresAt };
}

export async function acceptInvitation(input: { token: string; email: string; password: string }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
    throw new InvitationError("Convite inválido ou expirado.", 400);
  }
  const email = input.email.trim().toLowerCase();
  const digest = tokenDigest(input.token);
  const available = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: digest }, select: { organizationId: true, acceptedAt: true, revokedAt: true, expiresAt: true, email: true },
  });
  if (!available || available.acceptedAt || available.revokedAt || available.expiresAt <= new Date() || available.email !== email) {
    throw new InvitationError("Convite inválido ou expirado.", 400);
  }
  const existingBeforeLock = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!existingBeforeLock && input.password.length < 12) {
    throw new InvitationError("A nova senha precisa ter ao menos 12 caracteres.", 400);
  }
  const passwordHash = existingBeforeLock ? null : await hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    // Match the organization-then-invitation lock order used by revocation.
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${available.organizationId} FOR UPDATE
    `;
    if (!organization?.active) throw new InvitationError("Convite inválido ou expirado.", 400);
    // Lock the invitation so activation and revocation cannot both succeed.
    const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OrganizationInvitation"
      WHERE "tokenHash" = ${digest} FOR UPDATE
    `;
    if (!locked) throw new InvitationError("Convite inválido ou expirado.", 400);
    const invitation = await tx.organizationInvitation.findUniqueOrThrow({
      where: { id: locked.id }, include: { organization: { select: { active: true } } },
    });
    if (invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || !invitation.organization.active || invitation.email !== email) {
      throw new InvitationError("Convite inválido ou expirado.", 400);
    }
    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true, active: true, passwordHash: true } });
    let userId: string;
    if (existingUser) {
      if (!existingUser.active || !existingUser.passwordHash || !await compare(input.password, existingUser.passwordHash)) {
        throw new InvitationError("Credenciais inválidas para a conta existente.", 403);
      }
      if (await tx.membership.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: invitation.organizationId } },
        select: { id: true },
      })) throw new InvitationError("Este e-mail já possui vínculo com a organização.", 409);
      userId = existingUser.id;
    } else {
      if (!passwordHash) throw new InvitationError("Tente novamente para criar sua conta.", 409);
      const user = await tx.user.create({ data: { name: invitation.name, email, passwordHash } });
      userId = user.id;
    }
    await tx.membership.create({
      data: { userId, organizationId: invitation.organizationId, role: invitation.role },
    });
    await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        organizationId: invitation.organizationId, userId,
        action: "ORGANIZATION_INVITATION_ACCEPTED", entity: "OrganizationInvitation", entityId: invitation.id,
        metadata: { invitedById: invitation.invitedById, role: invitation.role },
      },
    });
    return { userId, organizationId: invitation.organizationId };
  });
}
