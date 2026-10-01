/**
 * Seed de desarrollo. Juan corre `npm run db:seed`.
 * Es idempotente: se puede volver a ejecutar sin duplicar filas.
 *
 * Contrasenas de la demo (RF-AUT-01):
 *   supervisor@demo.test  / supervisor123
 *   coordinador@demo.test / coordinador123
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/shared/lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = {
  supervisor: "supervisor123",
  coordinador: "coordinador123",
} as const;

const USERS = [
  { email: "supervisor@demo.test", name: "Supervisor Demo", role: "SUPERVISOR" as const },
  { email: "coordinador@demo.test", name: "Coordinador Demo", role: "COORDINADOR" as const },
];

const COST_CENTERS = [
  {
    name: "Plaza Norte",
    address: "Calle 100 # 45-60, Bogota",
    lat: 4.710989,
    lng: -74.07209,
  },
  {
    name: "Plaza Sur",
    address: "Avenida 68 # 12-35, Bogota",
    lat: 4.698226,
    lng: -74.056098,
  },
  {
    name: "Parque Centro",
    address: "Carrera 7 # 32-16, Bogota",
    lat: 4.706812,
    lng: -74.068127,
  },
];

/** Radio por defecto del SDD (RF-QR-01). */
const QR_RADIUS_METERS = 50;

/** Horarios del 1 oct 2026, hora de Bogota (UTC-5): 08:00, 10:00 y 14:00. */
const VISIT_SCHEDULE_UTC = [
  "2026-10-01T13:00:00.000Z",
  "2026-10-01T15:00:00.000Z",
  "2026-10-01T19:00:00.000Z",
] as const;

const CHECKLIST_ITEMS = [
  "Barrer y trapear el area asignada",
  "Reponer papel higienico en todos los puntos",
  "Limpiar espejos y lavamanos",
  "Retirar residuos y revisar contenedores",
  "Verificar estado del piso y la iluminacion",
  "Registrar novedades encontrados",
];

async function main(): Promise<void> {
  for (const user of USERS) {
    const plain =
      user.role === "SUPERVISOR" ? DEMO_PASSWORD.supervisor : DEMO_PASSWORD.coordinador;
    const passwordHash = await hashPassword(plain);

    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { name: user.name, role: user.role, passwordHash },
    });
  }

  const supervisor = await prisma.user.findUniqueOrThrow({
    where: { email: "supervisor@demo.test" },
  });
  const coordinator = await prisma.user.findUniqueOrThrow({
    where: { email: "coordinador@demo.test" },
  });

  // --- Plantilla de checklist (RF-SUP-01 / RF-ASI-03) ---
  // El nombre no es unique, asi que se busca antes de crear.
  const template =
    (await prisma.checklistTemplate.findFirst({ where: { name: "Aseo General" } })) ??
    (await prisma.checklistTemplate.create({
      data: { name: "Aseo General", createdById: coordinator.id },
    }));

  for (const [index, label] of CHECKLIST_ITEMS.entries()) {
    await prisma.checklistTemplateItem.upsert({
      where: { templateId_position: { templateId: template.id, position: index + 1 } },
      create: {
        templateId: template.id,
        position: index + 1,
        label,
        required: true,
      },
      update: { label, required: true },
    });
  }

  for (const [index, center] of COST_CENTERS.entries()) {
    const scheduledAt = new Date(VISIT_SCHEDULE_UTC[index] ?? VISIT_SCHEDULE_UTC[0]);
    const costCenter =
      (await prisma.costCenter.findFirst({ where: { name: center.name } })) ??
      (await prisma.costCenter.create({ data: center }));

    await prisma.costCenter.update({
      where: { id: costCenter.id },
      data: { checklistTemplateId: template.id },
    });

    // Tres QR por centro, con radio de 50 m y activos.
    for (let area = 1; area <= 3; area += 1) {
      const code = `QR-${center.name.replace(/\s+/g, "-").toUpperCase()}-${area}`;
      const lat = center.lat + area * 0.0004;
      const lng = center.lng - area * 0.0004;

      await prisma.qrPoint.upsert({
        where: { code },
        create: {
          code,
          costCenterId: costCenter.id,
          areaName: `Area ${area}`,
          lat,
          lng,
          radiusMeters: QR_RADIUS_METERS,
          isActive: true,
        },
        update: { costCenterId: costCenter.id, areaName: `Area ${area}`, lat, lng, radiusMeters: QR_RADIUS_METERS },
      });
    }

    // Una visita ASSIGNED para que el supervisor tenga algo que hacer.
    await prisma.visit.upsert({
      where: { clientId: `seed-visit-${costCenter.id}` },
      create: {
        clientId: `seed-visit-${costCenter.id}`,
        supervisorId: supervisor.id,
        costCenterId: costCenter.id,
        checklistTemplateId: template.id,
        status: "ASSIGNED",
        scheduledAt,
        clientCreatedAt: scheduledAt,
      },
      update: {
        supervisorId: supervisor.id,
        costCenterId: costCenter.id,
        checklistTemplateId: template.id,
        scheduledAt,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    costCenters: await prisma.costCenter.count(),
    qrPoints: await prisma.qrPoint.count(),
    templates: await prisma.checklistTemplate.count(),
    templateItems: await prisma.checklistTemplateItem.count(),
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