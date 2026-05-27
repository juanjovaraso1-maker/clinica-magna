"use client";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";

/* ─── Data types ───────────────────────────────────────────────────────── */
interface ToothState { condition: string; surfaces: string[]; note: string }
interface HistEntry  { tooth: number; condition: string; surfaces: string[]; note: string; date: string; user: string }
interface ChartData  { teeth: Record<string, ToothState>; history: HistEntry[]; observations: string }

function normalize(raw: any): ChartData {
  if (raw && raw.teeth !== undefined)
    return { teeth: raw.teeth ?? {}, history: raw.history ?? [], observations: raw.observations ?? "" };
  const teeth: Record<string, ToothState> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const n = parseInt(k);
      if (!isNaN(n) && v && typeof v === "object")
        teeth[String(n)] = { condition: (v as any).condition ?? "", surfaces: [], note: (v as any).notes ?? "" };
    }
  }
  return { teeth, history: [], observations: "" };
}

/* ─── Conditions ────────────────────────────────────────────────────────── */
const CONDITIONS: Record<string, { label: string; fill: string; stroke: string; crownFill: string }> = {
  sano:             { label: "Sano",                       fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#FFFEF5" },
  caries:           { label: "Caries",                     fill: "#EF4444", stroke: "#EF4444", crownFill: "#FEE2E2" },
  sellante:         { label: "Sellante",                   fill: "#22C55E", stroke: "#22C55E", crownFill: "#DCFCE7" },
  amalgama:         { label: "Amalgama",                   fill: "#9CA3AF", stroke: "#6B7280", crownFill: "#E5E7EB" },
  composite:        { label: "Composite",                  fill: "#312E81", stroke: "#4338CA", crownFill: "#EEF2FF" },
  incrustacion:     { label: "Incrustación",               fill: "#0D9488", stroke: "#0D9488", crownFill: "#CCFBF1" },
  fractura:         { label: "Fractura Dentaria",          fill: "#EA580C", stroke: "#EA580C", crownFill: "#FFF7ED" },
  surco:            { label: "Surco Profundo",             fill: "#FBBF24", stroke: "#CA8A04", crownFill: "#FEFCE8" },
  endodoncia:       { label: "Endodoncia",                 fill: "#FFFFFF", stroke: "#6B7280", crownFill: "#F9FAFB" },
  ausente:          { label: "Pieza Ausente",              fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F3F4F6" },
  extraccion:       { label: "Extracción Indicada",        fill: "#FFFFFF", stroke: "#374151", crownFill: "#F3F4F6" },
  coronada:         { label: "Pieza Coronada",             fill: "#2563EB", stroke: "#2563EB", crownFill: "#DBEAFE" },
  implante:         { label: "Implante",                   fill: "#FFFFFF", stroke: "#16A34A", crownFill: "#F0FDF4" },
  lcnc:             { label: "Lesión Cervical No Cariosa", fill: "#FFFFFF", stroke: "#FB7185", crownFill: "#FFF1F2" },
  pulpotomia:       { label: "Pulpotomia",                 fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  pulpotomia_prev:  { label: "Pulpotomia previa",          fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  corona_acero:     { label: "Corona acero inoxidable",    fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  corona_acetato:   { label: "Corona acetato",             fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  fluoruro:         { label: "Fluoruro de plata",          fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  pulpectomia_prev: { label: "Pulpectomía previa",         fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
  pulpectomia:      { label: "Pulpectomía",                fill: "#FFFFFF", stroke: "#9CA3AF", crownFill: "#F9FAFB" },
};

/* ─── Tooth helpers ─────────────────────────────────────────────────────── */
function getToothType(num: number) {
  const pos = num % 10 || 10;
  if (pos <= 2) return "incisor";
  if (pos === 3) return "canine";
  if (pos <= 5) return "premolar";
  return "molar";
}

/* ─── Tooth SVG (crown at top, root at bottom) ───────────────────────────
   Upper jaw cells flip this via scaleY(-1) so crown faces the midline.   */
function ToothSVG({ num, condKey, selected }: { num: number; condKey?: string; selected?: boolean }) {
  const cond  = condKey ? CONDITIONS[condKey] : null;
  const type  = getToothType(num);
  const baby  = num >= 50;
  const sc    = baby ? 0.82 : 1;

  const cF  = cond?.crownFill ?? "#FFFEF5";
  const cS  = selected ? "#0057FF" : (cond?.stroke ?? "#D4BF8A");
  const rF  = (cond && cond.crownFill !== "#FFFEF5") ? cond.crownFill : "#FAF3E0";
  const rS  = cond?.stroke ?? "#C9B06A";
  const sw  = selected ? 2 : 1.2;
  const hasX = condKey === "ausente" || condKey === "extraccion";

  if (type === "incisor") {
    const [vw, vh, rw, rh] = [22, 46, 20, 40];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={Math.round(rw * sc)} height={Math.round(rh * sc)} style={{ display: "block" }}>
        <path d="M 8,22 Q 7,40 11,45 Q 15,40 14,22 Z" fill={rF} stroke={rS} strokeWidth={sw} />
        <rect x="1" y="2" width="20" height="20" rx="4" fill={cF} stroke={cS} strokeWidth={sw} />
        {hasX && <><line x1="3" y1="4" x2="19" y2="20" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /><line x1="19" y1="4" x2="3" y2="20" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /></>}
      </svg>
    );
  }

  if (type === "canine") {
    const [vw, vh, rw, rh] = [22, 50, 20, 44];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={Math.round(rw * sc)} height={Math.round(rh * sc)} style={{ display: "block" }}>
        <path d="M 8,26 Q 7,44 11,49 Q 15,44 14,26 Z" fill={rF} stroke={rS} strokeWidth={sw} />
        <path d="M 1,24 L 1,10 Q 2,2 11,2 Q 20,2 21,10 L 21,24 Q 21,26 11,26 Q 1,26 1,24 Z" fill={cF} stroke={cS} strokeWidth={sw} />
        {hasX && <><line x1="3" y1="4" x2="19" y2="22" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /><line x1="19" y1="4" x2="3" y2="22" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /></>}
      </svg>
    );
  }

  if (type === "premolar") {
    const [vw, vh, rw, rh] = [28, 48, 24, 42];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={Math.round(rw * sc)} height={Math.round(rh * sc)} style={{ display: "block" }}>
        <path d="M 7,23 Q 6,38 10,43 Q 13,38 12,23 Z" fill={rF} stroke={rS} strokeWidth={sw} />
        <path d="M 16,23 Q 15,38 19,43 Q 22,38 21,23 Z" fill={rF} stroke={rS} strokeWidth={sw} />
        <rect x="1" y="2" width="26" height="21" rx="4" fill={cF} stroke={cS} strokeWidth={sw} />
        <line x1="14" y1="2" x2="14" y2="11" stroke={cS} strokeWidth="0.8" />
        {hasX && <><line x1="3" y1="4" x2="25" y2="21" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /><line x1="25" y1="4" x2="3" y2="21" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /></>}
      </svg>
    );
  }

  // molar
  const [vw, vh, rw, rh] = [34, 48, 28, 42];
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={Math.round(rw * sc)} height={Math.round(rh * sc)} style={{ display: "block" }}>
      <path d="M 5,23 Q 4,38 9,44 Q 12,38 11,23 Z" fill={rF} stroke={rS} strokeWidth={sw} />
      <path d="M 23,23 Q 22,38 27,44 Q 30,38 29,23 Z" fill={rF} stroke={rS} strokeWidth={sw} />
      <rect x="1" y="2" width="32" height="21" rx="4" fill={cF} stroke={cS} strokeWidth={sw} />
      <line x1="12" y1="2" x2="12" y2="11" stroke={cS} strokeWidth="0.8" />
      <line x1="22" y1="2" x2="22" y2="11" stroke={cS} strokeWidth="0.8" />
      {hasX && <><line x1="3" y1="4" x2="31" y2="21" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /><line x1="31" y1="4" x2="3" y2="21" stroke={cS} strokeWidth="2.5" strokeLinecap="round" /></>}
    </svg>
  );
}

/* ─── Surface circle ─────────────────────────────────────────────────────── */
function SC({ lbl, on, cb }: { lbl: string; on: boolean; cb?: () => void }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); cb?.(); }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 13, height: 13, borderRadius: "50%",
        border: `1.5px solid ${on ? "#2563EB" : "#CBD5E1"}`,
        background: on ? "#2563EB" : "white",
        color: on ? "white" : "#94A3B8",
        fontSize: 6.5, fontWeight: 700,
        cursor: cb ? "pointer" : "default",
        flexShrink: 0, userSelect: "none" as const,
      }}
    >{lbl}</span>
  );
}

