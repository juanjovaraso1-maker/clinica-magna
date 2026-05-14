"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Mail, Check, Users, LayoutGrid, Calendar, Link2, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Appointment {
  id: string; date: string; startTime: string; endTime: string;
  type: string; status: string; box: number; notes: string;
  confirmationToken: string | null;
  patient: { id: string; firstName: string; lastName: string; phone: string; email: string };
  user: { id: string; name: string };
}

const TYPES = ["Odontología General","Estética Orofacial","Implantología","Rehabilitación Oral","Endodoncia","Periodoncia","Ortodoncia","Patología Oral","Cirugía Maxilofacial","Odontopediatría","Urgencia"];
const STATUS_OPTIONS = ["scheduled","confirmed","waiting","in_progress","completed","cancelled","no-show"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 - 20:00
const HOUR_H = 56; // px per hour

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string; solid: string }> = {
  scheduled: { bg:"bg-primary-50",  border:"border-l-primary-500", text:"text-primary-900", dot:"bg-primary-500", label:"Agendada",   solid:"bg-primary-500" },
  confirmed: { bg:"bg-emerald-50",  border:"border-l-emerald-500", text:"text-emerald-900", dot:"bg-emerald-500", label:"Confirmada", solid:"bg-emerald-500" },
  completed: { bg:"bg-slate-100",   border:"border-l-slate-400",   text:"text-slate-600",   dot:"bg-slate-400",   label:"Completada", solid:"bg-slate-400" },
  cancelled: { bg:"bg-red-50",      border:"border-l-red-400",     text:"text-red-700",     dot:"bg-red-400",     label:"Cancelada",  solid:"bg-red-400" },
  "no-show":    { bg:"bg-amber-50",   border:"border-l-amber-400",  text:"text-amber-800",   dot:"bg-amber-400",   label:"No asistió",        solid:"bg-amber-400" },
  waiting:      { bg:"bg-sky-50",    border:"border-l-sky-400",    text:"text-sky-800",     dot:"bg-sky-400",     label:"En sala de espera", solid:"bg-sky-400" },
  in_progress:  { bg:"bg-violet-50", border:"border-l-violet-500", text:"text-violet-800",  dot:"bg-violet-500",  label:"En atención",       solid:"bg-violet-500" },
};

// Palette for professionals (up to 6)
const USER_COLORS = [
  { header:"bg-primary-600",   light:"bg-primary-50",   text:"text-primary-700",  border:"border-l-primary-500" },
  { header:"bg-violet-600",    light:"bg-violet-50",    text:"text-violet-700",   border:"border-l-violet-500" },
  { header:"bg-blue-600",      light:"bg-blue-50",      text:"text-blue-700",     border:"border-l-blue-500" },
  { header:"bg-rose-600",      light:"bg-rose-50",      text:"text-rose-700",     border:"border-l-rose-500" },
  { header:"bg-amber-600",     light:"bg-amber-50",     text:"text-amber-700",    border:"border-l-amber-500" },
  { header:"bg-teal-600",      light:"bg-teal-50",      text:"text-teal-700",     border:"border-l-teal-500" },
];

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}
function weekStart(d: string) {
  const dt = new Date(d + "T12:00:00");
  const diff = dt.getDay() === 0 ? -6 : 1 - dt.getDay();
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().split("T")[0];
}
function timeToMin(t: string) { const [h,m] = t.split(":").map(Number); return h*60+m; }
function topPx(t: string) { return (timeToMin(t) - 8*60) * (HOUR_H/60); }
function heightPx(start: string, end: string) { return Math.max((timeToMin(end)-timeToMin(start))*(HOUR_H/60), 28); }

