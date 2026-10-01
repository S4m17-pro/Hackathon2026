import { requireRole } from "@/app/(auth)/session";
import { NoveltyBoard } from "@/features/coordinacion/components/NoveltyBoard";
import { listNovelties } from "@/features/coordinacion/queries";

export default async function NovedadesPage() {
  const session = await requireRole("COORDINADOR");
  const data = await loadNovelties();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación</p>
        <h1 className="text-3xl font-semibold">Novedades</h1>
      </header>
      <NoveltyBoard {...data} closerId={session.id} />
    </main>
  );
}

async function loadNovelties() {
  try {
    const novelties = await listNovelties();

    return {
      loadError: null,
      novelties: novelties.map((item) => ({
        id: item.id,
        description: item.description,
        priority: item.priority,
        status: item.status,
        clientCreatedAt: item.clientCreatedAt,
        resolutionAction: item.resolutionAction,
      })),
    };
  } catch {
    return {
      loadError: "No se pudo leer la base. Revisa que MySQL esté encendido.",
      novelties: [],
    };
  }
}
