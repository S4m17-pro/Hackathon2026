"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

interface Match {
  id?: string;
  kind?: string;
  reason?: string;
}

interface CheckResult {
  verdict?: "duplicado" | "similar" | "original" | string;
  summary?: string;
  matches?: Match[];
  error?: string;
}

const tone: Record<string, string> = {
  duplicado: "bg-red-100 text-red-950",
  similar: "bg-amber-100 text-amber-950",
  original: "bg-lime-100 text-lime-950",
};

export function DocumentCheckForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    try {
      const response = await fetch("/api/documents/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as CheckResult;
      setResult(data);
    } catch {
      setResult({ error: "No se pudo consultar el revisor." });
    } finally {
      setPending(false);
    }
  }

  const verdict = result?.verdict ?? "";

  return (
    <form className="flex max-w-3xl flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Texto del documento
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          required
          minLength={20}
          placeholder="Pega aquí el informe, la novedad o la descripción que quieres contrastar con lo ya registrado."
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal"
        />
      </label>
      <Button type="submit" disabled={pending || text.trim().length < 20} className="w-fit">
        {pending ? "Revisando…" : "Validar con Groq"}
      </Button>

      {result?.error ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{result.error}</p>
      ) : null}

      {result && !result.error && result.verdict ? (
        <Card>
          <CardHeader>
            <CardDescription>Resultado</CardDescription>
            <CardTitle className="capitalize">{result.verdict}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className={`rounded-xl px-3 py-2 text-sm ${tone[verdict] ?? "bg-zinc-100"}`}>
              {result.summary}
            </p>
            {result.matches && result.matches.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {result.matches.map((match) => (
                  <li key={`${match.kind}-${match.id}`} className="rounded-xl border border-zinc-200 px-3 py-2">
                    <p className="font-medium">
                      {match.kind} {match.id}
                    </p>
                    <p className="text-zinc-500">{match.reason}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </form>
  );
}
