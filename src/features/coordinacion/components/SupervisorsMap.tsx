"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapCostCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MapSupervisor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  checkInLabel: string;
}

export interface MapScannedQr {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

const DEMO_CENTERS: MapCostCenter[] = [
  { id: "demo-norte", name: "Plaza Norte", lat: 4.710989, lng: -74.07209 },
  { id: "demo-sur", name: "Plaza Sur", lat: 4.5981, lng: -74.076 },
  { id: "demo-parque", name: "Parque Centro", lat: 4.6534, lng: -74.0836 },
];

const DEMO_SUPERVISORS: MapSupervisor[] = [
  {
    id: "demo-sup",
    name: "Supervisor Demo",
    lat: 4.7114,
    lng: -74.0714,
    checkInLabel: "08:12",
  },
];

const DEMO_SCANS: MapScannedQr[] = [
  { id: "demo-qr", label: "QR-PLAZA-NORTE-1", lat: 4.7106, lng: -74.0726 },
];

function withFallback(
  centers: MapCostCenter[],
  supervisors: MapSupervisor[],
  scans: MapScannedQr[],
) {
  const validCenters = centers.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const validSupervisors = supervisors.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );
  const validScans = scans.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (validCenters.length + validSupervisors.length + validScans.length === 0) {
    return { centers: DEMO_CENTERS, supervisors: DEMO_SUPERVISORS, scans: DEMO_SCANS, simulated: true };
  }

  return { centers: validCenters, supervisors: validSupervisors, scans: validScans, simulated: false };
}

function createPinIcon(color: string, size: number, border = "#ffffff") {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      background-color: ${color};
      border: 2.5px solid ${border};
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      transition: transform 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function SupervisorsMap({
  centers,
  supervisors,
  scans,
}: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  const shown = withFallback(centers, supervisors, scans);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy previous instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const points = withFallback(centers, supervisors, scans);
    const map = L.map(container, {
      center: [4.6784, -74.0681],
      zoom: 12,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // High quality Voyager / OSM raster tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    const latLngs: L.LatLngExpression[] = [];

    // Centros de costo (Azul)
    const centerIcon = createPinIcon("#1a73e8", 20);
    for (const center of points.centers) {
      latLngs.push([center.lat, center.lng]);
      L.marker([center.lat, center.lng], { icon: centerIcon })
        .bindPopup(
          `<div style="font-family: sans-serif; font-size: 13px;">
            <strong style="color: #1a73e8;">🏢 ${center.name}</strong><br/>
            <span style="color: #666; font-size: 11px;">Centro de Costo (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})</span>
          </div>`,
        )
        .addTo(map);
    }

    // Supervisores en campo (Rojo)
    const supervisorIcon = createPinIcon("#ea4335", 18);
    for (const person of points.supervisors) {
      latLngs.push([person.lat, person.lng]);
      L.marker([person.lat, person.lng], { icon: supervisorIcon })
        .bindPopup(
          `<div style="font-family: sans-serif; font-size: 13px;">
            <strong style="color: #ea4335;">👤 ${person.name}</strong><br/>
            <span style="color: #444;">Último check-in: <strong>${person.checkInLabel}</strong></span>
          </div>`,
        )
        .addTo(map);
    }

    // Puntos QR (Ámbar)
    const qrIcon = createPinIcon("#f9ab00", 14);
    for (const scan of points.scans) {
      latLngs.push([scan.lat, scan.lng]);
      L.marker([scan.lat, scan.lng], { icon: qrIcon })
        .bindPopup(
          `<div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color: #b06000;">🏷️ ${scan.label}</strong>
          </div>`,
        )
        .addTo(map);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    // Trigger map invalidation to ensure full render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [centers, supervisors, scans]);

  return (
    <section className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="h-[32rem] w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-xs z-0"
      />
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#1a73e8] border border-white shadow-xs" />
            Centros de costo ({shown.centers.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ea4335] border border-white shadow-xs" />
            Supervisores en campo ({shown.supervisors.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#f9ab00] border border-white shadow-xs" />
            Puntos QR ({shown.scans.length})
          </span>
        </div>
        {shown.simulated ? (
          <span className="text-xs text-zinc-400">Mostrando puntos de ejemplo en Bogotá.</span>
        ) : supervisors.length === 0 ? (
          <span className="text-xs text-zinc-400">Sin check-ins de supervisores activos hoy.</span>
        ) : null}
      </div>
    </section>
  );
}
