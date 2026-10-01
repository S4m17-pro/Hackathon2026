"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Printer, QrCode, X } from "lucide-react";

import { QrCodeImage } from "@/shared/ui/QrCodeImage";

import {
  cancelVisit,
  createAssignedVisit,
  createQrPoint,
  setQrPointActive,
} from "@/features/coordinacion/actions";
import type { VisitStatus } from "@/shared/types";
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

export interface AssignmentSupervisor {
  id: string;
  name: string;
}

export interface AssignmentCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface AssignmentVisitRow {
  id: string;
  supervisorName: string;
  centerName: string;
  scheduledAt: string | null;
  status: VisitStatus;
}

export interface AssignmentQrRow {
  id: string;
  code: string;
  areaName: string;
  centerName: string;
  isActive: boolean;
  radiusMeters: number;
}

const statusLabel: Record<VisitStatus, string> = {
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const QrLocationPicker = dynamic(
  () => import("@/features/coordinacion/components/QrLocationPicker").then((mod) => mod.QrLocationPicker),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-xl border border-zinc-200 bg-white" />,
  },
);

const fieldClass =
  "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-950";

function formatWhen(iso: string | null): string {
  if (!iso) {
    return "Sin horario";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function AssignmentBoard({
  supervisors,
  centers,
  visits,
  qrPoints,
  loadError,
}: {
  supervisors: AssignmentSupervisor[];
  centers: AssignmentCenter[];
  visits: AssignmentVisitRow[];
  qrPoints: AssignmentQrRow[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedQr, setSelectedQr] = useState<AssignmentQrRow | null>(null);
  const [list, setList] = useState<"visits" | "qr">("visits");
  const [qrCenterId, setQrCenterId] = useState("");
  const [qrPoint, setQrPoint] = useState<{ lat: number; lng: number } | null>(null);

  function refresh(okMessage: string) {
    setError(null);
    setMessage(okMessage);
    router.refresh();
  }

  function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const scheduledAt = String(data.get("scheduledAt") ?? "");

    startTransition(async () => {
      const result = await createAssignedVisit({
        supervisorId: String(data.get("supervisorId") ?? ""),
        costCenterId: String(data.get("costCenterId") ?? ""),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });

      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }

      form.reset();
      refresh("Visita asignada.");
    });
  }

  function onCreateQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const costCenterId = String(data.get("costCenterId") ?? "");
    const center = centers.find((item) => item.id === costCenterId);

    if (!center) {
      setError("Elige un centro de costo.");
      return;
    }

    if (!qrPoint) {
      setError("Marca el punto del código en el mapa.");
      return;
    }

    const radius = Number(data.get("radiusMeters") ?? 50);
    const marked = qrPoint;

    startTransition(async () => {
      const result = await createQrPoint({
        code: String(data.get("code") ?? ""),
        areaName: String(data.get("areaName") ?? ""),
        costCenterId,
        lat: marked.lat,
        lng: marked.lng,
        radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : 50,
      });

      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }

      form.reset();
      setQrCenterId("");
      setQrPoint(null);
      refresh("Código QR creado.");
    });
  }

  function onCancel(visitId: string) {
    startTransition(async () => {
      const result = await cancelVisit(visitId);
      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }
      refresh("Visita cancelada.");
    });
  }

  function onToggleQr(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await setQrPointActive(id, !isActive);
      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }
      refresh(isActive ? "QR desactivado." : "QR activado.");
    });
  }

  const canAssign = supervisors.length > 0 && centers.length > 0;

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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nueva visita</CardTitle>
            <CardDescription>El coordinador fija supervisor, centro y horario.</CardDescription>
          </CardHeader>
          <form onSubmit={onAssign}>
            <CardContent>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Supervisor
                <select name="supervisorId" required className={fieldClass} defaultValue="">
                  <option value="" disabled>
                    Elige un supervisor
                  </option>
                  {supervisors.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Centro de costo
                <select name="costCenterId" required className={fieldClass} defaultValue="">
                  <option value="" disabled>
                    Elige un centro
                  </option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Horario
                <Input name="scheduledAt" type="datetime-local" required />
              </label>
              <Button type="submit" className="w-full" disabled={!canAssign || pending}>
                {pending ? "Guardando…" : "Asignar visita"}
              </Button>
              {!canAssign ? (
                <p className="text-sm text-zinc-500">
                  Hace falta al menos un supervisor y un centro de costo en la base.
                </p>
              ) : null}
            </CardContent>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo código QR</CardTitle>
            <CardDescription>Elige el centro y marca el punto exacto en el mapa.</CardDescription>
          </CardHeader>
          <form onSubmit={onCreateQr}>
            <CardContent>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Código
                <Input name="code" placeholder="AREA-SUR-02" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Área
                <Input name="areaName" placeholder="Cocina" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Centro de costo
                <select
                  name="costCenterId"
                  required
                  className={fieldClass}
                  value={qrCenterId}
                  onChange={(event) => {
                    setQrCenterId(event.target.value);
                    setQrPoint(null);
                  }}
                >
                  <option value="" disabled>
                    Elige un centro
                  </option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>
              <QrLocationPicker
                center={centers.find((center) => center.id === qrCenterId) ?? null}
                point={qrPoint}
                onPick={(lat, lng) => setQrPoint({ lat, lng })}
              />
              <label className="flex flex-col gap-2 text-sm font-medium">
                Radio en metros
                <Input name="radiusMeters" type="number" min={1} defaultValue={50} />
              </label>
              <Button
                type="submit"
                variant="contrast"
                className="w-full"
                disabled={centers.length === 0 || pending || qrPoint === null}
              >
                Crear QR
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-zinc-200 p-1">
        <button
          type="button"
          onClick={() => setList("visits")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            list === "visits" ? "bg-white text-zinc-950" : "text-zinc-600"
          }`}
        >
          Visitas asignadas ({visits.length})
        </button>
        <button
          type="button"
          onClick={() => setList("qr")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            list === "qr" ? "bg-white text-zinc-950" : "text-zinc-600"
          }`}
        >
          Códigos QR ({qrPoints.length})
        </button>
      </div>

      {list === "visits" ? (
      <Card>
        <CardHeader>
          <CardTitle>Visitas asignadas</CardTitle>
          <CardDescription>{visits.length} en total</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Todavía no hay visitas.</TableCell>
                </TableRow>
              ) : (
                visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">{visit.centerName}</TableCell>
                    <TableCell>{visit.supervisorName}</TableCell>
                    <TableCell>{formatWhen(visit.scheduledAt)}</TableCell>
                    <TableCell>
                      <Badge tone={visit.status === "CANCELLED" ? "offline" : "neutral"}>
                        {statusLabel[visit.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {visit.status === "ASSIGNED" || visit.status === "IN_PROGRESS" ? (
                        <Button
                          variant="outline"
                          onClick={() => onCancel(visit.id)}
                          disabled={pending}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Códigos QR</CardTitle>
          <CardDescription>Desactivar no borra el código.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">QR</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Radio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qrPoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>Todavía no hay códigos.</TableCell>
                </TableRow>
              ) : (
                qrPoints.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedQr(point)}
                        className="group relative flex cursor-pointer items-center justify-center rounded border border-zinc-200 bg-white p-1 shadow-2xs transition-transform hover:scale-105 hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        title="Clic para ampliar o imprimir código QR"
                      >
                        <QrCodeImage value={point.code} size={48} margin={1} />
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{point.code}</TableCell>
                    <TableCell>{point.areaName}</TableCell>
                    <TableCell>{point.centerName}</TableCell>
                    <TableCell>{point.radiusMeters} m</TableCell>
                    <TableCell>
                      <Badge tone={point.isActive ? "online" : "offline"}>
                        {point.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedQr(point)}
                          className="gap-1.5 text-xs"
                        >
                          <QrCode className="size-3.5" aria-hidden />
                          Ver / Imprimir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onToggleQr(point.id, point.isActive)}
                          disabled={pending}
                          className="text-xs"
                        >
                          {point.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Modal para Visualizar e Imprimir Código QR */}
      {selectedQr ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedQr(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            id="printable-qr-modal"
            className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between border-b border-zinc-100 pb-3 no-print">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Etiqueta de Campo
                </p>
                <h3 className="font-semibold text-zinc-950">{selectedQr.areaName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQr(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-md">
                <QrCodeImage value={selectedQr.code} size={200} margin={2} />
              </div>
              <div>
                <p className="font-mono text-lg font-bold tracking-wider text-zinc-950">
                  {selectedQr.code}
                </p>
                <p className="text-xs text-zinc-500">{selectedQr.centerName}</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Radio de tolerancia: {selectedQr.radiusMeters} metros
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3 text-center text-xs text-zinc-500 border border-zinc-200/80 leading-relaxed">
              El código QR contiene únicamente el texto <strong>&quot;{selectedQr.code}&quot;</strong>.
              Las coordenadas y el área se resuelven automáticamente en el dispositivo al escanear.
            </div>

            <div className="flex w-full gap-2 pt-1 no-print">
              <Button
                variant="contrast"
                className="flex-1 gap-2"
                onClick={() => window.print()}
              >
                <Printer className="size-4" aria-hidden />
                Imprimir QR
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedQr(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-modal,
          #printable-qr-modal * {
            visibility: visible !important;
          }
          #printable-qr-modal {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            border: 1px solid #e4e4e7 !important;
            box-shadow: none !important;
            width: auto !important;
            max-width: 400px !important;
            padding: 24px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
