import { requireRole } from "@/app/(auth)/session";
import { AlertsSection, type OutOfRangeAlert, type DelayedAlert, type CriticalNoveltyAlert } from "@/features/coordinacion/components/AlertsSection";
import { EvidenceTraceTable } from "@/features/coordinacion/components/EvidenceTraceTable";
import { ExportReportButton } from "@/features/coordinacion/components/ExportReportButton";
import { KpiCards } from "@/features/coordinacion/components/KpiCards";
import { SupervisorsMapDynamic } from "@/features/coordinacion/components/SupervisorsMapDynamic";
import type {
  MapCostCenter,
  MapScannedQr,
  MapSupervisor,
} from "@/features/coordinacion/components/SupervisorsMap";
import { SupervisorsMapClient as SupervisorsMap } from "@/features/coordinacion/components/SupervisorsMapClient";
import { VisitsTable } from "@/features/coordinacion/components/VisitsTable";
import {
  bogotaToday,
  getDashboardKpis,
  getOperationsMap,
  listCostCenters,
  listDelayedVisits,
  listEvidenceTrace,
  listNoveltyAlerts,
  listOutOfRangeVisits,
  listSupervisorRoutes,
  listSupervisors,
  listVisits,
} from "@/features/coordinacion/queries";

const FALLBACK_COST_CENTERS: MapCostCenter[] = [
  { id: "cc-1", name: "Plaza Central", lat: 4.658392, lng: -74.093498 },
  { id: "cc-2", name: "Centro Empresarial", lat: 4.678431, lng: -74.058319 },
  { id: "cc-3", name: "Parque Centro", lat: 4.706812, lng: -74.068127 },
];

export default async function DashboardPage() {
  await requireRole("COORDINADOR");
  const data = await loadDashboard();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación de Campo</p>
          <h1 className="text-3xl font-semibold">Panel de Control del Coordinador</h1>
        </div>
        <ExportReportButton />
      </header>

      {data.loadError ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{data.loadError}</p>
      ) : null}

      {/* Tarjetas de Indicadores Clave (KPIs) */}
      <KpiCards items={data.kpis} />
      <SupervisorsMapDynamic
        centers={data.centers}
        supervisors={data.supervisors}
        scans={data.scans}
      />

      {/* Sección de Alertas y Operaciones en Riesgo */}
      <AlertsSection
        outOfRange={data.alerts.outOfRange}
        delayed={data.alerts.delayed}
        criticalNovelties={data.alerts.criticalNovelties}
      />

      {/* Mapa Operativo con Geolocalización */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Mapa Geográfico de Operación</h2>
          <span className="text-xs text-zinc-500">Centros de costo, supervisores y puntos QR</span>
        </div>
        <SupervisorsMap centers={data.centers} supervisors={data.supervisors} scans={data.scans} />
      </section>

      {/* Tabla de Visitas del Día */}
      <VisitsTable rows={data.visits} />

      {/* Trazabilidad de Evidencias */}
      <EvidenceTraceTable rows={data.evidence} />
    </main>
  );
}

