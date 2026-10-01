import { db, type CachedQrPoint } from "@/features/supervision/offline/db";
import { haversineMeters } from "@/features/supervision/offline/geo";
import type { GeoPoint, QrPoint } from "@/shared/types";

export interface QrLocationCheck {
  found: boolean;
  point?: CachedQrPoint;
  distanceMeters?: number;
  verified: boolean;
  isOutOfRange: boolean;
  toleranceMeters?: number;
  error?: string;
}

/**
 * Normaliza el código de escaneo eliminando espacios en blanco accidentales.
 */
function normalizeQrCode(code: string): string {
  return code ? code.trim() : "";
}

/**
 * Consulta y resuelve un código QR directamente contra la base de datos local Dexie (IndexedDB),
 * garantizando disponibilidad 100% offline.
 *
 * @param code - Código leído por el escáner (ej. "QR-PLAZA-NORTE-1")
 * @returns El punto QR en caché o `undefined` si no está registrado
 */
export async function findCachedQrPoint(
  code: string
): Promise<CachedQrPoint | undefined> {
  const normalized = normalizeQrCode(code);
  if (!normalized) return undefined;

  // 1. Búsqueda directa por clave primaria indexada en Dexie
  const directMatch = await db.qrPoints.get(normalized);
  if (directMatch) return directMatch;

  // 2. Fallback insensible a mayúsculas/minúsculas en Dexie
  const caseInsensitiveMatch = await db.qrPoints
    .filter((p) => p.code.toLowerCase() === normalized.toLowerCase())
    .first();

  if (caseInsensitiveMatch) return caseInsensitiveMatch;

  return undefined;
}

/**
 * Valida un código QR escaneado offline contra la posición GPS actual del supervisor.
 * Aplica la regla 3 de negocio (MICRO_SDD): si está fuera de rango, no bloquea
 * sino que calcula la distancia y marca la bandera para auditoría posterior.
 *
 * @param code - Código QR capturado
 * @param position - Coordenadas actuales del supervisor
 */
export async function verifyQrLocation(
  code: string,
  position: GeoPoint
): Promise<QrLocationCheck> {
  const point = await findCachedQrPoint(code);

  if (!point) {
    return {
      found: false,
      verified: false,
      isOutOfRange: false,
      error: `El código QR "${code}" no se encuentra en el catálogo local de este dispositivo.`,
    };
  }

  try {
    const distanceMeters = haversineMeters(position, {
      lat: point.lat,
      lng: point.lng,
    });

    const tolerance = point.radiusMeters ?? 50;
    const isWithin = distanceMeters <= tolerance;

    return {
      found: true,
      point,
      distanceMeters,
      verified: isWithin,
      isOutOfRange: !isWithin,
      toleranceMeters: tolerance,
    };
  } catch (err) {
    return {
      found: true,
      point,
      verified: false,
      isOutOfRange: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al calcular la distancia geográfica.",
    };
  }
}

/**
 * Almacena o actualiza un lote de puntos QR en la base de datos local Dexie.
 * Usado cuando el supervisor descarga su jornada o sincroniza con el servidor.
 */
const RETIRED_QR_CODES = [
  "QR-PLAZA-CENTRAL-1",
  "QR-PLAZA-CENTRAL-2",
  "QR-PLAZA-CENTRAL-3",
  "QR-CENTRO-EMPRESARIAL-1",
  "QR-CENTRO-EMPRESARIAL-2",
  "QR-CENTRO-EMPRESARIAL-3",
  "AREA-NORTE-01",
];

/** Quita del teléfono códigos que nunca estuvieron en la base. */
export async function dropRetiredQrPoints(): Promise<void> {
  await db.qrPoints.bulkDelete(RETIRED_QR_CODES);
}

export async function bulkCacheQrPoints(
  points: Array<
    | CachedQrPoint
    | Pick<
        QrPoint,
        | "code"
        | "id"
        | "costCenterId"
        | "areaName"
        | "lat"
        | "lng"
        | "radiusMeters"
      >
  >
): Promise<void> {
  if (!points || points.length === 0) return;

  const now = new Date().toISOString();

  const recordsToStore: CachedQrPoint[] = points.map((p) => ({
    code: normalizeQrCode(p.code),
    id: p.id,
    costCenterId: p.costCenterId,
    areaName: p.areaName,
    lat: p.lat,
    lng: p.lng,
    radiusMeters: p.radiusMeters,
    cachedAt: "cachedAt" in p && p.cachedAt ? p.cachedAt : now,
  }));

  await db.qrPoints.bulkPut(recordsToStore);
}

/**
 * Lista los puntos QR cacheados en el dispositivo, opcionalmente filtrados por centro de costos.
 */
export async function listCachedQrPoints(
  costCenterId?: string
): Promise<CachedQrPoint[]> {
  if (costCenterId) {
    return db.qrPoints.where("costCenterId").equals(costCenterId).toArray();
  }
  return db.qrPoints.toArray();
}

/**
 * Limpia la caché local de puntos QR.
 */
export async function clearQrCache(): Promise<void> {
  await db.qrPoints.clear();
}
