"use client";
import React from "react";

export interface ToothIconProps {
  num: number;
  crownFill?: string;
  rootFill?: string;
  crownStroke?: string;
  rootStroke?: string;
  sw?: number;
  hasX?: boolean;
  dim?: boolean;
  baby?: boolean;
  style?: React.CSSProperties;
}

function isUpperTooth(n: number): boolean {
  const q = Math.floor(n / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

function getMorphology(n: number): "i" | "c" | "p" | "um" | "lm" {
  const q = Math.floor(n / 10);
  const p = n % 10;
  if (p <= 2) return "i";
  if (p === 3) return "c";
  if (p <= 5) return "p";
  return (q === 1 || q === 2 || q === 5 || q === 6) ? "um" : "lm";
}

/* ─── SVG defs: gradientes + filtros ─────────────────────────────────── */
function Defs({ cId, rId, rhId, fId, crownFill, rootFill }: {
  cId: string; rId: string; rhId: string; fId: string;
  crownFill?: string; rootFill?: string;
}) {
  return (
    <defs>
      {/* Corona: degradado radial con focal en tercio superior-izquierdo */}
      {!crownFill && (
        <radialGradient id={cId} cx="38%" cy="28%" r="75%" fx="22%" fy="16%">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="42%"  stopColor="#F5F0E8"/>
          <stop offset="100%" stopColor="#C8B99A"/>
        </radialGradient>
      )}
      {/* Raíz: degradado lineal vertical (ápice más oscuro) */}
      {!rootFill && (
        <linearGradient id={rId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#E8C86A"/>
          <stop offset="52%"  stopColor="#C8A84B"/>
          <stop offset="100%" stopColor="#8A6A20"/>
        </linearGradient>
      )}
      {/* Highlight lateral de raíz: franja clara izquierda */}
      <linearGradient id={rhId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"  stopColor="#FFF5D0" stopOpacity="0.55"/>
        <stop offset="40%" stopColor="#FFF5D0" stopOpacity="0.20"/>
        <stop offset="100%" stopColor="#FFF5D0" stopOpacity="0"/>
      </linearGradient>
    </defs>
  );
}

/* ─── Componente principal ───────────────────────────────────────────── */
export function ToothIcon({
  num, crownFill, rootFill, crownStroke, rootStroke, sw = 0.5,
  hasX = false, dim = false, baby = false, style,
}: ToothIconProps) {
  const morph  = getMorphology(num);
  const upper  = isUpperTooth(num);
  const babyS  = baby ? 0.82 : 1;
  const flipSt: React.CSSProperties = upper ? {} : { transform: "scaleY(-1)" };
  const opacity = dim ? 0.15 : 1;

  const cId  = `t${num}cg`;
  const rId  = `t${num}rg`;
  const rhId = `t${num}rh`;
  const fId  = `t${num}sh`;  // kept for backward compat, drop-shadow via CSS now

  const cf  = crownFill ?? `url(#${cId})`;
  const rf  = rootFill  ?? `url(#${rId})`;
  const cs  = crownStroke ?? "#A89880";
  const rs  = rootStroke  ?? "#9A7A2E";
  const xColor = crownStroke || "#ef4444";

  /* CSS drop-shadow as specified */
  const svgStyle: React.CSSProperties = {
    display: "block", opacity,
    filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.25))",
    ...flipSt, ...style,
  };

  /* ─── Highlight lateral izquierdo de raíz (franja cilíndrica) ─── */
  const rootHL = (path: string) => (
    <path d={path} fill={`url(#${rhId})`} stroke="none"/>
  );

  /* ═══ INCISIVO ═══════════════════════════════════════════════════ */
  if (morph === "i") {
    const w = Math.round(25 * babyS), h = Math.round(86 * babyS);
    /* corona: x≈3.5–16.5, y=0–32  |  raíz: y=30–75 */
    return (
      <svg viewBox="0 0 20 76" width={w} height={h} style={svgStyle}>
        <Defs cId={cId} rId={rId} rhId={rhId} fId={fId} crownFill={crownFill} rootFill={rootFill}/>
        {/* Raíz */}
        <path d="M5.5,32 C4.5,47 5.5,63 10,75 C14.5,63 15.5,47 14.5,32 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M5.5,32 C4.5,47 5.5,63 8.5,73 C8,62 7.5,46 7,32 Z")}
        {/* Corona */}
        <path d="M3.5,31 C3,34 4.5,35 5.5,32 L6,5.5 C5.5,1.5 7.5,0 10,0 C12.5,0 14.5,1.5 14,5.5 L14.5,32 C15.5,35 17,34 16.5,31 Z"
          fill={cf} stroke={cs} strokeWidth={sw}/>
        {/* Highlight especular */}
        <ellipse cx="7.5" cy="6" rx="2.2" ry="3" fill="white" opacity="0.45"/>
        {/* Línea CEJ */}
        <path d="M5.5,32 Q10,33.5 14.5,32" fill="none" stroke="#A89880" strokeWidth="0.5" opacity="0.55"/>
        {hasX && <>
          <line x1="4" y1="2" x2="16" y2="31" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="16" y1="2" x2="4"  y2="31" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
        </>}
      </svg>
    );
  }

  /* ═══ CANINO ════════════════════════════════════════════════════ */
  if (morph === "c") {
    const w = Math.round(25 * babyS), h = Math.round(95 * babyS);
    return (
      <svg viewBox="0 0 20 84" width={w} height={h} style={svgStyle}>
        <Defs cId={cId} rId={rId} rhId={rhId} fId={fId} crownFill={crownFill} rootFill={rootFill}/>
        {/* Raíz */}
        <path d="M5.5,36 C4.5,52 5.5,68 10,82 C14.5,68 15.5,52 14.5,36 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M5.5,36 C4.5,52 5.5,68 8.5,80 C8,68 7.5,51 7,36 Z")}
        {/* Corona */}
        <path d="M3.5,35 C3,37.5 4.5,38.5 5.5,36 L5.5,18 C4.5,9.5 7,1 10,0 C13,1 15.5,9.5 14.5,18 L14.5,36 C15.5,38.5 17,37.5 16.5,35 Z"
          fill={cf} stroke={cs} strokeWidth={sw}/>
        {/* Highlight especular */}
        <ellipse cx="7.5" cy="7" rx="2" ry="3.5" fill="white" opacity="0.42"/>
        {/* CEJ */}
        <path d="M5.5,36 Q10,37.5 14.5,36" fill="none" stroke="#A89880" strokeWidth="0.5" opacity="0.55"/>
        {hasX && <>
          <line x1="4" y1="2" x2="16" y2="35" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="16" y1="2" x2="4"  y2="35" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
        </>}
      </svg>
    );
  }

  /* ═══ PREMOLAR ══════════════════════════════════════════════════ */
  if (morph === "p") {
    const w = Math.round(28 * babyS), h = Math.round(84 * babyS);
    return (
      <svg viewBox="0 0 22 74" width={w} height={h} style={svgStyle}>
        <Defs cId={cId} rId={rId} rhId={rhId} fId={fId} crownFill={crownFill} rootFill={rootFill}/>
        {/* Raíz mesial */}
        <path d="M4,31.5 C3,44 3.5,57 7.5,70 C9,57 9.5,44 8.5,31.5 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M4,31.5 C3,44 3.5,57 6,68 C5.8,56 5.5,43 5.5,31.5 Z")}
        {/* Raíz distal */}
        <path d="M13,31.5 C12,44 12.5,57 15,70 C18.5,57 19,44 18,31.5 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M13,31.5 C12,44 12.5,57 14,68 C13.8,56 13.5,43 13.5,31.5 Z")}
        {/* Corona */}
        <path d="M3,31 C2.5,33.5 4,34.5 5,31.5 L5.5,14 C5,6.5 7.5,1 9.5,0.5 C10,0.2 10.5,0.2 11,0.5 C13.5,1 17,6.5 16.5,14 L17,31.5 C18,34.5 19.5,33.5 19,31 Z"
          fill={cf} stroke={cs} strokeWidth={sw}/>
        {/* Groove entre cúspides */}
        <path d="M9.5,0.5 C10,4.5 10.5,6.5 11,0.5" fill="none" stroke="#C0B8A8" strokeWidth="0.6" opacity="0.45"/>
        {/* Highlight especular */}
        <ellipse cx="7.5" cy="6" rx="2" ry="2.8" fill="white" opacity="0.42"/>
        {/* CEJ */}
        <path d="M5,31.5 Q11,33 17,31.5" fill="none" stroke="#A89880" strokeWidth="0.5" opacity="0.55"/>
        {hasX && <>
          <line x1="3" y1="2" x2="19" y2="31" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="19" y1="2" x2="3"  y2="31" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
        </>}
      </svg>
    );
  }

  /* ═══ MOLAR SUPERIOR (3 raíces) ════════════════════════════════ */
  if (morph === "um") {
    const w = Math.round(38 * babyS), h = Math.round(84 * babyS);
    return (
      <svg viewBox="0 0 30 74" width={w} height={h} style={svgStyle}>
        <Defs cId={cId} rId={rId} rhId={rhId} fId={fId} crownFill={crownFill} rootFill={rootFill}/>
        {/* Raíz palatina (centro, ligeramente detrás) */}
        <path d="M12.5,30 C11.5,42 12,54 14,65 C16,54 16.5,42 15.5,30 Z"
          fill={rf} stroke={rs} strokeWidth={sw} opacity={rootFill ? 0.7 : 0.7}/>
        {rootHL("M12.5,30 C11.5,42 12,54 13,63 C12.8,53 12.5,41 13,30 Z")}
        {/* Raíz MB */}
        <path d="M3,30 C2,43 3,57 7,68 C9.5,57 10,43 8.5,30 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M3,30 C2,43 3,57 5.5,66 C5.2,56 4.8,42 4.5,30 Z")}
        {/* Raíz DB */}
        <path d="M21,30 C20,43 21,57 23.5,68 C26.5,57 27,43 25.5,30 Z"
          fill={rf} stroke={rs} strokeWidth={sw}/>
        {rootHL("M21,30 C20,43 21,57 22.5,66 C22.2,56 21.8,42 22,30 Z")}
        {/* Corona */}
        <path d="M2,28.5 C1.5,31.5 3,33 5,30.5 L5.5,8 C5,3.5 7.5,0.5 11,0.5 C12.5,0.5 13.5,1.5 14,0.5 C14.5,1.5 16,0.5 19,0.5 C22.5,0.5 25,3.5 24.5,8 L25,30.5 C27,33 28.5,31.5 28,28.5 Z"
          fill={cf} stroke={cs} strokeWidth={sw}/>
        {/* Groove bucal entre cúspides */}
        <path d="M13.5,1 C14,5 14.5,9 14,13" fill="none" stroke="#C0B8A8" strokeWidth="0.7" opacity="0.45"/>
        {/* Highlight especular */}
        <ellipse cx="8" cy="6" rx="2.8" ry="3.2" fill="white" opacity="0.40"/>
        {/* CEJ */}
        <path d="M5,30.5 Q15,32.5 25,30.5" fill="none" stroke="#A89880" strokeWidth="0.5" opacity="0.55"/>
        {hasX && <>
          <line x1="2" y1="2" x2="28" y2="30" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="28" y1="2" x2="2"  y2="30" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
        </>}
      </svg>
    );
  }

  /* ═══ MOLAR INFERIOR (2 raíces) ════════════════════════════════ */
  const w = Math.round(30 * babyS), h = Math.round(67 * babyS);
  return (
    <svg viewBox="0 0 30 74" width={w} height={h} style={svgStyle}>
      <Defs cId={cId} rId={rId} rhId={rhId} fId={fId} crownFill={crownFill} rootFill={rootFill}/>
      {/* Raíz mesial */}
      <path d="M4,30 C3,44 3.5,58 8,70 C11,58 11.5,44 9.5,30 Z"
        fill={rf} stroke={rs} strokeWidth={sw}/>
      {rootHL("M4,30 C3,44 3.5,58 6.5,68 C6.2,57 5.8,43 5.5,30 Z")}
      {/* Raíz distal */}
      <path d="M19.5,30 C18.5,44 19,58 21.5,70 C25.5,58 26,44 24.5,30 Z"
        fill={rf} stroke={rs} strokeWidth={sw}/>
      {rootHL("M19.5,30 C18.5,44 19,58 20.5,68 C20.2,57 19.8,43 20,30 Z")}
      {/* Corona */}
      <path d="M2,28.5 C1.5,31.5 3.5,33 5.5,30.5 L6,8 C5.5,3.5 8,0.5 11.5,0.5 C13,0.5 14,2 15,0.5 C16,2 17.5,0.5 20,0.5 C23.5,0.5 26,3.5 25.5,8 L26,30.5 C28,33 29.5,31.5 29,28.5 Z"
        fill={cf} stroke={cs} strokeWidth={sw}/>
      {/* Groove bucal */}
      <path d="M14.5,1 C15,5 15.5,9 15,13" fill="none" stroke="#C0B8A8" strokeWidth="0.7" opacity="0.45"/>
      {/* Highlight especular */}
      <ellipse cx="8.5" cy="6" rx="2.8" ry="3.2" fill="white" opacity="0.40"/>
      {/* CEJ */}
      <path d="M5.5,30.5 Q15.5,32.5 26,30.5" fill="none" stroke="#A89880" strokeWidth="0.5" opacity="0.55"/>
      {hasX && <>
        <line x1="2" y1="2" x2="29" y2="30" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="29" y1="2" x2="2"  y2="30" stroke={xColor} strokeWidth="2.5" strokeLinecap="round"/>
      </>}
    </svg>
  );
}
