"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Phone, Mail, MapPin, Heart, Plus, Trash2, Upload, FileIcon, ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import DentalChart from "@/components/odontogram/DentalChart";
import FacialChart from "@/components/odontogram/FacialChart";

interface Patient {
  id: string; rut: string; firstName: string; lastName: string;
  email: string; phone: string; gender: string; address: string; city: string;
  healthInsurance: string; birthDate: string; notes: string;
  clinicalRecord?: { bloodType:string; allergies:string; currentMedications:string; medicalBackground:string; dentalBackground:string; habits:string; observations:string };
  evolutions: Array<{ id:string; date:string; diagnosis:string; treatment:string; tooth:string; observations:string; cost:number; user:{name:string} }>;
  budgets: Array<{ id:string; number:number; date:string; status:string; total:number; discount:number; items:Array<{id:string;description:string;tooth:string;area:string;quantity:number;unitPrice:number;total:number}>; payments:Array<{amount:number}>; user:{name:string} }>;
  payments: Array<{ id:string; date:string; amount:number; method:string; notes:string }>;
  appointments: Array<{ id:string; date:string; startTime:string; type:string; status:string; user:{name:string} }>;
  documents: Array<{ id:string; name:string; type:string; fileName:string; mimeType:string; size:number; createdAt:string }>;
}

const tabs = ["Datos","Ficha Clínica","Odontograma","Estética Facial","Evoluciones","Presupuestos","Pagos","Documentos","Citas"];

function fmt(n:number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }

