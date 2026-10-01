import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HOURS = 24;

export class InvitationError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 409) {
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
    if (!organization?.active || actor?.role !== "ADMIN" || !actor.user.active) {
      throw new InvitationError("Somente ADMIN ativo pode criar convites.", 403);
    }
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new InvitationError("Este e-mail não está disponível para convite.", 409);
    }
    const pending = await tx.organizationInvitation.findFirst({
      where: { organizationId: input.organizationId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
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

export async function acceptInvitation(input: { token: string; email: string; password: string }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
    throw new InvitationError("Convite inválido ou expirado.", 400);
  }
  const email = input.email.trim().toLowerCase();
  const digest = tokenDigest(input.token);
  const available = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: digest }, select: { acceptedAt: true, expiresAt: true, email: true },
  });
  if (!available || available.acceptedAt || available.expiresAt <= new Date() || available.email !== email) {
    throw new InvitationError("Convite inválido ou expirado.", 400);
  }
  const passwordHash = await hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    // Lock the invitation so concurrent requests cannot both redeem it.
    const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OrganizationInvitation"
      WHERE "tokenHash" = ${digest} FOR UPDATE
    `;
    if (!locked) throw new InvitationError("Convite inválido ou expirado.", 400);
    const invitation = await tx.organizationInvitation.findUniqueOrThrow({
      where: { id: locked.id }, include: { organization: { select: { active: true } } },
    });
    if (invitation.acceptedAt || invitation.expiresAt <= new Date() || !invitation.organization.active || invitation.email !== email) {
      throw new InvitationError("Convite inválido ou expirado.", 400);
    }
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new InvitationError("Este e-mail não está disponível para ativação.", 409);
    }
    const user = await tx.user.create({ data: { name: invitation.name, email, passwordHash } });
    await tx.membership.create({
      data: { userId: user.id, organizationId: invitation.organizationId, role: invitation.role },
    });
    await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        organizationId: invitation.organizationId, userId: user.id,
        action: "ORGANIZATION_INVITATION_ACCEPTED", entity: "OrganizationInvitation", entityId: invitation.id,
        metadata: { invitedById: invitation.invitedById, role: invitation.role },
      },
    });
    return { userId: user.id, organizationId: invitation.organizationId };
  });
}
