"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

const BARRANQUILLA: [number, number] = [10.9685, -74.7813];

export function QrLocationPicker({
  center,
  point,
  onPick,
}: {
  center: { lat: number; lng: number } | null;
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const focus = point ?? center;

  return (
    <div className="flex flex-col gap-2">
      <style>{`
        .qr-pick-map .leaflet-container {
          height: 16rem;
          width: 100%;
          background: #fff;
        }
        .qr-pick-map .leaflet-container img.leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }
      `}</style>
      <div className="qr-pick-map h-64 w-full overflow-hidden rounded-xl border border-zinc-200">
        <MapContainer
          center={focus ? [focus.lat, focus.lng] : BARRANQUILLA}
          zoom={focus ? 16 : 13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            noWrap
          />
          <MoveTo center={center} />
          <PickPoint onPick={onPick} />
          {point ? (
            <CircleMarker
              center={[point.lat, point.lng]}
              radius={9}
              pathOptions={{ color: "#9a3412", fillColor: "#fb923c", fillOpacity: 0.95, weight: 2 }}
            />
          ) : null}
        </MapContainer>
      </div>
      <p className="text-sm text-zinc-500">
        {point
          ? `Punto marcado: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : "Haz clic en el mapa para ubicar el código."}
      </p>
    </div>
  );
}

function MoveTo({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    if (center) {
      map.setView([center.lat, center.lng], 16);
    }
    return () => window.clearTimeout(timer);
  }, [center, map]);

  return null;
}

function PickPoint({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}
