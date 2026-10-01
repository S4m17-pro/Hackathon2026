"use server";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  assignChecklistTemplateToCostCenter,
  assignChecklistTemplateToVisit,
  changeNoveltyStatus,
  DataError,
  DEFAULT_QR_RADIUS_METERS,
  toNoveltyDTO,
  toVisitDTO,
} from "@/shared/lib/data";
import { prisma } from "@/shared/lib/prisma";
import type {
  ChecklistTemplateItem,
  Novelty,
  NoveltyStatus,
  Visit,
} from "@/shared/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface AssignVisitInput {
  supervisorId: string;
  costCenterId: string;
  /** ISO-8601. Hora programada de la visita (RF-ASI-01). */
  scheduledAt: string;
  checklistTemplateId?: string | null;
}

export interface UpdateVisitAssignmentInput {
  visitId: string;
  supervisorId?: string;
  costCenterId?: string;
  scheduledAt?: string;
  checklistTemplateId?: string | null;
}

export interface CostCenterInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface QrPointInput {
  code: string;
  costCenterId: string;
  areaName: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
}

export interface ChecklistTemplateInput {
  name: string;
  createdById: string;
  items: Array<{ label: string; required?: boolean }>;
}

/**
 * Crea una visita ASSIGNED. El `clientId` lo genera el servidor: esta visita
 * no nacio en el dispositivo. `upsertVisit` no sirve aqui porque no escribe
 * `scheduledAt`.
 */
