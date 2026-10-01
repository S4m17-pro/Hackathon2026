"use client";

import dynamic from "next/dynamic";

const QrSpotMap = dynamic(
  () => import("@/features/coordinacion/components/QrSpotMap").then((mod) => mod.QrSpotMap),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full rounded-xl border border-zinc-200 bg-zinc-100" />,
  },
);

export function QrSpotMapClient(props: {
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
}) {
  return <QrSpotMap {...props} />;
}
