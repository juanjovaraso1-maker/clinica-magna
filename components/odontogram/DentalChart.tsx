"use client";
import { useState } from "react";

// Display order: left → right on screen
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Per-surface conditions
export const SURF_CONDS: Record<string, { label: string; fill: string; stroke: string }> = {
  "":         { label: "Sano",     fill: "#ffffff", stroke: "#e2e8f0" },
  caries:     { label: "Caries",   fill: "#ef4444", stroke: "#dc2626" },
  filling:    { label: "Obturado", fill: "#3b82f6", stroke: "#1d4ed8" },
  root_canal: { label: "Conducto", fill: "#f97316", stroke: "#c2410c" },
  fracture:   { label: "Fractura", fill: "#f43f5e", stroke: "#e11d48" },
};
const SURF_CYCLE = Object.keys(SURF_CONDS);

// Whole-tooth conditions
export const WHOLE_CONDS: Record<string, { label: string; fill: string; stroke: string; symbol: string }> = {
  "":        { label: "Normal",   fill: "",        stroke: "",        symbol: "" },
  crown:     { label: "Corona",   fill: "#fef3c7", stroke: "#d97706", symbol: "C" },
  implant:   { label: "Implante", fill: "#ede9fe", stroke: "#7c3aed", symbol: "◆" },
  extracted: { label: "Extraído", fill: "#f1f5f9", stroke: "#94a3b8", symbol: "×" },
  absent:    { label: "Ausente",  fill: "#f8fafc", stroke: "#cbd5e1", symbol: "" },
  bridge:    { label: "Puente",   fill: "#e0f2fe", stroke: "#0369a1", symbol: "═" },
};

type Surface = "V" | "L" | "M" | "D" | "O";
const SURFACES: Surface[] = ["V", "L", "M", "D", "O"];
const SURF_LABELS: Record<Surface, string> = {
  V: "Vestibular", L: "Lingual/Palat.", M: "Mesial", D: "Distal", O: "Oclu./Incis.",
};

// SVG paths for 30x30 viewBox — 5 polygons tile the complete square
const PATHS: Record<Surface, string> = {
  V: "M 0,0 L 30,0 L 21,9 L 9,9 Z",
  L: "M 0,30 L 30,30 L 21,21 L 9,21 Z",
  M: "M 0,0 L 0,30 L 9,21 L 9,9 Z",
  D: "M 30,0 L 30,30 L 21,21 L 21,9 Z",
  O: "M 9,9 L 21,9 L 21,21 L 9,21 Z",
};

// Text label anchor positions per surface (in 30×30 viewBox)
const SURF_POS: Record<Surface, { x: number; y: number }> = {
  V: { x: 15, y: 5 },
  L: { x: 15, y: 26 },
  M: { x: 4.5, y: 15.5 },
  D: { x: 25.5, y: 15.5 },
  O: { x: 15, y: 16 },
};

export interface ToothData {
  condition: string;
  surfaces?: Partial<Record<Surface, string>>;
  notes: string;
}
export type OdontogramData = Record<string, ToothData>;

/** Migrate old format { condition: "caries", notes: "" } to new surface format */
function migrate(raw: any): ToothData {
  if (!raw) return { condition: "", surfaces: {}, notes: "" };
  const surfaceConds = new Set(["caries", "filling", "root_canal", "fracture", "healthy"]);
  if (surfaceConds.has(raw.condition) && !raw.surfaces) {
    const c = raw.condition === "healthy" ? "" : raw.condition as string;
    return { condition: "", surfaces: { V: c, L: c, M: c, D: c, O: c }, notes: raw.notes || "" };
  }
  return { condition: raw.condition || "", surfaces: raw.surfaces || {}, notes: raw.notes || "" };
}

interface SVGProps {
  tooth: ToothData;
  size?: number;
  showLabels?: boolean;
  interactive?: boolean;
  onSurface?: (s: Surface) => void;
}

