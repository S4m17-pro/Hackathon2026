"use client";

import { AlertTriangle, Clock, MapPin, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export interface OutOfRangeAlert {
  id: string;
  supervisorName: string;
  centerName: string;
  checkInAt: string;
  distanceMeters: number | null;
}

export interface DelayedAlert {
  id: string;
  supervisorName: string;
  centerName: string;
  scheduledAt: string;
}

export interface CriticalNoveltyAlert {
  id: string;
  priority: string;
  description: string;
  supervisorName: string;
  centerName: string;
  clientCreatedAt: string;
}

interface AlertsSectionProps {
  outOfRange: OutOfRangeAlert[];
  delayed: DelayedAlert[];
  criticalNovelties: CriticalNoveltyAlert[];
}

export function AlertsSection({ outOfRange, delayed, criticalNovelties }: AlertsSectionProps) {
  const totalAlerts = outOfRange.length + delayed.length + criticalNovelties.length;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" />
            <CardTitle className="text-lg font-semibold text-zinc-900">
              Centro de Alertas y Operaciones en Riesgo
            </CardTitle>
          </div>
          <Badge tone={totalAlerts > 0 ? "offline" : "done"}>
            {totalAlerts} {totalAlerts === 1 ? "alerta activa" : "alertas activas"}
          </Badge>
        </div>
        <CardDescription>
          Supervisión en tiempo real de desviaciones geográficas, demoras operativas y novedades prioritarias.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {/* Fuera de rango */}
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <MapPin className="size-4 text-amber-600" />
              <span>Fuera de rango (GPS)</span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {outOfRange.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Check-in a más de 50 metros del centro asignado.</p>
          <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
            {outOfRange.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400">Sin visitas fuera de rango.</p>
            ) : (
              outOfRange.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-zinc-800">
                    <span>{item.centerName}</span>
                    <span className="text-amber-700 font-semibold">
                      +{item.distanceMeters ? Math.round(item.distanceMeters) : 50}m
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-zinc-500">
                    <span>{item.supervisorName}</span>
                    <span>{item.checkInAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visitas demoradas */}
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <Clock className="size-4 text-amber-600" />
              <span>Visitas demoradas</span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {delayed.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Hora programada vencida sin inicio de check-in.</p>
          <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
            {delayed.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400">Sin visitas retrasadas.</p>
            ) : (
              delayed.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-zinc-800">
                    <span>{item.centerName}</span>
                    <span className="text-red-600 font-semibold">{item.scheduledAt}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-zinc-500">
                    <span>{item.supervisorName}</span>
                    <span className="text-zinc-400">Pendiente inicio</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Novedades prioritarias */}
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <AlertTriangle className="size-4 text-amber-600" />
              <span>Novedades prioritarias</span>
            </div>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              {criticalNovelties.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Incidentes de alta prioridad o críticos sin resolver.</p>
          <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
            {criticalNovelties.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400">Sin novedades urgentes.</p>
            ) : (
              criticalNovelties.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-zinc-800">
                    <span className="truncate pr-1">{item.centerName}</span>
                    <Badge tone="offline">{item.priority}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-zinc-600">{item.description}</p>
                  <div className="mt-1 flex items-center justify-between text-zinc-400">
                    <span>{item.supervisorName}</span>
                    <span>{item.clientCreatedAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-auto pt-1">
            <Link
              href="/novedades"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:underline"
            >
              Gestionar novedades en bandeja <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
