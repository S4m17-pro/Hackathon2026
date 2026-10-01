"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Building2,
  FileSpreadsheet,
  Image as ImageIcon
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

export interface ReportVisitItem {
  id: string;
  supervisorId: string;
  supervisorName: string;
  costCenterId: string;
  costCenterName: string;
  status: string;
  scheduledAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInOutOfRange: boolean;
  checkInDistanceM: number | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface ReportNoveltyItem {
  id: string;
  visitId: string;
  supervisorName: string;
  costCenterName: string;
  priority: string;
  status: string;
  description: string;
  clientCreatedAt: string;
  resolutionAction: string | null;
}

export interface ReportEvidenceItem {
  id: string;
  ownerType: string;
  url: string;
  capturedByName: string;
  clientCreatedAt: string;
  context: string;
}

export interface FilterOption {
  id: string;
  name: string;
}

interface ReportsViewProps {
  initialVisits: ReportVisitItem[];
  initialNovelties: ReportNoveltyItem[];
  initialEvidences: ReportEvidenceItem[];
  supervisors: FilterOption[];
  costCenters: FilterOption[];
}

const statusBadgeTone = (status: string) => {
  if (status === "COMPLETED" || status === "RESOLVED") return "done";
  if (status === "IN_PROGRESS" || status === "IN_REVIEW") return "progress";
  if (status === "CANCELLED" || status === "CRITICAL") return "offline";
  return "neutral";
};

const statusLabelText = (status: string) => {
  switch (status) {
    case "ASSIGNED": return "Asignada";
    case "IN_PROGRESS": return "En curso";
    case "COMPLETED": return "Completada";
    case "CANCELLED": return "Cancelada";
    case "OPEN": return "Abierta";
    case "IN_REVIEW": return "En seguimiento";
    case "RESOLVED": return "Cerrada";
    default: return status;
  }
};

function formatWhen(iso: string | null): string {
  if (!iso) return "--";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ReportsView({
  initialVisits,
  initialNovelties,
  initialEvidences,
  supervisors,
  costCenters,
}: ReportsViewProps) {
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("ALL");
  const [selectedCenter, setSelectedCenter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"visitas" | "novedades" | "evidencias">("visitas");
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // Filtrado reactivo en cliente
  const filteredVisits = useMemo(() => {
    return initialVisits.filter((v) => {
      if (selectedSupervisor !== "ALL" && v.supervisorId !== selectedSupervisor) return false;
      if (selectedCenter !== "ALL" && v.costCenterId !== selectedCenter) return false;
      return true;
    });
  }, [initialVisits, selectedSupervisor, selectedCenter]);

  const filteredNovelties = useMemo(() => {
    const validVisitIds = new Set(filteredVisits.map((v) => v.id));
    return initialNovelties.filter((n) => {
      if (selectedSupervisor === "ALL" && selectedCenter === "ALL") return true;
      return validVisitIds.has(n.visitId);
    });
  }, [initialNovelties, filteredVisits, selectedSupervisor, selectedCenter]);

  // Indicadores de cumplimiento calculados
  const metrics = useMemo(() => {
    const scheduled = filteredVisits.filter((v) => v.status !== "CANCELLED");
    const completed = filteredVisits.filter((v) => v.status === "COMPLETED");
    const cancelled = filteredVisits.filter((v) => v.status === "CANCELLED");
    const completionPercent = scheduled.length > 0 ? Math.round((completed.length / scheduled.length) * 100) : 0;

    const checkedIn = filteredVisits.filter((v) => v.checkInAt !== null);
    const inRange = checkedIn.filter((v) => !v.checkInOutOfRange);
    const gpsPercent = checkedIn.length > 0 ? Math.round((inRange.length / checkedIn.length) * 100) : 100;

    const durations = completed
      .map((v) => v.durationMinutes)
      .filter((d): d is number => d !== null && d > 0);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const openNovs = filteredNovelties.filter((n) => n.status !== "RESOLVED").length;
    const resolvedNovs = filteredNovelties.filter((n) => n.status === "RESOLVED").length;

    return {
      totalVisits: filteredVisits.length,
      completed: completed.length,
      pending: scheduled.length - completed.length,
      cancelled: cancelled.length,
      completionPercent,
      gpsPercent,
      avgDuration,
      totalNovelties: filteredNovelties.length,
      openNovs,
      resolvedNovs,
    };
  }, [filteredVisits, filteredNovelties]);

  // Generador y descargador de CSV
  function downloadCsv() {
    const rows: string[][] = [
      ["Tipo", "ID", "Estado", "Supervisor", "Centro de Costo", "Fecha Programada", "Hora Check-in", "Duracion (min)", "GPS Fuera de Rango", "Notas / Descripcion"]
    ];

    for (const v of filteredVisits) {
      rows.push([
        "Visita",
        v.id,
        v.status,
        v.supervisorName,
        v.costCenterName,
        v.scheduledAt ?? "",
        v.checkInAt ?? "",
        v.durationMinutes ? String(v.durationMinutes) : "",
        v.checkInOutOfRange ? "SI" : "NO",
        `"${(v.notes ?? "").replace(/"/g, '""')}"`
      ]);
    }

    for (const n of filteredNovelties) {
      rows.push([
        "Novedad",
        n.id,
        n.status,
        n.supervisorName,
        n.costCenterName,
        n.clientCreatedAt,
        "",
        "",
        "",
        `"${(n.description + (n.resolutionAction ? ' | Resolucion: ' + n.resolutionAction : '')).replace(/"/g, '""')}"`
      ]);
    }

    const csvContent = "\uFEFF" + rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte-operaciones-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de Filtros y Exportación */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="size-4 text-zinc-500" />
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 focus:outline-none"
            >
              <option value="ALL">Todos los supervisores</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-zinc-500" />
            <select
              value={selectedCenter}
              onChange={(e) => setSelectedCenter(e.target.value)}
              className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 focus:outline-none"
            >
              <option value="ALL">Todos los centros de costo</option>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={downloadCsv} variant="contrast" className="flex items-center gap-2">
          <Download className="size-4" />
          <span>Exportar Reporte a CSV</span>
        </Button>
      </div>

      {/* Tarjetas de Métricas de Cumplimiento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cumplimiento de Visitas</CardDescription>
            <CardTitle className="text-3xl font-bold">{metrics.completionPercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {metrics.completed} de {metrics.totalVisits - metrics.cancelled} programadas ({metrics.cancelled} canceladas)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verificación GPS</CardDescription>
            <CardTitle className="text-3xl font-bold text-lime-600">{metrics.gpsPercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Dentro del radio de tolerancia (50 m)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duración Promedio</CardDescription>
            <CardTitle className="text-3xl font-bold">{metrics.avgDuration} min</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Tiempo en campo por inspección</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gestión de Novedades</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {metrics.resolvedNovs}/{metrics.totalNovelties}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {metrics.openNovs} pendientes de atención
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab("visitas")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "visitas"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Historial de Visitas ({filteredVisits.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("novedades")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "novedades"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Reporte de Novedades ({filteredNovelties.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evidencias")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "evidencias"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Galería de Evidencias ({initialEvidences.length})
        </button>
      </div>

      {/* Modal de foto */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-semibold text-zinc-900">Evidencia Fotográfica de la Operación</p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activePhoto} alt="Evidencia reporte" className="max-h-[70vh] w-full object-contain" />
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" onClick={() => setActivePhoto(null)}>
                Cerrar vista previa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido según pestaña */}
      {activeTab === "visitas" && (
        <Card>
          <CardHeader>
            <CardTitle>Historial Detallado de Visitas</CardTitle>
            <CardDescription>Registro completo de horarios, supervisores, duración y verificación GPS.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro de Costo</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Programada</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-zinc-400">
                      No hay visitas en este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVisits.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold text-zinc-900">{v.costCenterName}</TableCell>
                      <TableCell>{v.supervisorName}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{formatWhen(v.scheduledAt)}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{formatWhen(v.checkInAt)}</TableCell>
                      <TableCell className="text-xs">
                        {v.durationMinutes !== null ? `${v.durationMinutes} min` : "--"}
                      </TableCell>
                      <TableCell>
                        {v.checkInAt === null ? (
                          <span className="text-xs text-zinc-400">Pendiente</span>
                        ) : v.checkInOutOfRange ? (
                          <Badge tone="offline">
                            +{v.checkInDistanceM ? Math.round(v.checkInDistanceM) : 50}m fuera
                          </Badge>
                        ) : (
                          <Badge tone="done">En rango</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusBadgeTone(v.status)}>{statusLabelText(v.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "novedades" && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte y Trazabilidad de Novedades</CardTitle>
            <CardDescription>Incidencias detectadas en campo, nivel de severidad y acciones de resolución.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción de Cierre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNovelties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-zinc-400">
                      No hay novedades para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNovelties.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Badge tone={statusBadgeTone(n.priority)}>{n.priority}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs font-medium text-zinc-900">{n.description}</TableCell>
                      <TableCell>{n.costCenterName}</TableCell>
                      <TableCell>{n.supervisorName}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{formatWhen(n.clientCreatedAt)}</TableCell>
                      <TableCell>
                        <Badge tone={statusBadgeTone(n.status)}>{statusLabelText(n.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-700 max-w-xs">
                        {n.resolutionAction ?? <span className="text-zinc-400">Pendiente de resolución</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "evidencias" && (
        <Card>
          <CardHeader>
            <CardTitle>Galería y Evidencias Fotográficas</CardTitle>
            <CardDescription>Capturas realizadas durante visitas, escaneos QR, checklists y novedades.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {initialEvidences.map((ev) => (
                <div
                  key={ev.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs transition hover:shadow-md"
                >
                  <div
                    className="relative flex h-36 w-full cursor-pointer items-center justify-center bg-zinc-100 transition group-hover:bg-zinc-200"
                    onClick={() => setActivePhoto(ev.url)}
                  >
                    <ImageIcon className="size-8 text-zinc-400 group-hover:scale-110 transition-transform" />
                    <span className="absolute bottom-2 right-2 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] text-white">
                      Ver foto
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge tone="neutral">{ev.ownerType}</Badge>
                      <span className="text-zinc-500">{formatWhen(ev.clientCreatedAt)}</span>
                    </div>
                    <p className="mt-1 font-medium text-zinc-800 line-clamp-1">{ev.context}</p>
                    <p className="text-zinc-500">Por: {ev.capturedByName}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
