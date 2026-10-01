"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";

import { enqueueVisit } from "@/features/supervision/offline/outbox";
import type { VisitStatus } from "@/shared/types";
import { Button } from "@/shared/ui/button";

interface CheckInVisit {
  clientId: string;
  supervisorId: string;
  costCenterId: string;
  clientCreatedAt: string;
  status: VisitStatus;
}

export function CheckInButton({ visit }: { visit: CheckInVisit }) {
  const [checkedIn, setCheckedIn] = useState(
    visit.status === "IN_PROGRESS" || visit.status === "COMPLETED",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCheckIn() {
    setSaving(true);
    setError(null);

    try {
      const position = await readPosition();
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
        checkInDistanceM: null,
        checkInVerified: false,
        checkInOutOfRange: false,
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
      setCheckedIn(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la llegada.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="contrast"
        size="lg"
        className="w-full gap-2"
        onClick={() => void onCheckIn()}
        disabled={checkedIn || saving || visit.status === "CANCELLED"}
      >
        <MapPin className="size-5" aria-hidden />
        {checkedIn ? "Llegada registrada" : saving ? "Guardando…" : "Registrar llegada"}
      </Button>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}

function readPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
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
      () => reject(new Error("Activa el GPS para registrar la llegada.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}
