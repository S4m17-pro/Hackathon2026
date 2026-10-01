import { requireRole } from "@/app/(auth)/session";
import { QrScanner, type ArrivalVisit } from "@/features/supervision/components/QrScanner";
import { bogotaToday, listCostCenters, listQrPoints, listVisits } from "@/features/coordinacion/queries";

export default async function EscanearPage({
  searchParams,
}: {
  searchParams: Promise<{ visita?: string; salida?: string }>;
}) {
  const session = await requireRole("SUPERVISOR");
  const { visita, salida } = await searchParams;
  const catalog = await loadCatalog();
  const arrival = await loadArrival(session.id, visita);
  const checkingIn = arrival?.status === "ASSIGNED";
  const checkingOut = salida === "1" && arrival?.status === "IN_PROGRESS";

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Supervisor</p>
        <h1 className="text-2xl font-semibold">
          {checkingOut ? "Salida" : checkingIn ? "Llegada" : "Escanear QR"}
        </h1>
      </header>
      <QrScanner catalog={catalog} visitClientId={arrival?.clientId ?? null} arrival={arrival} />
    </main>
  );
}

async function loadArrival(supervisorId: string, clientId?: string): Promise<ArrivalVisit | null> {
  try {
    const day = bogotaToday();
    const [visits, centers] = await Promise.all([
      listVisits({
        supervisorId,
        from: `${day}T00:00:00.000-05:00`,
        to: `${day}T23:59:59.999-05:00`,
      }),
      listCostCenters(),
    ]);
    const centerById = new Map(centers.map((center) => [center.id, center]));
    const open = visits.filter((visit) => visit.status === "ASSIGNED" || visit.status === "IN_PROGRESS");
    const chosen =
      (clientId ? open.find((visit) => visit.clientId === clientId) : undefined) ??
      open.find((visit) => visit.status === "IN_PROGRESS") ??
      open.find((visit) => visit.status === "ASSIGNED");

    if (!chosen) {
      return null;
    }

    const center = centerById.get(chosen.costCenterId);
    return {
      clientId: chosen.clientId,
      supervisorId: chosen.supervisorId,
      costCenterId: chosen.costCenterId,
      clientCreatedAt: chosen.clientCreatedAt,
      status: chosen.status,
      centerLat: center?.lat ?? null,
      centerLng: center?.lng ?? null,
      checkInLat: chosen.checkInLat,
      checkInLng: chosen.checkInLng,
      checkInAccuracyM: chosen.checkInAccuracyM,
      checkInAt: chosen.checkInAt,
      checkInDistanceM: chosen.checkInDistanceM,
      checkInVerified: chosen.checkInVerified,
      checkInOutOfRange: chosen.checkInOutOfRange,
    };
  } catch {
    return null;
  }
}

async function loadCatalog() {
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
