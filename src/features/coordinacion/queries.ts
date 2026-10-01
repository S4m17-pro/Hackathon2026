import type {
  ChecklistTemplate as PrismaChecklistTemplate,
  ChecklistTemplateItem as PrismaChecklistTemplateItem,
  CostCenter as PrismaCostCenter,
  QrPoint as PrismaQrPoint,
  User as PrismaUser,
} from "@prisma/client";

import {
  findPendingRequiredItems,
  getVisitChecklist,
  toChecklistItemResultDTO,
  toEvidenceDTO,
  toNoveltyDTO,
  toQrScanDTO,
  toVisitDTO,
} from "@/shared/lib/data";
import { prisma } from "@/shared/lib/prisma";
import type {
  ChecklistItemResult,
  ChecklistTemplate,
  ChecklistTemplateItem,
  CostCenter,
  Evidence,
  EvidenceOwnerType,
  Novelty,
  NoveltyPriority,
  NoveltyStatus,
  QrPoint,
  QrScan,
  User,
  Visit,
  VisitStatus,
} from "@/shared/types";

/**
 * Lecturas del panel. Importar solo desde Server Components.
 * No lleva "use server". Las fechas salen en ISO-8601.
 * El panel muestra `clientCreatedAt` (hora en campo). `scheduledAt` es el horario de oficina.
 */

export interface VisitFilters {
  supervisorId?: string;
  costCenterId?: string;
  status?: VisitStatus;
  /** ISO-8601. Limite inferior de `scheduledAt`. */
  from?: string;
  /** ISO-8601. Limite superior de `scheduledAt`. */
  to?: string;
}

export interface NoveltyFilters {
  priority?: NoveltyPriority;
  status?: NoveltyStatus;
  costCenterId?: string;
  supervisorId?: string;
  /** ISO-8601. Filtra `clientCreatedAt`, la hora en campo. */
  from?: string;
  to?: string;
}

export interface DashboardKpis {
  visitsScheduled: number;
  visitsCompleted: number;
  visitsPending: number;
  openNovelties: number;
  visitsDonePercent: number;
  checklistDonePercent: number;
  gpsVerifiedPercent: number;
}

export interface ChecklistItemView extends ChecklistTemplateItem {
  result: ChecklistItemResult | null;
}

export interface SupervisorPosition {
  supervisorId: string;
  lat: number;
  lng: number;
  at: string;
}

export interface OperationsMap {
  costCenters: CostCenter[];
  qrPoints: QrPoint[];
  scans: QrScan[];
  lastPositions: SupervisorPosition[];
}

export type RouteStatus = "SIN_VISITA" | "PENDIENTE" | "EN_RUTA" | "COMPLETADA";

export interface SupervisorRoute {
  supervisor: User;
  status: RouteStatus;
  visits: Visit[];
}

export interface VisitHistoryItem extends Visit {
  supervisorName: string;
  costCenterName: string;
  /** RF-VIS-07. Null si falta check-in o check-out. */
  durationMinutes: number | null;
}

export interface PrintableQrRow {
  code: string;
  areaName: string;
  radiusMeters: number;
  costCenterName: string;
  address: string;
  isActive: boolean;
}

export interface EvidenceGalleryItem extends Evidence {
  /** Texto corto para la galeria: visita, novedad, escaneo o checklist. */
  context: string;
}

export interface OperationsReportFilters {
  from: string;
  to: string;
  supervisorId?: string;
  costCenterId?: string;
}

export interface OperationsReport {
  from: string;
  to: string;
  supervisorId: string | null;
  costCenterId: string | null;
  visitsScheduled: number;
  visitsCompleted: number;
  visitsPending: number;
  openNovelties: number;
  visitsDonePercent: number;
  gpsVerifiedPercent: number;
  visits: VisitHistoryItem[];
  novelties: Novelty[];
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const notCancelled = { status: { not: "CANCELLED" as const } };

  const [assigned, inProgress, completed, open, inReview, checkedIn, gpsOk] =
    await Promise.all([
      prisma.visit.count({ where: { status: "ASSIGNED" } }),
      prisma.visit.count({ where: { status: "IN_PROGRESS" } }),
      prisma.visit.count({ where: { status: "COMPLETED" } }),
      prisma.novelty.count({ where: { status: "OPEN" } }),
      prisma.novelty.count({ where: { status: "IN_REVIEW" } }),
      prisma.visit.count({ where: { ...notCancelled, checkInAt: { not: null } } }),
      prisma.visit.count({
        where: {
          ...notCancelled,
          checkInAt: { not: null },
          checkInVerified: true,
          checkInOutOfRange: false,
        },
      }),
    ]);

