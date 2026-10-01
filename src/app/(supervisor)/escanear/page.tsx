import { requireRole } from "@/app/(auth)/session";
import { QrScanner } from "@/features/supervision/components/QrScanner";
import { findTodayVisitClientId } from "@/features/supervision/todayVisit";
import { listQrPoints } from "@/features/coordinacion/queries";

export default async function EscanearPage() {
  const session = await requireRole("SUPERVISOR");
  const catalog = await loadCatalog();
  const visitClientId = await findTodayVisitClientId(session.id);

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Supervisor</p>
        <h1 className="text-2xl font-semibold">Escanear QR</h1>
      </header>
      <QrScanner catalog={catalog} visitClientId={visitClientId} />
    </main>
  );
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
