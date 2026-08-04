import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} não foi definida no arquivo .env.`);
  }

  return value;
}

const databaseUrl = requireEnvironmentVariable("DATABASE_URL");

const adminEmail = requireEnvironmentVariable(
  "SEED_ADMIN_EMAIL",
).toLowerCase();

const adminPassword = requireEnvironmentVariable(
  "SEED_ADMIN_PASSWORD",
);

const adminName =
  process.env.SEED_ADMIN_NAME?.trim() || "Administrador";

if (adminPassword.length < 12) {
  throw new Error(
    "SEED_ADMIN_PASSWORD deve possuir pelo menos 12 caracteres.",
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const passwordHash = await hash(adminPassword, 12);

  const organization = await prisma.organization.upsert({
    where: {
      slug: "cliente-demonstracao",
    },
    update: {
      name: "Cliente Demonstração",
      active: true,
    },
    create: {
      name: "Cliente Demonstração",
      slug: "cliente-demonstracao",
      active: true,
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {
      name: adminName,
      passwordHash,
      active: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      active: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "ADMIN",
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: "ADMIN",
    },
  });

  const assets = [
    {
      id: "seed-proxmox-01",
      name: "Host Proxmox 01",
      type: "SERVER",
      manufacturer: "Dell Technologies",
      model: "PowerEdge",
      serialNumber: "DEMO-SRV-001",
      ipAddress: "10.10.10.11",
      location: "Rack principal • U08",
      status: "ONLINE",
    },
    {
      id: "seed-proxmox-02",
      name: "Host Proxmox 02",
      type: "SERVER",
      manufacturer: "Dell Technologies",
      model: "PowerEdge",
      serialNumber: "DEMO-SRV-002",
      ipAddress: "10.10.10.12",
      location: "Rack principal • U12",
      status: "ONLINE",
    },
    {
      id: "seed-firewall-01",
      name: "Firewall Principal",
      type: "FIREWALL",
      manufacturer: "Fortinet",
      model: "FortiGate",
      serialNumber: "DEMO-FW-001",
      ipAddress: "10.10.10.1",
      location: "Rack principal • U02",
      status: "ONLINE",
    },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: {
        id: asset.id,
      },
      update: {
        ...asset,
        organizationId: organization.id,
      },
      create: {
        ...asset,
        organizationId: organization.id,
      },
    });
  }

  console.log("Seed concluído com sucesso.");
  console.log(`Organização: ${organization.name}`);
  console.log(`Administrador: ${user.email}`);
  console.log(`Ativos demonstrativos: ${assets.length}`);
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao executar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
