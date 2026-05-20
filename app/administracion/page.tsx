"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Users, DollarSign, Edit2, Check, X, ChevronDown, ChevronUp,
  TrendingUp, UserPlus, Trash2, Eye, EyeOff, KeyRound, Lock,
  Send, Cake, Bell, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";

/* ─── Types ─── */
interface UserRecord {
  id: string; name: string; email: string; role: string; specialty: string | null; active: boolean;
}
interface UserRow {
  id: string; name: string; username: string | null;
  role: string; active: boolean; createdAt: string;
}
interface LiqItem {
  evolutionId: string; date: string; treatment: string; cost: number;
  rate: number; commission: number; patientName: string;
}
interface Liquidacion {
  userId: string; userName: string; role: string; specialty: string | null;
  globalRate: number; items: LiqItem[]; totalRevenue: number; totalCommission: number;
}
interface AdminData {
  users: UserRecord[];
  commissions: Record<string,{ global:number; categories:Record<string,number> }>;
  liquidaciones: Liquidacion[];
}
interface UserForm { name: string; username: string; role: string; password: string; }

/* ─── Constants ─── */
const TABS = ["Usuarios", "Doctores", "Liquidaciones"];
const ROLE_LABEL: Record<string,string> = { ADMIN: "Administrador", DENTIST: "Dentista" };
const ROLE_COLOR: Record<string,string> = {
  ADMIN:  "bg-purple-50 text-purple-700 border border-purple-200",
  DENTIST:"bg-primary-50 text-primary-700 border border-primary-200",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
}
function monthLabel(m: string) {
  const [y,mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleDateString("es-CL",{month:"long",year:"numeric"});
}
function prevMonth(m: string) {
  const [y,mo] = m.split("-").map(Number);
  const d = new Date(y, mo-2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function nextMonth(m: string) {
  const [y,mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function currentMonth() { return new Date().toISOString().slice(0,7); }
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
}

const EMPTY_FORM: UserForm = { name: "", username: "", role: "DENTIST", password: "" };

/* ─── Component ─── */
export default function Administracion() {
  const isAdmin = useIsAdmin();

  const [tab, setTab]         = useState(0);
  const [month, setMonth]     = useState(currentMonth());
  const [data, setData]       = useState<AdminData|null>(null);
  const [editingUserId, setEditingUserId] = useState<string|null>(null);
  const [editRate, setEditRate]           = useState("");
  const [saving, setSaving]               = useState(false);
  const [expandedLiq, setExpandedLiq]     = useState<string|null>(null);

  /* Users tab state */
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalMode, setModalMode]       = useState<"create"|"edit">("create");
  const [editTarget, setEditTarget]     = useState<UserRow|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow|null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [form, setForm]                 = useState<UserForm>(EMPTY_FORM);
  const [showPass, setShowPass]         = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [formError, setFormError]       = useState("");
  const [formSaving, setFormSaving]     = useState(false);

  /* Load commission/liquidation data */
  const load = useCallback(() => {
    fetch(`/api/administracion?month=${month}`)
      .then(r => r.json()).then(setData);
  }, [month]);

  useEffect(() => {
    if (tab === 1 || tab === 2) load();
  }, [tab, load]);

  /* Load users */
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const res = await fetch("/api/users");
    const json = await res.json();
    setUsers(Array.isArray(json) ? json : []);
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 0) loadUsers();
  }, [tab, loadUsers]);

  /* Commission save */
  async function saveCommission(userId: string) {
    if (!data) return;
    setSaving(true);
    const updated = {
      ...data.commissions,
      [userId]: { ...data.commissions[userId], global: parseFloat(editRate) || 0 },
    };
    await fetch("/api/administracion", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ commissions: updated }),
    });
    setEditingUserId(null); load(); setSaving(false);
  }

  /* Open create modal */
  function openCreate() {
    setForm(EMPTY_FORM);
    setShowPass(false);
    setShowChangePass(false);
    setFormError("");
    setModalMode("create");
    setEditTarget(null);
    setModalOpen(true);
  }

  /* Open edit modal */
  function openEdit(u: UserRow) {
    setForm({ name: u.name, username: u.username ?? "", role: u.role, password: "" });
    setShowPass(false);
    setShowChangePass(false);
    setFormError("");
    setModalMode("edit");
    setEditTarget(u);
    setModalOpen(true);
  }

  /* Submit create/edit */
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.username.trim()) {
      setFormError("Nombre y username son requeridos.");
      return;
    }
    if (modalMode === "create" && !form.password) {
      setFormError("La contraseña es requerida.");
      return;
    }

    setFormSaving(true);
    let res: Response;
    if (modalMode === "create") {
      res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), username: form.username.trim(), role: form.role, password: form.password }),
      });
    } else {
      const body: Record<string,string> = {
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role,
      };
      if (form.password) body.password = form.password;
      res = await fetch(`/api/users/${editTarget!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const json = await res.json();
    setFormSaving(false);
    if (!res.ok) {
      setFormError(json.error || "Error al guardar.");
      return;
    }
    setModalOpen(false);
    loadUsers();
  }

  /* Delete */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    loadUsers();
  }

  /* ADMIN guard */
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Lock className="w-12 h-12 text-slate-300"/>
        <p className="text-slate-500 font-medium">Acceso solo para administradores.</p>
      </div>
    );
  }

  const totalCommissionsMonth = data?.liquidaciones.reduce((s,l) => s+l.totalCommission, 0) ?? 0;
  const totalRevenueMonth     = data?.liquidaciones.reduce((s,l) => s+l.totalRevenue, 0) ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="page-title">Administración</h1>
        <p className="text-muted">Usuarios, email y finanzas</p>
      </div>

      {/* Email modules */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Email y comunicaciones</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/administracion/campanas",     icon: Send,  label: "Campañas",      desc: "Envíos masivos a pacientes",            color: "bg-blue-50 text-blue-600" },
            { href: "/administracion/cumpleanos",   icon: Cake,  label: "Cumpleaños",    desc: "Email automático el día del cumpleaños", color: "bg-pink-50 text-pink-600" },
            { href: "/administracion/recordatorios",icon: Bell,  label: "Recordatorios", desc: "Control a 3, 6, 12 o 24 meses",         color: "bg-amber-50 text-amber-600" },
          ].map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow group cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={20}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500 truncate">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"/>
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px gap-1">
          {TABS.map((t,i) => {
            const icons = [<Users size={14}/>, <DollarSign size={14}/>, <TrendingUp size={14}/>];
            return (
              <button key={t} onClick={()=>setTab(i)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab===i?"border-primary-600 text-primary-700":"border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"}`}>
                {icons[i]} {t}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══ USUARIOS ═══ */}
      {tab === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Gestiona los usuarios con acceso al sistema.</p>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <UserPlus size={16}/> Nuevo usuario
            </button>
          </div>

          <div className="card overflow-hidden">
            {usersLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-5">Nombre</div>
                  <div className="col-span-3">Username</div>
                  <div className="col-span-2">Rol</div>
                  <div className="col-span-2"/>
                </div>

                <div className="divide-y divide-slate-100">
                  {users.map(u => (
                    <div key={u.id} className="px-5 py-4 grid grid-cols-12 items-center gap-2">
                      {/* Name + avatar */}
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">{initials(u.name)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                      </div>

                      {/* Username */}
                      <div className="col-span-3">
                        <span className="text-sm text-slate-500 font-mono">{u.username ?? "—"}</span>
                      </div>

                      {/* Role badge */}
                      <div className="col-span-2">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Editar">
                          <Edit2 size={15}/>
                        </button>
                        <button onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="px-5 py-12 text-center text-muted text-sm">
                      No hay usuarios registrados.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ DOCTORES (comisiones) ═══ */}
      {tab === 1 && (
        <div className="space-y-4">
          {!data ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">Configura el porcentaje de comisión global de cada profesional.</p>
              <div className="card overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-5">Profesional</div>
                  <div className="col-span-3 hidden md:block">Especialidad</div>
                  <div className="col-span-3 text-center">% Comisión</div>
                  <div className="col-span-1"/>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.users.map(u => {
                    const comm = data.commissions[u.id];
                    const rate = comm?.global ?? 0;
                    const isEditing = editingUserId === u.id;
                    return (
                      <div key={u.id} className="px-5 py-4 grid grid-cols-12 items-center gap-2">
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-bold">{initials(u.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                        <div className="col-span-3 hidden md:flex items-center gap-1.5">
                          {u.specialty
                            ? <span className="text-xs text-slate-600">{u.specialty}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </div>
                        <div className="col-span-3 flex items-center justify-center gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" max="100" step="0.5"
                                className="w-16 text-center input text-sm py-1"
                                value={editRate} onChange={e=>setEditRate(e.target.value)}
                                onKeyDown={e=>{if(e.key==="Enter")saveCommission(u.id);if(e.key==="Escape")setEditingUserId(null);}}
                                autoFocus/>
                              <span className="text-slate-500 text-sm">%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-lg font-bold ${rate>0?"text-primary-700":"text-slate-300"}`}>{rate}</span>
                              <span className="text-slate-400 text-sm">%</span>
                            </div>
                          )}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button disabled={saving} onClick={()=>saveCommission(u.id)} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                                <Check size={14}/>
                              </button>
                              <button onClick={()=>setEditingUserId(null)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                                <X size={14}/>
                              </button>
                            </div>
                          ) : (
                            <button onClick={()=>{setEditingUserId(u.id);setEditRate(String(rate));}}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                              <Edit2 size={14}/>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {data.users.length === 0 && (
                    <div className="px-5 py-10 text-center text-muted text-sm">No hay usuarios registrados.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ LIQUIDACIONES ═══ */}
      {tab === 2 && (
        <div className="space-y-4">
          {!data ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={()=>setMonth(prevMonth(month))} className="btn-secondary text-xs px-3 py-1.5">‹</button>
                <span className="text-sm font-semibold text-slate-800 capitalize min-w-[160px] text-center">{monthLabel(month)}</span>
                <button onClick={()=>setMonth(nextMonth(month))} disabled={month>=currentMonth()} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">›</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Ingresos clínica</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{fmt(totalRevenueMonth)}</p>
                  <p className="text-xs text-slate-400">evolucionado en el mes</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Total comisiones</p>
                  <p className="text-xl font-bold text-violet-700 mt-1">{fmt(totalCommissionsMonth)}</p>
                  <p className="text-xs text-slate-400">a pagar a profesionales</p>
                </div>
                <div className="card p-4 md:col-span-1 col-span-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Neto clínica</p>
                  <p className="text-xl font-bold text-primary-700 mt-1">{fmt(totalRevenueMonth - totalCommissionsMonth)}</p>
                  <p className="text-xs text-slate-400">después de comisiones</p>
                </div>
              </div>

              <div className="space-y-3">
                {data.liquidaciones.filter(l=>l.items.length>0).map(l => {
                  const isOpen = expandedLiq === l.userId;
                  return (
                    <div key={l.userId} className="card overflow-hidden">
                      <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                        onClick={()=>setExpandedLiq(isOpen?null:l.userId)}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">{initials(l.userName)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{l.userName}</p>
                          <p className="text-xs text-slate-500">{l.items.length} prestaciones · {l.globalRate}% comisión</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-violet-700">{fmt(l.totalCommission)}</p>
                          <p className="text-xs text-slate-400">sobre {fmt(l.totalRevenue)}</p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0"/>}
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                              <tr>
                                <th className="text-left px-5 py-2.5 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                                <th className="text-left px-4 py-2.5 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
                                <th className="text-left px-4 py-2.5 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Tratamiento</th>
                                <th className="text-right px-4 py-2.5 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                                <th className="text-right px-5 py-2.5 text-xs text-slate-500 uppercase tracking-wide">Comisión</th>
                              </tr>
                            </thead>
                            <tbody>
                              {l.items.map(item => (
                                <tr key={item.evolutionId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                  <td className="px-5 py-2.5 text-xs text-slate-500 font-mono">
                                    {new Date(item.date+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit"})}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{item.patientName}</td>
                                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell max-w-[200px] truncate">{item.treatment}</td>
                                  <td className="px-4 py-2.5 text-right text-sm text-slate-700">{fmt(item.cost)}</td>
                                  <td className="px-5 py-2.5 text-right text-sm font-semibold text-violet-700">{fmt(item.commission)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                              <tr>
                                <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-500">TOTAL</td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">{fmt(l.totalRevenue)}</td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-violet-700">{fmt(l.totalCommission)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {data.liquidaciones.every(l => l.items.length === 0) && (
                  <div className="card py-14 text-center">
                    <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-2"/>
                    <p className="text-muted">Sin evoluciones registradas en {monthLabel(month)}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MODAL CREATE / EDIT ═══ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "create" ? "Nuevo usuario" : "Editar usuario"}
        size="sm"
      >
        <form onSubmit={submitForm} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="input w-full"
              placeholder="Dr. Juan Pérez"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({...f, username: e.target.value.toLowerCase().replace(/\s/g,"")}))}
              className="input w-full font-mono"
              placeholder="juanperez"
              required
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({...f, role: e.target.value}))}
              className="input w-full"
            >
              <option value="DENTIST">Dentista</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          {/* Password */}
          {modalMode === "create" ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  className="input w-full pr-10"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => { setShowChangePass(v => !v); setForm(f => ({...f, password: ""})); }}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                <KeyRound size={14}/>
                {showChangePass ? "Cancelar cambio de contraseña" : "Cambiar contraseña"}
              </button>
              {showChangePass && (
                <div className="mt-2 relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    className="input w-full pr-10"
                    placeholder="Nueva contraseña"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={formSaving} className="btn-primary">
              {formSaving ? "Guardando…" : modalMode === "create" ? "Crear usuario" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══ MODAL DELETE ═══ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar usuario"
        size="sm"
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            ¿Estás seguro de que deseas eliminar a <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>?
            Esta acción desactivará su acceso al sistema.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancelar</button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
