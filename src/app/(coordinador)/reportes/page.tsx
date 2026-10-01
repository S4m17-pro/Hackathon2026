import { requireRole } from "@/app/(auth)/session";
import {
  ReportsView,
  type ReportVisitItem,
  type ReportNoveltyItem,
  type ReportEvidenceItem,
} from "@/features/coordinacion/components/ReportsView";
import {
  getVisitHistory,
  listCostCenters,
  listEvidenceGallery,
  listNovelties,
  listSupervisors,
} from "@/features/coordinacion/queries";

export default async function ReportesPage() {
  await requireRole("COORDINADOR");
  const data = await loadReportsData();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Inteligencia y Análisis</p>
        <h1 className="text-3xl font-semibold">Reportes de Operación y Cumplimiento</h1>
      </header>

      {data.loadError ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{data.loadError}</p>
      ) : null}

      <ReportsView
        initialVisits={data.visits}
        initialNovelties={data.novelties}
        initialEvidences={data.evidences}
        supervisors={data.supervisors}
        costCenters={data.costCenters}
      />
    </main>
  );
}

async function loadReportsData() {
  try {
    const [history, noveltiesRaw, gallery, supervisors, centers] = await Promise.all([
      getVisitHistory(),
      listNovelties(),
      listEvidenceGallery(),
      listSupervisors(),
      listCostCenters(),
    ]);

    const supervisorName = new Map(supervisors.map((s) => [s.id, s.name]));
    const centerName = new Map(centers.map((c) => [c.id, c.name]));
    const visitById = new Map(history.map((h) => [h.id, h]));

    const visits: ReportVisitItem[] = history.map((v) => ({
      id: v.id,
      supervisorId: v.supervisorId,
      supervisorName: v.supervisorName,
      costCenterId: v.costCenterId,
      costCenterName: v.costCenterName,
      status: v.status,
      scheduledAt: v.scheduledAt,
      checkInAt: v.checkInAt,
      checkOutAt: v.checkOutAt,
      checkInOutOfRange: v.checkInOutOfRange,
      checkInDistanceM: v.checkInDistanceM,
      durationMinutes: v.durationMinutes,
      notes: v.notes ?? v.checkOutNotes ?? null,
    }));

    const novelties: ReportNoveltyItem[] = noveltiesRaw.map((n) => {
      const visit = visitById.get(n.visitId);
      return {
        id: n.id,
        visitId: n.visitId,
        supervisorName: visit ? visit.supervisorName : "Supervisor",
        costCenterName: visit ? visit.costCenterName : "Centro",
        priority: n.priority,
        status: n.status,
        description: n.description,
        clientCreatedAt: n.clientCreatedAt,
        resolutionAction: n.resolutionAction,
      };
    });

    const evidences: ReportEvidenceItem[] = gallery.slice(0, 24).map((g) => ({
      id: g.id,
      ownerType: g.ownerType,
      url: g.url,
      capturedByName: (g.capturedById && supervisorName.get(g.capturedById)) ? supervisorName.get(g.capturedById)! : "Supervisor",
      clientCreatedAt: g.clientCreatedAt,
      context: g.context,
    }));

    return {
      loadError: null,
      visits,
      novelties,
      evidences,
      supervisors: supervisors.map((s) => ({ id: s.id, name: s.name })),
      costCenters: centers.map((c) => ({ id: c.id, name: c.name })),
    };
  } catch {
    return {
      loadError: "No se pudo conectar con la base de datos.",
      visits: [],
      novelties: [],
      evidences: [],
      supervisors: [],
      costCenters: [],
    };
  }
}
