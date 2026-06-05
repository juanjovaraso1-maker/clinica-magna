"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, X, ChevronLeft, Save, Mail, MessageCircle, ChevronDown } from "lucide-react";

/* ─── Tipos ─────────────────────────────────────────────────────────── */
interface Treatment { id: string; name: string; category: string; price: number }
interface Convenio  { id: string; name: string; discount: number; discountType: string }
export interface BudgetLine {
  _key: string; toothNum?: number; area?: string; surfaces: string[];
  description: string; quantity: number; unitPrice: number; discount: number; discountAmt: number; total: number;
  status: string;
}

const ITEM_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pendiente",   color: "#6B7280", bg: "#F3F4F6" },
  in_progress: { label: "En curso",    color: "#D97706", bg: "#FEF3C7" },
  completed:   { label: "Finalizado",  color: "#16A34A", bg: "#DCFCE7" },
};

interface Props {
  patientId: string; budgetId?: string; budgetNumber?: number;
  initUserId?: string; initDate?: string; initValidUntil?: string;
  initStatus?: string; initDiscount?: number; initNotes?: string; initLines?: BudgetLine[];
  users: Array<{id:string;name:string}>;
  treatments: Treatment[];
  convenios: Convenio[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onSendEmail?: () => Promise<void>;
  patientPhone?: string;
  isSaving?: boolean;
}

/* ─── Dientes ────────────────────────────────────────────────────────── */
const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const SEXTANTS = ["Sextante 1","Sextante 2","Sextante 3","Sextante 4","Sextante 5","Sextante 6"];
const AREAS = ["Boca completa","Maxilar superior","Maxilar inferior",...SEXTANTS];

function fmtN(n: number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }
function fmtTooth(n: number) { return `${Math.floor(n/10)}.${n%10}`; }
function isUpperTooth(n: number) { const q=Math.floor(n/10); return q===1||q===2; }

/* ─── Mapeo FDI → PNG ────────────────────────────────────────────────── */
function getToothPNG(num: number): { src: string; mirror: boolean } {
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

function BudgetToothPNG({ num, hasLine, hovered }: { num: number; hasLine: boolean; hovered: boolean }) {
  const { src, mirror } = getToothPNG(num);
  return (
    <div style={{
      position: "relative", width: 24, height: 52, borderRadius: 4,
      outline: hovered ? "2.5px solid #2563EB" : hasLine ? "2px solid #3B82F6" : "none",
      outlineOffset: 2,
      backgroundColor: hovered ? "#DBEAFE" : hasLine ? "#EFF6FF" : "transparent",
    }}>
      <img src={src} alt="" draggable={false}
        style={{
          width: "100%", height: "100%", objectFit: "contain",
          transform: mirror ? "scaleX(-1)" : undefined,
          display: "block",
        }}/>
    </div>
  );
}

/* ─── SVG Ilustración de arcada dental (vista oclusal) ─────────────── */
function ArchIllustration({ type }: { type: "full"|"upper"|"lower" }) {
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
      {showU && (
        <g opacity={1}>
          <path d="M11,30 C9,14 22,2 49.5,2 C77,2 90,14 88,30" fill="none" stroke="#7BAFD4" strokeWidth="8" strokeLinecap="round"/>
          {upperTeeth.map((t,i)=>(
            <rect key={i} x={t.x} y={t.y-1} width={t.w+1} height={t.h+1} rx="1.5" fill="white" stroke="#7BAFD4" strokeWidth="0.8"/>
          ))}
        </g>
      )}
      {showL && (
        <g transform={`translate(0,${lOffset})`} opacity={1}>
          <path d="M13,2 C11,18 24,28 49.5,28 C75,28 88,18 86,2" fill="none" stroke="#9B7DB0" strokeWidth="8" strokeLinecap="round"/>
          {lowerTeeth.map((t,i)=>(
            <rect key={i} x={t.x} y={t.y+2} width={t.w+1} height={t.h+1} rx="1.5" fill="white" stroke="#9B7DB0" strokeWidth="0.8"/>
          ))}
        </g>
      )}
    </svg>
  );
}

const SEXTANT_TEETH_BUDGET: Record<string, number[]> = {
  S1: [18,17,16,15,14], S2: [13,12,11,21,22,23], S3: [24,25,26,27,28],
  S4: [38,37,36,35,34], S5: [33,32,31,41,42,43], S6: [44,45,46,47,48],
};


export default function BudgetEditor({ patientId, budgetId, budgetNumber, initUserId="", initDate, initValidUntil, initStatus="pending", initDiscount=0, initNotes="", initLines=[], users, treatments, convenios, onSave, onCancel, onDelete, onSendEmail, patientPhone, isSaving }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const in30d = new Date(Date.now()+30*86400000).toISOString().split("T")[0];

  const [userId,     setUserId]     = useState(initUserId);
  const [date,       setDate]       = useState(initDate??today);
  const [validUntil, setValidUntil] = useState(initValidUntil??in30d);
  const [status,     setStatus]     = useState(initStatus);
  const [gDiscount,  setGDiscount]  = useState(initDiscount);
  const DEFAULT_NOTES = "Este presupuesto tiene vigencia de 30 días desde su emisión. Algunos tratamientos deben ser reevaluados con exámenes complementarios.";
  const [notes,      setNotes]      = useState(initNotes||DEFAULT_NOTES);
  const [lines,      setLines]      = useState<BudgetLine[]>(initLines.length>0?initLines.map((l,i)=>({...l,_key:String(i),discountAmt:l.discountAmt??0,status:l.status||"pending"})):[]);
  const [deletingBudget, setDeletingBudget] = useState(false);
  const [selCat,      setSelCat]      = useState("");
  const [selTreatId,  setSelTreatId]  = useState("");
  const [treatSearch, setTreatSearch] = useState("");
  const [treatOpen,   setTreatOpen]   = useState(false);
  const [hoveredTooth,setHov]         = useState<number|null>(null);
  /* selArea: area-context for the next treatment — never dims teeth */
  const [selArea,     setSelArea]     = useState("Boca completa");
  const [viewFilter,  setViewFilter]  = useState<"full"|"upper"|"lower">("full");
  const [selSextantFilter, setSelSextantFilter] = useState<string|null>(null);
  const [gDiscountPct, setGDiscountPct] = useState(0);

  const categories  = useMemo(()=>Array.from(new Set(treatments.map(t=>t.category))).sort(),[treatments]);
  const filteredTr  = useMemo(()=>{
    let list = selCat ? treatments.filter(t=>t.category===selCat) : treatments;
    if (treatSearch.trim()) list = list.filter(t=>t.name.toLowerCase().includes(treatSearch.toLowerCase()));
    return list.slice(0,40);
  },[treatments,selCat,treatSearch]);
  const selTreat    = treatments.find(t=>t.id===selTreatId);
  const subtotal   = lines.reduce((s,l)=>s+l.total,0);
  const total      = Math.max(0, subtotal - gDiscount - Math.round(subtotal * gDiscountPct / 100));

  function addLine(toothNum?: number, area?: string) {
    if(!selTreat) return;
    setLines(prev=>[...prev,{_key:`${Date.now()}`,toothNum,area,surfaces:[],description:selTreat.name,quantity:1,unitPrice:selTreat.price,discount:0,discountAmt:0,total:selTreat.price,status:"pending"}]);
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return;
    setDeletingBudget(true);
    try { await onDelete(); } finally { setDeletingBudget(false); }
  }

  function handleWhatsApp() {
    if (!patientPhone) return;
    const clean = patientPhone.replace(/\D/g,"");
    const num = clean.startsWith("56") ? clean : `56${clean}`;
    const msg = `Estimado/a paciente, adjuntamos su presupuesto dental N° ${budgetNumber ? String(budgetNumber).padStart(4,"0") : "—"} de Clínica Magna. Total: ${fmtN(total)}. Para consultas contáctenos.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function updateLine(i:number,k:string,v:string|number) {
    setLines(prev=>prev.map((l,idx)=>{
      if(idx!==i) return l;
      const u:any={...l,[k]:v};
      if(["quantity","unitPrice","discount","discountAmt"].includes(k))
        u.total=Math.max(0, Number(u.quantity)*Number(u.unitPrice)*(1-Number(u.discount)/100)-Number(u.discountAmt));
      return u;
    }));
  }

  async function handleSave() {
    const validLines=lines.filter(l=>l.description.trim());
    const items=validLines.map(({_key,...rest})=>({
      description:rest.description,
      tooth:rest.toothNum?fmtTooth(rest.toothNum):"",
      area:rest.area||"",
      quantity:rest.quantity,unitPrice:rest.unitPrice,discount:rest.discount,discountAmt:rest.discountAmt??0,total:rest.total,
      status:rest.status||"pending",
    }));
    await onSave({userId,date,validUntil,status,discount:gDiscount + Math.round(subtotal * gDiscountPct / 100),notes,subtotal,total,items});
  }

  const toothHasLine=(num:number)=>lines.some(l=>l.toothNum===num);

  function toothOpacityBudget(num: number): number {
    const up = isUpperTooth(num);
    if (selSextantFilter) return SEXTANT_TEETH_BUDGET[selSextantFilter]?.includes(num) ? 1 : 0.2;
    if (viewFilter === "upper") return up ? 1 : 0.25;
    if (viewFilter === "lower") return up ? 0.25 : 1;
    return 1;
  }

  /* ── Grid columns for items table ── */
  const gridCols = "100px minmax(120px,1fr) 70px 110px 60px 65px 90px 110px 36px";

  /* Short label for the "Agregar" button */
  const areaShort = selArea.replace(/\s*\(.*\)/,"").trim();

  return (
    <div className="bg-white border border-[#E3E8F0] rounded-2xl overflow-hidden shadow-sm">

      {/* ── Encabezado ── */}
      <div className="bg-[#F8F9FC] border-b border-[#E3E8F0] px-5 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[13px] text-[#9AA0B4] hover:text-[#1A1D2E] transition-colors flex-shrink-0">
          <ChevronLeft size={16}/> Volver
        </button>
        <span className="text-[15px] font-bold text-[#1A1D2E] flex-shrink-0">
          {budgetNumber?`Presupuesto #${String(budgetNumber).padStart(4,"0")}`:"Nuevo Presupuesto"}
        </span>
        <div className="flex gap-2 flex-wrap flex-1">
          <select className="select text-[13px] flex-1 min-w-[160px]" value={userId} onChange={e=>setUserId(e.target.value)}>
            <option value="">Seleccionar profesional...</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="date" className="input text-[13px] w-40" value={date} onChange={e=>setDate(e.target.value)}/>
          <input type="date" className="input text-[13px] w-40" value={validUntil} onChange={e=>setValidUntil(e.target.value)} title="Válido hasta"/>
          <select className="select text-[13px] w-36" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="active">Activo</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>
      </div>

      {/* ── Selector prestación + convenio ── */}
      <div className="px-5 py-4 border-b border-[#E3E8F0] space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="select text-[13px] w-48 flex-shrink-0" value={selCat} onChange={e=>{setSelCat(e.target.value);setTreatSearch("");setSelTreatId("");}}>
            <option value="">Todas las categorías</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative flex-1 min-w-[240px]">
            <input type="text" className="input text-[13px] w-full pr-8"
              placeholder="Buscar prestación por nombre..."
              value={selTreat ? selTreat.name : treatSearch}
              onChange={e=>{ setTreatSearch(e.target.value); setSelTreatId(""); setTreatOpen(true); }}
              onFocus={()=>setTreatOpen(true)}
              onBlur={()=>setTimeout(()=>setTreatOpen(false),180)}/>
            {selTreatId && (
              <button onClick={()=>{ setSelTreatId(""); setTreatSearch(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9AA0B4] hover:text-red-500">
                <X size={14}/>
              </button>
            )}
            {treatOpen && !selTreatId && filteredTr.length>0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#E3E8F0] rounded-xl shadow-xl max-h-64 overflow-y-auto mt-1">
                {filteredTr.map(t=>(
                  <button key={t.id} type="button" onMouseDown={()=>{ setSelTreatId(t.id); setTreatSearch(t.name); setTreatOpen(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#EEF3FF] text-[13px] flex items-center justify-between border-b border-[#F0F2F7] last:border-0">
                    <span className="font-medium text-[#1A1D2E]">{t.name}</span>
                    <span className="text-[#0057FF] font-bold flex-shrink-0 ml-4">{fmtN(t.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selTreat && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-[13px] flex-shrink-0">
              <span className="font-bold text-[#0057FF]">{selTreat.name}</span>
              <span className="text-[#9AA0B4]">·</span>
              <span className="font-bold text-[#0057FF]">{fmtN(selTreat.price)}</span>
            </div>
          )}
        </div>

        {/* Convenio */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wide flex-shrink-0">Convenio</span>
          {convenios.length===0 ? (
            <span className="text-[12px] text-emerald-600 italic">Sin convenios — <a href="/administracion/convenios" className="underline font-medium">crear en Administración</a></span>
          ) : (
            <select className="select text-[13px] flex-1 bg-white border-emerald-300" defaultValue=""
              onChange={e=>{
                const cv=convenios.find(c=>c.id===e.target.value);
                if(cv){
                  if(cv.discountType==="pct") setLines(p=>p.map(l=>({...l,discount:cv.discount,total:l.quantity*l.unitPrice*(1-cv.discount/100)})));
                  else setGDiscount(cv.discount);
                }
                (e.target as HTMLSelectElement).value="";
              }}>
              <option value="">Seleccionar convenio...</option>
              {convenios.map(c=><option key={c.id} value={c.id}>{c.name} — {c.discountType==="pct"?`${c.discount}%`:fmtN(c.discount)}</option>)}
            </select>
          )}
        </div>

        {/* Área de asociación — siempre visible, cambia contexto para próxima prestación */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-[#9AA0B4] mt-1.5 flex-shrink-0">Área:</span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {AREAS.map(area=>(
              <button key={area}
                onClick={()=>setSelArea(area)}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  selArea===area
                    ? "bg-[#0057FF] text-white border-[#0057FF]"
                    : "bg-[#F0F2F7] text-[#4B5563] border-[#E3E8F0] hover:bg-[#EEF3FF] hover:text-[#0057FF] hover:border-[#0057FF]/40"
                }`}>
                {area}
              </button>
            ))}
          </div>
          {selTreat && (
            <button
              onClick={()=>addLine(undefined, selArea)}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all flex-shrink-0 mt-0.5">
              <Plus size={12}/> Agregar para {areaShort}
            </button>
          )}
        </div>
      </div>

      {/* ── Odontograma: selector de vista + sextantes ── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#F0F2F7] bg-[#FAFBFD] flex-wrap">
        <div className="flex items-center gap-1.5">
          {([["full","Boca completa"],["upper","Maxilar superior"],["lower","Maxilar inferior"]] as [string,string][]).map(([k,label])=>(
            <button key={k} onClick={()=>{setViewFilter(k as any);setSelSextantFilter(null);}}
              className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all ${
                viewFilter===k && !selSextantFilter
                  ? "bg-[#EEF3FF] border-[#0057FF] text-[#0057FF]"
                  : "border-[#E3E8F0] text-[#6B7280] hover:border-[#C7D2FE] hover:bg-[#F0F2F7]"
              }`}>
              <ArchIllustration type={k as any}/>
              <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mr-0.5">Sextante:</span>
          {["S1","S2","S3","S4","S5","S6"].map(s=>(
            <button key={s} onClick={()=>setSelSextantFilter(prev=>prev===s?null:s)}
              className={`w-10 h-8 text-[12px] font-bold rounded-lg border transition-all ${
                selSextantFilter===s
                  ? "bg-[#0057FF] text-white border-[#0057FF]"
                  : "bg-white text-[#4B5563] border-[#E3E8F0] hover:border-[#0057FF]/40 hover:text-[#0057FF]"
              }`}>{s}</button>
          ))}
          {selSextantFilter && (
            <button onClick={()=>setSelSextantFilter(null)} className="text-[11px] text-[#9AA0B4] hover:text-red-500 ml-0.5 px-1.5">✕</button>
          )}
        </div>
      </div>
      <div className="text-center py-1.5 border-b border-[#F0F2F7] bg-white">
        <span className="text-[10px] font-bold text-[#9AA0B4] tracking-widest uppercase">
          {selTreat ? `Haz clic en un diente para agregar «${selTreat.name}»` : "Selecciona un tratamiento para agregar dientes al presupuesto"}
        </span>
      </div>
      <div className="border-b border-[#E3E8F0] bg-white py-3 px-2">
        {/* Superior */}
        <div className="flex items-end justify-between w-full mb-1 px-1">
          {UPPER.map((num,idx)=>(
            <div key={num} className={`${idx===7?"mr-2":""} transition-opacity`}
              style={{opacity: toothOpacityBudget(num)}}>
              <div className="flex flex-col items-center gap-[4px]">
                <div className={`rounded-sm transition-all ${selTreat?"cursor-pointer":""}`}
                  onClick={()=>selTreat&&addLine(num)}
                  onMouseEnter={()=>setHov(num)} onMouseLeave={()=>setHov(null)}>
                  <BudgetToothPNG num={num} hasLine={toothHasLine(num)} hovered={hoveredTooth===num&&!!selTreat}/>
                </div>
                <span className={`text-[11px] font-bold select-none leading-none ${toothHasLine(num)?"text-blue-600":"text-stone-400"}`}>{fmtTooth(num)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-dashed border-[#E8E0D4] mx-2 my-3"/>
        {/* Inferior */}
        <div className="flex items-start justify-between w-full mt-1 px-1">
          {LOWER.map((num,idx)=>(
            <div key={num} className={`${idx===7?"mr-2":""} transition-opacity`}
              style={{opacity: toothOpacityBudget(num)}}>
              <div className="flex flex-col items-center gap-[4px]">
                <span className={`text-[11px] font-bold select-none leading-none ${toothHasLine(num)?"text-blue-600":"text-stone-400"}`}>{fmtTooth(num)}</span>
                <div className={`rounded-sm transition-all ${selTreat?"cursor-pointer":""}`}
                  onClick={()=>selTreat&&addLine(num)}
                  onMouseEnter={()=>setHov(num)} onMouseLeave={()=>setHov(null)}>
                  <BudgetToothPNG num={num} hasLine={toothHasLine(num)} hovered={hoveredTooth===num&&!!selTreat}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabla de ítems (ancho completo) ── */}
      <div className="border-b border-[#E3E8F0]">
        {/* Header */}
        <div className="grid text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide px-4 py-3 bg-[#F0F2F7] border-b border-[#E3E8F0]"
          style={{gridTemplateColumns:gridCols}}>
          <span>Estado</span>
          <span>Tratamiento</span>
          <span className="text-center">Diente</span>
          <span className="text-right">P. Unit.</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Dto%</span>
          <span className="text-right">Dto $</span>
          <span className="text-right">Total</span>
          <span/>
        </div>

        {/* Filas */}
        <div className="overflow-y-auto" style={{maxHeight:320}}>
          {lines.length===0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-[14px] font-medium text-[#9AA0B4]">Sin ítems aún</p>
              <p className="text-[12px] text-[#9AA0B4] mt-1">Selecciona una prestación y haz click en un diente o área</p>
            </div>
          ) : lines.map((l,i)=>{
            const st = ITEM_STATUSES[l.status||"pending"];
            return (
              <div key={l._key} className="grid items-center border-b border-[#F0F2F7] px-4 py-3 hover:bg-[#F8F9FC]"
                style={{gridTemplateColumns:gridCols}}>
                {/* Estado */}
                <div className="relative pr-1">
                  <select
                    className="text-[12px] font-semibold rounded-lg px-2.5 py-1.5 border-0 outline-none cursor-pointer appearance-none pr-6 w-full"
                    style={{backgroundColor:st?.bg, color:st?.color}}
                    value={l.status||"pending"}
                    onChange={e=>setLines(prev=>prev.map((x,j)=>j===i?{...x,status:e.target.value}:x))}>
                    {Object.entries(ITEM_STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"/>
                </div>
                {/* Prestación */}
                <input className="text-[13px] bg-white border border-[#E8EBF2] hover:border-[#B0B8CC] focus:border-[#0057FF] rounded-lg px-2 py-1.5 outline-none text-[#1A1D2E] font-medium w-full min-w-0 transition-colors"
                  value={l.description} onChange={e=>updateLine(i,"description",e.target.value)}/>
                {/* Diente */}
                <span className="text-[13px] font-semibold text-[#0057FF] text-center truncate">
                  {l.toothNum ? fmtTooth(l.toothNum) : (l.area ? l.area.replace(/^(S\d).*$/,"$1") : "—")}
                </span>
                {/* P. Unit */}
                <input type="number" min="0"
                  className="text-[13px] border border-[#E3E8F0] rounded-lg px-2 py-1.5 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF] focus:border-[#0057FF]"
                  value={l.unitPrice} onChange={e=>updateLine(i,"unitPrice",parseFloat(e.target.value)||0)}/>
                {/* Cant */}
                <input type="number" min="1"
                  className="text-[13px] border border-[#E3E8F0] rounded-lg px-2 py-1.5 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF] focus:border-[#0057FF]"
                  value={l.quantity} onChange={e=>updateLine(i,"quantity",parseInt(e.target.value)||1)}/>
                {/* Dto% */}
                <input type="number" min="0" max="100"
                  className="text-[13px] border border-[#E3E8F0] rounded-lg px-2 py-1.5 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF] focus:border-[#0057FF]"
                  value={l.discount} onChange={e=>updateLine(i,"discount",parseFloat(e.target.value)||0)}/>
                {/* Dto $ */}
                <input type="number" min="0"
                  className="text-[13px] border border-[#E3E8F0] rounded-lg px-2 py-1.5 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF] focus:border-[#0057FF]"
                  value={l.discountAmt??0} onChange={e=>updateLine(i,"discountAmt",parseFloat(e.target.value)||0)}/>
                {/* Total */}
                <span className="text-[14px] font-bold text-right text-[#1A1D2E]">{fmtN(l.total)}</span>
                {/* Eliminar */}
                <button onClick={()=>setLines(prev=>prev.filter((_,j)=>j!==i))}
                  className="text-[#D4C4A0] hover:text-red-500 transition-colors flex justify-center">
                  <X size={15}/>
                </button>
              </div>
            );
          })}
        </div>

        {/* Agregar manual — botón más grande */}
        <div className="px-4 py-3 border-t border-[#F0F2F7]">
          <button onClick={()=>setLines(prev=>[...prev,{_key:`${Date.now()}`,surfaces:[],description:"",quantity:1,unitPrice:0,discount:0,discountAmt:0,total:0,status:"pending"}])}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#0057FF] hover:text-[#0041CC] transition-colors border border-[#0057FF]/20 bg-[#EEF3FF] rounded-xl px-4 py-2.5 hover:bg-[#0057FF]/10">
            <Plus size={15}/> Agregar ítem manualmente
          </button>
        </div>

        {/* Totales */}
        <div className="border-t border-[#E3E8F0] px-5 py-4 space-y-2.5 bg-[#F8F9FC]">
          <div className="flex justify-between text-[13px] text-[#4B5563]">
            <span>Subtotal</span><span className="font-semibold">{fmtN(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] text-[#4B5563]">
            <span>Descuento global ($)</span>
            <input type="number" min="0"
              className="w-32 text-right border border-[#E3E8F0] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white font-medium"
              value={gDiscount} onChange={e=>setGDiscount(parseFloat(e.target.value)||0)}/>
          </div>
          <div className="flex items-center justify-between text-[13px] text-[#4B5563]">
            <span>Descuento global (%)</span>
            <input type="number" min="0" max="100"
              className="w-32 text-right border border-[#E3E8F0] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white font-medium"
              value={gDiscountPct} onChange={e=>setGDiscountPct(parseFloat(e.target.value)||0)}/>
          </div>
          <div className="flex justify-between font-bold text-[17px] border-t border-[#E3E8F0] pt-3 text-[#1A1D2E]">
            <span>Total</span><span className="text-[#0057FF]">{fmtN(total)}</span>
          </div>
        </div>
      </div>

      {/* ── Observaciones + botones ── */}
      <div className="px-5 py-4 flex gap-4 items-start flex-wrap bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Observaciones del presupuesto</label>
          <textarea className="w-full text-[13px] border border-[#E3E8F0] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#0057FF] resize-none"
            rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas adicionales..."/>
        </div>
        <div className="flex items-center gap-2 flex-wrap pt-6 flex-shrink-0">
          {budgetId && onDelete && (
            <button onClick={handleDelete} disabled={deletingBudget}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60">
              <Trash2 size={13}/> {deletingBudget?"Eliminando...":"Eliminar"}
            </button>
          )}
          {budgetId && patientPhone && (
            <button onClick={handleWhatsApp}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
              <MessageCircle size={13}/> WhatsApp
            </button>
          )}
          {budgetId && onSendEmail && (
            <button onClick={onSendEmail}
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-2.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
              <Mail size={13}/> Enviar email
            </button>
          )}
          <button onClick={onCancel}
            className="text-[13px] font-medium px-4 py-2.5 rounded-xl border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving||!userId}
            className="flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors disabled:opacity-60">
            <Save size={14}/> {isSaving?"Guardando...":"Guardar presupuesto"}
          </button>
        </div>
      </div>
    </div>
  );
}
