import dynamic from "next/dynamic";

import { requireRole } from "@/app/(auth)/session";
import { EvidenceTraceTable } from "@/features/coordinacion/components/EvidenceTraceTable";
import { KpiCards } from "@/features/coordinacion/components/KpiCards";
import type {
  MapCostCenter,
  MapScannedQr,
  MapSupervisor,
} from "@/features/coordinacion/components/SupervisorsMap";
import { VisitsTable } from "@/features/coordinacion/components/VisitsTable";
import {
  bogotaToday,
  getDashboardKpis,
  getOperationsMap,
  listCostCenters,
  listEvidenceTrace,
  listSupervisors,
  listVisits,
} from "@/features/coordinacion/queries";

const SupervisorsMap = dynamic(
  () =>
    import("@/features/coordinacion/components/SupervisorsMap").then(
      (mod) => mod.SupervisorsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] w-full rounded-2xl border border-zinc-200 bg-white" />
    ),
  },
);

export default async function DashboardPage() {
  await requireRole("COORDINADOR");
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
      <SupervisorsMap centers={data.centers} supervisors={data.supervisors} scans={data.scans} />
      <VisitsTable rows={data.visits} />
      <EvidenceTraceTable rows={data.evidence} />
    </main>
  );
}

async function loadDashboard() {
  try {
    const day = bogotaToday();
    const [kpis, visits, supervisors, centers, operations, evidence] = await Promise.all([
      getDashboardKpis(),
      listVisits({
        from: `${day}T00:00:00.000-05:00`,
        to: `${day}T23:59:59.999-05:00`,
      }),
      listSupervisors(),
      listCostCenters(),
      getOperationsMap(),
      listEvidenceTrace(),
    ]);

    const supervisorName = new Map(supervisors.map((person) => [person.id, person.name]));
    const centerName = new Map(centers.map((center) => [center.id, center.name]));
    const scannedPointIds = new Set(operations.scans.map((scan) => scan.qrPointId));

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
      centers: operations.costCenters.map(
        (center): MapCostCenter => ({
          id: center.id,
          name: center.name,
          lat: center.lat,
          lng: center.lng,
        }),
      ),
      supervisors: operations.lastPositions.map(
        (position): MapSupervisor => ({
          id: position.supervisorId,
          name: supervisorName.get(position.supervisorId) ?? "Supervisor",
          lat: position.lat,
          lng: position.lng,
          checkInLabel: formatWhen(position.at),
        }),
      ),
      scans: operations.qrPoints
        .filter((point) => scannedPointIds.has(point.id))
        .map(
          (point): MapScannedQr => ({
            id: point.id,
            label: `${point.code} · ${point.areaName}`,
            lat: point.lat,
            lng: point.lng,
          }),
        ),
      evidence,
    };
  } catch {
    const FALLBACK_COST_CENTERS: MapCostCenter[] = [
      { id: "cc-1", name: "Plaza Central", lat: 4.658392, lng: -74.093498 },
      { id: "cc-2", name: "Centro Empresarial", lat: 4.678431, lng: -74.058319 },
      { id: "cc-3", name: "Parque Centro", lat: 4.706812, lng: -74.068127 },
    ];

    return {
      loadError:
        "Sin conexión con MySQL. Mostrando sitios base de operación en el mapa. Para ver datos en tiempo real ejecuta 'docker compose up -d'.",
      kpis: [
        { label: "Visitas programadas", value: "—", hint: "Sin conexión a la base" },
        { label: "Completadas", value: "—", hint: "Sin conexión a la base" },
        { label: "Novedades abiertas", value: "—", hint: "Sin conexión a la base" },
        { label: "GPS verificado", value: "—", hint: "Sin conexión a la base" },
      ],
      visits: [],
      centers: FALLBACK_COST_CENTERS,
      supervisors: [],
      scans: [],
      evidence: [],
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
