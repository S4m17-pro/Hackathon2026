import { requireRole } from "@/app/(auth)/session";
import { AreaEvidencePanel } from "@/features/supervision/components/AreaEvidencePanel";
import { findTodayVisitClientId } from "@/features/supervision/todayVisit";

export default async function QrEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ scan?: string }>;
}) {
  const session = await requireRole("SUPERVISOR");
  const { code } = await params;
  const { scan } = await searchParams;
  const visitClientId = await findTodayVisitClientId(session.id);

  return (
    <main className="flex flex-col gap-4 p-4">
      <AreaEvidencePanel
        code={decodeURIComponent(code)}
        visitClientId={visitClientId}
        scanClientId={scan ?? null}
      />
    </main>
  );
}
