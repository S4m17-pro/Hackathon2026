import { AreaEvidencePanel } from "@/features/supervision/components/AreaEvidencePanel";

export default async function QrEvidencePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="flex flex-col gap-4 p-4">
      <AreaEvidencePanel code={decodeURIComponent(code)} />
    </main>
  );
}
