"use client";
import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Payment {
  id: string; date: string; amount: number; method: string; notes: string;
  patient: { firstName: string; lastName: string };
  budget?: { number: number } | null;
}
interface Expense {
  id: string; date: string; category: string; description: string;
  amount: number; provider: string; paymentMethod: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1);
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
  };
});

const EXP_CATEGORIES = ["materiales", "equipamiento", "arriendo", "servicios", "personal", "laboratorio", "otros"];

export default function Finanzas() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"ingresos" | "gastos">("ingresos");
  const [payModal, setPayModal] = useState(false);
  const [expModal, setExpModal] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [budgets, setBudgets] = useState<Array<{ id: string; number: number; patient: { firstName: string; lastName: string } }>>([]);
  const [payForm, setPayForm] = useState({ patientId: "", budgetId: "", date: new Date().toISOString().split("T")[0], amount: "", method: "efectivo", notes: "" });
  const [expForm, setExpForm] = useState({ date: new Date().toISOString().split("T")[0], category: "materiales", description: "", amount: "", provider: "", paymentMethod: "efectivo", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [pr, er, patr, budr] = await Promise.all([
      fetch(`/api/payments?month=${month}`),
      fetch(`/api/expenses?month=${month}`),
      fetch("/api/patients"),
      fetch("/api/budgets?status=approved"),
    ]);
    if (pr.ok) setPayments(await pr.json());
    if (er.ok) setExpenses(await er.json());
    if (patr.ok) setPatients(await patr.json());
    if (budr.ok) setBudgets(await budr.json());
  }

  useEffect(() => { load(); }, [month]);

  const income = payments.reduce((s, p) => s + p.amount, 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - expTotal;

  async function savePay() {
    setSaving(true);
    await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount), budgetId: payForm.budgetId || null }),
    });
    setPayModal(false); load();
    setSaving(false);
  }

  async function saveExp() {
    setSaving(true);
    await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount) }),
    });
    setExpModal(false); load();
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    await fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  const categoryColors: Record<string, string> = {
    materiales: "bg-blue-100 text-blue-700",
    equipamiento: "bg-violet-100 text-violet-700",
    arriendo: "bg-orange-100 text-orange-700",
    servicios: "bg-cyan-100 text-cyan-700",
    personal: "bg-emerald-100 text-emerald-700",
    laboratorio: "bg-rose-100 text-rose-700",
    otros: "bg-slate-100 text-slate-600",
  };

  const methodIcons: Record<string, string> = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", cheque: "📄" };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="text-muted">Control de ingresos y gastos</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select w-auto text-sm"
            value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value} className="capitalize">{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-xs uppercase tracking-wide">Ingresos</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(income)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{payments.length} cobros</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-xs uppercase tracking-wide">Gastos</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{fmt(expTotal)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{expenses.length} egresos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-xs uppercase tracking-wide">Resultado neto</p>
              <p className={`text-2xl font-bold mt-1 ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(net)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{net >= 0 ? "Superávit" : "Déficit"}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${net >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
              <DollarSign className={`w-5 h-5 ${net >= 0 ? "text-emerald-600" : "text-red-600"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Expense by category */}
      {expenses.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por categoría</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {EXP_CATEGORIES.map((cat) => {
              const total = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
              if (!total) return null;
              return (
                <div key={cat} className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-bold text-slate-900">{fmt(total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block capitalize ${categoryColors[cat]}`}>{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button onClick={() => setTab("ingresos")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === "ingresos" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              Ingresos ({payments.length})
            </button>
            <button onClick={() => setTab("gastos")}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === "gastos" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              Gastos ({expenses.length})
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPayModal(true)} className="btn-secondary text-xs">
              <Plus size={14} /> Cobro
            </button>
            <button onClick={() => setExpModal(true)} className="btn-secondary text-xs">
              <Plus size={14} /> Gasto
            </button>
          </div>
        </div>

        {tab === "ingresos" ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Presupuesto</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Método</th>
                  <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">Sin cobros este mes</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="px-5 py-3 text-slate-600">{p.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.patient.firstName} {p.patient.lastName}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {p.budget ? `#${String(p.budget.number).padStart(4, "0")}` : "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="capitalize text-slate-600">{methodIcons[p.method] ?? ""} {p.method}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {payments.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700">{fmt(income)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Proveedor</th>
                  <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">Sin gastos este mes</td></tr>
                ) : expenses.map((e) => (
                  <tr key={e.id} className="table-row">
                    <td className="px-5 py-3 text-slate-600">{e.date}</td>
                    <td className="px-4 py-3 text-slate-900">{e.description}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${categoryColors[e.category] ?? "bg-slate-100 text-slate-600"}`}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{e.provider || "—"}</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(e.amount)}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => deleteExpense(e.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-slate-700">Total gastos</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(expTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Cobro">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Paciente *</label>
            <select className="select" value={payForm.patientId} onChange={(e) => setPayForm((f) => ({ ...f, patientId: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Asociar a presupuesto</label>
            <select className="select" value={payForm.budgetId} onChange={(e) => setPayForm((f) => ({ ...f, budgetId: e.target.value }))}>
              <option value="">Sin presupuesto</option>
              {budgets.filter((b) => !payForm.patientId || b.patient.firstName).map((b) => (
                <option key={b.id} value={b.id}>#{String(b.number).padStart(4, "0")} — {b.patient.firstName} {b.patient.lastName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="select" value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
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
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input" value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} />
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
              <input className="input" type="date" value={expForm.date} onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}>
                {EXP_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción *</label>
            <input className="input" value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Proveedor</label>
              <input className="input" value={expForm.provider} onChange={(e) => setExpForm((f) => ({ ...f, provider: e.target.value }))} />
            </div>
            <div>
              <label className="label">Forma de pago</label>
              <select className="select" value={expForm.paymentMethod} onChange={(e) => setExpForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monto ($) *</label>
            <input className="input" type="number" min="0" value={expForm.amount}
              onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
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
