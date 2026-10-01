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
  const scheduledAt =
    filters.from !== undefined || filters.to !== undefined
      ? {
          ...(filters.from !== undefined ? { gte: new Date(filters.from) } : {}),
          ...(filters.to !== undefined ? { lte: new Date(filters.to) } : {}),
        }
      : undefined;

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
  const clientCreatedAt =
    filters.from !== undefined || filters.to !== undefined
      ? {
          ...(filters.from !== undefined ? { gte: new Date(filters.from) } : {}),
          ...(filters.to !== undefined ? { lte: new Date(filters.to) } : {}),
        }
      : undefined;

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
