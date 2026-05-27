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
import { buildRecetaBody, buildPresupuestoBody, buildIndicacionesBody, buildRadiografiaBody } from "@/lib/pdf-templates";
import { useIsAdmin } from "@/hooks/useRole";

// Renders a body HTML string in a hidden A4-width div, captures it with html2canvas,
// converts to PDF via jsPDF, and returns the PDF as a base64 string.
async function generatePdfBase64(bodyHtml: string): Promise<string> {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF }       = await import("jspdf");

  const el = document.createElement("div");
  Object.assign(el.style, {
    position:   "fixed",
    left:       "-9999px",
    top:        "0",
    width:      "794px",   // A4 at 96 dpi
    padding:    "53px",    // 14 mm margins
    boxSizing:  "border-box",
    background: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize:   "11px",
    color:      "#1a1a1a",
  });
  el.innerHTML = bodyHtml;
  document.body.appendChild(el);

  // Wait for images (logo) to load
  await Promise.all(
    Array.from(el.querySelectorAll("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })
    )
  );

  const canvas = await html2canvas(el, {
    scale:           2,
    useCORS:         true,
    allowTaint:      true,
    backgroundColor: "#ffffff",
    logging:         false,
  });
  document.body.removeChild(el);

  const imgData  = canvas.toDataURL("image/jpeg", 0.92);
  const pdf      = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW    = pdf.internal.pageSize.getWidth();   // 210 mm
  const pageH    = pdf.internal.pageSize.getHeight();  // 297 mm
  const imgH     = (canvas.height / canvas.width) * pageW;

  let remaining = imgH;
  let offset    = 0;

  pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
  remaining -= pageH;

  while (remaining > 0) {
    offset -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
    remaining -= pageH;
  }

  // output("datauristring") → "data:application/pdf;base64,<base64>"
  return (pdf.output("datauristring") as string).split(",")[1];
}

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
function fmtShort(n:number) { const abs=Math.abs(n); const sign=n<0?"-":""; if(abs>=1000000) return `${sign}$${(abs/1000000).toFixed(1)}M`; if(abs>=1000) return `${sign}$${Math.round(abs/1000)}K`; return fmt(n); }

const CARE_TEMPLATES: Record<string, string> = {
  "Post-exodoncia": "• Morder el algodón firmemente 30–40 minutos y luego retirarlo sin escupir.\n• Evitar enjuagarse la boca las primeras 24 horas.\n• Aplicar hielo externo (20 min sí / 20 min no) durante las primeras 2–3 horas.\n• No consumir alimentos calientes, picantes ni duros por 24 horas. Dieta blanda 2–3 días.\n• No fumar ni consumir alcohol por al menos 48 horas.\n• Tomar los medicamentos indicados según prescripción.\n• Si presenta sangrado abundante, inflamación intensa o fiebre, contactar a la clínica.",
  "Post-endodoncia": "• Es normal sentir sensibilidad o molestias leves durante algunos días.\n• Evitar morder con la pieza tratada hasta recibir la restauración definitiva.\n• Tomar los medicamentos indicados según indicación.\n• Mantener higiene oral normal, cepillando con suavidad la zona.\n• Acudir al control indicado por el profesional.",
  "Post-blanqueamiento": "• Evitar alimentos y bebidas pigmentantes (café, té, vino tinto, betarraga) durante 48 horas.\n• No fumar durante 48 horas.\n• Es normal sentir sensibilidad dental transitoria.\n• Usar pasta dental para dientes sensibles si es necesario.",
  "Post-implante": "• No enjuagarse ni escupir las primeras 24 horas.\n• Aplicar hielo externamente durante las primeras horas.\n• Dieta líquida y blanda por 5–7 días.\n• Cepillar suavemente la zona, evitando el implante las primeras 48h.\n• No fumar durante el proceso de oseointegración.\n• Tomar los antibióticos y analgésicos indicados. Acudir a los controles programados.",
  "Post-cirugía oral": "• Morder el algodón 30–45 minutos.\n• Evitar esfuerzo físico por 48–72 horas.\n• No escupir ni sorberse el labio las primeras 24 horas.\n• Aplicar frío local las primeras 24h.\n• Dieta líquida y fría las primeras 12h, luego blanda.\n• Enjuagues con agua tibia con sal desde el día siguiente.\n• Tomar antibióticos y analgésicos según prescripción.",
  "Higiene oral": "• Cepillarse los dientes al menos 3 veces al día (especialmente antes de dormir).\n• Usar seda dental o cepillos interdentales diariamente.\n• Usar enjuague bucal una vez al día.\n• Cambiar el cepillo cada 3 meses.\n• Visitar al dentista cada 6 meses para control y limpieza profesional.",
};

