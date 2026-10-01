import type { GeoPoint } from "@/shared/types";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function haversineMeters(origin: GeoPoint, target: GeoPoint): number {
  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLng = toRadians(target.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(
  position: GeoPoint,
  center: GeoPoint,
  radiusMeters: number,
): boolean {
  return haversineMeters(position, center) <= radiusMeters;
}
