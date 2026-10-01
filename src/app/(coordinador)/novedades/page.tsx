import { NoveltyBoard } from "@/features/coordinacion/components/NoveltyBoard";
import { listNovelties, listSupervisors } from "@/features/coordinacion/queries";

export default async function NovedadesPage() {
  const data = await loadNovelties();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación</p>
        <h1 className="text-3xl font-semibold">Novedades</h1>
      </header>
      <NoveltyBoard {...data} />
    </main>
  );
}

async function loadNovelties() {
  try {
    const [novelties, supervisors] = await Promise.all([listNovelties(), listSupervisors()]);

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
      closers: supervisors.map((person) => ({ id: person.id, name: person.name })),
    };
  } catch {
    return {
      loadError: "No se pudo leer la base. Revisa que MySQL esté encendido.",
      novelties: [],
      closers: [],
    };
  }
}
