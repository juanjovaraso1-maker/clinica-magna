"use client";
import { useEffect, useState } from "react";
import {
  Save, Info, Plus, Pencil, X, Check, Users, Building2,
  Calendar, Mail, Trash2, Shield, Stethoscope, Clock,
} from "lucide-react";
import Modal from "@/components/ui/Modal";

type User = { id: string; name: string; email: string; rut?: string; username?: string; role: string; specialty: string | null; active: boolean };

const TABS = [
  { key: "general",  label: "General",   icon: Building2 },
  { key: "usuarios", label: "Usuarios",  icon: Users },
  { key: "agenda",   label: "Agenda",    icon: Calendar },
  { key: "correo",   label: "Correo",    icon: Mail },
];

const SPECIALTIES = [
  "Estética Orofacial","Implantología","Rehabilitación Oral","Endodoncia",
  "Periodoncia","Ortodoncia","Patología","Cirugía Maxilofacial",
  "Odontología General","Odontopediatría",
];

const ROLE_META: Record<string, { label: string; color: string; bg: string; avatarBg: string }> = {
  DENTIST:      { label: "Dentista",       color: "text-primary-700", bg: "bg-primary-100",  avatarBg: "bg-primary-600" },
  ADMIN:        { label: "Administrador",  color: "text-violet-700",  bg: "bg-violet-100",   avatarBg: "bg-violet-600"  },
  RECEPTIONIST: { label: "Recepcionista",  color: "text-blue-700",    bg: "bg-blue-100",     avatarBg: "bg-blue-600"    },
};

const DAYS = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

interface DaySchedule { enabled: boolean; open: string; close: string }
type Schedule = Record<string, DaySchedule>

const DEFAULT_SCHEDULE: Schedule = {
  mon: { enabled: true,  open: "09:00", close: "18:00" },
  tue: { enabled: true,  open: "09:00", close: "18:00" },
  wed: { enabled: true,  open: "09:00", close: "18:00" },
  thu: { enabled: true,  open: "09:00", close: "18:00" },
  fri: { enabled: true,  open: "09:00", close: "18:00" },
  sat: { enabled: true,  open: "09:00", close: "14:00" },
  sun: { enabled: false, open: "09:00", close: "13:00" },
};

