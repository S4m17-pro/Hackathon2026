"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
import { cn } from "@/shared/ui/cn";

type EntryRole = "supervisor" | "coordinador";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<EntryRole>("supervisor");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(role === "supervisor" ? "/visitas" : "/dashboard");
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
        <p className="text-sm text-zinc-500">Acceso de demostración. Cualquier correo entra.</p>
      </section>

      <section className="flex items-center bg-zinc-100 px-4 py-10 text-zinc-950 sm:px-8">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Ingresar</CardTitle>
            <CardDescription>Elige el rol para abrir la vista correspondiente.</CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Correo
                <Input type="email" name="email" placeholder="ana@aseo.com" required />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Contraseña
                <Input type="password" name="password" placeholder="••••••••" required />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={role === "supervisor" ? "default" : "outline"}
                  className={cn(role === "supervisor" && "ring-2 ring-lime-400")}
                  onClick={() => setRole("supervisor")}
                >
                  Supervisor
                </Button>
                <Button
                  type="button"
                  variant={role === "coordinador" ? "default" : "outline"}
                  className={cn(role === "coordinador" && "ring-2 ring-lime-400")}
                  onClick={() => setRole("coordinador")}
                >
                  Coordinador
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </CardFooter>
          </form>
        </Card>
      </section>
    </main>
  );
}
