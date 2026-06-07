"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, TrendingUp, TrendingDown, DollarSign, Download,
  Trash2, Wallet, BarChart3, ChevronDown, ShieldAlert,
  CheckSquare, Square, AlertCircle, Pencil,
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
  tuuCommission?: number; netAmount?: number; isTuuInstallment?: boolean;
}
interface Expense {
  id: string; date: string; category: string; description: string;
  amount: number; provider: string; paymentMethod: string;
}
interface ChartMonth { label: string; ingresos: number; gastos: number }
interface Debt {
  id: string; creditor: string; description: string; totalAmount: number;
  paidAmount: number; startDate?: string; dueDate?: string; notes?: string; status?: string;
}
interface FinanceTask {
  id: string; description: string; dueDate?: string; priority: string;
  completed: boolean; createdAt: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}
// Formatea mientras escribe: solo dígitos, con puntos de miles (estilo CLP)
function fmtInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-CL");
}
// Convierte "1.234.567" → 1234567
function parseInputAmt(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2000, i, 1);
  return { value: String(i + 1).padStart(2, "0"), label: d.toLocaleDateString("es-CL", { month: "long" }) };
});

const EXP_CATEGORIES = [
  "Arriendo","Servicios básicos","Insumos clínicos","Equipamiento",
  "Sueldos","Marketing","Mantenimiento","Comisiones bancarias TUU","Otro",
  "materiales","equipamiento","arriendo","servicios","personal","laboratorio","otros",
];
const EXP_CATEGORIES_FORM = [
  "Arriendo","Servicios básicos","Insumos clínicos","Equipamiento",
  "Sueldos","Marketing","Mantenimiento","Comisiones bancarias TUU","Otro",
];
const CAT_COLORS: Record<string, string> = {
  materiales: "#3b82f6", equipamiento: "#8b5cf6", arriendo: "#f97316",
  servicios: "#06b6d4", personal: "#10b981", laboratorio: "#f43f5e", otros: "#94a3b8",
  "Arriendo": "#f97316", "Servicios básicos": "#06b6d4", "Insumos clínicos": "#3b82f6",
  "Equipamiento": "#8b5cf6", "Sueldos": "#10b981", "Marketing": "#ec4899",
  "Mantenimiento": "#f59e0b", "Comisiones bancarias TUU": "#ef4444", "Otro": "#94a3b8",
};
const CAT_BADGE: Record<string, string> = {
  materiales: "bg-blue-100 text-blue-700", equipamiento: "bg-violet-100 text-violet-700",
  arriendo: "bg-orange-100 text-orange-700", servicios: "bg-cyan-100 text-cyan-700",
  personal: "bg-emerald-100 text-emerald-700", laboratorio: "bg-rose-100 text-rose-700",
  otros: "bg-slate-100 text-slate-600",
  "Arriendo": "bg-orange-100 text-orange-700", "Servicios básicos": "bg-cyan-100 text-cyan-700",
  "Insumos clínicos": "bg-blue-100 text-blue-700", "Equipamiento": "bg-violet-100 text-violet-700",
  "Sueldos": "bg-emerald-100 text-emerald-700", "Marketing": "bg-pink-100 text-pink-700",
  "Mantenimiento": "bg-amber-100 text-amber-700", "Comisiones bancarias TUU": "bg-red-100 text-red-700",
  "Otro": "bg-slate-100 text-slate-600",
};
const METHOD_ICON: Record<string, string> = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", cheque: "📄", debito: "💳", credito: "💳" };

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

const PRIORITY_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-emerald-100 text-emerald-700",
};

export default function Finanzas() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  useEffect(() => {
    if (isAdmin === false) router.replace("/dashboard");
  }, [isAdmin, router]);
  if (isAdmin === undefined) return null;
  if (isAdmin === false) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <ShieldAlert size={48} className="text-red-400" />
      <p className="text-lg font-semibold text-slate-700">Acceso restringido</p>
      <p className="text-sm text-slate-500">Solo administradores pueden ver esta sección.</p>
    </div>
  );
  return <FinanzasInner />;
}

