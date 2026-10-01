/**
 * Seed de desarrollo. Juan corre `npm run db:seed`.
 * Es idempotente: se puede volver a ejecutar sin duplicar filas.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USERS = [
  {
    email: "supervisor@demo.test",
    name: "Supervisor Demo",
    role: "SUPERVISOR" as const,
  },
  {
    email: "coordinador@demo.test",
    name: "Coordinador Demo",
    role: "COORDINADOR" as const,
  },
];

const COST_CENTERS = [
  { name: "Plaza Norte", lat: 4.710989, lng: -74.07209 },
  { name: "Plaza Sur", lat: 4.698226, lng: -74.056_098 },
  { name: "Parque Centro", lat: 4.706_812, lng: -74.068_127 },
];

async function main(): Promise<void> {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: user,
      update: { name: user.name, role: user.role },
    });
  }

  const supervisor = await prisma.user.findUniqueOrThrow({
    where: { email: "supervisor@demo.test" },
  });

  for (const center of COST_CENTERS) {
    // `CostCenter.name` tiene indice pero no es unique, asi que `upsert` no
    // aplica. Se resuelve a mano: primero se busca, si no esta se crea.
    const costCenter =
      (await prisma.costCenter.findFirst({ where: { name: center.name } })) ??
      (await prisma.costCenter.create({ data: center }));

    // Tres QR por centro, areas nombradas de forma estable.
    for (let area = 1; area <= 3; area += 1) {
      const code = `QR-${center.name.replace(/\s+/g, "-").toUpperCase()}-${area}`;

      await prisma.qrPoint.upsert({
        where: { code },
        create: {
          code,
          costCenterId: costCenter.id,
          areaName: `Area ${area}`,
          lat: center.lat + area * 0.000_4,
          lng: center.lng - area * 0.000_4,
          radiusMeters: 30,
        },
        update: {
          costCenterId: costCenter.id,
          areaName: `Area ${area}`,
          lat: center.lat + area * 0.000_4,
          lng: center.lng - area * 0.000_4,
          radiusMeters: 30,
        },
      });
    }

    // Una visita ASSIGNED para que el supervisor tenga algo que hacer.
    await prisma.visit.upsert({
      where: { clientId: `seed-visit-${costCenter.id}` },
      create: {
        clientId: `seed-visit-${costCenter.id}`,
        supervisorId: supervisor.id,
        costCenterId: costCenter.id,
        status: "ASSIGNED",
        clientCreatedAt: new Date(),
      },
      update: { supervisorId: supervisor.id, costCenterId: costCenter.id },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    costCenters: await prisma.costCenter.count(),
    qrPoints: await prisma.qrPoint.count(),
    visits: await prisma.visit.count(),
  };

  console.log("Seed listo:", counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });