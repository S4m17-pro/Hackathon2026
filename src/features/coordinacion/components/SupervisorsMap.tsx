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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [BOGOTA.lng, BOGOTA.lat],
      zoom: 12,
    });

    const markers: maplibregl.Marker[] = [];

    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();
      let points = 0;

      const place = (lng: number, lat: number) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return;
        }
        bounds.extend([lng, lat]);
        points += 1;
      };

      for (const center of centers) {
        place(center.lng, center.lat);
        const marker = new maplibregl.Marker({ element: dot("#18181b", 16) })
          .setLngLat([center.lng, center.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setText(
              `${center.name} · ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
            ),
          )
          .addTo(map);
        markers.push(marker);
      }

      for (const person of supervisors) {
        place(person.lng, person.lat);
        const marker = new maplibregl.Marker({ element: dot("#84cc16", 14) })
          .setLngLat([person.lng, person.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setText(
              `${person.name} · último check-in ${person.checkInLabel}`,
            ),
          )
          .addTo(map);
        markers.push(marker);
      }

      for (const scan of scans) {
        place(scan.lng, scan.lat);
        const marker = new maplibregl.Marker({ element: dot("#fb923c", 12) })
          .setLngLat([scan.lng, scan.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(scan.label))
          .addTo(map);
        markers.push(marker);
      }

      if (points === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
      } else if (points > 1) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
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
            <span className="size-2.5 rounded-full bg-zinc-950" />
            Centros de costo ({centers.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-lime-500" />
            Supervisores en campo ({supervisors.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-orange-400" />
            Puntos QR ({scans.length})
          </span>
        </div>
        {supervisors.length === 0 ? (
          <span className="text-xs text-zinc-400">Sin check-ins de supervisores activos hoy.</span>
        ) : null}
      </div>
    </section>
  );
}
