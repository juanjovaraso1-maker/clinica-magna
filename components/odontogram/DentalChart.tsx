"use client";
import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2, Printer, ChevronDown } from "lucide-react";

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
  caries:        { label: "Caries",                       color: "#EF4444", bg: "#FEE2E2" },
  obturacion:    { label: "Obturación",                   color: "#3B82F6", bg: "#DBEAFE" },
  sellante:      { label: "Sellante",                     color: "#22C55E", bg: "#DCFCE7" },
  endodoncia:    { label: "Endodoncia",                   color: "#7C3AED", bg: "#F3E8FF" },
  corona:        { label: "Corona",                       color: "#2563EB", bg: "#DBEAFE" },
  implante:      { label: "Implante",                     color: "#16A34A", bg: "#DCFCE7" },
  ausente:       { label: "Pieza ausente",                color: "#374151", bg: "#F9FAFB" },
  extraccion:    { label: "Extracción indicada",          color: "#DC2626", bg: "#FEF2F2" },
  fractura:      { label: "Fractura dentaria",            color: "#EA580C", bg: "#FFF7ED" },
  amalgama:      { label: "Amalgama",                     color: "#6B7280", bg: "#F3F4F6" },
  incrustacion:  { label: "Incrustación",                 color: "#0D9488", bg: "#CCFBF1" },
  composite:     { label: "Composite",                    color: "#4F46E5", bg: "#EEF2FF" },
  lcnc:          { label: "Lesión cervical no cariosa",   color: "#DB2777", bg: "#FDF2F8" },
  hipoplasia:    { label: "Hipoplasia / Fluorosis",       color: "#F59E0B", bg: "#FFFBEB" },
  movilidad:     { label: "Movilidad",                    color: "#7C3AED", bg: "#F5F3FF" },
  pulpotomia:    { label: "Pulpotomía",                   color: "#9D174D", bg: "#FDF2F8" },
  corona_acero:  { label: "Corona acero inoxidable",      color: "#92400E", bg: "#FEF3C7" },
  fluoruro:      { label: "Fluoruro de plata",            color: "#1D4ED8", bg: "#EFF6FF" },
  impactado:     { label: "Impactado / Retenido",         color: "#1E3A5F", bg: "#DBEAFE" },
  supernumerario:{ label: "Supernumerario",               color: "#065F46", bg: "#D1FAE5" },
};

const COND_KEYS = Object.keys(CONDITIONS);
const SURFACES  = ["V","M","O","D","P"];

/* ─── Distribución de dientes ────────────────────────────────────────── */
const PERM_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const PERM_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const TEMP_UPPER = [55,54,53,52,51,61,62,63,64,65];
const TEMP_LOWER = [85,84,83,82,81,71,72,73,74,75];

function emptyChart(): ChartData { return { teeth: {}, observations: "" }; }

function getType(num: number): "i"|"c"|"p"|"m" {
  const pos = num % 10;
  if (pos <= 2) return "i";
  if (pos === 3) return "c";
  if (pos <= 5) return "p";
  return "m";
}

function fmtTooth(n: number): string {
  const q = Math.floor(n / 10);
  return `${q}.${n % 10}`;
}

