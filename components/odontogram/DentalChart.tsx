"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";

// ─── Conditions ───────────────────────────────────────────────────────────────
const CONDITIONS: Record<string, { label: string; color: string; border: string; dot: string }> = {
  caries:     { label: "Caries",          color: "#FEE2E2", border: "#EF4444", dot: "#DC2626" },
  obturacion: { label: "Obturación",      color: "#DCFCE7", border: "#22C55E", dot: "#16A34A" },
  corona:     { label: "Corona",          color: "#FEF9C3", border: "#EAB308", dot: "#CA8A04" },
  ausente:    { label: "Ausente",         color: "#F3F4F6", border: "#9CA3AF", dot: "#6B7280" },
  implante:   { label: "Implante",        color: "#DBEAFE", border: "#3B82F6", dot: "#2563EB" },
  endodoncia: { label: "Endodoncia",      color: "#FFEDD5", border: "#F97316", dot: "#EA580C" },
  fractura:   { label: "Fractura",        color: "#FCE7F3", border: "#EC4899", dot: "#DB2777" },
  protesis:   { label: "Prótesis",        color: "#E7E5E4", border: "#78716C", dot: "#57534E" },
  extraccion: { label: "Extracción ind.", color: "#F3F4F6", border: "#374151", dot: "#111827" },
  manchas:    { label: "Manchas",         color: "#FEFCE8", border: "#EAB308", dot: "#92400E" },
};
const COND_KEYS = Object.keys(CONDITIONS);

// ─── Surfaces ─────────────────────────────────────────────────────────────────
const SURF_ROW1 = ["mesial", "oclusal", "distal"] as const;
const SURF_ROW2 = ["vestibular", "palatino", "cervical"] as const;
const ALL_SURFACES = [...SURF_ROW1, ...SURF_ROW2] as const;
type SurfKey = typeof ALL_SURFACES[number];

const SURF_LABEL: Record<SurfKey, string> = {
  mesial: "Mesial", oclusal: "Oclusal", distal: "Distal",
  vestibular: "Vestibular", palatino: "Palatino/Lingual", cervical: "Cervical",
};

// ─── Tooth sets ───────────────────────────────────────────────────────────────
const PERM_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERM_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const BABY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const BABY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

// ─── Internal data types ──────────────────────────────────────────────────────
interface ToothState { condition: string; surfaces: string[]; note: string; }
interface HistEntry  { tooth: number; condition: string; surfaces: string[]; note: string; date: string; user: string; }
interface ChartData  { teeth: Record<string, ToothState>; history: HistEntry[]; dentition: string; }

function normalize(raw: any): ChartData {
  if (raw && typeof raw === "object" && raw.teeth !== undefined) return raw as ChartData;
  const teeth: Record<string, ToothState> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const n = parseInt(k);
      if (!isNaN(n) && v && typeof v === "object") {
        teeth[String(n)] = {
          condition: (v as any).condition || "",
          surfaces: [],
          note: (v as any).notes || "",
        };
      }
    }
  }
  return { teeth, history: [], dentition: "permanent" };
}

