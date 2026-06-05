"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, X, ChevronLeft, Save } from "lucide-react";

/* ─── Tipos ─────────────────────────────────────────────────────────── */
interface Treatment { id: string; name: string; category: string; price: number }
interface Convenio  { id: string; name: string; discount: number; discountType: string }
export interface BudgetLine {
  _key: string; toothNum?: number; area?: string; surfaces: string[];
  description: string; quantity: number; unitPrice: number; discount: number; total: number;
}

interface Props {
  patientId: string; budgetId?: string; budgetNumber?: number;
  initUserId?: string; initDate?: string; initValidUntil?: string;
  initStatus?: string; initDiscount?: number; initNotes?: string; initLines?: BudgetLine[];
  users: Array<{id:string;name:string}>;
  treatments: Treatment[];
  convenios: Convenio[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

/* ─── Dientes ────────────────────────────────────────────────────────── */
const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const SEXTANTS = ["Sextante 1","Sextante 2","Sextante 3","Sextante 4","Sextante 5","Sextante 6"];
const AREAS = ["Boca completa","Maxilar superior","Maxilar inferior",...SEXTANTS];

function fmtN(n: number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }
function fmtTooth(n: number) { return `${Math.floor(n/10)}.${n%10}`; }
function toothType(n: number): "i"|"c"|"p"|"m" {
  const p = n%10; if(p<=2) return "i"; if(p===3) return "c"; if(p<=5) return "p"; return "m";
}
function isUpperTooth(n: number) { const q=Math.floor(n/10); return q===1||q===2; }

function MiniTooth({ num, active, selected }: { num:number; active:boolean; selected:boolean }) {
  const t=toothType(num), up=isUpperTooth(num);
  const cf = selected?"#BFDBFE":active?"#DBEAFE":"#F5F5F4";
  const cs = selected?"#2563EB":active?"#3B82F6":"#A8A29E";
  const rf = "#EDD9A3", rs = selected?"#2563EB":"#C8A870";
  const sw = selected?2:1.2;
  const flip: React.CSSProperties = up?{transform:"scaleY(-1)"}:{};
  if(t==="i") return (
    <svg viewBox="0 0 18 56" width={16} height={44} style={{display:"block",...flip}}>
      <path d="M5,24 Q4,37 9,50 Q14,37 13,24 Z" fill={rf} stroke={rs} strokeWidth={sw*.85}/>
      <path d="M1,3 Q1,0 9,0 Q17,0 17,3 L16,22 Q16,24 9,24 Q2,24 2,22 Z" fill={cf} stroke={cs} strokeWidth={sw}/>
    </svg>);
  if(t==="c") return (
    <svg viewBox="0 0 18 62" width={16} height={48} style={{display:"block",...flip}}>
      <path d="M5,29 Q4,44 9,58 Q14,44 13,29 Z" fill={rf} stroke={rs} strokeWidth={sw*.85}/>
      <path d="M1,3 Q1,0 9,0 Q17,0 17,3 L15,20 Q13,26 9,29 Q5,26 3,20 Z" fill={cf} stroke={cs} strokeWidth={sw}/>
    </svg>);
  if(t==="p") return (
    <svg viewBox="0 0 20 54" width={18} height={44} style={{display:"block",...flip}}>
      <path d="M5,22 Q4,34 10,46 Q16,34 15,22 Z" fill={rf} stroke={rs} strokeWidth={sw*.85}/>
      <path d="M2,3 Q3,0 10,0 Q17,0 18,3 L18,20 Q18,22 10,22 Q2,22 2,20 Z" fill={cf} stroke={cs} strokeWidth={sw}/>
      <line x1="10" y1="0" x2="10" y2="13" stroke={cs} strokeWidth=".6" opacity=".35"/>
    </svg>);
  return (
    <svg viewBox="0 0 28 54" width={24} height={44} style={{display:"block",...flip}}>
      <path d="M4,22 Q3,34 8,46 Q12,34 11,22 Z" fill={rf} stroke={rs} strokeWidth={sw*.85}/>
      <path d="M17,22 Q16,34 20,46 Q25,34 24,22 Z" fill={rf} stroke={rs} strokeWidth={sw*.85}/>
      <path d="M2,4 Q3,0 14,0 Q25,0 26,4 L26,20 Q26,22 14,22 Q2,22 2,20 Z" fill={cf} stroke={cs} strokeWidth={sw}/>
      <line x1="10" y1="0" x2="10" y2="14" stroke={cs} strokeWidth=".6" opacity=".3"/>
      <line x1="18" y1="0" x2="18" y2="14" stroke={cs} strokeWidth=".6" opacity=".3"/>
    </svg>);
}

export default function BudgetEditor({ patientId, budgetId, budgetNumber, initUserId="", initDate, initValidUntil, initStatus="pending", initDiscount=0, initNotes="", initLines=[], users, treatments, convenios, onSave, onCancel, isSaving }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const in30d = new Date(Date.now()+30*86400000).toISOString().split("T")[0];

  const [userId,     setUserId]     = useState(initUserId);
  const [date,       setDate]       = useState(initDate??today);
  const [validUntil, setValidUntil] = useState(initValidUntil??in30d);
  const [status,     setStatus]     = useState(initStatus);
  const [gDiscount,  setGDiscount]  = useState(initDiscount);
  const [notes,      setNotes]      = useState(initNotes);
  const [lines,      setLines]      = useState<BudgetLine[]>(initLines.length>0?initLines.map((l,i)=>({...l,_key:String(i)})):[]);
  const [selCat,     setSelCat]     = useState("");
  const [selTreatId, setSelTreatId] = useState("");
  const [hoveredTooth,setHov]       = useState<number|null>(null);

  const categories = useMemo(()=>Array.from(new Set(treatments.map(t=>t.category))).sort(),[treatments]);
  const filteredTr = useMemo(()=>selCat?treatments.filter(t=>t.category===selCat):treatments,[treatments,selCat]);
  const selTreat   = treatments.find(t=>t.id===selTreatId);
  const subtotal   = lines.reduce((s,l)=>s+l.total,0);
  const total      = Math.max(0,subtotal-gDiscount);

  function addLine(toothNum?: number, area?: string) {
    if(!selTreat) return;
    setLines(prev=>[...prev,{_key:`${Date.now()}`,toothNum,area,surfaces:[],description:selTreat.name,quantity:1,unitPrice:selTreat.price,discount:0,total:selTreat.price}]);
  }

  function updateLine(i:number,k:string,v:string|number) {
    setLines(prev=>prev.map((l,idx)=>{
      if(idx!==i) return l;
      const u:any={...l,[k]:v};
      if(["quantity","unitPrice","discount"].includes(k)) u.total=Number(u.quantity)*Number(u.unitPrice)*(1-Number(u.discount)/100);
      return u;
    }));
  }

  async function handleSave() {
    const validLines=lines.filter(l=>l.description.trim());
    const items=validLines.map(({_key,...rest})=>({
      description:rest.description,
      tooth:rest.toothNum?fmtTooth(rest.toothNum):"",
      area:rest.area||"",
      quantity:rest.quantity,unitPrice:rest.unitPrice,discount:rest.discount,total:rest.total,
    }));
    await onSave({userId,date,validUntil,status,discount:gDiscount,notes,subtotal,total,items});
  }

  const toothHasLine=(num:number)=>lines.some(l=>l.toothNum===num);

  return (
    <div className="bg-white border border-[#E3E8F0] rounded-2xl overflow-hidden shadow-sm">

      {/* Encabezado */}
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
            <option value="rejected">Rechazado</option>
          </select>
        </div>
      </div>

      {/* Selector prestación + convenio */}
      <div className="px-5 py-4 border-b border-[#E3E8F0] space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="select text-[13px] min-w-[170px]" value={selCat} onChange={e=>{setSelCat(e.target.value);setSelTreatId("");}}>
            <option value="">Todas las categorías</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select text-[13px] flex-1 min-w-[220px]" value={selTreatId} onChange={e=>setSelTreatId(e.target.value)}>
            <option value="">Seleccionar prestación...</option>
            {filteredTr.map(t=><option key={t.id} value={t.id}>{t.name} — {fmtN(t.price)}</option>)}
          </select>
          {selTreat && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[13px]">
              <span className="font-bold text-[#0057FF]">{selTreat.name}</span>
              <span className="text-[#9AA0B4]">·</span>
              <span className="font-semibold text-[#0057FF]">{fmtN(selTreat.price)}</span>
              <button onClick={()=>setSelTreatId("")} className="text-[#9AA0B4] hover:text-red-500 ml-1"><X size={13}/></button>
            </div>
          )}
        </div>

        {/* Convenio */}
        {convenios.length>0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wide flex-shrink-0">Convenio</span>
            <select className="select text-[13px] flex-1 bg-white border-emerald-300" defaultValue=""
              onChange={e=>{
                const cv=convenios.find(c=>c.id===e.target.value);
                if(cv){
                  if(cv.discountType==="pct") setLines(p=>p.map(l=>({...l,discount:cv.discount,total:l.quantity*l.unitPrice*(1-cv.discount/100)})));
                  else setGDiscount(cv.discount);
                }
                (e.target as HTMLSelectElement).value="";
              }}>
              <option value="">Seleccionar convenio para aplicar descuento...</option>
              {convenios.map(c=><option key={c.id} value={c.id}>{c.name} — {c.discountType==="pct"?`${c.discount}%`:fmtN(c.discount)}</option>)}
            </select>
          </div>
        )}

        {/* Áreas especiales */}
        {selTreat && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-[#9AA0B4]">Agregar para:</span>
            {AREAS.map(area=>(
              <button key={area} onClick={()=>addLine(undefined,area)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-[#F0F2F7] text-[#4B5563] border border-[#E3E8F0] hover:bg-[#0057FF] hover:text-white hover:border-[#0057FF] transition-all">
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col xl:flex-row">
        {/* Odontograma */}
        <div className="xl:flex-1 border-b xl:border-b-0 xl:border-r border-[#E3E8F0] bg-[#FAFBFD] py-4 px-3 overflow-x-auto">
          {!selTreat ? (
            <p className="text-center text-[13px] text-[#9AA0B4] py-4">↑ Selecciona una prestación para poder agregar por diente</p>
          ) : (
            <p className="text-center text-[12px] text-[#0057FF] font-semibold mb-3">Haz click en un diente para agregar "{selTreat.name}"</p>
          )}
          {/* Superior */}
          <div className="flex items-end justify-center gap-1 mb-1">
            {UPPER.map((num,idx)=>(
              <div key={num} className={idx===7?"mr-3":""}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-bold select-none ${toothHasLine(num)?"text-[#0057FF]":"text-stone-300"}`}>{fmtTooth(num)}</span>
                  <div className={`cursor-pointer rounded-lg p-1 transition-all ${selTreat?"hover:bg-blue-100 hover:scale-110":""} ${hoveredTooth===num&&selTreat?"bg-blue-50 scale-110":""}`}
                    onClick={()=>addLine(num)}
                    onMouseEnter={()=>setHov(num)} onMouseLeave={()=>setHov(null)}>
                    <MiniTooth num={num} active={toothHasLine(num)} selected={hoveredTooth===num&&!!selTreat}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-dashed border-[#E3E8F0] mx-8 my-1"/>
          {/* Inferior */}
          <div className="flex items-start justify-center gap-1 mt-1">
            {LOWER.map((num,idx)=>(
              <div key={num} className={idx===7?"mr-3":""}>
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`cursor-pointer rounded-lg p-1 transition-all ${selTreat?"hover:bg-blue-100 hover:scale-110":""} ${hoveredTooth===num&&selTreat?"bg-blue-50 scale-110":""}`}
                    onClick={()=>addLine(num)}
                    onMouseEnter={()=>setHov(num)} onMouseLeave={()=>setHov(null)}>
                    <MiniTooth num={num} active={toothHasLine(num)} selected={hoveredTooth===num&&!!selTreat}/>
                  </div>
                  <span className={`text-[9px] font-bold select-none ${toothHasLine(num)?"text-[#0057FF]":"text-stone-300"}`}>{fmtTooth(num)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="xl:w-[520px] flex-shrink-0 flex flex-col">
          {/* Header */}
          <div className="grid text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide px-4 py-3 bg-[#F0F2F7] border-b border-[#E3E8F0]"
            style={{gridTemplateColumns:"56px 1fr 70px 50px 50px 70px 24px"}}>
            <span>Pieza/Área</span><span>Prestación</span><span className="text-right">P.Unit.</span>
            <span className="text-right">Cant.</span><span className="text-right">Dto%</span>
            <span className="text-right">Total</span><span/>
          </div>

          {/* Filas */}
          <div className="flex-1 overflow-y-auto" style={{maxHeight:300}}>
            {lines.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                <p className="text-[13px] text-[#9AA0B4]">Sin ítems aún</p>
                <p className="text-[12px] text-[#9AA0B4] mt-1">Selecciona una prestación y haz click en un diente o en un área</p>
              </div>
            ) : lines.map((l,i)=>(
              <div key={l._key} className="grid items-center border-b border-[#F0F2F7] px-4 py-2.5 hover:bg-[#F8F9FC]"
                style={{gridTemplateColumns:"56px 1fr 70px 50px 50px 70px 24px"}}>
                <span className="text-[12px] font-semibold text-[#0057FF] truncate pr-1">
                  {l.toothNum ? fmtTooth(l.toothNum) : (l.area||"—")}
                </span>
                <input className="text-[12px] bg-transparent border-0 outline-none text-[#1A1D2E] font-medium truncate min-w-0 pr-1"
                  value={l.description} onChange={e=>updateLine(i,"description",e.target.value)}/>
                <input type="number" min="0"
                  className="text-[12px] bg-transparent border border-[#E3E8F0] rounded-lg px-2 py-1 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  value={l.unitPrice} onChange={e=>updateLine(i,"unitPrice",parseFloat(e.target.value)||0)}/>
                <input type="number" min="1"
                  className="text-[12px] bg-transparent border border-[#E3E8F0] rounded-lg px-2 py-1 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  value={l.quantity} onChange={e=>updateLine(i,"quantity",parseInt(e.target.value)||1)}/>
                <input type="number" min="0" max="100"
                  className="text-[12px] bg-transparent border border-[#E3E8F0] rounded-lg px-2 py-1 text-right text-[#1A1D2E] w-full focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  value={l.discount} onChange={e=>updateLine(i,"discount",parseFloat(e.target.value)||0)}/>
                <span className="text-[13px] font-bold text-right text-[#1A1D2E]">{fmtN(l.total)}</span>
                <button onClick={()=>setLines(prev=>prev.filter((_,j)=>j!==i))}
                  className="text-[#D4C4A0] hover:text-red-500 transition-colors flex justify-center ml-1">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>

          {/* Agregar manual */}
          <div className="px-4 py-2 border-t border-[#F0F2F7]">
            <button onClick={()=>setLines(prev=>[...prev,{_key:`${Date.now()}`,surfaces:[],description:"",quantity:1,unitPrice:0,discount:0,total:0}])}
              className="flex items-center gap-1.5 text-[12px] text-[#0057FF] hover:text-[#0041CC] transition-colors font-medium">
              <Plus size={13}/> Agregar ítem manualmente
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
                className="w-28 text-right border border-[#E3E8F0] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white font-medium"
                value={gDiscount} onChange={e=>setGDiscount(parseFloat(e.target.value)||0)}/>
            </div>
            <div className="flex justify-between font-bold text-[16px] border-t border-[#E3E8F0] pt-3 text-[#1A1D2E]">
              <span>Total</span><span className="text-[#0057FF]">{fmtN(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones + botones */}
      <div className="border-t border-[#E3E8F0] px-5 py-4 flex gap-4 items-start flex-wrap bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Observaciones del presupuesto</label>
          <textarea className="w-full text-[13px] border border-[#E3E8F0] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#0057FF] resize-none"
            rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas adicionales..."/>
        </div>
        <div className="flex items-center gap-2.5 pt-6 flex-shrink-0">
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
