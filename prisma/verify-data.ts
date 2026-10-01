/**
 * Verificacion temporal de Juan. Se borra despues de correr.
 */

import {
  bogotaToday,
  getDashboardKpis,
  getOperationsMap,
  getOperationsReport,
  getVisitDetail,
  getVisitHistory,
  listDelayedVisits,
  listEvidenceByOwner,
  listEvidenceGallery,
  listNoveltyAlerts,
  listOutOfRangeVisits,
  listPendingChecklistLabels,
  listPrintableQrPoints,
  listEvidenceTrace,
  listSupervisorRoutes,
  listVisits,
  operationsReportToCsv,
} from "@/features/coordinacion/queries";
import { prisma } from "@/shared/lib/prisma";

let failures = 0;

function check(label: string, ok: boolean, extra = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "FALLA"} ${label}${extra ? ` -> ${extra}` : ""}`);
}

async function main(): Promise<void> {
  const today = bogotaToday();
  const from14 = new Date(`${today}T00:00:00.000-05:00`);
  from14.setDate(from14.getDate() - 14);
  const fromIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(from14);

  // --- KPIs -------------------------------------------------------------
  const kpis = await getDashboardKpis();
  console.log("KPIs:", kpis, "\n");
  check("dashboard: hay visitas programadas", kpis.visitsScheduled > 0, `${kpis.visitsScheduled}`);
  check("dashboard: hay visitas completadas", kpis.visitsCompleted > 0, `${kpis.visitsCompleted}`);
  check("dashboard: hay visitas pendientes", kpis.visitsPending > 0, `${kpis.visitsPending}`);
  check("dashboard: hay novedades sin cerrar", kpis.openNovelties > 0, `${kpis.openNovelties}`);
  check("dashboard: % DONE creible", kpis.visitsDonePercent > 0 && kpis.visitsDonePercent < 100, `${kpis.visitsDonePercent}%`);
  check("dashboard: % GPS creible", kpis.gpsVerifiedPercent > 0 && kpis.gpsVerifiedPercent < 100, `${kpis.gpsVerifiedPercent}%`);
  check("dashboard: % checklist creible", kpis.checklistDonePercent > 0 && kpis.checklistDonePercent < 100, `${kpis.checklistDonePercent}%`);

  // --- Rutas y alertas --------------------------------------------------
  const routes = await listSupervisorRoutes();
  const enRuta = routes.filter((r) => r.status === "EN_RUTA").length;
  const conVisita = routes.filter((r) => r.status !== "SIN_VISITA").length;
  console.log(`Rutas: ${routes.length} supervisores, ${enRuta} EN_RUTA\n`);
  check("rutas: hay supervisores con ruta", conVisita > 0, `${conVisita}/${routes.length}`);
  check("rutas: hay al menos un EN_RUTA", enRuta > 0, `${enRuta}`);

  const oor = await listOutOfRangeVisits();
  check("alertas: visitas fuera de rango", oor.length > 0, `${oor.length}`);
  const delayed = await listDelayedVisits();
  check("alertas: visitas demoradas", delayed.length > 0, `${delayed.length}`);
  const alerts = await listNoveltyAlerts();
  check("alertas: bandeja con novedades", alerts.length > 0, `${alerts.length}`);
  check("alertas: la bandeja excluye RESOLVED", alerts.every((r) => r.status !== "RESOLVED"));

  // --- Mapa -------------------------------------------------------------
  const map = await getOperationsMap();
  console.log(`Mapa: ${map.costCenters.length} centros, ${map.qrPoints.length} QR, ${map.scans.length} escaneos, ${map.lastPositions.length} posiciones\n`);
  check("mapa: centros con coordenadas", map.costCenters.every((c) => c.lat !== 0 && c.lng !== 0));
  check("mapa: hay posiciones de supervisores", map.lastPositions.length > 0, `${map.lastPositions.length}`);
  check("mapa: hay escaneos", map.scans.length > 0, `${map.scans.length}`);
  check("QR: hay puntos inactivos", map.qrPoints.some((p) => !p.isActive));

  // --- Historial --------------------------------------------------------
  const history = await getVisitHistory();
  const withDuration = history.filter((r) => r.durationMinutes !== null);
  console.log(`Historial: ${history.length} visitas, ${withDuration.length} con duracion\n`);
  check("historial: trae supervisor y centro", history.every((r) => r.supervisorName !== "" && r.costCenterName !== ""));
  check("historial: hay duraciones", withDuration.length > 0, `${withDuration.length}`);
  check("historial: duraciones positivas", withDuration.every((r) => (r.durationMinutes ?? -1) > 0));
  check("historial: varios supervisores con historial", new Set(history.map((r) => r.supervisorId)).size > 1, `${new Set(history.map((r) => r.supervisorId)).size}`);

  const detailed = history.find((r) => r.status === "COMPLETED" && r.checklistTemplateId !== null);
  if (detailed === undefined) {
    check("detalle: hay visita completada con checklist", false);
  } else {
    const detail = await getVisitDetail(detailed.id);
    check("detalle: carga la visita", detail !== null);
    check("detalle: devuelve pendientes del checklist", detail !== null && Array.isArray(detail.pendingChecklist), `${detail?.pendingChecklist.length ?? 0}`);
  }

  let visitsWithPending = 0;
  for (const row of history.filter((e) => e.checklistTemplateId !== null)) {
    if ((await listPendingChecklistLabels(row.id)).length > 0) visitsWithPending += 1;
  }
  check("CA-02: hay visitas con obligatorios pendientes", visitsWithPending > 0, `${visitsWithPending}`);

  // --- Evidencias -------------------------------------------------------
  const gallery = await listEvidenceGallery();
  const ownerTypes = new Set(gallery.map((r) => r.ownerType));
  console.log(`Evidencias: ${gallery.length} en galeria, duenos: ${[...ownerTypes].join(", ")}\n`);
  check("evidencias: galeria con filas", gallery.length > 0, `${gallery.length}`);
  check("evidencias: contexto legible", gallery.every((r) => r.context !== r.ownerType));
  check("evidencias: cuatro duenos polimorficos", ["VISIT", "NOVELTY", "QR_SCAN", "CHECKLIST_ITEM"].every((t) => ownerTypes.has(t as never)), [...ownerTypes].join(", "));
  const trace = await listEvidenceTrace();
  check("evidencias: la traza muestra autor real (RNF-14)", trace.length > 0 && trace.every((r) => r.authorName !== "Sin autor"), `${trace.filter((r) => r.authorName === "Sin autor").length} sin autor de ${trace.length}`);

  const orphan = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM Evidence e
    WHERE (e.ownerType = 'VISIT'           AND NOT EXISTS (SELECT 1 FROM Visit v WHERE v.id = e.ownerId))
       OR (e.ownerType = 'NOVELTY'         AND NOT EXISTS (SELECT 1 FROM Novelty n WHERE n.id = e.ownerId))
       OR (e.ownerType = 'QR_SCAN'         AND NOT EXISTS (SELECT 1 FROM QrScan s WHERE s.id = e.ownerId))
       OR (e.ownerType = 'CHECKLIST_ITEM'  AND NOT EXISTS (SELECT 1 FROM ChecklistItemResult c WHERE c.id = e.ownerId))
  `;
  check("evidencias: ninguna huerfana", Number(orphan[0]?.total ?? 0) === 0, `${orphan[0]?.total}`);

  const withoutAuthor = await prisma.evidence.count({ where: { capturedById: null } });
  check("RNF-14: toda evidencia tiene autor", withoutAuthor === 0, `${withoutAuthor}`);

  const noveltyOwner = await prisma.evidence.findFirst({ where: { ownerType: "NOVELTY" } });
  if (noveltyOwner !== null) {
    const byOwner = await listEvidenceByOwner("NOVELTY", noveltyOwner.ownerId);
    check("evidencias: filtro por dueno funciona", byOwner.length >= 1, `${byOwner.length}`);
  }

  // --- Reportes por periodo --------------------------------------------
  const report = await getOperationsReport({
    from: `${fromIso}T00:00:00.000-05:00`,
    to: `${today}T23:59:59.999-05:00`,
  });
  console.log(`Reporte 15 dias: ${report.visitsScheduled} programadas, ${report.visitsCompleted} completadas, ${report.openNovelties} abiertas\n`);
  check("reporte: trae visitas del periodo", report.visits.length > 0, `${report.visits.length}`);
  check("reporte: trae novedades del periodo", report.novelties.length > 0, `${report.novelties.length}`);
  check("reporte: excluye CANCELLED del denominador", report.visitsScheduled === report.visits.filter((v) => v.status !== "CANCELLED").length);
  check("reporte: % GPS en rango", report.gpsVerifiedPercent >= 0 && report.gpsVerifiedPercent <= 100, `${report.gpsVerifiedPercent}%`);

  const csv = operationsReportToCsv(report);
  const lines = csv.split("\n");
  check("CSV: encabezado + filas", lines.length > 1 && lines[0]!.startsWith("tipo,id,estado"), `${lines.length} lineas`);
  check("CSV: incluye filas de visita y novedad", /\nvisita,/.test(csv) && /\nnovedad,/.test(csv), `${lines.filter((l) => l.startsWith("visita,")).length} visitas, ${lines.filter((l) => l.startsWith("novedad,")).length} novedades`);

  const bySup = await getOperationsReport({
    from: `${fromIso}T00:00:00.000-05:00`,
    to: `${today}T23:59:59.999-05:00`,
    supervisorId: history[0]!.supervisorId,
  });
  check("reporte: filtra por supervisor", bySup.supervisorId === history[0]!.supervisorId);
  check("reporte: el filtro reduce el universo", bySup.visits.length <= report.visits.length, `${bySup.visits.length}`);

  // --- QR imprimible ----------------------------------------------------
  const printable = await listPrintableQrPoints();
  const qrTotal = await prisma.qrPoint.count();
  check("QR: hoja con datos completos", printable.every((r) => r.code !== "" && r.address !== "" && r.radiusMeters === 50), `${printable.length} filas`);
  check("QR: hoja excluye inactivos", printable.every((r) => r.isActive));
  check("QR: hoja menor que el catalogo", printable.length < qrTotal, `${printable.length} de ${qrTotal}`);

  // --- Invariantes ------------------------------------------------------
  const inverted = await prisma.visit.count({ where: { checkInDistanceM: { gt: 50 }, checkInVerified: true } });
  check("geofence: verificada exige distancia <= 50 m", inverted === 0, `${inverted}`);

  const badFlag = await prisma.visit.count({ where: { checkInOutOfRange: true, checkInDistanceM: { lte: 50 } } });
  check("geofence: fuera de rango solo con distancia > 50 m", badFlag === 0, `${badFlag}`);

  const noCheckIn = await prisma.visit.count({ where: { checkInOutOfRange: true, checkInAt: null } });
  check("geofence: no se marca fuera de rango sin check-in", noCheckIn === 0, `${noCheckIn}`);

  const badCheckout = await prisma.visit.count({ where: { checkOutOutOfRange: true, checkOutAt: null } });
  check("geofence: no se marca check-out fuera de rango sin check-out", badCheckout === 0, `${badCheckout}`);

  const timeTravel: Record<string, bigint>[] = await prisma.$queryRaw`
    SELECT 'Visit' AS t, COUNT(*) AS n FROM Visit WHERE clientCreatedAt > receivedAt
    UNION ALL SELECT 'QrScan', COUNT(*) FROM QrScan WHERE clientCreatedAt > receivedAt
    UNION ALL SELECT 'Novelty', COUNT(*) FROM Novelty WHERE clientCreatedAt > receivedAt
    UNION ALL SELECT 'Evidence', COUNT(*) FROM Evidence WHERE clientCreatedAt > receivedAt
    UNION ALL SELECT 'ChecklistItemResult', COUNT(*) FROM ChecklistItemResult WHERE clientCreatedAt > receivedAt
  `;
  check("regla 5: clientCreatedAt nunca posterior a receivedAt", timeTravel.every((r) => Number(r.n) === 0), timeTravel.filter((r) => Number(r.n) > 0).map((r) => `${r.t}=${r.n}`).join(", "));

  const completedBroken = await prisma.visit.count({ where: { status: "COMPLETED", OR: [{ checkInAt: null }, { checkOutAt: null }] } });
  check("visitas: COMPLETED tiene check-in y check-out", completedBroken === 0, `${completedBroken}`);

  const inProgressDone = await prisma.visit.count({ where: { status: "IN_PROGRESS", checkOutAt: { not: null } } });
  check("visitas: IN_PROGRESS sin check-out", inProgressDone === 0, `${inProgressDone}`);

  const assignedStarted = await prisma.visit.count({ where: { status: "ASSIGNED", checkInAt: { not: null } } });
  check("visitas: ASSIGNED sin check-in", assignedStarted === 0, `${assignedStarted}`);

  const cancelled = await prisma.visit.count({ where: { status: "CANCELLED" } });
  const cancelledStarted = await prisma.visit.count({ where: { status: "CANCELLED", checkInAt: { not: null } } });
  check("visitas: hay CANCELLED en el dataset", cancelled > 0, `${cancelled}`);
  check("visitas: CANCELLED antes de iniciar", cancelledStarted === 0, `${cancelledStarted}`);

  const resolvedBroken = await prisma.novelty.count({
    where: { status: "RESOLVED", OR: [{ closedAt: null }, { closedById: null }, { resolutionAction: null }] },
  });
  check("CA-07: toda RESOLVED tiene cierre completo", resolvedBroken === 0, `${resolvedBroken}`);

  const openClosed = await prisma.novelty.count({ where: { status: { not: "RESOLVED" }, closedAt: { not: null } } });
  check("novedades: una novedad abierta no tiene closedAt", openClosed === 0, `${openClosed}`);

  const noveltyOrphan = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM Novelty n LEFT JOIN Visit v ON v.id = n.visitId WHERE v.id IS NULL
  `;
  check("novedades: todas cuelgan de una visita", Number(noveltyOrphan[0]?.total ?? 0) === 0, `${noveltyOrphan[0]?.total}`);

  const futureReceived = await prisma.visit.count({ where: { receivedAt: { gt: new Date() } } });
  check("visitas: ninguna recepcion en el futuro", futureReceived === 0, `${futureReceived}`);

  const futureEvidence = await prisma.evidence.count({ where: { receivedAt: { gt: new Date() } } });
  check("evidencias: ninguna recepcion en el futuro", futureEvidence === 0, `${futureEvidence}`);

  const scannedInactive = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM QrScan s JOIN QrPoint q ON q.id = s.qrPointId WHERE q.isActive = 0
  `;
  check("RF-QR-06: no hay escaneos sobre puntos inactivos", Number(scannedInactive[0]?.total ?? 0) === 0, `${scannedInactive[0]?.total}`);

  const todays = await listVisits({ from: `${today}T00:00:00.000-05:00`, to: `${today}T23:59:59.999-05:00` });
  check("jornada de hoy: hay visitas", todays.length > 0, `${todays.length}`);

  console.log(failures === 0 ? "\nVERIFICACION COMPLETA: todo en verde" : `\n${failures} COMPROBACIONES FALLARON`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
