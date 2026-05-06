"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, FileText, Printer } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Treatment { id:string; name:string; category:string; price:number }
interface BudgetItem { description:string; tooth:string; area:string; quantity:number; unitPrice:number; discount:number; total:number }
interface Budget {
  id:string; number:number; date:string; validUntil:string; status:string;
  subtotal:number; discount:number; total:number; notes:string;
  patient:{id:string;firstName:string;lastName:string;rut:string;phone:string;address:string};
  user:{name:string};
  items:Array<{id:string;description:string;tooth:string;area:string;quantity:number;unitPrice:number;discount:number;total:number}>;
  payments:Array<{amount:number}>;
}

function fmt(n:number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }
const initItem = ():BudgetItem => ({description:"",tooth:"",area:"",quantity:1,unitPrice:0,discount:0,total:0});

const AREAS = ["","Maxilar superior","Maxilar inferior","Ambos maxilares","Anterior superior","Anterior inferior","Posterior superior","Posterior inferior"];

export default function Presupuestos() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string|null>(null);
  const [patients, setPatients] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [clinicCfg, setClinicCfg] = useState<Record<string,string>>({});
  const [form, setForm] = useState({ patientId:"", userId:"", date:new Date().toISOString().split("T")[0], validUntil:new Date(Date.now()+30*86400000).toISOString().split("T")[0], status:"pending", discount:0, notes:"" });
  const [items, setItems] = useState<BudgetItem[]>([initItem()]);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  async function load() {
    const q = filter!=="all"?`?status=${filter}`:"";
    const [br,pr,ur,tr,cr] = await Promise.all([
      fetch(`/api/budgets${q}`), fetch("/api/patients"), fetch("/api/users"),
      fetch("/api/treatments"), fetch("/api/clinic-config"),
    ]);
    if(br.ok) setBudgets(await br.json());
    if(pr.ok) setPatients(await pr.json());
    if(ur.ok) setUsers(await ur.json());
    if(tr.ok) setTreatments(await tr.json());
    if(cr.ok) setClinicCfg(await cr.json());
  }

  useEffect(()=>{ load(); },[filter]);

  function applyTreatment(i:number, t:Treatment) {
    setItems(items=>items.map((item,idx)=>{ if(idx!==i) return item; const total=t.price*item.quantity*(1-item.discount/100); return {...item,description:t.name,unitPrice:t.price,total}; }));
  }

  function updateItem(i:number, k:keyof BudgetItem, v:string|number) {
    setItems(items=>items.map((item,idx)=>{
      if(idx!==i) return item;
      const updated={...item,[k]:v};
      if(["quantity","unitPrice","discount"].includes(k)) {
        updated.total=Number(updated.quantity)*Number(updated.unitPrice)*(1-Number(updated.discount)/100);
      }
      return updated;
    }));
  }

  const subtotal=items.reduce((s,i)=>s+i.total,0);
  const total=subtotal-Number(form.discount);

  async function save() {
    setSaving(true);
    await fetch("/api/budgets",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...form,subtotal,total,items}) });
    setOpen(false); load(); setSaving(false);
  }

  async function changeStatus(id:string, status:string) {
    await fetch(`/api/budgets/${id}`,{ method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
    load();
  }

  function printBudget() {
    const w=window.open("","_blank");
    if(!w||!detail) return;
    const paid=detail.payments.reduce((s,p)=>s+p.amount,0);
    w.document.write(`
    <html><head><title>Presupuesto #${detail.number}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:750px;margin:40px auto;color:#1f2937;font-size:14px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
      .clinic-name{font-size:22px;font-weight:bold;color:#2563eb}
      .clinic-info{font-size:12px;color:#6b7280;line-height:1.6}
      .budget-title{font-size:18px;font-weight:bold;color:#1f2937;margin-bottom:4px}
      .patient-box{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
      .totals{float:right;min-width:220px}
      .total-row{display:flex;justify-content:space-between;padding:4px 0}
      .grand-total{font-size:16px;font-weight:bold;border-top:2px solid #2563eb;padding-top:8px;margin-top:4px}
      .notes{margin-top:24px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;color:#6b7280}
      .footer{margin-top:32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
      @media print{body{margin:20px}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="clinic-name">${clinicCfg.clinic_name??"Clínica Magna"}</div>
        <div class="clinic-info">
          ${clinicCfg.clinic_address?`📍 ${clinicCfg.clinic_address}<br>`:""}
          ${clinicCfg.clinic_phone?`📞 ${clinicCfg.clinic_phone}<br>`:""}
          ${clinicCfg.clinic_email?`✉ ${clinicCfg.clinic_email}`:""}
        </div>
      </div>
      <div style="text-align:right">
        <div class="budget-title">PRESUPUESTO #${String(detail.number).padStart(4,"0")}</div>
        <div style="font-size:12px;color:#6b7280">Fecha: ${detail.date}</div>
        ${detail.validUntil?`<div style="font-size:12px;color:#6b7280">Válido hasta: ${detail.validUntil}</div>`:""}
        <div style="margin-top:6px;padding:4px 10px;background:${detail.status==="approved"?"#d1fae5":"#fef9c3"};border-radius:20px;font-size:12px;font-weight:bold;color:${detail.status==="approved"?"#065f46":"#92400e"}">${detail.status==="approved"?"APROBADO":"PENDIENTE"}</div>
      </div>
    </div>
    <div class="patient-box">
      <strong>Paciente:</strong> ${detail.patient.firstName} ${detail.patient.lastName} ·
      <strong>RUT:</strong> ${detail.patient.rut}
      ${detail.patient.phone?`· <strong>Tel:</strong> ${detail.patient.phone}`:""}
      ${detail.patient.address?`<br>${detail.patient.address}`:""}
    </div>
    <table>
      <thead><tr><th>Tratamiento</th><th>Diente/Área</th><th style="text-align:center">Cant.</th><th style="text-align:right">P. Unit.</th><th style="text-align:right">Dto.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${detail.items.map(item=>`
        <tr><td>${item.description}</td><td>${item.tooth||item.area||"—"}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${fmt(item.unitPrice)}</td><td style="text-align:right">${item.discount||0}%</td><td style="text-align:right"><strong>${fmt(item.total)}</strong></td></tr>
      `).join("")}</tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal:</span><span>${fmt(detail.subtotal)}</span></div>
      ${detail.discount>0?`<div class="total-row" style="color:#dc2626"><span>Descuento:</span><span>-${fmt(detail.discount)}</span></div>`:""}
      <div class="total-row grand-total"><span>TOTAL:</span><span>${fmt(detail.total)}</span></div>
      <div class="total-row" style="color:#059669"><span>Abonado:</span><span>${fmt(paid)}</span></div>
      <div class="total-row" style="color:#dc2626;font-weight:bold"><span>Saldo:</span><span>${fmt(detail.total-paid)}</span></div>
    </div>
    <div style="clear:both"></div>
    ${detail.notes?`<div class="notes"><strong>Observaciones:</strong> ${detail.notes}</div>`:""}
    <div class="footer">${clinicCfg.clinic_name??"Clínica Magna"} · ${clinicCfg.clinic_address??""} · ${clinicCfg.clinic_phone??""}<br>
    Los precios incluyen IVA cuando corresponde. Presupuesto válido por 30 días desde la fecha de emisión.</div>
    </body></html>`);
    w.document.close(); w.print();
  }

  const detail = detailId ? budgets.find(b=>b.id===detailId) : null;
  const filters=[{k:"all",l:"Todos"},{k:"pending",l:"Pendientes"},{k:"approved",l:"Aprobados"},{k:"rejected",l:"Rechazados"}];
  const byCategory = treatments.reduce<Record<string,Treatment[]>>((acc,t)=>{ (acc[t.category]??=[]).push(t); return acc; },{});

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Presupuestos</h1><p className="text-muted">{budgets.length} presupuestos</p></div>
        <button onClick={()=>setOpen(true)} className="btn-primary"><Plus size={16}/> Nuevo Presupuesto</button>
      </div>

      <div className="flex gap-2">
        {filters.map(({k,l})=>(
          <button key={k} onClick={()=>setFilter(k)} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filter===k?"bg-blue-600 text-white":"bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100"><tr>
            <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">N°</th>
            <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
            <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Fecha</th>
            <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Total</th>
            <th className="text-center px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Abonado</th>
            <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
            <th className="px-4 py-3"/>
          </tr></thead>
          <tbody>
            {budgets.length===0?<tr><td colSpan={7} className="px-5 py-12 text-center text-muted">No hay presupuestos</td></tr>:
              budgets.map(b=>{
                const paid=b.payments.reduce((s,p)=>s+p.amount,0);
                const pct=b.total>0?Math.round((paid/b.total)*100):0;
                return (
                  <tr key={b.id} className="table-row cursor-pointer" onClick={()=>setDetailId(b.id)}>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">#{String(b.number).padStart(4,"0")}</td>
                    <td className="px-4 py-3.5"><p className="font-medium text-slate-900">{b.patient.firstName} {b.patient.lastName}</p><p className="text-xs text-slate-400 font-mono">{b.patient.rut}</p></td>
                    <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">{b.date}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmt(b.total)}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{width:`${pct}%`}}/></div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5" onClick={e=>e.stopPropagation()}>
                      <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={b.status} onChange={e=>changeStatus(b.id,e.target.value)}>
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                        <option value="expired">Vencido</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5"><FileText size={15} className="text-slate-400"/></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detail&&(
        <Modal open={!!detailId} onClose={()=>setDetailId(null)} title={`Presupuesto #${String(detail.number).padStart(4,"0")}`} size="xl">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500">Paciente</p><p className="font-semibold text-slate-900">{detail.patient.firstName} {detail.patient.lastName}</p><p className="text-xs text-slate-400 font-mono">{detail.patient.rut}</p></div>
              <div><p className="text-xs text-slate-500">Profesional</p><p className="font-semibold text-slate-900">{detail.user.name}</p></div>
              <div><p className="text-xs text-slate-500">Fecha</p><p className="text-sm text-slate-800">{detail.date}</p></div>
              <div><p className="text-xs text-slate-500">Válido hasta</p><p className="text-sm text-slate-800">{detail.validUntil??"—"}</p></div>
            </div>
            <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-4 py-2.5 text-xs text-slate-500">Tratamiento</th>
                <th className="text-center px-3 py-2.5 text-xs text-slate-500">Diente/Área</th>
                <th className="text-center px-3 py-2.5 text-xs text-slate-500">Cant.</th>
                <th className="text-right px-3 py-2.5 text-xs text-slate-500">P. Unit.</th>
                <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total</th>
              </tr></thead>
              <tbody>{detail.items.map(item=>(
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{item.tooth||item.area||"—"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{fmt(item.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(item.total)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="flex justify-end">
              <div className="space-y-1.5 text-sm min-w-48">
                <div className="flex justify-between gap-8"><span className="text-slate-500">Subtotal</span><span>{fmt(detail.subtotal)}</span></div>
                {detail.discount>0&&<div className="flex justify-between"><span className="text-slate-500">Descuento</span><span className="text-red-600">-{fmt(detail.discount)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-1.5"><span>Total</span><span>{fmt(detail.total)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Abonado</span><span>{fmt(detail.payments.reduce((s,p)=>s+p.amount,0))}</span></div>
                <div className="flex justify-between font-semibold text-red-600"><span>Saldo</span><span>{fmt(detail.total-detail.payments.reduce((s,p)=>s+p.amount,0))}</span></div>
              </div>
            </div>
            {detail.notes&&<p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3">{detail.notes}</p>}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
            <Badge value={detail.status}/>
            <div className="flex gap-3">
              <button onClick={printBudget} className="btn-secondary text-xs"><Printer size={13}/> Imprimir</button>
              <button className="btn-secondary" onClick={()=>setDetailId(null)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* New budget modal */}
      <Modal open={open} onClose={()=>setOpen(false)} title="Nuevo Presupuesto" size="xl">
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Paciente *</label>
              <select className="select" value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {patients.map(p=><option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={form.userId} onChange={e=>setForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><label className="label">Fecha</label><input className="input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <div><label className="label">Válido hasta</label><input className="input" type="date" value={form.validUntil} onChange={e=>setForm(f=>({...f,validUntil:e.target.value}))}/></div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Tratamientos</label>
              <button onClick={()=>setItems(i=>[...i,initItem()])} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> Agregar ítem</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Prestación</th>
                  <th className="text-center px-2 py-2 text-xs text-slate-500 w-24">Diente</th>
                  <th className="text-center px-2 py-2 text-xs text-slate-500 w-36">Área</th>
                  <th className="text-center px-2 py-2 text-xs text-slate-500 w-14">Cant.</th>
                  <th className="text-right px-2 py-2 text-xs text-slate-500 w-28">P. Unit.</th>
                  <th className="text-right px-2 py-2 text-xs text-slate-500 w-20">Dto.%</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-500 w-28">Total</th>
                  <th className="w-8"/>
                </tr></thead>
                <tbody>
                  {items.map((item,i)=>(
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input className="input py-1 text-xs flex-1" value={item.description}
                            onChange={e=>updateItem(i,"description",e.target.value)} placeholder="Descripción..."/>
                          {treatments.length>0&&(
                            <select className="input py-1 text-xs w-28" onChange={e=>{ const t=treatments.find(t=>t.id===e.target.value); if(t) applyTreatment(i,t); e.target.value=""; }}>
                              <option value="">Catálogo</option>
                              {Object.entries(byCategory).map(([cat,ts])=>(
                                <optgroup key={cat} label={cat}>
                                  {ts.map(t=><option key={t.id} value={t.id}>{t.name} ({fmt(t.price)})</option>)}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5"><input className="input py-1 text-xs text-center" value={item.tooth} onChange={e=>updateItem(i,"tooth",e.target.value)} placeholder="ej: 16"/></td>
                      <td className="px-2 py-1.5">
                        <select className="input py-1 text-xs" value={item.area} onChange={e=>updateItem(i,"area",e.target.value)}>
                          {AREAS.map(a=><option key={a} value={a}>{a||"—"}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input className="input py-1 text-xs text-center" type="number" min="1" value={item.quantity} onChange={e=>updateItem(i,"quantity",parseInt(e.target.value)||1)}/></td>
                      <td className="px-2 py-1.5"><input className="input py-1 text-xs text-right" type="number" min="0" value={item.unitPrice} onChange={e=>updateItem(i,"unitPrice",parseFloat(e.target.value)||0)}/></td>
                      <td className="px-2 py-1.5"><input className="input py-1 text-xs text-right" type="number" min="0" max="100" value={item.discount} onChange={e=>updateItem(i,"discount",parseFloat(e.target.value)||0)}/></td>
                      <td className="px-3 py-1.5 text-right text-sm font-medium">{fmt(item.total)}</td>
                      <td className="px-2"><button onClick={()=>setItems(its=>its.filter((_,idx)=>idx!==i))} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="space-y-2 min-w-48 text-sm">
              <div className="flex justify-between gap-8"><span className="text-slate-500">Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Descuento ($)</span>
                <input className="input py-1 text-right w-32" type="number" min="0" value={form.discount} onChange={e=>setForm(f=>({...f,discount:parseFloat(e.target.value)||0}))}/>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-2"><span>Total</span><span>{fmt(total)}</span></div>
            </div>
          </div>
          <div><label className="label">Observaciones del presupuesto</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving||!form.patientId||!form.userId||items.every(i=>!i.description)}>
            {saving?"Guardando...":"Crear Presupuesto"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
