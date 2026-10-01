"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

export interface NoveltyRow {
  id: string;
  description: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  clientCreatedAt: string;
  resolutionAction: string | null;
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

function formatWhen(iso: string): string {
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      novelties.filter((item) => (statusFilter === "ALL" ? true : item.status === statusFilter)),
    [novelties, statusFilter],
  );

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
      succeed("Novedad en seguimiento.");
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
      succeed("Novedad cerrada.");
    });
  }

  const filters: { id: NoveltyStatus | "ALL"; label: string }[] = [
    { id: "ALL", label: "Todas" },
    { id: "OPEN", label: "Abiertas" },
    { id: "IN_REVIEW", label: "En seguimiento" },
    { id: "RESOLVED", label: "Cerradas" },
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

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={statusFilter === filter.id ? "default" : "outline"}
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novedades de campo</CardTitle>
          <CardDescription>
            La hora es la del teléfono, no la de llegada al servidor. {visible.length} en esta vista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Qué pasó</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>En campo</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No hay novedades en este filtro.</TableCell>
                </TableRow>
              ) : (
                visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-sm font-medium">{item.description}</TableCell>
                    <TableCell>
                      <Badge tone={item.priority === "CRITICAL" || item.priority === "HIGH" ? "offline" : "neutral"}>
                        {priorityLabel[item.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={item.status === "RESOLVED" ? "done" : "progress"}>
                        {statusLabel[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatWhen(item.clientCreatedAt)}</TableCell>
                    <TableCell>
                      {item.status === "OPEN" ? (
                        <Button onClick={() => moveToReview(item.id)} disabled={pending}>
                          Pasar a seguimiento
                        </Button>
                      ) : null}
                      {item.status === "IN_REVIEW" ? (
                        <form
                          className="flex min-w-64 flex-col gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            closeNovelty(item.id, event.currentTarget);
                          }}
                        >
                          <Input name="resolutionAction" placeholder="Qué se hizo" required />
                          <Button type="submit" variant="contrast" disabled={pending}>
                            Cerrar
                          </Button>
                        </form>
                      ) : null}
                      {item.status === "RESOLVED" ? (
                        <span className="text-sm text-zinc-500">{item.resolutionAction ?? "Cerrada"}</span>
                      ) : null}
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
