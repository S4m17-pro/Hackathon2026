"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button";

export function CheckInButton() {
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <Button
      variant="contrast"
      size="lg"
      className="w-full"
      onClick={() => setCheckedIn(true)}
      disabled={checkedIn}
    >
      {checkedIn ? "Llegada registrada" : "Registrar llegada"}
    </Button>
  );
}
