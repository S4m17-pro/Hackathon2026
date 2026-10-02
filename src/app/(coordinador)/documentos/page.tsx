import { requireRole } from "@/app/(auth)/session";
import { DocumentCheckForm, type RecordOption } from "@/features/coordinacion/components/DocumentCheckForm";
import { prisma } from "@/shared/lib/prisma";

export default async function DocumentosPage() {
  await requireRole("COORDINADOR");
  const records = await loadAuditRecords();

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-lime-400/15 px-2.5 py-0.5 text-xs font-semibold text-lime-700 tracking-wide uppercase">
            IA Anti-Plagio & Integridad
          </span>
          <span className="text-xs text-zinc-400 font-medium">Potenciado con GroqCloud LLaMA 3.3 70B</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Auditoría de Documentos y Detección de Duplicidad
        </h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Sistema inteligente para prevenir plagio de reportes entre supervisores, detectar notas recicladas, validar informes externos (PDF/Word) y asegurar la autenticidad de la operación en campo.
        </p>
      </header>
      <DocumentCheckForm availableRecords={records} />
    </main>
  );
}

async function loadAuditRecords(): Promise<RecordOption[]> {
  try {
    const [visits, novelties] = await Promise.all([
      prisma.visit.findMany({
        where: { OR: [{ notes: { not: null } }, { checkOutNotes: { not: null } }] },
        orderBy: { clientCreatedAt: "desc" },
        take: 25,
        include: {
          supervisor: { select: { name: true } },
          costCenter: { select: { name: true } },
        },
      }),
      prisma.novelty.findMany({
        orderBy: { clientCreatedAt: "desc" },
        take: 25,
        include: {
          visit: {
            select: {
              supervisor: { select: { name: true } },
              costCenter: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const items: RecordOption[] = [
      ...visits.flatMap((v) => {
        const text = [v.notes, v.checkOutNotes].filter(Boolean).join(" | ");
        if (!text) return [];
        return [
          {
            id: `VIS-${v.id}`,
            label: `Visita ${v.costCenter.name} (${v.supervisor.name} · ${v.clientCreatedAt.toISOString().split("T")[0]})`,
            type: "VISITA" as const,
            author: v.supervisor.name,
            center: v.costCenter.name,
            date: v.clientCreatedAt.toISOString().split("T")[0],
            text,
          },
        ];
      }),
      ...novelties.map((n) => ({
        id: `NOV-${n.id}`,
        label: `Novedad [${n.priority}] ${n.visit.costCenter.name} (${n.visit.supervisor.name} · ${n.clientCreatedAt.toISOString().split("T")[0]})`,
        type: "NOVEDAD" as const,
        author: n.visit.supervisor.name,
        center: n.visit.costCenter.name,
        date: n.clientCreatedAt.toISOString().split("T")[0],
        text: n.description,
      })),
    ];

    return items;
  } catch {
    return [];
  }
}
