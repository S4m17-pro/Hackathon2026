import { requireRole } from "@/app/(auth)/session";
import { AssignmentBoard } from "@/features/coordinacion/components/AssignmentBoard";
import {
  listCostCenters,
  listQrPoints,
  listSupervisors,
  listVisits,
} from "@/features/coordinacion/queries";

export default async function AsignacionesPage() {
  await requireRole("COORDINADOR");
  const data = await loadAssignments();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación</p>
        <h1 className="text-3xl font-semibold">Asignaciones</h1>
      </header>
      <AssignmentBoard {...data} />
    </main>
  );
}

async function loadAssignments() {
  try {
    const [supervisors, centers, visits, qrPoints] = await Promise.all([
      listSupervisors(),
      listCostCenters(),
      listVisits(),
      listQrPoints(),
    ]);

    const supervisorName = new Map(supervisors.map((person) => [person.id, person.name]));
    const centerName = new Map(centers.map((center) => [center.id, center.name]));

    return {
      loadError: null,
      supervisors: supervisors.map((person) => ({ id: person.id, name: person.name })),
      centers: centers.map((center) => ({
        id: center.id,
        name: center.name,
        lat: center.lat,
        lng: center.lng,
      })),
      visits: visits.map((visit) => ({
        id: visit.id,
        supervisorName: supervisorName.get(visit.supervisorId) ?? "Supervisor",
        centerName: centerName.get(visit.costCenterId) ?? "Centro",
        scheduledAt: visit.scheduledAt,
        status: visit.status,
        updatedAt: visit.updatedAt,
      })),
      qrPoints: qrPoints.map((point) => ({
        id: point.id,
        code: point.code,
        areaName: point.areaName,
        costCenterId: point.costCenterId,
        lat: point.lat,
        lng: point.lng,
        centerName: centerName.get(point.costCenterId) ?? "Centro",
        isActive: point.isActive,
        radiusMeters: point.radiusMeters,
        updatedAt: point.updatedAt,
      })),
    };
  } catch {
    return {
      loadError: "No se pudo leer la base. Revisa que MySQL esté encendido.",
      supervisors: [],
      centers: [],
      visits: [],
      qrPoints: [],
    };
  }
}
