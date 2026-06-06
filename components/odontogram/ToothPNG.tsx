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
  /** Color hex de la condición activa */
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
  const isFractura   = wholeCond === "fractura";

  // Budget hover/selection styling takes priority over condition color
  let outline = "none";
  let bgColor = "transparent";
  if (hovered) {
    outline = "2.5px solid #2563EB";
    bgColor = "#DBEAFE";
  } else if (hasLine) {
    outline = "2px solid #3B82F6";
    bgColor = "#EFF6FF";
  } else if (condColor && !isAusente) {
    bgColor = `${condColor}50`;
  }

  return (
    <div
      style={{
        position: "relative", display: "block", width: "100%", borderRadius: 4,
        outline, outlineOffset: 2, backgroundColor: bgColor,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
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
          opacity: isAusente ? 0.25 : 1,
          filter: isAusente ? "grayscale(1)" : undefined,
          display: "block",
        }}
      />
      {/* Visible color overlay for condition — 40% opacity tint */}
      {condColor && !isAusente && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundColor: `${condColor}66`,
          border: `2.5px solid ${condColor}`,
          borderRadius: 4,
          pointerEvents: "none",
        }} />
      )}
      {/* Fractura: white vertical crack line */}
      {isFractura && (
        <div style={{
          position: "absolute", top: "6%", bottom: "6%",
          left: "50%", transform: "translateX(-50%)",
          width: 3, backgroundColor: "white",
          borderRadius: 2, pointerEvents: "none",
          boxShadow: "0 0 4px rgba(0,0,0,0.6)",
          zIndex: 2,
        }} />
      )}
      {/* Extracción: prominent X mark */}
      {isExtraccion && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 2,
        }}>
          <span style={{
            color: "white", fontWeight: 900, fontSize: "1.5em",
            textShadow: "0 0 6px #991B1B, 0 0 12px #991B1B, 1px 1px 2px black",
            lineHeight: 1, userSelect: "none",
          }}>✕</span>
        </div>
      )}
    </div>
  );
}
