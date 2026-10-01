import { KpiCards } from "@/features/coordinacion/components/KpiCards";
import { VisitsTable } from "@/features/coordinacion/components/VisitsTable";
import {
  bogotaToday,
  getDashboardKpis,
  listCostCenters,
  listSupervisors,
  listVisits,
} from "@/features/coordinacion/queries";

export default async function DashboardPage() {
  const data = await loadDashboard();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación</p>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
      </header>
      {data.loadError ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{data.loadError}</p>
      ) : null}
      <KpiCards items={data.kpis} />
      <VisitsTable rows={data.visits} />
    </main>
  );
}

async function loadDashboard() {
  try {
    const day = bogotaToday();
    const [kpis, visits, supervisors, centers] = await Promise.all([
      getDashboardKpis(),
      listVisits({
        from: `${day}T00:00:00.000-05:00`,
        to: `${day}T23:59:59.999-05:00`,
      }),
      listSupervisors(),
      listCostCenters(),
    ]);

    const supervisorName = new Map(supervisors.map((person) => [person.id, person.name]));
    const centerName = new Map(centers.map((center) => [center.id, center.name]));

    return {
      loadError: null,
      kpis: [
        {
          label: "Visitas programadas",
          value: String(kpis.visitsScheduled),
          hint: `${kpis.visitsPending} pendientes`,
        },
        {
          label: "Completadas",
          value: String(kpis.visitsCompleted),
          hint: `${kpis.visitsDonePercent}% de cumplimiento`,
        },
        {
          label: "Novedades abiertas",
          value: String(kpis.openNovelties),
          hint: "Abiertas y en seguimiento",
        },
        {
          label: "GPS verificado",
          value: `${kpis.gpsVerifiedPercent}%`,
          hint: `Checklist ${kpis.checklistDonePercent}%`,
        },
      ],
      visits: visits
        .filter((visit) => visit.status !== "CANCELLED")
        .map((visit) => ({
          id: visit.id,
          center: centerName.get(visit.costCenterId) ?? "Centro",
          supervisor: supervisorName.get(visit.supervisorId) ?? "Supervisor",
          status: visit.status,
          checkIn: formatWhen(visit.checkInAt),
        })),
    };
  } catch {
    return {
      loadError: "No se pudo leer la base. Revisa que MySQL esté encendido.",
      kpis: [
        { label: "Visitas programadas", value: "—", hint: "Sin conexión a la base" },
        { label: "Completadas", value: "—", hint: "Sin conexión a la base" },
        { label: "Novedades abiertas", value: "—", hint: "Sin conexión a la base" },
        { label: "GPS verificado", value: "—", hint: "Sin conexión a la base" },
      ],
      visits: [],
    };
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}