const CARE_SECTIONS: Record<string,{primeras2h:string;primeras24h:string;general:string;alarma:string}> = {
  "Post-exodoncia": {
    primeras2h: "• Morder el algodón firmemente durante 30–40 minutos y retirarlo sin escupir.\n• Aplicar hielo externo envuelto en un paño: 20 min sí / 20 min no.\n• No enjuagarse la boca con fuerza durante las primeras 2 horas.",
    primeras24h: "• Evitar alimentos calientes, picantes o duros. Preferir dieta blanda y fría.\n• No fumar ni consumir alcohol por al menos 48 horas.\n• Evitar esfuerzo físico y actividades que aumenten la presión arterial.\n• No escupir ni sorberse el labio.",
    general: "• Tomar los medicamentos recetados según indicación, preferiblemente con las comidas.\n• Mantener higiene oral normal, cepillando con suavidad y evitando la zona de extracción.\n• Si se colocaron puntos, acudir al control indicado para su retiro.\n• Puede enjuagarse suavemente con agua tibia con sal a partir del segundo día.",
    alarma: "• Sangrado abundante que no cede después de 30 minutos de presión.\n• Dolor intenso que aumenta después de las 48 horas.\n• Inflamación severa o asimetría facial marcada.\n• Fiebre superior a 38 °C.\n• Mal sabor persistente o sensación de pus.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
  "Post-endodoncia": {
    primeras2h: "• Evitar masticar del lado del diente tratado hasta que el efecto anestésico haya desaparecido completamente.\n• Puede tomar un analgésico preventivo si el profesional lo indica.",
    primeras24h: "• Es normal sentir sensibilidad o leve molestia al morder durante los primeros días.\n• Tomar los medicamentos indicados según prescripción.\n• Evitar alimentos muy duros o pegajosos sobre el diente tratado.",
    general: "• Mantener higiene oral normal, cepillando suavemente la zona.\n• No masticar alimentos muy duros con el diente tratado hasta recibir la restauración definitiva.\n• Acudir puntualmente al control indicado por el profesional.\n• Si se realizó medicación intraconducto, no retire la curación provisional.",
    alarma: "• Dolor intenso y persistente que no mejora con analgésicos.\n• Inflamación de la mejilla o encía.\n• Fiebre superior a 38 °C.\n• Pérdida o fractura de la restauración provisional.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
  "Post-blanqueamiento": {
    primeras2h: "• Evitar absolutamente el consumo de alimentos o bebidas pigmentantes (café, té, vino tinto, gaseosas oscuras, betarraga).\n• No fumar durante las primeras 2 horas.\n• Es normal sentir sensibilidad dental transitoria que irá disminuyendo.",
    primeras24h: "• Mantener la restricción de alimentos pigmentantes por al menos 24 horas.\n• Preferir alimentos blancos o de colores claros (pollo, arroz, lácteos, pan de molde).\n• Evitar el alcohol y el tabaco.\n• Si presenta sensibilidad, use pasta dental para dientes sensibles.",
    general: "• Continuar usando pasta dental para dientes sensibles si es necesario.\n• Mantener higiene oral adecuada: cepillado suave 3 veces al día y seda dental.\n• Para mantener el resultado, reducir el consumo habitual de alimentos pigmentantes.\n• Consulte con su profesional sobre tratamientos de mantenimiento.",
    alarma: "• Dolor intenso o sensibilidad severa que no mejora después de 72 horas.\n• Irritación persistente de encías o úlceras orales.\n• Manchas blancas que no desaparecen después de 48 horas.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
  "Post-implante": {
    primeras2h: "• No enjuagarse ni escupir en las primeras 2 horas.\n• Aplicar hielo externo envuelto en un paño: 20 min sí / 20 min no.\n• Reposar con la cabeza levemente elevada. Evitar el esfuerzo físico.",
    primeras24h: "• Mantener dieta líquida y blanda (sopas tibias, yogur, puré). Evitar alimentos duros o calientes en el área del implante.\n• No fumar ni consumir alcohol. El tabaco es el principal factor de riesgo para el fracaso del implante.\n• Iniciar el tratamiento antibiótico y analgésico según prescripción.\n• Evitar presionar o tocar el implante con la lengua.",
    general: "• Cepillar el implante con cerdas suaves y pasta no abrasiva, evitando el área las primeras 48 h.\n• Acudir a todos los controles programados; son esenciales para la oseointegración.\n• No fumar durante todo el proceso de integración (mínimo 3 meses).\n• Enjuagarse con clorhexidina según indicación del profesional.",
    alarma: "• Sangrado abundante que no cede.\n• Dolor muy intenso o en aumento después de las 48 horas.\n• Implante que se mueve o se siente suelto.\n• Inflamación severa con pus o mal olor.\n• Fiebre superior a 38 °C.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
  "Post-cirugía oral": {
    primeras2h: "• Morder el algodón 30–45 minutos sin retirarlo antes de tiempo.\n• No escupir, no sorberse el labio ni hablar en exceso.\n• Aplicar frío externo: 20 min sí / 20 min no.\n• Reposo con la cabeza levemente elevada.",
    primeras24h: "• Dieta líquida y fría las primeras 12 horas (helado, jugos, agua fría).\n• Evitar esfuerzo físico, agacharse o cargar peso.\n• No fumar ni consumir alcohol por al menos 72 horas.\n• No tomar aspirina; usar el analgésico indicado.",
    general: "• Iniciar enjuagues suaves con agua tibia con sal o clorhexidina a partir del día siguiente.\n• Tomar antibióticos y analgésicos según prescripción, completando el ciclo completo.\n• Mantener higiene oral suave, evitando cepillar directamente la zona operada.\n• Si hay puntos, acudir al control indicado para su retiro.",
    alarma: "• Sangrado abundante que no cede con presión.\n• Fiebre superior a 38 °C.\n• Dolor intenso y en aumento después de las 48 horas.\n• Inflamación severa con pus o secreción de mal olor.\n• Entumecimiento que persiste más de 24 horas.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
  "Higiene oral": {
    primeras2h: "• Evitar consumir alimentos durante los primeros 30 minutos tras el procedimiento.\n• Puede sentir sensibilidad dental transitoria, que es normal y pasajera.",
    primeras24h: "• Evitar bebidas muy frías o calientes si presenta sensibilidad.\n• Puede notar ligero sangrado de encías al cepillar; es normal y cede en 24 horas.\n• Cepille con suavidad si siente molestia.",
    general: "• Cepillar los dientes al menos 3 veces al día (especialmente antes de dormir).\n• Usar seda dental o cepillos interdentales diariamente.\n• Usar enjuague bucal sin alcohol una vez al día.\n• Cambiar el cepillo dental cada 3 meses.\n• Visitar al dentista cada 6 meses para control y limpieza profesional.",
    alarma: "• Sangrado prolongado de encías que no cede al cepillar.\n• Dolor dental persistente o sensibilidad severa que no mejora en 48 horas.\n• Aparición de aftas, lesiones o manchas en la boca.\n\n⚠ En caso de presentar alguno de estos síntomas, contáctenos de inmediato.",
  },
};

const RX_TEMPLATES: Record<string, Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string;qty?:string}>> = {
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
  const router  = useRouter();
  const isAdmin = useIsAdmin();
  const [patient, setPatient] = useState<Patient|null>(null);
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<Array<{id:string;name:string;rut?:string}>>([]);
  const [evoModal, setEvoModal] = useState(false);
  const [evoForm, setEvoForm] = useState({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"" });
  const [evoBudgetSelections, setEvoBudgetSelections] = useState<Record<string,{selected:boolean;newStatus:string}>>({});
  const [evoReminder, setEvoReminder] = useState(0);
  const [rxDocModal, setRxDocModal] = useState(false);
  const [rxDocUserId, setRxDocUserId] = useState("");
  const [rxDocItems, setRxDocItems] = useState([{ type:"", zone:"" }]);
  const [rxDocIndication, setRxDocIndication] = useState("");
  const [rxDocObservations, setRxDocObservations] = useState("");
  const [rxDocPdfSending, setRxDocPdfSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rxModal, setRxModal] = useState(false);
  const [rxTemplate, setRxTemplate] = useState("");
  const [rxUserId, setRxUserId] = useState("");
  const [rxItems, setRxItems] = useState([{ drug:"", dose:"", freq:"", duration:"", route:"oral", instructions:"", qty:"" }]);
  const [emailDlg, setEmailDlg] = useState<{open:boolean;to:string;type:string;budgetObj?:Patient["budgets"][0]}>({open:false,to:"",type:""});
  const [rxNotes, setRxNotes] = useState("");
  const [cuidadosModal, setCuidadosModal] = useState(false);
  const [cuidadosTemplate, setCuidadosTemplate] = useState("Post-exodoncia");
  const [cuidadosText, setCuidadosText] = useState(CARE_TEMPLATES["Post-exodoncia"]);
  const [cuidadosUserId, setCuidadosUserId] = useState("");
  const [odontogram, setOdontogram] = useState<any>({});
  const [facial, setFacial] = useState<any>({});
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
  const [treatments, setTreatments] = useState<Array<{id:string;name:string;category:string;price:number}>>([]);
  const [budgetDetailId, setBudgetDetailId] = useState<string|null>(null);
  const [budgetPayForm, setBudgetPayForm] = useState({ date:new Date().toISOString().split("T")[0], amount:"", method:"efectivo", notes:"" });
  const [budgetPaySaving, setBudgetPaySaving] = useState(false);
  const [budgetCreateOpen, setBudgetCreateOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ userId:"", date:new Date().toISOString().split("T")[0], validUntil:new Date(Date.now()+30*86400000).toISOString().split("T")[0], status:"pending", discount:0, notes:"" });
  const [budgetItems, setBudgetItems] = useState([{ description:"", tooth:"", area:"", quantity:1, unitPrice:0, discount:0, total:0 }]);
  const [budgetEditId, setBudgetEditId] = useState<string|null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
const [payEditId, setPayEditId] = useState<string|null>(null);
  const [payEditForm, setPayEditForm] = useState({ date:"", amount:"", method:"efectivo", notes:"" });
  const [payEditSaving, setPayEditSaving] = useState(false);
  const [budgetDropIdx, setBudgetDropIdx] = useState<number|null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [rxPdfSending, setRxPdfSending] = useState(false);
  const [carePdfSending, setCarePdfSending] = useState(false);
  const [budgetPdfSending, setBudgetPdfSending] = useState<string|null>(null);
  const [convenios, setConvenios] = useState<Array<{id:string;name:string;discount:number;discountType:string}>>([]);

  async function load() {
    const [pr, ur, or_, fr, cr, tr, cvr] = await Promise.all([
      fetch(`/api/patients/${id}`), fetch("/api/users"),
      fetch(`/api/odontogram?patientId=${id}`),
      fetch(`/api/facial?patientId=${id}`),
      fetch("/api/clinic-config"),
      fetch("/api/treatments"),
      fetch("/api/convenios"),
    ]);
    if (pr.ok) setPatient(await pr.json());
    if (ur.ok) setUsers(await ur.json());
    if (or_.ok) setOdontogram(await or_.json());
    if (fr.ok) setFacial(await fr.json());
    if (cr.ok) setClinicCfg(await cr.json());
    if (tr.ok) setTreatments(await tr.json());
    if (cvr.ok) setConvenios(await cvr.json());
  }

  function applyConvenioBudget(cv: {discount:number;discountType:string}) {
    if (cv.discountType === "pct") {
      setBudgetItems(its => its.map(item => ({
        ...item,
        discount: cv.discount,
        total: item.quantity * item.unitPrice * (1 - cv.discount / 100),
      })));
      setBudgetForm(f => ({ ...f, discount: 0 }));
    } else {
      setBudgetForm(f => ({ ...f, discount: cv.discount }));
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

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

  function openEmailDlg(type: string, budgetObj?: Patient["budgets"][0]) {
    setEmailDlg({ open:true, to:patient?.email||"", type, budgetObj });
  }

  async function doEmailSend() {
    if (!emailDlg.to || !patient) return;
    const to       = emailDlg.to;
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const today    = new Date().toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
    setEmailDlg(d => ({ ...d, open:false }));

    if (emailDlg.type === "rx") {
      setRxPdfSending(true);
      try {
        const professional = users.find(u => u.id === rxUserId);
        const bodyHtml = buildRecetaBody({
          professionalName: professional?.name ?? "",
          professionalRut:  professional?.rut  ?? "",
          patientName:      fullName,
          patientRut:       patient.rut,
          patientBirthDate: patient.birthDate ? patient.birthDate.split("T")[0] : undefined,
          date:        today,
          medications: rxItems.filter(m => m.drug.trim()),
          notes:       rxNotes,
        }, "/LOGO.jpeg");
        const pdfBase64 = await generatePdfBase64(bodyHtml);
        const filename  = `Receta_Medica_${patient.firstName}_${patient.lastName}`;
        const bodyText  = `Estimado/a ${fullName}, adjuntamos su receta médica. Saludos, Clínica Magna.`;
        const r = await fetch("/api/send-document", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ pdfBase64, to, subject:"Receta Médica Odontológica", filename, patientName:fullName, bodyText }),
        });
        const d = await r.json();
        showToast(d.ok ? "✅ Receta enviada como PDF" : `❌ ${d.error}`);
      } catch (e) { showToast(`❌ Error generando PDF: ${String(e)}`); }
      setRxPdfSending(false);

    } else if (emailDlg.type === "cuidados") {
      setCarePdfSending(true);
      try {
        const professional = users.find(u => u.id === cuidadosUserId);
        const sections  = CARE_SECTIONS[cuidadosTemplate];
        const isCustom  = sections && cuidadosText.trim() && cuidadosText !== activeCareTemplates[cuidadosTemplate];
        const bodyHtml  = buildIndicacionesBody({
          professionalName: professional?.name ?? "",
          patientName:  fullName,
          date:         today,
          procedimiento: cuidadosTemplate,
          sections:     sections ?? { primeras2h: cuidadosText, primeras24h:"", general:"", alarma:"" },
          observaciones: isCustom ? cuidadosText : undefined,
        }, "/LOGO.jpeg");
        const pdfBase64 = await generatePdfBase64(bodyHtml);
        const filename  = `Indicaciones_${cuidadosTemplate}_${patient.firstName}_${patient.lastName}`;
        const bodyText  = `Estimado/a ${fullName}, adjuntamos sus indicaciones post-procedimiento. Saludos, Clínica Magna.`;
        const r = await fetch("/api/send-document", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ pdfBase64, to, subject:`Indicaciones ${cuidadosTemplate}`, filename, patientName:fullName, bodyText }),
        });
        const d = await r.json();
        showToast(d.ok ? "✅ Indicaciones enviadas como PDF" : `❌ ${d.error}`);
      } catch (e) { showToast(`❌ Error generando PDF: ${String(e)}`); }
      setCarePdfSending(false);

    } else if (emailDlg.type === "budget" && emailDlg.budgetObj) {
      const db = emailDlg.budgetObj;
      setBudgetPdfSending(db.id);
      try {
        const numStr   = String(db.number).padStart(4, "0");
        const itemDisc = db.items.reduce((s,it) => s + it.unitPrice * it.quantity * (it.discount||0) / 100, 0);
        const totalDisc = itemDisc + (db.discount || 0);
        const bodyHtml = buildPresupuestoBody({
          number:           db.number,
          professionalName: db.user.name,
          patientName:  fullName,
          patientRut:   patient.rut,
          date:         db.date,
          items:        db.items,
          subtotal:     db.subtotal,
          discount:     totalDisc > 0 ? totalDisc : undefined,
          total:        db.total,
        }, "/LOGO.jpeg");
        const pdfBase64 = await generatePdfBase64(bodyHtml);
        const filename  = `Presupuesto_N${numStr}_${patient.firstName}_${patient.lastName}`;
        const bodyText  = `Estimado/a ${fullName}, adjuntamos su presupuesto dental N°${numStr}. Saludos, Clínica Magna.`;
        const r = await fetch("/api/send-document", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ pdfBase64, to, subject:`Presupuesto Dental N°${numStr}`, filename, patientName:fullName, bodyText }),
        });
        const d = await r.json();
        showToast(d.ok ? "✅ Presupuesto enviado como PDF" : `❌ ${d.error}`);
      } catch (e) { showToast(`❌ Error generando PDF: ${String(e)}`); }
      setBudgetPdfSending(null);
    }
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
  const activeRxTemplates: Record<string, Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string;qty:string}>> = (() => {
    const withQty = (meds: Array<Record<string,string>>) => meds.map(m=>({qty:"",...m} as any));
    try {
      if (clinicCfg.rx_templates) {
        const arr = JSON.parse(clinicCfg.rx_templates) as Array<{name:string;medications:Array<Record<string,string>>}>;
        if (arr.length > 0) return Object.fromEntries(arr.map(t => [t.name, withQty(t.medications)]));
      }
    } catch { /* ignore parse errors */ }
    return Object.fromEntries(Object.entries(RX_TEMPLATES).map(([k,v])=>[k,withQty(v)]));
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

  function openEvoModal() {
    if (!patient) return;
    const selections: Record<string,{selected:boolean;newStatus:string}> = {};
    patient.budgets.filter(b => b.status !== "rejected").forEach(b => {
      (b.items ?? []).filter(i => i.status !== "completed").forEach(item => {
        selections[item.id] = { selected:false, newStatus: item.status || "in_progress" };
      });
    });
    setEvoBudgetSelections(selections);
    setEvoForm({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"" });
    setEvoReminder(0);
    setEvoModal(true);
  }

  async function saveEvo() {
    const selectedEntries = Object.entries(evoBudgetSelections).filter(([,v]) => v.selected);
    if (!selectedEntries.length || !evoForm.userId) return;
    setSaving(true);
    const allItems = patient!.budgets.flatMap(b => b.items);
    await Promise.all(selectedEntries.map(([itemId]) => {
      const item = allItems.find(i => i.id === itemId);
      if (!item) return Promise.resolve();
      return fetch("/api/evolutions", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patientId:id, date:evoForm.date, diagnosis:evoForm.diagnosis,
          treatment:item.description, tooth:item.tooth||"", observations:evoForm.observations,
          cost:item.total, userId:evoForm.userId }) });
    }));
    await Promise.all(selectedEntries.map(([itemId, sel]) =>
      fetch(`/api/budget-items/${itemId}`, { method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ status: sel.newStatus }) })
    ));
    setEvoModal(false);
    setEvoBudgetSelections({});
    setEvoForm({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"" });
    if (evoReminder > 0) {
      fetch("/api/reminders", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patientId: id, months: evoReminder }) });
      setEvoReminder(0);
    }
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
    const addr = clinicCfg.clinic_address  || "Badajoz 100 Of. 918, Las Condes";
    const phone= clinicCfg.clinic_phone    || "+56 9 6279 3952";
    const mail = clinicCfg.clinic_email    || "administracion@clinicamagna.cl";
    const web  = clinicCfg.clinic_website  || "www.clinicamagna.cl";
    const ig   = clinicCfg.clinic_instagram|| "@clinica.magna";
    const l1   = [addr, phone&&`WHATSAPP ${phone}`, mail].filter(Boolean).join("  |  ");
    const l2   = [web, ig&&`INSTAGRAM ${ig}`].filter(Boolean).join("  |  ");
    const logoBase = typeof window !== "undefined" ? window.location.origin + "/LOGO.jpeg" : "/LOGO.jpeg";
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

  function buildFullDocHtml(title:string, body:string): string {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title>
      <style>@page{margin:14mm;size:A4 portrait}*{box-sizing:border-box}body{font-family:'Times New Roman',Times,serif;font-size:11px;color:#1a1a1a;margin:0;padding:14mm}b{font-weight:bold}</style>
      </head><body>${body}</body></html>`;
  }

  function emailPdfRx() {
    if (!rxUserId || rxItems.every(m=>!m.drug.trim())) { showToast("❌ Selecciona profesional y agrega medicamentos"); return; }
    openEmailDlg("rx");
  }

  function emailPdfCuidados() {
    if (!cuidadosText.trim()) { showToast("❌ Agrega instrucciones"); return; }
    openEmailDlg("cuidados");
  }

  function emailPdfBudget(db: Patient["budgets"][0]) {
    openEmailDlg("budget", db);
  }

  function buildRxDocBody(): string {
    if (!patient) return "";
    const professional = users.find(u => u.id === rxUserId);
    const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const meds = rxItems.filter(m=>m.drug.trim());
    const fmtBD = patient.birthDate ? patient.birthDate.split("T")[0] : "";
    const thStyle = `padding:6px 7px;border:1px solid #1f4e79;font-size:10px;text-align:center`;
    const medRows = meds.map((m,i)=>`
      <tr style="background:${i%2===0?"#fff":"#f0f6ff"}">
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px;font-weight:bold">${i+1}</td>
        <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10px;font-weight:bold;text-transform:uppercase">${m.drug}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.dose||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.freq||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.duration||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.qty||""}</td>
      </tr>
      ${m.instructions?`<tr style="background:#f8f9fa"><td></td><td colspan="5" style="padding:3px 7px 6px;border:1px solid #bcd2e8;font-size:9.5px;font-style:italic;color:#555">Indicación: ${m.instructions}</td></tr>`:""}
    `).join("");
    return `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:17px;font-weight:bold;letter-spacing:1px">RECETA MÉDICA ODONTOLÓGICA</div>
      </div>
      ${buildDocProfPat({name:professional?.name||"",rut:professional?.rut||""}, [
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT / Fecha nac.",value:`${patient.rut}${fmtBD?" / "+fmtBD:""}`},
        {label:"Fecha",value:today}
      ])}
      <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
        <thead><tr style="background:#1f4e79;color:white">
          <th style="${thStyle};width:5%">N°</th>
          <th style="${thStyle};text-align:left;width:30%">Medicamento</th>
          <th style="${thStyle};width:17%">Dosis</th>
          <th style="${thStyle};width:15%">Posología</th>
          <th style="${thStyle};width:15%">Duración</th>
          <th style="${thStyle};width:18%">Cantidad</th>
        </tr></thead>
        <tbody>${medRows}</tbody>
      </table>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">DIAGNÓSTICO / INDICACIÓN:</div>
        <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10px"></div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">OBSERVACIONES:</div>
        <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10px">${rxNotes||""}</div>
      </div>
      ${buildDocFooter("Firma y Timbre Profesional","Clínica Magna")}`;
  }

  function printRx() {
    if (!patient) return;
    openDocWindow("Receta Médica", buildRxDocBody());
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

  function buildCuidadosDocBody(): string {
    if (!patient) return "";
    const professional = users.find(u => u.id === cuidadosUserId);
    const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const sections = CARE_SECTIONS[cuidadosTemplate];
    function renderSection(title:string, emoji:string, text:string, bg:string, border:string) {
      const lines = text.split("\n").filter(l=>l.trim());
      const html = lines.map(l=>`<div style="margin-bottom:4px;font-size:10.5px;line-height:1.5">${l}</div>`).join("");
      return `<div style="margin-bottom:10px">
        <div style="font-size:10.5px;font-weight:bold;color:#1a1a1a;background:${bg};border-left:3px solid ${border};padding:5px 8px;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px">${emoji} ${title}</div>
        <div style="padding:0 8px">${html}</div></div>`;
    }
    let contentHtml: string;
    if (sections) {
      contentHtml = `
        ${renderSection("Primeras 2 horas","⏱",sections.primeras2h,"#fef3c7","#f59e0b")}
        ${renderSection("Primeras 24 horas","📅",sections.primeras24h,"#dbeafe","#3b82f6")}
        ${renderSection("Cuidados generales","✅",sections.general,"#d1fae5","#10b981")}
        ${renderSection("Señales de alarma","⚠️",sections.alarma,"#fee2e2","#ef4444")}`;
    } else {
      const lines = cuidadosText.split("\n").filter(l=>l.trim());
      contentHtml = `<div style="background:#eaf4fb;border:1px solid #9fc5e8;border-radius:4px;padding:12px 14px;line-height:1.7">
        ${lines.map(l=>`<div style="margin-bottom:5px;font-size:10.5px">${l}</div>`).join("")}
      </div>`;
    }
    const isCustom = sections && cuidadosText.trim() && cuidadosText !== activeCareTemplates[cuidadosTemplate];
    return `
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
      <div style="font-size:11px;font-weight:bold;color:#1e6091;margin:10px 0 7px;text-transform:uppercase;letter-spacing:0.3px">Indicaciones — ${cuidadosTemplate}:</div>
      ${contentHtml}
      ${isCustom?`<div style="margin-top:12px"><div style="font-size:11px;font-weight:bold;color:#555;margin-bottom:5px;text-transform:uppercase">Observaciones adicionales:</div><div style="border:1px solid #bcd2e8;padding:8px;background:#f8fafc;font-size:10.5px;line-height:1.7">${cuidadosText}</div></div>`:""}
      ${buildDocFooter("Firma Profesional","Clínica Magna")}`;
  }

  function printCuidados() {
    if (!patient) return;
    openDocWindow("Indicaciones", buildCuidadosDocBody());
  }

  function buildBudgetDocBody(db: Patient["budgets"][0]): string {
    if (!patient) return "";
    const baseTotal  = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity,0);
    const itemDisc   = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity*(it.discount||0)/100,0);
    const totalDisc  = itemDisc+(db.discount||0);
    const totalFinal = db.total;
    const thS = `padding:6px 7px;border:1px solid #1f4e79;font-size:10px`;
    const tdS = `padding:6px 7px;border:1px solid #bcd2e8;font-size:10.5px`;
    const rows = db.items.map((it,i)=>`
      <tr style="background:${i%2===0?"#fff":"#dce6f1"}">
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px;font-weight:bold">${i+1}</td>
        <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10px">${it.description}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.area||"—"}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.tooth||"—"}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.sessions||it.quantity||1}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #bcd2e8;font-size:10px">${fmt(it.unitPrice*it.quantity)}</td>
      </tr>`).join("");
    const emptyRows = Array.from({length:Math.max(0,8-db.items.length)},(_,i)=>`
      <tr style="background:${(db.items.length+i)%2===0?"#fff":"#dce6f1"}">
        <td style="padding:5px 7px;border:1px solid #bcd2e8;height:22px"></td>
        <td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td>
        <td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td>
        <td style="border:1px solid #bcd2e8"></td>
      </tr>`).join("");
    return `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:17px;font-weight:bold;letter-spacing:1px">PRESUPUESTO DENTAL</div>
        <div style="font-size:10px;font-style:italic;color:#555;margin-top:3px">N° ${String(db.number).padStart(4,"0")} · Válido 30 días · Badajoz 100 Of. 918, Las Condes</div>
      </div>
      ${buildDocProfPat({name:db.user.name},[
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT",value:patient.rut},
        {label:"Fecha",value:db.date}
      ])}
      <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
        <thead><tr style="background:#1f4e79;color:white">
          <th style="${thS};text-align:center;width:5%">N°</th>
          <th style="${thS};text-align:left;width:30%">Tratamiento</th>
          <th style="${thS};text-align:center;width:18%">Categoría</th>
          <th style="${thS};text-align:center;width:12%">Diente(s)</th>
          <th style="${thS};text-align:center;width:11%">Sesiones</th>
          <th style="${thS};text-align:right;width:24%">Precio</th>
        </tr></thead>
        <tbody>
          ${rows}${emptyRows}
          <tr style="background:#f0f6ff">
            <td colspan="5" style="${tdS};text-align:right;font-weight:bold">Subtotal</td>
            <td style="${tdS};text-align:right;font-weight:bold">${fmt(baseTotal)}</td>
          </tr>
          ${totalDisc>0?`<tr style="background:#f0f6ff">
            <td colspan="5" style="${tdS};text-align:right;font-weight:bold;color:#c0392b">Descuento</td>
            <td style="${tdS};text-align:right;font-weight:bold;color:#c0392b">− ${fmt(totalDisc)}</td>
          </tr>`:""}
          <tr style="background:#1f4e79">
            <td colspan="5" style="${tdS};text-align:right;font-weight:bold;color:white;font-size:12px">TOTAL A PAGAR</td>
            <td style="${tdS};text-align:right;font-weight:bold;color:white;font-size:12px">${fmt(totalFinal)}</td>
          </tr>
        </tbody>
      </table>
      <div style="border:1px solid #bcd2e8;padding:10px 13px;background:#f0f6ff;border-radius:3px;font-size:9.5px;line-height:1.7">
        <div style="font-weight:bold;margin-bottom:4px;font-size:10.5px">Condiciones del Presupuesto</div>
        <div>• Este presupuesto tiene una validez de 30 días desde la fecha de emisión.</div>
        <div>• Algunos tratamientos están sujetos a diagnóstico definitivo; los costos pueden variar según hallazgos clínicos y/o radiográficos.</div>
        <div>• Los precios incluyen honorarios profesionales. Insumos especiales, exámenes o derivaciones no están incluidos salvo indicación.</div>
        <div>• Los tratamientos marcados con (*) requieren evaluación adicional antes de iniciar.</div>
      </div>
      ${buildDocFooter("Firma Profesional","Clínica Magna")}`;
  }

  function printBudgetDetail(db: Patient["budgets"][0]) {
    if (!patient) return;
    openDocWindow(`Presupuesto N°${String(db.number).padStart(4,"0")}`, buildBudgetDocBody(db));
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
  const allActiveBudgetItems = patient.budgets
    .filter(b => b.status !== "rejected")
    .flatMap(b => b.items.filter(i => i.status !== "completed").map(i => ({ ...i, budgetNumber: b.number, budgetId: b.id })));
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
        <div className="p-3 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4 flex-wrap md:flex-nowrap">
            {/* Avatar */}
            <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white bg-gradient-to-br from-[#0057FF] to-[#7C3AED]">
              <span className="text-white text-[20px] font-bold">{patient.firstName[0]}{patient.lastName[0]}</span>
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
                  <p className="text-slate-500 text-sm font-mono">{patient.rut}{age ? ` · ${age} años` : ""}{patient.gender ? ` · ${patient.gender === "M" ? "Masculino" : "Femenino"}` : ""}</p>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
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
                  {isAdmin && (
                    <button onClick={deletePatientHard} disabled={deletingPatient} className="btn-secondary text-xs text-red-600 hover:bg-red-50 border-red-200">
                      <Trash2 size={13}/> Eliminar
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {patient.phone && <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"><Phone size={13} className="text-slate-400"/>{patient.phone}</a>}
                {patient.email && <a href={`mailto:${patient.email}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600"><Mail size={13} className="text-slate-400"/>{patient.email}</a>}
                {(patient.address||patient.city) && <span className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={13} className="text-slate-400"/>{[patient.address,patient.city].filter(Boolean).join(", ")}</span>}
                {patient.healthInsurance && <span className="flex items-center gap-1.5 text-sm text-slate-600"><Heart size={13} className="text-slate-400"/>{patient.healthInsurance}</span>}
                {patient.birthDate && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Calendar size={13} className="text-slate-400"/>
                    {new Date(patient.birthDate.split("T")[0]+"T12:00:00").toLocaleDateString("es-CL")}
                    {age ? <span className="text-primary-600 font-semibold ml-1">· {age} años</span> : null}
                  </span>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0 w-full md:w-auto">
              <div className="bg-slate-50 rounded-xl px-2 sm:px-3 py-2 text-center">
                <p className="text-sm sm:text-base font-bold text-slate-900">{patient.appointments.length}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Citas</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-2 sm:px-3 py-2 text-center">
                <p className="text-sm sm:text-base font-bold text-slate-900">{patient.evolutions.length}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Evoluc.</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-2 sm:px-3 py-2 text-center">
                <p className="text-xs sm:text-sm font-bold text-emerald-700 leading-tight">{fmtShort(paidTotal)}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Pagado</p>
              </div>
              <div className={`rounded-xl px-2 sm:px-3 py-2 text-center ${saldo > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className={`text-xs sm:text-sm font-bold leading-tight ${saldo > 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtShort(saldo)}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Saldo</p>
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
        <div className="border-t border-[#E3E8F0] px-3 sm:px-4 py-2.5 flex gap-1.5 flex-wrap bg-[#F0F2F7] rounded-b-[10px]">
          <button onClick={()=>openEvoModal()}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#EEF3FF] text-[#0057FF] border-[#0057FF]/25 hover:bg-[#0057FF] hover:text-white hover:border-[#0057FF]">
            <Activity size={13}/> Evolución
          </button>
          <button onClick={()=>setRxModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#E6F7F1] text-[#00A86B] border-[#00A86B]/25 hover:bg-[#00A86B] hover:text-white hover:border-[#00A86B]">
            <Printer size={13}/> Receta
          </button>
          <button onClick={()=>setCuidadosModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#E0F2FE] text-[#0891B2] border-[#0891B2]/25 hover:bg-[#0891B2] hover:text-white hover:border-[#0891B2]">
            <BookOpen size={13}/> Cuidados
          </button>
          <button onClick={()=>{ setRxDocUserId(""); setRxDocItems([{type:"",zone:""}]); setRxDocIndication(""); setRxDocObservations(""); setRxDocModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#FEF3C7] text-[#92600A] border-[#F59E0B]/25 hover:bg-[#F59E0B] hover:text-white hover:border-[#F59E0B]">
            <FileText size={13}/> Solicitud Rx
          </button>
          <button onClick={()=>setPayModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#E6F7F1] text-[#00A86B] border-[#00A86B]/25 hover:bg-[#00A86B] hover:text-white hover:border-[#00A86B]">
            <CreditCard size={13}/> Pago
          </button>
          <button onClick={openBudgetCreate}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#EDE9FE] text-[#7C3AED] border-[#7C3AED]/25 hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED]">
            <FileText size={13}/> Presupuesto
          </button>
          <a href={`/agenda?patientId=${id}&newAppt=1`}
            className="inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] font-semibold px-[13px] py-[7px] border-[1.5px] transition-all duration-150 cursor-pointer
                       bg-[#EEF3FF] text-[#0057FF] border-[#0057FF]/25 hover:bg-[#0057FF] hover:text-white hover:border-[#0057FF]">
            <CalendarPlus size={13}/> Cita
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-[2px] bg-[#F0F2F7] rounded-[10px] p-[3px] w-fit border border-[#E3E8F0] mb-4 flex-wrap">
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)}
              className={`px-3.5 py-[7px] text-[13px] rounded-[7px] transition-all duration-150 ${
                tab===i
                  ? "bg-white text-[#1A1D2E] shadow-sm font-semibold"
                  : "text-[#9AA0B4] font-medium cursor-pointer hover:text-[#1A1D2E]"
              }`}>
              {t}
              {t==="Historial" && timeline.length > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab===i?"bg-[#EEF3FF] text-[#0057FF]":"bg-[#E3E8F0] text-[#9AA0B4]"}`}>{timeline.length}</span>
              )}
            </button>
          ))}
      </div>

      {/* ===== TAB 0: HISTORIAL (TIMELINE) ===== */}
      {tab===0&&(
        <div className="space-y-1">
          {timeline.length===0 ? (
            <div className="card py-12 text-center text-muted">Este paciente no tiene historial registrado aún.</div>
          ) : (
            <div className="space-y-0">
              {timeline.map((item,i)=>(
                <div key={i} className="flex gap-3 pb-6 relative">
                  <div className="flex flex-col items-center flex-shrink-0 w-16">
                    <div className="text-[11px] font-semibold text-[#9AA0B4] text-center leading-tight">
                      {new Date(item.date+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short"})}
                    </div>
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0 mt-1">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow z-10 ${item.color}`}/>
                    {i < timeline.length-1 && <div className="w-px flex-1 bg-[#E3E8F0] mt-1 min-h-[24px]"/>}
                  </div>
                  <div className="flex-1 bg-white border border-[#E3E8F0] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow mb-2">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-[8px] py-[3px] rounded-full ${item.color}`}>
                          {item.icon}{item.kind}
                        </span>
                        <p className="text-[13.5px] font-semibold text-[#1A1D2E]">{item.label}</p>
                        {item.badge && <Badge value={item.badge} className="ml-1"/>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.amount != null && item.amount > 0 && (
                          <span className={`text-[12px] font-bold px-[8px] py-[3px] rounded-full ${item.kind==="pago"?"bg-[#E6F7F1] text-[#00A86B]":item.kind==="presupuesto"?"bg-[#F0F2F7] text-[#5A6072]":"bg-[#EDE9FE] text-[#7C3AED]"}`}>
                            {fmt(item.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-[#9AA0B4]">{item.sub}</p>
                  </div>
                </div>
              ))}
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
                {patient.clinicalRecord && isAdmin && (
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  {label:"Grupo sanguíneo", value: patient.clinicalRecord.bloodType, icon:"🩸"},
                  {label:"Alergias", value: patient.clinicalRecord.allergies||"Sin alergias", icon:"⚠️", alert: !!patient.clinicalRecord.allergies},
                  {label:"Medicamentos", value: patient.clinicalRecord.currentMedications||"Ninguno", icon:"💊"},
                  {label:"Antec. médicos", value: patient.clinicalRecord.medicalBackground||"—", icon:"🏥"},
                  {label:"Antec. dentales", value: patient.clinicalRecord.dentalBackground||"—", icon:"🦷"},
                  {label:"Hábitos", value: patient.clinicalRecord.habits||"—", icon:"📋"},
                ].map((field,i) => (
                  <div key={i} className={`rounded-[10px] p-4 border ${field.alert?"bg-[#FDECEA] border-[#E53935]/20":"bg-[#F0F2F7] border-[#E3E8F0]"}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mb-1 flex items-center gap-1">
                      <span>{field.icon}</span>{field.label}
                    </div>
                    <div className={`text-[13px] font-semibold ${field.alert?"text-[#E53935]":"text-[#1A1D2E]"}`}>
                      {field.value||"—"}
                    </div>
                  </div>
                ))}
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
          <DentalChart data={odontogram} onChange={setOdontogram} onSave={saveOdontogram} isSaving={oSaving}/>
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
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>{ setRxUserId(""); setRxItems([{drug:"",dose:"",freq:"",duration:"",route:"oral",instructions:"",qty:""}]); setRxNotes(""); setRxModal(true); }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors">
                <Printer size={13}/> Receta médica
              </button>
              <button onClick={()=>openEvoModal()} className="btn-primary text-sm">
                <Plus size={14}/> Nueva Evolución
              </button>
            </div>
          </div>
          {patient.evolutions.length===0 ? (
            <div className="card py-12 text-center">
              <ClipboardList size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-muted">Sin evoluciones registradas</p>
              <button onClick={()=>openEvoModal()} className="btn-primary text-sm mt-4"><Plus size={14}/> Primera evolución</button>
            </div>
          ) : (
            <div className="space-y-2 relative pl-3">
              {patient.evolutions.map((e,idx)=>(
                <div key={e.id} className="flex gap-4 pb-6 relative">
                  {/* Línea vertical timeline */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-[10px] h-[10px] rounded-full bg-[#0057FF] mt-1 flex-shrink-0 border-2 border-white shadow-sm z-10" />
                    {idx < patient.evolutions.length - 1 && (
                      <div className="w-px flex-1 bg-[#E3E8F0] mt-1" />
                    )}
                  </div>
                  {/* Contenido */}
                  <div className="flex-1 bg-white border border-[#E3E8F0] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold bg-[#F0F2F7] text-[#5A6072] px-[8px] py-[3px] rounded-full">{e.date}</span>
                        <span className="text-[12px] font-medium text-[#5A6072]">{e.user.name}</span>
                        {e.tooth && (
                          <span className="text-[11px] bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 px-[8px] py-[3px] rounded-full font-semibold">
                            Diente #{e.tooth}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {e.cost > 0 && (
                          <span className="text-[13px] font-bold text-[#00A86B] bg-[#E6F7F1] px-[10px] py-[3px] rounded-full">
                            {fmt(e.cost)}
                          </span>
                        )}
                        {isAdmin && (
                          <button onClick={()=>deleteEvolution(e.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C8D0E0] hover:text-[#E53935] hover:bg-[#FDECEA] transition-colors">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                    {e.diagnosis && (
                      <div className="mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mr-2">Diagnóstico</span>
                        <span className="text-[13px] text-[#1A1D2E]">{e.diagnosis}</span>
                      </div>
                    )}
                    <div className="mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mr-2">Tratamiento</span>
                      <span className="text-[13px] font-medium text-[#1A1D2E]">{e.treatment}</span>
                    </div>
                    {e.observations && (
                      <div className="mt-3 pt-3 border-t border-[#E3E8F0]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mr-2">Observaciones</span>
                        <p className="text-[12.5px] text-[#5A6072] mt-1 leading-relaxed">{e.observations}</p>
                      </div>
                    )}
                  </div>
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
            <div className="flex gap-2 flex-wrap">
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <p className="text-xs text-slate-500">Presupuestado</p>
                <p className="text-sm font-bold text-slate-900">{fmt(budgetTotal)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <p className="text-xs text-slate-500">Pagado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(paidTotal)}</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center min-w-[80px] ${saldo>0?"bg-red-50":"bg-emerald-50"}`}>
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
              <div key={b.id} className="bg-white border border-[#E3E8F0] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1A1D2E]">Presupuesto #{String(b.number).padStart(4,"0")}</div>
                    <div className="text-[11px] text-[#9AA0B4] mt-0.5">{b.date} · {b.user.name}</div>
                  </div>
                  <Badge value={b.status}/>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-[#F0F2F7] rounded-[8px] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mb-1">Total</div>
                    <div className="text-[16px] font-bold text-[#1A1D2E]">{fmt(b.total)}</div>
                  </div>
                  <div className="bg-[#E6F7F1] rounded-[8px] p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mb-1">Pagado</div>
                    <div className="text-[16px] font-bold text-[#00A86B]">{fmt(bPaid)}</div>
                  </div>
                  <div className={`rounded-[8px] p-3 text-center ${bBalance>0?"bg-[#FDECEA]":"bg-[#E6F7F1]"}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] mb-1">Saldo</div>
                    <div className={`text-[16px] font-bold ${bBalance>0?"text-[#E53935]":"text-[#00A86B]"}`}>{fmt(bBalance)}</div>
                  </div>
                </div>
                <div className="w-full bg-[#E3E8F0] rounded-full h-1.5 mb-3">
                  <div className="bg-[#00A86B] h-1.5 rounded-full transition-all" style={{width:`${Math.min(100,Math.round((bPaid/b.total)*100))}%`}}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setBudgetDetailId(b.id)} className="flex-1 text-[12px] font-semibold bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 rounded-[8px] py-2 hover:bg-[#0057FF] hover:text-white transition-all">
                    Ver detalle
                  </button>
                </div>
              </div>
            )})}
        </div>
      )}

      {/* ===== TAB 6: PAGOS ===== */}
      {tab===6&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              <div className="bg-emerald-50 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <p className="text-xs text-slate-500">Total pagado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(paidTotal)}</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center min-w-[80px] ${saldo>0?"bg-red-50":"bg-emerald-50"}`}>
                <p className="text-xs text-slate-500">Saldo deudor</p>
                <p className={`text-sm font-bold ${saldo>0?"text-red-600":"text-emerald-700"}`}>{fmt(saldo)}</p>
              </div>
            </div>
            <button onClick={()=>setPayModal(true)} className="btn-primary text-sm">
              <CreditCard size={15}/> Registrar Pago
            </button>
          </div>
          {patient.payments.length===0 ? (
            <div className="card py-12 text-center text-muted">Sin pagos registrados</div>
          ) : (
            <div className="overflow-hidden border border-[#E3E8F0] rounded-[10px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#F0F2F7]">
                    <th className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] px-4 py-3 text-left">Fecha</th>
                    <th className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] px-4 py-3 text-left">Monto</th>
                    <th className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] px-4 py-3 text-left">Método</th>
                    <th className="text-[10px] font-bold uppercase tracking-wider text-[#9AA0B4] px-4 py-3 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.payments.map((p,i)=>(
                    <tr key={p.id} className={`border-t border-[#E3E8F0] hover:bg-[#EEF3FF] transition-colors ${i%2===0?"bg-white":"bg-[#F0F2F7]/50"}`}>
                      <td className="px-4 py-3 text-[12px] text-[#9AA0B4] font-medium">{new Date(p.date+"T12:00:00").toLocaleDateString("es-CL")}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[#00A86B]">{fmt(p.amount)}</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-semibold bg-[#F0F2F7] text-[#5A6072] px-[8px] py-[3px] rounded-full">{p.method}</span></td>
                      <td className="px-4 py-3 text-[12px] text-[#9AA0B4]">{p.notes||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {patient.documents.map(doc=>(
                <div key={doc.id} className="flex items-center gap-3 bg-[#F0F2F7] border border-[#E3E8F0] rounded-[10px] p-3 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow">
                  <div className="w-10 h-10 rounded-[8px] bg-white border border-[#E3E8F0] flex items-center justify-center flex-shrink-0 text-[20px]">
                    {doc.type==="radiografia"?"🩻":doc.type==="consentimiento"?"📄":doc.type==="foto"?"📸":"📎"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1A1D2E] truncate">{doc.name}</div>
                    <div className="text-[11px] text-[#9AA0B4] mt-0.5">{new Date(doc.createdAt).toLocaleDateString("es-CL")} · {doc.type}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={doc.fileName} target="_blank" className="w-8 h-8 flex items-center justify-center rounded-[7px] bg-white border border-[#E3E8F0] text-[#5A6072] hover:bg-[#0057FF] hover:text-white hover:border-[#0057FF] transition-all text-[13px]">↗</a>
                    {isAdmin && <button onClick={()=>deleteDoc(doc.id)} className="w-8 h-8 flex items-center justify-center rounded-[7px] bg-white border border-[#E3E8F0] text-[#C8D0E0] hover:bg-[#FDECEA] hover:text-[#E53935] hover:border-[#E53935] transition-all"><Trash2 size={13}/></button>}
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
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[440px]">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>
              <th className="text-left px-3 sm:px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="text-left px-3 sm:px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Hora</th>
              <th className="text-left px-3 sm:px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-3 sm:px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Profesional</th>
              <th className="text-left px-3 sm:px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Estado</th>
            </tr></thead>
            <tbody>
              {patient.appointments.length===0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Sin citas registradas</td></tr>
              ) : patient.appointments.map(a=>(
                <tr key={a.id} className="table-row">
                  <td className="px-3 sm:px-5 py-3 text-slate-700 whitespace-nowrap">{a.date}</td>
                  <td className="px-3 sm:px-4 py-3 text-slate-600 whitespace-nowrap">{a.startTime}</td>
                  <td className="px-3 sm:px-4 py-3 text-slate-700 max-w-[120px] truncate">{a.type}</td>
                  <td className="px-3 sm:px-4 py-3 text-slate-500 hidden md:table-cell">{a.user.name}</td>
                  <td className="px-3 sm:px-4 py-3"><Badge value={a.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* ===== MODAL EVOLUCIÓN ===== */}
      <Modal open={evoModal} onClose={()=>setEvoModal(false)} title="Registrar Evolución">
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">

          {/* ── Fecha y profesional ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" value={evoForm.date} onChange={e=>setEvoForm(f=>({...f,date:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Profesional *</label>
              <select className="select" value={evoForm.userId} onChange={e=>setEvoForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* ── Diagnóstico ── */}
          <div>
            <label className="label">Diagnóstico</label>
            <input className="input" value={evoForm.diagnosis}
              onChange={e=>setEvoForm(f=>({...f,diagnosis:e.target.value}))}
              placeholder="Descripción del diagnóstico clínico..."/>
          </div>

          {/* ── Tratamientos desde presupuesto ── */}
          <div>
            <label className="label font-semibold mb-2.5 block">Tratamientos a registrar *</label>
            {allActiveBudgetItems.length === 0 ? (
              <div className="border border-slate-200 rounded-xl bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-500 mb-2">No hay tratamientos presupuestados pendientes.</p>
                <button type="button" onClick={()=>{ setEvoModal(false); openBudgetCreate(); }}
                  className="text-xs text-primary-600 underline hover:text-primary-800">
                  Crear un presupuesto primero
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {allActiveBudgetItems.map(item => {
                  const sel = evoBudgetSelections[item.id] ?? { selected:false, newStatus:item.status||"in_progress" };
                  return (
                    <div key={item.id} className={`border rounded-xl overflow-hidden transition-colors ${sel.selected?"border-primary-300 bg-primary-50/40":"border-slate-200 bg-white"}`}>
                      <label className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={sel.selected}
                          onChange={e=>setEvoBudgetSelections(s=>({...s,[item.id]:{...(s[item.id]??{selected:false,newStatus:item.status||"in_progress"}),selected:e.target.checked}}))}
                          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"/>
                        <span className="text-xs text-slate-400 font-mono flex-shrink-0">#{item.budgetNumber}</span>
                        <span className="flex-1 text-sm font-medium text-slate-900">{item.description}</span>
                        {item.tooth && <span className="text-xs text-slate-400 flex-shrink-0">D.{item.tooth}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ITEM_STATUS[item.status||"pending"]?.color}`}>
                          {ITEM_STATUS[item.status||"pending"]?.label}
                        </span>
                      </label>
                      {sel.selected && (
                        <div className="px-3 pb-2.5 flex items-center gap-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500 flex-shrink-0">Marcar como:</span>
                          {[{v:"in_progress",l:"En proceso"},{v:"completed",l:"Terminado ✓"}].map(opt=>(
                            <button key={opt.v} type="button"
                              onClick={()=>setEvoBudgetSelections(s=>({...s,[item.id]:{...(s[item.id]??{selected:true,newStatus:"in_progress"}),newStatus:opt.v}}))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${sel.newStatus===opt.v?"bg-primary-600 text-white border-primary-600":"bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                              {opt.l}
                            </button>
                          ))}
                          <span className="ml-auto text-xs text-slate-400">{fmt(item.total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Observaciones ── */}
          <div>
            <label className="label">Observaciones clínicas</label>
            <textarea className="input resize-none text-sm leading-relaxed" rows={3}
              value={evoForm.observations}
              onChange={e=>setEvoForm(f=>({...f,observations:e.target.value}))}
              placeholder="Detalles adicionales, indicaciones post-atención, próximos pasos..."/>
          </div>

          {/* ── Recordatorio de control ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="text-xs font-semibold text-amber-800 uppercase tracking-wide block mb-2.5">Recordatorio de control</label>
            <div className="flex gap-2 flex-wrap">
              {[{v:0,l:"Sin recordatorio"},{v:3,l:"3 meses"},{v:6,l:"6 meses"},{v:12,l:"12 meses"},{v:24,l:"24 meses"}].map(opt=>(
                <button key={opt.v} type="button"
                  onClick={()=>setEvoReminder(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${evoReminder===opt.v?"bg-amber-600 text-white border-amber-600":"bg-white text-amber-700 border-amber-300 hover:border-amber-500"}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {Object.values(evoBudgetSelections).filter(v=>v.selected).length} tratam. seleccionados
          </p>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={()=>setEvoModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveEvo}
              disabled={saving||!Object.values(evoBudgetSelections).some(v=>v.selected)||!evoForm.userId}>
              {saving?"Guardando...":"Guardar evolución"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL SOLICITUD RADIOGRAFÍA ===== */}
      <Modal open={rxDocModal} onClose={()=>setRxDocModal(false)} title="Solicitud de Radiografía / Scanner" size="lg">
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Paciente</p>
              <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-slate-400 font-mono">{patient.rut}</p>
            </div>
            <div>
              <label className="label text-xs">Profesional *</label>
              <select className="select" value={rxDocUserId} onChange={e=>setRxDocUserId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Exámenes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label font-semibold mb-0">Exámenes solicitados</label>
              <button type="button" onClick={()=>setRxDocItems(i=>[...i,{type:"",zone:""}])}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors border border-sky-200">
                <Plus size={12}/> Agregar
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <div className="col-span-1">N°</div>
                <div className="col-span-6">Tipo de Examen</div>
                <div className="col-span-5">Zona / Diente</div>
              </div>
              <div className="divide-y divide-slate-100">
                {rxDocItems.map((item,i)=>(
                  <div key={i} className="grid grid-cols-12 items-center px-3 py-2 gap-2">
                    <span className="col-span-1 text-xs font-bold text-slate-400">{i+1}</span>
                    <div className="col-span-6">
                      <input className="input py-1.5 text-sm" value={item.type}
                        onChange={e=>setRxDocItems(its=>its.map((x,j)=>j===i?{...x,type:e.target.value}:x))}
                        placeholder="Rx periapical, Panorámica, TAC, Scanner..."/>
                    </div>
                    <div className="col-span-4">
                      <input className="input py-1.5 text-sm" value={item.zone}
                        onChange={e=>setRxDocItems(its=>its.map((x,j)=>j===i?{...x,zone:e.target.value}:x))}
                        placeholder="Diente 16, sector posterior..."/>
                    </div>
                    {rxDocItems.length > 1 && (
                      <button onClick={()=>setRxDocItems(its=>its.filter((_,j)=>j!==i))}
                        className="col-span-1 w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Indicación clínica</label>
            <textarea className="input resize-none text-sm" rows={2} value={rxDocIndication}
              onChange={e=>setRxDocIndication(e.target.value)}
              placeholder="Diagnóstico o motivo de la solicitud..."/>
          </div>
          <div>
            <label className="label">Observaciones</label>
            <textarea className="input resize-none text-sm" rows={2} value={rxDocObservations}
              onChange={e=>setRxDocObservations(e.target.value)}
              placeholder="Indicaciones especiales para el técnico..."/>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-between items-center gap-3 flex-wrap">
          <button className="btn-secondary" onClick={()=>setRxDocModal(false)}>Cancelar</button>
          <div className="flex gap-2">
            <button disabled={rxDocPdfSending||!rxDocUserId} onClick={async()=>{
              setRxDocPdfSending(true);
              try {
                const professional = users.find(u=>u.id===rxDocUserId);
                const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
                const fullName = `${patient.firstName} ${patient.lastName}`;
                const bodyHtml = buildRadiografiaBody({
                  professionalName: professional?.name??"",
                  professionalRut:  professional?.rut??"",
                  patientName: fullName,
                  patientRut:  patient.rut,
                  patientBirthDate: patient.birthDate?patient.birthDate.split("T")[0]:undefined,
                  date: today,
                  items: rxDocItems.filter(i=>i.type.trim()),
                  indication: rxDocIndication,
                  observations: rxDocObservations,
                }, "/LOGO.jpeg");
                setRxDocModal(false);
                const win = window.open("","_blank","width=860,height=1100");
                if(win){ win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Solicitud Rx</title><style>@page{margin:14mm;size:A4 portrait}*{box-sizing:border-box}body{font-family:'Times New Roman',Times,serif;font-size:11px;color:#1a1a1a;margin:0}b{font-weight:bold}@media print{.noprint{display:none!important}}</style></head><body>${bodyHtml}<button class="noprint" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:#1f4e79;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:sans-serif">🖨 Imprimir / PDF</button></body></html>`); win.document.close(); }
              } catch(e){ showToast(`❌ Error: ${String(e)}`); }
              setRxDocPdfSending(false);
            }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium disabled:opacity-40">
              <Printer size={13}/> {rxDocPdfSending?"Generando...":"Imprimir / PDF"}
            </button>
            <button disabled={rxDocPdfSending||!rxDocUserId||!patient.email} onClick={async()=>{
              if(!patient.email){ showToast("❌ El paciente no tiene email"); return; }
              setRxDocPdfSending(true);
              try {
                const professional = users.find(u=>u.id===rxDocUserId);
                const today = new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
                const fullName = `${patient.firstName} ${patient.lastName}`;
                const bodyHtml = buildRadiografiaBody({
                  professionalName: professional?.name??"",
                  professionalRut:  professional?.rut??"",
                  patientName: fullName,
                  patientRut:  patient.rut,
                  patientBirthDate: patient.birthDate?patient.birthDate.split("T")[0]:undefined,
                  date: today,
                  items: rxDocItems.filter(i=>i.type.trim()),
                  indication: rxDocIndication,
                  observations: rxDocObservations,
                }, "/LOGO.jpeg");
                const pdfBase64 = await generatePdfBase64(bodyHtml);
                const filename  = `SolicitudRx_${patient.firstName}_${patient.lastName}`;
                const bodyText  = `Estimado/a ${fullName}, adjuntamos su solicitud de radiografía/scanner. Saludos, Clínica Magna.`;
                const r = await fetch("/api/send-document", { method:"POST", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ pdfBase64, to:patient.email, subject:"Solicitud de Radiografía / Scanner", filename, patientName:fullName, bodyText }) });
                const d = await r.json();
                showToast(d.ok?"✅ Solicitud enviada por email":`❌ ${d.error}`);
                setRxDocModal(false);
              } catch(e){ showToast(`❌ Error: ${String(e)}`); }
              setRxDocPdfSending(false);
            }}
              title={!patient.email?"El paciente no tiene email":undefined}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
              <Mail size={13}/> Enviar por email
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL RECETA MÉDICA ===== */}
      <Modal open={rxModal} onClose={()=>setRxModal(false)} title="Receta Médica" size="lg">
        <div className="p-4 sm:p-6 space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <button onClick={()=>setRxItems(i=>[...i,{drug:"",dose:"",freq:"",duration:"",route:"oral",instructions:"",qty:""}])}
                className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Plus size={12}/> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {rxItems.map((item,i)=>(
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  {/* Fármaco (full width) */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Fármaco *</label>
                      <input className="input mt-0.5" value={item.drug}
                        onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,drug:e.target.value}:x))}
                        placeholder="Amoxicilina 500mg" />
                    </div>
                    {rxItems.length > 1 && (
                      <button onClick={()=>setRxItems(its=>its.filter((_,j)=>j!==i))}
                        className="mt-5 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 flex-shrink-0">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                  {/* Dosis + Frecuencia */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Dosis</label>
                      <input className="input mt-0.5" value={item.dose}
                        onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,dose:e.target.value}:x))}
                        placeholder="1 comprimido" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Frecuencia</label>
                      <input className="input mt-0.5" value={item.freq}
                        onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,freq:e.target.value}:x))}
                        placeholder="c/8h" />
                    </div>
                  </div>
                  {/* Duración + Vía */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Duración</label>
                      <input className="input mt-0.5" value={item.duration}
                        onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,duration:e.target.value}:x))}
                        placeholder="7 días" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Vía</label>
                      <select className="input mt-0.5" value={item.route}
                        onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,route:e.target.value}:x))}>
                        <option value="oral">Oral</option>
                        <option value="topica">Tópica</option>
                        <option value="inyectable">Inyectable</option>
                        <option value="sublingual">Sublingual</option>
                      </select>
                    </div>
                  </div>
                  {/* Cantidad + Instrucciones */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Cantidad total</label>
                    <input className="input mt-0.5" value={item.qty||""}
                      onChange={e=>setRxItems(its=>its.map((x,j)=>j===i?{...x,qty:e.target.value}:x))}
                      placeholder="Ej: 21 comprimidos, 1 frasco..." />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Instrucciones adicionales</label>
                    <input className="input mt-0.5" value={item.instructions}
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3 flex-wrap">
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
          <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            onClick={emailPdfRx}
            disabled={rxPdfSending||!rxUserId||rxItems.every(m=>!m.drug.trim())}>
            <Mail size={15}/> {rxPdfSending?"Enviando...":"Enviar PDF"}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3">
          <button className="btn-secondary" onClick={()=>setPayModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={savePay} disabled={paySaving||!payItems.some(p=>parseFloat(p.amount)>0)}>
            {paySaving?"Guardando...":"Registrar Pago"}
          </button>
        </div>
      </Modal>

      {/* ===== MODAL INSTRUCCIONES DE CUIDADOS ===== */}
      <Modal open={cuidadosModal} onClose={()=>setCuidadosModal(false)} title="Instrucciones de Cuidados" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3 flex-wrap">
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
          <button className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
            onClick={emailPdfCuidados}
            disabled={carePdfSending||!cuidadosText.trim()}>
            <Mail size={15}/> {carePdfSending?"Enviando...":"Enviar PDF"}
          </button>
          <button className="flex items-center gap-2 btn-primary" onClick={printCuidados} disabled={!cuidadosUserId}>
            <Printer size={15}/> Imprimir instrucciones
          </button>
        </div>
      </Modal>

      {/* ===== MODAL EDITAR PACIENTE ===== */}
      <Modal open={editPatient} onClose={()=>setEditPatient(false)} title="Editar Datos del Paciente" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nombre</label><input className="input" value={editForm.firstName} onChange={e=>setEditForm(f=>({...f,firstName:e.target.value}))}/></div>
            <div><label className="label">Apellido</label><input className="input" value={editForm.lastName} onChange={e=>setEditForm(f=>({...f,lastName:e.target.value}))}/></div>
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input className="input" type="date" value={editForm.birthDate} onChange={e=>setEditForm(f=>({...f,birthDate:e.target.value}))}/>
              {editForm.birthDate && (
                <p className="text-xs text-primary-600 font-medium mt-1.5">
                  {Math.floor((Date.now()-new Date(editForm.birthDate+"T12:00:00").getTime())/(1000*60*60*24*365.25))} años
                </p>
              )}
            </div>
            <div>
              <label className="label">Teléfono <span className="text-slate-400 font-normal">(opcional)</span></label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-sm text-slate-600 font-medium select-none">+56</span>
                <input className="input rounded-l-none flex-1"
                  value={editForm.phone.replace(/^\+56/, "")}
                  onChange={e=>setEditForm(f=>({...f,phone:"+56"+e.target.value.replace(/^\+56/,"")}))}
                  placeholder="9 1234 5678"/>
              </div>
            </div>
            <div><label className="label">Email</label><input className="input" type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></div>
            <div><label className="label">Dirección</label><input className="input" value={editForm.address} onChange={e=>setEditForm(f=>({...f,address:e.target.value}))}/></div>
            <div><label className="label">Ciudad</label><input className="input" value={editForm.city} onChange={e=>setEditForm(f=>({...f,city:e.target.value}))}/></div>
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2"><label className="label">Notas</label><textarea className="input resize-none" rows={2} value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3">
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
                  <button onClick={()=>emailPdfBudget(db)} disabled={budgetPdfSending===db.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium disabled:opacity-40"><Mail size={13}/> {budgetPdfSending===db.id?"...":"Enviar PDF"}</button>
                  <button onClick={()=>sendBudgetWA(db)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"><MessageCircle size={13}/> WhatsApp</button>
                  <button onClick={()=>openBudgetEdit(db)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"><Pencil size={13}/> Editar</button>
                  {isAdmin && <button onClick={()=>deleteBudget(db.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"><Trash2 size={13}/> Eliminar</button>}
                </div>
              </div>
              {/* Patient + professional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <th className="text-center px-3 py-2.5 text-xs text-slate-500">Estado</th>
                    <th className="text-right px-4 py-2.5 text-xs text-slate-500">Total</th>
                  </tr></thead>
                  <tbody>{db.items.map(item=>(
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 hidden sm:table-cell">{item.tooth||item.area||"—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ITEM_STATUS[item.status||"pending"]?.color}`}>
                            {ITEM_STATUS[item.status||"pending"]?.label}
                          </span>
                          {item.status === "completed" && (
                            <button onClick={()=>updateItemStatus(item.id,"in_progress")}
                              title="Revertir a En proceso"
                              className="text-xs px-1.5 py-0.5 rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors flex-shrink-0">
                              Reactivar
                            </button>
                          )}
                          {item.status !== "completed" && (
                            <button onClick={()=>updateItemStatus(item.id,"completed")}
                              title="Marcar como Terminado"
                              className="text-xs px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex-shrink-0">
                              Terminado
                            </button>
                          )}
                        </div>
                      </td>
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
        const bDiscountAmount = Number(budgetForm.discount);
        const bTotal = bSubtotal - bDiscountAmount;
        return (
          <Modal open={budgetCreateOpen} onClose={()=>setBudgetCreateOpen(false)} title={budgetEditId?"Editar Presupuesto":"Nuevo Presupuesto"} size="xl">
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">

              {/* ── Profesional + Fechas ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* ── Convenio ── */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex-shrink-0">Convenio</span>
                {convenios.length === 0 ? (
                  <span className="text-xs text-emerald-600 italic">Sin convenios — <a href="/administracion/convenios" className="underline">crear en Administración</a></span>
                ) : (
                  <select className="select flex-1 py-1.5 text-sm bg-white border-emerald-300"
                    defaultValue=""
                    onChange={e=>{
                      const cv = convenios.find(c=>c.id===e.target.value);
                      if(cv) applyConvenioBudget(cv);
                      e.target.value="";
                    }}>
                    <option value="">Seleccionar convenio para aplicar descuento...</option>
                    {convenios.map(c=>(
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.discountType==="pct"?`${c.discount}%`:fmt(c.discount)} descuento
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ── Ítems ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">Tratamientos</p>
                  <button onClick={()=>setBudgetItems(its=>[...its,{description:"",tooth:"",area:"",quantity:1,unitPrice:0,discount:0,total:0}])}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors border border-primary-200">
                    <Plus size={13}/> Agregar ítem
                  </button>
                </div>
                <div className="space-y-3">
                  {budgetItems.map((item,i)=>(
                    <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Item header */}
                      <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                        <div className="flex-1 relative min-w-0">
                          <input className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border-none focus:ring-0 p-0"
                            value={item.description}
                            onChange={e=>updateBudgetItem(i,"description",e.target.value)}
                            onFocus={()=>setBudgetDropIdx(i)}
                            onBlur={()=>setTimeout(()=>setBudgetDropIdx(null),160)}
                            placeholder="Tratamiento..." autoComplete="off"/>
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
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center justify-between gap-2 border-b border-slate-50 last:border-0">
                                    <span className="font-medium text-slate-800">{t.name}</span>
                                    <span className="text-xs text-primary-600 font-semibold flex-shrink-0">{fmt(t.price)}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {budgetItems.length > 1 && (
                          <button onClick={()=>setBudgetItems(its=>its.filter((_,j)=>j!==i))}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                      {/* Item body */}
                      <div className="px-4 py-3 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Diente</label>
                            <input className="input py-1.5 text-sm text-center" value={item.tooth} onChange={e=>updateBudgetItem(i,"tooth",e.target.value)} placeholder="16, 17..."/>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Área</label>
                            <select className="select py-1.5 text-sm" value={item.area} onChange={e=>updateBudgetItem(i,"area",e.target.value)}>
                              {["","Maxilar superior","Maxilar inferior","Ambos maxilares","Anterior superior","Anterior inferior","Posterior superior","Posterior inferior"].map(a=><option key={a} value={a}>{a||"—"}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 items-end">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Cant.</label>
                            <input className="input py-1.5 text-sm text-center" type="number" min="1" value={item.quantity}
                              onChange={e=>updateBudgetItem(i,"quantity",parseInt(e.target.value)||1)}/>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">P. Unit ($)</label>
                            <input className="input py-1.5 text-sm text-right" type="number" min="0" value={item.unitPrice}
                              onChange={e=>updateBudgetItem(i,"unitPrice",parseFloat(e.target.value)||0)}/>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Dto. (%)</label>
                            <input className="input py-1.5 text-sm text-right" type="number" min="0" max="100" value={item.discount}
                              onChange={e=>updateBudgetItem(i,"discount",parseFloat(e.target.value)||0)}/>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Total</label>
                            <div className={`input py-1.5 text-sm text-right font-bold bg-slate-50 ${item.discount>0?"text-primary-700":"text-slate-800"}`}>
                              {fmt(item.total)}
                            </div>
                          </div>
                        </div>
                        {item.discount > 0 && (
                          <p className="text-xs text-slate-400">
                            Original: <span className="line-through">{fmt(item.quantity*item.unitPrice)}</span>
                            {" "}— Ahorro {item.discount}%: <span className="text-red-500">-{fmt(item.quantity*item.unitPrice*item.discount/100)}</span>
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
                    <span>Subtotal</span><span className="font-medium">{fmt(bSubtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 flex-shrink-0">Descuento ($)</span>
                    <input className="input py-1 text-right ml-auto w-28 text-sm" type="number" min="0"
                      value={budgetForm.discount}
                      onChange={e=>setBudgetForm(f=>({...f,discount:parseFloat(e.target.value)||0}))}/>
                  </div>
                  {bDiscountAmount > 0 && (
                    <div className="flex justify-between text-red-600 text-xs">
                      <span>Ahorro</span><span>-{fmt(bDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-2.5 text-slate-900">
                    <span>Total</span><span>{fmt(bTotal)}</span>
                  </div>
                </div>
              </div>

              <div><label className="label">Observaciones</label><textarea className="input resize-none" rows={2} value={budgetForm.notes} onChange={e=>setBudgetForm(f=>({...f,notes:e.target.value}))} placeholder="Notas adicionales..."/></div>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end gap-2 sm:gap-3">
          <button className="btn-secondary" onClick={()=>setPayEditId(null)}>Cancelar</button>
          <button className="btn-primary" onClick={savePayEdit} disabled={payEditSaving||!payEditForm.amount}>{payEditSaving?"Guardando...":"Guardar cambios"}</button>
        </div>
      </Modal>

      {/* ===== DIÁLOGO: PEDIR EMAIL PARA PDF ===== */}
      {emailDlg.open && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4" onClick={()=>setEmailDlg(d=>({...d,open:false}))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2"><Mail size={16} className="text-indigo-600"/> Enviar documento como PDF</h3>
            <p className="text-sm text-slate-500 mb-4">El PDF se enviará desde <span className="font-medium">administracion@clinicamagna.cl</span></p>
            <label className="label">Email del destinatario</label>
            <input
              className="input mb-4"
              type="email"
              placeholder="paciente@email.com"
              value={emailDlg.to}
              onChange={e=>setEmailDlg(d=>({...d,to:e.target.value}))}
              autoFocus
              onKeyDown={e=>{ if(e.key==="Enter" && emailDlg.to.includes("@")) doEmailSend(); if(e.key==="Escape") setEmailDlg(d=>({...d,open:false})); }}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={()=>setEmailDlg(d=>({...d,open:false}))}>Cancelar</button>
              <button className="btn-primary" onClick={doEmailSend} disabled={!emailDlg.to.includes("@")}>
                <Mail size={14}/> Enviar PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
