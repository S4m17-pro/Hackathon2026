import { requireRole } from "@/app/(auth)/session";
import { NoveltyBoard, type NoveltyRow } from "@/features/coordinacion/components/NoveltyBoard";
import { prisma } from "@/shared/lib/prisma";

export default async function NovedadesPage() {
  const session = await requireRole("COORDINADOR");
  const data = await loadNovelties();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Gestión Operativa</p>
        <h1 className="text-3xl font-semibold">Bandeja de Novedades y Seguimiento</h1>
      </header>
      <NoveltyBoard {...data} closerId={session.id} />
    </main>
  );
}

async function loadNovelties() {
  try {
    const [rows, evidences] = await Promise.all([
      prisma.novelty.findMany({
        include: {
          visit: {
            include: {
              supervisor: { select: { name: true } },
              costCenter: { select: { name: true } },
            },
          },
          closedBy: { select: { name: true } },
        },
        orderBy: { clientCreatedAt: "desc" },
      }),
      prisma.evidence.findMany({
        where: { ownerType: "NOVELTY" },
        select: { id: true, ownerId: true, url: true },
      }),
    ]);

    const evidenceByOwner = new Map<string, { id: string; url: string }[]>();
    for (const ev of evidences) {
      const list = evidenceByOwner.get(ev.ownerId) ?? [];
      list.push({ id: ev.id, url: ev.url });
      evidenceByOwner.set(ev.ownerId, list);
    }

    const novelties: NoveltyRow[] = rows.map((item) => ({
      id: item.id,
      description: item.description,
      priority: item.priority,
      status: item.status,
      clientCreatedAt: item.clientCreatedAt.toISOString(),
      supervisorName: item.visit.supervisor.name,
      costCenterName: item.visit.costCenter.name,
      lat: item.lat,
      lng: item.lng,
      evidences: evidenceByOwner.get(item.id) ?? [],
      resolutionAction: item.resolutionAction,
      closedByName: item.closedBy?.name ?? null,
      closedAt: item.closedAt ? item.closedAt.toISOString() : null,
    }));

    return {
      loadError: null,
      novelties,
    };
  } catch {
    return {
      loadError: "No se pudo leer la base de datos. Revisa que MySQL esté encendido.",
      novelties: [],
    };
  }
}