function FinanzasInner() {
  const isAdmin = true;

  const now = new Date();
  const [activeTab, setActiveTab] = useState<"resumen"|"gastos"|"contabilidad"|"dashboard"|"tareas">("resumen");
  const [year, setYear] = useState(now.getFullYear());
  const [monthNum, setMonthNum] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const month = `${year}-${monthNum}`;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [chartData, setChartData] = useState<ChartMonth[]>([]);
  const [innerTab, setInnerTab] = useState<"ingresos"|"gastos">("ingresos");
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
    category: "Insumos clínicos", description: "", amount: "",
    provider: "", paymentMethod: "efectivo", notes: "",
  });
  const [editExpId, setEditExpId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  // ---- Gastos tab ----
  const [gastoFilterMonth, setGastoFilterMonth] = useState("");
  const [gastoFilterCat, setGastoFilterCat] = useState("");
  const [gastoFilterPaidBy, setGastoFilterPaidBy] = useState("");
  const [gastosExpenses, setGastosExpenses] = useState<Expense[]>([]);

  // ---- Contabilidad tab ----
  const [contabMonth, setContabMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [contabPayments, setContabPayments] = useState<Payment[]>([]);
  const [contabExpenses, setContabExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtModal, setDebtModal] = useState(false);
  const [debtPayModal, setDebtPayModal] = useState<string|null>(null);
  const [debtPayAmt, setDebtPayAmt] = useState("");
  const [debtForm, setDebtForm] = useState({ creditor:"", description:"", totalAmount:"", paidAmount:"0", startDate:"", dueDate:"", notes:"" });
  const [debtSaving, setDebtSaving] = useState(false);

  // ---- Socios (cálculo automático) ----
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [socioPayModal, setSocioPayModal] = useState<"Juanjo"|"Caro"|null>(null);
  const [socioPayForm, setSocioPayForm] = useState({ amount: "", date: now.toISOString().split("T")[0] });
  const [socioPaySaving, setSocioPaySaving] = useState(false);

  // ---- Dashboard tab ----
  // Uses payments, expenses, chartData from Resumen

  // ---- Tareas tab ----
  const [tasks, setTasks] = useState<FinanceTask[]>([]);
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ description:"", dueDate:"", priority:"media" });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all"|"alta"|"media"|"baja">("all");

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

  async function loadContab() {
    const [pr, er] = await Promise.all([
      fetch(`/api/payments?month=${contabMonth}`),
      fetch(`/api/expenses?month=${contabMonth}`),
    ]);
    if (pr.ok) setContabPayments(await pr.json());
    if (er.ok) setContabExpenses(await er.json());
  }
  async function loadDebts() {
    const r = await fetch("/api/debts");
    if (r.ok) setDebts(await r.json());
  }
  async function loadTasks() {
    const r = await fetch("/api/finance-tasks");
    if (r.ok) setTasks(await r.json());
  }

  async function loadGastosExpenses() {
    const r = await fetch(`/api/expenses?month=${gastoFilterMonth}`);
    if (r.ok) setGastosExpenses(await r.json());
  }

  async function loadAllExpenses() {
    const r = await fetch("/api/expenses");
    if (r.ok) setAllExpenses(await r.json());
  }

  useEffect(() => {
    if (activeTab === "contabilidad") { loadContab(); loadDebts(); loadAllExpenses(); }
    if (activeTab === "tareas") loadTasks();
    if (activeTab === "gastos") loadGastosExpenses();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "contabilidad") loadContab();
  }, [contabMonth]);

  useEffect(() => {
    if (activeTab === "gastos") loadGastosExpenses();
  }, [gastoFilterMonth]);

  const income = payments.reduce((s, p) => s + p.amount, 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - expTotal;
  const margin = income > 0 ? Math.round((net / income) * 100) : 0;

  const catData = Object.keys(CAT_COLORS)
    .map(cat => ({ name: cat, value: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.value > 0);

  // Method distribution for Dashboard
  const methodData = (() => {
    const map: Record<string,number> = {};
    payments.forEach(p => { map[p.method] = (map[p.method]||0) + 1; });
    return Object.entries(map).map(([name,value]) => ({ name, value }))
      .sort((a,b)=>b.value-a.value).slice(0,5);
  })();

  // TUU commissions
  const tuuComm = payments.reduce((s,p) => s + (p.tuuCommission||0), 0);

  async function savePay() {
    const amt = parseInputAmt(payForm.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payForm, amount: amt, budgetId: payForm.budgetId || null }),
    });
    setPayModal(false); load(); setSaving(false);
  }

  function openEditExp(e: Expense) {
    setEditExpId(e.id);
    setExpForm({
      date: e.date,
      category: e.category,
      description: e.description,
      amount: fmtInput(String(Math.round(e.amount))),
      provider: e.provider ?? "",
      paymentMethod: e.paymentMethod ?? "efectivo",
      notes: "",
    });
    setExpModal(true);
  }

  async function saveExp() {
    const amt = parseInputAmt(expForm.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    if (editExpId) {
      await fetch("/api/expenses", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editExpId, ...expForm, amount: amt }),
      });
    } else {
      await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...expForm, amount: amt }),
      });
    }
    setExpModal(false);
    setEditExpId(null);
    // Si hay filtro de mes activo y no coincide, cambiarlo para que aparezca el gasto
    const expMonth = expForm.date.substring(0, 7);
    if (gastoFilterMonth && expMonth !== gastoFilterMonth) setGastoFilterMonth(expMonth);
    load();
    loadGastosExpenses();
    if (activeTab === "contabilidad") loadAllExpenses();
    setSaving(false);
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
    loadGastosExpenses();
  }

  const setPay = (k: string, v: string) => setPayForm(f => ({ ...f, [k]: v }));
  const setExp = (k: string, v: string) => setExpForm(f => ({ ...f, [k]: v }));

  const filteredBudgets = budgets.filter(b => !payForm.patientId || b.patient.firstName);

  // Filtered expenses for Gastos tab (usa gastosExpenses cargado independientemente)
  const filteredExpenses = gastosExpenses.filter(e => {
    const matchCat = !gastoFilterCat || e.category === gastoFilterCat;
    const matchPaidBy = !gastoFilterPaidBy || e.provider === gastoFilterPaidBy;
    return matchCat && matchPaidBy;
  });
  const filteredExpTotal = filteredExpenses.reduce((s,e) => s + e.amount, 0);

  // Resumen por "Pagado por" para el tab Gastos
  const PAIDBY_OPTIONS = ["Juanjo", "Caro", "Magna"];
  const paidByTotals = PAIDBY_OPTIONS.map(who => ({
    who,
    total: gastosExpenses.filter(e => e.provider === who).reduce((s,e) => s + e.amount, 0),
  })).filter(r => r.total > 0);

  // Socios: cálculo automático de saldos (histórico completo)
  function socioBalance(who: "Juanjo"|"Caro") {
    const aportado = allExpenses.filter(e => e.provider === who).reduce((s,e) => s + e.amount, 0);
    const devuelto = allExpenses.filter(e => e.category === `Pago a ${who}`).reduce((s,e) => s + e.amount, 0);
    return { aportado, devuelto, saldo: aportado - devuelto };
  }

  async function pagarSocio() {
    if (!socioPayModal) return;
    const amt = parseFloat(socioPayForm.amount);
    if (!amt || amt <= 0) return;
    setSocioPaySaving(true);
    await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: socioPayForm.date,
        category: `Pago a ${socioPayModal}`,
        description: `Pago deuda a ${socioPayModal}`,
        amount: amt,
        provider: "Magna",
        paymentMethod: "transferencia",
        notes: `Devolución de inversión a ${socioPayModal}`,
      }),
    });
    setSocioPayModal(null);
    setSocioPayForm({ amount: "", date: now.toISOString().split("T")[0] });
    loadAllExpenses();
    loadGastosExpenses();
    load();
    setSocioPaySaving(false);
  }

  // Contabilidad calcs
  const contabIncome = contabPayments.reduce((s,p) => s + p.amount, 0);
  const contabExpTotal = contabExpenses.reduce((s,e) => s + e.amount, 0);
  const contabNet = contabIncome - contabExpTotal;
  const today = new Date().toISOString().split("T")[0];
  const totalDebtPending = debts.reduce((s,d) => s + Math.max(0, d.totalAmount - d.paidAmount), 0);

  async function saveDebt() {
    setDebtSaving(true);
    await fetch("/api/debts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditor: debtForm.creditor,
        description: debtForm.description,
        totalAmount: parseFloat(debtForm.totalAmount||"0"),
        paidAmount: parseFloat(debtForm.paidAmount||"0"),
        startDate: debtForm.startDate || null,
        dueDate: debtForm.dueDate || null,
        notes: debtForm.notes || null,
      }),
    });
    setDebtModal(false);
    setDebtForm({ creditor:"", description:"", totalAmount:"", paidAmount:"0", startDate:"", dueDate:"", notes:"" });
    loadDebts(); setDebtSaving(false);
  }

  async function deleteDebt(id: string) {
    if (!confirm("¿Eliminar esta deuda?")) return;
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    loadDebts();
  }

  async function payDebt(debtId: string) {
    const amt = parseFloat(debtPayAmt);
    if (!amt || amt <= 0) return;
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;
    await fetch(`/api/debts/${debtId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidAmount: debt.paidAmount + amt }),
    });
    setDebtPayModal(null); setDebtPayAmt(""); loadDebts();
  }

  async function saveTask() {
    setTaskSaving(true);
    await fetch("/api/finance-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: taskForm.description, dueDate: taskForm.dueDate || null, priority: taskForm.priority }),
    });
    setTaskModal(false);
    setTaskForm({ description:"", dueDate:"", priority:"media" });
    loadTasks(); setTaskSaving(false);
  }

  async function toggleTask(task: FinanceTask) {
    await fetch(`/api/finance-tasks/${task.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    loadTasks();
  }

  async function deleteTask(id: string) {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await fetch(`/api/finance-tasks/${id}`, { method: "DELETE" });
    loadTasks();
  }

  const filteredTasks = tasks.filter(t => taskFilter === "all" || t.priority === taskFilter);
  const pendingTasks = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t => t.completed);

  const SUB_TABS: { key: typeof activeTab; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "gastos", label: "Gastos" },
    { key: "contabilidad", label: "Contabilidad" },
    { key: "dashboard", label: "Dashboard" },
    { key: "tareas", label: "Tareas" },
  ];

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="text-muted">Control de ingresos, egresos y gestión financiera</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "resumen" && (
            <>
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
              <button onClick={() => { setEditExpId(null); setExpForm({ date: now.toISOString().split("T")[0], category: "Insumos clínicos", description: "", amount: "", provider: "", paymentMethod: "efectivo", notes: "" }); setExpModal(true); }} className="btn-secondary text-xs">
                <Plus size={14} /> Gasto
              </button>
              <button onClick={() => setPayModal(true)} className="btn-primary text-xs">
                <Plus size={14} /> Cobro
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === t.key ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB RESUMEN ===== */}
      {activeTab === "resumen" && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#00A86B]" />
              <div className="flex items-start justify-between mt-1">
                <div>
                  <p className="text-[10.5px] text-[#9AA0B4] uppercase tracking-[0.6px] font-semibold">Ingresos</p>
                  <p className="text-[22px] font-bold text-[#00A86B] mt-1 leading-none tracking-tight">{fmtShort(income)}</p>
                  <p className="text-[11.5px] text-[#9AA0B4] mt-1">{payments.length} cobros</p>
                </div>
                <div className="w-9 h-9 rounded-[10px] bg-[#E6F7F1] flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={17} className="text-[#00A86B]" />
                </div>
              </div>
            </div>
            <div className="card p-4 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#E53935]" />
              <div className="flex items-start justify-between mt-1">
                <div>
                  <p className="text-[10.5px] text-[#9AA0B4] uppercase tracking-[0.6px] font-semibold">Gastos</p>
                  <p className="text-[22px] font-bold text-[#E53935] mt-1 leading-none tracking-tight">{fmtShort(expTotal)}</p>
                  <p className="text-[11.5px] text-[#9AA0B4] mt-1">{expenses.length} egresos</p>
                </div>
                <div className="w-9 h-9 rounded-[10px] bg-[#FDECEA] flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={17} className="text-[#E53935]" />
                </div>
              </div>
            </div>
            <div className="card p-4 overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${net >= 0 ? "bg-[#00A86B]" : "bg-[#E53935]"}`} />
              <div className="flex items-start justify-between mt-1">
                <div>
                  <p className="text-[10.5px] text-[#9AA0B4] uppercase tracking-[0.6px] font-semibold">Resultado neto</p>
                  <p className={`text-[22px] font-bold mt-1 leading-none tracking-tight ${net >= 0 ? "text-[#00A86B]" : "text-[#E53935]"}`}>{fmtShort(net)}</p>
                  <p className="text-[11.5px] text-[#9AA0B4] mt-1">{net >= 0 ? "Superávit" : "Déficit"}</p>
                </div>
                <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${net >= 0 ? "bg-[#E6F7F1]" : "bg-[#FDECEA]"}`}>
                  <DollarSign size={17} className={net >= 0 ? "text-[#00A86B]" : "text-[#E53935]"} />
                </div>
              </div>
            </div>
            <div className="card p-4 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#F59E0B]" />
              <div className="flex items-start justify-between mb-2 mt-1">
                <div>
                  <p className="text-[10.5px] text-[#9AA0B4] uppercase tracking-[0.6px] font-semibold">Margen</p>
                  <p className={`text-[22px] font-bold mt-1 leading-none tracking-tight ${margin >= 0 ? "text-[#F59E0B]" : "text-[#E53935]"}`}>{margin}%</p>
                  <p className="text-[11.5px] text-[#9AA0B4] mt-1">sobre ingresos</p>
                </div>
                <div className="w-9 h-9 rounded-[10px] bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={17} className="text-[#F59E0B]" />
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
                          <span className="capitalize text-slate-600 truncate max-w-[130px]">{c.name}</span>
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

          {/* Inner tabs + tables */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setInnerTab("ingresos")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${innerTab === "ingresos" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Ingresos ({payments.length})
                </button>
                <button onClick={() => setInnerTab("gastos")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${innerTab === "gastos" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Gastos ({expenses.length})
                </button>
              </div>
            </div>

            {innerTab === "ingresos" ? (
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
            ) : (
              <div className="hidden md:block card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Descripción</th>
                      <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Categoría</th>
                      <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Proveedor</th>
                      <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">Sin gastos este mes</td></tr>
                    ) : expenses.map(e => (
                      <tr key={e.id} className="table-row border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-slate-600 tabular-nums">{e.date}</td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{e.description}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${CAT_BADGE[e.category] ?? "bg-slate-100 text-slate-600"}`}>{e.category}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{e.provider || "—"}</td>
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
                        <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total gastos</td>
                        <td className="px-5 py-3 text-right font-bold text-red-600 text-base">{fmt(expTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== TAB GASTOS ===== */}
      {activeTab === "gastos" && (
        <div className="space-y-4">

          {/* Resumen "Lo que la clínica debe" */}
          {paidByTotals.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">💰 Lo que la clínica debe (gastos pagados de bolsillo)</p>
              <div className="flex flex-wrap gap-3">
                {paidByTotals.map(r => (
                  <div key={r.who} className={`flex-1 min-w-[140px] rounded-xl p-3 text-center border ${
                    r.who === "Juanjo" ? "bg-blue-50 border-blue-200" :
                    r.who === "Caro"   ? "bg-purple-50 border-purple-200" :
                    "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-xs text-slate-500 font-medium">{r.who}</p>
                    <p className={`text-lg font-bold ${
                      r.who === "Juanjo" ? "text-blue-700" :
                      r.who === "Caro"   ? "text-purple-700" :
                      "text-slate-700"
                    }`}>{fmt(r.total)}</p>
                    <p className="text-[10px] text-slate-400">{r.who === "Magna" ? "fondos propios" : "aportado este mes"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro mes opcional */}
              <div className="flex items-center gap-1">
                <input type="month" className="input py-1.5 text-sm w-auto"
                  value={gastoFilterMonth} onChange={e => setGastoFilterMonth(e.target.value)} />
                {gastoFilterMonth && (
                  <button onClick={() => setGastoFilterMonth("")}
                    className="text-slate-400 hover:text-slate-700 px-1.5 py-1 rounded text-xs font-bold"
                    title="Ver todos los meses">✕</button>
                )}
              </div>
              <select className="select py-1.5 text-sm w-auto" value={gastoFilterCat}
                onChange={e => setGastoFilterCat(e.target.value)}>
                <option value="">Todas las categorías</option>
                {EXP_CATEGORIES_FORM.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select py-1.5 text-sm w-auto" value={gastoFilterPaidBy}
                onChange={e => setGastoFilterPaidBy(e.target.value)}>
                <option value="">Todos</option>
                <option value="Juanjo">Juanjo</option>
                <option value="Caro">Caro</option>
                <option value="Magna">Magna</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.location.assign(`/api/finanzas/excel?month=${gastoFilterMonth}`)}
                className="btn-secondary text-xs gap-1.5">
                <Download size={14} /> Exportar Excel
              </button>
              <button onClick={() => { setEditExpId(null); setExpForm({ date: now.toISOString().split("T")[0], category: "Insumos clínicos", description: "", amount: "", provider: "", paymentMethod: "efectivo", notes: "" }); setExpModal(true); }} className="btn-primary text-xs">
                <Plus size={14} /> Nuevo gasto
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Pagado por</th>
                  <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                  {isAdmin && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">Sin gastos registrados para este mes</td></tr>
                ) : filteredExpenses.map(e => (
                  <tr key={e.id} className="table-row border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 text-slate-600 tabular-nums">{e.date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${CAT_BADGE[e.category] ?? "bg-slate-100 text-slate-600"}`}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{e.description}</td>
                    <td className="px-4 py-3">
                      {e.provider ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          e.provider === "Juanjo" ? "bg-blue-100 text-blue-700" :
                          e.provider === "Caro"   ? "bg-purple-100 text-purple-700" :
                          e.provider === "Magna"  ? "bg-slate-100 text-slate-600" :
                          "bg-slate-100 text-slate-500"
                        }`}>{e.provider}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(e.amount)}</td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditExp(e)} className="text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => deleteExp(e.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {filteredExpenses.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-red-50">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600 text-base">{fmt(filteredExpTotal)}</td>
                    {isAdmin && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB CONTABILIDAD ===== */}
      {activeTab === "contabilidad" && (
        <div className="space-y-5">
          {/* Resumen del período */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="section-title">Resumen del período</h2>
              <input type="month" className="input py-1.5 text-sm w-auto"
                value={contabMonth} onChange={e => setContabMonth(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Ingresos Netos</p>
                <p className="text-2xl font-bold text-emerald-700">{fmt(contabIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Gastos Totales</p>
                <p className="text-2xl font-bold text-red-600">{fmt(contabExpTotal)}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${contabNet >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Resultado Neto</p>
                <p className={`text-2xl font-bold ${contabNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(contabNet)}</p>
              </div>
            </div>
          </div>

          {/* Saldo socios — cálculo automático */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Lo que la clínica debe a los socios</h2>
            <p className="text-xs text-slate-400">Se calcula automáticamente sumando todos los gastos pagados por cada socio, descontando lo que ya se les ha devuelto.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["Juanjo","Caro"] as const).map(who => {
                const b = socioBalance(who);
                return (
                  <div key={who} className={`rounded-xl border p-5 space-y-3 ${who==="Juanjo" ? "bg-blue-50 border-blue-200" : "bg-purple-50 border-purple-200"}`}>
                    <p className={`font-bold text-lg ${who==="Juanjo" ? "text-blue-800" : "text-purple-800"}`}>{who}</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total aportado</span>
                        <span className="font-semibold text-slate-800">{fmt(b.aportado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ya devuelto</span>
                        <span className="font-semibold text-emerald-700">-{fmt(b.devuelto)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between">
                        <span className="font-semibold text-slate-700">Saldo pendiente</span>
                        <span className={`font-bold text-base ${b.saldo > 0 ? "text-red-600" : "text-emerald-700"}`}>{fmt(b.saldo)}</span>
                      </div>
                    </div>
                    {b.saldo > 0 && (
                      <button onClick={() => { setSocioPayModal(who); setSocioPayForm(f=>({...f, amount:""})); }}
                        className="btn-primary w-full justify-center text-sm">
                        Registrar pago a {who}
                      </button>
                    )}
                    {b.saldo <= 0 && b.aportado > 0 && (
                      <p className="text-center text-xs text-emerald-700 font-semibold">✓ Deuda saldada</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Otras deudas y obligaciones */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="section-title">Otras deudas y obligaciones</h2>
              <button onClick={() => setDebtModal(true)} className="btn-primary text-sm">
                <Plus size={14} /> Nueva deuda
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Acreedor</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Descripción</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Pagado</th>
                    <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Saldo</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {debts.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">Sin deudas registradas</td></tr>
                  ) : debts.map(d => {
                    const saldo = Math.max(0, d.totalAmount - d.paidAmount);
                    const isOverdue = d.dueDate && d.dueDate < today && saldo > 0;
                    const isPaid = saldo === 0;
                    const statusLabel = isPaid ? "pagada" : isOverdue ? "vencida" : "vigente";
                    const statusBadge = isPaid ? "bg-emerald-100 text-emerald-700" : isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                    return (
                      <tr key={d.id} className={`border-b border-slate-50 last:border-0 ${isOverdue ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{d.creditor}</td>
                        <td className="px-4 py-3 text-slate-600">{d.description}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(d.totalAmount)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{fmt(d.paidAmount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(saldo)}</td>
                        <td className="px-4 py-3 text-slate-500">{d.dueDate || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge}`}>{statusLabel}</span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex gap-1">
                            {!isPaid && (
                              <button onClick={() => setDebtPayModal(d.id)}
                                className="text-xs text-primary-600 hover:underline px-2 py-1 rounded hover:bg-primary-50">Pagar</button>
                            )}
                            {isAdmin && (
                              <button onClick={() => deleteDebt(d.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={13}/></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {debts.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700">Total saldo pendiente</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 text-base">{fmt(totalDebtPending)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB DASHBOARD ===== */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Ingresos mes</p>
              <p className="text-xl font-bold text-emerald-700">{fmtShort(income)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Gastos mes</p>
              <p className="text-xl font-bold text-red-600">{fmtShort(expTotal)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Resultado neto</p>
              <p className={`text-xl font-bold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtShort(net)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Deuda pendiente</p>
              <p className="text-xl font-bold text-amber-600">{fmtShort(totalDebtPending)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Comisiones TUU</p>
              <p className="text-xl font-bold text-orange-600">{fmtShort(tuuComm)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Área: Ingresos vs Gastos 12 meses */}
            <div className="card p-5 lg:col-span-2">
              <h2 className="section-title mb-4">Evolución mensual (Ingresos vs Gastos)</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashGradInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dashGradExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltipFinance />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" fill="url(#dashGradInc)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#dashGradExp)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted text-sm">Sin datos</div>
              )}
            </div>

            {/* Pie: distribución gastos por categoría */}
            <div className="card p-5">
              <h2 className="section-title mb-4">Gastos por categoría</h2>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={2}>
                      {catData.map((c) => (
                        <Cell key={c.name} fill={CAT_COLORS[c.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted text-sm">Sin datos</div>
              )}
            </div>
          </div>

          {/* Bar: métodos de pago */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Top 5 métodos de pago del mes</h2>
            {methodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={methodData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#588157" radius={[4, 4, 0, 0]} maxBarSize={40} name="Cobros" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted text-sm">Sin datos</div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB TAREAS ===== */}
      {activeTab === "tareas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { key: "all", label: "Todas" },
                { key: "alta", label: "Alta" },
                { key: "media", label: "Media" },
                { key: "baja", label: "Baja" },
              ].map(f => (
                <button key={f.key} onClick={() => setTaskFilter(f.key as any)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${taskFilter === f.key ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={() => setTaskModal(true)} className="btn-primary text-sm">
              <Plus size={14} /> Nueva tarea
            </button>
          </div>

          {/* Pendientes */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Pendientes ({pendingTasks.length})</h3>
            {pendingTasks.length === 0 ? (
              <div className="card p-8 text-center text-muted text-sm">Sin tareas pendientes</div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map(t => {
                  const isOverdue = t.dueDate && t.dueDate < today;
                  return (
                    <div key={t.id} className={`card p-3 flex items-center gap-3 ${isOverdue ? "border-red-200" : ""}`}>
                      <button onClick={() => toggleTask(t)} className="text-slate-300 hover:text-emerald-500 flex-shrink-0">
                        <Square size={18} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : "text-slate-900"}`}>{t.description}</p>
                        {t.dueDate && (
                          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                            Vence: {t.dueDate}{isOverdue ? " ⚠ Vencida" : ""}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-600"}`}>{t.priority}</span>
                      {isAdmin && (
                        <button onClick={() => deleteTask(t.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13}/></button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completadas */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Completadas ({completedTasks.length})</h3>
              <div className="space-y-2">
                {completedTasks.map(t => (
                  <div key={t.id} className="card p-3 flex items-center gap-3 bg-slate-50 opacity-70">
                    <button onClick={() => toggleTask(t)} className="text-emerald-500 flex-shrink-0">
                      <CheckSquare size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-500 line-through">{t.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[t.priority] ?? "bg-slate-100 text-slate-600"}`}>{t.priority}</span>
                    {isAdmin && (
                      <button onClick={() => deleteTask(t.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13}/></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monto ($) *</label>
            <input className="input" type="text" inputMode="numeric" value={payForm.amount}
              onChange={e => setPay("amount", fmtInput(e.target.value))} placeholder="0" />
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
      <Modal open={expModal} onClose={() => { setExpModal(false); setEditExpId(null); }} title={editExpId ? "Editar Gasto" : "Registrar Gasto"}>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={expForm.date} onChange={e => setExp("date", e.target.value)} />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={expForm.category} onChange={e => setExp("category", e.target.value)}>
                {EXP_CATEGORIES_FORM.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción *</label>
            <input className="input" value={expForm.description} onChange={e => setExp("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">¿De dónde salió la plata?</label>
              <select className="select" value={expForm.provider} onChange={e => setExp("provider", e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="Juanjo">Juanjo</option>
                <option value="Caro">Caro</option>
                <option value="Magna">Magna</option>
              </select>
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
            <input className="input" type="text" inputMode="numeric" value={expForm.amount}
              onChange={e => setExp("amount", fmtInput(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={expForm.notes} onChange={e => setExp("notes", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setExpModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveExp} disabled={saving || !expForm.description || !expForm.amount}>
            {saving ? "Guardando..." : editExpId ? "Guardar cambios" : "Registrar Gasto"}
          </button>
        </div>
      </Modal>

      {/* Debt modal */}
      <Modal open={debtModal} onClose={() => setDebtModal(false)} title="Nueva deuda">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Acreedor *</label>
              <input className="input" value={debtForm.creditor} onChange={e => setDebtForm(f=>({...f,creditor:e.target.value}))} placeholder="Banco, proveedor..." />
            </div>
            <div>
              <label className="label">Descripción *</label>
              <input className="input" value={debtForm.description} onChange={e => setDebtForm(f=>({...f,description:e.target.value}))} />
            </div>
            <div>
              <label className="label">Monto total *</label>
              <input className="input" type="number" value={debtForm.totalAmount} onChange={e => setDebtForm(f=>({...f,totalAmount:e.target.value}))} placeholder="0" />
            </div>
            <div>
              <label className="label">Monto pagado</label>
              <input className="input" type="number" value={debtForm.paidAmount} onChange={e => setDebtForm(f=>({...f,paidAmount:e.target.value}))} placeholder="0" />
            </div>
            <div>
              <label className="label">Fecha inicio</label>
              <input className="input" type="date" value={debtForm.startDate} onChange={e => setDebtForm(f=>({...f,startDate:e.target.value}))} />
            </div>
            <div>
              <label className="label">Fecha vencimiento</label>
              <input className="input" type="date" value={debtForm.dueDate} onChange={e => setDebtForm(f=>({...f,dueDate:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={debtForm.notes} onChange={e => setDebtForm(f=>({...f,notes:e.target.value}))} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setDebtModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveDebt} disabled={debtSaving || !debtForm.creditor || !debtForm.totalAmount}>
            {debtSaving ? "Guardando..." : "Registrar deuda"}
          </button>
        </div>
      </Modal>

      {/* Debt payment modal */}
      <Modal open={!!debtPayModal} onClose={() => {setDebtPayModal(null);setDebtPayAmt("");}} title="Registrar pago parcial">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Monto a pagar ($)</label>
            <input className="input" type="number" min="0" value={debtPayAmt}
              onChange={e => setDebtPayAmt(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => {setDebtPayModal(null);setDebtPayAmt("");}}>Cancelar</button>
          <button className="btn-primary" onClick={() => debtPayModal && payDebt(debtPayModal)} disabled={!debtPayAmt}>
            Registrar pago
          </button>
        </div>
      </Modal>

      {/* Socio payment modal */}
      <Modal open={!!socioPayModal} onClose={() => setSocioPayModal(null)} title={`Registrar pago a ${socioPayModal}`}>
        <div className="p-6 space-y-4">
          {socioPayModal && (() => {
            const b = socioBalance(socioPayModal);
            return (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Total aportado</span><span className="font-semibold">{fmt(b.aportado)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Ya devuelto</span><span className="font-semibold text-emerald-600">{fmt(b.devuelto)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-semibold text-slate-700">Saldo pendiente</span><span className="font-bold text-red-600">{fmt(b.saldo)}</span></div>
              </div>
            );
          })()}
          <div>
            <label className="label">Monto a pagar ($) *</label>
            <input className="input" type="number" min="1" value={socioPayForm.amount}
              onChange={e => setSocioPayForm(f=>({...f, amount: e.target.value}))}
              placeholder="0" />
          </div>
          <div>
            <label className="label">Fecha del pago *</label>
            <input className="input" type="date" value={socioPayForm.date}
              onChange={e => setSocioPayForm(f=>({...f, date: e.target.value}))} />
          </div>
          <p className="text-xs text-slate-400">Se creará automáticamente un gasto en la categoría &quot;Pago a {socioPayModal}&quot; pagado por Magna.</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setSocioPayModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={pagarSocio} disabled={socioPaySaving || !socioPayForm.amount || parseFloat(socioPayForm.amount) <= 0}>
            {socioPaySaving ? "Guardando..." : `Pagar a ${socioPayModal}`}
          </button>
        </div>
      </Modal>

      {/* Task modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Nueva tarea">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Descripción *</label>
            <input className="input" value={taskForm.description} onChange={e => setTaskForm(f=>({...f,description:e.target.value}))} placeholder="Descripción de la tarea..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha límite</label>
              <input className="input" type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f=>({...f,dueDate:e.target.value}))} />
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select className="select" value={taskForm.priority} onChange={e => setTaskForm(f=>({...f,priority:e.target.value}))}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setTaskModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveTask} disabled={taskSaving || !taskForm.description}>
            {taskSaving ? "Guardando..." : "Crear tarea"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
