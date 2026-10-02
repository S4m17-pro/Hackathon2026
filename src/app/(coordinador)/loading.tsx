export default function CoordinatorLoading() {
  return (
    <div className="flex flex-col gap-6 p-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-32 rounded-full bg-zinc-200" />
          <div className="h-8 w-64 rounded-lg bg-zinc-300" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-zinc-200" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
            <div className="h-3 w-24 rounded bg-zinc-200" />
            <div className="mt-3 h-7 w-16 rounded bg-zinc-300" />
            <div className="mt-3 h-2.5 w-28 rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      {/* Alerts Skeleton */}
      <div className="h-44 rounded-2xl border border-amber-200/60 bg-amber-50/30 p-6">
        <div className="h-5 w-48 rounded bg-amber-200/60" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="h-24 rounded-xl bg-white/80 p-3" />
          <div className="h-24 rounded-xl bg-white/80 p-3" />
          <div className="h-24 rounded-xl bg-white/80 p-3" />
        </div>
      </div>

      {/* Map Skeleton */}
      <div className="h-[32rem] w-full rounded-2xl border border-zinc-200 bg-zinc-200/70" />

      {/* Table Skeleton */}
      <div className="h-64 rounded-2xl border border-zinc-200 bg-white p-6" />
    </div>
  );
}