function isUpper(num: number): boolean {
  const q = Math.floor(num / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

/* ─── SVG de diente anatómico ────────────────────────────────────────── */
function ToothSVG({ num, wholeCond, selected }: { num: number; wholeCond?: string; selected?: boolean }) {
  const type  = getType(num);
  const upper = isUpper(num);
  const baby  = num >= 50;
  const sc    = baby ? 0.82 : 1;

  const cond   = wholeCond ? CONDITIONS[wholeCond] : null;
  const crown  = cond ? cond.bg : "#F5F5F4";
  const stroke = selected ? "#2563EB" : (cond ? cond.color : "#A8A29E");
  const rootF  = "#EDD9A3";
  const rootS  = cond ? cond.color : "#C8A870";
  const sw     = selected ? 2.2 : 1.3;
  const hasX   = wholeCond === "ausente" || wholeCond === "extraccion";
  const flip: React.CSSProperties = upper ? { transform: "scaleY(-1)" } : {};

  if (type === "i") {
    const [vw,vh,rw,rh] = [18,56, Math.round(16*sc), Math.round(48*sc)];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={rw} height={rh} style={{display:"block",...flip}}>
        <path d="M5,24 Q4,37 9,50 Q14,37 13,24 Z" fill={rootF} stroke={rootS} strokeWidth={sw*0.85}/>
        <path d="M1,3 Q1,0 9,0 Q17,0 17,3 L16,22 Q16,24 9,24 Q2,24 2,22 Z" fill={crown} stroke={stroke} strokeWidth={sw}/>
        <line x1="3" y1="21" x2="15" y2="21" stroke={stroke} strokeWidth="0.5" opacity="0.4"/>
        {hasX && <><line x1="2" y1="2" x2="16" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/><line x1="16" y1="2" x2="2" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/></>}
      </svg>
    );
  }
  if (type === "c") {
    const [vw,vh,rw,rh] = [18,62, Math.round(16*sc), Math.round(54*sc)];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={rw} height={rh} style={{display:"block",...flip}}>
        <path d="M5,29 Q4,44 9,58 Q14,44 13,29 Z" fill={rootF} stroke={rootS} strokeWidth={sw*0.85}/>
        <path d="M1,3 Q1,0 9,0 Q17,0 17,3 L15,20 Q13,26 9,29 Q5,26 3,20 Z" fill={crown} stroke={stroke} strokeWidth={sw}/>
        {hasX && <><line x1="2" y1="2" x2="16" y2="27" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/><line x1="16" y1="2" x2="2" y2="27" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/></>}
      </svg>
    );
  }
  if (type === "p") {
    const [vw,vh,rw,rh] = [20,54, Math.round(18*sc), Math.round(46*sc)];
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} width={rw} height={rh} style={{display:"block",...flip}}>
        <path d="M5,22 Q4,34 10,46 Q16,34 15,22 Z" fill={rootF} stroke={rootS} strokeWidth={sw*0.85}/>
        <path d="M2,3 Q3,0 10,0 Q17,0 18,3 L18,20 Q18,22 10,22 Q2,22 2,20 Z" fill={crown} stroke={stroke} strokeWidth={sw}/>
        <path d="M5,0 Q7,2 10,1 Q13,2 15,0" fill="none" stroke={stroke} strokeWidth="0.7" opacity="0.5"/>
        <line x1="10" y1="0" x2="10" y2="13" stroke={stroke} strokeWidth="0.6" opacity="0.35"/>
        {hasX && <><line x1="2" y1="2" x2="18" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/><line x1="18" y1="2" x2="2" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/></>}
      </svg>
    );
  }
  // molar
  const [vw,vh,rw,rh] = [28,54, Math.round(26*sc), Math.round(46*sc)];
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={rw} height={rh} style={{display:"block",...flip}}>
      <path d="M4,22 Q3,34 8,46 Q12,34 11,22 Z" fill={rootF} stroke={rootS} strokeWidth={sw*0.85}/>
      <path d="M17,22 Q16,34 20,46 Q25,34 24,22 Z" fill={rootF} stroke={rootS} strokeWidth={sw*0.85}/>
      <path d="M2,4 Q3,0 14,0 Q25,0 26,4 L26,20 Q26,22 14,22 Q2,22 2,20 Z" fill={crown} stroke={stroke} strokeWidth={sw}/>
      <path d="M5,0 Q8,3 11,1 Q14,3 17,1 Q20,3 23,0" fill="none" stroke={stroke} strokeWidth="0.7" opacity="0.5"/>
      <line x1="10" y1="0" x2="10" y2="14" stroke={stroke} strokeWidth="0.6" opacity="0.3"/>
      <line x1="18" y1="0" x2="18" y2="14" stroke={stroke} strokeWidth="0.6" opacity="0.3"/>
      {hasX && <><line x1="2" y1="2" x2="26" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/><line x1="26" y1="2" x2="2" y2="22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/></>}
    </svg>
  );
}