/* ─── Tooth cell ──────────────────────────────────────────────────────────
   upper=true  → SVG (crown-down via scaleY(-1)), number, surface circles
   upper=false → surface circles, number, SVG (crown-up, normal)          */
function ToothCell({ num, upper, state, selected, onTooth, onSurf, ro }: {
  num: number; upper: boolean;
  state?: ToothState; selected: boolean;
  onTooth: (n: number) => void;
  onSurf:  (n: number, s: string) => void;
  ro: boolean;
}) {
  const pos      = num % 10 || 10;
  const anterior = pos <= 3;
  const palLbl   = upper ? "P" : "L";
  const midSurf  = anterior ? "incisal" : "oclusal";
  const midLbl   = anterior ? "I" : "O";
  const surfs    = state?.surfaces ?? [];

  const surfBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
      <SC lbl="V"      on={surfs.includes("vestibular")} cb={ro ? undefined : () => onSurf(num, "vestibular")} />
      <div style={{ display: "flex", gap: 1.5 }}>
        <SC lbl="D"      on={surfs.includes("distal")}   cb={ro ? undefined : () => onSurf(num, "distal")} />
        <SC lbl={midLbl} on={surfs.includes(midSurf)}    cb={ro ? undefined : () => onSurf(num, midSurf)} />
        <SC lbl="M"      on={surfs.includes("mesial")}   cb={ro ? undefined : () => onSurf(num, "mesial")} />
      </div>
      <span style={{ fontSize: 7, fontWeight: 700, color: "#94A3B8", lineHeight: 1 }}>{palLbl}</span>
    </div>
  );

  const toothAndNum = (
    <div
      onClick={() => { if (!ro) onTooth(num); }}
      title={`Diente ${num}${state?.condition ? ` — ${CONDITIONS[state.condition]?.label}` : ""}`}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
        padding: "1px 1px", borderRadius: 4,
        background: selected ? "#EFF6FF" : "transparent",
        cursor: ro ? "default" : "pointer",
        userSelect: "none" as const,
      }}
    >
      <div style={{ transform: upper ? "scaleY(-1)" : undefined }}>
        <ToothSVG num={num} condKey={state?.condition || undefined} selected={selected} />
      </div>
      <span style={{ fontSize: 8.5, fontFamily: "monospace", lineHeight: 1,
        color: state?.condition ? "#1E293B" : "#94A3B8",
        fontWeight: state?.condition ? 700 : 400 }}>
        {num}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {upper ? toothAndNum : surfBlock}
      {upper ? surfBlock   : toothAndNum}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