const initForm = { patientId:"", userId:"", date:todayStr(), startTime:"09:00", endTime:"10:00", type:"Odontología General", status:"scheduled", box:1, notes:"" };

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Appointment|null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [reminderLoading, setReminderLoading] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  const [view, setView] = useState<"week"|"day"|"multi">("multi");
  const [filterUserId, setFilterUserId] = useState("all");

  const ws = weekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = todayStr();

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

  async function copyLink(apptId: string) {
    const r = await fetch(`/api/appointments/${apptId}`);
    const d = await r.json();
    if (d.confirmationToken) {
      const url = `${window.location.origin}/confirmar/${d.confirmationToken}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      showToast(`🔗 Enlace copiado`);
      load();
    }
  }

  async function sendReminder(apptId: string, channel: "whatsapp"|"email") {
    setReminderLoading(apptId+channel);
    const r = await fetch("/api/reminders/send", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ appointmentId:apptId, channel }),
    });
    const d = await r.json();
    setReminderLoading(null);
    if (channel==="whatsapp"&&d.url) window.open(d.url,"_blank");
    else if (d.ok) showToast("✅ Email enviado");
    else showToast(`❌ ${d.error}`);
    load();
  }

  async function save() {
    setSaving(true);
    if (selected) {
      await fetch(`/api/appointments/${selected.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    } else {
      await fetch("/api/appointments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    }
    setOpen(false); setSelected(null); setForm(initForm); load();
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    load();
  }

  async function deleteAppt() {
    if (!selected || !confirm("¿Eliminar esta cita? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/appointments/${selected.id}`, { method:"DELETE" });
    setOpen(false); setSelected(null); setForm(initForm); load();
  }

  function openNew(date?: string, hour?: string, userId?: string) {
    const d = date ?? currentDate;
    const h = hour ?? "09:00";
    const hNum = parseInt(h);
    setForm({...initForm, date:d, startTime:h, endTime:`${String(hNum+1).padStart(2,"0")}:00`, userId: userId ?? ""});
    setSelected(null); setOpen(true);
  }

  function openEdit(a: Appointment) {
    setForm({patientId:a.patient.id, userId:a.user.id, date:a.date, startTime:a.startTime, endTime:a.endTime, type:a.type, status:a.status, box:a.box, notes:a.notes??""});
    setSelected(a); setOpen(true);
  }

  const set = (k: string, v: string|number) => setForm(f=>({...f,[k]:v}));

  // Filtered appointments
  const filtered = filterUserId === "all" ? appointments : appointments.filter(a => a.user.id === filterUserId);
  const dayAppts = filtered.filter(a => a.date === currentDate).sort((a,b)=>a.startTime.localeCompare(b.startTime));

  // Users with appointments today (for multi view)
  const activeUsers = users.filter(u => appointments.some(a => a.date === currentDate && a.user.id === u.id));
  const allColumnsUsers = view === "multi"
    ? (activeUsers.length > 0 ? activeUsers : users.slice(0, 3))
    : [];

  function userColor(userId: string) {
    const idx = users.findIndex(u => u.id === userId);
    return USER_COLORS[idx % USER_COLORS.length] ?? USER_COLORS[0];
  }

  return (
    <div className="space-y-4 max-w-full">
      {toast && <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-muted capitalize">
            {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button onClick={()=>setView("multi")} title="Multi-profesional"
              className={`px-3 py-2 flex items-center gap-1.5 font-medium transition-colors ${view==="multi"?"bg-primary-600 text-white":"bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Users size={13}/> Multi
            </button>
            <button onClick={()=>setView("day")} title="Vista día"
              className={`px-3 py-2 flex items-center gap-1.5 font-medium transition-colors ${view==="day"?"bg-primary-600 text-white":"bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Calendar size={13}/> Día
            </button>
            <button onClick={()=>setView("week")} title="Vista semana"
              className={`px-3 py-2 flex items-center gap-1.5 font-medium transition-colors ${view==="week"?"bg-primary-600 text-white":"bg-white text-slate-600 hover:bg-slate-50"}`}>
              <LayoutGrid size={13}/> Semana
            </button>
          </div>
          {/* Professional filter (week/day) */}
          {view !== "multi" && users.length > 0 && (
            <select className="select w-auto text-xs py-1.5"
              value={filterUserId} onChange={e=>setFilterUserId(e.target.value)}>
              <option value="all">Todos los profesionales</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button onClick={()=>openNew()} className="btn-primary text-sm"><Plus size={15}/> Nueva Cita</button>
        </div>
      </div>

      {/* Date navigator */}
      <div className="card p-2">
        <div className="flex items-center gap-1">
          <button onClick={()=>setCurrentDate(d=>addDays(d, view==="week"?-7:-1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"><ChevronLeft size={16}/></button>
          <div className="flex-1 grid grid-cols-7 gap-0.5">
            {weekDays.map((d) => {
              const isSelected = d===currentDate;
              const isToday = d===today;
              const count = appointments.filter(a=>a.date===d).length;
              const dt = new Date(d+"T12:00:00");
              return (
                <button key={d} onClick={()=>{ setCurrentDate(d); if(view==="week") setView("multi"); }}
                  className={`flex flex-col items-center py-1.5 px-0.5 rounded-xl transition-all ${isSelected?"bg-primary-600 text-white":isToday?"bg-primary-50 text-primary-700":"hover:bg-slate-50 text-slate-600"}`}>
                  <span className="text-xs font-medium capitalize">{dt.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").slice(0,3)}</span>
                  <span className={`text-lg font-bold leading-tight ${isSelected?"text-white":isToday?"text-primary-700":"text-slate-800"}`}>{dt.getDate()}</span>
                  {count>0 && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected?"bg-white":isToday?"bg-primary-500":"bg-slate-300"}`}/>
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setCurrentDate(d=>addDays(d, view==="week"?7:1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"><ChevronRight size={16}/></button>
          <button onClick={()=>setCurrentDate(today)} className="hidden md:block btn-secondary text-xs px-3 flex-shrink-0">Hoy</button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_STYLE).map(([k,s])=>(
          <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${s.dot}`}/>
            {s.label}
          </div>
        ))}
      </div>

      {/* ===== VISTA MULTI-PROFESIONAL (DentaLink style) ===== */}
      {view==="multi" && (
        <div className="card overflow-hidden">
          {/* Cabecera por profesional */}
          <div className="grid border-b border-slate-200" style={{gridTemplateColumns:`52px repeat(${Math.max(allColumnsUsers.length,1)}, 1fr)`}}>
            <div className="border-r border-slate-100"/>
            {allColumnsUsers.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">Sin profesionales</div>
            ) : allColumnsUsers.map(u => {
              const uc = userColor(u.id);
              const count = appointments.filter(a=>a.date===currentDate&&a.user.id===u.id).length;
              return (
                <div key={u.id} className="border-r border-slate-100 last:border-r-0">
                  <div className={`${uc.header} px-3 py-2.5 text-white`}>
                    <p className="text-xs font-semibold truncate">{u.name.split(" ").slice(0,2).join(" ")}</p>
                    <p className="text-xs opacity-75">{count} cita{count!==1?"s":""}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid de horas */}
          <div className="overflow-auto" style={{maxHeight:"calc(100vh - 320px)"}}>
            <div className="relative" style={{minWidth: allColumnsUsers.length>2?"600px":"100%"}}>
              {/* Hour rows */}
              {HOURS.map(h=>(
                <div key={h} className="grid border-b border-slate-100/80"
                  style={{gridTemplateColumns:`52px repeat(${Math.max(allColumnsUsers.length,1)}, 1fr)`, height:`${HOUR_H}px`}}>
                  <div className="border-r border-slate-100 px-1.5 pt-1 flex-shrink-0">
                    <span className="text-xs text-slate-400">{String(h).padStart(2,"0")}:00</span>
                  </div>
                  {allColumnsUsers.map(u=>(
                    <div key={u.id}
                      className="border-r border-slate-100 last:border-r-0 hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={()=>openNew(currentDate,`${String(h).padStart(2,"0")}:00`, u.id)}/>
                  ))}
                </div>
              ))}

              {/* Appointment blocks por profesional */}
              {allColumnsUsers.map((u, colIdx)=>{
                const uc = userColor(u.id);
                const userAppts = appointments.filter(a=>a.date===currentDate&&a.user.id===u.id);
                return userAppts.map(a=>{
                  const top = topPx(a.startTime);
                  const height = heightPx(a.startTime, a.endTime);
                  const colWidth = `calc((100% - 52px) / ${allColumnsUsers.length})`;
                  const left = `calc(52px + ${colIdx} * (100% - 52px) / ${allColumnsUsers.length} + 2px)`;
                  return (
                    <div key={a.id}
                      className={`absolute border-l-4 rounded-r-lg px-2 py-1 cursor-pointer hover:brightness-95 transition-all shadow-sm ${uc.light} ${uc.border}`}
                      style={{top:`${top}px`, height:`${height}px`, left, width:`calc((100% - 52px) / ${allColumnsUsers.length} - 4px)`}}
                      onClick={e=>{e.stopPropagation();openEdit(a);}}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate leading-tight ${uc.text}`}>
                            {a.patient.firstName} {a.patient.lastName[0]}.
                          </p>
                          {height>36&&<p className={`text-xs truncate opacity-70 leading-tight ${uc.text}`}>{a.startTime} · {a.type.split(" ")[0]}</p>}
                        </div>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${STATUS_STYLE[a.status]?.dot ?? "bg-slate-400"}`}/>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          {/* Sin datos */}
          {allColumnsUsers.length === 0 && (
            <div className="py-16 text-center text-muted">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-2"/>
              <p>No hay profesionales registrados</p>
              <p className="text-xs mt-1">Ve a Configuración para agregar usuarios</p>
            </div>
          )}
        </div>
      )}

      {/* ===== VISTA DÍA (individual) ===== */}
      {view==="day" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={()=>setCurrentDate(d=>addDays(d,-1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft size={16}/></button>
              <span className="text-sm font-semibold text-slate-800 capitalize">
                {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}
              </span>
              <button onClick={()=>setCurrentDate(d=>addDays(d,1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight size={16}/></button>
            </div>
            <span className="text-xs text-slate-400">{dayAppts.length} cita{dayAppts.length!==1?"s":""}</span>
          </div>
          <div className="overflow-auto" style={{maxHeight:"calc(100vh - 320px)"}}>
            <div className="grid relative" style={{gridTemplateColumns:"52px 1fr"}}>
              <div>
                {HOURS.map(h=>(
                  <div key={h} className="border-b border-slate-50 px-1.5 pt-1" style={{height:`${HOUR_H}px`}}>
                    <span className="text-xs text-slate-400">{String(h).padStart(2,"0")}:00</span>
                  </div>
                ))}
              </div>
              <div className="relative border-l border-slate-100">
                {HOURS.map(h=>(
                  <div key={h} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" style={{height:`${HOUR_H}px`}}
                    onClick={()=>openNew(currentDate,`${String(h).padStart(2,"0")}:00`)}/>
                ))}
                {dayAppts.map(a=>{
                  const top = topPx(a.startTime);
                  const height = heightPx(a.startTime, a.endTime);
                  const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                  const uc = userColor(a.user.id);
                  return (
                    <div key={a.id}
                      className={`absolute left-1 right-1 border-l-4 rounded-r-xl px-2 py-1 cursor-pointer hover:brightness-95 transition-all shadow-sm ${s.bg} ${s.border}`}
                      style={{top:`${top}px`,height:`${height}px`}}
                      onClick={e=>{e.stopPropagation();openEdit(a);}}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${s.text}`}>{a.patient.firstName} {a.patient.lastName}</p>
                          {height>40&&<p className={`text-xs truncate opacity-70 ${s.text}`}>{a.type} · {a.user.name.split(" ")[0]}</p>}
                        </div>
                        <span className="text-xs opacity-60 flex-shrink-0 font-medium">{a.startTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== VISTA SEMANA ===== */}
      {view==="week" && (
        <div className="card overflow-auto">
          <div className="min-w-[600px]">
            <div className="grid border-b border-slate-200" style={{gridTemplateColumns:"52px repeat(7, 1fr)"}}>
              <div className="border-r border-slate-100"/>
              {weekDays.map(d=>{
                const isToday = d===today;
                const isSelected = d===currentDate;
                const dt = new Date(d+"T12:00:00");
                const count = filtered.filter(a=>a.date===d).length;
                return (
                  <div key={d} className={`py-2 px-1 text-center border-r border-slate-100 last:border-r-0 ${isToday?"bg-primary-50":""}`}>
                    <p className={`text-xs font-medium capitalize ${isToday?"text-primary-600":"text-slate-500"}`}>{dt.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").toUpperCase().slice(0,3)}</p>
                    <p className={`text-base font-bold ${isToday?"text-primary-700":"text-slate-800"}`}>{dt.getDate()}</p>
                    {count>0&&<p className={`text-xs ${isToday?"text-primary-500":"text-slate-400"}`}>{count} cita{count!==1?"s":""}</p>}
                  </div>
                );
              })}
            </div>
            <div className="relative overflow-auto" style={{maxHeight:"calc(100vh - 320px)"}}>
              {HOURS.map(h=>(
                <div key={h} className="grid border-b border-slate-100" style={{gridTemplateColumns:"52px repeat(7, 1fr)", height:`${HOUR_H}px`}}>
                  <div className="border-r border-slate-100 px-1.5 pt-1 flex-shrink-0">
                    <span className="text-xs text-slate-400">{String(h).padStart(2,"0")}:00</span>
                  </div>
                  {weekDays.map(d=>(
                    <div key={d} className={`border-r border-slate-100 last:border-r-0 hover:bg-slate-50/80 cursor-pointer transition-colors ${d===today?"bg-primary-50/30":""}`}
                      onClick={()=>openNew(d,`${String(h).padStart(2,"0")}:00`)}/>
                  ))}
                </div>
              ))}
              {filtered.map(a=>{
                const dayIdx = weekDays.indexOf(a.date);
                if(dayIdx===-1) return null;
                const top = topPx(a.startTime);
                const height = heightPx(a.startTime, a.endTime);
                const left = `calc(52px + ${dayIdx} * (100% - 52px) / 7 + 2px)`;
                const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                return (
                  <div key={a.id}
                    className={`absolute border-l-4 rounded-r-lg px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all shadow-sm ${s.bg} ${s.border} ${s.text}`}
                    style={{top:`${top}px`, height:`${height}px`, left, width:`calc((100% - 52px) / 7 - 4px)`}}
                    onClick={e=>{e.stopPropagation();openEdit(a);}}>
                    <p className="text-xs font-semibold truncate leading-tight">{a.patient.firstName} {a.patient.lastName[0]}.</p>
                    {height>36&&<p className="text-xs truncate opacity-75 leading-tight">{a.startTime} · {a.type.split(" ")[0]}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== LISTA DE CITAS DEL DÍA ===== */}
      {(view==="multi"||view==="day") && dayAppts.length>0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="section-title">
              Citas del día — {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"short"})}
            </h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{dayAppts.length} citas</span>
          </div>
          <div className="divide-y divide-slate-100">
            {dayAppts.map(a=>{
              const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
              const uc = userColor(a.user.id);
              return (
                <div key={a.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 flex-wrap md:flex-nowrap">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${s.dot}`}/>
                  <div className="w-14 text-center flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{a.startTime}</p>
                    <p className="text-xs text-slate-400">{a.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-xs text-slate-500">{a.type} · Box {a.box}</p>
                  </div>
                  {/* Professional badge */}
                  <span className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${uc.light} ${uc.text} flex-shrink-0`}>
                    {a.user.name.split(" ")[0]} {a.user.name.split(" ").slice(-1)[0]}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {a.confirmationToken&&<span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><Check size={10}/> Confirmado</span>}
                    <button onClick={()=>copyLink(a.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors" title="Copiar enlace de confirmación">
                      <Link2 size={11}/> Enlace
                    </button>
                    <button disabled={!a.patient.phone||reminderLoading===a.id+"whatsapp"} onClick={()=>sendReminder(a.id,"whatsapp")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${a.patient.phone?"bg-green-500 text-white hover:bg-green-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                      <MessageCircle size={11}/> WA
                    </button>
                    <button disabled={!a.patient.email||reminderLoading===a.id+"email"} onClick={()=>sendReminder(a.id,"email")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${a.patient.email?"bg-primary-500 text-white hover:bg-primary-600":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                      <Mail size={11}/> Email
                    </button>
                    <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
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

      {/* ===== MODAL NUEVA/EDITAR CITA ===== */}
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
              <label className="label">Especialidad</label>
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
          {selected && (
            <div>
              <label className="label">Estado</label>
              <select className="select" value={form.status} onChange={e=>set("status",e.target.value)}>
                {STATUS_OPTIONS.map(s=><option key={s} value={s}>{STATUS_STYLE[s]?.label??s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {selected && (
              <>
                <button onClick={deleteAppt}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
                  <Trash2 size={14}/> Eliminar
                </button>
                <button disabled={!selected.patient?.phone||reminderLoading===selected.id+"whatsapp"}
                  onClick={()=>sendReminder(selected.id,"whatsapp")}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${selected.patient?.phone?"bg-green-100 text-green-700 hover:bg-green-200":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  <MessageCircle size={14}/> {reminderLoading===selected.id+"whatsapp"?"...":"Recordar WA"}
                </button>
                <button disabled={!selected.patient?.email||reminderLoading===selected.id+"email"}
                  onClick={()=>sendReminder(selected.id,"email")}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${selected.patient?.email?"bg-blue-100 text-blue-700 hover:bg-blue-200":"bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  <Mail size={14}/> {reminderLoading===selected.id+"email"?"...":"Recordar Email"}
                </button>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving||!form.patientId||!form.userId}>
              {saving?"Guardando...":selected?"Actualizar":"Agendar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
