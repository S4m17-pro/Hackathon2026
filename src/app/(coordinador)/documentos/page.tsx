import { requireRole } from "@/app/(auth)/session";
import { DocumentCheckForm } from "@/features/coordinacion/components/DocumentCheckForm";

export default async function DocumentosPage() {
  await requireRole("COORDINADOR");

  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Integridad</p>
        <h1 className="text-3xl font-semibold">Validar documento</h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Groq compara el texto con novedades y notas ya guardadas. Marca duplicado, similar u original.
        </p>
      </header>
      <DocumentCheckForm />
    </main>
  );
}