interface Props {
  data: any;
  onChange: (d: any) => void;
  onSave?: () => void;
  isSaving?: boolean;
  readonly?: boolean;
}

export default function DentalChart({ data, onChange, onSave, isSaving, readonly: ro = false }: Props) {
  const { data: session } = useSession();
  const userName = ((session?.user as any)?.name as string) ?? "Usuario";
  const chart    = useMemo(() => normalize(data), [data]);

  const [tool, setTool] = useState("caries");
  const [sel,  setSel]  = useState<number | null>(null);

  function applyTooth(num: number) {
    if (ro) return;
    const key = String(num);
    const existing = chart.teeth[key];

    if (existing?.condition === tool && tool !== "sano") {
      const newTeeth = { ...chart.teeth };
      delete newTeeth[key];
      onChange({ ...chart, teeth: newTeeth });
      setSel(null);
      return;
    }

    const entry: HistEntry = {
      tooth: num, condition: tool,
      surfaces: existing?.surfaces ?? [], note: existing?.note ?? "",
      date: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }),
      user: userName.split(" ")[0],
    };
    onChange({
      ...chart,
      teeth: { ...chart.teeth, [key]: { condition: tool, surfaces: existing?.surfaces ?? [], note: existing?.note ?? "" } },
      history: [entry, ...chart.history].slice(0, 60),
    });
    setSel(num);
  }

  function toggleSurf(num: number, surf: string) {
    if (ro) return;
    const key = String(num);
    const existing = chart.teeth[key] ?? { condition: tool, surfaces: [], note: "" };
    const surfs = existing.surfaces.includes(surf)
      ? existing.surfaces.filter((s: string) => s !== surf)
      : [...existing.surfaces, surf];
    onChange({ ...chart, teeth: { ...chart.teeth, [key]: { ...existing, surfaces: surfs } } });
  }

  function handleSave() {
    onChange({ ...chart });
    onSave?.();
  }

  function handleClear() {
    if (!confirm("¿Limpiar todo el odontograma?")) return;
    onChange({ teeth: {}, history: chart.history, observations: chart.observations });
    setSel(null);
  }

  // Tooth rows — all 4 rows always visible (mixed dentition)
  const PU_R = [18,17,16,15,14,13,12,11];
  const PU_L = [21,22,23,24,25,26,27,28];
  const BU_R = [55,54,53,52,51];
  const BU_L = [61,62,63,64,65];
  const BL_R = [85,84,83,82,81];
  const BL_L = [71,72,73,74,75];
  const PL_R = [48,47,46,45,44,43,42,41];
  const PL_L = [31,32,33,34,35,36,37,38];

  function row(nums: number[], upper: boolean) {
    return nums.map(n => (
      <ToothCell key={n} num={n} upper={upper}
        state={chart.teeth[String(n)]}
        selected={sel === n}
        onTooth={applyTooth}
        onSurf={toggleSurf}
        ro={ro}
      />
    ));
  }

  // Vertical midline divider
  const VDIV = (
    <div style={{ width: 1.5, background: "#94A3B8", alignSelf: "stretch", margin: "0 4px", flexShrink: 0 }} />
  );
  // Baby row padding ≈ width of 3 permanent molar cells (28px each + 2px gap × 3 cells)
  const BPAD = <div style={{ width: 92, flexShrink: 0 }} />;

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

      {/* Title bar */}
      <div style={{ background: "#E8F5F0", borderBottom: "1px solid #C6E0D8", padding: "8px 14px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#15614A", margin: 0 }}>
          Odontograma de Diagnóstico en Nomenclatura Internacional
        </h2>
      </div>

      {/* Body */}
      <div style={{ display: "flex" }}>

        {/* Tooth grid */}
        <div style={{ flex: 1, padding: "12px 8px", overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 560 }}>

            {/* Row 1 — Permanent upper */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 2 }}>
              {row(PU_R, true)}{VDIV}{row(PU_L, true)}
            </div>

            {/* Row 2 — Baby upper */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 2 }}>
              {BPAD}{row(BU_R, true)}{VDIV}{row(BU_L, true)}{BPAD}
            </div>

            {/* Horizontal midline */}
            <div style={{ height: 1.5, background: "#94A3B8", margin: "2px 0", flexShrink: 0 }} />

            {/* Row 3 — Baby lower */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 2 }}>
              {BPAD}{row(BL_R, false)}{VDIV}{row(BL_L, false)}{BPAD}
            </div>

            {/* Row 4 — Permanent lower */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 2 }}>
              {row(PL_R, false)}{VDIV}{row(PL_L, false)}
            </div>

          </div>

          {/* Observations */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, margin: "0 0 6px" }}>
              Observaciones/Diagnóstico:
            </p>
            <textarea
              value={chart.observations ?? ""}
              onChange={e => onChange({ ...chart, observations: e.target.value })}
              disabled={ro}
              placeholder="Observaciones/Diagnóstico"
              rows={2}
              style={{
                width: "100%", fontSize: 12, color: "#374151",
                padding: "7px 10px", border: "1px solid #D1D5DB",
                borderRadius: 6, resize: "vertical",
                fontFamily: "inherit", outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        </div>

        {/* Right sidebar — condition selector */}
        {!ro && (
          <div style={{
            width: 200, flexShrink: 0,
            borderLeft: "1px solid #E5E7EB",
            background: "#F9FAFB",
            padding: "10px 10px",
            overflowY: "auto",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", margin: "0 0 8px" }}>
              Seleccione diagnóstico:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(CONDITIONS).map(([k, c]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio" name="dx" value={k}
                    checked={tool === k}
                    onChange={() => setTool(k)}
                    style={{ accentColor: "#2563EB", width: 13, height: 13, flexShrink: 0 }}
                  />
                  <span style={{
                    display: "inline-block", width: 13, height: 13, borderRadius: "50%",
                    background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.3 }}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!ro && (
        <div style={{
          borderTop: "1px solid #E5E7EB", padding: "10px 14px",
          display: "flex", justifyContent: "flex-end", gap: 8,
          background: "white",
        }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "7px 20px", borderRadius: 6, background: "#0EA5E9", color: "white", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Imprimir
          </button>
          <button
            onClick={handleClear}
            style={{ padding: "7px 20px", borderRadius: 6, background: "#16A34A", color: "white", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Nuevo Odontograma
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "7px 20px", borderRadius: 6, background: isSaving ? "#F87171" : "#DC2626", color: "white", fontSize: 13, fontWeight: 600, border: "none", cursor: isSaving ? "default" : "pointer" }}
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

// Legacy exports for backward compatibility
export type OdontogramData = any;
export const SURF_CONDS = {};
export const WHOLE_CONDS = {};
