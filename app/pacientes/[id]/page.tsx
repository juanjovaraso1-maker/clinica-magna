"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Edit2, Phone, Mail, MapPin, Heart, Plus, Trash2, Upload,
  ExternalLink, CreditCard, AlertTriangle, Pill, Calendar, FileText,
  TrendingUp, Activity, ChevronRight, Check, X, Save, Printer, ClipboardList,
  BookOpen, CalendarPlus, Banknote, MessageCircle, CheckCircle, XCircle, Clock,
  Pencil, Download,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import DentalChart from "@/components/odontogram/DentalChart";
import FacialChart from "@/components/odontogram/FacialChart";

interface BudgetItem { id:string; description:string; tooth:string; area:string; quantity:number; unitPrice:number; discount:number; total:number; status:string; sessions:number }
interface Patient {
  id: string; rut: string; firstName: string; lastName: string;
  email: string; phone: string; gender: string; address: string; city: string;
  healthInsurance: string; birthDate: string; notes: string;
  clinicalRecord?: { bloodType:string; allergies:string; currentMedications:string; medicalBackground:string; dentalBackground:string; habits:string; observations:string };
  evolutions: Array<{ id:string; date:string; diagnosis:string; treatment:string; tooth:string; observations:string; cost:number; user:{name:string} }>;
  budgets: Array<{ id:string; number:number; date:string; validUntil:string; status:string; subtotal:number; total:number; discount:number; notes:string; items:BudgetItem[]; payments:Array<{id:string;amount:number;date:string;method:string;notes:string}>; user:{id:string;name:string} }>;
  payments: Array<{ id:string; date:string; amount:number; method:string; notes:string; reference?:string; budget?:{number:number} }>;
  appointments: Array<{ id:string; date:string; startTime:string; type:string; status:string; user:{name:string} }>;
  documents: Array<{ id:string; name:string; type:string; fileName:string; mimeType:string; size:number; createdAt:string }>;
}

const TABS = ["Historial","Ficha Clínica","Odontograma","Estética Facial","Evoluciones","Presupuestos","Pagos","Documentos","Datos","Citas"];

function fmt(n:number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }

const CARE_TEMPLATES: Record<string, string> = {
  "Post-exodoncia": "• Morder el algodón firmemente 30–40 minutos y luego retirarlo sin escupir.\n• Evitar enjuagarse la boca las primeras 24 horas.\n• Aplicar hielo externo (20 min sí / 20 min no) durante las primeras 2–3 horas.\n• No consumir alimentos calientes, picantes ni duros por 24 horas. Dieta blanda 2–3 días.\n• No fumar ni consumir alcohol por al menos 48 horas.\n• Tomar los medicamentos indicados según prescripción.\n• Si presenta sangrado abundante, inflamación intensa o fiebre, contactar a la clínica.",
  "Post-endodoncia": "• Es normal sentir sensibilidad o molestias leves durante algunos días.\n• Evitar morder con la pieza tratada hasta recibir la restauración definitiva.\n• Tomar los medicamentos indicados según indicación.\n• Mantener higiene oral normal, cepillando con suavidad la zona.\n• Acudir al control indicado por el profesional.",
  "Post-blanqueamiento": "• Evitar alimentos y bebidas pigmentantes (café, té, vino tinto, betarraga) durante 48 horas.\n• No fumar durante 48 horas.\n• Es normal sentir sensibilidad dental transitoria.\n• Usar pasta dental para dientes sensibles si es necesario.",
  "Post-implante": "• No enjuagarse ni escupir las primeras 24 horas.\n• Aplicar hielo externamente durante las primeras horas.\n• Dieta líquida y blanda por 5–7 días.\n• Cepillar suavemente la zona, evitando el implante las primeras 48h.\n• No fumar durante el proceso de oseointegración.\n• Tomar los antibióticos y analgésicos indicados. Acudir a los controles programados.",
  "Post-cirugía oral": "• Morder el algodón 30–45 minutos.\n• Evitar esfuerzo físico por 48–72 horas.\n• No escupir ni sorberse el labio las primeras 24 horas.\n• Aplicar frío local las primeras 24h.\n• Dieta líquida y fría las primeras 12h, luego blanda.\n• Enjuagues con agua tibia con sal desde el día siguiente.\n• Tomar antibióticos y analgésicos según prescripción.",
  "Higiene oral": "• Cepillarse los dientes al menos 3 veces al día (especialmente antes de dormir).\n• Usar seda dental o cepillos interdentales diariamente.\n• Usar enjuague bucal una vez al día.\n• Cambiar el cepillo cada 3 meses.\n• Visitar al dentista cada 6 meses para control y limpieza profesional.",
};

const RX_TEMPLATES: Record<string, Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string}>> = {
  "Post-exodoncia": [
    { drug:"Amoxicilina 500 mg", dose:"1 comprimido", freq:"c/8h", duration:"7 días", route:"oral", instructions:"Tomar con alimentos" },
    { drug:"Ibuprofeno 400 mg", dose:"1 comprimido", freq:"c/8h", duration:"3 días", route:"oral", instructions:"Si hay dolor, tomar con alimentos" },
    { drug:"Clorhexidina 0.12% enjuague", dose:"15 ml", freq:"c/12h", duration:"7 días", route:"topica", instructions:"Enjuagar 1 min y escupir, no tragar" },
  ],
  "Post-endodoncia": [
    { drug:"Ibuprofeno 400 mg", dose:"1 comprimido", freq:"c/8h", duration:"3 días", route:"oral", instructions:"Tomar con alimentos según dolor" },
    { drug:"Amoxicilina 500 mg", dose:"1 comprimido", freq:"c/8h", duration:"7 días", route:"oral", instructions:"Completar el tratamiento completo" },
  ],
  "Post-implante": [
    { drug:"Amoxicilina 500 mg", dose:"1 comprimido", freq:"c/8h", duration:"7 días", route:"oral", instructions:"Iniciar 1h antes del procedimiento" },
    { drug:"Ibuprofeno 600 mg", dose:"1 comprimido", freq:"c/8h", duration:"5 días", route:"oral", instructions:"Tomar con alimentos" },
    { drug:"Clorhexidina 0.12% enjuague", dose:"15 ml", freq:"c/12h", duration:"14 días", route:"topica", instructions:"Enjuagar 1 min y escupir" },
  ],
  "Analgesia leve": [
    { drug:"Paracetamol 500 mg", dose:"1–2 comprimidos", freq:"c/6–8h", duration:"3 días", route:"oral", instructions:"No superar 4 g/día" },
  ],
};

const ITEM_STATUS: Record<string,{label:string;color:string}> = {
  pending:     { label:"Pendiente",   color:"bg-slate-100 text-slate-600" },
  in_progress: { label:"En progreso", color:"bg-amber-100 text-amber-700" },
  completed:   { label:"Completado",  color:"bg-emerald-100 text-emerald-700" },
};

const METHOD_ICON: Record<string,string> = { efectivo:"💵", transferencia:"🏦", debito:"💳", credito:"💳", cheque:"📄" };

const initPayForm = () => ({ date: new Date().toISOString().split("T")[0], budgetId:"", notes:"" });
const initPayItems = () => [{ method:"efectivo", amount:"" }];

