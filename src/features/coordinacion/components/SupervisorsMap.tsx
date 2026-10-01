"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

/** Vista inicial: Barranquilla. */
const BARRANQUILLA: [number, number] = [10.9685, -74.7813];

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

export function SupervisorsMap({
  centers,
  supervisors,
  scans,
}: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="h-[32rem] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white [&_.leaflet-tile]:max-h-none [&_.leaflet-tile]:max-w-none">
        <MapContainer center={BARRANQUILLA} zoom={13} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {centers.map((center) => (
            <CircleMarker
              key={center.id}
              center={[center.lat, center.lng]}
              radius={9}
              pathOptions={{ color: "#18181b", fillColor: "#18181b", fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip>{center.name}</Tooltip>
            </CircleMarker>
          ))}
          {supervisors.map((person) => (
            <CircleMarker
              key={person.id}
              center={[person.lat, person.lng]}
              radius={8}
              pathOptions={{ color: "#3f6212", fillColor: "#84cc16", fillOpacity: 0.95, weight: 2 }}
            >
              <Tooltip>
                {person.name}
                <br />
                Último check-in {person.checkInLabel}
              </Tooltip>
            </CircleMarker>
          ))}
          {scans.map((scan) => (
            <CircleMarker
              key={scan.id}
              center={[scan.lat, scan.lng]}
              radius={6}
              pathOptions={{ color: "#9a3412", fillColor: "#fb923c", fillOpacity: 0.95, weight: 2 }}
            >
              <Tooltip>{scan.label}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-zinc-950" />
          Centros de costo
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-lime-400" />
          Supervisores
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-orange-400" />
          QR escaneados
        </span>
        {supervisors.length === 0 ? <span>Todavía no hay un check-in con GPS.</span> : null}
      </div>
    </section>
  );
}
