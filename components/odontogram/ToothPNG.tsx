"use client";
import React from "react";

/* ─── Mapeo FDI → PNG (fuente única para todos los componentes) ─────── */
export function getToothPNG(num: number): { src: string; mirror: boolean } {
  const q = Math.floor(num / 10);
  const n = num % 10;
  const mirror = q === 2 || q === 3 || q === 6 || q === 7;
  const upper  = q === 1 || q === 2 || q === 5 || q === 6;
  if (upper) {
    if (n >= 6) return { src: "/teeth/molar-superior.png", mirror };
    if (n >= 4) return { src: "/teeth/premolar-superior.png", mirror };
    if (n === 3) return { src: "/teeth/canino-superior.png", mirror };
    if (n === 2) return { src: "/teeth/incisivo-lateral-superior.png", mirror };
    return { src: "/teeth/incisivo-central-superior.png", mirror };
  }
  if (n >= 6) return { src: "/teeth/molar-inferior.png", mirror };
  if (n >= 4) return { src: "/teeth/premolar-inferior.png", mirror };
  if (n === 3) return { src: "/teeth/canino-inferior.png", mirror };
  if (n === 2) return { src: "/teeth/incisivo-lateral-inferior.png", mirror };
  return { src: "/teeth/incisivo-central-inferior.png", mirror };
}

/* ─── Componente único de renderizado de diente PNG ─────────────────── */
export interface ToothPNGProps {
  num: number;
  /** Condición entera del diente (ausente / extraccion / caries / …) */
  wholeCond?: string;
  /** Color hex de la condición activa — dibuja borde de color sobre el diente */
  condColor?: string;
  /** Presupuesto: este diente ya tiene una línea de tratamiento */
  hasLine?: boolean;
  /** Presupuesto: el cursor está encima de este diente */
  hovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function ToothPNG({
  num, wholeCond, condColor, hasLine, hovered,
  onClick, onMouseEnter, onMouseLeave,
}: ToothPNGProps) {
  const { src, mirror } = getToothPNG(num);
  const isAusente    = wholeCond === "ausente";
  const isExtraccion = wholeCond === "extraccion";

  let outline = "none";
  let bgColor = "transparent";
  if (hovered) {
    outline = "2.5px solid #2563EB";
    bgColor = "#DBEAFE";
  } else if (hasLine) {
    outline = "2px solid #3B82F6";
    bgColor = "#EFF6FF";
  } else if (condColor && !isAusente) {
    bgColor = `${condColor}1A`;
  }

  return (
    <div
      style={{
        position: "relative", display: "block", width: "100%", borderRadius: 4,
        outline, outlineOffset: 2, backgroundColor: bgColor,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img
        src={src} alt="" draggable={false}
        style={{
          width: "100%", height: "auto", objectFit: "contain",
          transform: mirror ? "scaleX(-1)" : undefined,
          opacity: isAusente ? 0.35 : 1,
          filter: isAusente ? "grayscale(1)" : undefined,
          display: "block",
        }}
      />
      {condColor && !isAusente && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 4,
          border: `1.5px solid ${condColor}`,
          pointerEvents: "none",
        }} />
      )}
      {isExtraccion && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#B91C1C", fontWeight: 900, fontSize: 18,
          pointerEvents: "none", textShadow: "0 0 4px white",
        }}>✕</div>
      )}
    </div>
  );
}
