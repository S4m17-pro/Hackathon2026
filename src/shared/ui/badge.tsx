import type { HTMLAttributes } from "react";

import { cn } from "@/shared/ui/cn";

const tones = {
  neutral: "bg-zinc-100 text-zinc-700",
  online: "bg-lime-100 text-lime-800",
  offline: "bg-amber-100 text-amber-900",
  progress: "bg-sky-100 text-sky-800",
  done: "bg-zinc-200 text-zinc-700",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof tones;
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