const EMPTY_USER = { name: "", email: "", rut: "", role: "DENTIST", specialty: "", username: "", password: "" };

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Configuracion() {
  const [tab, setTab] = useState("general");
  const [users, setUsers] = useState<User[]>([]);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    fetch("/api/clinic-config").then(r => r.json()).then((data: Record<string, string>) => {
      setCfg(data);
      if (data.clinic_schedule) {
        try { setSchedule({ ...DEFAULT_SCHEDULE, ...JSON.parse(data.clinic_schedule) }); } catch {}
      }
    });
  }, []);

  function loadUsers() {
    fetch("/api/users").then(r => r.json()).then(setUsers);
  }

  async function saveCfg() {
    setSaving(true);
    await fetch("/api/clinic-config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg, clinic_schedule: JSON.stringify(schedule) }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  function openNew() { setForm(EMPTY_USER); setEditing(null); setFormError(""); setUserModal(true); }
  function openEdit(u: User) {
    setForm({ name: u.name, email: u.email, rut: u.rut || "", role: u.role, specialty: u.specialty || "", username: u.username || "", password: "" });
    setEditing(u); setFormError(""); setUserModal(true);
  }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) { setFormError("Nombre y email son obligatorios"); return; }
    if (!editing && !form.username.trim()) { setFormError("El nombre de usuario es obligatorio"); return; }
    if (!editing && !form.password) { setFormError("La contraseña es obligatoria"); return; }
    if (!editing && form.password.length < 8) { setFormError("La contraseña debe tener mínimo 8 caracteres"); return; }
    setFormSaving(true); setFormError("");
    try {
      if (editing) {
        await fetch(`/api/users/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, active: editing.active }),
        });
      } else {
        const res = await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) { const d = await res.json(); setFormError(d.error || "Error al crear usuario"); setFormSaving(false); return; }
      }
      loadUsers(); setUserModal(false);
    } catch { setFormError("Error al guardar"); }
    setFormSaving(false);
  }

  async function toggleActive(u: User) {
    await fetch(`/api/users/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: u.name, email: u.email, role: u.role, specialty: u.specialty, active: !u.active }),
    });
    loadUsers();
  }

  function updateDay(key: string, field: keyof DaySchedule, value: boolean | string) {
    setSchedule(s => ({ ...s, [key]: { ...s[key], [field]: value } }));
  }

  const set = (k: string, v: string) => setCfg(c => ({ ...c, [k]: v }));
  const activeUsers = users.filter(u => u.active);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-muted">Gestiona la clínica, profesionales y preferencias del sistema</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              tab === key ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ===== TAB GENERAL ===== */}
      {tab === "general" && (
        <div className="space-y-5">
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="section-title">Datos de la Clínica</h2>
              <p className="text-xs text-slate-400 mt-0.5">Aparecen en presupuestos, recetas y recordatorios de citas</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre de la clínica</label>
                <input className="input" value={cfg.clinic_name ?? ""} onChange={e => set("clinic_name", e.target.value)} placeholder="Clínica Magna" />
              </div>
              <div>
                <label className="label">RUT de la clínica</label>
                <input className="input" value={cfg.clinic_rut ?? ""} onChange={e => set("clinic_rut", e.target.value)} placeholder="76.123.456-7" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Dirección</label>
                <input className="input" value={cfg.clinic_address ?? ""} onChange={e => set("clinic_address", e.target.value)} placeholder="Av. Principal 123, Santiago" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={cfg.clinic_phone ?? ""} onChange={e => set("clinic_phone", e.target.value)} placeholder="+56 2 2345 6789" />
              </div>
              <div>
                <label className="label">Email de contacto</label>
                <input className="input" type="email" value={cfg.clinic_email ?? ""} onChange={e => set("clinic_email", e.target.value)} placeholder="contacto@clinicamagna.cl" />
              </div>
              <div>
                <label className="label">Sitio web</label>
                <input className="input" value={cfg.clinic_website ?? ""} onChange={e => set("clinic_website", e.target.value)} placeholder="www.clinicamagna.cl" />
              </div>
              <div>
                <label className="label">URL base del sistema</label>
                <input className="input" value={cfg.base_url ?? ""} onChange={e => set("base_url", e.target.value)} placeholder="https://clinica-magna.vercel.app" />
                <p className="text-xs text-slate-400 mt-1">Usada en los links de confirmación de citas.</p>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="section-title">Especialidades habilitadas</h2>
            <p className="text-xs text-slate-400">Las especialidades aparecen en el tipo de cita de la agenda</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(sp => {
                const active = (cfg.specialties ?? "").split(",").map(s => s.trim()).includes(sp);
                return (
                  <button key={sp} onClick={() => {
                    const current = (cfg.specialties ?? "").split(",").map(s => s.trim()).filter(Boolean);
                    const next = active ? current.filter(s => s !== sp) : [...current, sp];
                    set("specialties", next.join(","));
                  }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      active
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary-300"
                    }`}>
                    {sp}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              {(cfg.specialties ?? "").split(",").filter(Boolean).length} de {SPECIALTIES.length} habilitadas
            </p>
          </div>
        </div>
      )}

      {/* ===== TAB USUARIOS ===== */}
      {tab === "usuarios" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">{activeUsers.length} profesionales activos</p>
            </div>
            <button onClick={openNew} className="btn-primary text-sm">
              <Plus size={14} /> Nuevo usuario
            </button>
          </div>

          {/* User cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {users.map(u => {
              const role = ROLE_META[u.role] ?? ROLE_META.dentist;
              return (
                <div key={u.id} className={`card p-4 flex gap-4 items-start ${!u.active ? "opacity-60" : ""}`}>
                  <div className={`w-12 h-12 rounded-xl ${role.avatarBg} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-sm font-bold">{initials(u.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                      {!u.active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">Inactivo</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${role.bg} ${role.color}`}>
                        {role.label}
                      </span>
                      {u.specialty && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {u.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(u)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleActive(u)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-xs font-semibold ${
                        u.active
                          ? "text-red-400 hover:text-red-600 hover:bg-red-50"
                          : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                      }`}>
                      {u.active ? <X size={13} /> : <Check size={13} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {users.length === 0 && (
            <div className="card p-12 text-center text-muted">
              <Users size={32} className="mx-auto mb-3 text-slate-300" />
              <p>No hay usuarios registrados</p>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB AGENDA ===== */}
      {tab === "agenda" && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Horario de atención</h2>
            <p className="text-xs text-slate-400">Configura los días y horas en que la clínica atiende pacientes</p>
            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const day = schedule[key] ?? DEFAULT_SCHEDULE[key];
                return (
                  <div key={key}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      day.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
                    }`}>
                    {/* Toggle */}
                    <button onClick={() => updateDay(key, "enabled", !day.enabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${day.enabled ? "bg-primary-500" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${day.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>

                    {/* Day name */}
                    <span className={`text-sm font-medium w-24 flex-shrink-0 ${day.enabled ? "text-slate-800" : "text-slate-400"}`}>
                      {label}
                    </span>

                    {/* Hours */}
                    {day.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400 flex-shrink-0" />
                          <input type="time" value={day.open}
                            onChange={e => updateDay(key, "open", e.target.value)}
                            className="input py-1 px-2 text-sm w-24" />
                        </div>
                        <span className="text-slate-400 text-sm">→</span>
                        <input type="time" value={day.close}
                          onChange={e => updateDay(key, "close", e.target.value)}
                          className="input py-1 px-2 text-sm w-24" />
                        <span className="text-xs text-slate-400 ml-2">
                          {(() => {
                            const [oh, om] = day.open.split(":").map(Number);
                            const [ch, cm] = day.close.split(":").map(Number);
                            const mins = (ch * 60 + cm) - (oh * 60 + om);
                            if (mins <= 0) return "";
                            const h = Math.floor(mins / 60); const m = mins % 60;
                            return `${h}h${m > 0 ? ` ${m}min` : ""}`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="section-title">Configuración de citas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Duración por defecto</label>
                <select className="select" value={cfg.default_duration ?? "30"}
                  onChange={e => set("default_duration", e.target.value)}>
                  <option value="15">15 minutos</option>
                  <option value="20">20 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </div>
              <div>
                <label className="label">Boxes / Sillones</label>
                <select className="select" value={cfg.clinic_boxes ?? "1"}
                  onChange={e => set("clinic_boxes", e.target.value)}>
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <option key={n} value={n}>{n} box{n > 1 ? "es" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Anticipación mínima</label>
                <select className="select" value={cfg.min_advance_hours ?? "0"}
                  onChange={e => set("min_advance_hours", e.target.value)}>
                  <option value="0">Sin límite</option>
                  <option value="1">1 hora</option>
                  <option value="2">2 horas</option>
                  <option value="24">24 horas (1 día)</option>
                  <option value="48">48 horas (2 días)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB CORREO ===== */}
      {tab === "correo" && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="section-title">Configuración SMTP</h2>
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex gap-2.5">
              <Info size={15} className="text-primary-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-primary-700 leading-relaxed">
                Para Gmail: activa <strong>"Contraseñas de aplicación"</strong> en tu cuenta Google (no uses tu contraseña normal).<br />
                Host: <code className="bg-primary-100 px-1 rounded">smtp.gmail.com</code> · Puerto: <code className="bg-primary-100 px-1 rounded">587</code>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Servidor SMTP (Host)</label>
                <input className="input" value={cfg.smtp_host ?? ""} onChange={e => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="label">Puerto</label>
                <input className="input" value={cfg.smtp_port ?? ""} onChange={e => set("smtp_port", e.target.value)} placeholder="587" />
              </div>
              <div>
                <label className="label">Usuario (Email remitente)</label>
                <input className="input" value={cfg.smtp_user ?? ""} onChange={e => set("smtp_user", e.target.value)} placeholder="tu@gmail.com" />
              </div>
              <div>
                <label className="label">Contraseña de aplicación</label>
                <input className="input" type="password" value={cfg.smtp_pass ?? ""} onChange={e => set("smtp_pass", e.target.value)} placeholder="••••••••••••••••" />
              </div>
              <div>
                <label className="label">Seguridad</label>
                <select className="select" value={cfg.smtp_secure ?? "false"} onChange={e => set("smtp_secure", e.target.value)}>
                  <option value="false">STARTTLS (puerto 587)</option>
                  <option value="true">SSL/TLS (puerto 465)</option>
                </select>
              </div>
              <div>
                <label className="label">Nombre remitente</label>
                <input className="input" value={cfg.smtp_from_name ?? ""} onChange={e => set("smtp_from_name", e.target.value)} placeholder="Clínica Magna" />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="section-title">Recordatorios automáticos</h2>
            <div className="space-y-3">
              {[
                { key: "reminder_24h",  label: "Recordatorio 24 horas antes", desc: "Se envía el día anterior a la cita" },
                { key: "reminder_2h",   label: "Recordatorio 2 horas antes",  desc: "Se envía el mismo día de la cita" },
                { key: "confirm_email", label: "Email de confirmación",        desc: "Al crear una nueva cita" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                  <button onClick={() => set(key, cfg[key] === "true" ? "false" : "true")}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${cfg[key] === "true" ? "bg-primary-500" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg[key] === "true" ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button onClick={saveCfg} disabled={saving}
          className={`btn-primary gap-2 ${saved ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {/* User modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={editing ? "Editar usuario" : "Nuevo usuario"}>
        <div className="p-6 space-y-4">
          {/* Preview card */}
          {form.name && (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${(ROLE_META[form.role] ?? ROLE_META.dentist).bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(ROLE_META[form.role] ?? ROLE_META.dentist).avatarBg}`}>
                <span className="text-white text-sm font-bold">{initials(form.name)}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{form.name}</p>
                <p className="text-xs text-slate-500">{(ROLE_META[form.role] ?? ROLE_META.dentist).label}{form.specialty ? ` · ${form.specialty}` : ""}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dra. Carolina López" />
            </div>
            <div>
              <label className="label">RUT</label>
              <input className="input" value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="carolina@clinica.cl" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0B4]">
                Usuario *
              </label>
              <input
                className="w-full mt-1 px-3 py-2 border border-[#E3E8F0] rounded-[8px] text-[13px] focus:outline-none focus:border-[#0057FF]"
                placeholder="ej: dr.juanjo"
                value={form.username}
                onChange={e=>setForm(f=>({...f,username:e.target.value}))}
              />
            </div>
            {!editing && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0B4]">
                  Contraseña *
                </label>
                <input
                  type="password"
                  className="w-full mt-1 px-3 py-2 border border-[#E3E8F0] rounded-[8px] text-[13px] focus:outline-none focus:border-[#0057FF]"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                />
              </div>
            )}
            <div>
              <label className="label">Rol</label>
              <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="DENTIST">Dentista</option>
                <option value="ADMIN">Administrador</option>
                <option value="RECEPTIONIST">Recepcionista</option>
              </select>
            </div>
            <div>
              <label className="label">Especialidad</label>
              <select className="select" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}>
                <option value="">Sin especialidad</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {formError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formError}</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setUserModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveUser} disabled={formSaving}>
            {formSaving ? "Guardando..." : editing ? "Actualizar" : "Crear usuario"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
