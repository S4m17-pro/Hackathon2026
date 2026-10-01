"use client";

import dynamic from "next/dynamic";
import type {
  MapCostCenter,
  MapScannedQr,
  MapSupervisor,
} from "./SupervisorsMap";

const DynamicMap = dynamic(
  () =>
    import("./SupervisorsMap").then((mod) => mod.SupervisorsMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] w-full rounded-2xl border border-zinc-200 bg-white" />
    ),
  },
);

export function SupervisorsMapClient({
  centers,
  supervisors,
  scans,
}: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  return <DynamicMap centers={centers} supervisors={supervisors} scans={scans} />;
}
