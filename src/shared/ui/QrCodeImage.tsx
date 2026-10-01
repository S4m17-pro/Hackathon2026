"use client";

import { useMemo } from "react";
import { generateQrMatrix, generateQrSvgPath } from "@/shared/ui/qr";
import { cn } from "@/shared/ui/cn";

export interface QrCodeImageProps {
  value: string;
  size?: number;
  className?: string;
  margin?: number;
  fgColor?: string;
  bgColor?: string;
  alt?: string;
}

/**
 * Componente que renderiza un código QR nativo en SVG ultra-nítido,
 * 100% compatible con lectores de cámara de teléfonos móviles (BarcodeDetector).
 *
 * No requiere librerías externas en tiempo de ejecución.
 */
export function QrCodeImage({
  value,
  size = 96,
  className,
  margin = 2,
  fgColor = "#09090b", // zinc-950
  bgColor = "#ffffff",
  alt,
}: QrCodeImageProps) {
  const { path, viewBoxSize } = useMemo(() => {
    if (!value) {
      return { path: "", viewBoxSize: 21 + margin * 2 };
    }
    try {
      const matrix = generateQrMatrix(value);
      const { path: rawPath, size: matrixSize } = generateQrSvgPath(matrix);
      return {
        path: rawPath,
        viewBoxSize: matrixSize + margin * 2,
      };
    } catch (err) {
      console.error("Error generando código QR:", err);
      return { path: "", viewBoxSize: 25 };
    }
  }, [value, margin]);

  if (!value || !path) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-100 text-[10px] text-zinc-400",
          className
        )}
        style={{ width: size, height: size }}
      >
        Sin QR
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={alt ?? `Código QR para ${value}`}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={cn("rounded bg-white shadow-xs select-none", className)}
      style={{ shapeRendering: "crispEdges" }}
    >
      <rect width="100%" height="100%" fill={bgColor} />
      <path d={path} fill={fgColor} transform={`translate(${margin}, ${margin})`} />
    </svg>
  );
}
