"use client";

import dynamic from "next/dynamic";

import type {
  MapCostCenter,
  MapScannedQr,
  MapSupervisor,
} from "@/features/coordinacion/components/SupervisorsMap";

const SupervisorsMap = dynamic(
  () =>
    import("@/features/coordinacion/components/SupervisorsMap").then(
      (mod) => mod.SupervisorsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] w-full rounded-2xl border border-zinc-200 bg-white" />
    ),
  },
);

export function SupervisorsMapDynamic(props: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  return <SupervisorsMap {...props} />;
}
