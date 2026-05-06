"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Mail, Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Appointment {
  id: string; date: string; startTime: string; endTime: string;
  type: string; status: string; box: number; notes: string;
  confirmationToken: string | null;
  patient: { id: string; firstName: string; lastName: string; phone: string; email: string };
  user: { id: string; name: string };
}

const TYPES = ["Consulta General","Limpieza Dental","Extracción","Endodoncia","Ortodoncia","Implante","Blanqueamiento","Urgencia","Estética Facial"];
const STATUS_OPTIONS = ["scheduled","confirmed","completed","cancelled","no-show"];
const HOURS = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2,"0")}:00`);

function today() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}

const initForm = { patientId:"", userId:"", date: today(), startTime:"09:00", endTime:"10:00", type:"Consulta General", status:"scheduled", box:1, notes:"" };

export default function Agenda() {
  const [date, setDate] = useState(today());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/appointments?date=${date}`);
    if (r.ok) setAppointments(await r.json());
  }, [date]);

  useEffect(() => {
    load();
    Promise.all([fetch("/api/patients").then(r=>r.json()), fetch("/api/users").then(r=>r.json())])
      .then(([p,u]) => { setPatients(p); setUsers(u); });
  }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  async function sendReminder(apptId: string, channel: "whatsapp"|"email") {
    setReminderLoading(apptId + channel);
    const r = await fetch("/api/reminders/send", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ appointmentId: apptId, channel }),
    });
    const d = await r.json();
    setReminderLoading(null);
    if (channel === "whatsapp" && d.url) {
      window.open(d.url, "_blank");
    } else if (d.ok) {
      showToast("✅ Email enviado correctamente");
    } else {
      showToast(`❌ ${d.error}`);
    }
    load();
  }

  async function save() {
    setSaving(true);
    if (selected) {
      await fetch(`/api/appointments/${selected.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    } else {
      await fetch("/api/appointments", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    }
    setOpen(false); setSelected(null); setForm(initForm); load();
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });
    load();
  }

  function openNew(hour?: string) {
    setForm({...initForm, date, startTime: hour??"09:00", endTime: hour?`${String(parseInt(hour)+1).padStart(2,"0")}:00`:"10:00"});
    setSelected(null); setOpen(true);
  }

  function openEdit(a: Appointment) {
    setForm({ patientId:a.patient.id, userId:a.user.id, date:a.date, startTime:a.startTime, endTime:a.endTime, type:a.type, status:a.status, box:a.box, notes:a.notes??""});
    setSelected(a); setOpen(true);
  }

  const set = (k:string, v:string|number) => setForm(f=>({...f,[k]:v}));

  const weekDays = Array.from({length:7}, (_,i) => addDays(date, i - new Date(date+"T12:00:00").getDay()));

  const colorMap: Record<string,string> = {
    scheduled:"bg-blue-50 border-blue-300 text-blue-800",
    confirmed:"bg-emerald-50 border-emerald-300 text-emerald-800",
    completed:"bg-slate-100 border-slate-300 text-slate-600",
    cancelled:"bg-red-50 border-red-300 text-red-700",
    "no-show":"bg-amber-50 border-amber-300 text-amber-800",
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-muted capitalize">{new Date(date+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <button onClick={() => openNew()} className="btn-primary"><Plus size={16}/> Nueva Cita</button>
      </div>

      {/* Week navigator */}
      <div className="card p-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(d=>addDays(d,-7))} className="btn-secondary px-2 py-1.5"><ChevronLeft size={16}/></button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const dt = new Date(d+"T12:00:00");
              const isSel = d===date, isTd = d===today();
              return (
                <button key={d} onClick={() => setDate(d)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs transition-all ${isSel?"bg-blue-600 text-white":isTd?"bg-blue-50 text-blue-700":"hover:bg-slate-50 text-slate-600"}`}>
                  <span className="font-medium">{dt.toLocaleDateString("es-CL",{weekday:"short"}).slice(0,3)}</span>
                  <span className={`text-base font-bold mt-0.5 ${isSel?"text-white":""}`}>{dt.getDate()}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setDate(d=>addDays(d,7))} className="btn-secondary px-2 py-1.5"><ChevronRight size={16}/></button>
          <button onClick={() => setDate(today())} className="btn-secondary text-xs px-3">Hoy</button>
        </div>
      </div>

      {/* Schedule */}
      <div className="card overflow-hidden">
        <div className="grid" style={{gridTemplateColumns:"64px 1fr"}}>
          <div className="border-r border-slate-100">
            <div className="h-10 border-b border-slate-100"/>
            {HOURS.map(h=>(
              <div key={h} className="h-16 border-b border-slate-50 px-2 flex items-start pt-1">
                <span className="text-xs text-slate-400">{h}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="h-10 border-b border-slate-100 flex items-center px-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{appointments.length} cita{appointments.length!==1?"s":""}</span>
            </div>
            <div className="relative">
              {HOURS.map(h=>(
                <div key={h} className="h-16 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={()=>openNew(h)}/>
              ))}
              {appointments.map(a=>{
                const [sh,sm]=a.startTime.split(":").map(Number);
                const [eh,em]=a.endTime.split(":").map(Number);
                const top=((sh-8)*60+sm)*(64/60);
                const height=Math.max(((eh-sh)*60+(em-sm))*(64/60),40);
                return (
                  <div key={a.id} className={`absolute left-2 right-2 rounded-lg border px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity ${colorMap[a.status]??colorMap.scheduled}`}
                    style={{top:`${top}px`,height:`${height}px`}} onClick={e=>{e.stopPropagation();openEdit(a);}}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{a.patient.firstName} {a.patient.lastName}</p>
                        <p className="text-xs truncate opacity-75">{a.type}</p>
                      </div>
                      <span className="text-xs opacity-60 flex-shrink-0">{a.startTime}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment list with reminders */}
      {appointments.length>0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="section-title">Citas del día</h2>
            <p className="text-xs text-slate-400">Haz clic en WhatsApp o Email para enviar recordatorio</p>
          </div>
          <div className="divide-y divide-slate-100">
            {appointments.map(a=>(
              <div key={a.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                <div className="w-16 text-center">
                  <p className="text-sm font-bold text-slate-900">{a.startTime}</p>
                  <p className="text-xs text-slate-400">{a.endTime}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{a.box}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{a.patient.firstName} {a.patient.lastName}</p>
                  <p className="text-xs text-slate-500">{a.type} · {a.user.name}</p>
                </div>
                {a.confirmationToken && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <Check size={11}/> Enlace enviado
                  </span>
                )}
                <Badge value={a.status}/>
                {/* Reminder buttons */}
                <div className="flex gap-1">
                  <button title={a.patient.phone ? "Enviar WhatsApp" : "Sin teléfono"} disabled={!a.patient.phone || reminderLoading===a.id+"whatsapp"}
                    onClick={() => sendReminder(a.id,"whatsapp")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${a.patient.phone?"bg-green-500 text-white hover:bg-green-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                    <MessageCircle size={13}/> WA
                  </button>
                  <button title={a.patient.email ? "Enviar Email" : "Sin email"} disabled={!a.patient.email || reminderLoading===a.id+"email"}
                    onClick={() => sendReminder(a.id,"email")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${a.patient.email?"bg-blue-500 text-white hover:bg-blue-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                    <Mail size={13}/> Email
                  </button>
                </div>
                <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={a.status} onChange={e=>updateStatus(a.id,e.target.value)}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={open} onClose={()=>setOpen(false)} title={selected?"Editar Cita":"Nueva Cita"}>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Paciente *</label>
            <select className="select" value={form.patientId} onChange={e=>set("patientId",e.target.value)}>
              <option value="">Seleccionar paciente...</option>
              {patients.map(p=><option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Profesional *</label>
            <select className="select" value={form.userId} onChange={e=>set("userId",e.target.value)}>
              <option value="">Seleccionar profesional...</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Fecha</label><input className="input" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
            <div><label className="label">Inicio</label><input className="input" type="time" value={form.startTime} onChange={e=>set("startTime",e.target.value)}/></div>
            <div><label className="label">Fin</label><input className="input" type="time" value={form.endTime} onChange={e=>set("endTime",e.target.value)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de atención</label>
              <select className="select" value={form.type} onChange={e=>set("type",e.target.value)}>
                {TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Box</label>
              <select className="select" value={form.box} onChange={e=>set("box",parseInt(e.target.value))}>
                {[1,2,3,4].map(b=><option key={b} value={b}>Box {b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving||!form.patientId||!form.userId}>
            {saving?"Guardando...":selected?"Actualizar":"Agendar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
