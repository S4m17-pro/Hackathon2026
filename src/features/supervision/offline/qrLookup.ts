import { db, type CachedQrPoint } from "@/features/supervision/offline/db";
import { haversineMeters } from "@/features/supervision/offline/geo";
import type { GeoPoint } from "@/shared/types";

export async function findCachedQrPoint(
  code: string,
): Promise<CachedQrPoint | undefined> {
  return db.qrPoints.get(code);
}

export interface QrLocationCheck {
  found: boolean;
  point?: CachedQrPoint;
  distanceMeters?: number;
  verified?: boolean;
}

/** Valida el QR contra la caché local y el radio del punto (Haversine). */
export async function verifyQrLocation(
  code: string,
  position: GeoPoint,
): Promise<QrLocationCheck> {
  const point = await db.qrPoints.get(code);

  if (!point) {
    return { found: false };
  }

  const distanceMeters = haversineMeters(position, point);

  return {
    found: true,
    point,
    distanceMeters,
    verified: distanceMeters <= point.radiusMeters,
  };
}
