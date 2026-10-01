import type { GeoPoint } from "@/shared/types";

/** Radio medio de la Tierra en metros según el estándar WGS-84. */
const EARTH_RADIUS_METERS = 6_371_000;

/** Tolerancia por defecto en metros si no se especifica radio en el punto QR. */
export const DEFAULT_TOLERANCE_METERS = 50;

/**
 * Convierte grados sexagesimales a radianes.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Valida si las coordenadas están en rangos geográficos válidos.
 * Latitud: [-90, 90], Longitud: [-180, 180].
 */
export function isValidCoordinate(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/**
 * Calcula la distancia exacta en metros entre dos puntos geográficos
 * utilizando la fórmula de Haversine.
 *
 * @param origin - Coordenada GPS de origen (ej. ubicación actual del celular)
 * @param target - Coordenada GPS de destino (ej. coordenada del punto QR)
 * @returns Distancia en metros redondeada a 2 decimales
 */
export function haversineMeters(origin: GeoPoint, target: GeoPoint): number {
  if (!isValidCoordinate(origin) || !isValidCoordinate(target)) {
    throw new Error(
      `Coordenadas inválidas para cálculo de Haversine: origin(${origin.lat}, ${origin.lng}), target(${target.lat}, ${target.lng})`
    );
  }

  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLng = toRadians(target.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);

  // Fórmula de Haversine
  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);

  const a =
    sinDeltaLat * sinDeltaLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;

  // Garantizar que 'a' esté dentro del dominio [0, 1] para Math.sqrt / Math.atan2
  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  const distance = EARTH_RADIUS_METERS * c;

  // Redondeo de precisión a 2 decimales para visualización y trazabilidad
  return Math.round(distance * 100) / 100;
}

/**
 * Sobrecarga utilitaria para calcular distancia directa recibiendo números primitivos.
 */
export function calculateDistanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}

/**
 * Valida si la posición actual se encuentra dentro del radio permitido respecto a un centro.
 *
 * @param position - Posición actual del usuario
 * @param center - Centro del objetivo (ej. punto QR o centro de costo)
 * @param radiusMeters - Radio máximo permitido en metros (por defecto 50m)
 */
export function isWithinRadius(
  position: GeoPoint,
  center: GeoPoint,
  radiusMeters: number = DEFAULT_TOLERANCE_METERS
): boolean {
  const distance = haversineMeters(position, center);
  return distance <= radiusMeters;
}

export interface GeofenceEvaluation {
  distanceMeters: number;
  toleranceMeters: number;
  isWithinRadius: boolean;
  /** Bandera de auditoría requerida por MICRO_SDD (Regla 3) */
  isOutOfRange: boolean;
}

/**
 * Evalúa el geocercado proporcionando tanto la distancia exacta
 * como las banderas necesarias para el negocio y auditoría.
 */
export function evaluateGeofence(
  currentPosition: GeoPoint,
  targetPoint: GeoPoint,
  toleranceMeters: number = DEFAULT_TOLERANCE_METERS
): GeofenceEvaluation {
  const distanceMeters = haversineMeters(currentPosition, targetPoint);
  const within = distanceMeters <= toleranceMeters;

  return {
    distanceMeters,
    toleranceMeters,
    isWithinRadius: within,
    isOutOfRange: !within,
  };
}
