"use client";

import { Camera, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { evaluateGeofence } from "@/features/supervision/offline/geo";
import { enqueueQrScan, enqueueVisit } from "@/features/supervision/offline/outbox";
import {
  bulkCacheQrPoints,
  dropRetiredQrPoints,
  findCachedQrPoint,
  verifyQrLocation,
  type QrLocationCheck,
} from "@/features/supervision/offline/qrLookup";
import type { GeoPoint, VisitStatus } from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export interface ScannerQrPoint {
  code: string;
  id: string;
  costCenterId: string;
  areaName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface ArrivalVisit {
  clientId: string;
  supervisorId: string;
  costCenterId: string;
  clientCreatedAt: string;
  status: VisitStatus;
  centerLat: number | null;
  centerLng: number | null;
}

type ScanPhase =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "checking" }
  | { status: "locating"; code: string }
  | { status: "result"; code: string; check: QrLocationCheck }
  | { status: "error"; message: string };

interface QrDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}

async function registerArrival(
  visit: ArrivalVisit,
  position: GeoPoint & { accuracy: number },
) {
  const geofence =
    visit.centerLat !== null && visit.centerLng !== null
      ? evaluateGeofence(position, { lat: visit.centerLat, lng: visit.centerLng })
      : null;
  const distanceMeters = geofence === null ? null : Math.round(geofence.distanceMeters);

  await enqueueVisit({
    clientId: visit.clientId,
    clientCreatedAt: visit.clientCreatedAt,
    supervisorId: visit.supervisorId,
    costCenterId: visit.costCenterId,
    status: "IN_PROGRESS",
    checkInLat: position.lat,
    checkInLng: position.lng,
    checkInAccuracyM: position.accuracy,
    checkInAt: new Date().toISOString(),
    checkInDistanceM: distanceMeters,
    checkInVerified: geofence?.isWithinRadius ?? false,
    checkInOutOfRange: geofence?.isOutOfRange ?? false,
    checkOutLat: null,
    checkOutLng: null,
    checkOutAccuracyM: null,
    checkOutAt: null,
    checkOutDistanceM: null,
    checkOutVerified: false,
    checkOutOutOfRange: false,
    checkOutNotes: null,
    notes: null,
  });
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

function readPosition(): Promise<GeoPoint & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este teléfono no entrega la ubicación."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => reject(new Error("Activa el GPS para registrar la ubicación.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

export function QrScanner({
  catalog,
  visitClientId,
  arrival,
}: {
  catalog: ScannerQrPoint[];
  visitClientId: string | null;
  arrival: ArrivalVisit | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<ScanPhase>({ status: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    void dropRetiredQrPoints().then(() => {
      if (catalog.length > 0) {
        return bulkCacheQrPoints(catalog);
      }
    });
  }, [catalog]);

  useEffect(() => {
    return () => {
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
    setPendingCode(null);

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

    if (arrival && point.costCenterId !== arrival.costCenterId) {
      setPhase({
        status: "error",
        message: "Ese código no es de este centro. Escanea el QR del lugar de la visita.",
      });
      return;
    }

    setPendingCode(code);
    setPhase({ status: "locating", code });

    try {
      const position = await readPosition();
      const check = await verifyQrLocation(code, position);

      if (arrival && arrival.status === "ASSIGNED") {
        await registerArrival(arrival, position);
      }

      setPendingCode(null);
      await openEvidence(code, check);
    } catch (error) {
      setPhase({
        status: "error",
        message:
          error instanceof Error
            ? `${error.message} El código ya quedó leído.`
            : "No se pudo registrar la ubicación. El código ya quedó leído.",
      });
    }
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void checkCode(manualCode);
  }

  async function openEvidence(code: string, check: QrLocationCheck) {
    if (check.point && visitClientId && typeof check.distanceMeters === "number") {
      const scan = await enqueueQrScan({
        qrPointId: check.point.id,
        visitClientId,
        distanceMeters: check.distanceMeters,
        verified: check.verified,
        clientCreatedAt: new Date().toISOString(),
      });
      router.push(`/qr/${encodeURIComponent(code)}?scan=${scan.clientId}`);
      return;
    }

    router.push(`/qr/${encodeURIComponent(code)}`);
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
              {arrival && arrival.status === "ASSIGNED"
                ? "Primero el código del área. Después se guarda tu ubicación y se abre el formulario."
                : "Apunta al código del área. Si la cámara no lo lee, escríbelo abajo."}
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
        <p className="text-center text-sm text-zinc-500">Leyendo el código…</p>
      ) : null}

      {phase.status === "locating" ? (
        <p className="text-center text-sm text-zinc-500">Código leído. Registrando tu ubicación…</p>
      ) : null}

      {pendingCode && phase.status === "error" ? (
        <Button className="w-full" onClick={() => void checkCode(pendingCode)}>
          Registrar ubicación
        </Button>
      ) : null}

      {phase.status === "error" ? (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950">{phase.message}</p>
      ) : null}

      {result && !result.check.found ? (
        <Card>
          <CardHeader>
            <CardDescription>{result.code}</CardDescription>
            <CardTitle>Código no reconocido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              {result.check.error ?? "Ese código no está en este teléfono."}
            </p>
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
            placeholder="Código del área"
            autoCapitalize="characters"
          />
        </label>
        <Button type="submit" variant="outline" className="w-full" disabled={manualCode.trim().length === 0}>
          {arrival && arrival.status === "ASSIGNED" ? "Usar este código y registrar llegada" : "Abrir formulario del área"}
        </Button>
      </form>
    </div>
  );
}
