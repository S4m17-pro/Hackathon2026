"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { signIn } from "@/app/(auth)/login/actions";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await signIn(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    setPending(false);

    if (!result.ok || !result.role) {
      setError(result.error ?? "No se pudo ingresar.");
      return;
    }

    router.push(result.role === "SUPERVISOR" ? "/visitas" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh bg-zinc-950 text-zinc-50 lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-10 px-6 py-10 sm:px-10 lg:px-14">
        <p className="text-xs font-medium tracking-[0.22em] text-lime-300 uppercase">
          Supervisión de campo
        </p>
        <div className="flex max-w-md flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            El aseo en sitio, con evidencia en el momento.
          </h1>
          <p className="text-base text-zinc-400">
            Check-in con GPS, códigos QR del área y novedades que salen del teléfono aunque no haya red.
          </p>
        </div>
        <p className="text-sm text-zinc-500">El rol lo define la cuenta, no esta pantalla.</p>
      </section>

      <section className="flex items-center bg-zinc-100 px-4 py-10 text-zinc-950 sm:px-8">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Ingresar</CardTitle>
            <CardDescription>Usa el correo y la contraseña de tu usuario.</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Correo
                <Input type="email" name="email" autoComplete="username" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Contraseña
                <Input type="password" name="password" autoComplete="current-password" required />
              </label>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Entrando…" : "Entrar"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </section>
    </main>
  );
}