/* ─── Círculos de superficie en patrón de cruz ───────────────────────── */
function SurfaceDots({ num, toothState, selSurf, onSurf, readonly }: {
  num: number; toothState?: ToothState; selSurf?: string|null;
  onSurf?: (s:string)=>void; readonly?: boolean;
}) {
  const pos: Record<string,[number,number]> = { V:[11,2], M:[2,11], O:[11,11], D:[20,11], P:[11,20] };
  const label: Record<string,string> = { V:"V", M:"M", O:"O", D:"D", P: isUpper(num)?"P":"L" };
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" style={{display:"block"}}>
      {SURFACES.map(s => {
        const [cx,cy] = pos[s];
        const sc   = toothState?.surfaces?.[s];
        const c    = sc?.cond && sc.cond !== "" ? CONDITIONS[sc.cond] : null;
        const isSel = selSurf === s;
        return (
          <circle key={s} cx={cx} cy={cy} r="4"
            fill={c ? c.color : (isSel ? "#2563EB" : "white")}
            stroke={c ? c.color : (isSel ? "#2563EB" : "#C8A870")}
            strokeWidth="1.2"
            className={readonly ? "" : "cursor-pointer hover:opacity-75 transition-opacity"}
            onClick={() => !readonly && onSurf?.(s)}>
            <title>{label[s]}{c ? ` — ${c.label}` : ""}</title>
          </circle>
        );
      })}
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

  const svg = (
    <div className={`cursor-pointer rounded-md p-0.5 transition-all ${isSel ? "ring-2 ring-blue-500 ring-offset-1 bg-blue-50" : "hover:bg-stone-100"} ${readonly?"pointer-events-none":""}`}
      onClick={() => !readonly && onTooth(num)}>
      <ToothSVG num={num} wholeCond={state?.wholeCond} selected={isSel}/>
    </div>
  );
  const dots = (
    <SurfaceDots num={num} toothState={state}
      selSurf={isSel ? selSurf : null}
      onSurf={s => !readonly && onSurf(num,s)}
      readonly={readonly}/>
  );
  const label = (
    <span className={`text-[9px] font-bold select-none leading-none ${isSel?"text-blue-600":"text-stone-400"}`}>
      {fmtTooth(num)}
    </span>
  );

  return (
    <div className="flex flex-col items-center gap-0.5">
      {upper ? <>{svg}{dots}{label}</> : <>{label}{dots}{svg}</>}
    </div>
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
    if (selTooth === num) {
      const key = String(num);
      setChart(prev => {
        const ex  = prev.teeth[key] ?? { wholeCond:"", surfaces:{}, note:"" };
        return { ...prev, teeth: { ...prev.teeth, [key]: { ...ex, wholeCond: ex.wholeCond === selCond ? "" : selCond } } };
      });
    } else { setSelTooth(num); setSelSurf(null); }
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

  return (
    <div className="bg-white border border-[#E3E8F0] rounded-2xl overflow-hidden shadow-sm">

      {/* ── Barra superior ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#E3E8F0] bg-[#F8F9FC] flex-wrap">
        {/* Tabs Permanente / Temporal */}
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

        {/* Selector fecha */}
        {currentRecs.length > 0 && (
          <div className="relative flex-shrink-0">
            <select className="appearance-none text-[12px] border border-[#E3E8F0] rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white text-[#1A1D2E] font-medium cursor-pointer"
              value={selId ?? ""} onChange={e => selectRecord(e.target.value)}>
              {currentRecs.map(r => (
                <option key={r.id} value={r.id}>
                  Ver: {new Date(r.date+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"})}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9AA0B4] pointer-events-none"/>
          </div>
        )}

        {/* Modo */}
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

        {/* Acciones */}
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

      {/* Título */}
      <div className="text-center py-1.5 border-b border-[#F0F2F7]">
        <span className="text-[10px] font-bold text-[#9AA0B4] tracking-widest uppercase">Odontograma Internacional FDI</span>
      </div>

      {/* ── Grilla de dientes + panel derecho ── */}
      <div className="flex">

        {/* Odontograma */}
        <div className="flex-1 min-w-0 overflow-x-auto py-3 px-2">
          {/* Superior */}
          <div className="flex items-end justify-center gap-1 mb-1">
            {upper.map((num,idx) => (
              <div key={num} className={idx===Math.floor(upper.length/2)-1?"mr-3":""}>
                <ToothCell num={num} chart={chart} upper={true}
                  selTooth={selTooth} selSurf={selSurf}
                  onTooth={handleToothClick} onSurf={handleSurfClick}
                  readonly={readonly||mode!=="diag"}/>
              </div>
            ))}
          </div>
          {/* Línea de mediodía */}
          <div className="border-t-2 border-dashed border-[#E3E8F0] mx-8 my-1"/>
          {/* Inferior */}
          <div className="flex items-start justify-center gap-1 mt-1">
            {lower.map((num,idx) => (
              <div key={num} className={idx===Math.floor(lower.length/2)-1?"mr-3":""}>
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
          <div className="w-[190px] flex-shrink-0 border-l border-[#E3E8F0] overflow-y-auto bg-[#FAFBFD]" style={{maxHeight:430}}>
            <div className="px-2.5 pt-2.5 pb-2">
              <p className="text-[10px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-2">Condición activa</p>
              {COND_KEYS.map(k => {
                const c = CONDITIONS[k];
                return (
                  <button key={k} onClick={() => setSelCond(k)}
                    className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg mb-0.5 transition-colors text-[11px] font-medium ${selCond===k?"bg-[#EEF3FF] text-[#0057FF] font-semibold":"hover:bg-[#F0F2F7] text-[#4B5563]"}`}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/>
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

      {/* ── Leyenda ── */}
      <div className="border-t border-[#F0F2F7] px-4 py-2 flex flex-wrap gap-3">
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
              placeholder="Observaciones generales del odontograma..."
            />
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
