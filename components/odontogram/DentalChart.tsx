"use client";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Printer, ChevronDown } from "lucide-react";
import { ToothPNG } from "./ToothPNG";

/* ─── Tipos ─────────────────────────────────────────────────────────── */
interface SurfaceState { cond: string }
interface ToothState   { wholeCond: string; surfaces: Record<string, SurfaceState>; note: string }
interface ChartData    { teeth: Record<string, ToothState>; observations: string }

export interface OdoRecord {
  id: string;
  date: string;
  type: string;
  data: ChartData;
}

interface Props {
  records:   OdoRecord[];
  onSave:    (data: ChartData, recordId: string | null, type: string) => Promise<void>;
  onDelete?: (recordId: string) => Promise<void>;
  isSaving?: boolean;
  readonly?: boolean;
}

/* ─── Condiciones ────────────────────────────────────────────────────── */
const CONDITIONS: Record<string, { label: string; color: string; bg: string }> = {
  sano:          { label: "Sano / Sin patología",        color: "#9CA3AF", bg: "#F3F4F6" },
  caries:        { label: "Caries",                       color: "#E24B4A", bg: "#FEE2E2" },
  obturacion:    { label: "Obturación",                   color: "#3B82F6", bg: "#DBEAFE" },
  sellante:      { label: "Sellante",                     color: "#86EFAC", bg: "#DCFCE7" },
  endodoncia:    { label: "Endodoncia",                   color: "#A855F7", bg: "#F3E8FF" },
  corona:        { label: "Corona",                       color: "#F59E0B", bg: "#FEF3C7" },
  implante:      { label: "Implante",                     color: "#10B981", bg: "#D1FAE5" },
  ausente:       { label: "Pieza ausente",                color: "#94A3B8", bg: "#F1F5F9" },
  extraccion:    { label: "Extracción indicada",          color: "#991B1B", bg: "#FEF2F2" },
  fractura:      { label: "Fractura dentaria",            color: "#F97316", bg: "#FFF7ED" },
  amalgama:      { label: "Amalgama",                     color: "#6B7280", bg: "#F1F5F9" },
  incrustacion:  { label: "Incrustación",                 color: "#06B6D4", bg: "#CFFAFE" },
  composite:     { label: "Composite",                    color: "#EC4899", bg: "#FCE7F3" },
  lcnc:          { label: "Lesión cervical no cariosa",   color: "#DB2777", bg: "#FDF2F8" },
  hipoplasia:    { label: "Hipoplasia / Fluorosis",       color: "#CA8A04", bg: "#FEFCE8" },
  movilidad:     { label: "Movilidad",                    color: "#8B5CF6", bg: "#EDE9FE" },
  pulpotomia:    { label: "Pulpotomía",                   color: "#9D174D", bg: "#FDF2F8" },
  corona_acero:  { label: "Corona acero inox.",           color: "#78350F", bg: "#FEF3C7" },
  fluoruro:      { label: "Fluoruro de plata",            color: "#0EA5E9", bg: "#E0F2FE" },
  impactado:     { label: "Impactado / Retenido",         color: "#1E3A8A", bg: "#EFF6FF" },
  supernumerario:{ label: "Supernumerario",               color: "#059669", bg: "#ECFDF5" },
};

const COND_KEYS = Object.keys(CONDITIONS);
const SURFACES  = ["V","M","O","D","P"];

/* ─── Distribución de dientes ────────────────────────────────────────── */
const PERM_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const PERM_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const TEMP_UPPER = [55,54,53,52,51,61,62,63,64,65];
const TEMP_LOWER = [85,84,83,82,81,71,72,73,74,75];

const SEXTANT_TEETH: Record<string, number[]> = {
  S1: [18,17,16,15,14],
  S2: [13,12,11,21,22,23],
  S3: [24,25,26,27,28],
  S4: [38,37,36,35,34],
  S5: [33,32,31,41,42,43],
  S6: [44,45,46,47,48],
};

function emptyChart(): ChartData { return { teeth: {}, observations: "" }; }


function fmtTooth(n: number): string {
  const q = Math.floor(n / 10);
  return `${q}.${n % 10}`;
}

