import { prisma } from "@/lib/prisma";

const actions = [
  "MEMBERSHIP_ROLE_CHANGED",
  "MEMBERSHIP_ACCESS_SUSPENDED",
  "MEMBERSHIP_ACCESS_RESTORED",
  "ORGANIZATION_INVITATION_CREATED",
  "ORGANIZATION_INVITATION_ACCEPTED",
  "ORGANIZATION_INVITATION_REVOKED",
  "USER_PASSWORD_CHANGED",
];

const labels: Record<string, string> = {
  MEMBERSHIP_ROLE_CHANGED: "Papel alterado",
  MEMBERSHIP_ACCESS_SUSPENDED: "Acesso suspenso",
  MEMBERSHIP_ACCESS_RESTORED: "Acesso reativado",
  ORGANIZATION_INVITATION_CREATED: "Convite criado",
  ORGANIZATION_INVITATION_ACCEPTED: "Convite aceito",
  ORGANIZATION_INVITATION_REVOKED: "Convite revogado",
  USER_PASSWORD_CHANGED: "Senha alterada",
};

const roles = new Set(["CLIENT", "MANAGER", "TECHNICIAN", "ADMIN"]);

export async function listAccessAudit(organizationId: string, options: {
  from?: Date; toExclusive?: Date; limit?: number;
} = {}) {
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId, action: { in: actions },
      createdAt: { gte: options.from, lt: options.toExclusive },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(options.limit ?? 50, 1), 1001),
    select: {
      id: true, action: true, entity: true, entityId: true, createdAt: true, metadata: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const membershipIds = logs.filter((log) => log.entity === "Membership" && log.entityId).map((log) => log.entityId!);
  const invitationIds = logs.filter((log) => log.entity === "OrganizationInvitation" && log.entityId).map((log) => log.entityId!);
  const [memberships, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId, id: { in: membershipIds } },
      select: { id: true, user: { select: { email: true } } },
    }),
    prisma.organizationInvitation.findMany({
      where: { organizationId, id: { in: invitationIds } },
      select: { id: true, email: true },
    }),
  ]);
  const targets = new Map<string, string>([
    ...memberships.map((member): [string, string] => [member.id, member.user.email]),
    ...invitations.map((invite): [string, string] => [invite.id, invite.email]),
  ]);

  return logs.map((log) => {
    const metadata = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? log.metadata : {};
    const previous = "previousRole" in metadata ? metadata.previousRole : null;
    const next = "newRole" in metadata ? metadata.newRole : null;
    const roleChange = log.action === "MEMBERSHIP_ROLE_CHANGED" && typeof previous === "string" && typeof next === "string" && roles.has(previous) && roles.has(next)
      ? `${previous} → ${next}` : null;
    return {
      id: log.id,
      createdAt: log.createdAt,
      action: labels[log.action] ?? "Alteração de acesso",
      actor: log.user?.name?.trim() || log.user?.email || "Usuário removido",
      target: log.entity === "User" && log.entityId === log.user?.id
        ? log.user.email
        : log.entityId ? targets.get(log.entityId) ?? "Registro removido" : "Registro removido",
      details: roleChange,
    };
  });
}