export default function PatientDetail() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient|null>(null);
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
  const [evoModal, setEvoModal] = useState(false);
  const [evoForm, setEvoForm] = useState({ date:new Date().toISOString().split("T")[0], diagnosis:"", treatment:"", tooth:"", observations:"", cost:"", userId:"" });
  const [saving, setSaving] = useState(false);
  const [odontogram, setOdontogram] = useState<Record<string,{condition:string;notes:string}>>({});
  const [facial, setFacial] = useState<Record<string,{treatment:string;units:number;notes:string}>>({});
  const [oSaving, setOSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("radiografia");

  async function load() {
    const [pr, ur, or_, fr] = await Promise.all([
      fetch(`/api/patients/${id}`), fetch("/api/users"),
      fetch(`/api/odontogram?patientId=${id}`),
      fetch(`/api/facial?patientId=${id}`),
    ]);
    if (pr.ok) setPatient(await pr.json());
    if (ur.ok) setUsers(await ur.json());
    if (or_.ok) setOdontogram(await or_.json());
    if (fr.ok) setFacial(await fr.json());
  }

  useEffect(() => { load(); }, [id]);

  async function saveEvo() {
    setSaving(true);
    await fetch("/api/evolutions", { method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...evoForm, patientId:id, cost:parseFloat(evoForm.cost)||0}) });
    setEvoModal(false); load(); setSaving(false);
  }

  async function saveOdontogram() {
    setOSaving(true);
    await fetch("/api/odontogram", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({patientId:id, data:odontogram}) });
    setOSaving(false);
  }

  async function saveFacial() {
    setOSaving(true);
    await fetch("/api/facial", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({patientId:id, data:facial}) });
    setOSaving(false);
  }

  async function uploadDoc(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("patientId", id);
    fd.append("type", docType);
    fd.append("name", file.name);
    await fetch("/api/documents", { method:"POST", body:fd });
    load(); setUploading(false);
  }

  async function deleteDoc(docId: string) {
    if (!confirm("¿Eliminar documento?")) return;
    await fetch(`/api/documents/${docId}`, { method:"DELETE" });
    load();
  }

  if (!patient) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const age = patient.birthDate ? Math.floor((Date.now()-new Date(patient.birthDate).getTime())/(1000*60*60*24*365.25)) : null;
  const paidTotal = patient.payments.reduce((s,p)=>s+p.amount,0);

  const docIcons: Record<string,string> = { radiografia:"🦷", examen:"🧪", consentimiento:"📄", foto:"📷", other:"📎" };

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <button onClick={()=>router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-3 transition-colors">
          <ArrowLeft size={16}/> Volver a pacientes
        </button>
        <div className="card p-5">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">{patient.firstName[0]}{patient.lastName[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
                  <p className="text-slate-500 text-sm mt-0.5 font-mono">{patient.rut}{age?` · ${age} años`:""}</p>
                </div>
                <button className="btn-secondary text-xs flex-shrink-0"><Edit2 size={13}/> Editar</button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                {patient.phone&&<span className="flex items-center gap-1.5 text-sm text-slate-600"><Phone size={14} className="text-slate-400"/>{patient.phone}</span>}
                {patient.email&&<span className="flex items-center gap-1.5 text-sm text-slate-600"><Mail size={14} className="text-slate-400"/>{patient.email}</span>}
                {(patient.address||patient.city)&&<span className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} className="text-slate-400"/>{[patient.address,patient.city].filter(Boolean).join(", ")}</span>}
                {patient.healthInsurance&&<span className="flex items-center gap-1.5 text-sm text-slate-600"><Heart size={14} className="text-slate-400"/>{patient.healthInsurance}</span>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center flex-shrink-0 hidden lg:grid">
              {[["Citas",patient.appointments.length,"bg-slate-50"],["Evoluc.",patient.evolutions.length,"bg-slate-50"],["Docs",patient.documents.length,"bg-slate-50"],[fmt(paidTotal),"pagado","bg-emerald-50"]].map(([v,l,bg],i)=>(
                <div key={i} className={`px-3 py-2 ${bg} rounded-xl`}>
                  <p className={`text-sm font-bold ${i===3?"text-emerald-700":"text-slate-900"}`}>{v}</p>
                  <p className="text-xs text-slate-500">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {tabs.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===i?"border-blue-600 text-blue-600":"border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* === TAB 0: DATOS === */}
      {tab===0&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["Datos Personales",[["RUT",patient.rut],["Nombre",`${patient.firstName} ${patient.lastName}`],["Género",patient.gender==="M"?"Masculino":"Femenino"],["Fecha nac.",patient.birthDate?new Date(patient.birthDate).toLocaleDateString("es-CL"):"—"],["Edad",age?`${age} años`:"—"]]],
            ["Contacto",[["Teléfono",patient.phone||"—"],["Email",patient.email||"—"],["Dirección",patient.address||"—"],["Ciudad",patient.city||"—"]]],
            ["Previsión",[["Previsión",patient.healthInsurance||"—"]]],
            ["Notas",[[null,patient.notes||"Sin observaciones"]]]
          ].map(([title,rows])=>(
            <div key={title as string} className="card p-5">
              <h3 className="section-title mb-3">{title as string}</h3>
              <dl className="space-y-2">
                {(rows as [string|null,string][]).map(([k,v],i)=>(
                  <div key={i} className={k?"flex justify-between gap-4":""}>
                    {k&&<dt className="text-sm text-slate-500">{k}</dt>}
                    <dd className="text-sm font-medium text-slate-800 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* === TAB 1: FICHA CLÍNICA === */}
      {tab===1&&(
        <div className="card p-6">
          <h3 className="section-title mb-4">Ficha Clínica</h3>
          {!patient.clinicalRecord?<p className="text-muted">Sin ficha clínica registrada</p>:(
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[["Grupo sanguíneo",patient.clinicalRecord.bloodType],["Alergias",patient.clinicalRecord.allergies],["Medicamentos",patient.clinicalRecord.currentMedications],["Antec. médicos",patient.clinicalRecord.medicalBackground],["Antec. dentales",patient.clinicalRecord.dentalBackground],["Hábitos",patient.clinicalRecord.habits]].map(([l,v])=>(
                <div key={l as string}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{l}</p>
                  <p className="text-sm text-slate-800">{v||<span className="text-slate-400 italic">Sin registro</span>}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB 2: ODONTOGRAMA === */}
      {tab===2&&(
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Odontograma Dental</h3>
            <button onClick={saveOdontogram} disabled={oSaving} className="btn-primary text-xs">
              {oSaving?"Guardando...":"Guardar cambios"}
            </button>
          </div>
          <DentalChart data={odontogram} onChange={setOdontogram}/>
        </div>
      )}

      {/* === TAB 3: ESTÉTICA FACIAL === */}
      {tab===3&&(
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Mapa Facial — Estética</h3>
              <p className="text-xs text-slate-400 mt-0.5">Haz clic en una zona para registrar tratamiento</p>
            </div>
            <button onClick={saveFacial} disabled={oSaving} className="btn-primary text-xs">
              {oSaving?"Guardando...":"Guardar cambios"}
            </button>
          </div>
          <FacialChart data={facial} onChange={setFacial}/>
        </div>
      )}

      {/* === TAB 4: EVOLUCIONES === */}
      {tab===4&&(
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={()=>setEvoModal(true)} className="btn-primary"><Plus size={16}/> Nueva Evolución</button>
          </div>
          {patient.evolutions.length===0?<div className="card px-5 py-12 text-center text-muted">Sin evoluciones</div>:
            patient.evolutions.map(e=>(
              <div key={e.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs text-slate-500">{e.date} · {e.user.name}</p>
                    {e.tooth&&<span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">Diente {e.tooth}</span>}
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">{fmt(e.cost)}</p>
                </div>
                {e.diagnosis&&<p className="text-sm text-slate-600 mb-1"><span className="font-medium text-slate-800">Diagnóstico: </span>{e.diagnosis}</p>}
                <p className="text-sm text-slate-700"><span className="font-medium">Tratamiento: </span>{e.treatment}</p>
                {e.observations&&<p className="text-sm text-slate-500 mt-1.5 italic">{e.observations}</p>}
              </div>
            ))}
        </div>
      )}

      {/* === TAB 5: PRESUPUESTOS === */}
      {tab===5&&(
        <div className="space-y-3">
          {patient.budgets.length===0?<div className="card px-5 py-12 text-center text-muted">Sin presupuestos</div>:
            patient.budgets.map(b=>(
              <div key={b.id} className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div><p className="font-semibold text-slate-900">Presupuesto #{b.number}</p><p className="text-xs text-slate-500">{b.date} · {b.user.name}</p></div>
                  <div className="flex items-center gap-3"><Badge value={b.status}/><p className="text-lg font-bold text-slate-900">{fmt(b.total)}</p></div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr>
                    <th className="text-left px-5 py-2 text-xs text-slate-500">Tratamiento</th>
                    <th className="text-center px-3 py-2 text-xs text-slate-500 hidden sm:table-cell">Diente/Área</th>
                    <th className="text-right px-5 py-2 text-xs text-slate-500">Total</th>
                  </tr></thead>
                  <tbody>{b.items.map(item=>(
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-2 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2 text-center text-slate-500 hidden sm:table-cell">{item.tooth||item.area||"—"}</td>
                      <td className="px-5 py-2 text-right font-medium">{fmt(item.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">Abonado: {fmt(b.payments.reduce((s,p)=>s+p.amount,0))}</span>
                  <span className="font-bold text-slate-900">Total: {fmt(b.total)}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* === TAB 6: PAGOS === */}
      {tab===6&&(
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Método</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Notas</th>
            </tr></thead>
            <tbody>
              {patient.payments.length===0?<tr><td colSpan={4} className="px-5 py-10 text-center text-muted">Sin pagos</td></tr>:
                patient.payments.map(p=>(
                  <tr key={p.id} className="table-row">
                    <td className="px-5 py-3">{p.date}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{p.method}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.notes||"—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === TAB 7: DOCUMENTOS === */}
      {tab===7&&(
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <select className="select w-auto text-sm" value={docType} onChange={e=>setDocType(e.target.value)}>
              <option value="radiografia">Radiografía</option>
              <option value="examen">Examen</option>
              <option value="consentimiento">Consentimiento</option>
              <option value="foto">Fotografía</option>
              <option value="other">Otro</option>
            </select>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx"
              onChange={e=>{ if(e.target.files?.[0]) uploadDoc(e.target.files[0]); }}/>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="btn-primary text-sm">
              <Upload size={15}/> {uploading?"Subiendo...":"Subir documento"}
            </button>
            <p className="text-xs text-slate-400">PDF, JPG, PNG, DICOM, Word</p>
          </div>

          {patient.documents.length===0?
            <div className="card py-10 text-center text-muted">Sin documentos. Sube radiografías, exámenes o consentimientos.</div>:
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {patient.documents.map(doc=>(
                <div key={doc.id} className="card p-4 flex items-start gap-3">
                  <span className="text-2xl">{docIcons[doc.type]??docIcons.other}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{doc.type} · {doc.size?`${Math.round(doc.size/1024)} KB`:""}</p>
                    <p className="text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString("es-CL")}</p>
                  </div>
                  <div className="flex gap-1">
                    <a href={doc.fileName} target="_blank" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                      <ExternalLink size={13}/>
                    </a>
                    <button onClick={()=>deleteDoc(doc.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* === TAB 8: CITAS === */}
      {tab===8&&(
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Hora</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Profesional</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
            </tr></thead>
            <tbody>
              {patient.appointments.length===0?<tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Sin citas</td></tr>:
                patient.appointments.map(a=>(
                  <tr key={a.id} className="table-row">
                    <td className="px-5 py-3 text-slate-700">{a.date}</td>
                    <td className="px-4 py-3 text-slate-600">{a.startTime}</td>
                    <td className="px-4 py-3 text-slate-700">{a.type}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{a.user.name}</td>
                    <td className="px-4 py-3"><Badge value={a.status}/></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Evolution modal */}
      <Modal open={evoModal} onClose={()=>setEvoModal(false)} title="Nueva Evolución">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Fecha</label><input className="input" type="date" value={evoForm.date} onChange={e=>setEvoForm(f=>({...f,date:e.target.value}))}/></div>
            <div>
              <label className="label">Profesional</label>
              <select className="select" value={evoForm.userId} onChange={e=>setEvoForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Diagnóstico</label><input className="input" value={evoForm.diagnosis} onChange={e=>setEvoForm(f=>({...f,diagnosis:e.target.value}))}/></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><label className="label">Tratamiento *</label><input className="input" value={evoForm.treatment} onChange={e=>setEvoForm(f=>({...f,treatment:e.target.value}))}/></div>
            <div><label className="label">Diente</label><input className="input" placeholder="16, 25..." value={evoForm.tooth} onChange={e=>setEvoForm(f=>({...f,tooth:e.target.value}))}/></div>
          </div>
          <div><label className="label">Observaciones</label><textarea className="input resize-none" rows={3} value={evoForm.observations} onChange={e=>setEvoForm(f=>({...f,observations:e.target.value}))}/></div>
          <div><label className="label">Costo ($)</label><input className="input" type="number" placeholder="0" value={evoForm.cost} onChange={e=>setEvoForm(f=>({...f,cost:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setEvoModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveEvo} disabled={saving||!evoForm.treatment||!evoForm.userId}>
            {saving?"Guardando...":"Guardar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
