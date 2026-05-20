"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, TrendingUp, TrendingDown, DollarSign, Download,
  Trash2, Wallet, BarChart3, ChevronDown,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Payment {
  id: string; date: string; amount: number; method: string; notes: string;
  patient: { id: string; firstName: string; lastName: string };
  budget?: { number: number } | null;
}
interface Expense {
  id: string; date: string; category: string; description: string;
  amount: number; provider: string; paymentMethod: string;
}
interface ChartMonth { label: string; ingresos: number; gastos: number }

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2000, i, 1);
  return { value: String(i + 1).padStart(2, "0"), label: d.toLocaleDateString("es-CL", { month: "long" }) };
});

const EXP_CATEGORIES = ["materiales", "equipamiento", "arriendo", "servicios", "personal", "laboratorio", "otros"];
const CAT_COLORS: Record<string, string> = {
  materiales: "#3b82f6", equipamiento: "#8b5cf6", arriendo: "#f97316",
  servicios: "#06b6d4", personal: "#10b981", laboratorio: "#f43f5e", otros: "#94a3b8",
};
const CAT_BADGE: Record<string, string> = {
  materiales: "bg-blue-100 text-blue-700", equipamiento: "bg-violet-100 text-violet-700",
  arriendo: "bg-orange-100 text-orange-700", servicios: "bg-cyan-100 text-cyan-700",
  personal: "bg-emerald-100 text-emerald-700", laboratorio: "bg-rose-100 text-rose-700",
  otros: "bg-slate-100 text-slate-600",
};
const METHOD_ICON: Record<string, string> = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", cheque: "📄" };

