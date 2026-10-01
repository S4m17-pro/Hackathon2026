import { requireRole } from "@/app/(auth)/session";
import { CheckInButton } from "@/features/supervision/components/CheckInButton";
import { SupervisorCatalogPreloader } from "@/features/supervision/components/SupervisorCatalogPreloader";
import {
  bogotaToday,
  listCostCenters,
  listQrPoints,
  listSupervisors,
  listVisits,
} from "@/features/coordinacion/queries";
import type { VisitStatus } from "@/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const statusLabel: Record<VisitStatus, string> = {
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export default async function VisitasPage() {
  const session = await requireRole("SUPERVISOR");
  const [data, qrCatalog] = await Promise.all([
    loadTodayVisits(session.id),
    loadActiveQrPoints(),
  ]);

  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Precarga automática en Dexie para garantizar disponibilidad 100% offline */}
      <SupervisorCatalogPreloader points={qrCatalog} />

        <header>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Hoy</p>
          <h1 className="text-2xl font-semibold">Visitas</h1>
        </header>

      {data.loadError ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{data.loadError}</p>
      ) : null}

      {data.visits.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay visitas asignadas para hoy.</p>
      ) : (
        data.visits.map((visit) => (
          <Card key={visit.id}>
            <CardHeader>
              <CardDescription>
                {visit.when} · {visit.centerName}
              </CardDescription>
              <CardTitle>{visit.supervisorName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">{statusLabel[visit.status]}</p>
              <CheckInButton visit={visit} />
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}

async function loadActiveQrPoints() {
  try {
    const points = await listQrPoints();
    return points
      .filter((point) => point.isActive)
      .map((point) => ({
        code: point.code,
        id: point.id,
        costCenterId: point.costCenterId,
        areaName: point.areaName,
        lat: point.lat,
        lng: point.lng,
        radiusMeters: point.radiusMeters,
      }));
  } catch {
    return [];
  }
}

async function loadTodayVisits(supervisorId: string) {
  try {
    const day = bogotaToday();
    const [visits, supervisors, centers] = await Promise.all([
      listVisits({
        supervisorId,
        from: `${day}T00:00:00.000-05:00`,
        to: `${day}T23:59:59.999-05:00`,
      }),
      listSupervisors(),
      listCostCenters(),
    ]);

    const supervisorName = new Map(supervisors.map((person) => [person.id, person.name]));
    const centerById = new Map(centers.map((center) => [center.id, center]));

    return {
      loadError: null,
      visits: visits
        .filter((visit) => visit.status !== "CANCELLED")
        .map((visit) => ({
          id: visit.id,
          clientId: visit.clientId,
          supervisorId: visit.supervisorId,
          costCenterId: visit.costCenterId,
          clientCreatedAt: visit.clientCreatedAt,
          status: visit.status,
          supervisorName: supervisorName.get(visit.supervisorId) ?? "Supervisor",
          centerName: centerById.get(visit.costCenterId)?.name ?? "Centro",
          centerLat: centerById.get(visit.costCenterId)?.lat ?? null,
          centerLng: centerById.get(visit.costCenterId)?.lng ?? null,
          when: formatWhen(visit.scheduledAt),
        })),
    };
  } catch {
    return {
      loadError: "No se pudo leer la base. Revisa que MySQL esté encendido.",
      visits: [],
    };
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) {
    return "Sin horario";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}
