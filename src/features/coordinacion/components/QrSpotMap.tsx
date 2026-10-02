"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

function createSpotIcon() {
  return L.divIcon({
    className: "custom-qr-pin",
    html: `<div style="
      width: 16px;
      height: 16px;
      border-radius: 9999px;
      background-color: #ea580c;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export function QrSpotMap({
  lat,
  lng,
  radiusMeters,
  label,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(container, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Radio de geocerca
    L.circle([lat, lng], {
      radius: radiusMeters,
      color: "#c2410c",
      fillColor: "#fb923c",
      fillOpacity: 0.25,
      weight: 2,
    }).addTo(map);

    // Marcador central
    L.marker([lat, lng], { icon: createSpotIcon() })
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px;">
          <strong style="color: #c2410c;">📍 ${label}</strong><br/>
          <span>Radio de tolerancia: ${radiusMeters} m</span>
        </div>`,
      )
      .addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [lat, lng, radiusMeters, label]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-xs z-0"
    />
  );
}