  const programmed = assigned + inProgress + completed;
  const checklist = await checklistCompletion();

  return {
    visitsScheduled: programmed,
    visitsCompleted: completed,
    visitsPending: assigned + inProgress,
    openNovelties: open + inReview,
    visitsDonePercent: percent(completed, programmed),
    checklistDonePercent: checklist,
    gpsVerifiedPercent: percent(gpsOk, checkedIn),
  };
}

export async function listVisits(filters: VisitFilters = {}): Promise<Visit[]> {
  const scheduledAt = scheduledRange(filters.from, filters.to);

  const rows = await prisma.visit.findMany({
    where: {
      ...(filters.supervisorId !== undefined ? { supervisorId: filters.supervisorId } : {}),
      ...(filters.costCenterId !== undefined ? { costCenterId: filters.costCenterId } : {}),
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { clientCreatedAt: "asc" }],
  });

  return rows.map(toVisitDTO);
}

export async function listOutOfRangeVisits(): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [{ checkInOutOfRange: true }, { checkOutOutOfRange: true }],
    },
    orderBy: { receivedAt: "desc" },
  });

  return rows.map(toVisitDTO);
}

export async function listNovelties(filters: NoveltyFilters = {}): Promise<Novelty[]> {
  const clientCreatedAt = scheduledRange(filters.from, filters.to);

  const rows = await prisma.novelty.findMany({
    where: {
      ...(filters.priority !== undefined ? { priority: filters.priority } : {}),
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(clientCreatedAt !== undefined ? { clientCreatedAt } : {}),
      ...(filters.costCenterId !== undefined || filters.supervisorId !== undefined
        ? {
            visit: {
              ...(filters.costCenterId !== undefined
                ? { costCenterId: filters.costCenterId }
                : {}),
              ...(filters.supervisorId !== undefined
                ? { supervisorId: filters.supervisorId }
                : {}),
            },
          }
        : {}),
    },
    orderBy: { clientCreatedAt: "desc" },
  });

  return rows.map(toNoveltyDTO);
}

export async function listCostCenters(): Promise<CostCenter[]> {
  const rows = await prisma.costCenter.findMany({ orderBy: { name: "asc" } });
  return rows.map(toCostCenterDTO);
}

export async function listQrPoints(costCenterId?: string): Promise<QrPoint[]> {
  const rows = await prisma.qrPoint.findMany({
    where: costCenterId !== undefined ? { costCenterId } : undefined,
    orderBy: { code: "asc" },
  });

  return rows.map(toQrPointDTO);
}

export async function listEvidence(): Promise<Evidence[]> {
  const rows = await prisma.evidence.findMany({ orderBy: { clientCreatedAt: "desc" } });
  return rows.map(toEvidenceDTO);
}

export async function listSupervisors(): Promise<User[]> {
  const rows = await prisma.user.findMany({
    where: { role: "SUPERVISOR" },
    orderBy: { name: "asc" },
  });

  return rows.map(toUserDTO);
}

export async function listChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const rows = await prisma.checklistTemplate.findMany({
    where: { isActive: true },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => toChecklistTemplateDTO(row, row.items));
}

export async function getChecklistForVisit(visitId: string): Promise<ChecklistItemView[]> {
  const rows = await getVisitChecklist(visitId);

  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    costCenterId: row.costCenterId,
    label: row.label,
    position: row.position,
    required: row.required,
    result: row.result === null ? null : toChecklistItemResultDTO(row.result),
  }));
}

export async function listPendingChecklistLabels(visitId: string): Promise<string[]> {
  return findPendingRequiredItems(visitId);
}

export async function getOperationsMap(): Promise<OperationsMap> {
  const [costCenters, qrPoints, scans, positioned] = await Promise.all([
    listCostCenters(),
    listQrPoints(),
    prisma.qrScan.findMany({ orderBy: { clientCreatedAt: "desc" }, take: 200 }),
    prisma.visit.findMany({
      where: {
        checkInLat: { not: null },
        checkInLng: { not: null },
        checkInAt: { not: null },
        status: { not: "CANCELLED" },
      },
      orderBy: { checkInAt: "desc" },
      select: {
        supervisorId: true,
        checkInLat: true,
        checkInLng: true,
        checkInAt: true,
      },
    }),
  ]);

  const seen = new Set<string>();
  const lastPositions: SupervisorPosition[] = [];

  for (const visit of positioned) {
    if (seen.has(visit.supervisorId) || visit.checkInLat === null || visit.checkInLng === null) {
      continue;
    }

    if (visit.checkInAt === null) {
      continue;
    }

    seen.add(visit.supervisorId);
    lastPositions.push({
      supervisorId: visit.supervisorId,
      lat: visit.checkInLat,
      lng: visit.checkInLng,
      at: visit.checkInAt.toISOString(),
    });
  }

  return {
    costCenters,
    qrPoints,
    scans: scans.map(toQrScanDTO),
    lastPositions,
  };
}

