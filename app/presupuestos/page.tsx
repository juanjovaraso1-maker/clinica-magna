"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, Trash2, FileText, Printer, ArrowLeft,
  CheckCircle, XCircle, Clock, CreditCard, ChevronRight,
  AlertCircle, TrendingUp, Mail, MessageCircle,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Treatment { id: string; name: string; category: string; price: number }
interface Convenio { id: string; name: string; discount: number; discountType: string; }
interface BudgetItem {
  description: string; tooth: string; area: string;
  quantity: number; unitPrice: number; discount: number; total: number;
}
interface Payment {
  id: string; date: string; amount: number; method: string; notes: string;
}
interface Budget {
  id: string; number: number; date: string; validUntil: string; status: string;
  subtotal: number; discount: number; total: number; notes: string;
  patient: { id: string; firstName: string; lastName: string; rut: string; phone: string; email: string; address: string };
  user: { id: string; name: string };
  items: Array<{ id: string; description: string; tooth: string; area: string; quantity: number; unitPrice: number; discount: number; total: number }>;
  payments: Payment[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

const initItem = (): BudgetItem => ({ description: "", tooth: "", area: "", quantity: 1, unitPrice: 0, discount: 0, total: 0 });

const AREAS = ["", "Maxilar superior", "Maxilar inferior", "Ambos maxilares", "Anterior superior", "Anterior inferior", "Posterior superior", "Posterior inferior"];

const STATUS_META: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending:  { label: "Pendiente", icon: Clock,        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  approved: { label: "Aprobado",  icon: CheckCircle,  color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
  rejected: { label: "Rechazado", icon: XCircle,      color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  expired:  { label: "Vencido",   icon: AlertCircle,  color: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
};

const METHOD_ICON: Record<string, string> = { efectivo: "💵", transferencia: "🏦", tarjeta: "💳", cheque: "📄" };

function PresupuestosContent() {
  const searchParams = useSearchParams();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const fromPatientId = searchParams.get("patientId");

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [clinicCfg, setClinicCfg] = useState<Record<string, string>>({});
  const [bundles, setBundles] = useState<Array<{ id: string; name: string; category: string; treatmentIds: string[] }>>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [discountType, setDiscountType] = useState<"pct"|"fixed">("fixed");
  const [form, setForm] = useState({
    patientId: fromPatientId ?? "", userId: "",
    date: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "pending", discount: 0, notes: "",
  });
  const [items, setItems] = useState<BudgetItem[]>([initItem()]);
  const [saving, setSaving] = useState(false);
  // Inline payment form inside detail
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], amount: "", method: "efectivo", notes: "" });
  const [payingSaving, setPayingSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  async function sendBudgetEmail(budgetId: string) {
    setEmailSending(true);
    const r = await fetch("/api/budgets/send-email", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ budgetId }) });
    const d = await r.json();
    setEmailSending(false);
    showToast(d.ok ? "✅ Presupuesto enviado por email" : `❌ ${d.error}`);
  }

