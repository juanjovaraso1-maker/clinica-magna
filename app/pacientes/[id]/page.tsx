"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Edit2, Phone, Mail, MapPin, Heart, Plus, Trash2, Upload,
  ExternalLink, CreditCard, AlertTriangle, Pill, Calendar, FileText,
  TrendingUp, Activity, ChevronRight, Check, X, Save, Printer, ClipboardList,
  BookOpen, CalendarPlus, Banknote,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import DentalChart from "@/components/odontogram/DentalChart";
import FacialChart from "@/components/odontogram/FacialChart";
import Link from "next/link";

interface BudgetItem { id:string; description:string; tooth:string; area:string; quantity:number; unitPrice:number; total:number; status:string; sessions:number }
interface Patient {
  id: string; rut: string; firstName: string; lastName: string;
  email: string; phone: string; gender: string; address: string; city: string;
  healthInsurance: string; birthDate: string; notes: string;
  clinicalRecord?: { bloodType:string; allergies:string; currentMedications:string; medicalBackground:string; dentalBackground:string; habits:string; observations:string };
  evolutions: Array<{ id:string; date:string; diagnosis:string; treatment:string; tooth:string; observations:string; cost:number; user:{name:string} }>;
  budgets: Array<{ id:string; number:number; date:string; status:string; total:number; discount:number; items:BudgetItem[]; payments:Array<{amount:number}>; user:{name:string} }>;
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
  const [users, setUsers] = useState<Array<{id:string;name:string}>>([]);
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
  const [editForm, setEditForm] = useState({ firstName:"", lastName:"", phone:"", email:"", address:"", city:"", healthInsurance:"", notes:"" });
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const [pr, ur, or_, fr] = await Promise.all([
      fetch(`/api/patients/${id}`), fetch("/api/users"),
      fetch(`/api/odontogram?patientId=${id}`),
      fetch(`/api/facial?patientId=${id}`),
    ]);
    if (pr.ok) setPatient(await pr.json());
    if (ur.ok) setUsers(await ur.json());
    if (or_.ok) setOdontogram(await or_.json());
    if (fr.ok) setFacial(await fr.json());
  }

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

  function printRx() {
    const w = window.open("", "_blank");
    if (!w || !patient) return;
    const professional = users.find(u => u.id === rxUserId);
    const today = new Date().toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
    const meds = rxItems.filter(m => m.drug.trim());
    w.document.write(`<!DOCTYPE html><html><head><title>Receta Médica</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #588157;margin-bottom:20px}
      .clinic{font-size:20px;font-weight:bold;color:#3a5a40}
      .info{font-size:11px;color:#6b7280;line-height:1.7;margin-top:3px}
      .patient-box{background:#f2f5f0;border:1px solid #c4d5bc;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;gap:24px}
      .patient-box div{font-size:12px}
      .patient-box strong{color:#3a5a40}
      .rx-symbol{font-size:36px;color:#588157;font-weight:bold;margin-bottom:8px}
      .med-row{padding:10px 0;border-bottom:1px solid #f1f5f9}
      .med-name{font-size:14px;font-weight:700;color:#1f2937}
      .med-detail{font-size:12px;color:#6b7280;margin-top:2px}
      .notes-box{margin-top:16px;padding:10px 12px;border:1px solid #c4d5bc;border-radius:6px;font-size:12px;color:#476847;background:#f2f5f0}
      .footer{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end}
      .signature{text-align:center;min-width:180px}
      .sig-line{border-top:1px solid #374151;margin-top:40px;padding-top:6px;font-size:12px;color:#374151}
      .date-box{font-size:12px;color:#6b7280}
      @media print{body{margin:16px}}
    </style></head><body>
    <div class="header">
      <div><div class="clinic">Clínica Magna</div><div class="info">Sistema Dental</div></div>
      <div style="text-align:right;font-size:12px;color:#6b7280"><strong style="font-size:14px;color:#1f2937">RECETA MÉDICA</strong><br>${today}</div>
    </div>
    <div class="patient-box">
      <div><strong>Paciente:</strong><br>${patient.firstName} ${patient.lastName}</div>
      <div><strong>RUT:</strong><br>${patient.rut}</div>
      ${patient.birthDate ? `<div><strong>Fecha nac.:</strong><br>${new Date(patient.birthDate).toLocaleDateString("es-CL")}</div>` : ""}
    </div>
    <div class="rx-symbol">℞</div>
    <div>
      ${meds.map((m,i) => `
        <div class="med-row">
          <div class="med-name">${i+1}. ${m.drug}${m.dose ? ` — ${m.dose}` : ""}</div>
          <div class="med-detail">
            ${[m.freq, m.duration, m.route, m.instructions].filter(Boolean).join(" · ")}
          </div>
        </div>`).join("")}
    </div>
    ${rxNotes ? `<div class="notes-box"><strong>Indicaciones:</strong> ${rxNotes}</div>` : ""}
    <div class="footer">
      <div class="date-box">Santiago, ${today}</div>
      <div class="signature">
        <div class="sig-line">${professional ? professional.name : "___________________________"}<br>Médico / Dentista</div>
      </div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
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
    const w = window.open("", "_blank");
    if (!w || !patient) return;
    const professional = users.find(u => u.id === cuidadosUserId);
    const today = new Date().toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
    w.document.write(`<!DOCTYPE html><html><head><title>Instrucciones de Cuidados</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;max-width:680px;margin:32px auto;color:#1f2937;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #588157;margin-bottom:20px}
      .clinic{font-size:20px;font-weight:bold;color:#3a5a40}
      .patient-box{background:#f2f5f0;border:1px solid #c4d5bc;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;gap:24px}
      .title{font-size:18px;font-weight:bold;color:#3a5a40;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #c4d5bc}
      .instructions{white-space:pre-line;font-size:13px;line-height:2;color:#374151}
      .footer{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end}
      .sig-line{border-top:1px solid #374151;margin-top:40px;padding-top:6px;font-size:12px;color:#374151;text-align:center;min-width:180px}
      @media print{body{margin:16px}}
    </style></head><body>
    <div class="header">
      <div><div class="clinic">Clínica Magna</div></div>
      <div style="text-align:right;font-size:12px;color:#6b7280"><strong style="font-size:14px;color:#1f2937">INSTRUCCIONES DE CUIDADOS</strong><br>${today}</div>
    </div>
    <div class="patient-box">
      <div><strong>Paciente:</strong> ${patient.firstName} ${patient.lastName}</div>
      <div><strong>RUT:</strong> ${patient.rut}</div>
    </div>
    <div class="title">${cuidadosTemplate}</div>
    <div class="instructions">${cuidadosText}</div>
    <div class="footer">
      <div style="font-size:12px;color:#6b7280">Santiago, ${today}</div>
      <div class="sig-line">${professional ? professional.name : "___________________________"}<br>Dentista tratante</div>
    </div>
    </body></html>`);
    w.document.close(); w.print();
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
    setEditForm({ firstName:patient.firstName, lastName:patient.lastName, phone:patient.phone||"", email:patient.email||"", address:patient.address||"", city:patient.city||"", healthInsurance:patient.healthInsurance||"", notes:patient.notes||"" });
    setEditPatient(true);
  }

  async function saveEditPatient() {
    setEditSaving(true);
    await fetch(`/api/patients/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(editForm) });
    setEditPatient(false); load(); setEditSaving(false);
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

  const age = patient.birthDate ? Math.floor((Date.now()-new Date(patient.birthDate).getTime())/(1000*60*60*24*365.25)) : null;
  const paidTotal = patient.payments.reduce((s,p)=>s+p.amount,0);
  const budgetTotal = patient.budgets.filter(b=>b.status!=="rejected").reduce((s,b)=>s+b.total,0);
  const saldo = budgetTotal - paidTotal;
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
                <button onClick={openEditPatient} className="btn-secondary text-xs flex-shrink-0">
                  <Edit2 size={13}/> Editar
                </button>
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
          <Link href={`/presupuestos?patientId=${id}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">
            <FileText size={13}/> Nuevo presupuesto
          </Link>
          <Link href={`/agenda?patientId=${id}&newAppt=1`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
            <CalendarPlus size={13}/> Nueva cita
          </Link>
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
              <button onClick={openFicha} className="btn-primary text-sm">
                <Edit2 size={14}/> {patient.clinicalRecord ? "Editar" : "Crear ficha"}
              </button>
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
            <Link href={`/presupuestos?patientId=${id}`} className="btn-primary text-sm">
              <Plus size={15}/> Nuevo Presupuesto
            </Link>
          </div>

          {patient.budgets.length===0 ? <div className="card py-12 text-center text-muted">Sin presupuestos</div> :
            patient.budgets.map(b=>(
              <div key={b.id} className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Presupuesto #{b.number}</p>
                    <p className="text-xs text-slate-500">{b.date} · {b.user.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge value={b.status}/>
                    <p className="text-lg font-bold text-slate-900">{fmt(b.total)}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr>
                    <th className="text-left px-5 py-2 text-xs text-slate-500">Tratamiento</th>
                    <th className="text-center px-3 py-2 text-xs text-slate-500 hidden sm:table-cell">Diente/Área</th>
                    <th className="text-center px-3 py-2 text-xs text-slate-500">Sesiones</th>
                    <th className="text-center px-3 py-2 text-xs text-slate-500">Estado</th>
                    <th className="text-right px-5 py-2 text-xs text-slate-500">Total</th>
                  </tr></thead>
                  <tbody>{b.items.map(item=>(
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-2.5 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 hidden sm:table-cell">{item.tooth||item.area||"—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <input type="number" min={1} max={20} value={item.sessions}
                          className="w-12 text-center text-xs border border-slate-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          onChange={async e=>{
                            await fetch(`/api/budget-items/${item.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:item.status,sessions:parseInt(e.target.value)||1})});
                            load();
                          }}/>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <select value={item.status}
                          className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${ITEM_STATUS[item.status]?.color ?? "bg-slate-100 text-slate-600"}`}
                          onChange={e=>updateItemStatus(item.id,e.target.value)}>
                          <option value="pending">Pendiente</option>
                          <option value="in_progress">En progreso</option>
                          <option value="completed">Completado</option>
                        </select>
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium">{fmt(item.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Abonado: <span className="font-semibold text-emerald-700">{fmt(b.payments.reduce((s,p)=>s+p.amount,0))}</span></span>
                  <span className="text-red-600 font-semibold">Saldo: {fmt(b.total - b.payments.reduce((s,p)=>s+p.amount,0))}</span>
                  <span className="font-bold text-slate-900">Total: {fmt(b.total)}</span>
                </div>
              </div>
            ))}
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
              </tr></thead>
              <tbody>
                {patient.payments.length===0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Sin pagos registrados</td></tr>
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
            ["Datos Personales",[["RUT",patient.rut],["Nombre",`${patient.firstName} ${patient.lastName}`],["Género",patient.gender==="M"?"Masculino":"Femenino"],["Fecha nac.",patient.birthDate?new Date(patient.birthDate+"T12:00:00").toLocaleDateString("es-CL"):"—"],["Edad",age?`${age} años`:"—"]]],
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
            <Link href={`/agenda?patientId=${id}&newAppt=1`} className="btn-primary text-sm">
              <CalendarPlus size={15}/> Nueva Cita
            </Link>
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
                  <div className="col-span-6">
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
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Costo</label>
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
                if(tpl && RX_TEMPLATES[tpl]) setRxItems(RX_TEMPLATES[tpl].map(m=>({...m})));
              }}>
              <option value="">— Sin plantilla —</option>
              {Object.keys(RX_TEMPLATES).map(k=><option key={k}>{k}</option>)}
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
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setRxModal(false)}>Cancelar</button>
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
                setCuidadosText(CARE_TEMPLATES[e.target.value] ?? "");
              }}>
              {Object.keys(CARE_TEMPLATES).map(k=><option key={k}>{k}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Instrucciones (editable)</label>
            <textarea className="input resize-none font-mono text-sm leading-relaxed" rows={10}
              value={cuidadosText} onChange={e=>setCuidadosText(e.target.value)}/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setCuidadosModal(false)}>Cerrar</button>
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
    </div>
  );
}