/** RF-ASI-04. `day` es YYYY-MM-DD en America/Bogota. */
export async function listVisitsForDay(supervisorId: string, day: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({
    where: { supervisorId, scheduledAt: bogotaDayRange(day), status: { not: "CANCELLED" } },
    orderBy: { scheduledAt: "asc" },
  });

  return rows.map(toVisitDTO);
}

/** RF-PAN-03. Por defecto el dia de hoy en Bogota. */
export async function listSupervisorRoutes(day = bogotaToday()): Promise<SupervisorRoute[]> {
  const [supervisors, rows] = await Promise.all([
    listSupervisors(),
    prisma.visit.findMany({
      where: { scheduledAt: bogotaDayRange(day) },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const bySupervisor = new Map<string, Visit[]>();

  for (const visit of rows.map(toVisitDTO)) {
    const bucket = bySupervisor.get(visit.supervisorId) ?? [];
    bucket.push(visit);
    bySupervisor.set(visit.supervisorId, bucket);
  }

  return supervisors.map((supervisor) => {
    const visits = bySupervisor.get(supervisor.id) ?? [];

    return { supervisor, status: routeStatus(visits), visits };
  });
}

/** RF-PAN-06. Historial con nombres y duracion. Mismos filtros que `listVisits`. */
export async function getVisitHistory(filters: VisitFilters = {}): Promise<VisitHistoryItem[]> {
  const scheduledAt = scheduledRange(filters.from, filters.to);
  const rows = await prisma.visit.findMany({
    where: {
      ...(filters.supervisorId !== undefined ? { supervisorId: filters.supervisorId } : {}),
      ...(filters.costCenterId !== undefined ? { costCenterId: filters.costCenterId } : {}),
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
    },
    include: {
      supervisor: { select: { name: true } },
      costCenter: { select: { name: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { clientCreatedAt: "asc" }],
  });

  return rows.map((row) => ({
    ...toVisitDTO(row),
    supervisorName: row.supervisor.name,
    costCenterName: row.costCenter.name,
    durationMinutes: durationMinutes(row.checkInAt, row.checkOutAt),
  }));
}

export async function getVisitDetail(visitId: string): Promise<
  | (VisitHistoryItem & { pendingChecklist: string[] })
  | null
> {
  const row = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      supervisor: { select: { name: true } },
      costCenter: { select: { name: true } },
    },
  });

  if (row === null) {
    return null;
  }

  return {
    ...toVisitDTO(row),
    supervisorName: row.supervisor.name,
    costCenterName: row.costCenter.name,
    durationMinutes: durationMinutes(row.checkInAt, row.checkOutAt),
    pendingChecklist: await findPendingRequiredItems(visitId),
  };
}

/** RF-PAN-08. Programada, ya paso la hora y sigue ASSIGNED. */
export async function listDelayedVisits(asOf: Date = new Date()): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({
    where: { status: "ASSIGNED", scheduledAt: { lt: asOf } },
    orderBy: { scheduledAt: "asc" },
  });

  return rows.map(toVisitDTO);
}

/**
 * RF-NOV-03. Novedades aun no cerradas, las de mayor prioridad primero.
 * `since` filtra `receivedAt` para el sondeo del panel.
 */
export async function listNoveltyAlerts(since?: string): Promise<Novelty[]> {
  const receivedAfter = parseOptionalIso(since, "since");
  const rows = await prisma.novelty.findMany({
    where: {
      status: { in: ["OPEN", "IN_REVIEW"] },
      ...(receivedAfter !== undefined ? { receivedAt: { gte: receivedAfter } } : {}),
    },
    orderBy: [{ priority: "desc" }, { receivedAt: "desc" }],
  });

  return rows.map(toNoveltyDTO);
}

/** RF-NOV-04 / RF-PAN-05. Evidencias de una visita, novedad, escaneo o checklist. */
export async function listEvidenceByOwner(
  ownerType: EvidenceOwnerType,
  ownerId: string,
): Promise<Evidence[]> {
  const rows = await prisma.evidence.findMany({
    where: { ownerType, ownerId },
    orderBy: { clientCreatedAt: "desc" },
  });

  return rows.map(toEvidenceDTO);
}

/** RF-PAN-05. Galeria con un texto de contexto por evidencia. */
export async function listEvidenceGallery(): Promise<EvidenceGalleryItem[]> {
  const rows = await prisma.evidence.findMany({ orderBy: { clientCreatedAt: "desc" } });
  const ids = (type: EvidenceOwnerType) =>
    rows.filter((row) => row.ownerType === type).map((row) => row.ownerId);

  const [visits, novelties, scans, checklistItems] = await Promise.all([
    prisma.visit.findMany({
      where: { id: { in: ids("VISIT") } },
      include: { costCenter: { select: { name: true } } },
    }),
    prisma.novelty.findMany({
      where: { id: { in: ids("NOVELTY") } },
      select: { id: true, description: true },
    }),
    prisma.qrScan.findMany({
      where: { id: { in: ids("QR_SCAN") } },
      include: { qrPoint: { select: { areaName: true, code: true } } },
    }),
    prisma.checklistItemResult.findMany({
      where: { id: { in: ids("CHECKLIST_ITEM") } },
      include: { item: { select: { label: true } } },
    }),
  ]);

  const visitContext = new Map(visits.map((row) => [row.id, `Visita · ${row.costCenter.name}`]));
  const noveltyContext = new Map(
    novelties.map((row) => [row.id, `Novedad · ${truncate(row.description)}`]),
  );
  const scanContext = new Map(
    scans.map((row) => [row.id, `Escaneo · ${row.qrPoint.code} ${row.qrPoint.areaName}`]),
  );
  const checklistContext = new Map(
    checklistItems.map((row) => [row.id, `Checklist · ${row.item.label}`]),
  );

  return rows.map((row) => ({
    ...toEvidenceDTO(row),
    context:
      visitContext.get(row.ownerId) ??
      noveltyContext.get(row.ownerId) ??
      scanContext.get(row.ownerId) ??
      checklistContext.get(row.ownerId) ??
      row.ownerType,
  }));
}

/** RF-QR-02. Datos de la hoja imprimible. Solo puntos activos. */
export async function listPrintableQrPoints(costCenterId?: string): Promise<PrintableQrRow[]> {
  const rows = await prisma.qrPoint.findMany({
    where: {
      isActive: true,
      ...(costCenterId !== undefined ? { costCenterId } : {}),
    },
    include: { costCenter: { select: { name: true, address: true } } },
    orderBy: [{ costCenterId: "asc" }, { code: "asc" }],
  });

  return rows.map((row) => ({
    code: row.code,
    areaName: row.areaName,
    radiusMeters: row.radiusMeters,
    costCenterName: row.costCenter.name,
    address: row.costCenter.address,
    isActive: row.isActive,
  }));
}

/** RF-REP-01 / RF-REP-02. Consolidado del periodo. El panel muestra `clientCreatedAt`. */
export async function getOperationsReport(
  filters: OperationsReportFilters,
): Promise<OperationsReport> {
  const from = parseIso(filters.from, "from");
  const to = parseIso(filters.to, "to");
  const scope = {
    ...(filters.supervisorId !== undefined ? { supervisorId: filters.supervisorId } : {}),
    ...(filters.costCenterId !== undefined ? { costCenterId: filters.costCenterId } : {}),
  };

  const [visitRows, noveltyRows] = await Promise.all([
    prisma.visit.findMany({
      where: { ...scope, scheduledAt: { gte: from, lte: to } },
      include: {
        supervisor: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.novelty.findMany({
      where: {
        clientCreatedAt: { gte: from, lte: to },
        ...(Object.keys(scope).length > 0 ? { visit: scope } : {}),
      },
      orderBy: { clientCreatedAt: "desc" },
    }),
  ]);

  const visits = visitRows.map((row) => ({
    ...toVisitDTO(row),
    supervisorName: row.supervisor.name,
    costCenterName: row.costCenter.name,
    durationMinutes: durationMinutes(row.checkInAt, row.checkOutAt),
  }));
  const active = visits.filter((visit) => visit.status !== "CANCELLED");
  const completed = active.filter((visit) => visit.status === "COMPLETED");
  const checkedIn = active.filter((visit) => visit.checkInAt !== null);
  const gpsOk = checkedIn.filter((visit) => visit.checkInVerified && !visit.checkInOutOfRange);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    supervisorId: filters.supervisorId ?? null,
    costCenterId: filters.costCenterId ?? null,
    visitsScheduled: active.length,
    visitsCompleted: completed.length,
    visitsPending: active.filter((visit) => visit.status !== "COMPLETED").length,
    openNovelties: noveltyRows.filter((row) => row.status !== "RESOLVED").length,
    visitsDonePercent: percent(completed.length, active.length),
    gpsVerifiedPercent: percent(gpsOk.length, checkedIn.length),
    visits,
    novelties: noveltyRows.map(toNoveltyDTO),
  };
}

/** RF-REP-03. CSV que Excel abre. No agrega dependencias. */
export function operationsReportToCsv(report: OperationsReport): string {
  const header = [
    "tipo",
    "id",
    "estado",
    "prioridad",
    "supervisor",
    "centro",
    "programada",
    "hora_campo",
    "hora_servidor",
    "duracion_min",
    "descripcion",
  ];
  const lines = [header.join(",")];

  for (const visit of report.visits) {
    lines.push(
      [
        "visita",
        visit.id,
        visit.status,
        "",
        visit.supervisorName,
        visit.costCenterName,
        visit.scheduledAt ?? "",
        visit.clientCreatedAt,
        visit.receivedAt,
        visit.durationMinutes === null ? "" : String(visit.durationMinutes),
        visit.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  for (const novelty of report.novelties) {
    lines.push(
      [
        "novedad",
        novelty.id,
        novelty.status,
        novelty.priority,
        "",
        "",
        "",
        novelty.clientCreatedAt,
        novelty.receivedAt,
        "",
        novelty.description,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return lines.join("\n");
}

/** YYYY-MM-DD de hoy en America/Bogota. */
export function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function bogotaDayRange(day: string): { gte: Date; lte: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("El dia tiene que ir como YYYY-MM-DD.");
  }

  return {
    gte: new Date(`${day}T00:00:00.000-05:00`),
    lte: new Date(`${day}T23:59:59.999-05:00`),
  };
}

function routeStatus(visits: Visit[]): RouteStatus {
  const active = visits.filter((visit) => visit.status !== "CANCELLED");

  if (active.length === 0) {
    return "SIN_VISITA";
  }

  if (active.some((visit) => visit.status === "IN_PROGRESS")) {
    return "EN_RUTA";
  }

  if (active.every((visit) => visit.status === "COMPLETED")) {
    return "COMPLETADA";
  }

  return "PENDIENTE";
}

function scheduledRange(
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lte?: Date } | undefined {
  const gte = parseOptionalIso(from, "from");
  const lte = parseOptionalIso(to, "to");

  if (gte === undefined && lte === undefined) {
    return undefined;
  }

  return {
    ...(gte !== undefined ? { gte } : {}),
    ...(lte !== undefined ? { lte } : {}),
  };
}

function parseOptionalIso(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseIso(value, field);
}

function parseIso(value: string, field: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} no es una fecha ISO-8601 valida.`);
  }

  return parsed;
}

function durationMinutes(checkInAt: Date | null, checkOutAt: Date | null): number | null {
  if (checkInAt === null || checkOutAt === null) {
    return null;
  }

  const minutes = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60_000);

  return minutes < 0 ? null : minutes;
}

function truncate(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();

  return clean.length <= 80 ? clean : `${clean.slice(0, 77)}...`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

async function checklistCompletion(): Promise<number> {
  const visits = await prisma.visit.findMany({
    where: { status: { not: "CANCELLED" }, checklistTemplateId: { not: null } },
    select: { id: true },
  });

  let required = 0;
  let pending = 0;

  for (const visit of visits) {
    const items = await getVisitChecklist(visit.id);
    const requiredItems = items.filter((item) => item.required);
    required += requiredItems.length;
    pending += (await findPendingRequiredItems(visit.id)).length;
  }

  return percent(required - pending, required);
}

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function toUserDTO(user: PrismaUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toCostCenterDTO(row: PrismaCostCenter): CostCenter {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    checklistTemplateId: row.checklistTemplateId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toQrPointDTO(row: PrismaQrPoint): QrPoint {
  return {
    id: row.id,
    code: row.code,
    costCenterId: row.costCenterId,
    areaName: row.areaName,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toChecklistTemplateDTO(
  row: PrismaChecklistTemplate,
  items: PrismaChecklistTemplateItem[],
): ChecklistTemplate {
  return {
    id: row.id,
    name: row.name,
    createdById: row.createdById,
    isActive: row.isActive,
    items: items.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      costCenterId: item.costCenterId,
      label: item.label,
      position: item.position,
      required: item.required,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
