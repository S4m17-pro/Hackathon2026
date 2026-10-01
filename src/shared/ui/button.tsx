import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/ui/cn";

const variants = {
  default: "bg-zinc-950 text-white hover:bg-zinc-800",
  contrast: "bg-lime-400 text-zinc-950 hover:bg-lime-300",
  outline: "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-50",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-4 text-sm",
  lg: "h-14 px-6 text-base",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
