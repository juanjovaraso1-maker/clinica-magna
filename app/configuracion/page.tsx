"use client";
import { useEffect, useState } from "react";
import {
  Save, Info, Plus, Pencil, X, Check, Users, Building2,
  Calendar, Mail, Trash2, Shield, Stethoscope, Clock,
  HardDrive, Download, Upload, RefreshCw, AlertTriangle, PenLine,
  TrendingUp, Filter, DollarSign, Banknote, ChevronDown, ChevronRight,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useIsAdmin } from "@/hooks/useRole";
import { useSession } from "next-auth/react";

type User = { id: string; name: string; title?: string; email: string; rut?: string; username?: string; role: string; specialty: string | null; commissionRate: number; active: boolean; signatureUrl?: string };

const TABS = [
  { key: "general",      label: "General",        icon: Building2   },
  { key: "usuarios",     label: "Usuarios",       icon: Users       },
  { key: "doctores",     label: "$ Doctores",     icon: DollarSign  },
  { key: "mirendimiento",label: "Mi Rendimiento", icon: TrendingUp  },
  { key: "agenda",       label: "Agenda",         icon: Calendar    },
  { key: "correo",       label: "Correo",         icon: Mail        },
  { key: "respaldos",    label: "Respaldos",      icon: HardDrive   },
];

type BackupMeta = { id: string; source: string; size: number; summary: string; createdAt: string };

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

const EMPTY_USER = { name: "", title: "", email: "", rut: "", role: "DENTIST", specialty: "", username: "", password: "", commissionRate: "" };

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

type PerfItem = {
  id: string;
  description: string;
  total: number;
  directCost: number;
  status: string;
  completedAt?: string | null;
  budget: {
    id: string; number: number; date: string;
    patient: { id: string; firstName: string; lastName: string };
    items: { total: number }[];
    payments: { amount: number; tuuCommission?: number | null }[];
    user: { commissionRate: number };
  };
};

type DoctorPmt = { id: string; userId: string; month: string; amount: number; notes: string | null; createdAt: string };

