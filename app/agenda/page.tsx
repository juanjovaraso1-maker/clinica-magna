"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, MessageCircle, Mail, Trash2, ExternalLink, Calendar, Lock, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";

interface BlockedSlot {
  id: string; date: string; startTime: string; endTime: string; reason: string | null;
}

interface Appointment {
  id: string; date: string; startTime: string; endTime: string;
  type: string; status: string; box: number; notes: string;
  confirmationToken: string | null;
  patient: { id: string; firstName: string; lastName: string; phone: string; email: string };
  user: { id: string; name: string };
}

const TYPES = ["Odontología General","Estética Orofacial","Implantología","Rehabilitación Oral","Endodoncia","Periodoncia","Ortodoncia","Patología Oral","Cirugía Maxilofacial","Odontopediatría","Urgencia"];
const STATUS_OPTIONS = ["scheduled","confirmed","waiting","in_progress","completed","cancelled","no-show"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const HOUR_H = 56;

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string; solid: string }> = {
  scheduled:   { bg:"bg-blue-50",   border:"border-l-blue-500",   text:"text-blue-700",   dot:"bg-blue-500",   label:"Agendada",          solid:"bg-blue-500" },
  confirmed:   { bg:"bg-emerald-50",border:"border-l-emerald-500",text:"text-emerald-700",dot:"bg-emerald-500",label:"Confirmada",         solid:"bg-emerald-500" },
  completed:   { bg:"bg-slate-100", border:"border-l-slate-400",  text:"text-slate-600",  dot:"bg-slate-400",  label:"Completada",         solid:"bg-slate-400" },
  cancelled:   { bg:"bg-red-50",    border:"border-l-red-400",    text:"text-red-700",    dot:"bg-red-400",    label:"Cancelada",          solid:"bg-red-400" },
  "no-show":   { bg:"bg-amber-50",  border:"border-l-amber-400",  text:"text-amber-700",  dot:"bg-amber-400",  label:"No asistió",         solid:"bg-amber-400" },
  waiting:     { bg:"bg-sky-50",    border:"border-l-sky-400",    text:"text-sky-700",    dot:"bg-sky-400",    label:"En sala de espera",  solid:"bg-sky-400" },
  in_progress: { bg:"bg-violet-50", border:"border-l-violet-500", text:"text-violet-700", dot:"bg-violet-500", label:"En atención",        solid:"bg-violet-500" },
};

const USER_PILL_COLORS = ["#0057FF","#7C3AED","#0891B2","#DC2626","#D97706","#059669"];

