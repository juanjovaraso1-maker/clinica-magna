"use client";
import { useEffect, useState } from "react";
import { Save, Info, Plus, Pencil, X, Check } from "lucide-react";

type User = { id: string; name: string; email: string; role: string; specialty: string | null; active: boolean };
const EMPTY_USER = { name: "", email: "", role: "dentist", specialty: "" };

export default function Configuracion() {
  const [users, setUsers] = useState<User[]>([]);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => { loadUsers(); fetch("/api/clinic-config").then(r => r.json()).then(setCfg); }, []);

  function loadUsers() { fetch("/api/users").then(r => r.json()).then(setUsers); }

  async function saveCfg() {
    setSaving(true);
    await fetch("/api/clinic-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function openNew() { setForm(EMPTY_USER); setEditing(null); setFormError(""); setShowForm(true); }
  function openEdit(u: User) { setForm({ name: u.name, email: u.email, role: u.role, specialty: u.specialty || "" }); setEditing(u); setFormError(""); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setFormError(""); }

  async function saveUser() {
    if (!form.name.trim() || !form.email.trim()) { setFormError("Nombre y email son obligatorios"); return; }
    setFormSaving(true); setFormError("");
    try {
      if (editing) {
        await fetch(`/api/users/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, active: editing.active }) });
      } else {
        const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) { const d = await res.json(); setFormError(d.error || "Error al crear usuario"); setFormSaving(false); return; }
      }
      loadUsers(); closeForm();
    } catch { setFormError("Error al guardar"); }
    setFormSaving(false);
  }

  async function toggleActive(u: User) {
    await fetch(`/api/users/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: u.name, email: u.email, role: u.role, specialty: u.specialty, active: !u.active }) });
    loadUsers();
  }

  const set = (k: string, v: string) => setCfg(c => ({ ...c, [k]: v }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="page-title">Configuración</h1><p className="text-muted">Datos de la clínica y configuración del sistema</p></div>

      {/* Clinic info */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Datos de la Clínica</h2>
        <p className="text-xs text-slate-400">Esta información aparece en los presupuestos y recordatorios</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Nombre de la clínica</label><input className="input" value={cfg.clinic_name ?? ""} onChange={e => set("clinic_name", e.target.value)} placeholder="Clínica Magna" /></div>
          <div><label className="label">Teléfono</label><input className="input" value={cfg.clinic_phone ?? ""} onChange={e => set("clinic_phone", e.target.value)} placeholder="+56 2 2345 6789" /></div>
          <div className="col-span-2"><label className="label">Dirección</label><input className="input" value={cfg.clinic_address ?? ""} onChange={e => set("clinic_address", e.target.value)} placeholder="Av. Principal 123, Santiago" /></div>
          <div><label className="label">Email de la clínica</label><input className="input" type="email" value={cfg.clinic_email ?? ""} onChange={e => set("clinic_email", e.target.value)} placeholder="contacto@clinicamagna.cl" /></div>
          <div><label className="label">Sitio web</label><input className="input" value={cfg.clinic_website ?? ""} onChange={e => set("clinic_website", e.target.value)} placeholder="www.clinicamagna.cl" /></div>
          <div className="col-span-2">
            <label className="label">URL base del sistema</label>
            <input className="input" value={cfg.base_url ?? ""} onChange={e => set("base_url", e.target.value)} placeholder="https://clinica-magna.vercel.app" />
            <p className="text-xs text-slate-400 mt-1">Usada en los links de confirmación de citas.</p>
          </div>
        </div>
      </div>

      {/* Email SMTP */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Configuración de Email (SMTP)</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <Info size={15} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">Para Gmail: activa "Contraseñas de aplicación" en tu cuenta Google. <strong>Host: smtp.gmail.com · Puerto: 587</strong></p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Servidor SMTP (Host)</label><input className="input" value={cfg.smtp_host ?? ""} onChange={e => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" /></div>
          <div><label className="label">Puerto</label><input className="input" value={cfg.smtp_port ?? ""} onChange={e => set("smtp_port", e.target.value)} placeholder="587" /></div>
          <div><label className="label">Usuario (Email)</label><input className="input" value={cfg.smtp_user ?? ""} onChange={e => set("smtp_user", e.target.value)} placeholder="tu@gmail.com" /></div>
          <div><label className="label">Contraseña de aplicación</label><input className="input" type="password" value={cfg.smtp_pass ?? ""} onChange={e => set("smtp_pass", e.target.value)} placeholder="••••••••••••••••" /></div>
          <div>
            <label className="label">Seguridad</label>
            <select className="select" value={cfg.smtp_secure ?? ""} onChange={e => set("smtp_secure", e.target.value)}>
              <option value="false">STARTTLS (puerto 587)</option>
              <option value="true">SSL/TLS (puerto 465)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Usuarios */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Usuarios del sistema</h2>
          <button onClick={openNew} className="btn-primary text-sm"><Plus size={14} /> Agregar usuario</button>
        </div>

        {showForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
            <p className="font-medium text-slate-700">{editing ? "Editar usuario" : "Nuevo usuario"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nombre completo</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dra. Carolina López" /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="carolina@clinica.cl" /></div>
              <div>
                <label className="label">Rol</label>
                <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="dentist">Dentista</option>
                  <option value="admin">Administrador</option>
                  <option value="receptionist">Recepcionista</option>
                </select>
              </div>
              <div><label className="label">Especialidad (opcional)</label><input className="input" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Ortodoncia" /></div>
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button onClick={saveUser} disabled={formSaving} className="btn-primary text-sm"><Check size={14} /> {formSaving ? "Guardando..." : "Guardar"}</button>
              <button onClick={closeForm} className="btn-secondary text-sm"><X size={14} /> Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-4 p-3 rounded-xl ${u.active ? "bg-slate-50" : "bg-slate-100 opacity-60"}`}>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">{u.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{u.name} {!u.active && <span className="text-xs text-slate-400">(inactivo)</span>}</p>
                <p className="text-xs text-slate-500">{u.email}{u.specialty ? ` · ${u.specialty}` : ""} · {u.role}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><Pencil size={14} /></button>
                <button onClick={() => toggleActive(u)} className={`text-xs px-2 py-1 rounded-lg ${u.active ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"}`}>
                  {u.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={saveCfg} disabled={saving} className="btn-primary">
          <Save size={16} /> {saved ? "Guardado" : saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
