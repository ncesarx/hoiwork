import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!organization) throw new Error("Nenhuma organização ativa encontrada.");

  const admin = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
    include: { user: true },
  });

  if (!admin) throw new Error("Administrador da organização não encontrado.");

  const jobs = [
    { name: "Backup diário", kind: "DAILY", status: "COMPLETED", progress: 100, retentionDays: 30 },
    { name: "Backup semanal", kind: "WEEKLY", status: "COMPLETED", progress: 100, retentionDays: 84 },
    { name: "Cópia imutável", kind: "IMMUTABLE", status: "PROTECTED", progress: 100, retentionDays: 14 },
  ];

  for (const job of jobs) {
    const existing = await prisma.backupJob.findFirst({
      where: { organizationId: organization.id, name: job.name },
    });
    if (!existing) {
      await prisma.backupJob.create({
        data: {
          organizationId: organization.id,
          ...job,
          lastRunAt: new Date(),
        },
      });
    }
  }

  await prisma.disasterRecoveryPlan.upsert({
    where: { organizationId: organization.id },
    update: {
      replicationStatus: "SYNCHRONIZED",
      lastSyncAt: new Date(),
    },
    create: {
      organizationId: organization.id,
      primarySite: "Site Principal",
      recoverySite: "Site DR • Outra localidade",
      primaryStatus: "OPERATIONAL",
      recoveryStatus: "READY",
      replicationStatus: "SYNCHRONIZED",
      lastSyncAt: new Date(),
      rpoMinutes: 15,
      rtoMinutes: 120,
    },
  });

  const contract = await prisma.contract.findFirst({
    where: { organizationId: organization.id },
  });

  if (!contract) {
    await prisma.contract.create({
      data: {
        organizationId: organization.id,
        name: "Suporte e Monitoramento Corporativo",
        status: "ACTIVE",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T23:59:59.000Z"),
        slaHours: 4,
        monthlyHours: 40,
      },
    });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { organizationId: organization.id },
  });

  if (!ticket) {
    await prisma.ticket.create({
      data: {
        organizationId: organization.id,
        openedById: admin.userId,
        title: "Validação inicial do Portal Enterprise",
        description: "Chamado demonstrativo criado pela Sprint 014 para validar a camada de dados.",
        status: "OPEN",
        priority: "MEDIUM",
      },
    });
  }

  console.log("Seed Sprint 014 concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
