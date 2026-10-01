import { QrScanner } from "@/features/supervision/components/QrScanner";

export default function EscanearPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Supervisor</p>
        <h1 className="text-2xl font-semibold">Escanear QR</h1>
      </header>
      <QrScanner />
    </main>
  );
}