// ─── Tooth SVG cell ───────────────────────────────────────────────────────────
function ToothCell({
  num, state, isSelected, flipped, onClick, readonly,
}: {
  num: number;
  state?: ToothState;
  isSelected: boolean;
  flipped?: boolean;
  onClick: () => void;
  readonly: boolean;
}) {
  const cond = state?.condition ? CONDITIONS[state.condition] : null;
  const hasX = state?.condition === "ausente" || state?.condition === "extraccion";

  const crown = (
    <svg viewBox="0 0 28 44" width="23" height="36" style={{ overflow: "visible" }}>
      {/* Root */}
      <path
        d="M 9,22 Q 8.5,36 11,42 Q 14,45 17,42 Q 19.5,36 19,22 Z"
        fill={cond ? cond.color : "#F8FAFC"}
        stroke={cond ? cond.border : "#CBD5E1"}
        strokeWidth="1"
      />
      {/* Crown body */}
      <rect x="2" y="2" width="24" height="20" rx="5"
        fill={cond ? cond.color : "#FFFFFF"}
        stroke={isSelected ? "#0057FF" : (cond ? cond.border : "#CBD5E1")}
        strokeWidth={isSelected ? "2.5" : "1"}
      />
      {/* Condition indicator dot */}
      {cond && !hasX && (
        <circle cx="14" cy="12" r="6" fill={cond.dot} opacity="0.28" />
      )}
      {/* X for absent / extraction */}
      {hasX && (
        <>
          <line x1="7" y1="5" x2="21" y2="19" stroke={cond!.dot} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="21" y1="5" x2="7"  y2="19" stroke={cond!.dot} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );

  return (
    <button
      onClick={onClick}
      disabled={readonly}
      title={`Diente ${num}${cond ? ` — ${cond.label}` : ""}${state?.note ? `: ${state.note}` : ""}`}
      className={`flex flex-col ${flipped ? "flex-col-reverse" : ""} items-center gap-0.5 p-0.5 rounded-[8px] transition-all ${
        readonly ? "cursor-default" : "cursor-pointer hover:bg-[#EEF3FF]"
      } ${isSelected ? "bg-[#EEF3FF]" : ""}`}
    >
      <div style={{ transform: flipped ? "scaleY(-1)" : undefined }}>{crown}</div>
      <span className={`text-[9px] font-mono leading-none ${cond ? "font-bold text-[#1A1D2E]" : "text-[#9AA0B4]"}`}>
        {num}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { data: any; onChange: (d: any) => void; readonly?: boolean; }

export default function DentalChart({ data, onChange, readonly }: Props) {
  const { data: session } = useSession();
  const userName = ((session?.user as any)?.name as string) || "Usuario";

  const chart = normalize(data);

  const [dentition, setDentition] = useState<"permanent" | "baby" | "mixed">(
    (chart.dentition as "permanent" | "baby" | "mixed") ?? "permanent"
  );
  const [activeTool, setActiveTool]   = useState("caries");
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [surfaces, setSurfaces]       = useState<string[]>([]);
  const [note, setNote]               = useState("");

  const upperTeeth = dentition === "baby" ? BABY_UPPER : PERM_UPPER;
  const lowerTeeth = dentition === "baby" ? BABY_LOWER : PERM_LOWER;
  const dentLabel  = dentition === "baby" ? "TEMPORAL" : "PERMANENTE";

  function selectTooth(n: number) {
    if (readonly) return;
    const existing = chart.teeth[String(n)];
    setSelectedNum(n);
    setSurfaces(existing?.surfaces ?? []);
    setNote(existing?.note ?? "");
    if (existing?.condition) setActiveTool(existing.condition);
  }

  function toggleSurface(s: string) {
    setSurfaces(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function saveTooth() {
    if (selectedNum === null) return;
    const entry: HistEntry = {
      tooth: selectedNum,
      condition: activeTool,
      surfaces,
      note,
      date: new Date().toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }),
      user: userName.split(" ")[0],
    };
    const newData: ChartData = {
      teeth: {
        ...chart.teeth,
        [String(selectedNum)]: { condition: activeTool, surfaces, note },
      },
      history: [entry, ...chart.history].slice(0, 60),
      dentition,
    };
    onChange(newData);
    setSelectedNum(null);
  }

  function clearOneTooth() {
    if (selectedNum === null) return;
    const newTeeth = { ...chart.teeth };
    delete newTeeth[String(selectedNum)];
    onChange({ ...chart, teeth: newTeeth, dentition });
    setSelectedNum(null);
  }

  function clearAll() {
    if (!confirm("¿Limpiar todo el odontograma? Esta acción no se puede deshacer.")) return;
    onChange({ teeth: {}, history: chart.history, dentition });
    setSelectedNum(null);
  }

  return (
    <div className="flex gap-4 items-start">

      {/* ── Left: main chart ── */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Dentition toggle + Guardar row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5">
            {(["permanent", "baby", "mixed"] as const).map(d => (
              <button key={d}
                onClick={() => { setDentition(d); setSelectedNum(null); }}
                className={`text-[12px] font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                  dentition === d
                    ? "bg-[#0057FF] text-white border-[#0057FF]"
                    : "bg-white text-[#4B5563] border-[#E3E8F0] hover:bg-[#F0F2F7]"
                }`}
              >
                {d === "permanent" ? "Dentición permanente"
                  : d === "baby"  ? "Dentición temporal (leche)"
                  :                 "Mixta"}
              </button>
            ))}
          </div>
        </div>

        {/* States legend bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-white border border-[#E3E8F0] rounded-[10px]">
          <span className="text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide">ESTADOS:</span>
          {COND_KEYS.map(k => {
            const c = CONDITIONS[k];
            return (
              <span key={k} className="flex items-center gap-1 text-[11px] text-[#4B5563]">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
                {c.label}
              </span>
            );
          })}
        </div>

        {/* Tooth grid */}
        <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-4 shadow-sm">
          <div className="overflow-x-auto">
            <div className={`space-y-4 ${dentition === "baby" ? "min-w-[300px]" : "min-w-[480px]"}`}>

              {/* ─ Upper jaw ─ */}
              <div>
                <p className="text-[10px] font-bold text-[#9AA0B4] tracking-widest text-center uppercase mb-2">
                  MAXILAR SUPERIOR — {dentLabel}
                </p>
                <div className="flex items-center justify-center gap-0.5 mb-1">
                  <span className="flex-1 text-right pr-3 text-[9px] font-bold text-[#C4C9D6] uppercase tracking-wide">DERECHA</span>
                  <span className="w-px h-3 bg-[#E3E8F0]" />
                  <span className="flex-1 text-left pl-3 text-[9px] font-bold text-[#C4C9D6] uppercase tracking-wide">IZQUIERDA</span>
                </div>
                <div className="flex justify-center items-end gap-0.5">
                  {upperTeeth.slice(0, upperTeeth.length / 2).map(n => (
                    <ToothCell key={n} num={n}
                      state={chart.teeth[String(n)]}
                      isSelected={selectedNum === n}
                      onClick={() => selectTooth(n)}
                      readonly={!!readonly}
                    />
                  ))}
                  <div className="w-px h-12 bg-[#E3E8F0] mx-1 mb-6 self-end" />
                  {upperTeeth.slice(upperTeeth.length / 2).map(n => (
                    <ToothCell key={n} num={n}
                      state={chart.teeth[String(n)]}
                      isSelected={selectedNum === n}
                      onClick={() => selectTooth(n)}
                      readonly={!!readonly}
                    />
                  ))}
                </div>
              </div>

              {/* Midline */}
              <div className="border-t-2 border-dashed border-[#E3E8F0]" />

              {/* ─ Lower jaw ─ */}
              <div>
                <div className="flex justify-center items-start gap-0.5">
                  {lowerTeeth.slice(0, lowerTeeth.length / 2).map(n => (
                    <ToothCell key={n} num={n}
                      state={chart.teeth[String(n)]}
                      isSelected={selectedNum === n}
                      onClick={() => selectTooth(n)}
                      readonly={!!readonly}
                      flipped
                    />
                  ))}
                  <div className="w-px h-12 bg-[#E3E8F0] mx-1 mt-6 self-start" />
                  {lowerTeeth.slice(lowerTeeth.length / 2).map(n => (
                    <ToothCell key={n} num={n}
                      state={chart.teeth[String(n)]}
                      isSelected={selectedNum === n}
                      onClick={() => selectTooth(n)}
                      readonly={!!readonly}
                      flipped
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <span className="flex-1 text-right pr-3 text-[9px] font-bold text-[#C4C9D6] uppercase tracking-wide">DERECHA</span>
                  <span className="w-px h-3 bg-[#E3E8F0]" />
                  <span className="flex-1 text-left pl-3 text-[9px] font-bold text-[#C4C9D6] uppercase tracking-wide">IZQUIERDA</span>
                </div>
                <p className="text-[10px] font-bold text-[#9AA0B4] tracking-widest text-center uppercase mt-2">
                  MANDÍBULA INFERIOR — {dentLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom hint + Limpiar todo */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0F2F7]">
            <p className="text-[11px] text-[#9AA0B4]">
              💡 Haz clic en cualquier diente para editar su estado
            </p>
            {!readonly && (
              <button onClick={clearAll}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors">
                Limpiar todo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: tool panel ── */}
      {!readonly && (
        <div className="w-[196px] flex-shrink-0 space-y-3">

          {/* Active tool selector */}
          <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-3 shadow-sm">
            <p className="text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-2">HERRAMIENTA ACTIVA</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COND_KEYS.map(k => {
                const c = CONDITIONS[k];
                const active = activeTool === k;
                return (
                  <button key={k}
                    onClick={() => setActiveTool(k)}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1.5 rounded-[8px] border transition-all ${
                      active ? "text-white shadow-sm" : "bg-white text-[#4B5563] border-[#E3E8F0] hover:bg-[#F0F2F7]"
                    }`}
                    style={active ? { backgroundColor: c.dot, borderColor: c.dot } : {}}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: active ? "rgba(255,255,255,0.65)" : c.dot }} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={clearOneTooth}
              disabled={selectedNum === null}
              className="w-full mt-2 text-[11px] font-medium px-2 py-1.5 rounded-[8px] border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✕ Limpiar diente
            </button>
          </div>

          {/* Selected tooth detail */}
          {selectedNum !== null && (
            <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-3 shadow-sm">
              <p className="text-[12px] font-bold text-[#1A1D2E] mb-2">DIENTE #{selectedNum}</p>

              <div className="mb-3">
                <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-0.5">ESTADO</p>
                <p className="text-[15px] font-bold" style={{ color: CONDITIONS[activeTool]?.dot }}>
                  {CONDITIONS[activeTool]?.label}
                </p>
              </div>

              <div className="mb-3">
                <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">SUPERFICIES AFECTADAS</p>
                <div className="space-y-1">
                  <div className="grid grid-cols-3 gap-1">
                    {SURF_ROW1.map(s => (
                      <button key={s}
                        onClick={() => toggleSurface(s)}
                        className={`text-[10px] font-medium py-1 rounded-[6px] border transition-colors ${
                          surfaces.includes(s)
                            ? "bg-[#0057FF] text-white border-[#0057FF]"
                            : "bg-white text-[#4B5563] border-[#E3E8F0] hover:bg-[#F0F2F7]"
                        }`}
                      >
                        {SURF_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {SURF_ROW2.map(s => (
                      <button key={s}
                        onClick={() => toggleSurface(s)}
                        className={`text-[10px] font-medium py-1 rounded-[6px] border transition-colors ${
                          surfaces.includes(s)
                            ? "bg-[#0057FF] text-white border-[#0057FF]"
                            : "bg-white text-[#4B5563] border-[#E3E8F0] hover:bg-[#F0F2F7]"
                        }`}
                      >
                        {s === "palatino" ? "Pal./Ling." : SURF_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1">NOTA CLÍNICA</p>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ej: Caries oclusal profunda con compromiso dentinario..."
                  className="w-full text-[11px] border border-[#E3E8F0] rounded-[8px] px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#0057FF] text-[#1A1D2E] placeholder:text-[#C4C9D6]"
                />
              </div>

              <button
                onClick={saveTooth}
                className="w-full text-[12px] font-bold py-2 rounded-[8px] bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors"
              >
                Guardar
              </button>
            </div>
          )}

          {/* History */}
          {chart.history.length > 0 && (
            <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-3 shadow-sm">
              <p className="text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-2">Historial de cambios</p>
              <div className="space-y-2">
                {chart.history.slice(0, 8).map((h, i) => {
                  const surfAbbrv = h.surfaces.length > 0
                    ? " " + h.surfaces.map(s => SURF_LABEL[s as SurfKey]?.[0] ?? s[0]).join("").toUpperCase()
                    : "";
                  return (
                    <div key={i} className={`pb-2 ${i < Math.min(7, chart.history.length - 1) ? "border-b border-[#F0F2F7]" : ""}`}>
                      <p className="text-[11px] font-semibold text-[#1A1D2E] leading-snug">
                        #{h.tooth} — {CONDITIONS[h.condition]?.label ?? h.condition}{surfAbbrv}
                      </p>
                      <p className="text-[10px] text-[#9AA0B4]">{h.date} · {h.user}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// Keep legacy exports so other files that import them don't break
export type OdontogramData = any;
export const SURF_CONDS = {};
export const WHOLE_CONDS = {};