function ToothSVG({ tooth, size = 30, showLabels = false, interactive = false, onSurface }: SVGProps) {
  const whole = WHOLE_CONDS[tooth.condition ?? ""] ?? WHOLE_CONDS[""];
  const isExtracted = tooth.condition === "extracted";
  const isAbsent = tooth.condition === "absent";
  const hasWhole = !!tooth.condition;

  return (
    <svg viewBox="0 0 30 30" width={size} height={size} style={{ overflow: "visible" }}>
      {/* Background for whole-tooth conditions */}
      {hasWhole && (
        <rect x="0" y="0" width="30" height="30" fill={whole.fill || "#ffffff"} />
      )}

      {/* 5 surface polygons — only when no whole-tooth override */}
      {!hasWhole && SURFACES.map(s => {
        const cond = tooth.surfaces?.[s] ?? "";
        const c = SURF_CONDS[cond] ?? SURF_CONDS[""];
        return (
          <path key={s} d={PATHS[s]} fill={c.fill} stroke={c.stroke} strokeWidth="0.5"
            style={{ cursor: interactive ? "pointer" : "default" }}
            onClick={interactive && onSurface ? () => onSurface(s) : undefined}
          />
        );
      })}

      {/* Surface labels in edit popup */}
      {showLabels && !hasWhole && SURFACES.map(s => {
        const cond = tooth.surfaces?.[s] ?? "";
        const c = SURF_CONDS[cond] ?? SURF_CONDS[""];
        const isDark = cond !== "" && cond !== "filling";
        return (
          <text key={s} x={SURF_POS[s].x} y={SURF_POS[s].y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="5" fontWeight="700" fill={isDark ? "#fff" : "#94a3b8"}
            style={{ pointerEvents: "none", userSelect: "none" }}>
            {s}
          </text>
        );
      })}

      {/* Outer border */}
      <rect x="0.5" y="0.5" width="29" height="29" rx="1"
        fill="none"
        stroke={hasWhole ? whole.stroke || "#e2e8f0" : "#e2e8f0"}
        strokeWidth={hasWhole ? "1.5" : "1"}
        strokeDasharray={isAbsent ? "3 2" : undefined}
      />

      {/* Extracted X */}
      {isExtracted && (
        <>
          <line x1="7" y1="7" x2="23" y2="23" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="23" y1="7" x2="7" y2="23" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {/* Whole-tooth symbol */}
      {whole.symbol && !isExtracted && (
        <text x="15" y="16" textAnchor="middle" dominantBaseline="middle"
          fontSize={size >= 60 ? "12" : "9"} fontWeight="800"
          fill={whole.stroke} style={{ pointerEvents: "none", userSelect: "none" }}>
          {whole.symbol}
        </text>
      )}
    </svg>
  );
}

interface Props {
  data: OdontogramData;
  onChange: (data: OdontogramData) => void;
  readonly?: boolean;
}

export default function DentalChart({ data, onChange, readonly }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<ToothData>({ condition: "", surfaces: {}, notes: "" });

  function openTooth(n: number) {
    if (readonly) return;
    setForm(migrate(data[String(n)]));
    setEditing(n);
  }

  function cycleSurface(s: Surface) {
    if (form.condition) return; // whole-tooth mode, no surface editing
    const cur = form.surfaces?.[s] ?? "";
    const idx = SURF_CYCLE.indexOf(cur);
    const next = SURF_CYCLE[(idx + 1) % SURF_CYCLE.length];
    setForm(f => ({ ...f, surfaces: { ...f.surfaces, [s]: next } }));
  }

  function saveTooth() {
    if (editing === null) return;
    // Clean up: if condition set, clear surfaces
    const saved: ToothData = form.condition
      ? { condition: form.condition, surfaces: {}, notes: form.notes }
      : { condition: "", surfaces: form.surfaces, notes: form.notes };
    onChange({ ...data, [String(editing)]: saved });
    setEditing(null);
  }

  function clearTooth() {
    if (editing === null) return;
    const next = { ...data };
    delete next[String(editing)];
    onChange(next);
    setEditing(null);
  }

  // Stats
  const stats: Record<string, number> = {};
  [...UPPER, ...LOWER].forEach(n => {
    const t = migrate(data[String(n)]);
    if (t.condition) stats[t.condition] = (stats[t.condition] ?? 0) + 1;
    SURFACES.forEach(s => {
      const c = t.surfaces?.[s] ?? "";
      if (c) stats[c] = (stats[c] ?? 0) + 1;
    });
  });

  function ToothCell({ n }: { n: number }) {
    const tooth = migrate(data[String(n)]);
    const hasData = tooth.condition || SURFACES.some(s => tooth.surfaces?.[s]);
    return (
      <button onClick={() => openTooth(n)} disabled={!!readonly}
        title={`Diente ${n}${tooth.notes ? ` — ${tooth.notes}` : ""}`}
        className={`flex flex-col items-center gap-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
          !readonly ? "hover:scale-110 transition-transform cursor-pointer" : "cursor-default"
        }`}>
        <ToothSVG tooth={tooth} size={28} />
        <span className={`text-[9px] font-mono leading-none ${hasData ? "text-slate-700 font-bold" : "text-slate-400"}`}>{n}</span>
      </button>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="text-slate-500 font-semibold">Superficies:</span>
        {Object.entries(SURF_CONDS).filter(([k]) => k).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border inline-block flex-shrink-0"
              style={{ background: v.fill, borderColor: v.stroke }} />
            {v.label}
          </span>
        ))}
        <span className="text-slate-200">|</span>
        <span className="text-slate-500 font-semibold">Diente:</span>
        {Object.entries(WHOLE_CONDS).filter(([k]) => k).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border inline-block flex-shrink-0"
              style={{ background: v.fill || "#ffffff", borderColor: v.stroke || "#e2e8f0" }} />
            {v.label}
          </span>
        ))}
      </div>

      {/* Odontogram grid */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[520px] space-y-3">
            <p className="text-[10px] text-slate-400 font-semibold tracking-widest text-center uppercase">Maxilar Superior</p>

            {/* Upper teeth row */}
            <div className="flex justify-center items-end gap-0.5">
              {/* Quadrant label */}
              <span className="text-[9px] text-slate-300 mr-1 mb-4 font-mono">18→</span>
              {UPPER.slice(0, 8).map(n => <ToothCell key={n} n={n} />)}
              <div className="w-px h-8 bg-slate-300 mx-1 mb-2" />
              {UPPER.slice(8).map(n => <ToothCell key={n} n={n} />)}
              <span className="text-[9px] text-slate-300 ml-1 mb-4 font-mono">←28</span>
            </div>

            {/* Midline */}
            <div className="relative border-t-2 border-dashed border-slate-300 mx-8">
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-slate-50 px-2 text-[9px] text-slate-400 font-semibold">LÍNEA MEDIA</span>
            </div>

            {/* Lower teeth row */}
            <div className="flex justify-center items-start gap-0.5 mt-1">
              <span className="text-[9px] text-slate-300 mr-1 mt-4 font-mono">48→</span>
              {LOWER.slice(0, 8).map(n => <ToothCell key={n} n={n} />)}
              <div className="w-px h-8 bg-slate-300 mx-1 mt-2" />
              {LOWER.slice(8).map(n => <ToothCell key={n} n={n} />)}
              <span className="text-[9px] text-slate-300 ml-1 mt-4 font-mono">←38</span>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold tracking-widest text-center uppercase">Maxilar Inferior</p>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      {Object.keys(stats).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats).map(([k, v]) => {
            const c = SURF_CONDS[k] ?? WHOLE_CONDS[k];
            if (!c) return null;
            return (
              <span key={k} className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: (c as any).fill || "#f8fafc", border: `1.5px solid ${(c as any).stroke || "#e2e8f0"}` }} />
                <span className="font-semibold text-slate-700">{v}</span>
                <span className="text-slate-500">{c.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Edit popup */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Diente {editing}</h3>
              <button onClick={() => setEditing(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-lg">
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Interactive SVG tooth (large) */}
              <div className="flex flex-col items-center gap-1">
                <ToothSVG tooth={form} size={96} showLabels interactive={!form.condition} onSurface={cycleSurface} />
                {!form.condition && (
                  <p className="text-[10px] text-slate-400">Toca una superficie para ciclar condición</p>
                )}
              </div>

              {/* Surface quick-toggle buttons */}
              {!form.condition && (
                <div className="grid grid-cols-5 gap-1.5">
                  {SURFACES.map(s => {
                    const cond = form.surfaces?.[s] ?? "";
                    const c = SURF_CONDS[cond] ?? SURF_CONDS[""];
                    return (
                      <button key={s} onClick={() => cycleSurface(s)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
                        <span className="w-5 h-5 rounded" style={{ background: c.fill, border: `1.5px solid ${c.stroke}` }} />
                        <span className="text-[10px] font-bold text-slate-700">{s}</span>
                        <span className="text-[8px] text-slate-400 text-center leading-tight">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Whole-tooth condition selector */}
              <div>
                <label className="label">Condición del diente</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(WHOLE_CONDS).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, condition: k }))}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                        form.condition === k
                          ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}>
                      <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                        style={{ background: v.fill || "#f8fafc", border: `1.5px solid ${v.stroke || "#e2e8f0"}` }} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input resize-none text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas adicionales..." />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50">
              <button onClick={clearTooth} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                Limpiar diente
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
                <button onClick={saveTooth} className="btn-primary text-xs py-1.5 px-3">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
