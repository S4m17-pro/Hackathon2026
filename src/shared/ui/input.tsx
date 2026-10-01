import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/ui/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-950",
        className,
      )}
      {...props}
    />
  );
}
