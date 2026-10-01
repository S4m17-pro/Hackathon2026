"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE } from "@/features/coordinacion/components/mapStyle";

const BOGOTA = { lng: -74.0681, lat: 4.6784 };

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

function dot(color: string, size: number) {
  const element = document.createElement("div");
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.borderRadius = "9999px";
  element.style.background = color;
  element.style.border = "2px solid #fff";
  element.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.35)";
  return element;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const points = withFallback(centers, supervisors, scans);
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [BOGOTA.lng, BOGOTA.lat],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    const markers: maplibregl.Marker[] = [];

    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();
      let count = 0;

      const place = (lng: number, lat: number) => {
        bounds.extend([lng, lat]);
        count += 1;
      };

      for (const center of points.centers) {
        place(center.lng, center.lat);
        const marker = new maplibregl.Marker({ element: dot("#1a73e8", 18) })
          .setLngLat([center.lng, center.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setText(
              `${center.name} · ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
            ),
          )
          .addTo(map);
        markers.push(marker);
      }

      for (const person of points.supervisors) {
        place(person.lng, person.lat);
        const marker = new maplibregl.Marker({ element: dot("#ea4335", 16) })
          .setLngLat([person.lng, person.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setText(
              `${person.name} · último check-in ${person.checkInLabel}`,
            ),
          )
          .addTo(map);
        markers.push(marker);
      }

      for (const scan of points.scans) {
        place(scan.lng, scan.lat);
        const marker = new maplibregl.Marker({ element: dot("#f9ab00", 14) })
          .setLngLat([scan.lng, scan.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(scan.label))
          .addTo(map);
        markers.push(marker);
      }

      if (count === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else if (count > 1) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [centers, supervisors, scans]);

  return (
    <section className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="h-[32rem] w-full overflow-hidden rounded-2xl border border-zinc-200"
      />
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#1a73e8]" />
            Centros de costo ({shown.centers.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#ea4335]" />
            Supervisores en campo ({shown.supervisors.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#f9ab00]" />
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
