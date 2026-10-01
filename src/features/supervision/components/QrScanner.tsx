"use client";

import { Camera, MapPin, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  bulkCacheQrPoints,
  findCachedQrPoint,
  verifyQrLocation,
  type QrLocationCheck,
} from "@/features/supervision/offline/qrLookup";
import type { GeoPoint } from "@/shared/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

const DEMO_CODE = "AREA-NORTE-01";

type ScanPhase =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "checking" }
  | { status: "result"; code: string; check: QrLocationCheck }
  | { status: "error"; message: string };

interface QrDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}

function getDetector(): QrDetector | null {
  const candidate = window as Window & {
    BarcodeDetector?: new (options: { formats: string[] }) => QrDetector;
  };

  if (!candidate.BarcodeDetector) {
    return null;
  }

  return new candidate.BarcodeDetector({ formats: ["qr_code"] });
}

function readPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => reject(new Error("No se pudo leer el GPS. Activa la ubicación e inténtalo de nuevo.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<ScanPhase>({ status: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function seedDemoPoint() {
      const existing = await findCachedQrPoint(DEMO_CODE);
      if (existing || cancelled) {
        return;
      }

      await bulkCacheQrPoints([
        {
          code: DEMO_CODE,
          id: "mock-qr-norte",
          costCenterId: "cc-norte",
          areaName: "Baños planta 1",
          lat: 4.711,
          lng: -74.0721,
          radiusMeters: 50,
        },
      ]);
    }

    void seedDemoPoint();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function startCamera() {
    setPhase({ status: "scanning" });

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase({
        status: "error",
        message: "Este navegador no abre la cámara. Escribe el código abajo.",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      const detector = getDetector();

      if (!detector) {
        setPhase({
          status: "error",
          message: "La cámara está abierta, pero este navegador no lee QR solo. Escribe el código abajo.",
        });
        return;
      }

      timerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          return;
        }

        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (!value) {
            return;
          }

          stopCamera();
          await checkCode(value);
        } catch {
          // El cuadro todavía no está listo para leerse.
        }
      }, 400);
    } catch {
      stopCamera();
      setPhase({
        status: "error",
        message: "No se dio permiso a la cámara. Puedes escribir el código a mano.",
      });
    }
  }

  async function checkCode(rawCode: string) {
    const code = rawCode.trim();
    if (!code) {
      return;
    }

    stopCamera();
    setPhase({ status: "checking" });

    try {
      const position = await readPosition();
      const check = await verifyQrLocation(code, position);
      setPhase({ status: "result", code, check });
    } catch (error) {
      const point = await findCachedQrPoint(code);
      if (!point) {
        setPhase({
          status: "result",
          code,
          check: {
            found: false,
            verified: false,
            isOutOfRange: false,
            error: `El código QR "${code}" no se encuentra en el catálogo local de este dispositivo.`,
          },
        });
        return;
      }

      setPhase({
        status: "result",
        code,
        check: {
          found: true,
          point,
          verified: false,
          isOutOfRange: false,
          error: error instanceof Error ? error.message : "No se pudo validar la ubicación.",
        },
      });
    }
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void checkCode(manualCode);
  }

  const result = phase.status === "result" ? phase : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          playsInline
          muted
        />
        {!cameraReady ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-zinc-50">
            <QrCode className="size-10 text-lime-300" aria-hidden />
            <p className="text-sm text-zinc-300">
              Apunta al código del área. Si la cámara no lee, usa el código de prueba.
            </p>
          </div>
        ) : null}
      </div>

      {phase.status === "scanning" || phase.status === "idle" || phase.status === "error" ? (
        <Button className="w-full gap-2" onClick={() => void startCamera()} disabled={phase.status === "scanning" && cameraReady}>
          <Camera className="size-4" aria-hidden />
          {cameraReady ? "Leyendo código…" : "Abrir cámara"}
        </Button>
      ) : null}

      {phase.status === "checking" ? (
        <p className="text-center text-sm text-zinc-500">Comparando el código con tu ubicación…</p>
      ) : null}

      {phase.status === "error" ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{phase.message}</p>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardDescription>{result.code}</CardDescription>
            <CardTitle>{result.check.point?.areaName ?? "Código no reconocido"}</CardTitle>
          </CardHeader>
          <CardContent>
            {result.check.found ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.check.verified ? "online" : "offline"}>
                    <MapPin className="size-3.5" aria-hidden />
                    {result.check.verified ? "Dentro del área" : "Fuera de rango"}
                  </Badge>
                  {typeof result.check.distanceMeters === "number" ? (
                    <span className="text-sm text-zinc-500">
                      {Math.round(result.check.distanceMeters)} m
                    </span>
                  ) : null}
                </div>
                {result.check.error ? (
                  <p className="text-sm text-zinc-500">{result.check.error}</p>
                ) : null}
                <Button
                  variant="contrast"
                  className="w-full"
                  onClick={() => router.push(`/qr/${encodeURIComponent(result.code)}`)}
                >
                  Abrir evidencias
                </Button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                {result.check.error ?? "Ese código no está en este teléfono."}
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={() => setPhase({ status: "idle" })}>
              Escanear otro
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <form className="flex flex-col gap-3" onSubmit={onManualSubmit}>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Código
          <Input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder={DEMO_CODE}
            autoCapitalize="characters"
          />
        </label>
        <Button type="submit" variant="outline" className="w-full" disabled={manualCode.trim().length === 0}>
          Validar código
        </Button>
        <button
          type="button"
          className="text-sm text-zinc-500 underline"
          onClick={() => {
            setManualCode(DEMO_CODE);
            void checkCode(DEMO_CODE);
          }}
        >
          Usar código de prueba {DEMO_CODE}
        </button>
      </form>
    </div>
  );
}