export default function PatientDetail() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient|null>(null);
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<Array<{id:string;name:string;rut?:string}>>([]);
  const [evoModal, setEvoModal] = useState(false);
  const [evoForm, setEvoForm] = useState({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"" });
  const [evoItems, setEvoItems] = useState([{ treatment:"", tooth:"", cost:"" }]);
  const [evoBudgetId, setEvoBudgetId] = useState("");
  const [evoBudgetItemId, setEvoBudgetItemId] = useState("");
  const [evoItemStatus, setEvoItemStatus] = useState("in_progress");
  const [saving, setSaving] = useState(false);
  const [rxModal, setRxModal] = useState(false);
  const [rxTemplate, setRxTemplate] = useState("");
  const [rxUserId, setRxUserId] = useState("");
  const [rxItems, setRxItems] = useState([{ drug:"", dose:"", freq:"", duration:"", route:"oral", instructions:"" }]);
  const [rxNotes, setRxNotes] = useState("");
  const [cuidadosModal, setCuidadosModal] = useState(false);
  const [cuidadosTemplate, setCuidadosTemplate] = useState("Post-exodoncia");
  const [cuidadosText, setCuidadosText] = useState(CARE_TEMPLATES["Post-exodoncia"]);
  const [cuidadosUserId, setCuidadosUserId] = useState("");
  const [odontogram, setOdontogram] = useState<Record<string,{condition:string;surfaces?:Record<string,string>;notes:string}>>({});
  const [facial, setFacial] = useState<Record<string,{treatment:string;units:number;notes:string}>>({});
  const [oSaving, setOSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("radiografia");
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState(initPayForm());
  const [payItems, setPayItems] = useState(initPayItems());
  const [payEvolutionId, setPayEvolutionId] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [fichaEdit, setFichaEdit] = useState(false);
  const [fichaForm, setFichaForm] = useState({ bloodType:"", allergies:"", currentMedications:"", medicalBackground:"", dentalBackground:"", habits:"", observations:"" });
  const [fichaSaving, setFichaSaving] = useState(false);
  const [editPatient, setEditPatient] = useState(false);
  const [editForm, setEditForm] = useState({ firstName:"", lastName:"", phone:"", email:"", address:"", city:"", healthInsurance:"", birthDate:"", notes:"" });
  const [editSaving, setEditSaving] = useState(false);
  const [clinicCfg, setClinicCfg] = useState<Record<string,string>>({});
  const [toast, setToast] = useState<string|null>(null);
  const [emailSending, setEmailSending] = useState<string|null>(null);
  const [treatments, setTreatments] = useState<Array<{id:string;name:string;category:string;price:number}>>([]);
  const [budgetDetailId, setBudgetDetailId] = useState<string|null>(null);
  const [budgetPayForm, setBudgetPayForm] = useState({ date:new Date().toISOString().split("T")[0], amount:"", method:"efectivo", notes:"" });
  const [budgetPaySaving, setBudgetPaySaving] = useState(false);
  const [budgetCreateOpen, setBudgetCreateOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ userId:"", date:new Date().toISOString().split("T")[0], validUntil:new Date(Date.now()+30*86400000).toISOString().split("T")[0], status:"pending", discount:0, notes:"" });
  const [budgetItems, setBudgetItems] = useState([{ description:"", tooth:"", area:"", quantity:1, unitPrice:0, discount:0, total:0 }]);
  const [budgetEditId, setBudgetEditId] = useState<string|null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [rxEmailSending, setRxEmailSending] = useState(false);
  const [careEmailSending, setCareEmailSending] = useState(false);
  const [payEditId, setPayEditId] = useState<string|null>(null);
  const [payEditForm, setPayEditForm] = useState({ date:"", amount:"", method:"efectivo", notes:"" });
  const [payEditSaving, setPayEditSaving] = useState(false);
  const [budgetDropIdx, setBudgetDropIdx] = useState<number|null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);

  async function load() {
    const [pr, ur, or_, fr, cr, tr] = await Promise.all([
      fetch(`/api/patients/${id}`), fetch("/api/users"),
      fetch(`/api/odontogram?patientId=${id}`),
      fetch(`/api/facial?patientId=${id}`),
      fetch("/api/clinic-config"),
      fetch("/api/treatments"),
    ]);
    if (pr.ok) setPatient(await pr.json());
    if (ur.ok) setUsers(await ur.json());
    if (or_.ok) setOdontogram(await or_.json());
    if (fr.ok) setFacial(await fr.json());
    if (cr.ok) setClinicCfg(await cr.json());
    if (tr.ok) setTreatments(await tr.json());
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  async function sendRxEmail() {
    if (!patient?.email) { showToast("❌ El paciente no tiene email"); return; }
    if (!rxUserId || rxItems.every(m=>!m.drug.trim())) { showToast("❌ Selecciona profesional y agrega medicamentos"); return; }
    setRxEmailSending(true);
    const professional = users.find(u => u.id === rxUserId);
    const r = await fetch("/api/send-rx", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ patientName:`${patient.firstName} ${patient.lastName}`, patientRut:patient.rut, patientEmail:patient.email, professionalName:professional?.name??"", medications:rxItems.filter(m=>m.drug.trim()), notes:rxNotes }) });
    const d = await r.json();
    setRxEmailSending(false);
    showToast(d.ok ? "✅ Receta enviada por email" : `❌ ${d.error}`);
  }

  async function sendCareEmail() {
    if (!patient?.email) { showToast("❌ El paciente no tiene email"); return; }
    setCareEmailSending(true);
    const professional = users.find(u => u.id === cuidadosUserId);
    const r = await fetch("/api/send-care", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ patientName:`${patient.firstName} ${patient.lastName}`, patientEmail:patient.email, professionalName:professional?.name??"", templateName:cuidadosTemplate, text:cuidadosText }) });
    const d = await r.json();
    setCareEmailSending(false);
    showToast(d.ok ? "✅ Indicaciones enviadas por email" : `❌ ${d.error}`);
  }

  async function changeBudgetStatus(budgetId: string, status: string) {
    await fetch(`/api/budgets/${budgetId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });
    load();
  }

  async function registerBudgetPayment() {
    if (!budgetDetailId || !budgetPayForm.amount) return;
    setBudgetPaySaving(true);
    await fetch("/api/payments", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ patientId:id, budgetId:budgetDetailId, date:budgetPayForm.date, amount:parseFloat(budgetPayForm.amount), method:budgetPayForm.method, notes:budgetPayForm.notes||null }) });
    setBudgetPayForm(f => ({ ...f, amount:"", notes:"" }));
    setBudgetPaySaving(false);
    load();
  }

  function openBudgetCreate() {
    setBudgetForm({ userId:"", date:new Date().toISOString().split("T")[0], validUntil:new Date(Date.now()+30*86400000).toISOString().split("T")[0], status:"pending", discount:0, notes:"" });
    setBudgetItems([{ description:"", tooth:"", area:"", quantity:1, unitPrice:0, discount:0, total:0 }]);
    setBudgetEditId(null);
    setBudgetCreateOpen(true);
  }

  function openBudgetEdit(b: Patient["budgets"][0]) {
    setBudgetForm({ userId:b.user.id, date:b.date, validUntil:b.validUntil??"", status:b.status, discount:b.discount, notes:b.notes??"" });
    setBudgetItems(b.items.map(i => ({ description:i.description, tooth:i.tooth??"", area:i.area??"", quantity:i.quantity, unitPrice:i.unitPrice, discount:i.discount??0, total:i.total })));
    setBudgetEditId(b.id);
    setBudgetDetailId(null);
    setBudgetCreateOpen(true);
  }

  async function saveBudget() {
    setBudgetSaving(true);
    const validItems = budgetItems.filter(i => i.description.trim());
    const subtotal = validItems.reduce((s,i) => s+i.total, 0);
    const total = subtotal - Number(budgetForm.discount);
    if (budgetEditId) {
      await fetch(`/api/budgets/${budgetEditId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...budgetForm, subtotal, total, items:validItems }) });
    } else {
      await fetch("/api/budgets", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...budgetForm, patientId:id, subtotal, total, items:validItems }) });
    }
    setBudgetSaving(false); setBudgetCreateOpen(false); setBudgetEditId(null);
    load(); showToast(budgetEditId ? "✅ Presupuesto actualizado" : "✅ Presupuesto creado");
  }

  function updateBudgetItem(i: number, k: string, v: string|number) {
    setBudgetItems(its => its.map((item, idx) => {
      if (idx !== i) return item;
      const u = { ...item, [k]: v };
      if (["quantity","unitPrice","discount"].includes(k)) u.total = Number(u.quantity)*Number(u.unitPrice)*(1-Number(u.discount)/100);
      return u;
    }));
  }

  function openPayEdit(p: Patient["payments"][0]) {
    setPayEditId(p.id);
    setPayEditForm({ date:p.date, amount:String(p.amount), method:p.method, notes:p.notes??"" });
  }

  async function savePayEdit() {
    if (!payEditId) return;
    setPayEditSaving(true);
    await fetch(`/api/payments/${payEditId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ date:payEditForm.date, amount:parseFloat(payEditForm.amount), method:payEditForm.method, notes:payEditForm.notes||null }) });
    setPayEditId(null); setPayEditSaving(false); load();
  }

  async function deletePayment(payId: string) {
    if (!confirm("¿Eliminar este pago? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/payments/${payId}`, { method:"DELETE" });
    load(); showToast("✅ Pago eliminado");
  }

  async function sendBudgetEmail(budgetId: string) {
    setEmailSending(budgetId);
    const r = await fetch("/api/budgets/send-email", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ budgetId }) });
    const d = await r.json();
    setEmailSending(null);
    showToast(d.ok ? "✅ Presupuesto enviado por email" : `❌ ${d.error}`);
  }

  function sendBudgetWA(b: { number:number; date:string; total:number; items:BudgetItem[] }) {
    if (!patient?.phone) { showToast("❌ El paciente no tiene teléfono"); return; }
    const fmtCLP = (n:number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
    const lines = b.items.map((it,i)=>`${i+1}. ${it.description}${it.tooth?` (D.${it.tooth})`:""}  ${fmtCLP(it.total)}`).join("\n");
    const msg = `*PRESUPUESTO DENTAL N° ${String(b.number).padStart(4,"0")}*\n${clinicCfg.clinic_name??"Clínica Magna"}\n\nEstimado/a *${patient.firstName} ${patient.lastName}*,\n\n${lines}\n\n*TOTAL: ${fmtCLP(b.total)}*\n\nVálido por 30 días desde ${b.date}.`;
    const clean = patient.phone.replace(/\D/g,"");
    const num = clean.startsWith("56")?clean:`56${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  async function deleteBudget(budgetId: string) {
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/budgets/${budgetId}`, { method:"DELETE" });
    load();
    showToast("✅ Presupuesto eliminado");
  }

  // Derive template maps from clinicCfg, fall back to hardcoded constants
  const activeRxTemplates: Record<string, Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string}>> = (() => {
    try {
      if (clinicCfg.rx_templates) {
        const arr = JSON.parse(clinicCfg.rx_templates) as Array<{name:string;medications:Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string}>}>;
        if (arr.length > 0) return Object.fromEntries(arr.map(t => [t.name, t.medications]));
      }
    } catch { /* ignore parse errors */ }
    return RX_TEMPLATES;
  })();

  const activeCareTemplates: Record<string, string> = (() => {
    try {
      if (clinicCfg.care_templates) {
        const arr = JSON.parse(clinicCfg.care_templates) as Array<{name:string;text:string}>;
        if (arr.length > 0) return Object.fromEntries(arr.map(t => [t.name, t.text]));
      }
    } catch { /* ignore parse errors */ }
    return CARE_TEMPLATES;
  })();

  useEffect(() => { load(); }, [id]);

  async function saveEvo() {
    const validItems = evoItems.filter(i => i.treatment.trim());
    if (!validItems.length || !evoForm.userId) return;
    setSaving(true);
    await Promise.all(validItems.map(item =>
      fetch("/api/evolutions", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patientId:id, date:evoForm.date, diagnosis:evoForm.diagnosis,
          treatment:item.treatment, tooth:item.tooth, observations:evoForm.observations,
          cost:parseFloat(item.cost)||0, userId:evoForm.userId }) })
    ));
    if (evoBudgetItemId) {
      await fetch(`/api/budget-items/${evoBudgetItemId}`, { method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ status: evoItemStatus }) });
    }
    setEvoModal(false); setEvoBudgetId(""); setEvoBudgetItemId("");
    setEvoForm({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"" });
    setEvoItems([{ treatment:"", tooth:"", cost:"" }]);
    load(); setSaving(false);
  }

  async function deleteEvolution(evoId: string) {
    if (!confirm("¿Eliminar esta evolución?")) return;
    await fetch("/api/evolutions", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id: evoId }) });
    load();
  }

  function buildDocHeader(): string {
    const name = (clinicCfg.clinic_name || "Clínica Magna").toUpperCase();
    const sub  = clinicCfg.clinic_subtitle || "Odontología y Estética Facial";
    const addr = clinicCfg.clinic_address  || "";
    const phone= clinicCfg.clinic_phone    || "";
    const mail = clinicCfg.clinic_email    || "";
    const web  = clinicCfg.clinic_website  || "";
    const ig   = clinicCfg.clinic_instagram|| "";
    const l1   = [addr, phone&&`WHATSAPP ${phone}`, mail].filter(Boolean).join("  |  ");
    const l2   = [web, ig&&`INSTAGRAM ${ig}`].filter(Boolean).join("  |  ");
    const logoBase = typeof window !== "undefined" ? window.location.origin + "/logo.jpg" : "/logo.jpg";
    return `<div style="display:flex;align-items:flex-start;gap:14px;padding-bottom:10px;border-bottom:2px solid #1e5f74;margin-bottom:18px">
      <img src="${logoBase}" style="width:80px;height:70px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'"/>
      <div>
        <div style="font-size:19px;font-weight:bold;color:#000;letter-spacing:0.5px">${name}</div>
        <div style="font-size:11px;font-style:italic;color:#2e75b6;margin-top:2px">${sub}</div>
        ${l1?`<div style="font-size:9px;color:#555;margin-top:3px">${l1}</div>`:""}
        ${l2?`<div style="font-size:9px;color:#555">${l2}</div>`:""}
      </div></div>`;
  }

  function buildDocProfPat(prof:{name:string;rut?:string;showRut?:boolean}, extra:{label:string;value:string}[]): string {
    const showRut = prof.showRut !== false;
    return `<table style="width:100%;border-collapse:collapse;margin:14px 0">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:20px">
          <div style="font-size:11px;font-weight:bold;color:#2e75b6;border-bottom:1.5px solid #2e75b6;margin-bottom:6px;padding-bottom:2px">PROFESIONAL</div>
          <div style="font-size:11px"><b>Nombre:</b> ${prof.name}</div>
          ${showRut?`<div style="font-size:11px"><b>RUT:</b> ${prof.rut||""}</div>`:""}
        </td>
        <td style="width:50%;vertical-align:top">
          <div style="font-size:11px;font-weight:bold;color:#2e75b6;border-bottom:1.5px solid #2e75b6;margin-bottom:6px;padding-bottom:2px">PACIENTE</div>
          ${extra.map(e=>`<div style="font-size:11px"><b>${e.label}:</b> ${e.value}</div>`).join("")}
        </td>
      </tr></table>`;
  }

  function buildDocFooter(left:string, right:string): string {
    return `<table style="width:100%;margin-top:48px;font-size:10px">
      <tr>
        <td style="width:45%;text-align:center;border-top:1px solid #555;padding-top:5px">${left}</td>
        <td style="width:10%"></td>
        <td style="width:45%;text-align:center;border-top:1px solid #555;padding-top:5px">${right}</td>
      </tr></table>`;
  }

  function openDocWindow(title:string, body:string) {
    const w = window.open("","_blank","width=860,height=1100");
    if (!w) { alert("Permite ventanas emergentes para imprimir."); return; }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title>
      <style>@page{margin:14mm;size:A4 portrait}*{box-sizing:border-box}body{font-family:'Times New Roman',Times,serif;font-size:11px;color:#1a1a1a;margin:0}b{font-weight:bold}@media print{.noprint{display:none!important}}</style>
      </head><body>${body}
      <button class="noprint" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:#1f4e79;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:sans-serif">🖨 Imprimir / PDF</button>
      </body></html>`);
    w.document.close();
  }

  function printRx() {
    if (!patient) return;
    const professional = users.find(u => u.id === rxUserId);
    const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const meds = rxItems.filter(m=>m.drug.trim());
    const fmtBD = patient.birthDate ? patient.birthDate.split("T")[0] : "";
    const medLines = meds.map((m,i)=>`
      <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:bold;text-transform:uppercase;color:#1a1a1a;margin-bottom:3px">${i+1}-. ${m.drug.toUpperCase()}</div>
        <div style="font-size:11.5px;text-transform:uppercase;color:#1a1a1a;margin-bottom:3px">
          ${["TOMAR", m.dose&&m.dose.toUpperCase(), m.freq&&`CADA ${m.freq.toUpperCase()}`, m.duration&&`POR ${m.duration.toUpperCase()}`].filter(Boolean).join(" ")}
        </div>
        ${m.instructions?`<div style="font-size:11.5px;text-transform:uppercase;color:#1a1a1a">${m.instructions.toUpperCase()}</div>`:""}
      </div>`).join("");
    const body = `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:17px;font-weight:bold;letter-spacing:1px">RECETA MÉDICA ODONTOLÓGICA</div>
      </div>
      ${buildDocProfPat({name:professional?.name||"",rut:professional?.rut||""}, [
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT / Fecha nac.",value:`${patient.rut}${fmtBD?" / "+fmtBD:""}`},
        {label:"Fecha",value:today}
      ])}
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin:10px 0 8px;text-transform:uppercase;border-bottom:1px solid #2e75b6;padding-bottom:4px">Medicamentos Recetados</div>
      <div style="margin-bottom:16px">${medLines}</div>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">DIAGNÓSTICO / INDICACIÓN:</div>
        <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10px"></div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">OBSERVACIONES:</div>
        <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10px">${rxNotes||""}</div>
      </div>
      ${buildDocFooter("Firma y Timbre <u>Profesional</u>","Número de Registro / SIS")}`;
    openDocWindow("Receta Médica",body);
  }

  async function savePay() {
    const valid = payItems.filter(p => parseFloat(p.amount) > 0);
    if (!valid.length) return;
    setPaySaving(true);
    await Promise.all(valid.map(p =>
      fetch("/api/payments", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patientId:id, date:payForm.date, amount:parseFloat(p.amount),
          method:p.method, budgetId:payForm.budgetId||null, notes:payForm.notes||null,
          reference: payEvolutionId || null }) })
    ));
    setPayModal(false); setPayForm(initPayForm()); setPayItems(initPayItems());
    setPayEvolutionId(""); load(); setPaySaving(false);
  }

  function printCuidados() {
    if (!patient) return;
    const professional = users.find(u => u.id === cuidadosUserId);
    const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const lines = cuidadosText.split("\n").filter(l=>l.trim());
    const bulletHtml = lines.map(l=>`<div style="margin-bottom:5px;font-size:10.5px">${l}</div>`).join("");
    const body = `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 4px">
        <div style="font-size:16px;font-weight:bold;letter-spacing:1px">INDICACIONES POST-PROCEDIMIENTO</div>
        <div style="font-size:10px;font-style:italic;color:#c0392b;margin-top:3px">Léa detenidamente antes de retirarse de la clínica</div>
      </div>
      ${buildDocProfPat({name:professional?.name||"",showRut:false},[
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"Fecha",value:today},
        {label:"Procedimiento realizado",value:cuidadosTemplate}
      ])}
      <div style="font-size:11px;font-weight:bold;color:#1e6091;margin:10px 0 7px;text-transform:uppercase;letter-spacing:0.3px">Indicaciones Específicas:</div>
      <div style="background:#eaf4fb;border:1px solid #9fc5e8;border-radius:4px;padding:12px 14px;line-height:1.7">
        ${bulletHtml}
      </div>`;
    openDocWindow("Indicaciones",body);
  }

  function printBudgetDetail(db: Patient["budgets"][0]) {
    if (!patient) return;
    const baseTotal   = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity,0);
    const itemDisc    = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity*(it.discount||0)/100,0);
    const globalDisc  = db.discount||0;
    const totalDisc   = itemDisc+globalDisc;
    const totalFinal  = db.total;
    const rows = db.items.map((it,i)=>{
      const bruto = it.unitPrice*it.quantity;
      const desc  = bruto*(it.discount||0)/100;
      return `<tr style="background:${i%2===0?"#fff":"#dce6f1"}">
        <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10px">${it.description}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.tooth||""}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #bcd2e8;font-size:10px">${fmt(bruto)}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #bcd2e8;font-size:10px">${desc>0?fmt(desc):"-"}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #bcd2e8;font-size:10px;font-weight:${desc>0?"bold":"normal"}">${fmt(it.total)}</td>
      </tr>`;}).join("");
    const emptyRows = Array.from({length:Math.max(0,8-db.items.length)},(_,i)=>`
      <tr style="background:${(db.items.length+i)%2===0?"#fff":"#dce6f1"}"><td style="padding:5px 7px;border:1px solid #bcd2e8;height:22px"></td><td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td></tr>`).join("");
    const tdSummary = `padding:6px 7px;border:1px solid #bcd2e8;font-size:10.5px`;
    const body = `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:17px;font-weight:bold;letter-spacing:1px">PRESUPUESTO DENTAL</div>
        <div style="font-size:10px;font-style:italic;color:#555;margin-top:3px">Válido por 30 días desde la fecha de emisión</div>
      </div>
      ${buildDocProfPat({name:db.user.name},[
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT",value:patient.rut},
        {label:"Fecha",value:db.date}
      ])}
      <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
        <thead><tr style="background:#1f4e79;color:white">
          <th style="padding:6px 7px;text-align:left;border:1px solid #1f4e79;width:38%;font-size:10px">Tratamiento</th>
          <th style="padding:6px 7px;border:1px solid #1f4e79;width:12%;font-size:10px">Diente</th>
          <th style="padding:6px 7px;text-align:right;border:1px solid #1f4e79;width:18%;font-size:10px">Valor</th>
          <th style="padding:6px 7px;text-align:right;border:1px solid #1f4e79;width:16%;font-size:10px">Descuento</th>
          <th style="padding:6px 7px;text-align:right;border:1px solid #1f4e79;width:16%;font-size:10px">Valor Total</th>
        </tr></thead>
        <tbody>
          ${rows}${emptyRows}
          <tr style="background:#f0f6ff"><td colspan="4" style="${tdSummary};text-align:right;font-weight:bold">Valor total sin descuento</td><td style="${tdSummary};text-align:right;font-weight:bold">${fmt(baseTotal)}</td></tr>
          <tr style="background:#f0f6ff"><td colspan="4" style="${tdSummary};text-align:right;font-weight:bold;color:#c0392b">Valor total del descuento</td><td style="${tdSummary};text-align:right;font-weight:bold;color:#c0392b">- ${fmt(totalDisc)}</td></tr>
          <tr style="background:#1f4e79"><td colspan="4" style="${tdSummary};text-align:right;font-weight:bold;color:white;font-size:12px">TOTAL A PAGAR</td><td style="${tdSummary};text-align:right;font-weight:bold;color:white;font-size:12px">${fmt(totalFinal)}</td></tr>
        </tbody>
      </table>
      <div style="border:1px solid #bcd2e8;padding:10px 13px;background:#f0f6ff;border-radius:3px;font-size:9.5px;line-height:1.7">
        <div style="font-weight:bold;margin-bottom:4px;font-size:10.5px">Condiciones del Presupuesto</div>
        <div>• Este presupuesto tiene una validez de 30 días desde la fecha de emisión.</div>
        <div>• Algunos tratamientos están sujetos a diagnóstico definitivo; los costos pueden variar según hallazgos clínicos y/o radiográficos.</div>
        <div>• Los precios incluyen honorarios profesionales. Insumos especiales, exámenes o derivaciones no están incluidos salvo indicación.</div>
        <div>• Los tratamientos marcados con (*) requieren evaluación adicional antes de iniciar.</div>
      </div>
      ${buildDocFooter("Firma y Timbre <u>Profesional</u>","Firma del Paciente o Representante")}`;
    openDocWindow(`Presupuesto N°${String(db.number).padStart(4,"0")}`,body);
  }

  function openFicha() {
    setFichaForm({
      bloodType: patient?.clinicalRecord?.bloodType ?? "",
      allergies: patient?.clinicalRecord?.allergies ?? "",
      currentMedications: patient?.clinicalRecord?.currentMedications ?? "",
      medicalBackground: patient?.clinicalRecord?.medicalBackground ?? "",
      dentalBackground: patient?.clinicalRecord?.dentalBackground ?? "",
      habits: patient?.clinicalRecord?.habits ?? "",
      observations: patient?.clinicalRecord?.observations ?? "",
    });
    setFichaEdit(true);
  }

  async function saveFicha() {
    setFichaSaving(true);
    await fetch("/api/clinical-records", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ patientId: id, ...fichaForm }) });
    setFichaEdit(false); load(); setFichaSaving(false);
  }

  function openEditPatient() {
    if (!patient) return;
    setEditForm({ firstName:patient.firstName, lastName:patient.lastName, phone:patient.phone||"", email:patient.email||"", address:patient.address||"", city:patient.city||"", healthInsurance:patient.healthInsurance||"", birthDate:patient.birthDate?patient.birthDate.split("T")[0]:"", notes:patient.notes||"" });
    setEditPatient(true);
  }

  async function saveEditPatient() {
    setEditSaving(true);
    const r = await fetch(`/api/patients/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...editForm, birthDate: editForm.birthDate || null }) });
    setEditSaving(false);
    if (!r.ok) { showToast("❌ Error al guardar datos"); return; }
    setEditPatient(false); load(); showToast("✅ Datos actualizados");
  }

  async function deletePatientHard() {
    if (!patient) return;
    const ok1 = confirm(`¿Eliminar permanentemente a ${patient.firstName} ${patient.lastName}?\n\nEsto borrará historial clínico, evoluciones, presupuestos, pagos, citas y documentos.\n\nEsta acción es IRREVERSIBLE.`);
    if (!ok1) return;
    const typed = window.prompt('Escribe "ELIMINAR" para confirmar:');
    if (typed !== "ELIMINAR") { showToast("❌ Confirmación incorrecta"); return; }
    setDeletingPatient(true);
    const r = await fetch(`/api/patients/${id}?hard=true`, { method:"DELETE" });
    if (r.ok) { router.push("/pacientes"); } else { showToast("❌ Error al eliminar"); setDeletingPatient(false); }
  }

  async function deleteClinicalRecord() {
    if (!confirm("¿Eliminar la ficha clínica? Se borrarán todos los datos médicos del paciente.")) return;
    await fetch(`/api/clinical-records?patientId=${id}`, { method:"DELETE" });
    load(); showToast("✅ Ficha clínica eliminada");
  }

  async function updateItemStatus(itemId: string, status: string) {
    await fetch(`/api/budget-items/${itemId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });
    load();
  }

  async function saveOdontogram() {
    setOSaving(true);
    await fetch("/api/odontogram", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({patientId:id, data:odontogram}) });
    setOSaving(false);
  }

  async function saveFacial() {
    setOSaving(true);
    await fetch("/api/facial", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({patientId:id, data:facial}) });
    setOSaving(false);
  }

  async function uploadDoc(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("patientId", id); fd.append("type", docType); fd.append("name", file.name);
    await fetch("/api/documents", { method:"POST", body:fd });
    load(); setUploading(false);
  }

  async function deleteDoc(docId: string) {
    if (!confirm("¿Eliminar documento?")) return;
    await fetch(`/api/documents/${docId}`, { method:"DELETE" });
    load();
  }

  if (!patient) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const age = patient.birthDate ? Math.floor((Date.now()-new Date(patient.birthDate.split("T")[0]+"T12:00:00").getTime())/(1000*60*60*24*365.25)) : null;
  const paidTotal = patient.payments.reduce((s,p)=>s+p.amount,0);
  const budgetTotal = patient.budgets.filter(b=>b.status!=="rejected").reduce((s,b)=>s+b.total,0);
  const activeItemsTotal = patient.budgets.filter(b=>b.status!=="rejected").reduce((s,b)=>s+b.items.filter(i=>i.status!=="pending").reduce((is,i)=>is+i.total,0),0);
  const saldo = activeItemsTotal - paidTotal;
  const docIcons: Record<string,string> = { radiografia:"🦷", examen:"🧪", consentimiento:"📄", foto:"📷", other:"📎" };
  const selectedBudgetItems = evoBudgetId ? (patient.budgets.find(b=>b.id===evoBudgetId)?.items ?? []) : [];
  const hasAlerts = patient.clinicalRecord?.allergies || patient.clinicalRecord?.currentMedications;

  // Build unified timeline
  type TimelineItem = { date: string; time?: string; kind: "cita"|"evolucion"|"pago"|"presupuesto"; label: string; sub: string; badge?: string; amount?: number; color: string; icon: React.ReactNode };
  const timeline: TimelineItem[] = [
    ...patient.appointments.map(a => ({
      date: a.date, time: a.startTime, kind:"cita" as const,
      label: a.type, sub: `${a.startTime} · ${a.user.name}`,
      badge: a.status, color:"bg-primary-100 text-primary-700",
      icon: <Calendar size={14}/>,
    })),
    ...patient.evolutions.map(e => ({
      date: e.date, kind:"evolucion" as const,
      label: e.treatment, sub: `${e.user.name}${e.tooth ? ` · D.${e.tooth}` : ""}`,
      amount: e.cost, color:"bg-violet-100 text-violet-700",
      icon: <Activity size={14}/>,
    })),
    ...patient.payments.map(p => ({
      date: p.date, kind:"pago" as const,
      label: `Pago — ${p.method}`, sub: p.notes || (p.budget ? `Presup. #${p.budget.number}` : "Sin presupuesto"),
      amount: p.amount, color:"bg-emerald-100 text-emerald-700",
      icon: <TrendingUp size={14}/>,
    })),
    ...patient.budgets.map(b => ({
      date: b.date, kind:"presupuesto" as const,
      label: `Presupuesto #${b.number}`, sub: b.user.name,
      badge: b.status, amount: b.total, color:"bg-amber-100 text-amber-700",
      icon: <FileText size={14}/>,
    })),
  ].sort((a,b) => b.date.localeCompare(a.date) || (("time" in b ? b.time : "")??"").localeCompare(("time" in a ? a.time : "")??""));

  return (
    <div className="space-y-4 max-w-6xl">
      {toast && <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Back */}
      <button onClick={()=>router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 text-sm transition-colors">
        <ArrowLeft size={15}/> Volver a pacientes
      </button>

      {/* Patient header card */}
      <div className="card overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">{patient.firstName[0]}{patient.lastName[0]}</span>
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
                  <p className="text-slate-500 text-sm font-mono">{patient.rut}{age ? ` · ${age} años` : ""}{patient.gender ? ` · ${patient.gender === "M" ? "Masculino" : "Femenino"}` : ""}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>{
                    if (!patient) return;
                    // @ts-ignore
                    import("xlsx").then(XLSX => {
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ RUT:patient.rut, Nombre:`${patient.firstName} ${patient.lastName}`, Teléfono:patient.phone, Email:patient.email, Dirección:patient.address, Ciudad:patient.city, Previsión:patient.healthInsurance, "Fecha nac.":patient.birthDate?.split("T")[0]??"", Notas:patient.notes }]), "Datos");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patient.evolutions.map(e=>({ Fecha:e.date, Diagnóstico:e.diagnosis, Tratamiento:e.treatment, Diente:e.tooth, Observaciones:e.observations, Costo:e.cost, Profesional:e.user.name }))), "Evoluciones");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patient.budgets.map(b=>({ "N°":b.number, Fecha:b.date, Estado:b.status, Total:b.total, Abonado:b.payments.reduce((s,p)=>s+p.amount,0), Saldo:b.total-b.payments.reduce((s,p)=>s+p.amount,0) }))), "Presupuestos");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patient.payments.map(p=>({ Fecha:p.date, Monto:p.amount, Método:p.method, Notas:p.notes }))), "Pagos");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patient.appointments.map(a=>({ Fecha:a.date, Hora:a.startTime, Tipo:a.type, Estado:a.status, Profesional:a.user.name }))), "Citas");
                      XLSX.writeFile(wb, `Paciente_${patient.rut}_${new Date().toISOString().split("T")[0]}.xlsx`);
                    });
                  }} className="btn-secondary text-xs">
                    <Download size={13}/> Excel
                  </button>
                  <button onClick={openEditPatient} className="btn-secondary text-xs">
                    <Edit2 size={13}/> Editar
                  </button>
                  <button onClick={deletePatientHard} disabled={deletingPatient} className="btn-secondary text-xs text-red-600 hover:bg-red-50 border-red-200">
                    <Trash2 size={13}/> Eliminar
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {patient.phone && <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"><Phone size={13} className="text-slate-400"/>{patient.phone}</a>}
                {patient.email && <a href={`mailto:${patient.email}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"><Mail size={13} className="text-slate-400"/>{patient.email}</a>}
                {(patient.address||patient.city) && <span className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={13} className="text-slate-400"/>{[patient.address,patient.city].filter(Boolean).join(", ")}</span>}
                {patient.healthInsurance && <span className="flex items-center gap-1.5 text-sm text-slate-600"><Heart size={13} className="text-slate-400"/>{patient.healthInsurance}</span>}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-2 flex-shrink-0 w-full md:w-auto">
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                <p className="text-base font-bold text-slate-900">{patient.appointments.length}</p>
                <p className="text-xs text-slate-500">Citas</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                <p className="text-base font-bold text-slate-900">{patient.evolutions.length}</p>
                <p className="text-xs text-slate-500">Evoluc.</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-3 py-2 text-center">
                <p className="text-base font-bold text-emerald-700">{fmt(paidTotal)}</p>
                <p className="text-xs text-slate-500">Pagado</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center ${saldo > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className={`text-base font-bold ${saldo > 0 ? "text-red-600" : "text-emerald-700"}`}>{fmt(saldo)}</p>
                <p className="text-xs text-slate-500">Saldo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Medical alerts bar — always visible if data exists */}
        {hasAlerts && (
          <div className="border-t border-amber-100 bg-amber-50 px-5 py-2.5 flex flex-wrap gap-4">
            {patient.clinicalRecord?.allergies && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle size={13} className="text-amber-500"/>
                <span className="font-semibold">Alergias:</span> {patient.clinicalRecord.allergies}
              </span>
            )}
            {patient.clinicalRecord?.currentMedications && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <Pill size={13} className="text-amber-500"/>
                <span className="font-semibold">Medicamentos:</span> {patient.clinicalRecord.currentMedications}
              </span>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="border-t border-slate-100 px-5 py-2.5 flex gap-2 flex-wrap bg-slate-50/50">
          <button onClick={()=>setEvoModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">
            <Activity size={13}/> Nueva evolución
          </button>
          <button onClick={()=>setRxModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors">
            <Printer size={13}/> Receta médica
          </button>
          <button onClick={()=>setCuidadosModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">
            <BookOpen size={13}/> Instrucciones cuidados
          </button>
          <button onClick={()=>setPayModal(true)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
            <CreditCard size={13}/> Registrar pago
          </button>
          <button onClick={openBudgetCreate} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">
            <FileText size={13}/> Nuevo presupuesto
          </button>
          <a href={`/agenda?patientId=${id}&newAppt=1`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
            <CalendarPlus size={13}/> Nueva cita
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto -mb-1">
        <nav className="flex -mb-px min-w-max">
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===i ? "border-primary-600 text-primary-700 bg-primary-50/40" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"}`}>
              {t}
              {t==="Historial" && timeline.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab===i?"bg-primary-100 text-primary-700":"bg-slate-100 text-slate-500"}`}>{timeline.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ===== TAB 0: HISTORIAL (TIMELINE) ===== */}
      {tab===0&&(
        <div className="space-y-1">
          {timeline.length===0 ? (
            <div className="card py-12 text-center text-muted">Este paciente no tiene historial registrado aún.</div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-slate-100 hidden sm:block"/>
              <div className="space-y-2">
                {timeline.map((item,i)=>(
                  <div key={i} className="flex gap-4 group">
                    {/* Icon bubble */}
                    <div className={`w-[54px] flex-shrink-0 flex flex-col items-center pt-3 hidden sm:flex`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center z-10 ${item.color} border-2 border-white shadow-sm`}>
                        {item.icon}
                      </div>
                    </div>
                    {/* Card */}
                    <div className="flex-1 card p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`sm:hidden inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${item.color}`}>{item.icon}{item.kind}</span>
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.label}</p>
                            {item.badge && <Badge value={item.badge} className="ml-1"/>}
                          </div>
                          <p className="text-xs text-slate-500">{item.sub}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-medium text-slate-600">{new Date(item.date+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"short",year:"numeric"})}</p>
                          {item.amount != null && item.amount > 0 && (
                            <p className={`text-sm font-bold mt-0.5 ${item.kind==="pago"?"text-emerald-700":item.kind==="presupuesto"?"text-slate-700":"text-violet-700"}`}>
                              {fmt(item.amount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 1: FICHA CLÍNICA ===== */}
      {tab===1&&(
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Ficha Clínica</h3>
            {!fichaEdit && (
              <div className="flex gap-2">
                {patient.clinicalRecord && (
                  <button onClick={deleteClinicalRecord} className="btn-secondary text-xs text-red-600 hover:bg-red-50 border-red-200">
                    <Trash2 size={13}/> Eliminar ficha
                  </button>
                )}
                <button onClick={openFicha} className="btn-primary text-sm">
                  <Edit2 size={14}/> {patient.clinicalRecord ? "Editar" : "Crear ficha"}
                </button>
              </div>
            )}
          </div>

          {!fichaEdit ? (
            !patient.clinicalRecord ? (
              <div className="text-center py-10">
                <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto mb-3"/>
                <p className="text-muted mb-4">Este paciente no tiene ficha clínica registrada.</p>
                <button onClick={openFicha} className="btn-primary"><Plus size={15}/> Crear ficha clínica</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {patient.clinicalRecord.bloodType && (
                  <div className="md:col-span-2 flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <Heart className="text-red-500 w-5 h-5 flex-shrink-0"/>
                    <div><p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Grupo Sanguíneo</p><p className="text-sm font-bold text-red-800">{patient.clinicalRecord.bloodType}</p></div>
                  </div>
                )}
                {patient.clinicalRecord.allergies && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5"/>
                    <div><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Alergias</p><p className="text-sm text-amber-900">{patient.clinicalRecord.allergies}</p></div>
                  </div>
                )}
                {patient.clinicalRecord.currentMedications && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <Pill className="text-blue-500 w-5 h-5 flex-shrink-0 mt-0.5"/>
                    <div><p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Medicamentos</p><p className="text-sm text-blue-900">{patient.clinicalRecord.currentMedications}</p></div>
                  </div>
                )}
                {[
                  ["Antecedentes médicos", patient.clinicalRecord.medicalBackground],
                  ["Antecedentes dentales", patient.clinicalRecord.dentalBackground],
                  ["Hábitos", patient.clinicalRecord.habits],
                  ["Observaciones", patient.clinicalRecord.observations],
                ].map(([l,v])=> v ? (
                  <div key={l as string} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{l}</p>
                    <p className="text-sm text-slate-800">{v}</p>
                  </div>
                ) : null)}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Grupo sanguíneo</label>
                  <select className="select" value={fichaForm.bloodType} onChange={e=>setFichaForm(f=>({...f,bloodType:e.target.value}))}>
                    <option value="">No especificado</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Hábitos</label>
                  <input className="input" value={fichaForm.habits} onChange={e=>setFichaForm(f=>({...f,habits:e.target.value}))} placeholder="Tabaquismo, bruxismo..."/>
                </div>
              </div>
              {[
                ["allergies","Alergias","Penicilina, látex..."],
                ["currentMedications","Medicamentos actuales","Ej: Aspirina 100mg"],
                ["medicalBackground","Antecedentes médicos","Hipertensión, diabetes..."],
                ["dentalBackground","Antecedentes dentales","Extracciones previas, ortodoncia..."],
                ["observations","Observaciones","Notas adicionales..."],
              ].map(([key,label,ph])=>(
                <div key={key}>
                  <label className="label">{label}</label>
                  <textarea className="input resize-none" rows={2} placeholder={ph}
                    value={fichaForm[key as keyof typeof fichaForm]}
                    onChange={e=>setFichaForm(f=>({...f,[key]:e.target.value}))}/>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={saveFicha} disabled={fichaSaving} className="btn-primary">
                  <Save size={14}/> {fichaSaving?"Guardando...":"Guardar ficha"}
                </button>
                <button onClick={()=>setFichaEdit(false)} className="btn-secondary"><X size={14}/> Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 2: ODONTOGRAMA ===== */}
      {tab===2&&(
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Odontograma Dental</h3>
            <button onClick={saveOdontogram} disabled={oSaving} className="btn-primary text-xs">
              <Save size={13}/> {oSaving?"Guardando...":"Guardar"}
            </button>
          </div>
          <DentalChart data={odontogram} onChange={setOdontogram}/>
        </div>
      )}

      {/* ===== TAB 3: ESTÉTICA FACIAL ===== */}
      {tab===3&&(
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">Mapa Facial — Estética</h3>
              <p className="text-xs text-slate-400 mt-0.5">Haz clic en una zona para registrar tratamiento</p>
            </div>
            <button onClick={saveFacial} disabled={oSaving} className="btn-primary text-xs">
              <Save size={13}/> {oSaving?"Guardando...":"Guardar"}
            </button>
          </div>
          <FacialChart data={facial} onChange={setFacial}/>
        </div>
      )}

      {/* ===== TAB 4: EVOLUCIONES ===== */}
      {tab===4&&(
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted">{patient.evolutions.length} evoluciones registradas</p>
            <div className="flex gap-2">
              <button onClick={()=>{ setRxUserId(""); setRxItems([{drug:"",dose:"",freq:"",duration:"",route:"oral",instructions:""}]); setRxNotes(""); setRxModal(true); }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors">
                <Printer size={13}/> Receta médica
              </button>
              <button onClick={()=>setEvoModal(true)} className="btn-primary text-sm">
                <Plus size={14}/> Nueva Evolución
              </button>
            </div>
          </div>
          {patient.evolutions.length===0 ? (
            <div className="card py-12 text-center">
              <ClipboardList size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-muted">Sin evoluciones registradas</p>
              <button onClick={()=>setEvoModal(true)} className="btn-primary text-sm mt-4"><Plus size={14}/> Primera evolución</button>
            </div>
          ) : (
            <div className="space-y-2">
              {patient.evolutions.map((e,idx)=>(
                <div key={e.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{e.date}</span>
                      <span className="text-xs text-slate-500 font-medium">{e.user.name}</span>
                      {e.tooth && <span className="text-[11px] bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full font-medium">D.{e.tooth}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {e.cost > 0 && <p className="text-sm font-bold text-emerald-700">{fmt(e.cost)}</p>}
                      <button onClick={()=>deleteEvolution(e.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                  {e.diagnosis && (
                    <p className="text-sm text-slate-700 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1.5">Dx</span>
                      {e.diagnosis}
                    </p>
                  )}
                  <p className="text-sm text-slate-900 font-medium">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1.5">Tx</span>
                    {e.treatment}
                  </p>
                  {e.observations && (
                    <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 italic leading-relaxed">{e.observations}</p>
                  )}
                  {idx < patient.evolutions.length - 1 && (
                    <div className="absolute left-5 bottom-0 w-px h-2 bg-slate-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 5: PRESUPUESTOS ===== */}
      {tab===5&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <div className="bg-slate-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-slate-500">Presupuestado</p>
                <p className="text-sm font-bold text-slate-900">{fmt(budgetTotal)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-slate-500">Pagado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(paidTotal)}</p>
              </div>
              <div className={`rounded-xl px-4 py-2 text-center ${saldo>0?"bg-red-50":"bg-emerald-50"}`}>
                <p className="text-xs text-slate-500">Saldo</p>
                <p className={`text-sm font-bold ${saldo>0?"text-red-600":"text-emerald-700"}`}>{fmt(saldo)}</p>
              </div>
            </div>
            <button onClick={openBudgetCreate} className="btn-primary text-sm">
              <Plus size={15}/> Nuevo Presupuesto
            </button>
          </div>

          {patient.budgets.length===0 ? <div className="card py-12 text-center text-muted">Sin presupuestos</div> :
            patient.budgets.map(b=>{
              const bPaid = b.payments.reduce((s,p)=>s+p.amount,0);
              const bBalance = b.total - bPaid;
              return (
              <button key={b.id} onClick={()=>setBudgetDetailId(b.id)} className="card overflow-hidden w-full text-left hover:border-primary-200 transition-colors cursor-pointer">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">Presupuesto #{String(b.number).padStart(4,"0")}</p>
                    <p className="text-xs text-slate-500">{b.date} · {b.user.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge value={b.status}/>
                    <p className="text-base font-bold text-slate-900">{fmt(b.total)}</p>
                    {bBalance > 0 && <span className="text-xs text-red-600 font-medium">Saldo: {fmt(bBalance)}</span>}
                    <ChevronRight size={15} className="text-slate-400"/>
                  </div>
                </div>
                <div className="px-5 py-2.5 bg-slate-50/80 flex justify-between items-center text-xs text-slate-500">
                  <span>{b.items.length} ítem{b.items.length!==1?"s":""}</span>
                  <span>Abonado: <span className="font-semibold text-emerald-700">{fmt(bPaid)}</span></span>
                </div>
              </button>
            )})}
        </div>
      )}

      {/* ===== TAB 6: PAGOS ===== */}
      {tab===6&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <div className="bg-emerald-50 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-slate-500">Total pagado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(paidTotal)}</p>
              </div>
              <div className={`rounded-xl px-4 py-2 text-center ${saldo>0?"bg-red-50":"bg-emerald-50"}`}>
                <p className="text-xs text-slate-500">Saldo deudor</p>
                <p className={`text-sm font-bold ${saldo>0?"text-red-600":"text-emerald-700"}`}>{fmt(saldo)}</p>
              </div>
            </div>
            <button onClick={()=>setPayModal(true)} className="btn-primary text-sm">
              <CreditCard size={15}/> Registrar Pago
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100"><tr>
                <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Método</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Vinculado a</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden lg:table-cell">Notas</th>
                <th className="w-16"/>
              </tr></thead>
              <tbody>
                {patient.payments.length===0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">Sin pagos registrados</td></tr>
                ) : patient.payments.map(p=>{
                  const linkedEvo = p.reference ? patient.evolutions.find(e=>e.id===p.reference) : null;
                  return (
                  <tr key={p.id} className="table-row">
                    <td className="px-5 py-3 text-slate-600 text-xs">{p.date}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{METHOD_ICON[p.method]??""} {p.method}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                      {p.budget ? <span className="font-medium text-amber-700">Presup. #{p.budget.number}</span>
                        : linkedEvo ? <span className="text-violet-700">↳ {linkedEvo.treatment}{linkedEvo.tooth?` D.${linkedEvo.tooth}`:""}</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{p.notes||"—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={()=>openPayEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Pencil size={12}/></button>
                        <button onClick={()=>deletePayment(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              {patient.payments.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold text-slate-600">Total abonado</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-700 hidden lg:table-cell text-right">{fmt(paidTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB 7: DOCUMENTOS ===== */}
      {tab===7&&(
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <select className="select w-auto text-sm" value={docType} onChange={e=>setDocType(e.target.value)}>
              <option value="radiografia">Radiografía</option>
              <option value="examen">Examen</option>
              <option value="consentimiento">Consentimiento informado</option>
              <option value="foto">Fotografía</option>
              <option value="other">Otro</option>
            </select>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx"
              onChange={e=>{ if(e.target.files?.[0]) uploadDoc(e.target.files[0]); }}/>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="btn-primary text-sm">
              <Upload size={15}/> {uploading?"Subiendo...":"Subir documento"}
            </button>
          </div>
          {patient.documents.length===0 ? (
            <div className="card py-10 text-center text-muted">Sin documentos adjuntos</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {patient.documents.map(doc=>(
                <div key={doc.id} className="card p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
                  <span className="text-2xl">{docIcons[doc.type]??docIcons.other}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{doc.type} · {doc.size ? `${Math.round(doc.size/1024)} KB` : ""}</p>
                    <p className="text-xs text-slate-400">{new Date(doc.createdAt).toLocaleDateString("es-CL")}</p>
                  </div>
                  <div className="flex gap-1">
                    <a href={doc.fileName} target="_blank" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><ExternalLink size={13}/></a>
                    <button onClick={()=>deleteDoc(doc.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 8: DATOS ===== */}
      {tab===8&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["Datos Personales",[["RUT",patient.rut],["Nombre",`${patient.firstName} ${patient.lastName}`],["Género",patient.gender==="M"?"Masculino":"Femenino"],["Fecha nac.",patient.birthDate?new Date(patient.birthDate.split("T")[0]+"T12:00:00").toLocaleDateString("es-CL"):"—"],["Edad",age?`${age} años`:"—"]]],
            ["Contacto",[["Teléfono",patient.phone||"—"],["Email",patient.email||"—"],["Dirección",patient.address||"—"],["Ciudad",patient.city||"—"]]],
            ["Previsión",[["Previsión de salud",patient.healthInsurance||"—"]]],
            ["Notas",[[null,patient.notes||"Sin observaciones"]]],
          ].map(([title,rows])=>(
            <div key={title as string} className="card p-5">
              <h3 className="section-title mb-3">{title as string}</h3>
              <dl className="space-y-2.5">
                {(rows as [string|null,string][]).map(([k,v],i)=>(
                  <div key={i} className={k?"flex justify-between gap-4":""}>
                    {k&&<dt className="text-sm text-slate-500">{k}</dt>}
                    <dd className={`text-sm font-medium text-slate-800 ${k?"text-right":""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* ===== TAB 9: CITAS ===== */}
      {tab===9&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{patient.appointments.length} citas registradas</p>
            <a href={`/agenda?patientId=${id}&newAppt=1`} className="btn-primary text-sm">
              <CalendarPlus size={15}/> Nueva Cita
            </a>
          </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Hora</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Profesional</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
            </tr></thead>
            <tbody>
              {patient.appointments.length===0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Sin citas registradas</td></tr>
              ) : patient.appointments.map(a=>(
                <tr key={a.id} className="table-row">
                  <td className="px-5 py-3 text-slate-700">{a.date}</td>
                  <td className="px-4 py-3 text-slate-600">{a.startTime}</td>
                  <td className="px-4 py-3 text-slate-700">{a.type}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{a.user.name}</td>
                  <td className="px-4 py-3"><Badge value={a.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* ===== MODAL EVOLUCIÓN ===== */}
      <Modal open={evoModal} onClose={()=>setEvoModal(false)} title="Nueva Evolución">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Fecha</label><input className="input" type="date" value={evoForm.date} onChange={e=>setEvoForm(f=>({...f,date:e.target.value}))}/></div>
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={evoForm.userId} onChange={e=>setEvoForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {patient.budgets.filter(b=>b.status!=="rejected").length>0&&(
            <div className="bg-primary-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Vincular a presupuesto (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Presupuesto</label>
                  <select className="select" value={evoBudgetId} onChange={e=>{ setEvoBudgetId(e.target.value); setEvoBudgetItemId(""); }}>
                    <option value="">Seleccionar...</option>
                    {patient.budgets.filter(b=>b.status!=="rejected").map(b=>(
                      <option key={b.id} value={b.id}>#{b.number} — {fmt(b.total)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Ítem</label>
                  <select className="select" value={evoBudgetItemId} disabled={!evoBudgetId}
                    onChange={e=>{
                      setEvoBudgetItemId(e.target.value);
                      const item = selectedBudgetItems.find(i=>i.id===e.target.value);
                      if(item) setEvoItems(its=>[{ ...its[0], treatment:item.description, tooth:item.tooth||"", cost:String(item.unitPrice) }, ...its.slice(1)]);
                    }}>
                    <option value="">Seleccionar ítem...</option>
                    {selectedBudgetItems.map(item=>(
                      <option key={item.id} value={item.id}>{item.description}{item.tooth?` (D.${item.tooth})`:""}</option>
                    ))}
                  </select>
                </div>
              </div>
              {evoBudgetItemId&&(
                <div>
                  <label className="label">Marcar ítem como</label>
                  <select className="select" value={evoItemStatus} onChange={e=>setEvoItemStatus(e.target.value)}>
                    <option value="in_progress">En progreso</option>
                    <option value="completed">Completado</option>
                  </select>
                </div>
              )}
            </div>
          )}
          <div><label className="label">Diagnóstico</label><input className="input" value={evoForm.diagnosis} onChange={e=>setEvoForm(f=>({...f,diagnosis:e.target.value}))}/></div>

          {/* Tratamientos — multiple */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Tratamientos realizados *</label>
              <button onClick={()=>setEvoItems(i=>[...i,{treatment:"",tooth:"",cost:""}])}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus size={12}/> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {evoItems.map((item,i)=>(
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-xl p-3">
                  <div className="col-span-5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Tratamiento *</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.treatment}
                      onChange={e=>setEvoItems(its=>its.map((x,j)=>j===i?{...x,treatment:e.target.value}:x))}
                      placeholder="Restauración, limpieza..." />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Diente(s)</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.tooth}
                      onChange={e=>setEvoItems(its=>its.map((x,j)=>j===i?{...x,tooth:e.target.value}:x))}
                      placeholder="16, 17..." />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Costo ($)</label>
                    <input className="input mt-0.5 text-sm py-1.5" type="number" value={item.cost}
                      onChange={e=>setEvoItems(its=>its.map((x,j)=>j===i?{...x,cost:e.target.value}:x))}
                      placeholder="0" />
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    {evoItems.length > 1 && (
                      <button onClick={()=>setEvoItems(its=>its.filter((_,j)=>j!==i))}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                        <X size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div><label className="label">Observaciones</label><textarea className="input resize-none" rows={2} value={evoForm.observations} onChange={e=>setEvoForm(f=>({...f,observations:e.target.value}))}/></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">{evoItems.filter(i=>i.treatment.trim()).length} tratamiento(s) · Total: {fmt(evoItems.reduce((s,i)=>s+parseFloat(i.cost||"0"),0))}</p>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={()=>setEvoModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveEvo} disabled={saving||!evoItems.some(i=>i.treatment.trim())||!evoForm.userId}>
              {saving?"Guardando...":"Guardar evolución"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL RECETA MÉDICA ===== */}
      <Modal open={rxModal} onClose={()=>setRxModal(false)} title="Receta Médica" size="lg">
        <div className="p-6 space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Paciente</p>
              <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-slate-400 font-mono">{patient.rut}</p>
            </div>
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={rxUserId} onChange={e=>setRxUserId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Template selector */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3">
            <label className="text-xs font-semibold text-violet-700 uppercase tracking-wide whitespace-nowrap">Plantilla</label>
            <select className="select flex-1 text-sm" value={rxTemplate}
              onChange={e=>{
                const tpl = e.target.value;
                setRxTemplate(tpl);
                if(tpl && activeRxTemplates[tpl]) setRxItems(activeRxTemplates[tpl].map(m=>({...m})));
              }}>
              <option value="">— Sin plantilla —</option>
              {Object.keys(activeRxTemplates).map(k=><option key={k}>{k}</option>)}
            </select>
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Medicamentos</label>
              <button onClick={()=>setRxItems(i=>[...i,{drug:"",dose:"",freq:"",duration:"",route:"oral",instructions:""}])}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus size={12}/> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {rxItems.map((item,i)=>(
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-xl p-3">
                  <div className="col-span-4">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Fármaco *</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.drug}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,drug:e.target.value}:x))}
                      placeholder="Amoxicilina 500mg" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Dosis</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.dose}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,dose:e.target.value}:x))}
                      placeholder="1 comprimido" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Frecuencia</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.freq}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,freq:e.target.value}:x))}
                      placeholder="c/8h" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Duración</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.duration}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,duration:e.target.value}:x))}
                      placeholder="7 días" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Vía</label>
                    <select className="input mt-0.5 text-xs py-1.5 pr-1" value={item.route}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,route:e.target.value}:x))}>
                      <option value="oral">Oral</option>
                      <option value="topica">Tópica</option>
                      <option value="inyectable">Inyect.</option>
                      <option value="sublingual">Sublg.</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    {rxItems.length > 1 && (
                      <button onClick={()=>setRxItems(its=>its.filter((_,j)=>j!==i))}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                  <div className="col-span-11">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Instrucciones adicionales</label>
                    <input className="input mt-0.5 text-sm py-1.5" value={item.instructions}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,instructions:e.target.value}:x))}
                      placeholder="Tomar con alimentos, no mezclar con alcohol..." />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General notes */}
          <div>
            <label className="label">Indicaciones generales</label>
            <textarea className="input resize-none text-sm" rows={2} value={rxNotes}
              onChange={e=>setRxNotes(e.target.value)}
              placeholder="Reposo relativo, dieta blanda, control en 7 días..." />
          </div>

          {/* Allergy warning */}
          {patient.clinicalRecord?.allergies && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
              <p className="text-amber-800"><span className="font-semibold">Alergias registradas:</span> {patient.clinicalRecord.allergies}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-wrap">
          <button className="btn-secondary" onClick={()=>setRxModal(false)}>Cancelar</button>
          {patient.phone && (
            <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              onClick={()=>{
                const meds = rxItems.filter(m=>m.drug.trim()).map((m,i)=>`${i+1}. *${m.drug}*${m.dose?` — ${m.dose}`:""}\n   ${[m.freq,m.duration,m.instructions].filter(Boolean).join(" · ")}`).join("\n");
                const msg = `*RECETA MÉDICA*\n_${new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"})}_\n\nPaciente: *${patient.firstName} ${patient.lastName}*\n\n${meds}${rxNotes?`\n\nIndicaciones: ${rxNotes}`:""}`;
                const clean = patient.phone.replace(/\D/g,""); const num = clean.startsWith("56")?clean:`56${clean}`;
                window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,"_blank");
              }}
              disabled={!rxUserId||rxItems.every(m=>!m.drug.trim())}>
              <MessageCircle size={15}/> WhatsApp
            </button>
          )}
          <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            onClick={sendRxEmail}
            disabled={rxEmailSending||!rxUserId||rxItems.every(m=>!m.drug.trim())||!patient.email}
            title={!patient.email?"El paciente no tiene email":undefined}>
            <Mail size={15}/> {rxEmailSending?"Enviando...":"Email"}
          </button>
          <button className="flex items-center gap-2 btn-primary" onClick={printRx}
            disabled={!rxUserId || rxItems.every(m=>!m.drug.trim())}>
            <Printer size={15}/> Imprimir Receta
          </button>
        </div>
      </Modal>

      {/* ===== MODAL PAGO ===== */}
      <Modal open={payModal} onClose={()=>setPayModal(false)} title="Registrar Pago">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Fecha</label><input className="input" type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))}/></div>
            <div>
              <label className="label">Presupuesto asociado</label>
              <select className="select" value={payForm.budgetId} onChange={e=>{setPayForm(f=>({...f,budgetId:e.target.value}));if(e.target.value)setPayEvolutionId("");}}>
                <option value="">Sin presupuesto</option>
                {patient.budgets.filter(b=>b.status!=="rejected").map(b=>(
                  <option key={b.id} value={b.id}>#{b.number} — {fmt(b.total)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Evolution auto-link — shown when no budget selected */}
          {!payForm.budgetId && patient.evolutions.length > 0 && (
            <div>
              <label className="label">Vincular a evolución (opcional)</label>
              <select className="select" value={payEvolutionId} onChange={e=>setPayEvolutionId(e.target.value)}>
                <option value="">Sin evolución específica</option>
                {patient.evolutions
                  .filter(e => !patient.payments.some(p => p.reference === e.id))
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {new Date(e.date+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"})} — {e.treatment}{e.tooth?` D.${e.tooth}`:""} ({fmt(e.cost)})
                    </option>
                  ))}
              </select>
              {payEvolutionId && (() => {
                const ev = patient.evolutions.find(e => e.id === payEvolutionId);
                if (!ev) return null;
                const remaining = ev.cost - patient.payments.filter(p=>p.reference===ev.id).reduce((s,p)=>s+p.amount,0);
                return (
                  <div className="mt-2 p-2.5 bg-violet-50 rounded-lg text-xs text-violet-700 flex items-center justify-between">
                    <span><strong>{ev.treatment}</strong>{ev.tooth ? ` · D.${ev.tooth}` : ""}</span>
                    <span className="font-semibold">Costo: {fmt(ev.cost)}</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Payment methods — split support */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Medios de pago</label>
              <button onClick={()=>setPayItems(i=>[...i,{method:"transferencia",amount:""}])}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus size={12}/> Agregar medio
              </button>
            </div>
            <div className="space-y-2">
              {payItems.map((item,i)=>(
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-xl p-3">
                  <div className="col-span-6">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Método</label>
                    <select className="select mt-0.5 text-sm" value={item.method}
                      onChange={e=>setPayItems(its=>its.map((x,j)=>j===i?{...x,method:e.target.value}:x))}>
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="debito">💳 Débito</option>
                      <option value="credito">💳 Crédito</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="cheque">📄 Cheque</option>
                    </select>
                  </div>
                  <div className="col-span-5">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Monto ($)</label>
                    <input className="input mt-0.5 text-sm py-1.5" type="number" min="0" placeholder="0"
                      value={item.amount}
                      onChange={e=>setPayItems(its=>its.map((x,j)=>j===i?{...x,amount:e.target.value}:x))} />
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    {payItems.length > 1 && (
                      <button onClick={()=>setPayItems(its=>its.filter((_,j)=>j!==i))}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <X size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {payItems.length > 1 && (
              <div className="flex justify-end mt-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  Total: {fmt(payItems.reduce((s,p)=>s+parseFloat(p.amount||"0"),0))}
                </span>
              </div>
            )}
          </div>

          <div><label className="label">Notas</label><input className="input" placeholder="Ej: Abono primera sesión" value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}/></div>
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-slate-500"><span>Total presupuestado</span><span>{fmt(budgetTotal)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Ya pagado</span><span>{fmt(paidTotal)}</span></div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-1.5">
              <span className="text-slate-700">Saldo actual</span>
              <span className={saldo>0?"text-red-600":"text-emerald-700"}>{fmt(saldo)}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setPayModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={savePay} disabled={paySaving||!payItems.some(p=>parseFloat(p.amount)>0)}>
            {paySaving?"Guardando...":"Registrar Pago"}
          </button>
        </div>
      </Modal>

      {/* ===== MODAL INSTRUCCIONES DE CUIDADOS ===== */}
      <Modal open={cuidadosModal} onClose={()=>setCuidadosModal(false)} title="Instrucciones de Cuidados" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Paciente</p>
              <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-slate-400 font-mono">{patient.rut}</p>
            </div>
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={cuidadosUserId} onChange={e=>setCuidadosUserId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex items-center gap-3">
            <label className="text-xs font-semibold text-teal-700 uppercase tracking-wide whitespace-nowrap">Plantilla</label>
            <select className="select flex-1 text-sm" value={cuidadosTemplate}
              onChange={e=>{
                setCuidadosTemplate(e.target.value);
                setCuidadosText(activeCareTemplates[e.target.value] ?? "");
              }}>
              {Object.keys(activeCareTemplates).map(k=><option key={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Instrucciones (editable)</label>
            <textarea className="input resize-none font-mono text-sm leading-relaxed" rows={10}
              value={cuidadosText} onChange={e=>setCuidadosText(e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-wrap">
          <button className="btn-secondary" onClick={()=>setCuidadosModal(false)}>Cerrar</button>
          {patient.phone && (
            <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              onClick={()=>{
                const msg = `*INSTRUCCIONES DE CUIDADOS — ${cuidadosTemplate.toUpperCase()}*\n\nPaciente: *${patient.firstName} ${patient.lastName}*\n\n${cuidadosText}`;
                const clean = patient.phone.replace(/\D/g,""); const num = clean.startsWith("56")?clean:`56${clean}`;
                window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,"_blank");
              }}>
              <MessageCircle size={15}/> WhatsApp
            </button>
          )}
          <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            onClick={sendCareEmail}
            disabled={careEmailSending||!cuidadosText.trim()||!patient.email}
            title={!patient.email?"El paciente no tiene email":undefined}>
            <Mail size={15}/> {careEmailSending?"Enviando...":"Email"}
          </button>
          <button className="flex items-center gap-2 btn-primary" onClick={printCuidados} disabled={!cuidadosUserId}>
            <Printer size={15}/> Imprimir instrucciones
          </button>
        </div>
      </Modal>

      {/* ===== MODAL EDITAR PACIENTE ===== */}
      <Modal open={editPatient} onClose={()=>setEditPatient(false)} title="Editar Datos del Paciente" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nombre</label><input className="input" value={editForm.firstName} onChange={e=>setEditForm(f=>({...f,firstName:e.target.value}))}/></div>
            <div><label className="label">Apellido</label><input className="input" value={editForm.lastName} onChange={e=>setEditForm(f=>({...f,lastName:e.target.value}))}/></div>
            <div><label className="label">Fecha de nacimiento</label><input className="input" type="date" value={editForm.birthDate} onChange={e=>setEditForm(f=>({...f,birthDate:e.target.value}))}/></div>
            <div><label className="label">Teléfono</label><input className="input" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))}/></div>
            <div><label className="label">Email</label><input className="input" type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></div>
            <div><label className="label">Dirección</label><input className="input" value={editForm.address} onChange={e=>setEditForm(f=>({...f,address:e.target.value}))}/></div>
            <div><label className="label">Ciudad</label><input className="input" value={editForm.city} onChange={e=>setEditForm(f=>({...f,city:e.target.value}))}/></div>
            <div className="col-span-2">
              <label className="label">Previsión de salud</label>
              <select className="select" value={editForm.healthInsurance} onChange={e=>setEditForm(f=>({...f,healthInsurance:e.target.value}))}>
                <option>FONASA</option>
                <option>ISAPRE Cruz Blanca</option>
                <option>ISAPRE Banmédica</option>
                <option>ISAPRE Colmena</option>
                <option>ISAPRE Consalud</option>
                <option>Particular</option>
              </select>
            </div>
            <div className="col-span-2"><label className="label">Notas</label><textarea className="input resize-none" rows={2} value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setEditPatient(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveEditPatient} disabled={editSaving}>
            <Save size={14}/> {editSaving?"Guardando...":"Guardar cambios"}
          </button>
        </div>
      </Modal>

      {/* ===== MODAL DETALLE PRESUPUESTO ===== */}
      {patient && (() => {
        const db = budgetDetailId ? patient.budgets.find(b => b.id === budgetDetailId) : null;
        if (!db) return null;
        const dbPaid = db.payments.reduce((s,p)=>s+p.amount,0);
        const dbBalance = db.total - dbPaid;
        const dbPct = db.total > 0 ? Math.round((dbPaid/db.total)*100) : 0;
        return (
          <Modal open={!!budgetDetailId} onClose={()=>setBudgetDetailId(null)} title={`Presupuesto #${String(db.number).padStart(4,"0")}`} size="xl">
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Status + actions */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge value={db.status}/>
                <div className="flex gap-2 flex-wrap">
                  {db.status==="pending" && (<>
                    <button onClick={()=>changeBudgetStatus(db.id,"approved")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium"><CheckCircle size={13}/> Aprobar</button>
                    <button onClick={()=>changeBudgetStatus(db.id,"rejected")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"><XCircle size={13}/> Rechazar</button>
                  </>)}
                  {db.status==="rejected" && <button onClick={()=>changeBudgetStatus(db.id,"pending")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"><Clock size={13}/> Reabrir</button>}
                  <button onClick={()=>printBudgetDetail(db)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"><Printer size={13}/> PDF</button>
                  <button onClick={()=>sendBudgetEmail(db.id)} disabled={emailSending===db.id||!patient.email} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium disabled:opacity-40"><Mail size={13}/> {emailSending===db.id?"...":"Email"}</button>
                  <button onClick={()=>sendBudgetWA(db)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"><MessageCircle size={13}/> WhatsApp</button>
                  <button onClick={()=>openBudgetEdit(db)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"><Pencil size={13}/> Editar</button>
                  <button onClick={()=>deleteBudget(db.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"><Trash2 size={13}/> Eliminar</button>
                </div>
              </div>
              {/* Patient + professional */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Paciente</p>
                  <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                  <p className="text-xs text-slate-400 font-mono">{patient.rut}</p>
                  {patient.phone && <p className="text-xs text-slate-500 mt-0.5">{patient.phone}</p>}
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-1">Profesional</p>
                  <p className="font-semibold text-slate-900">{db.user.name}</p>
                  <p className="text-xs text-slate-400 mt-1">Fecha: {db.date}</p>
                  {db.validUntil && <p className="text-xs text-slate-400">Válido hasta: {db.validUntil}</p>}
                </div>
              </div>
              {/* Items table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr>
                    <th className="text-left px-4 py-2.5 text-xs text-slate-500">Tratamiento</th>
                    <th className="text-center px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">Diente/Área</th>
                    <th className="text-center px-3 py-2.5 text-xs text-slate-500">Cant.</th>
                    <th className="text-right px-3 py-2.5 text-xs text-slate-500 hidden sm:table-cell">P. Unit.</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total</th>
                  </tr></thead>
                  <tbody>{db.items.map(item=>(
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 hidden sm:table-cell">{item.tooth||item.area||"—"}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 hidden sm:table-cell">{fmt(item.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt(item.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {/* Totals */}
              <div className="flex justify-end">
                <div className="min-w-52 space-y-2">
                  <div className="flex justify-between text-sm gap-8"><span className="text-slate-500">Subtotal</span><span>{fmt(db.subtotal??db.total)}</span></div>
                  {db.discount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Descuento</span><span className="text-red-600">-{fmt(db.discount)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2"><span>Total</span><span>{fmt(db.total)}</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{width:`${dbPct}%`}}/></div>
                  <div className="flex justify-between text-sm text-emerald-700 font-medium"><span>Abonado ({dbPct}%)</span><span>{fmt(dbPaid)}</span></div>
                  <div className={`flex justify-between text-sm font-bold ${dbBalance>0?"text-red-600":"text-emerald-600"}`}><span>Saldo</span><span>{dbBalance>0?fmt(dbBalance):"Pagado ✓"}</span></div>
                </div>
              </div>
              {/* Payment history */}
              {db.payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Historial de abonos</p>
                  <div className="space-y-1.5">
                    {db.payments.map(p=>(
                      <div key={p.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{METHOD_ICON[p.method]??"💰"}</span>
                          <div><p className="text-sm font-medium text-slate-800">{fmt(p.amount)}</p><p className="text-xs text-slate-400">{p.date} · <span className="capitalize">{p.method}</span>{p.notes&&<span> · {p.notes}</span>}</p></div>
                        </div>
                        <span className="text-emerald-600 font-bold text-sm">+{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Register payment inline */}
              {dbBalance > 0 && (
                <div className="border border-primary-200 bg-primary-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-3">Registrar abono</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><label className="label text-xs">Fecha</label><input className="input py-1.5 text-sm" type="date" value={budgetPayForm.date} onChange={e=>setBudgetPayForm(f=>({...f,date:e.target.value}))}/></div>
                    <div><label className="label text-xs">Método</label>
                      <select className="select py-1.5 text-sm" value={budgetPayForm.method} onChange={e=>setBudgetPayForm(f=>({...f,method:e.target.value}))}>
                        <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div><label className="label text-xs">Monto ($)</label><input className="input py-1.5 text-sm" type="number" min="0" placeholder={fmt(dbBalance)} value={budgetPayForm.amount} onChange={e=>setBudgetPayForm(f=>({...f,amount:e.target.value}))}/></div>
                    <div><label className="label text-xs">Notas</label><input className="input py-1.5 text-sm" value={budgetPayForm.notes} onChange={e=>setBudgetPayForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional"/></div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button onClick={registerBudgetPayment} disabled={budgetPaySaving||!budgetPayForm.amount} className="btn-primary text-sm py-1.5 px-4">
                      {budgetPaySaving?"Guardando...":"Registrar abono"}
                    </button>
                  </div>
                </div>
              )}
              {db.notes && <p className="text-sm text-slate-500 italic border-t border-slate-100 pt-3"><strong className="text-slate-600">Obs:</strong> {db.notes}</p>}
            </div>
          </Modal>
        );
      })()}

      {/* ===== MODAL CREAR/EDITAR PRESUPUESTO ===== */}
      {(() => {
        const bSubtotal = budgetItems.reduce((s,i)=>s+i.total,0);
        const bTotal = bSubtotal - Number(budgetForm.discount);
        return (
          <Modal open={budgetCreateOpen} onClose={()=>setBudgetCreateOpen(false)} title={budgetEditId?"Editar Presupuesto":"Nuevo Presupuesto"} size="xl">
            <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Profesional *</label>
                  <select className="select" value={budgetForm.userId} onChange={e=>setBudgetForm(f=>({...f,userId:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Estado</label>
                  <select className="select" value={budgetForm.status} onChange={e=>setBudgetForm(f=>({...f,status:e.target.value}))}>
                    <option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option>
                  </select>
                </div>
                <div><label className="label">Fecha</label><input className="input" type="date" value={budgetForm.date} onChange={e=>setBudgetForm(f=>({...f,date:e.target.value}))}/></div>
                <div><label className="label">Válido hasta</label><input className="input" type="date" value={budgetForm.validUntil} onChange={e=>setBudgetForm(f=>({...f,validUntil:e.target.value}))}/></div>
              </div>
              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Tratamientos</label>
                  <button onClick={()=>setBudgetItems(its=>[...its,{description:"",tooth:"",area:"",quantity:1,unitPrice:0,discount:0,total:0}])} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12}/> Agregar ítem</button>
                </div>
                <div className="space-y-2">
                  {budgetItems.map((item,i)=>(
                    <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-xl p-3">
                      <div className="col-span-5 relative">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Tratamiento *</label>
                        <input className="input mt-0.5 text-sm py-1.5" value={item.description}
                          onChange={e=>updateBudgetItem(i,"description",e.target.value)}
                          onFocus={()=>setBudgetDropIdx(i)}
                          onBlur={()=>setTimeout(()=>setBudgetDropIdx(null),160)}
                          placeholder="Escribir o buscar..." autoComplete="off"/>
                        {budgetDropIdx===i&&(()=>{
                          const opts=treatments.filter(t=>!item.description.trim()||t.name.toLowerCase().includes(item.description.toLowerCase()));
                          if(!opts.length)return null;
                          return(
                            <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                              {opts.map(t=>(
                                <button key={t.id} type="button"
                                  onMouseDown={()=>{
                                    setBudgetItems(its=>its.map((it2,idx)=>idx!==i?it2:{...it2,description:t.name,unitPrice:t.price,total:it2.quantity*t.price*(1-((it2.discount||0)/100))}));
                                    setBudgetDropIdx(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center justify-between gap-2 border-b border-slate-50 last:border-b-0 transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-slate-800">{t.name}</span>
                                    {t.category&&<span className="ml-2 text-xs text-slate-400">{t.category}</span>}
                                  </div>
                                  <span className="text-xs text-primary-600 font-semibold flex-shrink-0">{fmt(t.price)}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Diente</label>
                        <input className="input mt-0.5 text-sm py-1.5" value={item.tooth} onChange={e=>updateBudgetItem(i,"tooth",e.target.value)} placeholder="18,19..."/>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wide">P. Unit.</label>
                        <input className="input mt-0.5 text-sm py-1.5" type="number" min="0" value={item.unitPrice}
                          onChange={e=>updateBudgetItem(i,"unitPrice",parseFloat(e.target.value)||0)}/>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Total</label>
                        <input className="input mt-0.5 text-sm py-1.5 bg-slate-100" value={fmt(item.total)} readOnly/>
                      </div>
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        {budgetItems.length > 1 && <button onClick={()=>setBudgetItems(its=>its.filter((_,j)=>j!==i))} className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Descuento global ($)</label><input className="input" type="number" min="0" value={budgetForm.discount} onChange={e=>setBudgetForm(f=>({...f,discount:parseFloat(e.target.value)||0}))}/></div>
                <div className="flex flex-col justify-end bg-slate-50 rounded-xl p-3 text-right">
                  <p className="text-xs text-slate-500">Subtotal: {fmt(bSubtotal)}</p>
                  {Number(budgetForm.discount)>0 && <p className="text-xs text-red-500">Descuento: -{fmt(Number(budgetForm.discount))}</p>}
                  <p className="text-lg font-bold text-slate-900">Total: {fmt(bTotal)}</p>
                </div>
              </div>
              <div><label className="label">Notas / Observaciones</label><textarea className="input resize-none" rows={2} value={budgetForm.notes} onChange={e=>setBudgetForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={()=>setBudgetCreateOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveBudget} disabled={budgetSaving||!budgetForm.userId||budgetItems.every(i=>!i.description.trim())}>
                {budgetSaving?"Guardando...":(budgetEditId?"Guardar cambios":"Crear Presupuesto")}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ===== MODAL EDITAR PAGO ===== */}
      <Modal open={!!payEditId} onClose={()=>setPayEditId(null)} title="Editar Pago">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Fecha</label><input className="input" type="date" value={payEditForm.date} onChange={e=>setPayEditForm(f=>({...f,date:e.target.value}))}/></div>
            <div><label className="label">Monto ($)</label><input className="input" type="number" min="0" value={payEditForm.amount} onChange={e=>setPayEditForm(f=>({...f,amount:e.target.value}))}/></div>
            <div><label className="label">Método</label>
              <select className="select" value={payEditForm.method} onChange={e=>setPayEditForm(f=>({...f,method:e.target.value}))}>
                <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="debito">Débito</option><option value="cheque">Cheque</option>
              </select>
            </div>
            <div><label className="label">Notas</label><input className="input" value={payEditForm.notes} onChange={e=>setPayEditForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional"/></div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setPayEditId(null)}>Cancelar</button>
          <button className="btn-primary" onClick={savePayEdit} disabled={payEditSaving||!payEditForm.amount}>{payEditSaving?"Guardando...":"Guardar cambios"}</button>
        </div>
      </Modal>

    </div>
  );
}
