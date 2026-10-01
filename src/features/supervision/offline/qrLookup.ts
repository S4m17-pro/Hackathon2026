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

/** Puntos QR semilla oficiales del sistema para contingencia 100% offline. */
export const DEFAULT_SEED_QR_POINTS: Array<
  Omit<CachedQrPoint, "cachedAt">
> = [
  // Plaza Central
  {
    code: "QR-PLAZA-CENTRAL-1",
    id: "seed-qr-pc-1",
    costCenterId: "seed-cc-1",
    areaName: "Plaza Central - Area 1",
    lat: 4.658792,
    lng: -74.093898,
    radiusMeters: 50,
  },
  {
    code: "QR-PLAZA-CENTRAL-2",
    id: "seed-qr-pc-2",
    costCenterId: "seed-cc-1",
    areaName: "Plaza Central - Area 2",
    lat: 4.659192,
    lng: -74.094298,
    radiusMeters: 50,
  },
  {
    code: "QR-PLAZA-CENTRAL-3",
    id: "seed-qr-pc-3",
    costCenterId: "seed-cc-1",
    areaName: "Plaza Central - Area 3",
    lat: 4.659592,
    lng: -74.094698,
    radiusMeters: 50,
  },
  // Centro Empresarial
  {
    code: "QR-CENTRO-EMPRESARIAL-1",
    id: "seed-qr-ce-1",
    costCenterId: "seed-cc-2",
    areaName: "Centro Empresarial - Area 1",
    lat: 4.678831,
    lng: -74.058719,
    radiusMeters: 50,
  },
  {
    code: "QR-CENTRO-EMPRESARIAL-2",
    id: "seed-qr-ce-2",
    costCenterId: "seed-cc-2",
    areaName: "Centro Empresarial - Area 2",
    lat: 4.679231,
    lng: -74.059119,
    radiusMeters: 50,
  },
  {
    code: "QR-CENTRO-EMPRESARIAL-3",
    id: "seed-qr-ce-3",
    costCenterId: "seed-cc-2",
    areaName: "Centro Empresarial - Area 3",
    lat: 4.679631,
    lng: -74.059519,
    radiusMeters: 50,
  },
  // Parque Centro
  {
    code: "QR-PARQUE-CENTRO-1",
    id: "seed-qr-pq-1",
    costCenterId: "seed-cc-3",
    areaName: "Parque Centro - Area 1",
    lat: 4.707212,
    lng: -74.068527,
    radiusMeters: 50,
  },
  {
    code: "QR-PARQUE-CENTRO-2",
    id: "seed-qr-pq-2",
    costCenterId: "seed-cc-3",
    areaName: "Parque Centro - Area 2",
    lat: 4.707612,
    lng: -74.068927,
    radiusMeters: 50,
  },
  {
    code: "QR-PARQUE-CENTRO-3",
    id: "seed-qr-pq-3",
    costCenterId: "seed-cc-3",
    areaName: "Parque Centro - Area 3",
    lat: 4.708012,
    lng: -74.069327,
    radiusMeters: 50,
  },
  // Plaza Norte
  {
    code: "QR-PLAZA-NORTE-1",
    id: "seed-qr-pn-1",
    costCenterId: "seed-cc-4",
    areaName: "Plaza Norte - Area 1",
    lat: 4.658392,
    lng: -74.093498,
    radiusMeters: 50,
  },
  {
    code: "AREA-NORTE-01",
    id: "seed-qr-an-1",
    costCenterId: "seed-cc-4",
    areaName: "Area Norte 01",
    lat: 4.658392,
    lng: -74.093498,
    radiusMeters: 50,
  },
];

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
 * Si el catálogo local aún no ha sido sincronizado desde el servidor,
 * recurre al catálogo de contingencia para que el escaneo nunca se detenga.
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

  // 3. Fallback de contingencia: resolver contra los puntos semilla oficiales
  const fallback = DEFAULT_SEED_QR_POINTS.find(
    (p) => p.code.toLowerCase() === normalized.toLowerCase()
  );

  if (fallback) {
    const cachedRecord: CachedQrPoint = {
      ...fallback,
      cachedAt: new Date().toISOString(),
    };
    // Lo guardamos en Dexie para lecturas inmediatas posteriores
    await db.qrPoints.put(cachedRecord);
    return cachedRecord;
  }

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
