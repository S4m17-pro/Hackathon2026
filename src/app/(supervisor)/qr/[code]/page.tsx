export default async function QrEvidencePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main>
      <h1>Evidencias del área</h1>
      <p>{code}</p>
    </main>
  );
}