async function loadDashboard() {
  try {
    const day = bogotaToday();
    const [
      kpis,
      visits,
      supervisors,
      centers,
      operations,
      evidence,
      outOfRangeRaw,
      delayedRaw,
      noveltyAlertsRaw,
      routes,
    ] = await Promise.all([
      getDashboardKpis(),
      listVisits({
        from: `${day}T00:00:00.000-05:00`,
        to: `${day}T23:59:59.999-05:00`,
      }),
      listSupervisors(),
      listCostCenters(),
      getOperationsMap(),
      listEvidenceTrace(),
      listOutOfRangeVisits(),
      listDelayedVisits(),
      listNoveltyAlerts(),
      listSupervisorRoutes(day),
    ]);

    const supervisorName = new Map(supervisors.map((person) => [person.id, person.name]));
    const centerName = new Map(centers.map((center) => [center.id, center.name]));

    const onRouteCount = routes.filter((r) => r.status === "EN_RUTA").length;
    const withRouteCount = routes.filter((r) => r.status !== "SIN_VISITA").length;

    const outOfRangeAlerts: OutOfRangeAlert[] = outOfRangeRaw.slice(0, 6).map((v) => ({
      id: v.id,
      supervisorName: supervisorName.get(v.supervisorId) ?? "Supervisor",
      centerName: centerName.get(v.costCenterId) ?? "Centro",
      checkInAt: formatWhen(v.checkInAt),
      distanceMeters: v.checkInDistanceM,
    }));

    const delayedAlerts: DelayedAlert[] = delayedRaw.slice(0, 6).map((v) => ({
      id: v.id,
      supervisorName: supervisorName.get(v.supervisorId) ?? "Supervisor",
      centerName: centerName.get(v.costCenterId) ?? "Centro",
      scheduledAt: formatWhen(v.scheduledAt),
    }));

    const criticalNoveltyAlerts: CriticalNoveltyAlert[] = noveltyAlertsRaw
      .filter((n) => n.priority === "CRITICAL" || n.priority === "HIGH")
      .slice(0, 6)
      .map((n) => {
        const visit = visits.find((v) => v.id === n.visitId);
        return {
          id: n.id,
          priority: n.priority,
          description: n.description,
          supervisorName: visit ? (supervisorName.get(visit.supervisorId) ?? "Supervisor") : "Supervisor",
          centerName: visit ? (centerName.get(visit.costCenterId) ?? "Centro") : "Centro",
          clientCreatedAt: formatWhen(n.clientCreatedAt),
        };
      });

    return {
      loadError: null,
      kpis: [
        {
          label: "Visitas programadas",
          value: String(kpis.visitsScheduled),
          hint: `${kpis.visitsPending} visitas pendientes`,
        },
        {
          label: "Visitas completadas",
          value: String(kpis.visitsCompleted),
          hint: `${kpis.visitsDonePercent}% de cumplimiento`,
        },
        {
          label: "Supervisores en campo",
          value: `${onRouteCount} en ruta`,
          hint: `${withRouteCount} asignados de ${supervisors.length}`,
        },
        {
          label: "Centros de costo",
          value: String(centers.length),
          hint: "100% con georreferencia",
        },
        {
          label: "Novedades abiertas",
          value: String(kpis.openNovelties),
          hint: "Requieren revisión o cierre",
        },
        {
          label: "GPS verificado",
          value: `${kpis.gpsVerifiedPercent}%`,
          hint: `Checklist cumplido ${kpis.checklistDonePercent}%`,
        },
      ],
      alerts: {
        outOfRange: outOfRangeAlerts,
        delayed: delayedAlerts,
        criticalNovelties: criticalNoveltyAlerts,
      },
      visits: visits
        .filter((visit) => visit.status !== "CANCELLED")
        .map((visit) => ({
          id: visit.id,
          center: centerName.get(visit.costCenterId) ?? "Centro",
          supervisor: supervisorName.get(visit.supervisorId) ?? "Supervisor",
          status: visit.status,
          checkIn: formatWhen(visit.checkInAt),
        })),
      centers: operations.costCenters.length > 0 ? operations.costCenters.map(
        (center): MapCostCenter => ({
          id: center.id,
          name: center.name,
          lat: center.lat,
          lng: center.lng,
        }),
      ) : FALLBACK_COST_CENTERS,
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
        .filter((point) => point.isActive)
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
    return {
      loadError: "No se pudo leer la base. Mostrando centros base. Revisa que MySQL esté encendido con 'docker compose up -d'.",
      kpis: [
        { label: "Visitas programadas", value: "--", hint: "Sin conexión a la base" },
        { label: "Completadas", value: "--", hint: "Sin conexión a la base" },
        { label: "Supervisores en campo", value: "--", hint: "Sin conexión a la base" },
        { label: "Centros de costo", value: "--", hint: "Sin conexión a la base" },
        { label: "Novedades abiertas", value: "--", hint: "Sin conexión a la base" },
        { label: "GPS verificado", value: "--", hint: "Sin conexión a la base" },
      ],
      alerts: {
        outOfRange: [],
        delayed: [],
        criticalNovelties: [],
      },
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
    return "--";
  }

  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}