function isUpper(num: number): boolean {
  const q = Math.floor(num / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}


/* ─── Diagrama circular de superficies (5 cuñas) ─────────────────────── */
function SurfaceDiagram({ num, toothState, selSurf, onSurf, readonly }: {
  num: number; toothState?: ToothState; selSurf?: string|null;
  onSurf?: (s:string)=>void; readonly?: boolean;
  // wholeCond passed implicitly via toothState.wholeCond
}) {
  const upper = isUpper(num);
  const size = 26, cx = 13, cy = 13, r = 11, ri = 4.5;
  const renderSize = 38;

  function wedgePath(a1: number, a2: number): string {
    const rad = (d: number) => (d * Math.PI) / 180;
    const x1=cx+r*Math.cos(rad(a1)), y1=cy+r*Math.sin(rad(a1));
    const x2=cx+r*Math.cos(rad(a2)), y2=cy+r*Math.sin(rad(a2));
    const xi1=cx+ri*Math.cos(rad(a1)), yi1=cy+ri*Math.sin(rad(a1));
    const xi2=cx+ri*Math.cos(rad(a2)), yi2=cy+ri*Math.sin(rad(a2));
    return `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 0 0 ${xi1} ${yi1} Z`;
  }

  const wedges = [
    { key:"V", path:wedgePath(-112,-68), lx:cx,     ly:cy-8.2 },
    { key:"D", path:wedgePath(-68,  22), lx:cx+8.2, ly:cy     },
    { key:"P", path:wedgePath( 22, 112), label: upper?"P":"L", lx:cx,     ly:cy+8.2 },
    { key:"M", path:wedgePath(112, 202), lx:cx-8.2, ly:cy     },
  ];

  function cc(surf: string) {
    const sc = toothState?.surfaces?.[surf];
    return sc?.cond ? CONDITIONS[sc.cond] : null;
  }

  const wholeCond = toothState?.wholeCond && toothState.wholeCond !== "sano" ? CONDITIONS[toothState.wholeCond] : null;

  return (
    <svg width={renderSize} height={renderSize} viewBox={`0 0 ${size} ${size}`} style={{display:"block"}}>
      <circle cx={cx} cy={cy} r={r} fill={wholeCond ? `${wholeCond.color}22` : "white"} stroke={wholeCond ? wholeCond.color : "#D4C8B8"} strokeWidth={wholeCond ? "1.5" : "0.8"}/>
      {wedges.map(w => {
        const c = cc(w.key); const isSel = selSurf===w.key;
        const lbl = (w as any).label ?? w.key;
        return (
          <g key={w.key}>
            <path d={w.path} fill={c?c.color:(isSel?"#2563EB":"#F0EBE3")} stroke={c?c.color:(isSel?"#2563EB":"#C8B89A")} strokeWidth="0.5"
              className={readonly?"":"cursor-pointer hover:brightness-95 transition-all"}
              onClick={()=>!readonly&&onSurf?.(w.key)}>
              <title>{lbl}{c?` — ${c.label}`:""}</title>
            </path>
            <text x={w.lx} y={w.ly} textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fontWeight="700"
              fill={c?"white":(isSel?"white":"#8B7D6E")} style={{pointerEvents:"none",userSelect:"none"}}>{lbl}</text>
          </g>
        );
      })}
      {/* Center O */}
      {(() => { const c=cc("O"); const isSel=selSurf==="O"; return (
        <g>
          <circle cx={cx} cy={cy} r={ri} fill={c?c.color:(isSel?"#2563EB":"white")} stroke={c?c.color:(isSel?"#2563EB":"#C8B89A")} strokeWidth="0.7"
            className={readonly?"":"cursor-pointer hover:brightness-95"} onClick={()=>!readonly&&onSurf?.("O")}>
            <title>O{c?` — ${c.label}`:""}</title>
          </circle>
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fontWeight="700"
            fill={c?"white":(isSel?"white":"#8B7D6E")} style={{pointerEvents:"none",userSelect:"none"}}>O</text>
        </g>
      );})()}
    </svg>
  );
}

/* ─── Celda de diente ────────────────────────────────────────────────── */
function ToothCell({ num, chart, upper, selTooth, selSurf, onTooth, onSurf, readonly }: {
  num:number; chart:ChartData; upper:boolean; selTooth:number|null; selSurf:string|null;
  onTooth:(n:number)=>void; onSurf:(n:number,s:string)=>void; readonly?:boolean;
}) {
  const key   = String(num);
  const state = chart.teeth[key];
  const isSel = selTooth === num;
  const cond  = state?.wholeCond && state.wholeCond !== "sano" ? CONDITIONS[state.wholeCond] : null;

  const svg = (
    <div
      className={`w-full rounded-sm transition-all ${isSel?"ring-2 ring-blue-500 ring-offset-1 bg-blue-50/60":"hover:bg-amber-50/40"} ${readonly?"pointer-events-none":"cursor-pointer"}`}
      onClick={() => !readonly && onTooth(num)}
    >
      <ToothPNG num={num} wholeCond={state?.wholeCond} condColor={cond?.color}/>
    </div>
  );
  const diag = (
    <SurfaceDiagram num={num} toothState={state}
      selSurf={isSel ? selSurf : null}
      onSurf={s => !readonly && onSurf(num,s)}
      readonly={readonly}/>
  );
  const label = (
    <span className={`text-[11px] font-bold select-none leading-none ${isSel?"text-blue-600":"text-stone-400"}`}>
      {fmtTooth(num)}
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-[4px] w-full">
      {upper ? <>{svg}{diag}{label}</> : <>{label}{diag}{svg}</>}
    </div>
  );
}

/* ─── SVG Ilustración de arcada dental (vista oclusal) ─────────────── */
function ArchIllustration({ type }: { type: "full"|"upper"|"lower" }) {
  /* Teeth positions along the arches */
  const upperTeeth = [
    {x:14,y:22,w:5,h:7},{x:20,y:18,w:5,h:7},{x:27,y:14,w:5,h:7},{x:34,y:11,w:5,h:7},
    {x:41,y:9, w:4,h:6},{x:47,y:8, w:4,h:6},{x:52,y:8, w:4,h:6},{x:57,y:9, w:4,h:6},
    {x:62,y:11,w:5,h:7},{x:68,y:14,w:5,h:7},{x:74,y:18,w:5,h:7},{x:80,y:22,w:5,h:7},
  ];
  const lowerTeeth = [
    {x:16,y:2, w:5,h:7},{x:22,y:6, w:5,h:7},{x:29,y:10,w:5,h:7},{x:36,y:13,w:5,h:7},
    {x:43,y:15,w:4,h:6},{x:49,y:16,w:4,h:6},{x:54,y:16,w:4,h:6},{x:59,y:15,w:4,h:6},
    {x:63,y:13,w:5,h:7},{x:70,y:10,w:5,h:7},{x:77,y:6, w:5,h:7},{x:83,y:2, w:5,h:7},
  ];

  const showU = type==="full"||type==="upper";
  const showL = type==="full"||type==="lower";
  const h = type==="full" ? 58 : 32;
  const lOffset = type==="full" ? 30 : 2;

  return (
    <svg viewBox={`0 0 99 ${h}`} width={72} height={h*0.85} style={{display:"block"}}>
      {/* Upper arch */}
      {showU && (
        <g opacity={1}>
          <path d="M11,30 C9,14 22,2 49.5,2 C77,2 90,14 88,30" fill="none" stroke="#7BAFD4" strokeWidth="8" strokeLinecap="round"/>
          {upperTeeth.map((t,i)=>(
            <rect key={i} x={t.x} y={t.y-1} width={t.w+1} height={t.h+1} rx="1.5"
              fill="white" stroke="#7BAFD4" strokeWidth="0.8"/>
          ))}
        </g>
      )}
      {/* Lower arch */}
      {showL && (
        <g transform={`translate(0,${lOffset})`} opacity={1}>
          <path d="M13,2 C11,18 24,28 49.5,28 C75,28 88,18 86,2" fill="none" stroke="#9B7DB0" strokeWidth="8" strokeLinecap="round"/>
          {lowerTeeth.map((t,i)=>(
            <rect key={i} x={t.x} y={t.y+2} width={t.w+1} height={t.h+1} rx="1.5"
              fill="white" stroke="#9B7DB0" strokeWidth="0.8"/>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ─── Componente principal ───────────────────────────────────────────── */
export default function DentalChart({ records, onSave, onDelete, isSaving, readonly }: Props) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const permRecs = useMemo(() => records.filter(r=>r.type==="permanent").sort((a,b)=>b.date.localeCompare(a.date)), [records]);
  const tempRecs = useMemo(() => records.filter(r=>r.type==="temporary").sort((a,b)=>b.date.localeCompare(a.date)), [records]);

  const [teethType,  setTeethType]  = useState<"permanent"|"temporary">("permanent");
  const [selId,      setSelId]      = useState<string|null>(permRecs[0]?.id ?? null);
  const [chart,      setChart]      = useState<ChartData>(() => permRecs[0]?.data ?? emptyChart());
  const [selTooth,   setSelTooth]   = useState<number|null>(null);
  const [selSurf,    setSelSurf]    = useState<string|null>(null);
  const [selCond,    setSelCond]    = useState("caries");
  const [mode,       setMode]       = useState<"diag"|"info">("diag");
  /* view = highlight focus, NOT filter. All teeth always visible. */
  const [view,       setView]       = useState<"full"|"upper"|"lower">("full");
  const [selSextant, setSelSextant] = useState<string|null>(null);

  const currentRecs = teethType === "permanent" ? permRecs : tempRecs;
  const upper = teethType === "permanent" ? PERM_UPPER : TEMP_UPPER;
  const lower = teethType === "permanent" ? PERM_LOWER : TEMP_LOWER;

  function switchType(t: "permanent"|"temporary") {
    const recs = t === "permanent" ? permRecs : tempRecs;
    setTeethType(t);
    if (recs.length > 0) { setSelId(recs[0].id); setChart(recs[0].data); }
    else { setSelId(null); setChart(emptyChart()); }
    setSelTooth(null);
  }

  function selectRecord(id: string) {
    const r = records.find(r => r.id === id);
    if (!r) return;
    setSelId(id); setChart(r.data); setSelTooth(null);
  }

  function handleToothClick(num: number) {
    if (mode !== "diag") return;
    const key = String(num);
    setChart(prev => {
      const ex = prev.teeth[key] ?? { wholeCond:"", surfaces:{}, note:"" };
      return { ...prev, teeth: { ...prev.teeth, [key]: { ...ex, wholeCond: ex.wholeCond===selCond?"":selCond } } };
    });
    setSelTooth(num);
    setSelSurf(null);
  }

  function handleSurfClick(num: number, surf: string) {
    if (mode !== "diag") return;
    const key = String(num);
    setChart(prev => {
      const ex  = prev.teeth[key] ?? { wholeCond:"", surfaces:{}, note:"" };
      const cur = ex.surfaces[surf]?.cond ?? "";
      return { ...prev, teeth: { ...prev.teeth, [key]: { ...ex, surfaces: { ...ex.surfaces, [surf]: { cond: cur===selCond?"":selCond } } } } };
    });
    setSelTooth(num); setSelSurf(surf);
  }

  async function handleNewOdontogram() {
    setSelId(null); setChart(emptyChart()); setSelTooth(null);
    await onSave(emptyChart(), null, teethType);
  }

  async function handleDeleteRecord() {
    if (!selId || !onDelete) return;
    if (!confirm("¿Eliminar este odontograma? Esta acción no se puede deshacer.")) return;
    await onDelete(selId);
    const remaining = currentRecs.filter(r => r.id !== selId);
    if (remaining.length > 0) { setSelId(remaining[0].id); setChart(remaining[0].data); }
    else { setSelId(null); setChart(emptyChart()); }
  }

  const selState = selTooth ? chart.teeth[String(selTooth)] : null;

  /* Compute dimming: dim if view restricts and tooth is in the "other" arch */
  function toothOpacity(num: number): number {
    const up = isUpper(num);
    if (selSextant) {
      return SEXTANT_TEETH[selSextant]?.includes(num) ? 1 : 0.2;
    }
    if (view === "upper") return up ? 1 : 0.25;
    if (view === "lower") return up ? 0.25 : 1;
    return 1;
  }

  const VIEW_OPTIONS: Array<{ k: "full"|"upper"|"lower"; label: string }> = [
    { k:"full",  label:"Boca completa"    },
    { k:"upper", label:"Maxilar superior" },
    { k:"lower", label:"Maxilar inferior" },
  ];

  return (
    <div className="bg-white border border-[#E3E8F0] rounded-2xl overflow-hidden shadow-sm">

      {/* ── Barra superior ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#E3E8F0] bg-[#F8F9FC] flex-wrap">
        <div className="flex rounded-lg border border-[#E3E8F0] overflow-hidden flex-shrink-0">
          {([["permanent","Permanente"],["temporary","Temporal"]] as [string,string][]).map(([k,label]) => {
            const cnt = (k==="permanent" ? permRecs : tempRecs).length;
            return (
              <button key={k} onClick={() => switchType(k as any)}
                className={`px-3 py-1.5 text-[12px] font-semibold transition-colors flex items-center gap-1.5 ${teethType===k?"bg-[#0057FF] text-white":"text-[#4B5563] hover:bg-[#F0F2F7]"}`}>
                {label}
                {cnt>0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${teethType===k?"bg-white/20 text-white":"bg-[#E3E8F0] text-[#4B5563]"}`}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        {currentRecs.length > 0 && (
          <div className="relative flex-shrink-0">
            <select className="appearance-none text-[12px] border border-[#E3E8F0] rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white text-[#1A1D2E] font-medium cursor-pointer"
              value={selId ?? ""} onChange={e => selectRecord(e.target.value)}>
              {currentRecs.map(r => (
                <option key={r.id} value={r.id}>
                  {new Date(r.date+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"})}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9AA0B4] pointer-events-none"/>
          </div>
        )}

        {!readonly && (
          <div className="flex rounded-lg border border-[#E3E8F0] overflow-hidden flex-shrink-0">
            <button onClick={() => setMode("diag")}
              className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${mode==="diag"?"bg-[#1A1D2E] text-white":"text-[#4B5563] hover:bg-[#F0F2F7]"}`}>
              Diagnóstico
            </button>
            <button onClick={() => setMode("info")}
              className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${mode==="info"?"bg-[#1A1D2E] text-white":"text-[#4B5563] hover:bg-[#F0F2F7]"}`}>
              Información
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {!readonly && (
            <button onClick={handleNewOdontogram}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
              <Plus size={13}/> Nuevo
            </button>
          )}
          {!readonly && isAdmin && selId && onDelete && (
            <button onClick={handleDeleteRecord}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 border border-red-100 transition-colors">
              <Trash2 size={13}/>
            </button>
          )}
          <button onClick={() => window.print()}
            className="p-1.5 rounded-lg hover:bg-[#F0F2F7] text-[#9AA0B4] transition-colors border border-[#E3E8F0]">
            <Printer size={14}/>
          </button>
        </div>
      </div>

      {/* ── Selector de vista (con ilustraciones) + Sextantes ── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#F0F2F7] bg-[#FAFBFD] flex-wrap">
        {/* Vista — illustraciones de arcada */}
        <div className="flex items-center gap-1.5">
          {VIEW_OPTIONS.map(({ k, label }) => (
            <button key={k} onClick={() => { setView(k); setSelSextant(null); }}
              className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all ${
                view===k && !selSextant
                  ? "bg-[#EEF3FF] border-[#0057FF] text-[#0057FF]"
                  : "border-[#E3E8F0] text-[#6B7280] hover:border-[#C7D2FE] hover:bg-[#F0F2F7]"
              }`}>
              <ArchIllustration type={k}/>
              <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {/* Sextantes S1-S6 */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mr-0.5">Sextante:</span>
          {["S1","S2","S3","S4","S5","S6"].map(s => (
            <button key={s} onClick={() => { setSelSextant(prev => prev===s?null:s); }}
              className={`w-10 h-8 text-[12px] font-bold rounded-lg border transition-all ${
                selSextant===s
                  ? "bg-[#0057FF] text-white border-[#0057FF]"
                  : "bg-white text-[#4B5563] border-[#E3E8F0] hover:border-[#0057FF]/40 hover:text-[#0057FF]"
              }`}>
              {s}
            </button>
          ))}
          {selSextant && (
            <button onClick={()=>setSelSextant(null)}
              className="text-[11px] text-[#9AA0B4] hover:text-red-500 ml-0.5 px-1.5">✕</button>
          )}
        </div>
      </div>

      {/* Título */}
      <div className="text-center py-1.5 border-b border-[#F0F2F7] bg-white">
        <span className="text-[10px] font-bold text-[#9AA0B4] tracking-widest uppercase">Odontograma Internacional FDI</span>
      </div>

      {/* ── Grilla de dientes + panel ── */}
      <div>
      <div className="flex">
        <div className="flex-1 min-w-0 py-3 px-2 bg-white">
          {/* Superior — distribuidos en todo el ancho */}
          <div style={{display:"grid", gridTemplateColumns:`repeat(${upper.length}, 1fr)`, gap:"2px", alignItems:"end"}} className="mb-1 px-1">
            {upper.map((num) => (
              <div key={num} className="transition-opacity" style={{opacity: toothOpacity(num)}}>
                <ToothCell num={num} chart={chart} upper={true}
                  selTooth={selTooth} selSurf={selSurf}
                  onTooth={handleToothClick} onSurf={handleSurfClick}
                  readonly={readonly||mode!=="diag"}/>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-dashed border-[#E8E0D4] mx-2 my-3"/>
          {/* Inferior — distribuidos en todo el ancho */}
          <div style={{display:"grid", gridTemplateColumns:`repeat(${lower.length}, 1fr)`, gap:"2px", alignItems:"start"}} className="mt-1 px-1">
            {lower.map((num) => (
              <div key={num} className="transition-opacity" style={{opacity: toothOpacity(num)}}>
                <ToothCell num={num} chart={chart} upper={false}
                  selTooth={selTooth} selSurf={selSurf}
                  onTooth={handleToothClick} onSurf={handleSurfClick}
                  readonly={readonly||mode!=="diag"}/>
              </div>
            ))}
          </div>
        </div>

        {/* Panel condiciones */}
        {!readonly && mode==="diag" && (
          <div className="w-[200px] flex-shrink-0 border-l border-[#E3E8F0] overflow-y-auto bg-[#FAFBFD]" style={{maxHeight:460}}>
            <div className="px-2.5 pt-2.5 pb-2">
              <p className="text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-2">Condición activa</p>
              {COND_KEYS.map(k => {
                const c = CONDITIONS[k];
                return (
                  <button key={k} onClick={() => setSelCond(k)}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg mb-0.5 text-[11.5px] font-medium transition-all border ${selCond===k?"font-bold border-current":"border-transparent hover:bg-[#F0F2F7] text-[#4B5563]"}`}
                    style={selCond===k ? {backgroundColor:`${c.color}15`, color:c.color} : {}}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel info diente seleccionado */}
        {!readonly && mode==="info" && selTooth && (
          <div className="w-[190px] flex-shrink-0 border-l border-[#E3E8F0] p-3 bg-[#FAFBFD]">
            <p className="text-[12px] font-bold text-[#1A1D2E] mb-3">Diente {fmtTooth(selTooth)}</p>
            <p className="text-[10px] text-[#9AA0B4] font-semibold uppercase tracking-wide mb-1">Condición general</p>
            <p className="text-[12px] font-medium text-[#1A1D2E] mb-3">
              {selState?.wholeCond ? (CONDITIONS[selState.wholeCond]?.label ?? selState.wholeCond) : "Sano"}
            </p>
            <p className="text-[10px] text-[#9AA0B4] font-semibold uppercase tracking-wide mb-1.5">Superficies</p>
            {SURFACES.map(s => {
              const sc = selState?.surfaces?.[s]?.cond;
              if (!sc) return null;
              return (
                <div key={s} className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:CONDITIONS[sc]?.color}}/>
                  <span className="text-[11px] text-[#4B5563]">{s} — {CONDITIONS[sc]?.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* ── Leyenda ── */}
      <div className="border-t border-[#F0F2F7] px-4 py-2 flex flex-wrap gap-3 bg-[#FAFBFD]">
        {["caries","obturacion","endodoncia","sellante","corona","ausente","fractura","amalgama"].map(k => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{backgroundColor:CONDITIONS[k].color}}/>
            <span className="text-[10px] text-[#9AA0B4]">{CONDITIONS[k].label}</span>
          </div>
        ))}
      </div>

      {/* ── Observaciones + Guardar ── */}
      {!readonly && (
        <div className="border-t border-[#E3E8F0] px-4 py-3 flex gap-3 items-start bg-[#FAFBFD]">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Observaciones</label>
            <textarea
              className="w-full text-[12px] border border-[#E3E8F0] rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0057FF] resize-none bg-white"
              rows={2}
              value={chart.observations}
              onChange={e => setChart(prev => ({ ...prev, observations: e.target.value }))}
              placeholder="Observaciones generales del odontograma..."/>
          </div>
          <div className="flex flex-col gap-2 pt-5 flex-shrink-0">
            <button onClick={() => onSave(chart, selId, teethType)} disabled={isSaving}
              className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors disabled:opacity-60">
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Legacy exports */
export type OdontogramData = any;
export const SURF_CONDS = {};
export const WHOLE_CONDS = {};
