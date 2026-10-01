"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

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

    const radius = Number(data.get("radiusMeters") ?? 50);

    startTransition(async () => {
      const result = await createQrPoint({
        code: String(data.get("code") ?? ""),
        areaName: String(data.get("areaName") ?? ""),
        costCenterId,
        lat: center.lat,
        lng: center.lng,
        radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : 50,
      });

      if (!result.ok) {
        setMessage(null);
        setError(result.error);
        return;
      }

      form.reset();
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
            <CardDescription>Usa la ubicación del centro. El radio por defecto es 50 m.</CardDescription>
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
                Radio en metros
                <Input name="radiusMeters" type="number" min={1} defaultValue={50} />
              </label>
              <Button type="submit" variant="contrast" className="w-full" disabled={centers.length === 0 || pending}>
                Crear QR
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Códigos QR</CardTitle>
          <CardDescription>Desactivar no borra el código.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={6}>Todavía no hay códigos.</TableCell>
                </TableRow>
              ) : (
                qrPoints.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell className="font-medium">{point.code}</TableCell>
                    <TableCell>{point.areaName}</TableCell>
                    <TableCell>{point.centerName}</TableCell>
                    <TableCell>{point.radiusMeters} m</TableCell>
                    <TableCell>
                      <Badge tone={point.isActive ? "online" : "offline"}>
                        {point.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        onClick={() => onToggleQr(point.id, point.isActive)}
                        disabled={pending}
                      >
                        {point.isActive ? "Desactivar" : "Activar"}
                      </Button>
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