export async function createAssignedVisit(
  input: AssignVisitInput,
): Promise<ActionResult<Visit>> {
  try {
    const scheduledAt = parseIso(input.scheduledAt, "scheduledAt");
    await assertSupervisor(input.supervisorId);
    const costCenter = await prisma.costCenter.findUnique({
      where: { id: input.costCenterId },
      select: { id: true, checklistTemplateId: true },
    });

    if (costCenter === null) {
      return { ok: false, error: "No existe el centro de costo." };
    }

    const checklistTemplateId =
      input.checklistTemplateId === undefined
        ? costCenter.checklistTemplateId
        : input.checklistTemplateId;

    if (checklistTemplateId !== null) {
      await assertTemplate(checklistTemplateId);
    }

    const visit = await prisma.visit.create({
      data: {
        clientId: randomUUID(),
        supervisorId: input.supervisorId,
        costCenterId: input.costCenterId,
        checklistTemplateId,
        status: "ASSIGNED",
        scheduledAt,
        clientCreatedAt: scheduledAt,
      },
    });

    return { ok: true, data: toVisitDTO(visit) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Edita supervisor, centro, horario o plantilla. No toca check-in ni check-out. */
export async function updateVisitAssignment(
  input: UpdateVisitAssignmentInput,
): Promise<ActionResult<Visit>> {
  try {
    const current = await prisma.visit.findUnique({ where: { id: input.visitId } });

    if (current === null) {
      return { ok: false, error: "No existe la visita." };
    }

    if (current.status === "CANCELLED" || current.status === "COMPLETED") {
      return {
        ok: false,
        error: "Solo se puede editar una visita asignada o en curso.",
      };
    }

    if (input.supervisorId !== undefined) {
      await assertSupervisor(input.supervisorId);
    }

    if (input.costCenterId !== undefined) {
      const center = await prisma.costCenter.findUnique({
        where: { id: input.costCenterId },
        select: { id: true },
      });

      if (center === null) {
        return { ok: false, error: "No existe el centro de costo." };
      }
    }

    if (input.checklistTemplateId) {
      await assertTemplate(input.checklistTemplateId);
    }

    const visit = await prisma.visit.update({
      where: { id: input.visitId },
      data: {
        ...(input.supervisorId !== undefined ? { supervisorId: input.supervisorId } : {}),
        ...(input.costCenterId !== undefined ? { costCenterId: input.costCenterId } : {}),
        ...(input.scheduledAt !== undefined
          ? { scheduledAt: parseIso(input.scheduledAt, "scheduledAt") }
          : {}),
        ...(input.checklistTemplateId !== undefined
          ? { checklistTemplateId: input.checklistTemplateId }
          : {}),
      },
    });

    return { ok: true, data: toVisitDTO(visit) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** RF-ASI-01. Idempotente si ya estaba cancelada. No cancela una visita completada. */
export async function cancelVisit(visitId: string): Promise<ActionResult<Visit>> {
  try {
    const current = await prisma.visit.findUnique({ where: { id: visitId } });

    if (current === null) {
      return { ok: false, error: "No existe la visita." };
    }

    if (current.status === "COMPLETED") {
      return { ok: false, error: "No se puede cancelar una visita ya completada." };
    }

    if (current.status === "CANCELLED") {
      return { ok: true, data: toVisitDTO(current) };
    }

    const visit = await prisma.visit.update({
      where: { id: visitId },
      data: { status: "CANCELLED" },
    });

    return { ok: true, data: toVisitDTO(visit) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function createCostCenter(
  input: CostCenterInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertGeo(input.lat, input.lng);
    const row = await prisma.costCenter.create({
      data: {
        name: requireText(input.name, "name"),
        address: requireText(input.address, "address"),
        lat: input.lat,
        lng: input.lng,
      },
    });

    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateCostCenter(
  id: string,
  input: Partial<CostCenterInput>,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (input.lat !== undefined || input.lng !== undefined) {
      const current = await prisma.costCenter.findUnique({ where: { id } });

      if (current === null) {
        return { ok: false, error: "No existe el centro de costo." };
      }

      assertGeo(input.lat ?? current.lat, input.lng ?? current.lng);
    }

    await prisma.costCenter.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: requireText(input.name, "name") } : {}),
        ...(input.address !== undefined
          ? { address: requireText(input.address, "address") }
          : {}),
        ...(input.lat !== undefined ? { lat: input.lat } : {}),
        ...(input.lng !== undefined ? { lng: input.lng } : {}),
      },
    });

    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function createQrPoint(
  input: QrPointInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertGeo(input.lat, input.lng);
    const row = await prisma.qrPoint.create({
      data: {
        code: requireText(input.code, "code"),
        costCenterId: input.costCenterId,
        areaName: requireText(input.areaName, "areaName"),
        lat: input.lat,
        lng: input.lng,
        radiusMeters: input.radiusMeters ?? DEFAULT_QR_RADIUS_METERS,
        isActive: true,
      },
    });

    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateQrPoint(
  id: string,
  input: Partial<Omit<QrPointInput, "costCenterId">> & { costCenterId?: string },
): Promise<ActionResult<{ id: string }>> {
  try {
    if (input.lat !== undefined && input.lng !== undefined) {
      assertGeo(input.lat, input.lng);
    }

    await prisma.qrPoint.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: requireText(input.code, "code") } : {}),
        ...(input.costCenterId !== undefined ? { costCenterId: input.costCenterId } : {}),
        ...(input.areaName !== undefined
          ? { areaName: requireText(input.areaName, "areaName") }
          : {}),
        ...(input.lat !== undefined ? { lat: input.lat } : {}),
        ...(input.lng !== undefined ? { lng: input.lng } : {}),
        ...(input.radiusMeters !== undefined ? { radiusMeters: input.radiusMeters } : {}),
      },
    });

    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Desactivar es un flag. La fila no se borra (RF-QR-02 / RF-QR-06). */
export async function setQrPointActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    const row = await prisma.qrPoint.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });

    return { ok: true, data: row };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function createChecklistTemplate(
  input: ChecklistTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const labels = input.items.map((item) => requireText(item.label, "label"));

    if (labels.length === 0) {
      return { ok: false, error: "La plantilla necesita al menos un item." };
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name: requireText(input.name, "name"),
        createdById: input.createdById,
        items: {
          create: labels.map((label, index) => ({
            label,
            position: index + 1,
            required: input.items[index]?.required ?? true,
          })),
        },
      },
      select: { id: true },
    });

    return { ok: true, data: { id: template.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function assignTemplateToCostCenter(
  costCenterId: string,
  checklistTemplateId: string | null,
): Promise<ActionResult<{ costCenterId: string }>> {
  try {
    await assignChecklistTemplateToCostCenter(costCenterId, checklistTemplateId);
    return { ok: true, data: { costCenterId } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function assignTemplateToVisit(
  visitId: string,
  templateId: string,
): Promise<ActionResult<ChecklistTemplateItem[]>> {
  try {
    const items = await assignChecklistTemplateToVisit(visitId, templateId);

    return {
      ok: true,
      data: items.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        costCenterId: item.costCenterId,
        label: item.label,
        position: item.position,
        required: item.required,
      })),
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * RF-NOV-04 / CA-07. El ciclo es OPEN -> IN_REVIEW -> RESOLVED (regla 4).
 * `RESOLVED` exige `closedById` y `resolutionAction`; eso lo valida
 * `changeNoveltyStatus`. Repetir el estado actual es idempotente.
 */
export async function updateNoveltyStatus(
  noveltyId: string,
  status: NoveltyStatus,
  closure?: { closedById: string; resolutionAction: string },
): Promise<ActionResult<Novelty>> {
  try {
    const current = await prisma.novelty.findUnique({ where: { id: noveltyId } });

    if (current === null) {
      return { ok: false, error: "No existe la novedad." };
    }

    if (current.status === status) {
      return { ok: true, data: toNoveltyDTO(current) };
    }

    const next: Partial<Record<NoveltyStatus, NoveltyStatus>> = {
      OPEN: "IN_REVIEW",
      IN_REVIEW: "RESOLVED",
    };

    if (next[current.status] !== status) {
      return {
        ok: false,
        error: "El ciclo es abierta, en seguimiento y cerrada, en ese orden.",
      };
    }

    const row = await changeNoveltyStatus(noveltyId, status, closure);
    return { ok: true, data: toNoveltyDTO(row) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

async function assertSupervisor(supervisorId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: { role: true },
  });

  if (user === null || user.role !== "SUPERVISOR") {
    throw new Error("El usuario no existe o no es supervisor.");
  }
}

async function assertTemplate(templateId: string): Promise<void> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });

  if (template === null) {
    throw new Error("No existe la plantilla de checklist.");
  }
}

function parseIso(value: string, field: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} no es una fecha ISO-8601 valida.`);
  }

  return parsed;
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${field} no puede ir vacio.`);
  }

  return trimmed;
}

function assertGeo(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("lat tiene que estar entre -90 y 90.");
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("lng tiene que estar entre -180 y 180.");
  }
}

function toActionError(error: unknown): string {
  if (error instanceof DataError) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Ya existe un registro con ese codigo.";
    }

    if (error.code === "P2025") {
      return "No se encontro el registro.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudo completar la operacion.";
}