  function sendBudgetWhatsApp(budget: Budget) {
    const phone = budget.patient.phone;
    if (!phone) { showToast("❌ El paciente no tiene teléfono"); return; }
    const fmt = (n:number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
    const items = budget.items.map((it,i) => `${i+1}. ${it.description}${it.tooth?` (D.${it.tooth})`:""}  ${fmt(it.total)}`).join("\n");
    const msg = `*PRESUPUESTO DENTAL N° ${String(budget.number).padStart(4,"0")}*\n${clinicCfg.clinic_name ?? "Clínica Magna"}\n\nEstimado/a *${budget.patient.firstName} ${budget.patient.lastName}*,\n\nAdjuntamos su presupuesto dental:\n\n${items}\n\n*TOTAL: ${fmt(budget.total)}*\n\nVálido por 30 días desde ${budget.date}.\n\n${clinicCfg.clinic_phone ? `📞 ${clinicCfg.clinic_phone}` : ""}\n${clinicCfg.clinic_whatsapp ? `💬 ${clinicCfg.clinic_whatsapp}` : ""}`;
    const clean = phone.replace(/\D/g,"");
    const num = clean.startsWith("56") ? clean : `56${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const load = useCallback(async () => {
    const q = filter !== "all" ? `?status=${filter}` : "";
    const [br, pr, ur, tr, cr, cvr] = await Promise.all([
      fetch(`/api/budgets${q}`), fetch("/api/patients"), fetch("/api/users"),
      fetch("/api/treatments"), fetch("/api/clinic-config"), fetch("/api/convenios"),
    ]);
    if (br.ok) setBudgets(await br.json());
    if (pr.ok) setPatients(await pr.json());
    if (ur.ok) setUsers(await ur.json());
    if (tr.ok) setTreatments(await tr.json());
    if (cr.ok) {
      const cfg = await cr.json();
      setClinicCfg(cfg);
      try { setBundles(JSON.parse(cfg.treatment_bundles ?? "[]")); } catch { setBundles([]); }
    }
    if (cvr.ok) setConvenios(await cvr.json());
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (fromPatientId) setOpen(true); }, [fromPatientId]);

  function applyBundle(bundle: { treatmentIds: string[] }) {
    const newItems = bundle.treatmentIds
      .map(tid => treatments.find(t => t.id === tid))
      .filter(Boolean)
      .map(t => ({
        description: t!.name, tooth: "", area: "", quantity: 1,
        unitPrice: t!.price, discount: 0, total: t!.price,
      }));
    setItems(prev => {
      const base = prev.filter(i => i.description.trim());
      return base.length ? [...base, ...newItems] : newItems;
    });
  }

  function applyTreatment(i: number, t: Treatment) {
    setItems(its => its.map((item, idx) => {
      if (idx !== i) return item;
      return { ...item, description: t.name, unitPrice: t.price, total: t.price * item.quantity * (1 - item.discount / 100) };
    }));
  }

  function updateItem(i: number, k: keyof BudgetItem, v: string | number) {
    setItems(its => its.map((item, idx) => {
      if (idx !== i) return item;
      const u = { ...item, [k]: v };
      if (["quantity", "unitPrice", "discount"].includes(k)) {
        u.total = Number(u.quantity) * Number(u.unitPrice) * (1 - Number(u.discount) / 100);
      }
      return u;
    }));
  }

  function applyConvenio(cv: Convenio) {
    if (cv.discountType === "pct") {
      setItems(its => its.map(item => ({
        ...item,
        discount: cv.discount,
        total: item.quantity * item.unitPrice * (1 - cv.discount / 100),
      })));
      setForm(f => ({ ...f, discount: 0 }));
    } else {
      setForm(f => ({ ...f, discount: cv.discount }));
      setDiscountType("fixed");
    }
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discountAmount = discountType === "pct"
    ? subtotal * Number(form.discount) / 100
    : Number(form.discount);
  const total = subtotal - discountAmount;

  function openEditBudget(b: Budget) {
    setForm({
      patientId: b.patient.id, userId: b.user.id,
      date: b.date, validUntil: b.validUntil ?? "",
      status: b.status, discount: b.discount, notes: b.notes ?? "",
    });
    setItems(b.items.map(i => ({ description:i.description, tooth:i.tooth??"", area:i.area??"", quantity:i.quantity, unitPrice:i.unitPrice, discount:i.discount, total:i.total })));
    setEditId(b.id);
    setDetailId(null);
    setOpen(true);
  }

  async function deleteBudget(id: string) {
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    setDetailId(null);
    load();
    showToast("✅ Presupuesto eliminado");
  }

  async function save() {
    setSaving(true);
    const payload = { ...form, discount: discountAmount, subtotal, total, items };
    if (editId) {
      await fetch(`/api/budgets/${editId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/budgets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setEditId(null);
    if (fromPatientId && !editId) { router.back(); return; }
    setOpen(false); load();
  }

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/budgets/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function registerPayment() {
    if (!detail || !payForm.amount) return;
    setPayingSaving(true);
    await fetch("/api/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: detail.patient.id,
        budgetId: detail.id,
        date: payForm.date,
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        notes: payForm.notes,
      }),
    });
    setPayForm(f => ({ ...f, amount: "", notes: "" }));
    setPayingSaving(false);
    load();
  }

  function printBudget() {
    const w = window.open("", "_blank");
    if (!w || !detail) return;
    const paid = detail.payments.reduce((s, p) => s + p.amount, 0);
    w.document.write(`
    <html><head><title>Presupuesto #${detail.number}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;max-width:780px;margin:40px auto;color:#1f2937;font-size:14px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #588157;padding-bottom:16px;margin-bottom:24px}
      .clinic-name{font-size:22px;font-weight:bold;color:#3a5a40}
      .clinic-info{font-size:12px;color:#6b7280;line-height:1.7;margin-top:4px}
      .budget-title{font-size:18px;font-weight:bold;color:#1f2937;margin-bottom:4px}
      .patient-box{background:#f2f5f0;border:1px solid #c4d5bc;border-radius:8px;padding:14px 16px;margin-bottom:20px}
      .patient-box strong{color:#3a5a40}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#e2eade;padding:8px 12px;text-align:left;font-size:11px;color:#3a5a40;text-transform:uppercase;letter-spacing:0.05em}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .totals{float:right;min-width:240px;background:#f8fafc;border:1px solid #e2eade;border-radius:8px;padding:12px 16px}
      .total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
      .grand-total{font-size:16px;font-weight:bold;border-top:2px solid #588157;padding-top:8px;margin-top:6px;color:#3a5a40}
      .paid-row{color:#059669;font-weight:600}
      .balance-row{color:#dc2626;font-weight:bold;font-size:14px}
      .status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold}
      .notes{margin-top:24px;padding:12px;border:1px solid #c4d5bc;border-radius:8px;font-size:13px;color:#476847;background:#f2f5f0}
      .disclaimer{margin-top:20px;padding:10px 14px;border:1px solid #fbbf24;border-radius:8px;background:#fffbeb;font-size:12px;color:#92400e}
      .footer{margin-top:20px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
      .payments-section{margin-top:20px}
      .payments-section h3{font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#588157;margin-bottom:8px}
      @media print{body{margin:20px}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="clinic-name">${clinicCfg.clinic_name ?? "Clínica Magna"}</div>
        <div class="clinic-info">
          ${clinicCfg.clinic_address ? `📍 ${clinicCfg.clinic_address}<br>` : ""}
          ${clinicCfg.clinic_phone ? `📞 ${clinicCfg.clinic_phone}<br>` : ""}
          ${clinicCfg.clinic_email ? `✉ ${clinicCfg.clinic_email}` : ""}
        </div>
      </div>
      <div style="text-align:right">
        <div class="budget-title">PRESUPUESTO #${String(detail.number).padStart(4, "0")}</div>
        <div style="font-size:12px;color:#6b7280">Fecha: ${detail.date}</div>
        ${detail.validUntil ? `<div style="font-size:12px;color:#6b7280">Válido hasta: ${detail.validUntil}</div>` : ""}
        <div style="margin-top:8px">
          <span class="status-badge" style="background:${detail.status === "approved" ? "#d1fae5" : detail.status === "rejected" ? "#fee2e2" : "#fef9c3"};color:${detail.status === "approved" ? "#065f46" : detail.status === "rejected" ? "#991b1b" : "#92400e"}">
            ${detail.status === "approved" ? "APROBADO" : detail.status === "rejected" ? "RECHAZADO" : "PENDIENTE"}
          </span>
        </div>
      </div>
    </div>
    <div class="patient-box">
      <strong>Paciente:</strong> ${detail.patient.firstName} ${detail.patient.lastName} &nbsp;·&nbsp;
      <strong>RUT:</strong> ${detail.patient.rut}
      ${detail.patient.phone ? ` &nbsp;·&nbsp; <strong>Tel:</strong> ${detail.patient.phone}` : ""}
      <br><strong>Profesional:</strong> ${detail.user.name}
      ${detail.patient.address ? `<br><span style="color:#6b7280">${detail.patient.address}</span>` : ""}
    </div>
    <table>
      <thead><tr>
        <th>Tratamiento</th>
        <th>Diente/Área</th>
        <th style="text-align:center">Cant.</th>
        <th style="text-align:right">P. Unit.</th>
        <th style="text-align:right">Dto.</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${detail.items.map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${item.tooth || item.area || "—"}</td>
          <td style="text-align:center">${item.quantity}</td>
          <td style="text-align:right">${fmt(item.unitPrice)}</td>
          <td style="text-align:right">${item.discount || 0}%</td>
          <td style="text-align:right"><strong>${fmt(item.total)}</strong></td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal:</span><span>${fmt(detail.subtotal)}</span></div>
      ${detail.discount > 0 ? `<div class="total-row" style="color:#dc2626"><span>Descuento:</span><span>-${fmt(detail.discount)}</span></div>` : ""}
      <div class="total-row grand-total"><span>TOTAL:</span><span>${fmt(detail.total)}</span></div>
      <div class="total-row paid-row"><span>Abonado:</span><span>${fmt(paid)}</span></div>
      <div class="total-row balance-row"><span>Saldo:</span><span>${fmt(detail.total - paid)}</span></div>
    </div>
    <div style="clear:both"></div>
    ${detail.payments.length > 0 ? `
    <div class="payments-section">
      <h3>Historial de pagos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Método</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${detail.payments.map(p => `<tr><td>${p.date}</td><td style="text-transform:capitalize">${p.method}</td><td style="text-align:right;color:#059669;font-weight:600">${fmt(p.amount)}</td></tr>`).join("")}</tbody>
      </table>
    </div>` : ""}
    ${detail.notes ? `<div class="notes"><strong>Observaciones:</strong> ${detail.notes}</div>` : ""}
    <div class="disclaimer">
      ⚕️ Algunos de los tratamientos requieren confirmación diagnóstica y este presupuesto tiene una duración de 1 mes desde su realización.
    </div>
    <div class="footer">
      <strong>${clinicCfg.clinic_name ?? "Clínica Magna"}</strong>${clinicCfg.clinic_slogan ? ` · ${clinicCfg.clinic_slogan}` : ""}<br>
      ${[clinicCfg.clinic_address, clinicCfg.clinic_phone, clinicCfg.clinic_whatsapp ? `WhatsApp: ${clinicCfg.clinic_whatsapp}` : "", clinicCfg.clinic_email].filter(Boolean).join(" · ")}
    </div>
    </body></html>`);
    w.document.close(); w.print();
  }

  function shareWhatsApp() {
    if (!detail) return;
    const clinicName = clinicCfg.clinic_name ?? "Clínica Magna";
    const msg = `Hola ${detail.patient.firstName}! 👋\n\nTe enviamos tu Presupuesto *#${String(detail.number).padStart(4, "0")}* de ${clinicName}.\n\n📋 *Tratamientos:*\n${detail.items.map(i => `• ${i.description}${i.tooth ? ` (D.${i.tooth})` : ""}: ${fmt(i.total)}`).join("\n")}\n\n💰 *Total: ${fmt(detail.total)}*\n${detail.validUntil ? `📅 Válido hasta: ${detail.validUntil}` : ""}\n\n${clinicCfg.clinic_address ? `📍 ${clinicCfg.clinic_address}\n` : ""}${clinicCfg.clinic_phone ? `📞 ${clinicCfg.clinic_phone}\n` : ""}\n_Algunos tratamientos requieren confirmación diagnóstica. Validez 1 mes desde su emisión._`;
    const phone = (clinicCfg.clinic_whatsapp || detail.patient.phone || "").replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const detail = detailId ? budgets.find(b => b.id === detailId) : null;
  const detailPaid = detail ? detail.payments.reduce((s, p) => s + p.amount, 0) : 0;
  const detailBalance = detail ? detail.total - detailPaid : 0;
  const detailPct = detail && detail.total > 0 ? Math.round((detailPaid / detail.total) * 100) : 0;

  const FILTERS = [
    { k: "all", l: "Todos", count: budgets.length },
    { k: "pending", l: "Pendientes", count: budgets.filter(b => b.status === "pending").length },
    { k: "approved", l: "Aprobados", count: budgets.filter(b => b.status === "approved").length },
    { k: "rejected", l: "Rechazados", count: budgets.filter(b => b.status === "rejected").length },
  ];

  const byCategory = treatments.reduce<Record<string, Treatment[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t); return acc;
  }, {});

  // KPIs
  const totalAmount = budgets.reduce((s, b) => s + b.total, 0);
  const totalPaid = budgets.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalBalance = totalAmount - totalPaid;

  return (
    <div className="space-y-5 max-w-7xl">
      {toast && <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {fromPatientId && (
            <button onClick={() => router.back()} className="btn-secondary text-xs">
              <ArrowLeft size={14} /> Volver
            </button>
          )}
          <div>
            <h1 className="page-title">Presupuestos</h1>
            <p className="text-muted">{budgets.length} presupuestos registrados</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> <span className="hidden sm:inline">Nuevo Presupuesto</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total presupuestado", value: fmtShort(totalAmount), sub: `${budgets.length} presupuestos`, icon: FileText, color: "text-slate-600", bg: "bg-slate-100" },
          { label: "Aprobados", value: String(budgets.filter(b => b.status === "approved").length), sub: "presupuestos", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total cobrado", value: fmtShort(totalPaid), sub: "abonado", icon: CreditCard, color: "text-primary-600", bg: "bg-primary-50" },
          { label: "Saldo pendiente", value: fmtShort(totalBalance), sub: "por cobrar", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="overflow-x-auto">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-fit min-w-max">
          {FILTERS.map(({ k, l, count }) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${filter === k ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {l} {count > 0 && <span className={`ml-1 text-xs ${filter === k ? "text-primary-500" : "text-slate-400"}`}>({count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {budgets.length === 0 ? (
          <div className="card p-10 text-center text-muted">No hay presupuestos</div>
        ) : budgets.map(b => {
          const paid = b.payments.reduce((s, p) => s + p.amount, 0);
          const pct = b.total > 0 ? Math.round((paid / b.total) * 100) : 0;
          const meta = STATUS_META[b.status] ?? STATUS_META.pending;
          const StatusIcon = meta.icon;
          return (
            <button key={b.id} onClick={() => setDetailId(b.id)}
              className="card p-4 w-full text-left flex gap-3 items-start hover:border-primary-200 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 text-sm">{b.patient.firstName} {b.patient.lastName}</p>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                    <StatusIcon size={11} />{meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">#{String(b.number).padStart(4, "0")} · {b.date}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{pct}%</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">Total: <span className="font-semibold text-slate-700">{fmt(b.total)}</span></span>
                  {b.total - paid > 0 && <span className="text-xs text-red-600 font-medium">Saldo: {fmt(b.total - paid)}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">N°</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Total</th>
              <th className="text-center px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Cobrado</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Saldo</th>
              <th className="text-center px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {budgets.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-muted">No hay presupuestos</td></tr>
            ) : budgets.map(b => {
              const paid = b.payments.reduce((s, p) => s + p.amount, 0);
              const pct = b.total > 0 ? Math.round((paid / b.total) * 100) : 0;
              const meta = STATUS_META[b.status] ?? STATUS_META.pending;
              const StatusIcon = meta.icon;
              return (
                <tr key={b.id} className="table-row cursor-pointer border-b border-slate-50 last:border-0"
                  onClick={() => setDetailId(b.id)}>
                  <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">#{String(b.number).padStart(4, "0")}</td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-900">{b.patient.firstName} {b.patient.lastName}</p>
                    <p className="text-xs text-slate-400 font-mono">{b.patient.rut}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 hidden lg:table-cell tabular-nums">{b.date}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-slate-900">{fmt(b.total)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums w-7">{pct}%</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3.5 text-right font-semibold text-xs hidden lg:table-cell ${b.total - paid > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {b.total - paid > 0 ? fmt(b.total - paid) : "Pagado"}
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border w-fit mx-auto ${meta.bg} ${meta.color}`}>
                      <StatusIcon size={11} />{meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <ChevronRight size={15} className="text-slate-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal open={!!detailId} onClose={() => setDetailId(null)} title={`Presupuesto #${String(detail.number).padStart(4, "0")}`} size="xl">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Status + actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {(() => {
                const meta = STATUS_META[detail.status] ?? STATUS_META.pending;
                const StatusIcon = meta.icon;
                return (
                  <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border ${meta.bg} ${meta.color}`}>
                    <StatusIcon size={14} />{meta.label}
                  </span>
                );
              })()}
              <div className="flex gap-2 flex-wrap">
                {detail.status === "pending" && (
                  <>
                    <button onClick={() => changeStatus(detail.id, "approved")}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium">
                      <CheckCircle size={13} /> Aprobar
                    </button>
                    <button onClick={() => changeStatus(detail.id, "rejected")}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium">
                      <XCircle size={13} /> Rechazar
                    </button>
                  </>
                )}
                {detail.status === "rejected" && (
                  <button onClick={() => changeStatus(detail.id, "pending")}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-medium">
                    <Clock size={13} /> Reabrir
                  </button>
                )}
                <button onClick={() => sendBudgetEmail(detail.id)} disabled={emailSending || !detail.patient.email}
                  title={!detail.patient.email ? "El paciente no tiene email" : "Enviar por email"}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  <Mail size={13} /> {emailSending ? "Enviando..." : "Email"}
                </button>
                <button onClick={() => sendBudgetWhatsApp(detail)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium">
                  <MessageCircle size={13} /> WhatsApp
                </button>
                <button onClick={printBudget}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">
                  <Printer size={13} /> PDF
                </button>
                <button onClick={() => openEditBudget(detail)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-medium">
                  <FileText size={13} /> Editar
                </button>
                {isAdmin && (
                  <button onClick={() => deleteBudget(detail.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium">
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* Patient + professional info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Paciente</p>
                <p className="font-semibold text-slate-900">{detail.patient.firstName} {detail.patient.lastName}</p>
                <p className="text-xs text-slate-400 font-mono">{detail.patient.rut}</p>
                {detail.patient.phone && <p className="text-xs text-slate-500 mt-0.5">{detail.patient.phone}</p>}
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Profesional</p>
                <p className="font-semibold text-slate-900">{detail.user.name}</p>
                <p className="text-xs text-slate-400 mt-1">Fecha: {detail.date}</p>
                {detail.validUntil && <p className="text-xs text-slate-400">Válido hasta: {detail.validUntil}</p>}
              </div>
            </div>

            {/* Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500">Tratamiento</th>
                    <th className="text-center px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">Diente/Área</th>
                    <th className="text-center px-3 py-2.5 text-xs text-slate-500">Cant.</th>
                    <th className="text-right px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">P. Unit.</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 hidden sm:table-cell">{item.tooth || item.area || "—"}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 hidden sm:table-cell">{fmt(item.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals + payment progress */}
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
              <div className="sm:min-w-56 space-y-2">
                <div className="flex justify-between text-sm gap-8">
                  <span className="text-slate-500">Subtotal</span><span>{fmt(detail.subtotal)}</span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Descuento</span><span className="text-red-600">-{fmt(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                  <span>Total</span><span>{fmt(detail.total)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${detailPct}%` }} />
                </div>
                <div className="flex justify-between text-sm text-emerald-700 font-medium">
                  <span>Abonado ({detailPct}%)</span><span>{fmt(detailPaid)}</span>
                </div>
                <div className={`flex justify-between text-sm font-bold ${detailBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Saldo</span><span>{detailBalance > 0 ? fmt(detailBalance) : "Pagado ✓"}</span>
                </div>
              </div>
            </div>

            {/* Payment history */}
            {detail.payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historial de abonos</p>
                <div className="space-y-1.5">
                  {detail.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{METHOD_ICON[p.method] ?? "💰"}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{fmt(p.amount)}</p>
                          <p className="text-xs text-slate-400">{p.date} · <span className="capitalize">{p.method}</span>
                            {p.notes && <span> · {p.notes}</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-emerald-600 font-bold text-sm">+{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Register payment inline */}
            {detailBalance > 0 && (
              <div className="border border-primary-200 bg-primary-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-3">Registrar abono</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="label text-xs">Fecha</label>
                    <input className="input py-1.5 text-sm" type="date" value={payForm.date}
                      onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label text-xs">Método</label>
                    <select className="select py-1.5 text-sm" value={payForm.method}
                      onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Monto ($)</label>
                    <input className="input py-1.5 text-sm" type="number" min="0"
                      placeholder={fmt(detailBalance)} value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label text-xs">Notas</label>
                    <input className="input py-1.5 text-sm" value={payForm.notes}
                      onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={registerPayment} disabled={payingSaving || !payForm.amount}
                    className="btn-primary text-sm py-1.5 px-4">
                    {payingSaving ? "Guardando..." : "Registrar abono"}
                  </button>
                </div>
              </div>
            )}

            {detail.notes && (
              <p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3">
                <strong className="text-slate-600">Obs:</strong> {detail.notes}
              </p>
            )}
          </div>
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end">
            <button className="btn-secondary" onClick={() => setDetailId(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* New/Edit budget modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditId(null); }} title={editId ? "Editar Presupuesto" : "Nuevo Presupuesto"} size="xl">
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">

          {/* ── Paciente + Profesional + Fechas ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!fromPatientId ? (
              <div>
                <label className="label">Paciente *</label>
                <select className="select" value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Paciente</label>
                <p className="input bg-slate-50 text-slate-600">
                  {patients.find(p => p.id === fromPatientId)?.firstName} {patients.find(p => p.id === fromPatientId)?.lastName}
                </p>
              </div>
            )}
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Válido hasta</label>
              <input className="input" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>

          {/* ── Convenio ── */}
          {convenios.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex-shrink-0">Convenio</span>
              <select className="select flex-1 py-1.5 text-sm border-emerald-300 focus:ring-emerald-500 bg-white"
                defaultValue=""
                onChange={e => {
                  const cv = convenios.find(c => c.id === e.target.value);
                  if (cv) applyConvenio(cv);
                  e.target.value = "";
                }}>
                <option value="">Seleccionar convenio para aplicar descuento...</option>
                {convenios.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.discountType === "pct" ? `${c.discount}%` : fmt(c.discount)} descuento
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Ítems ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Tratamientos</p>
              <div className="flex items-center gap-2">
                {bundles.length > 0 && (
                  <select className="text-xs border border-primary-200 rounded-lg px-2 py-1.5 text-primary-700 bg-primary-50 focus:outline-none"
                    defaultValue=""
                    onChange={e => {
                      const b = bundles.find(x => x.id === e.target.value);
                      if (b) applyBundle(b);
                      e.target.value = "";
                    }}>
                    <option value="" disabled>📦 Paquete...</option>
                    {bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                <button onClick={() => setItems(i => [...i, initItem()])}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors border border-primary-200">
                  <Plus size={13} /> Agregar ítem
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Item header */}
                  <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <input className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-none focus:ring-0 p-0"
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        placeholder="Descripción del tratamiento..." />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => setItems(its => its.filter((_, idx) => idx !== i))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Item body */}
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Catálogo */}
                    {treatments.length > 0 && (
                      <select className="select text-xs py-1.5 text-slate-500" onChange={e => {
                        const t = treatments.find(t => t.id === e.target.value);
                        if (t) applyTreatment(i, t); e.target.value = "";
                      }}>
                        <option value="">📋 Seleccionar del catálogo...</option>
                        {Object.entries(byCategory).map(([cat, ts]) => (
                          <optgroup key={cat} label={cat}>
                            {ts.map(t => <option key={t.id} value={t.id}>{t.name} — {fmt(t.price)}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}

                    {/* Diente + Área */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Diente</label>
                        <input className="input py-1.5 text-sm text-center" value={item.tooth}
                          onChange={e => updateItem(i, "tooth", e.target.value)} placeholder="16, 17..." />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Área</label>
                        <select className="select py-1.5 text-sm" value={item.area}
                          onChange={e => updateItem(i, "area", e.target.value)}>
                          {AREAS.map(a => <option key={a} value={a}>{a || "—"}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Cantidad + Precio + Descuento + Total */}
                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Cant.</label>
                        <input className="input py-1.5 text-sm text-center" type="number" min="1" value={item.quantity}
                          onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">P. Unit ($)</label>
                        <input className="input py-1.5 text-sm text-right" type="number" min="0" value={item.unitPrice}
                          onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Dto. (%)</label>
                        <input className="input py-1.5 text-sm text-right" type="number" min="0" max="100" value={item.discount}
                          onChange={e => updateItem(i, "discount", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Total</label>
                        <div className={`input py-1.5 text-sm text-right font-bold ${item.discount > 0 ? "text-primary-700" : "text-slate-800"} bg-slate-50`}>
                          {fmt(item.total)}
                        </div>
                      </div>
                    </div>

                    {/* Show discount breakdown */}
                    {item.discount > 0 && (
                      <p className="text-xs text-slate-400">
                        Precio original: <span className="line-through">{fmt(item.quantity * item.unitPrice)}</span>
                        {" "}— Descuento {item.discount}%: <span className="text-red-500">-{fmt(item.quantity * item.unitPrice * item.discount / 100)}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Totales ── */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span><span className="font-medium">{fmt(subtotal)}</span>
              </div>

              {/* Descuento global con tipo */}
              <div className="flex items-center gap-2">
                <span className="text-slate-600 flex-shrink-0">Descuento</span>
                <div className="flex items-center flex-1 gap-1.5 justify-end">
                  {/* Type toggle */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-300 text-xs">
                    <button type="button"
                      onClick={() => setDiscountType("pct")}
                      className={`px-2 py-1 font-semibold transition-colors ${discountType === "pct" ? "bg-primary-600 text-white" : "bg-white text-slate-600"}`}>%</button>
                    <button type="button"
                      onClick={() => setDiscountType("fixed")}
                      className={`px-2 py-1 font-semibold transition-colors ${discountType === "fixed" ? "bg-primary-600 text-white" : "bg-white text-slate-600"}`}>$</button>
                  </div>
                  <input className="input py-1 text-right w-24 text-sm" type="number" min="0"
                    value={form.discount}
                    onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600 text-xs">
                  <span>Ahorro</span><span>-{fmt(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-2.5 text-slate-900">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* ── Observaciones ── */}
          <div>
            <label className="label">Observaciones</label>
            <textarea className="input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas adicionales..." />
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => { setOpen(false); setEditId(null); }}>Cancelar</button>
          <button className="btn-primary" onClick={save}
            disabled={saving || !form.patientId || !form.userId || items.every(i => !i.description)}>
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear Presupuesto"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function Presupuestos() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/></div>}>
      <PresupuestosContent />
    </Suspense>
  );
}
