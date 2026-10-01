"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

export function CheckInButton() {
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <Button
      variant="contrast"
      size="lg"
      className="w-full gap-2"
      onClick={() => setCheckedIn(true)}
      disabled={checkedIn}
    >
      <MapPin className="size-5" aria-hidden />
      {checkedIn ? "Llegada registrada" : "Registrar llegada"}
    </Button>
  );
}
