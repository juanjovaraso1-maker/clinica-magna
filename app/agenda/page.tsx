"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Mail, Check, Calendar } from "lucide-react";
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
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 - 21:00

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  scheduled:  { bg:"bg-blue-50",    border:"border-l-blue-500",   text:"text-blue-900",   dot:"bg-blue-500",   label:"Agendada" },
  confirmed:  { bg:"bg-emerald-50", border:"border-l-emerald-500",text:"text-emerald-900",dot:"bg-emerald-500", label:"Confirmada" },
  completed:  { bg:"bg-slate-100",  border:"border-l-slate-400",  text:"text-slate-600",  dot:"bg-slate-400",  label:"Completada" },
  cancelled:  { bg:"bg-red-50",     border:"border-l-red-400",    text:"text-red-700",    dot:"bg-red-400",    label:"Cancelada" },
  "no-show":  { bg:"bg-amber-50",   border:"border-l-amber-400",  text:"text-amber-800",  dot:"bg-amber-400",  label:"No asistió" },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}
function weekStart(d: string) {
  const dt = new Date(d + "T12:00:00");
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().split("T")[0];
}
function fmtDay(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });
}

const initForm = { patientId:"", userId:"", date: todayStr(), startTime:"09:00", endTime:"10:00", type:"Consulta General", status:"scheduled", box:1, notes:"" };

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"week"|"day">("week");

  const ws = weekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const load = useCallback(async () => {
    const url = view === "week"
      ? `/api/appointments?weekStart=${ws}&weekEnd=${weekDays[6]}`
      : `/api/appointments?date=${currentDate}`;
    const r = await fetch(url);
    if (r.ok) setAppointments(await r.json());
  }, [currentDate, view, ws]);

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
    if (channel === "whatsapp" && d.url) window.open(d.url, "_blank");
    else if (d.ok) showToast("✅ Email enviado correctamente");
    else showToast(`❌ ${d.error}`);
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

  function openNew(date?: string, hour?: string) {
    const d = date ?? currentDate;
    const h = hour ?? "09:00";
    const hNum = parseInt(h);
    setForm({ ...initForm, date: d, startTime: h, endTime: `${String(hNum+1).padStart(2,"0")}:00` });
    setSelected(null); setOpen(true);
  }

  function openEdit(a: Appointment) {
    setForm({ patientId:a.patient.id, userId:a.user.id, date:a.date, startTime:a.startTime, endTime:a.endTime, type:a.type, status:a.status, box:a.box, notes:a.notes??""});
    setSelected(a); setOpen(true);
  }

  const set = (k:string, v:string|number) => setForm(f=>({...f,[k]:v}));
  const today = todayStr();

  // Day view appointments
  const dayAppointments = appointments.filter(a => a.date === currentDate).sort((a,b)=>a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-4 max-w-7xl">
      {toast && <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-muted capitalize">{new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button onClick={()=>setView("week")} className={`px-3 py-2 font-medium transition-colors ${view==="week"?"bg-blue-600 text-white":"bg-white text-slate-600 hover:bg-slate-50"}`}>Semana</button>
            <button onClick={()=>setView("day")} className={`px-3 py-2 font-medium transition-colors ${view==="day"?"bg-blue-600 text-white":"bg-white text-slate-600 hover:bg-slate-50"}`}>Día</button>
          </div>
          <button onClick={() => openNew()} className="btn-primary text-sm"><Plus size={15}/> Nueva Cita</button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="card p-2 md:p-3">
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={()=>setCurrentDate(d=>addDays(d,-7))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16}/></button>
          <div className="flex-1 grid grid-cols-7 gap-0.5 md:gap-1">
            {weekDays.map((d) => {
              const isSelected = d === currentDate;
              const isToday = d === today;
              const count = appointments.filter(a=>a.date===d).length;
              const dt = new Date(d+"T12:00:00");
              return (
                <button key={d} onClick={() => { setCurrentDate(d); setView("day"); }}
                  className={`flex flex-col items-center py-2 px-0.5 rounded-xl transition-all ${isSelected?"bg-blue-600 text-white":isToday?"bg-blue-50 text-blue-700":"hover:bg-slate-50 text-slate-600"}`}>
                  <span className="text-xs font-medium capitalize">{dt.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").slice(0,3)}</span>
                  <span className={`text-lg font-bold leading-tight ${isSelected?"text-white":isToday?"text-blue-700":"text-slate-800"}`}>{dt.getDate()}</span>
                  {count > 0 && <span className={`text-xs font-semibold mt-0.5 ${isSelected?"text-blue-100":isToday?"text-blue-600":"text-slate-400"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setCurrentDate(d=>addDays(d,7))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16}/></button>
          <button onClick={()=>setCurrentDate(today)} className="hidden md:block btn-secondary text-xs px-3">Hoy</button>
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap gap-2 md:gap-3">
        {Object.entries(STATUS_STYLE).map(([k,s])=>(
          <div key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`}/>
            {s.label}
          </div>
        ))}
      </div>

      {/* Vista SEMANA */}
      {view==="week"&&(
        <div className="card overflow-auto">
          <div className="min-w-[600px]">
            {/* Header días */}
            <div className="grid border-b border-slate-200" style={{gridTemplateColumns:"52px repeat(7, 1fr)"}}>
              <div className="border-r border-slate-100"/>
              {weekDays.map(d=>{
                const isToday = d===today;
                const isSelected = d===currentDate;
                const dt = new Date(d+"T12:00:00");
                const count = appointments.filter(a=>a.date===d).length;
                return (
                  <div key={d} className={`py-2 px-1 text-center border-r border-slate-100 last:border-r-0 ${isToday?"bg-blue-50":""}`}>
                    <p className={`text-xs font-medium capitalize ${isToday?"text-blue-600":"text-slate-500"}`}>{dt.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").toUpperCase().slice(0,3)}</p>
                    <p className={`text-base font-bold ${isToday?"text-blue-700":"text-slate-800"}`}>{dt.getDate()}</p>
                    {count>0&&<p className={`text-xs ${isToday?"text-blue-500":"text-slate-400"}`}>{count} cita{count!==1?"s":""}</p>}
                  </div>
                );
              })}
            </div>
            {/* Grid horas */}
            <div className="relative">
              {HOURS.map(h=>(
                <div key={h} className="grid border-b border-slate-100" style={{gridTemplateColumns:"52px repeat(7, 1fr)", height:"56px"}}>
                  <div className="border-r border-slate-100 px-1.5 pt-1 flex-shrink-0">
                    <span className="text-xs text-slate-400">{String(h).padStart(2,"0")}:00</span>
                  </div>
                  {weekDays.map(d=>(
                    <div key={d} className={`border-r border-slate-100 last:border-r-0 hover:bg-slate-50/80 cursor-pointer transition-colors ${d===today?"bg-blue-50/30":""}`}
                      onClick={()=>openNew(d,`${String(h).padStart(2,"0")}:00`)}/>
                  ))}
                </div>
              ))}
              {/* Appointment blocks */}
              {appointments.map(a=>{
                const dayIdx = weekDays.indexOf(a.date);
                if(dayIdx===-1) return null;
                const [sh,sm]=a.startTime.split(":").map(Number);
                const [eh,em]=a.endTime.split(":").map(Number);
                const topPx=((sh-8)*60+sm)*(56/60);
                const heightPx=Math.max(((eh-sh)*60+(em-sm))*(56/60),28);
                const colW = `calc((100% - 52px) / 7)`;
                const leftPx = `calc(52px + ${dayIdx} * (100% - 52px) / 7 + 2px)`;
                const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                return (
                  <div key={a.id}
                    className={`absolute border-l-4 rounded-r-lg px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all shadow-sm ${s.bg} ${s.border} ${s.text}`}
                    style={{ top:`${topPx}px`, height:`${heightPx}px`, left:leftPx, width:`calc((100% - 52px) / 7 - 4px)` }}
                    onClick={e=>{e.stopPropagation();openEdit(a);}}>
                    <p className="text-xs font-semibold truncate leading-tight">{a.patient.firstName} {a.patient.lastName[0]}.</p>
                    {heightPx>36&&<p className="text-xs truncate opacity-75 leading-tight">{a.startTime} · {a.type.split(" ")[0]}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Vista DÍA */}
      {view==="day"&&(
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={()=>setCurrentDate(d=>addDays(d,-1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft size={16}/></button>
              <span className="text-sm font-semibold text-slate-800 capitalize">
                {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}
              </span>
              <button onClick={()=>setCurrentDate(d=>addDays(d,1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight size={16}/></button>
            </div>
            <span className="text-xs text-slate-400">{dayAppointments.length} cita{dayAppointments.length!==1?"s":""}</span>
          </div>
          <div className="grid" style={{gridTemplateColumns:"52px 1fr"}}>
            <div>
              {HOURS.map(h=>(
                <div key={h} className="h-14 border-b border-slate-50 px-1.5 pt-1">
                  <span className="text-xs text-slate-400">{String(h).padStart(2,"0")}:00</span>
                </div>
              ))}
            </div>
            <div className="relative border-l border-slate-100">
              {HOURS.map(h=>(
                <div key={h} className="h-14 border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                  onClick={()=>openNew(currentDate,`${String(h).padStart(2,"0")}:00`)}/>
              ))}
              {dayAppointments.map(a=>{
                const [sh,sm]=a.startTime.split(":").map(Number);
                const [eh,em]=a.endTime.split(":").map(Number);
                const top=((sh-8)*60+sm)*(56/60);
                const height=Math.max(((eh-sh)*60+(em-sm))*(56/60),32);
                const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                return (
                  <div key={a.id}
                    className={`absolute left-1 right-1 border-l-4 rounded-r-xl px-2 py-1 cursor-pointer hover:brightness-95 transition-all shadow-sm ${s.bg} ${s.border} ${s.text}`}
                    style={{top:`${top}px`,height:`${height}px`}}
                    onClick={e=>{e.stopPropagation();openEdit(a);}}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{a.patient.firstName} {a.patient.lastName}</p>
                        {height>40&&<p className="text-xs truncate opacity-75">{a.type} · {a.user.name.split(" ")[0]}</p>}
                      </div>
                      <span className="text-xs opacity-60 flex-shrink-0 font-medium">{a.startTime}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lista de citas del día */}
      {dayAppointments.length>0&&(
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="section-title">Citas del día — {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"short"})}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {dayAppointments.map(a=>{
              const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
              return (
                <div key={a.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 flex-wrap md:flex-nowrap">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${s.dot}`}/>
                  <div className="w-14 text-center flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{a.startTime}</p>
                    <p className="text-xs text-slate-400">{a.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-xs text-slate-500">{a.type} · {a.user.name} · Box {a.box}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {a.confirmationToken&&<span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><Check size={10}/> Confirmado</span>}
                    <button disabled={!a.patient.phone||reminderLoading===a.id+"whatsapp"} onClick={()=>sendReminder(a.id,"whatsapp")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${a.patient.phone?"bg-green-500 text-white hover:bg-green-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                      <MessageCircle size={12}/> WA
                    </button>
                    <button disabled={!a.patient.email||reminderLoading===a.id+"email"} onClick={()=>sendReminder(a.id,"email")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${a.patient.email?"bg-blue-500 text-white hover:bg-blue-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                      <Mail size={12}/> Email
                    </button>
                    <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      value={a.status} onChange={e=>updateStatus(a.id,e.target.value)}>
                      {STATUS_OPTIONS.map(s=><option key={s} value={s}>{STATUS_STYLE[s]?.label??s}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal nueva/editar cita */}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 md:col-span-1"><label className="label">Fecha</label><input className="input" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
            <div><label className="label">Inicio</label><input className="input" type="time" value={form.startTime} onChange={e=>set("startTime",e.target.value)}/></div>
            <div><label className="label">Fin</label><input className="input" type="time" value={form.endTime} onChange={e=>set("endTime",e.target.value)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
