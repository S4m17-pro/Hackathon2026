"use client";

import { Camera, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { db, type CachedQrPoint } from "@/features/supervision/offline/db";
import { findCachedQrPoint } from "@/features/supervision/offline/qrLookup";
import { enqueueEvidence, enqueueNovelty, generateClientId } from "@/features/supervision/offline/outbox";
import type { NoveltyPriority } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const priorities: { value: NoveltyPriority; label: string }[] = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "CRITICAL", label: "Crítica" },
];

interface LocalPreview {
  clientId: string;
  url: string;
  createdAt: string;
}

function ownerKey(code: string): string {
  return `qr:${code}`;
}

export function AreaEvidencePanel({ code }: { code: string }) {
  const [point, setPoint] = useState<CachedQrPoint | null>(null);
  const [photos, setPhotos] = useState<LocalPreview[]>([]);
  const [priority, setPriority] = useState<NoveltyPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photosRef = useRef<LocalPreview[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = await findCachedQrPoint(code);
      const rows = await db.photos.where("ownerClientId").equals(ownerKey(code)).toArray();
      const previews = rows
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((row) => ({
          clientId: row.clientId,
          url: URL.createObjectURL(row.blob),
          createdAt: row.createdAt,
        }));

      if (!active) {
        previews.forEach((photo) => URL.revokeObjectURL(photo.url));
        return;
      }

      setPoint(cached ?? null);
      setPhotos(previews);
    }

    void load();

    return () => {
      active = false;
    };
  }, [code]);

  async function reloadPhotos() {
    const rows = await db.photos.where("ownerClientId").equals(ownerKey(code)).toArray();
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return rows
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((row) => ({
          clientId: row.clientId,
          url: URL.createObjectURL(row.blob),
          createdAt: row.createdAt,
        }));
    });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) {
      return;
    }

    const clientId = generateClientId();
    const clientCreatedAt = new Date().toISOString();

    await db.photos.put({
      clientId,
      ownerClientId: ownerKey(code),
      blob: file,
      mimeType: file.type || "image/jpeg",
      fileName: file.name || "evidencia.jpg",
      createdAt: clientCreatedAt,
    });

    await enqueueEvidence({
      clientId,
      ownerType: "QR_SCAN",
      ownerClientId: ownerKey(code),
      url: "",
      clientCreatedAt,
    });

    await reloadPhotos();
    setNotice("Foto guardada en el teléfono. Se envía cuando haya red.");
  }

  async function onNovelty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = description.trim();
    if (!text) {
      return;
    }

    setSaving(true);
    await enqueueNovelty({
      visitClientId: "local-visit",
      priority,
      status: "OPEN",
      description: text,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    });
    setDescription("");
    setSaving(false);
    setNotice("Novedad en cola. El coordinador la verá al sincronizar.");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link href="/escanear" className="text-sm text-zinc-500">
          Volver al escáner
        </Link>
        <p className="text-xs tracking-wide text-zinc-500 uppercase">{code}</p>
        <h1 className="text-2xl font-semibold">{point?.areaName ?? "Área sin catálogo"}</h1>
        {point ? (
          <Badge tone="neutral">
            <MapPin className="size-3.5" aria-hidden />
            Radio {point.radiusMeters} m
          </Badge>
        ) : (
          <p className="text-sm text-zinc-500">
            Este código no está en el teléfono. Igual puedes dejar fotos y una novedad.
          </p>
        )}
      </header>

      {notice ? <p className="rounded-xl bg-lime-100 px-3 py-2 text-sm text-lime-950">{notice}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
          <CardDescription>Quedan en el dispositivo hasta que haya conexión.</CardDescription>
        </CardHeader>
        <CardContent>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <img
                  key={photo.clientId}
                  src={photo.url}
                  alt="Evidencia del área"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Todavía no hay fotos de esta área.</p>
          )}
          <label className="flex">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void onPhoto(file);
                event.target.value = "";
              }}
            />
            <span className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white">
              <Camera className="size-4" aria-hidden />
              Tomar foto
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novedad</CardTitle>
          <CardDescription>Describe lo que encontraste en esta área.</CardDescription>
        </CardHeader>
        <form onSubmit={onNovelty}>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {priorities.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={priority === item.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPriority(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="El piso de los baños está mojado y sin señalización."
              rows={4}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
            />
            <Button type="submit" variant="contrast" className="w-full" disabled={saving || description.trim().length === 0}>
              {saving ? "Guardando…" : "Registrar novedad"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