function MiCuenta({ user, sessionUserId, onReload, initialTab }: { user: User | undefined; sessionUserId: string | undefined; onReload: () => void; initialTab?: "cuenta"|"rendimiento" }) {
  const [tab, setTab] = useState<"cuenta"|"rendimiento">(initialTab ?? "cuenta");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [sigPreview, setSigPreview] = useState<string | null>(user?.signatureUrl ?? null);
  const [sigUploading, setSigUploading] = useState(false);
  const [sigError, setSigError] = useState("");

  // Rendimiento
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const [perfMonth, setPerfMonth] = useState(defaultMonth);
  const [perfSearch, setPerfSearch] = useState("");
  const [perfData, setPerfData] = useState<PerfItem[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [allPerfData, setAllPerfData] = useState<PerfItem[]>([]);
  const [doctorPmts, setDoctorPmts] = useState<DoctorPmt[]>([]);

  useEffect(() => { setSigPreview(user?.signatureUrl ?? null); }, [user]);
  useEffect(() => {
    if (tab === "rendimiento" && sessionUserId) { loadPerf(); loadHistory(); }
  }, [tab, perfMonth, sessionUserId]);

  async function loadPerf() {
    if (!sessionUserId) return;
    setPerfLoading(true);
    const r = await fetch(`/api/doctor-performance?userId=${sessionUserId}&month=${perfMonth}`);
    if (r.ok) setPerfData(await r.json());
    setPerfLoading(false);
  }

  async function loadHistory() {
    if (!sessionUserId) return;
    const [r1, r2] = await Promise.all([
      fetch(`/api/doctor-performance?userId=${sessionUserId}`),
      fetch(`/api/doctor-payments?userId=${sessionUserId}`),
    ]);
    if (r1.ok) setAllPerfData(await r1.json());
    if (r2.ok) setDoctorPmts(await r2.json());
  }

  async function changePassword() {
    if (!pwForm.next || pwForm.next.length < 8) { setPwMsg("La contraseña debe tener mínimo 8 caracteres"); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg("Las contraseñas no coinciden"); return; }
    if (!sessionUserId) return;
    setPwSaving(true); setPwMsg("");
    const r = await fetch(`/api/users/${sessionUserId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pwForm.next }) });
    if (r.ok) { setPwMsg("✅ Contraseña actualizada"); setPwForm({ current: "", next: "", confirm: "" }); }
    else { setPwMsg("❌ Error al actualizar contraseña"); }
    setPwSaving(false);
  }

  async function uploadSig(file: File) {
    if (!sessionUserId) return;
    if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(file.type)) { setSigError("Solo PNG, JPG o WebP"); return; }
    if (file.size > 2 * 1024 * 1024) { setSigError("Máximo 2MB"); return; }
    setSigUploading(true); setSigError("");
    const fd = new FormData(); fd.append("signature", file);
    const r = await fetch(`/api/users/${sessionUserId}/signature`, { method: "POST", body: fd });
    const d = await r.json();
    if (d.ok) { const reader = new FileReader(); reader.onload = e => setSigPreview(e.target?.result as string); reader.readAsDataURL(file); }
    else setSigError(d.error || "Error al subir");
    setSigUploading(false);
  }

  const fmt = (n: number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
  const commissionRate = user?.commissionRate ?? 0;

  // Rows = one per completed budget item attributed to this user
  const perfRows = perfData.map(item => {
    const b           = item.budget;
    const budgetTuu   = b.payments.reduce((s,p) => s + (p.tuuCommission ?? 0), 0);
    const itemsTotal  = b.items.reduce((s, i) => s + i.total, 0);
    const itemShare   = itemsTotal > 0 ? item.total / itemsTotal : 0;
    const itemTuu     = Math.round(budgetTuu * itemShare);
    const netIncome   = item.total - itemTuu - (item.directCost ?? 0);
    const salary      = Math.round(item.total * commissionRate / 100);
    const netClinic   = netIncome - salary;
    return {
      patientName:  `${b.patient.firstName} ${b.patient.lastName}`,
      patientId:    b.patient.id,
      treatment:    item.description,
      budgetDate:   b.date,
      itemValue:    item.total,
      directCost:   item.directCost ?? 0,
      itemTuu,
      salary,
      netClinic,
      budgetNumber: b.number,
    };
  }).filter(r => !perfSearch.trim() || r.patientName.toLowerCase().includes(perfSearch.toLowerCase()));

  const totalValue      = perfRows.reduce((s,r)=>s+r.itemValue,0);
  const totalDirectCost = perfRows.reduce((s,r)=>s+r.directCost,0);
  const totalTuu        = perfRows.reduce((s,r)=>s+r.itemTuu,0);
  const totalSalary     = perfRows.reduce((s,r)=>s+r.salary,0);
  const totalNetClinic  = perfRows.reduce((s,r)=>s+r.netClinic,0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div><h1 className="page-title">Mi cuenta</h1><p className="text-muted">Gestiona tu cuenta y consulta tu rendimiento</p></div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button onClick={()=>setTab("cuenta")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${tab==="cuenta"?"bg-white text-primary-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <Shield size={14}/> Mi Cuenta
        </button>
        <button onClick={()=>setTab("rendimiento")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${tab==="rendimiento"?"bg-white text-primary-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
          <TrendingUp size={14}/> Mi Rendimiento
        </button>
      </div>

      {/* TAB MI CUENTA */}
      {tab === "cuenta" && (
        <div className="space-y-5 max-w-lg">
          <div className="card p-6 space-y-4">
            <h2 className="section-title flex items-center gap-2"><Shield size={15} className="text-blue-600" /> Cambiar contraseña</h2>
            <div><label className="label">Nueva contraseña</label><input className="input" type="password" value={pwForm.next} onChange={e => setPwForm(f=>({...f,next:e.target.value}))} placeholder="Mínimo 8 caracteres" /></div>
            <div><label className="label">Confirmar contraseña</label><input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm(f=>({...f,confirm:e.target.value}))} /></div>
            {pwMsg && <p className={`text-sm ${pwMsg.startsWith("✅") ? "text-emerald-600" : "text-red-600"}`}>{pwMsg}</p>}
            <button className="btn-primary" onClick={changePassword} disabled={pwSaving || !pwForm.next || !pwForm.confirm}>
              {pwSaving ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </div>
          <div className="card p-6 space-y-4">
            <h2 className="section-title flex items-center gap-2"><PenLine size={15} className="text-blue-600" /> Mi firma digital</h2>
            <p className="text-xs text-slate-400">Se mostrará en recetas, presupuestos y documentos clínicos.</p>
            <div className="w-full h-[110px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
              {sigPreview ? <img src={sigPreview} alt="Firma" className="max-h-[100px] max-w-full object-contain p-2"/>
                : <div className="text-center"><PenLine size={24} className="mx-auto mb-1.5 text-slate-300"/><p className="text-xs text-slate-400">Sin firma cargada</p></div>}
            </div>
            {sigError && <p className="text-sm text-red-500">{sigError}</p>}
            <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-semibold text-sm cursor-pointer hover:bg-blue-600 hover:text-white transition-all ${sigUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={15}/>{sigUploading ? "Subiendo..." : sigPreview ? "Reemplazar firma" : "Subir firma"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadSig(f); e.target.value = ""; }}/>
            </label>
            <p className="text-xs text-slate-400 text-center">PNG, JPG o WebP · Máx. 2MB · Fondo transparente recomendado</p>
          </div>
        </div>
      )}

      {/* TAB MI RENDIMIENTO */}
      {tab === "rendimiento" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400"/>
              <input type="month" value={perfMonth} onChange={e=>setPerfMonth(e.target.value)}
                className="input text-sm py-1.5 px-3 w-auto"/>
            </div>
            <input type="text" value={perfSearch} onChange={e=>setPerfSearch(e.target.value)}
              placeholder="Buscar paciente..." className="input text-sm py-1.5 px-3 w-52"/>
          </div>

          {/* Tarjeta principal — ganancia del doctor */}
          {commissionRate > 0 ? (
            <div className="rounded-2xl bg-gradient-to-br from-[#0057FF] to-[#0041CC] p-6 text-white shadow-lg">
              <p className="text-blue-200 text-sm font-medium mb-1">Tu ganancia del mes</p>
              <p className="text-4xl font-bold tracking-tight mb-3">{fmt(totalSalary)}</p>
              <div className="flex flex-wrap gap-4 text-sm text-blue-100">
                <span>{perfRows.length} prestaciones · {fmt(totalValue)} facturado</span>
                <span>Comisión {commissionRate}% sobre cada prestación</span>
              </div>
            </div>
          ) : (
            <div className="card p-5 border-amber-200 bg-amber-50">
              <p className="text-amber-700 font-medium text-sm">Sin porcentaje de comisión configurado</p>
              <p className="text-amber-600 text-xs mt-1">Pídele al administrador que configure tu % de comisión en Configuración → Usuarios.</p>
            </div>
          )}

          {/* Historial mensual */}
          {(() => {
            const monthMap: Record<string, PerfItem[]> = {};
            for (const item of allPerfData) {
              const m = item.completedAt?.slice(0,7) ?? item.budget.date.slice(0,7);
              if (!monthMap[m]) monthMap[m] = [];
              monthMap[m].push(item);
            }
            const monthly = Object.entries(monthMap)
              .map(([m, items]) => {
                const tv = items.reduce((s,i)=>s+i.total,0);
                const ts = Math.round(tv * commissionRate / 100);
                const paid = doctorPmts.filter(p=>p.month===m).reduce((s,p)=>s+p.amount,0);
                return { month:m, count:items.length, totalValue:tv, totalSalary:ts, paid, pending:Math.max(0,ts-paid) };
              })
              .sort((a,b)=>b.month.localeCompare(a.month));
            if (monthly.length === 0) return null;
            return (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <TrendingUp size={14} className="text-slate-400"/>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Historial de meses</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-2.5">Mes</th>
                    <th className="px-4 py-2.5 text-right">Prest.</th>
                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">Producción</th>
                    <th className="px-4 py-2.5 text-right">A cobrar</th>
                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">Pagado</th>
                    <th className="px-4 py-2.5 text-right">Estado</th>
                  </tr></thead>
                  <tbody>
                    {monthly.map(row => (
                      <tr key={row.month} className={`border-b border-slate-50 hover:bg-slate-50 ${row.month===perfMonth?"bg-blue-50/40":""}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-700 cursor-pointer hover:text-primary-700" onClick={()=>setPerfMonth(row.month)}>
                          {new Date(row.month+"-15").toLocaleDateString("es-CL",{month:"long",year:"numeric"})}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{row.count}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 hidden sm:table-cell">{fmt(row.totalValue)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-primary-700">{fmt(row.totalSalary)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 hidden sm:table-cell">{row.paid>0?fmt(row.paid):"—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.pending===0
                            ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Pagado ✓</span>
                            : <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente {fmt(row.pending)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Tabla de prestaciones */}
          {perfLoading ? (
            <div className="card p-12 text-center text-slate-400">Cargando...</div>
          ) : perfRows.length === 0 ? (
            <div className="card p-12 text-center">
              <TrendingUp size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-slate-500">No hay prestaciones registradas para este período</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prestación</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cobrado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-orange-500 uppercase tracking-wide hidden sm:table-cell">Costo Lab.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#0057FF] uppercase tracking-wide">Tu ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <a href={`/pacientes/${r.patientId}`} className="text-blue-600 hover:underline font-medium">{r.patientName}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                        <span className="line-clamp-2 text-sm">{r.treatment}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell whitespace-nowrap">
                        #{String(r.budgetNumber).padStart(4,"0")}<br/>{r.budgetDate}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmt(r.itemValue)}</td>
                      <td className="px-4 py-3 text-right text-orange-500 font-medium hidden sm:table-cell">{r.directCost > 0 ? fmt(r.directCost) : "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#0057FF] text-[15px]">{fmt(r.salary)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F0F5FF] border-t-2 border-[#0057FF]/20">
                    <td colSpan={2} className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">
                      Total mes · {perfRows.length} prestaciones
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"/>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(totalValue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-500 hidden sm:table-cell">{fmt(totalDirectCost)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0057FF] text-[15px]">{fmt(totalSalary)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function DoctoresTab() {
  const fmt = (n: number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
  const hoy = new Date();
  const defMonth = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
  const [month, setMonth] = useState(defMonth);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [payModal, setPayModal] = useState(false);
  const [selUser, setSelUser] = useState<{id:string;name:string;pending:number}|null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => { loadSummary(); }, [month]);

  async function loadSummary() {
    setLoading(true);
    const r = await fetch(`/api/admin/doctor-summary?month=${month}`);
    if (r.ok) setSummary(await r.json());
    setLoading(false);
  }

  async function registerPayment() {
    if (!selUser || !payAmount) return;
    setPaying(true);
    await fetch("/api/doctor-payments", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ userId:selUser.id, month, amount:parseFloat(payAmount), notes:payNotes||null }),
    });
    setPaying(false); setPayModal(false); setPayAmount(""); setPayNotes("");
    loadSummary();
  }

  async function deletePmt(id: string) {
    if (!confirm("¿Eliminar este pago?")) return;
    await fetch(`/api/doctor-payments?id=${id}`, { method:"DELETE" });
    loadSummary();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="section-title flex items-center gap-2"><DollarSign size={15} className="text-blue-600"/> Cuentas de Doctores</h2>
        <p className="text-xs text-slate-400 mt-0.5">Gestiona los pagos mensuales a cada profesional según sus prestaciones finalizadas.</p>
      </div>
      <div className="flex items-center gap-3">
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="input text-sm py-1.5 px-3 w-auto"/>
        <span className="text-xs text-slate-400">{summary.length} profesional{summary.length!==1?"es":""} con actividad</span>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-400">Cargando...</div>
      ) : summary.length === 0 ? (
        <div className="card p-12 text-center">
          <DollarSign size={32} className="mx-auto mb-3 text-slate-300"/>
          <p className="text-slate-500 font-medium">Sin producción registrada para este mes</p>
          <p className="text-xs text-slate-400 mt-1">Las prestaciones finalizadas aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summary.map((s: any) => (
            <div key={s.user.id} className="card overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap cursor-pointer"
                onClick={()=>setExpanded(expanded===s.user.id?null:s.user.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0057FF] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {s.user.name.split(" ").slice(0,2).map((w:string)=>w[0]||"").join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{s.user.title} {s.user.name}</p>
                    <p className="text-xs text-slate-400">Comisión {s.user.commissionRate}% · {s.items.length} prestación{s.items.length!==1?"es":""}</p>
                  </div>
                  {expanded===s.user.id ? <ChevronDown size={15} className="text-slate-400"/> : <ChevronRight size={15} className="text-slate-400"/>}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-center min-w-[70px]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Producción</p>
                    <p className="font-bold text-slate-800 text-sm">{fmt(s.totalValue)}</p>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">A pagar</p>
                    <p className="font-bold text-[#0057FF] text-sm">{fmt(s.totalSalary)}</p>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pagado</p>
                    <p className={`font-bold text-sm ${s.totalPaid>=s.totalSalary?"text-emerald-600":"text-amber-600"}`}>{fmt(s.totalPaid)}</p>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pendiente</p>
                    <p className={`font-bold text-sm ${s.pendingAmount>0?"text-red-600":"text-emerald-600"}`}>{s.pendingAmount>0?fmt(s.pendingAmount):"✓ Al día"}</p>
                  </div>
                  <button
                    onClick={e=>{ e.stopPropagation(); setSelUser({id:s.user.id,name:`${s.user.title??""} ${s.user.name}`.trim(),pending:s.pendingAmount}); setPayAmount(String(s.pendingAmount)); setPayModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0057FF] text-white text-xs font-semibold rounded-xl hover:bg-[#0041CC] transition-colors whitespace-nowrap">
                    <Banknote size={13}/> Registrar pago
                  </button>
                </div>
              </div>

              {expanded===s.user.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Prestaciones del mes</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-200">
                          <th className="pb-2 pr-3">Fecha</th>
                          <th className="pb-2 pr-3">Paciente</th>
                          <th className="pb-2 pr-3">Prestación</th>
                          <th className="pb-2 text-right">Valor</th>
                          <th className="pb-2 text-right text-[#0057FF]">Comisión</th>
                        </tr></thead>
                        <tbody>
                          {s.items.map((i:any)=>(
                            <tr key={i.id} className="border-b border-slate-100">
                              <td className="py-2 pr-3 text-slate-400 text-xs whitespace-nowrap">{i.completedAt??""}</td>
                              <td className="py-2 pr-3 text-slate-700">{i.patient.firstName} {i.patient.lastName}</td>
                              <td className="py-2 pr-3 text-slate-500 max-w-[200px] truncate">{i.description}</td>
                              <td className="py-2 text-right text-slate-700 font-medium">{fmt(i.total)}</td>
                              <td className="py-2 text-right font-bold text-[#0057FF]">{fmt(Math.round(i.total*s.user.commissionRate/100))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {s.payments.length>0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pagos registrados</p>
                      <div className="space-y-1.5">
                        {s.payments.map((p:any)=>(
                          <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                            <span className="text-sm font-bold text-emerald-700">{fmt(p.amount)}</span>
                            <span className="text-xs text-slate-400 flex-1 ml-3">{p.notes ?? ""}</span>
                            <span className="text-xs text-slate-400 mr-3">{new Date(p.createdAt).toLocaleDateString("es-CL")}</span>
                            <button onClick={()=>deletePmt(p.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={13}/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={payModal} onClose={()=>setPayModal(false)} title={`Registrar pago — ${selUser?.name??""}`}>
        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-500">Mes: <span className="font-semibold text-slate-800">{new Date(month+"-15").toLocaleDateString("es-CL",{month:"long",year:"numeric"})}</span></p>
          {selUser && selUser.pending>0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-700">
              Saldo pendiente: <span className="font-bold">{fmt(selUser.pending)}</span>
            </div>
          )}
          <div>
            <label className="label">Monto pagado</label>
            <input className="input" type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0"/>
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input className="input" value={payNotes} onChange={e=>setPayNotes(e.target.value)} placeholder="Transferencia, efectivo, cheque..."/>
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={()=>setPayModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={registerPayment} disabled={paying||!payAmount}>
              {paying?"Guardando...":"Confirmar pago"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Configuracion() {
  const isAdmin = useIsAdmin();
  const { data: session } = useSession();
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const [tab, setTab] = useState("general");
  const [users, setUsers] = useState<User[]>([]);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tuuConfig, setTuuConfig] = useState({ percentage: "0.79", fixedCharge: "65", iva: "19", enabled: true });
  const [userModal, setUserModal] = useState(false);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [sigUploading, setSigUploading] = useState(false);
  const [sigDeleting, setSigDeleting] = useState(false);
  const [sigModal, setSigModal] = useState(false);
  const [sigUser, setSigUser] = useState<User | null>(null);
  const [sigError, setSigError] = useState("");

  useEffect(() => {
    loadUsers();
    fetch("/api/clinic-config").then(r => r.json()).then((data: Record<string, string>) => {
      setCfg(data);
      if (data.clinic_schedule) {
        try { setSchedule({ ...DEFAULT_SCHEDULE, ...JSON.parse(data.clinic_schedule) }); } catch {}
      }
      // Load TUU config
      setTuuConfig(prev => ({
        percentage: data.tuu_percentage ?? prev.percentage,
        fixedCharge: data.tuu_fixed_charge ?? prev.fixedCharge,
        iva: data.tuu_iva ?? prev.iva,
        enabled: data.tuu_enabled !== undefined ? data.tuu_enabled === "true" : prev.enabled,
      }));
    });
  }, []);

  useEffect(() => {
    if (tab === "respaldos") loadBackups();
  }, [tab]);

  function loadBackups() {
    fetch("/api/admin/backup").then(r => r.json()).then(setBackups).catch(() => {});
  }

  async function createBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinica-magna-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      loadBackups();
    } finally {
      setBackupLoading(false);
    }
  }

  async function downloadBackup(id: string, date: string) {
    const res = await fetch(`/api/admin/backup/${id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinica-magna-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  async function restoreBackup(file: File) {
    setRestoring(true);
    setRestoreMsg("");
    setRestoreFile(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/restore", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setRestoreMsg("Error: " + (data.error || "desconocido")); return; }
      const fecha = data.timestamp ? new Date(data.timestamp).toLocaleString("es-CL") : "fecha desconocida";
      const s = data.summary ?? {};
      setRestoreMsg(`✅ Restauración exitosa del ${fecha} — ${s.patients ?? 0} pacientes, ${s.appointments ?? 0} citas, ${s.evolutions ?? 0} evoluciones restauradas.`);
      loadBackups();
    } catch (e: any) {
      setRestoreMsg("Error: " + e.message);
    } finally {
      setRestoring(false);
    }
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

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

  async function saveTuuConfig() {
    await fetch("/api/clinic-config", {
      method: "POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        tuu_percentage: tuuConfig.percentage,
        tuu_fixed_charge: tuuConfig.fixedCharge,
        tuu_iva: tuuConfig.iva,
        tuu_enabled: String(tuuConfig.enabled),
      }),
    });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  function openSigModal(u: User) {
    setSigUser(u); setSigPreview(u.signatureUrl ?? null); setSigError(""); setSigModal(true);
  }

  function openNew() { setForm(EMPTY_USER); setEditing(null); setFormError(""); setSigPreview(null); setUserModal(true); }
  function openEdit(u: User) {
    setForm({ name: u.name, title: u.title || "", email: u.email, rut: u.rut || "", role: u.role, specialty: u.specialty || "", username: u.username || "", password: "", commissionRate: String(u.commissionRate ?? 0) });
    setSigPreview(u.signatureUrl ?? null);
    setEditing(u); setFormError(""); setUserModal(true);
  }

  async function uploadSignature(file: File, targetUser?: User) {
    const u = targetUser ?? editing;
    if (!u) return;
    if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(file.type)) {
      targetUser ? setSigError("Solo PNG, JPG o WebP") : setFormError("Solo se permiten imágenes PNG, JPG o WebP"); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      targetUser ? setSigError("Máximo 2MB") : setFormError("La firma no puede superar 2MB"); return;
    }
    setSigUploading(true);
    targetUser ? setSigError("") : setFormError("");
    const fd = new FormData(); fd.append("signature", file);
    const r = await fetch(`/api/users/${u.id}/signature`, { method: "POST", body: fd });
    const d = await r.json();
    if (d.ok) {
      const reader = new FileReader();
      reader.onload = e => setSigPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      loadUsers();
    } else {
      targetUser ? setSigError(d.error || "Error al subir firma") : setFormError(d.error || "Error al subir firma");
    }
    setSigUploading(false);
  }

  async function deleteSignature(targetUser?: User) {
    const u = targetUser ?? editing;
    if (!u) return;
    setSigDeleting(true);
    await fetch(`/api/users/${u.id}/signature`, { method: "DELETE" });
    setSigPreview(null); loadUsers();
    setSigDeleting(false);
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
          body: JSON.stringify({ ...form, commissionRate: parseFloat(form.commissionRate as string) || 0, active: editing.active }),
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
      body: JSON.stringify({ name: u.name, email: u.email, rut: u.rut, role: u.role, specialty: u.specialty, active: !u.active }),
    });
    loadUsers();
  }

  function updateDay(key: string, field: keyof DaySchedule, value: boolean | string) {
    setSchedule(s => ({ ...s, [key]: { ...s[key], [field]: value } }));
  }

  const set = (k: string, v: string) => setCfg(c => ({ ...c, [k]: v }));
  const activeUsers = users.filter(u => u.active);

  // Vista restringida para no-admins: solo contraseña y firma
  if (isAdmin === false) {
    const me = users.find(u => u.id === sessionUserId);
    return <MiCuenta user={me} sessionUserId={sessionUserId} onReload={loadUsers} />;
  }
  if (isAdmin === undefined) return null;

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

      {/* ===== TAB DOCTORES ===== */}
      {tab === "doctores" && <DoctoresTab />}

      {/* ===== TAB MI RENDIMIENTO (admin) ===== */}
      {tab === "mirendimiento" && (() => {
        const me = users.find(u => u.id === sessionUserId);
        return <MiCuenta user={me} sessionUserId={sessionUserId} onReload={loadUsers} initialTab="rendimiento" />;
      })()}

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
              const role = ROLE_META[u.role] ?? ROLE_META.DENTIST;
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
                      {u.signatureUrl
                        ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ Firma</span>
                        : <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Sin firma</span>
                      }
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(u)} title="Editar usuario"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => openSigModal(u)} title="Gestionar firma digital"
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        u.signatureUrl ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-500 hover:bg-amber-50"
                      }`}>
                      <PenLine size={13} />
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

      {/* ===== TAB RESPALDOS ===== */}
      {tab === "respaldos" && (
        <div className="space-y-5">
          {/* Manual backup */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="section-title">Respaldo manual</h2>
              <p className="text-xs text-slate-400 mt-0.5">Descarga un archivo JSON con todos los datos de la clínica</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={createBackup} disabled={backupLoading}
                className="btn-primary gap-2">
                {backupLoading ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {backupLoading ? "Generando..." : "Crear respaldo ahora"}
              </button>
              <p className="text-xs text-slate-400">El archivo se descarga directamente a tu computador</p>
            </div>
          </div>

          {/* Auto backup info */}
          <div className="card p-4 flex items-start gap-3 bg-emerald-50 border-emerald-200">
            <Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Respaldo automático activo</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Se genera automáticamente cada vez que abres esta sección (máximo 1 por día). Se guardan los últimos 7 respaldos.
              </p>
            </div>
          </div>

          {/* Restore */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Restaurar desde respaldo
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sube el archivo <strong>.zip</strong> que llega a tu correo cada día (o un <strong>.json</strong> manual). Esto reemplazará <strong>todos</strong> los datos actuales.
              </p>
            </div>
            <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors
              ${restoring ? "border-slate-200 opacity-60 pointer-events-none" : "border-amber-300 hover:border-amber-400 hover:bg-amber-50"}`}>
              <Upload size={18} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{restoring ? "Restaurando, por favor espera…" : "Seleccionar archivo de respaldo"}</p>
                <p className="text-xs text-slate-400">Archivos .zip (email diario) o .json (manual)</p>
              </div>
              <input type="file" accept=".zip,.json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setRestoreFile(f); e.target.value = ""; }} />
            </label>
            {restoreMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm ${restoreMsg.startsWith("✅") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {restoreMsg}
              </div>
            )}
          </div>

          {/* Confirm restore modal */}
          {restoreFile && (
            <>
              <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => setRestoreFile(null)}/>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={20} className="text-amber-600"/>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A1D2E] text-[15px]">¿Confirmar restauración?</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Esto <strong className="text-red-600">borrará todos los datos actuales</strong> y los reemplazará con los del archivo:
                      </p>
                      <p className="mt-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 break-all">{restoreFile.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setRestoreFile(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => restoreBackup(restoreFile)} disabled={restoring}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-60">
                      {restoring ? "Restaurando…" : "Sí, restaurar ahora"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Backup history */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Historial de respaldos</h2>
              <button onClick={loadBackups} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <RefreshCw size={12} /> Actualizar
              </button>
            </div>
            {backups.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No hay respaldos almacenados aún</p>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => {
                  const summary = (() => { try { return JSON.parse(b.summary); } catch { return {}; } })();
                  const date = new Date(b.createdAt);
                  return (
                    <div key={b.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white">
                      <HardDrive size={16} className={b.source === "auto" ? "text-blue-400" : "text-emerald-500"} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                            {" "}
                            {date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${b.source === "auto" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {b.source === "auto" ? "Automático" : "Manual"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {summary.patients ?? 0} pacientes · {summary.users ?? 0} usuarios · {summary.appointments ?? 0} citas · {fmtSize(b.size)}
                        </p>
                      </div>
                      <button onClick={() => downloadBackup(b.id, date.toISOString().slice(0, 10))}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Download size={13} /> Descargar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuración TUU — visible on general tab */}
      {tab === "general" && isAdmin && (
        <section className="card p-6">
          <h2 className="text-lg font-bold text-[#1A1D2E] mb-4">Configuración TUU</h2>
          <p className="text-sm text-slate-500 mb-4">Fórmula comisión mixta: ((monto × porcentaje) + cargo fijo) × (1 + IVA)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Porcentaje (%)</label>
              <input className="input" type="number" step="0.01"
                value={tuuConfig.percentage} onChange={e => setTuuConfig(c => ({...c, percentage: e.target.value}))} />
              <p className="text-xs text-slate-400 mt-1">Default: 0.79</p>
            </div>
            <div>
              <label className="label">Cargo fijo ($)</label>
              <input className="input" type="number"
                value={tuuConfig.fixedCharge} onChange={e => setTuuConfig(c => ({...c, fixedCharge: e.target.value}))} />
              <p className="text-xs text-slate-400 mt-1">Default: 65</p>
            </div>
            <div>
              <label className="label">IVA (%)</label>
              <input className="input" type="number" step="1"
                value={tuuConfig.iva} onChange={e => setTuuConfig(c => ({...c, iva: e.target.value}))} />
              <p className="text-xs text-slate-400 mt-1">Default: 19</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tuuConfig.enabled}
                onChange={e => setTuuConfig(c => ({...c, enabled: e.target.checked}))}
                className="rounded border-slate-300" />
              <span className="text-sm">Calcular comisión TUU automáticamente</span>
            </label>
            <button onClick={saveTuuConfig} className="btn-primary ml-auto">Guardar configuración TUU</button>
          </div>
        </section>
      )}

      {/* Save button — hidden on Respaldos tab */}
      {tab !== "respaldos" && (
      <div className="flex justify-end pt-2">
        <button onClick={saveCfg} disabled={saving}
          className={`btn-primary gap-2 ${saved ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
      )}

      {/* ── Modal firma digital ── */}
      <Modal open={sigModal} onClose={() => setSigModal(false)} title="Firma digital">
        <div className="p-6 space-y-5">
          {sigUser && (
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${(ROLE_META[sigUser.role] ?? ROLE_META.DENTIST).avatarBg}`}>
                <span className="text-white text-xs font-bold">{initials(sigUser.name)}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{sigUser.name}</p>
                <p className="text-xs text-slate-400">{sigUser.rut ?? "Sin RUT registrado"}</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vista previa de la firma</p>
            <div className="w-full h-[120px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
              {sigPreview
                ? <img src={sigPreview} alt="Firma" className="max-h-[110px] max-w-full object-contain p-2" />
                : <div className="text-center">
                    <PenLine size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs text-slate-400">Sin firma cargada</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">La firma aparecerá en recetas y documentos</p>
                  </div>
              }
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-primary-200 bg-primary-50 text-primary-700 font-semibold text-sm cursor-pointer hover:bg-primary-100 transition-colors ${sigUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={15}/>
              {sigUploading ? "Subiendo..." : sigPreview ? "Reemplazar firma" : "Subir firma"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f && sigUser) uploadSignature(f, sigUser); e.target.value = ""; }} />
            </label>
            {sigPreview && (
              <button onClick={() => sigUser && deleteSignature(sigUser)} disabled={sigDeleting}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                <Trash2 size={14}/> {sigDeleting ? "Eliminando..." : "Eliminar firma"}
              </button>
            )}
            <p className="text-[11px] text-slate-400 text-center">PNG, JPG o WebP · Máximo 2MB · Fondo transparente recomendado</p>
          </div>

          {sigError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{sigError}</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button className="btn-primary" onClick={() => setSigModal(false)}>Listo</button>
        </div>
      </Modal>

      {/* User modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={editing ? "Editar usuario" : "Nuevo usuario"}>
        <div className="p-6 space-y-4">
          {/* Preview card */}
          {form.name && (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${(ROLE_META[form.role] ?? ROLE_META.DENTIST).bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(ROLE_META[form.role] ?? ROLE_META.DENTIST).avatarBg}`}>
                <span className="text-white text-sm font-bold">{initials(form.name)}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{form.title ? `${form.title} ` : ""}{form.name}</p>
                <p className="text-xs text-slate-500">{(ROLE_META[form.role] ?? ROLE_META.DENTIST).label}{form.specialty ? ` · ${form.specialty}` : ""}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Título</label>
              <select className="select" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}>
                <option value="">— Sin título —</option>
                <option value="Dr.">Dr.</option>
                <option value="Dra.">Dra.</option>
              </select>
            </div>
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Carolina López" />
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
            <div>
              <label className="label">% Comisión / Sueldo</label>
              <div className="relative">
                <input className="input pr-8" type="number" min="0" max="100" step="0.1"
                  value={form.commissionRate}
                  onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                  placeholder="0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Signature section — only shown when editing an existing user */}
          {editing && (
            <div className="border border-[#E3E8F0] rounded-xl p-4 bg-[#FAFBFD]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9AA0B4] mb-3">Firma digital</p>
              <div className="flex items-start gap-4 flex-wrap">
                {/* Preview */}
                <div className="flex-shrink-0 w-[160px] h-[90px] border border-[#E3E8F0] rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  {sigPreview
                    ? <img src={sigPreview} alt="Firma" className="max-h-[80px] max-w-[150px] object-contain" />
                    : <span className="text-[11px] text-[#9AA0B4] text-center px-3">Sin firma subida</span>
                  }
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <label className={`inline-flex items-center gap-2 btn-secondary text-xs cursor-pointer ${sigUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload size={13}/>
                    {sigUploading ? "Subiendo..." : sigPreview ? "Reemplazar firma" : "Subir firma"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadSignature(f); e.target.value = ""; }} />
                  </label>
                  {sigPreview && (
                    <button onClick={() => deleteSignature()} disabled={sigDeleting}
                      className="inline-flex items-center gap-2 btn-danger btn-sm text-xs">
                      <Trash2 size={13}/> {sigDeleting ? "Eliminando..." : "Eliminar firma"}
                    </button>
                  )}
                  <p className="text-[10px] text-[#9AA0B4]">PNG, JPG o WebP · Máx. 2MB<br/>Se mostrará en recetas y presupuestos</p>
                </div>
              </div>
            </div>
          )}

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
