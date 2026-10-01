"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle, Clock, Eye, FileText, Image as ImageIcon, MapPin, Search, User } from "lucide-react";

import { updateNoveltyStatus } from "@/features/coordinacion/actions";
import type { NoveltyPriority, NoveltyStatus } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

export interface NoveltyEvidence {
  id: string;
  url: string;
}

export interface NoveltyRow {
  id: string;
  description: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  clientCreatedAt: string;
  supervisorName: string;
  costCenterName: string;
  lat: number | null;
  lng: number | null;
  evidences: NoveltyEvidence[];
  resolutionAction: string | null;
  closedByName: string | null;
  closedAt: string | null;
}

const priorityLabel: Record<NoveltyPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const statusLabel: Record<NoveltyStatus, string> = {
  OPEN: "Abierta",
  IN_REVIEW: "En seguimiento",
  RESOLVED: "Cerrada",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "--";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function NoveltyBoard({
  novelties,
  closerId,
  loadError,
}: {
  novelties: NoveltyRow[];
  closerId: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<NoveltyStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<NoveltyPriority | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Modal para ver foto
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const visible = useMemo(() => {
    return novelties.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && item.priority !== priorityFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matches =
          item.description.toLowerCase().includes(query) ||
          item.supervisorName.toLowerCase().includes(query) ||
          item.costCenterName.toLowerCase().includes(query) ||
          (item.resolutionAction && item.resolutionAction.toLowerCase().includes(query));
        if (!matches) return false;
      }
      return true;
    });
  }, [novelties, statusFilter, priorityFilter, search]);

  function succeed(text: string) {
    setError(null);
    setMessage(text);
    router.refresh();
  }

  function moveToReview(id: string) {
    startTransition(async () => {
      const result = await updateNoveltyStatus(id, "IN_REVIEW");
      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }
      succeed("Novedad asignada a seguimiento.");
    });
  }

  function closeNovelty(id: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const resolutionAction = String(data.get("resolutionAction") ?? "").trim();

    startTransition(async () => {
      const result = await updateNoveltyStatus(id, "RESOLVED", {
        closedById: closerId,
        resolutionAction,
      });
      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }
      form.reset();
      succeed("Novedad resuelta y cerrada con trazabilidad.");
    });
  }

  const statusFilters: { id: NoveltyStatus | "ALL"; label: string }[] = [
    { id: "ALL", label: "Todos los estados" },
    { id: "OPEN", label: "Abiertas" },
    { id: "IN_REVIEW", label: "En seguimiento" },
    { id: "RESOLVED", label: "Cerradas" },
  ];

  const priorityFilters: { id: NoveltyPriority | "ALL"; label: string }[] = [
    { id: "ALL", label: "Todas las prioridades" },
    { id: "CRITICAL", label: "Crítica" },
    { id: "HIGH", label: "Alta" },
    { id: "MEDIUM", label: "Media" },
    { id: "LOW", label: "Baja" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {loadError ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{loadError}</p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-lime-100 px-3 py-2 text-sm text-lime-950">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-950">{error}</p>
      ) : null}

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción, centro, supervisor o acción..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Estado:</span>
            {statusFilters.map((filter) => (
              <Button
                key={filter.id}
                variant={statusFilter === filter.id ? "default" : "outline"}
                onClick={() => setStatusFilter(filter.id)}
                className="text-xs h-8 px-3"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium text-zinc-500">Prioridad:</span>
          {priorityFilters.map((filter) => (
            <Button
              key={filter.id}
              variant={priorityFilter === filter.id ? "default" : "outline"}
              onClick={() => setPriorityFilter(filter.id)}
              className="text-xs h-7 px-2.5"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Modal de foto */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-semibold text-zinc-900">Evidencia Fotográfica de la Novedad</p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activePhoto} alt="Evidencia novedad" className="max-h-[70vh] w-full object-contain" />
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" onClick={() => setActivePhoto(null)}>
                Cerrar vista previa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla Principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bandeja y Ciclo de Vida de Novedades</CardTitle>
              <CardDescription>
                Flujo: Identificación → Evidencia → Notificación → Revisión → Resolución. Mostrando {visible.length} registros.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Descripción y Evidencia</TableHead>
                <TableHead>Ubicación y Supervisor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Campo</TableHead>
                <TableHead className="min-w-64">Acción y Seguimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-400">
                    No se encontraron novedades con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((item) => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell>
                      <Badge
                        tone={
                          item.priority === "CRITICAL"
                            ? "offline"
                            : item.priority === "HIGH"
                              ? "progress"
                              : "neutral"
                        }
                      >
                        {priorityLabel[item.priority]}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-md">
                      <p className="font-medium text-zinc-900">{item.description}</p>
                      {item.evidences.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.evidences.map((ev, idx) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => setActivePhoto(ev.url)}
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                            >
                              <ImageIcon className="size-3 text-zinc-500" />
                              <span>Foto {idx + 1}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-zinc-900">{item.costCenterName}</span>
                        <div className="flex items-center gap-1 text-zinc-600">
                          <User className="size-3 text-zinc-400" />
                          <span>{item.supervisorName}</span>
                        </div>
                        {item.lat && item.lng && (
                          <div className="flex items-center gap-1 text-zinc-400">
                            <MapPin className="size-3" />
                            <span>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        tone={
                          item.status === "RESOLVED"
                            ? "done"
                            : item.status === "IN_REVIEW"
                              ? "progress"
                              : "neutral"
                        }
                      >
                        {statusLabel[item.status]}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-zinc-600 whitespace-nowrap">
                      {formatWhen(item.clientCreatedAt)}
                    </TableCell>

                    <TableCell>
                      {item.status === "OPEN" && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-amber-700 font-medium">Requiere revisión inicial</span>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => moveToReview(item.id)}
                            disabled={pending}
                          >
                            Tomar en revisión
                          </Button>
                        </div>
                      )}

                      {item.status === "IN_REVIEW" && (
                        <form
                          className="flex flex-col gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            closeNovelty(item.id, event.currentTarget);
                          }}
                        >
                          <span className="text-xs text-blue-700 font-medium">En proceso de atención</span>
                          <Input
                            name="resolutionAction"
                            placeholder="Acción tomada / decisión..."
                            required
                            className="text-xs h-8"
                          />
                          <Button type="submit" size="sm" variant="contrast" disabled={pending}>
                            Cerrar novedad
                          </Button>
                        </form>
                      )}

                      {item.status === "RESOLVED" && (
                        <div className="flex flex-col gap-1 rounded-lg border border-lime-200 bg-lime-50/50 p-2.5 text-xs">
                          <div className="flex items-center gap-1 font-semibold text-lime-900">
                            <CheckCircle className="size-3.5 text-lime-600" />
                            <span>Resuelta</span>
                          </div>
                          <p className="text-zinc-700">{item.resolutionAction ?? "Sin detalle de acción"}</p>
                          <div className="mt-1 flex items-center justify-between text-zinc-500">
                            <span>Por: {item.closedByName ?? "Coordinador"}</span>
                            <span>{formatWhen(item.closedAt)}</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
