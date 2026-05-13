"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Users, DollarSign, ShieldCheck, Edit2, Check, X, ChevronDown, ChevronUp,
  Percent, TrendingUp, User, Stethoscope,
} from "lucide-react";

interface UserRecord {
  id: string; name: string; email: string; role: string; specialty: string | null; active: boolean;
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

const TABS = ["Doctores","Liquidaciones","Accesos"];
const ROLE_LABEL: Record<string,string> = { admin:"Administrador", dentist:"Dentista", secretary:"Secretaria" };
const ROLE_COLOR: Record<string,string> = {
  admin:     "bg-purple-50 text-purple-700 border border-purple-200",
  dentist:   "bg-primary-50 text-primary-700 border border-primary-200",
  secretary: "bg-teal-50 text-teal-700 border border-teal-200",
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

export default function Administracion() {
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<AdminData|null>(null);
  const [editingUserId, setEditingUserId] = useState<string|null>(null);
  const [editRate, setEditRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedLiq, setExpandedLiq] = useState<string|null>(null);

  const load = useCallback(() => {
    fetch(`/api/administracion?month=${month}`)
      .then(r => r.json()).then(setData);
  }, [month]);

  useEffect(() => { load(); }, [load]);

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

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const dentists = data.users.filter(u => u.role === "dentist" || u.role === "admin");
  const totalCommissionsMonth = data.liquidaciones.reduce((s,l) => s+l.totalCommission, 0);
  const totalRevenueMonth     = data.liquidaciones.reduce((s,l) => s+l.totalRevenue, 0);

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="page-title">Administración</h1>
        <p className="text-muted">Gestión de doctores, liquidaciones y accesos</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px gap-1">
          {TABS.map((t,i) => {
            const icons = [<Users size={14}/>, <DollarSign size={14}/>, <ShieldCheck size={14}/>];
            return (
              <button key={t} onClick={()=>setTab(i)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab===i?"border-primary-600 text-primary-700":"border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"}`}>
                {icons[i]} {t}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ===== DOCTORES ===== */}
      {tab === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Configura el porcentaje de comisión global de cada profesional. La comisión se aplica sobre el costo de cada evolución realizada.</p>
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
                        <span className="text-white text-sm font-bold">{u.name.split(" ").map((n:string)=>n[0]).slice(0,2).join("")}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="col-span-3 hidden md:flex items-center gap-1.5">
                      {u.specialty ? (
                        <span className="text-xs text-slate-600">{u.specialty}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                    <div className="col-span-3 flex items-center justify-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="100" step="0.5"
                            className="w-16 text-center input text-sm py-1"
                            value={editRate} onChange={e=>setEditRate(e.target.value)}
                            onKeyDown={e=>{if(e.key==="Enter")saveCommission(u.id);if(e.key==="Escape")setEditingUserId(null);}}
                            autoFocus
                          />
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
                <div className="px-5 py-10 text-center text-muted text-sm">
                  No hay usuarios registrados. Ve a Configuración para agregar profesionales.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== LIQUIDACIONES ===== */}
      {tab === 1 && (
        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center gap-3">
            <button onClick={()=>setMonth(prevMonth(month))} className="btn-secondary text-xs px-3 py-1.5">‹</button>
            <span className="text-sm font-semibold text-slate-800 capitalize min-w-[160px] text-center">{monthLabel(month)}</span>
            <button onClick={()=>setMonth(nextMonth(month))} disabled={month>=currentMonth()} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">›</button>
          </div>

          {/* Summary KPIs */}
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

          {/* Per-doctor liquidacion */}
          <div className="space-y-3">
            {data.liquidaciones.filter(l=>l.items.length>0).map(l => {
              const isOpen = expandedLiq === l.userId;
              return (
                <div key={l.userId} className="card overflow-hidden">
                  <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={()=>setExpandedLiq(isOpen?null:l.userId)}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{l.userName.split(" ").map(n=>n[0]).slice(0,2).join("")}</span>
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
        </div>
      )}

      {/* ===== ACCESOS ===== */}
      {tab === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Usuarios con acceso al sistema y sus roles. Para agregar o modificar usuarios ve a Configuración → Usuarios.</p>
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.users.map(u => (
                <div key={u.id} className="px-5 py-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-white"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  {u.specialty && (
                    <span className="hidden md:flex items-center gap-1 text-xs text-slate-500">
                      <Stethoscope size={12}/> {u.specialty}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.active!==false?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>
                    {u.active!==false?"Activo":"Inactivo"}
                  </span>
                </div>
              ))}
              {data.users.length === 0 && (
                <div className="px-5 py-10 text-center text-muted text-sm">Sin usuarios registrados</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