function CustomTooltipFinance({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

function csvExport(payments: Payment[], expenses: Expense[], month: string) {
  const rows: string[] = ["Tipo,Fecha,Descripcion,Monto,Metodo,Paciente/Proveedor"];
  payments.forEach(p => rows.push(`Ingreso,${p.date},"${p.patient.firstName} ${p.patient.lastName}",${p.amount},${p.method},"${p.patient.firstName} ${p.patient.lastName}"`));
  expenses.forEach(e => rows.push(`Gasto,${e.date},"${e.description}",${e.amount},${e.paymentMethod},"${e.provider || ""}"`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `finanzas-${month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function Finanzas() {
  const isAdmin = useIsAdmin();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthNum, setMonthNum] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const month = `${year}-${monthNum}`;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [chartData, setChartData] = useState<ChartMonth[]>([]);
  const [tab, setTab] = useState<"ingresos" | "gastos">("ingresos");
  const [payModal, setPayModal] = useState(false);
  const [expModal, setExpModal] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [budgets, setBudgets] = useState<Array<{ id: string; number: number; patient: { firstName: string; lastName: string } }>>([]);
  const [payForm, setPayForm] = useState({
    patientId: "", budgetId: "",
    date: now.toISOString().split("T")[0],
    amount: "", method: "efectivo", notes: "",
  });
  const [expForm, setExpForm] = useState({
    date: now.toISOString().split("T")[0],
    category: "materiales", description: "", amount: "",
    provider: "", paymentMethod: "efectivo", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [pr, er, patr, budr, rep] = await Promise.all([
      fetch(`/api/payments?month=${month}`),
      fetch(`/api/expenses?month=${month}`),
      fetch("/api/patients"),
      fetch("/api/budgets?status=approved"),
      fetch("/api/reportes?period=6m"),
    ]);
    if (pr.ok) setPayments(await pr.json());
    if (er.ok) setExpenses(await er.json());
    if (patr.ok) setPatients(await patr.json());
    if (budr.ok) setBudgets(await budr.json());
    if (rep.ok) { const d = await rep.json(); setChartData(d.monthlyFinance ?? []); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const income = payments.reduce((s, p) => s + p.amount, 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - expTotal;
  const margin = income > 0 ? Math.round((net / income) * 100) : 0;

  const catData = EXP_CATEGORIES
    .map(cat => ({ name: cat, value: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.value > 0);

  async function savePay() {
    setSaving(true);
    await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount), budgetId: payForm.budgetId || null }),
    });
    setPayModal(false); load(); setSaving(false);
  }

  async function saveExp() {
    setSaving(true);
    await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount) }),
    });
    setExpModal(false); load(); setSaving(false);
  }

  async function deletePay(id: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    await fetch("/api/payments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function deleteExp(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  const setPay = (k: string, v: string) => setPayForm(f => ({ ...f, [k]: v }));
  const setExp = (k: string, v: string) => setExpForm(f => ({ ...f, [k]: v }));

  const filteredBudgets = budgets.filter(b => !payForm.patientId || b.patient.firstName);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="text-muted">Control de ingresos y egresos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month/year selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl overflow-hidden text-sm">
            <select className="pl-3 pr-2 py-2 bg-transparent text-slate-700 font-medium focus:outline-none capitalize"
              value={monthNum} onChange={e => setMonthNum(e.target.value)}>
              {ALL_MONTHS.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label}</option>)}
            </select>
            <div className="w-px h-5 bg-slate-200" />
            <select className="pl-2 pr-3 py-2 bg-transparent text-slate-700 font-medium focus:outline-none"
              value={year} onChange={e => setYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => csvExport(payments, expenses, month)}
            className="btn-secondary text-xs gap-1.5">
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => setExpModal(true)} className="btn-secondary text-xs">
            <Plus size={14} /> Gasto
          </button>
          <button onClick={() => setPayModal(true)} className="btn-primary text-xs">
            <Plus size={14} /> Cobro
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Ingresos</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{fmtShort(income)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{payments.length} cobros</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Gastos</p>
              <p className="text-xl font-bold text-red-600 mt-1">{fmtShort(expTotal)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{expenses.length} egresos</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <TrendingDown size={18} className="text-red-600" />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Resultado neto</p>
              <p className={`text-xl font-bold mt-1 ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtShort(net)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{net >= 0 ? "Superávit" : "Déficit"}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${net >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
              <DollarSign size={18} className={net >= 0 ? "text-emerald-600" : "text-red-600"} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Margen</p>
              <p className={`text-xl font-bold mt-1 ${margin >= 0 ? "text-primary-700" : "text-red-600"}`}>{margin}%</p>
              <p className="text-xs text-slate-400 mt-0.5">sobre ingresos</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={18} className="text-primary-600" />
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
            <div className={`h-1.5 rounded-full transition-all ${margin >= 0 ? "bg-primary-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(Math.abs(margin), 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="section-title mb-4">Tendencia últimos 6 meses</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CustomTooltipFinance />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" fill="url(#gradInc)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#gradExp)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted text-sm">Sin datos</div>
          )}
        </div>

        {/* Category donut */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por categoría</h2>
          {catData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={2}>
                    {catData.map((c) => (
                      <Cell key={c.name} fill={CAT_COLORS[c.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {catData.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[c.name] ?? "#94a3b8" }} />
                      <span className="capitalize text-slate-600">{c.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{fmtShort(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-muted text-sm">Sin gastos</div>
          )}
        </div>
      </div>

      {/* Tabs + tables */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setTab("ingresos")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === "ingresos" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              Ingresos ({payments.length})
            </button>
            <button onClick={() => setTab("gastos")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === "gastos" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              Gastos ({expenses.length})
            </button>
          </div>
        </div>

        {tab === "ingresos" ? (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {payments.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">Sin cobros este mes</div>
              ) : payments.map(p => (
                <div key={p.id} className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {METHOD_ICON[p.method] ?? "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{p.patient.firstName} {p.patient.lastName}</p>
                    <p className="text-xs text-slate-500">{p.date} · <span className="capitalize">{p.method}</span>
                      {p.budget && <span className="text-slate-400"> · #{String(p.budget.number).padStart(4, "0")}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-emerald-700">{fmt(p.amount)}</p>
                    {isAdmin && <button onClick={() => deletePay(p.id)} className="text-slate-300 hover:text-red-500 transition-colors mt-0.5"><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
              {payments.length > 0 && (
                <div className="card p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="font-bold text-emerald-700">{fmt(income)}</span>
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Presupuesto</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Método</th>
                    <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">Sin cobros este mes</td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id} className="table-row border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-600 tabular-nums">{p.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.patient.firstName} {p.patient.lastName}</td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                        {p.budget ? `#${String(p.budget.number).padStart(4, "0")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-600">{METHOD_ICON[p.method] ?? ""} {p.method}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-700">{fmt(p.amount)}</td>
                      <td className="px-3 py-3">
                        {isAdmin && <button onClick={() => deletePay(p.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {payments.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-emerald-50">
                    <tr>
                      <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total ingresos</td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-700 text-base">{fmt(income)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {expenses.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">Sin gastos este mes</div>
              ) : expenses.map(e => (
                <div key={e.id} className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ background: CAT_COLORS[e.category] ?? "#94a3b8" }}>
                    {e.category.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium ${CAT_BADGE[e.category] ?? "bg-slate-100 text-slate-600"}`}>{e.category}</span>
                      {e.provider && <span className="text-xs text-slate-400 truncate">{e.provider}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{e.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-red-600">{fmt(e.amount)}</p>
                    {isAdmin && <button onClick={() => deleteExp(e.id)} className="text-slate-300 hover:text-red-500 transition-colors mt-0.5"><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
              {expenses.length > 0 && (
                <div className="card p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total gastos</span>
                  <span className="font-bold text-red-600">{fmt(expTotal)}</span>
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Descripción</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Proveedor</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Forma de pago</th>
                    <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-muted">Sin gastos este mes</td></tr>
                  ) : expenses.map(e => (
                    <tr key={e.id} className="table-row border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-600 tabular-nums">{e.date}</td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{e.description}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${CAT_BADGE[e.category] ?? "bg-slate-100 text-slate-600"}`}>{e.category}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{e.provider || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 capitalize hidden lg:table-cell">{e.paymentMethod}</td>
                      <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(e.amount)}</td>
                      <td className="px-3 py-3">
                        {isAdmin && <button onClick={() => deleteExp(e.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {expenses.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-red-50">
                    <tr>
                      <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-slate-700">Total gastos</td>
                      <td className="px-5 py-3 text-right font-bold text-red-600 text-base">{fmt(expTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Cobro">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Paciente *</label>
            <select className="select" value={payForm.patientId} onChange={e => setPay("patientId", e.target.value)}>
              <option value="">Seleccionar...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Asociar a presupuesto</label>
            <select className="select" value={payForm.budgetId} onChange={e => setPay("budgetId", e.target.value)}>
              <option value="">Sin presupuesto</option>
              {filteredBudgets.map(b => (
                <option key={b.id} value={b.id}>#{String(b.number).padStart(4, "0")} — {b.patient.firstName} {b.patient.lastName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={payForm.date} onChange={e => setPay("date", e.target.value)} />
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="select" value={payForm.method} onChange={e => setPay("method", e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monto ($) *</label>
            <input className="input" type="number" min="0" value={payForm.amount}
              onChange={e => setPay("amount", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input" value={payForm.notes} onChange={e => setPay("notes", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setPayModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={savePay} disabled={saving || !payForm.patientId || !payForm.amount}>
            {saving ? "Guardando..." : "Registrar Cobro"}
          </button>
        </div>
      </Modal>

      {/* Expense modal */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Registrar Gasto">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={expForm.date} onChange={e => setExp("date", e.target.value)} />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={expForm.category} onChange={e => setExp("category", e.target.value)}>
                {EXP_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción *</label>
            <input className="input" value={expForm.description} onChange={e => setExp("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Proveedor</label>
              <input className="input" value={expForm.provider} onChange={e => setExp("provider", e.target.value)} />
            </div>
            <div>
              <label className="label">Forma de pago</label>
              <select className="select" value={expForm.paymentMethod} onChange={e => setExp("paymentMethod", e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monto ($) *</label>
            <input className="input" type="number" min="0" value={expForm.amount}
              onChange={e => setExp("amount", e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setExpModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveExp} disabled={saving || !expForm.description || !expForm.amount}>
            {saving ? "Guardando..." : "Registrar Gasto"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
