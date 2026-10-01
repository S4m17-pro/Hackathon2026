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
          Groq compara un texto pegado, o un PDF, DOCX o TXT, con las novedades y notas ya guardadas.
        </p>
      </header>
      <DocumentCheckForm />
    </main>
  );
}