// Kept for week view block coloring
const USER_COLORS = [
  { header:"bg-[#0057FF]", light:"bg-blue-50",   text:"text-blue-700",   border:"border-l-blue-500" },
  { header:"bg-violet-600",light:"bg-violet-50", text:"text-violet-700", border:"border-l-violet-500" },
  { header:"bg-cyan-600",  light:"bg-cyan-50",   text:"text-cyan-700",   border:"border-l-cyan-500" },
  { header:"bg-red-600",   light:"bg-red-50",    text:"text-red-700",    border:"border-l-red-500" },
  { header:"bg-amber-600", light:"bg-amber-50",  text:"text-amber-700",  border:"border-l-amber-500" },
  { header:"bg-teal-600",  light:"bg-teal-50",   text:"text-teal-700",   border:"border-l-teal-500" },
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
  const router  = useRouter();
  const isAdmin = useIsAdmin();
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
  const [view, setView] = useState<"week"|"day">("day");
  const [filterUserId, setFilterUserId] = useState("all");
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({ date: todayStr(), startTime: "09:00", endTime: "10:00", reason: "" });
  const [blockSaving, setBlockSaving] = useState(false);

  // New state for expandable cards and mini calendar
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [patientCache, setPatientCache] = useState<Record<string,any>>({});
  const [calMonthDate, setCalMonthDate] = useState<string>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-01`;
  });

  const ws = weekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = todayStr();

  const load = useCallback(async () => {
    const apptUrl = view === "week"
      ? `/api/appointments?weekStart=${ws}&weekEnd=${weekDays[6]}`
      : `/api/appointments?date=${currentDate}`;
    const blockUrl = view === "week"
      ? `/api/blocked-slots?startDate=${ws}&endDate=${weekDays[6]}`
      : `/api/blocked-slots?date=${currentDate}`;
    const [r, br] = await Promise.all([fetch(apptUrl), fetch(blockUrl)]);
    if (r.ok)  setAppointments(await r.json());
    if (br.ok) setBlockedSlots(await br.json());
  }, [currentDate, view, ws]);

  useEffect(() => {
    load();
    Promise.all([fetch("/api/patients").then(r=>r.json()), fetch("/api/users").then(r=>r.json())])
      .then(([p,u]) => { setPatients(p); setUsers(u); });
  }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

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

  function openBlock(date?: string, hour?: string) {
    const d = date ?? currentDate;
    const h = hour ?? "09:00";
    const hNum = parseInt(h);
    setBlockForm({ date: d, startTime: h, endTime: `${String(hNum + 1).padStart(2, "0")}:00`, reason: "" });
    setBlockOpen(true);
  }

  async function createBlock() {
    setBlockSaving(true);
    await fetch("/api/blocked-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockForm),
    });
    setBlockOpen(false);
    setBlockSaving(false);
    load();
  }

  async function deleteBlock(id: string) {
    if (!confirm("¿Eliminar este bloqueo de horario?")) return;
    await fetch(`/api/blocked-slots/${id}`, { method: "DELETE" });
    load();
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

  // New helpers
  function userPillColor(userId: string) {
    const idx = users.findIndex(u => u.id === userId);
    return USER_PILL_COLORS[idx % USER_PILL_COLORS.length] ?? USER_PILL_COLORS[0];
  }

  function userBlockColor(userId: string) {
    const idx = users.findIndex(u => u.id === userId);
    return USER_COLORS[idx % USER_COLORS.length] ?? USER_COLORS[0];
  }

  async function toggleExpand(apptId: string, patientId: string) {
    if (expandedId === apptId) { setExpandedId(null); return; }
    setExpandedId(apptId);
    if (!patientCache[patientId]) {
      const r = await fetch(`/api/patients/${patientId}`);
      if (r.ok) {
        const data = await r.json();
        setPatientCache(prev => ({ ...prev, [patientId]: data }));
      }
    }
  }

  function getCalDays() {
    if (!calMonthDate) return [];
    const [y, m] = calMonthDate.split("-").map(Number);
    const firstDow = new Date(y, m-1, 1).getDay();
    const startPad = firstDow === 0 ? 6 : firstDow - 1;
    const lastDay = new Date(y, m, 0).getDate();
    return [...Array(startPad).fill(null), ...Array.from({length: lastDay}, (_, i) => i+1)];
  }

  function shiftMonth(n: number) {
    if (!calMonthDate) return;
    const [y, m] = calMonthDate.split("-").map(Number);
    const dt = new Date(y, m-1+n, 1);
    setCalMonthDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-01`);
  }

  // Filtered appointments
  const filtered = filterUserId === "all" ? appointments : appointments.filter(a => a.user.id === filterUserId);
  const dayAppts = filtered.filter(a => a.date === currentDate).sort((a,b)=>a.startTime.localeCompare(b.startTime));

  // Sidebar stats
  const todayAppts = appointments.filter(a => a.date === currentDate);
  const confirmedCount = todayAppts.filter(a => a.status === "confirmed").length;
  const pendingCount   = todayAppts.filter(a => a.status === "scheduled").length;
  const urgencyCount   = todayAppts.filter(a => a.type === "Urgencia").length;

  const calLabel = calMonthDate
    ? new Date(calMonthDate + "T12:00:00").toLocaleDateString("es-CL", {month:"long", year:"numeric"})
    : "";

  return (
    <div className="max-w-full">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#1A1D2E] text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentDate(d => addDays(d, -1))}
            className="p-2 rounded-lg hover:bg-[#E3E8F0] text-[#9AA0B4] transition-colors"
          >
            <ChevronLeft size={18}/>
          </button>
          <div className="px-1">
            <h1 className="text-[20px] font-bold text-[#1A1D2E] leading-tight">Agenda del día</h1>
            <p className="text-[13px] text-[#9AA0B4] capitalize">
              {new Date(currentDate+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </p>
          </div>
          <button
            onClick={() => setCurrentDate(d => addDays(d, 1))}
            className="p-2 rounded-lg hover:bg-[#E3E8F0] text-[#9AA0B4] transition-colors"
          >
            <ChevronRight size={18}/>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCurrentDate(today)}
            className="text-[13px] font-medium px-3 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setView(v => v === "week" ? "day" : "week")}
            className={`text-[13px] font-medium px-3 py-2 rounded-lg transition-colors ${
              view === "week"
                ? "bg-[#0057FF] text-white"
                : "border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7]"
            }`}
          >
            Semana
          </button>
          {isAdmin && (
            <button
              onClick={() => openBlock()}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors"
            >
              <Lock size={15}/> Bloquear horario
            </button>
          )}
          <button
            onClick={() => openNew()}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors"
          >
            <Plus size={15}/> Nueva cita
          </button>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Professional filter pills — day view only */}
          {view === "day" && users.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterUserId("all")}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                  filterUserId === "all"
                    ? "bg-[#1A1D2E] text-white"
                    : "bg-white border border-[#E3E8F0] text-[#4B5563] hover:bg-[#F0F2F7]"
                }`}
              >
                Todos
              </button>
              {users.map(u => {
                const color = userPillColor(u.id);
                const active = filterUserId === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setFilterUserId(u.id)}
                    className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors border ${
                      active ? "text-white" : "bg-white border-[#E3E8F0] text-[#4B5563] hover:bg-[#F0F2F7]"
                    }`}
                    style={active ? {backgroundColor: color, borderColor: color} : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{backgroundColor: active ? "rgba(255,255,255,0.75)" : color}}
                    />
                    {u.name.split(" ").slice(0, 2).join(" ")}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {view === "week" && (
            <div className="bg-white border border-[#E3E8F0] rounded-[14px] overflow-auto shadow-sm">
              <div className="min-w-[600px]">
                <div className="grid border-b border-[#E3E8F0]" style={{gridTemplateColumns:"52px repeat(7, 1fr)"}}>
                  <div className="border-r border-[#E3E8F0]"/>
                  {weekDays.map(d => {
                    const isToday = d === today;
                    const dt = new Date(d+"T12:00:00");
                    const count = filtered.filter(a => a.date === d).length;
                    return (
                      <div key={d} onClick={() => { setCurrentDate(d); setView("day"); }}
                        className={`py-2 px-1 text-center border-r border-[#E3E8F0] last:border-r-0 cursor-pointer hover:bg-[#F0F2F7] transition-colors ${isToday?"bg-[#EEF3FF]":""}`}>
                        <p className={`text-[11px] font-semibold uppercase ${isToday?"text-[#0057FF]":"text-[#9AA0B4]"}`}>
                          {dt.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","").slice(0,3)}
                        </p>
                        <p className={`text-[16px] font-bold ${isToday?"text-[#0057FF]":"text-[#1A1D2E]"}`}>{dt.getDate()}</p>
                        {count > 0 && <p className={`text-[11px] ${isToday?"text-[#0057FF]":"text-[#9AA0B4]"}`}>{count} cita{count!==1?"s":""}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="relative overflow-auto" style={{maxHeight:"calc(100vh - 260px)"}}>
                  {HOURS.map(h => (
                    <div key={h} className="grid border-b border-[#F0F2F7]"
                      style={{gridTemplateColumns:"52px repeat(7, 1fr)", height:`${HOUR_H}px`}}>
                      <div className="border-r border-[#E3E8F0] px-1.5 pt-1 flex-shrink-0">
                        <span className="text-[11px] text-[#9AA0B4]">{String(h).padStart(2,"0")}:00</span>
                      </div>
                      {weekDays.map(d => (
                        <div key={d}
                          className={`border-r border-[#F0F2F7] last:border-r-0 hover:bg-[#F0F2F7]/50 cursor-pointer transition-colors ${d===today?"bg-[#EEF3FF]/30":""}`}
                          onClick={() => openNew(d, `${String(h).padStart(2,"0")}:00`)}/>
                      ))}
                    </div>
                  ))}
                  {filtered.map(a => {
                    const dayIdx = weekDays.indexOf(a.date);
                    if (dayIdx === -1) return null;
                    const top = topPx(a.startTime);
                    const height = heightPx(a.startTime, a.endTime);
                    const left = `calc(52px + ${dayIdx} * (100% - 52px) / 7 + 2px)`;
                    const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                    return (
                      <div key={a.id}
                        className={`absolute rounded-lg px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all shadow-sm ${s.solid}`}
                        style={{top:`${top}px`, height:`${height}px`, left, width:`calc((100% - 52px) / 7 - 4px)`}}
                        onClick={e => { e.stopPropagation(); openEdit(a); }}>
                        <p className="text-[11px] font-semibold truncate leading-tight text-white">{a.patient.firstName} {a.patient.lastName[0]}.</p>
                        {height > 36 && <p className="text-[11px] truncate opacity-80 leading-tight text-white">{a.startTime} · {a.type.split(" ")[0]}</p>}
                      </div>
                    );
                  })}
                  {/* Blocked slots — week view */}
                  {blockedSlots.map(b => {
                    const dayIdx = weekDays.indexOf(b.date);
                    if (dayIdx === -1) return null;
                    const top    = topPx(b.startTime);
                    const height = heightPx(b.startTime, b.endTime);
                    const left   = `calc(52px + ${dayIdx} * (100% - 52px) / 7 + 2px)`;
                    return (
                      <div key={b.id}
                        className="absolute rounded-lg px-1.5 py-1 overflow-hidden border border-slate-300"
                        style={{
                          top: `${top}px`, height: `${height}px`, left,
                          width: `calc((100% - 52px) / 7 - 4px)`,
                          background: "repeating-linear-gradient(45deg,#F1F5F9,#F1F5F9 4px,#E2E8F0 4px,#E2E8F0 8px)",
                        }}>
                        <p className="text-[10px] font-semibold text-slate-500 truncate leading-tight">
                          🔒 {b.reason || "Bloqueado"}
                        </p>
                        {isAdmin && height > 28 && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteBlock(b.id); }}
                            className="absolute top-0.5 right-0.5 p-0.5 hover:bg-slate-200 rounded transition-colors"
                          >
                            <X size={10} className="text-slate-400"/>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── DAY VIEW — expandable cards ── */}
          {view === "day" && (
            <div className="space-y-2">
              {(() => {
                const dayBlocks = blockedSlots.filter(b => b.date === currentDate);
                const combined: Array<{ kind: "appt"; time: string; appt: Appointment } | { kind: "block"; time: string; block: BlockedSlot }> = [
                  ...dayAppts.map(a => ({ kind: "appt" as const, time: a.startTime, appt: a })),
                  ...dayBlocks.map(b => ({ kind: "block" as const, time: b.startTime, block: b })),
                ].sort((x, y) => x.time.localeCompare(y.time));

                if (combined.length === 0) return (
                  <div className="bg-white border border-[#E3E8F0] rounded-[14px] py-16 text-center shadow-sm">
                    <Calendar className="w-10 h-10 mx-auto mb-3 text-[#E3E8F0]"/>
                    <p className="text-[14px] font-semibold text-[#9AA0B4]">Sin citas para este día</p>
                    <p className="text-[12px] text-[#9AA0B4] mt-1">Presiona "+ Nueva cita" para agregar</p>
                  </div>
                );

                return combined.map(item => {
                  // ── Blocked slot card ──
                  if (item.kind === "block") {
                    const b = item.block;
                    const dur = timeToMin(b.endTime) - timeToMin(b.startTime);
                    return (
                      <div key={b.id} className="bg-slate-50 border border-slate-200 rounded-[14px] shadow-sm overflow-hidden">
                        <div className="flex items-center">
                          <div className="w-[68px] px-3 py-3.5 text-center flex-shrink-0">
                            <p className="text-[13px] font-bold text-slate-400">{b.startTime}</p>
                            <p className="text-[11px] text-slate-300">{b.endTime}</p>
                          </div>
                          <div className="w-[3px] self-stretch my-2 rounded-full flex-shrink-0 bg-slate-300"/>
                          <div className="flex-1 px-3 py-3.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <Lock size={13} className="text-slate-400 flex-shrink-0"/>
                              <span className="text-[13px] font-semibold text-slate-500">Horario bloqueado</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {b.reason ? b.reason : "Sin motivo registrado"} · {dur} min
                            </p>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => deleteBlock(b.id)}
                              className="px-3 py-3.5 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                              title="Eliminar bloqueo"
                            >
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── Appointment card ──
                  const a = item.appt;
                  const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                  const pillColor = userPillColor(a.user.id);
                  const duration = timeToMin(a.endTime) - timeToMin(a.startTime);
                  const isExpanded = expandedId === a.id;
                  const pd = patientCache[a.patient.id];

                  return (
                    <div key={a.id} className="bg-white border border-[#E3E8F0] rounded-[14px] shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                      {/* Card main row */}
                      <div
                        className="flex items-center cursor-pointer"
                        onClick={() => toggleExpand(a.id, a.patient.id)}
                      >
                        {/* Time block */}
                        <div className="w-[68px] px-3 py-3.5 text-center flex-shrink-0">
                          <p className="text-[13px] font-bold text-[#1A1D2E]">{a.startTime}</p>
                          <p className="text-[11px] text-[#9AA0B4]">{a.endTime}</p>
                        </div>
                        {/* Doctor color bar */}
                        <div className="w-[3px] self-stretch my-2 rounded-full flex-shrink-0" style={{backgroundColor: pillColor}}/>
                        {/* Patient + type */}
                        <div className="flex-1 px-3 py-3.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-[#1A1D2E]">
                              {a.patient.firstName} {a.patient.lastName}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F0F2F7] text-[#4B5563] font-medium">
                              {a.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9AA0B4] mt-0.5 truncate">
                            {a.notes ? `${a.notes.slice(0,50)}${a.notes.length>50?"...":""} · ` : ""}
                            Dr. {a.user.name.split(" ")[0]} · {duration} min
                          </p>
                        </div>
                        {/* Status select */}
                        <div className="px-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <select
                            className={`text-[11px] font-medium border border-[#E3E8F0] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0057FF] bg-white ${s.text}`}
                            value={a.status}
                            onChange={e => updateStatus(a.id, e.target.value)}
                          >
                            {STATUS_OPTIONS.map(st => (
                              <option key={st} value={st}>{STATUS_STYLE[st]?.label ?? st}</option>
                            ))}
                          </select>
                        </div>
                        {/* Expand chevron */}
                        <div className="px-3 flex-shrink-0">
                          <ChevronRight
                            size={16}
                            className={`text-[#9AA0B4] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <div className="border-t border-[#E3E8F0] px-4 py-3 bg-[#F8F9FC]">
                          {!pd ? (
                            <p className="text-[12px] text-[#9AA0B4] py-1">Cargando información del paciente...</p>
                          ) : (
                            <div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 mb-3">
                                <div>
                                  <p className="text-[10px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-0.5">RUT</p>
                                  <p className="text-[12px] font-medium text-[#1A1D2E]">{pd.rut || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Teléfono</p>
                                  <p className="text-[12px] font-medium text-[#1A1D2E]">{pd.phone || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Última visita</p>
                                  <p className="text-[12px] font-medium text-[#1A1D2E]">
                                    {pd.evolutions?.length > 0
                                      ? new Date(pd.evolutions[pd.evolutions.length-1].date+"T12:00:00")
                                          .toLocaleDateString("es-CL",{day:"numeric",month:"short",year:"numeric"})
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Previsión</p>
                                  <p className="text-[12px] font-medium text-[#1A1D2E]">{pd.clinicalRecord?.insurance || "—"}</p>
                                </div>
                                {pd.clinicalRecord?.allergies && (
                                  <div className="col-span-2">
                                    <p className="text-[10px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Alergias</p>
                                    <span className="text-[11px] font-medium text-[#E53935] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-2.5 py-1 inline-block">
                                      {pd.clinicalRecord.allergies}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 flex-wrap pt-1">
                                <button
                                  onClick={() => router.push(`/pacientes/${a.patient.id}`)}
                                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors"
                                >
                                  <ExternalLink size={13}/> Ver ficha
                                </button>
                                <button
                                  disabled={!a.patient.phone || reminderLoading === a.id+"whatsapp"}
                                  onClick={() => sendReminder(a.id, "whatsapp")}
                                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                    a.patient.phone
                                      ? "bg-[#25D366] text-white hover:bg-[#1DAA54]"
                                      : "bg-[#F0F2F7] text-[#9AA0B4] cursor-not-allowed"
                                  }`}
                                >
                                  WhatsApp
                                </button>
                                <button
                                  onClick={() => { setExpandedId(null); openEdit(a); }}
                                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#F0F2F7] text-[#4B5563] hover:bg-[#E3E8F0] transition-colors"
                                >
                                  Editar cita
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }); // end combined.map
              })()} {/* end IIFE */}
            </div>
          )}

        </div>

        {/* ── Sidebar ── */}
        <div className="hidden lg:flex flex-col gap-4 w-[232px] flex-shrink-0">

          {/* Stats card */}
          <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-4 shadow-sm">
            <h3 className="text-[13px] font-bold text-[#1A1D2E] mb-3">Resumen del día</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#EEF3FF] rounded-[10px] p-3 text-center">
                <p className="text-[24px] font-bold text-[#0057FF] leading-tight">{todayAppts.length}</p>
                <p className="text-[11px] text-[#0057FF] font-semibold mt-0.5">Citas hoy</p>
              </div>
              <div className="bg-[#ECFDF5] rounded-[10px] p-3 text-center">
                <p className="text-[24px] font-bold text-[#059669] leading-tight">{confirmedCount}</p>
                <p className="text-[11px] text-[#059669] font-semibold mt-0.5">Confirmadas</p>
              </div>
              <div className="bg-[#FFFBEB] rounded-[10px] p-3 text-center">
                <p className="text-[24px] font-bold text-[#D97706] leading-tight">{pendingCount}</p>
                <p className="text-[11px] text-[#D97706] font-semibold mt-0.5">Pendientes</p>
              </div>
              <div className="bg-[#FEF2F2] rounded-[10px] p-3 text-center">
                <p className="text-[24px] font-bold text-[#E53935] leading-tight">{urgencyCount}</p>
                <p className="text-[11px] text-[#E53935] font-semibold mt-0.5">Urgencias</p>
              </div>
            </div>
          </div>

          {/* Mini calendar */}
          <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => shiftMonth(-1)} className="p-1 rounded-lg hover:bg-[#F0F2F7] text-[#9AA0B4] transition-colors">
                <ChevronLeft size={14}/>
              </button>
              <span className="text-[12px] font-semibold text-[#1A1D2E] capitalize">{calLabel}</span>
              <button onClick={() => shiftMonth(1)} className="p-1 rounded-lg hover:bg-[#F0F2F7] text-[#9AA0B4] transition-colors">
                <ChevronRight size={14}/>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d => (
                <div key={d} className="text-[10px] font-bold text-[#9AA0B4] py-1">{d}</div>
              ))}
              {getCalDays().map((day, i) => {
                if (!day) return <div key={`e-${i}`}/>;
                const [y, m] = (calMonthDate || "").split("-").map(Number);
                const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const isToday    = dateStr === today;
                const isSelected = dateStr === currentDate;
                const hasAppts   = appointments.some(a => a.date === dateStr);
                return (
                  <button
                    key={day}
                    onClick={() => { setCurrentDate(dateStr); setView("day"); }}
                    className={`relative text-[11px] py-1.5 rounded-lg font-medium transition-colors ${
                      isSelected ? "bg-[#0057FF] text-white"
                      : isToday  ? "bg-[#EEF3FF] text-[#0057FF]"
                      : "text-[#4B5563] hover:bg-[#F0F2F7]"
                    }`}
                  >
                    {day}
                    {hasAppts && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0057FF] opacity-50"/>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Urgency alerts */}
          {urgencyCount > 0 && (
            <div className="bg-white border border-[#E3E8F0] rounded-[14px] p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-[#1A1D2E] mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E53935] flex-shrink-0"/>
                Urgencias hoy
              </h3>
              <div className="space-y-2">
                {todayAppts.filter(a => a.type === "Urgencia").map(a => (
                  <div key={a.id} className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] px-3 py-2">
                    <p className="text-[12px] font-semibold text-[#E53935]">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-[11px] text-[#9AA0B4]">{a.startTime} · {STATUS_STYLE[a.status]?.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modal nueva/editar cita ── */}
      <Modal open={open} onClose={() => setOpen(false)} title={selected ? "Editar Cita" : "Nueva Cita"}>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Paciente *</label>
            <select className="select" value={form.patientId} onChange={e => set("patientId", e.target.value)}>
              <option value="">Seleccionar paciente...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Profesional *</label>
            <select className="select" value={form.userId} onChange={e => set("userId", e.target.value)}>
              <option value="">Seleccionar profesional...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="label">Fecha</label><input className="input" type="date" value={form.date} onChange={e => set("date", e.target.value)}/></div>
            <div><label className="label">Inicio</label><input className="input" type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)}/></div>
            <div><label className="label">Fin</label><input className="input" type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Especialidad</label>
              <select className="select" value={form.type} onChange={e => set("type", e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Box</label>
              <select className="select" value={form.box} onChange={e => set("box", parseInt(e.target.value))}>
                {[1,2,3,4].map(b => <option key={b} value={b}>Box {b}</option>)}
              </select>
            </div>
          </div>
          {selected && (
            <div>
              <label className="label">Estado</label>
              <select className="select" value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_STYLE[s]?.label ?? s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)}/>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {selected && (
              <>
                {isAdmin && (
                  <button onClick={deleteAppt}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
                    <Trash2 size={14}/> Eliminar
                  </button>
                )}
                <button
                  disabled={!selected.patient?.phone || reminderLoading === selected.id+"whatsapp"}
                  onClick={() => sendReminder(selected.id, "whatsapp")}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg font-medium transition-colors ${selected.patient?.phone ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  <MessageCircle size={14}/> WA
                </button>
                <button
                  disabled={!selected.patient?.email || reminderLoading === selected.id+"email"}
                  onClick={() => sendReminder(selected.id, "email")}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg font-medium transition-colors ${selected.patient?.email ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  <Mail size={14}/> Email
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 items-center">
            {selected?.patient?.id && (
              <button
                onClick={() => { setOpen(false); router.push(`/pacientes/${selected.patient.id}`); }}
                className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg bg-[#EEF3FF] text-[#0057FF] hover:bg-[#DBEAFE] font-medium transition-colors">
                <ExternalLink size={13}/> Ir a ficha
              </button>
            )}
            <button className="btn-secondary text-xs" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary text-xs" onClick={save} disabled={saving || !form.patientId || !form.userId}>
              {saving ? "Guardando..." : selected ? "Actualizar" : "Agendar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal bloquear horario ── */}
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Bloquear horario">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">Fecha</label>
              <input
                type="date"
                value={blockForm.date}
                onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                className="w-full text-[13px] border border-[#E3E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">Hora inicio</label>
              <input
                type="time"
                value={blockForm.startTime}
                onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full text-[13px] border border-[#E3E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">Hora fin</label>
              <input
                type="time"
                value={blockForm.endTime}
                onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full text-[13px] border border-[#E3E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={blockForm.reason}
              onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Ej: Almuerzo, Reunión de equipo, Feriado, Mantención..."
              className="w-full text-[13px] border border-[#E3E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
            <Lock size={13} className="text-amber-500 mt-0.5 flex-shrink-0"/>
            <p className="text-[11px] text-amber-700">
              Este horario quedará bloqueado y visible en la agenda. Nadie podrá agendar citas en este período.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setBlockOpen(false)}
              className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={createBlock}
              disabled={blockSaving || !blockForm.date || !blockForm.startTime || !blockForm.endTime}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#1A1D2E] text-white hover:bg-[#374151] transition-colors disabled:opacity-60"
            >
              <Lock size={14}/>
              {blockSaving ? "Guardando..." : "Bloquear horario"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
