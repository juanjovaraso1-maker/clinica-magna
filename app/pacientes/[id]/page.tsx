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
import BudgetEditor from "@/components/budgets/BudgetEditor";
import { buildRecetaBody, buildPresupuestoBody, buildIndicacionesBody } from "@/lib/pdf-templates";
import { useIsAdmin } from "@/hooks/useRole";
import { useSession } from "next-auth/react";

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
  evolutions: Array<{ id:string; date:string; diagnosis:string; treatment:string; tooth:string; observations:string; cost:number; user:{id:string;name:string} }>;
  budgets: Array<{ id:string; number:number; date:string; validUntil:string; status:string; subtotal:number; total:number; discount:number; notes:string; items:BudgetItem[]; payments:Array<{id:string;amount:number;date:string;method:string;notes:string}>; user:{id:string;name:string} }>;
  payments: Array<{ id:string; date:string; amount:number; method:string; notes:string; reference?:string; budget?:{number:number} }>;
  appointments: Array<{ id:string; date:string; startTime:string; type:string; status:string; user:{name:string} }>;
  documents: Array<{ id:string; name:string; type:string; fileName:string; mimeType:string; size:number; createdAt:string }>;
}

const TABS = ["Historial","Ficha Clínica","Odontograma","Estética Facial","Evoluciones","Recetas","Presupuestos","Radiografías","Pagos","Documentos","Citas"];

function fmt(n:number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }
function fmtShort(n:number) { const abs=Math.abs(n); const sign=n<0?"-":""; if(abs>=1000000) return `${sign}$${(abs/1000000).toFixed(1)}M`; if(abs>=1000) return `${sign}$${Math.round(abs/1000)}K`; return fmt(n); }

interface RxFormData {
  rxi_periapical:boolean; rxi_piezas:string;
  rxi_total:boolean;
  rxi_bitewing:boolean; rxi_bitewingDer:boolean; rxi_bitewingIzq:boolean;
  rxi_mailCon:boolean; rxi_mailSin:boolean;
  rxe_panoramica:boolean;
  rxe_telerLateral:boolean; rxe_telerAntero:boolean;
  rxe_manoCarpo:boolean;
  rxe_mailCon:boolean; rxe_mailSin:boolean;
  sc_arcadaSup:boolean; sc_mordidaMIC:boolean; sc_STL:boolean;
  sc_arcadaInf:boolean; sc_invisalign:boolean; sc_PLY:boolean;
  sc_mail:boolean;
  cb_maxilarSup:boolean; cb_paraEvaluar:string; cb_implantes:boolean;
  cb_mandibula:boolean; cb_tercerosMolares:boolean; cb_cortesPDF:boolean;
  cb_zona:string; cb_fractura:boolean; cb_visualizadorCD:boolean;
  cb_zonaMax3:boolean; cb_dienteIncluido:boolean; cb_DICOM:boolean;
  cb_ATM:boolean; cb_bocaAbierta:boolean; cb_bocaCerrada:boolean; cb_wetransfer:boolean;
  cb_mailCon:boolean; cb_mailSin:boolean;
  cef_ricketts:boolean; cef_rothJarabak:boolean; cef_steiner:boolean;
  cef_mcnamara:boolean; cef_roth:boolean; cef_sassouniPlus:boolean;
  cef_tweed:boolean; cef_otro:string;
  foto_clinicas:boolean; foto_overjet:boolean;
  foto_setPDF:boolean; foto_unitarias:boolean;
  meInteresa:string;
}
const EMPTY_RX_FORM: RxFormData = {
  rxi_periapical:false, rxi_piezas:"",
  rxi_total:false,
  rxi_bitewing:false, rxi_bitewingDer:false, rxi_bitewingIzq:false,
  rxi_mailCon:false, rxi_mailSin:false,
  rxe_panoramica:false,
  rxe_telerLateral:false, rxe_telerAntero:false,
  rxe_manoCarpo:false,
  rxe_mailCon:false, rxe_mailSin:false,
  sc_arcadaSup:false, sc_mordidaMIC:false, sc_STL:false,
  sc_arcadaInf:false, sc_invisalign:false, sc_PLY:false,
  sc_mail:false,
  cb_maxilarSup:false, cb_paraEvaluar:"", cb_implantes:false,
  cb_mandibula:false, cb_tercerosMolares:false, cb_cortesPDF:false,
  cb_zona:"", cb_fractura:false, cb_visualizadorCD:false,
  cb_zonaMax3:false, cb_dienteIncluido:false, cb_DICOM:false,
  cb_ATM:false, cb_bocaAbierta:false, cb_bocaCerrada:false, cb_wetransfer:false,
  cb_mailCon:false, cb_mailSin:false,
  cef_ricketts:false, cef_rothJarabak:false, cef_steiner:false,
  cef_mcnamara:false, cef_roth:false, cef_sassouniPlus:false,
  cef_tweed:false, cef_otro:"",
  foto_clinicas:false, foto_overjet:false,
  foto_setPDF:false, foto_unitarias:false,
  meInteresa:"",
};

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
  const { data: session } = useSession();
  const sessionUserId = (session?.user as any)?.id ?? "";
  const [patient, setPatient] = useState<Patient|null>(null);
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<Array<{id:string;name:string;rut?:string;signatureUrl?:string}>>([]);
  const [evoModal, setEvoModal] = useState(false);
  const [evoForm, setEvoForm] = useState({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:"", treatment:"", isPrivate:false });
  const [evoBudgetSelections, setEvoBudgetSelections] = useState<Record<string,{selected:boolean;newStatus:string}>>({});
  const [evoReminder, setEvoReminder] = useState(0);
  const [rxDocModal, setRxDocModal] = useState(false);
  const [rxDocUserId, setRxDocUserId] = useState("");
  const [rxForm, setRxForm] = useState<RxFormData>({...EMPTY_RX_FORM});
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
  const [odontograms, setOdontograms] = useState<any[]>([]);
  const [odontogram, setOdontogram] = useState<any>({});
  const [facial, setFacial] = useState<any>({});
  const [oSaving, setOSaving] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Array<{id:string;date:string;type:string;content:string;user:{id:string;name:string};createdAt:string}>>([]);
  const [rxTabType, setRxTabType] = useState<"recipe"|"care">("recipe");
  const [rxFreeForm, setRxFreeForm] = useState({ userId:"", date:new Date().toISOString().split("T")[0], content:"" });
  const [rxFreeSaving, setRxFreeSaving] = useState(false);
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
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [budgetEditorEditId, setBudgetEditorEditId] = useState<string|null>(null);
  const [editBudgetNameId, setEditBudgetNameId] = useState<string|null>(null);
  const [editBudgetNameVal, setEditBudgetNameVal] = useState("");
  const [budgetForm, setBudgetForm] = useState({ userId:"", date:new Date().toISOString().split("T")[0], validUntil:new Date(Date.now()+30*86400000).toISOString().split("T")[0], status:"pending", discount:0, notes:"" });
  const [budgetItems, setBudgetItems] = useState([{ description:"", tooth:"", area:"", quantity:1, unitPrice:0, discount:0, total:0 }]);
  const [budgetEditId, setBudgetEditId] = useState<string|null>(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
const [payEditId, setPayEditId] = useState<string|null>(null);
  const [payEditForm, setPayEditForm] = useState({ date:"", amount:"", method:"efectivo", notes:"" });
  const [payEditSaving, setPayEditSaving] = useState(false);
  const [budgetDropIdx, setBudgetDropIdx] = useState<number|null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [evoEditModal,  setEvoEditModal]  = useState(false);
  const [evoEditId,     setEvoEditId]     = useState<string|null>(null);
  const [evoEditForm,   setEvoEditForm]   = useState({ date:"", diagnosis:"", treatment:"", tooth:"", observations:"", cost:"0", userId:"" });
  const [evoEditSaving, setEvoEditSaving] = useState(false);
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
    if (or_.ok) setOdontograms(await or_.json());
    if (fr.ok) setFacial(await fr.json());
    const rxr = await fetch(`/api/prescriptions?patientId=${id}`);
    if (rxr.ok) setPrescriptions(await rxr.json());
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

  async function saveBudgetName(budgetId: string) {
    await fetch(`/api/budgets/${budgetId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes:editBudgetNameVal})});
    setEditBudgetNameId(null);
    load();
  }

  function openBudgetCreate() {
    setBudgetEditorEditId(null);
    setBudgetEditorOpen(true);
    setTab(6);
  }

  function openBudgetEdit(b: Patient["budgets"][0]) {
    setBudgetForm({ userId:b.user.id, date:b.date, validUntil:b.validUntil??"", status:b.status, discount:b.discount, notes:b.notes??"" });
    setBudgetItems(b.items.map(i => ({ description:i.description, tooth:i.tooth??"", area:i.area??"", quantity:i.quantity, unitPrice:i.unitPrice, discount:i.discount??0, total:i.total })));
    setBudgetEditId(b.id);
    setBudgetEditorEditId(b.id);
    setBudgetDetailId(null);
    setBudgetEditorOpen(true);
    setTab(6);
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

  useEffect(() => {
    if (!sessionUserId) return;
    setRxFreeForm(f => f.userId ? f : { ...f, userId: sessionUserId });
    setEvoForm(f => f.userId ? f : { ...f, userId: sessionUserId });
    setBudgetForm(f => f.userId ? f : { ...f, userId: sessionUserId });
    setRxDocUserId(v => v || sessionUserId);
    setRxUserId(v => v || sessionUserId);
    setCuidadosUserId(v => v || sessionUserId);
  }, [sessionUserId]);

  function openEvoModal() {
    if (!patient) return;
    const selections: Record<string,{selected:boolean;newStatus:string}> = {};
    patient.budgets.filter(b => b.status !== "rejected").forEach(b => {
      (b.items ?? []).filter(i => i.status !== "completed").forEach(item => {
        selections[item.id] = { selected:false, newStatus: item.status || "in_progress" };
      });
    });
    setEvoBudgetSelections(selections);
    setEvoForm({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:sessionUserId, treatment:"", isPrivate:false });
    setEvoReminder(0);
    setEvoModal(true);
  }

  async function saveEvo() {
    if (!evoForm.userId) return;
    setSaving(true);
    const selectedEntries = Object.entries(evoBudgetSelections).filter(([,v]) => v.selected);
    const allItems = patient!.budgets.flatMap(b => b.items);

    if (selectedEntries.length > 0) {
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
    } else {
      const treatmentText = evoForm.treatment.trim() || evoForm.diagnosis.trim() || "Consulta";
      await fetch("/api/evolutions", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ patientId:id, date:evoForm.date, diagnosis:evoForm.diagnosis,
          treatment:treatmentText, tooth:"", observations:evoForm.observations,
          cost:0, userId:evoForm.userId }) });
    }

    setEvoModal(false);
    setEvoBudgetSelections({});
    setEvoForm({ date:new Date().toISOString().split("T")[0], diagnosis:"", observations:"", userId:sessionUserId, treatment:"", isPrivate:false });
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

  function openEvoEdit(e: Patient["evolutions"][0]) {
    setEvoEditId(e.id);
    setEvoEditForm({ date:e.date, diagnosis:e.diagnosis||"", treatment:e.treatment, tooth:e.tooth||"", observations:e.observations||"", cost:String(e.cost), userId:e.user.id });
    setEvoEditModal(true);
  }

  async function saveEvoEdit() {
    if (!evoEditId) return;
    setEvoEditSaving(true);
    await fetch("/api/evolutions", { method:"PUT", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ id:evoEditId, date:evoEditForm.date, diagnosis:evoEditForm.diagnosis, treatment:evoEditForm.treatment, tooth:evoEditForm.tooth, observations:evoEditForm.observations, cost:parseFloat(evoEditForm.cost)||0, userId:evoEditForm.userId }) });
    setEvoEditModal(false); setEvoEditId(null); setEvoEditSaving(false);
    load(); showToast("✅ Evolución actualizada");
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
    return `
<div style="background:#1A1D2E;padding:16px 18px;display:flex;align-items:center;gap:16px;margin-bottom:0">
  <div style="background:white;border-radius:8px;padding:4px;flex-shrink:0">
    <img src="${logoBase}" style="width:60px;height:55px;object-fit:contain;display:block" onerror="this.style.display='none'"/>
  </div>
  <div style="flex:1">
    <div style="font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px">${name}</div>
    <div style="font-size:11px;color:#CBD5E1;margin-top:2px">${sub}</div>
    ${l1?`<div style="font-size:8.5px;color:#94A3B8;margin-top:5px">${l1}</div>`:""}
    ${l2?`<div style="font-size:8.5px;color:#94A3B8">${l2}</div>`:""}
  </div>
</div>
<div style="height:3px;background:#C9A84C;margin-bottom:18px"></div>`;
  }

  function buildDocProfPat(prof:{name:string;rut?:string;showRut?:boolean}, extra:{label:string;value:string}[]): string {
    const showRut = prof.showRut !== false;
    return `
<div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;padding:14px;margin:14px 0">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:20px">
        <div style="font-size:10px;font-weight:bold;color:#1A1D2E;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #C9A84C;margin-bottom:6px;padding-bottom:3px">PROFESIONAL</div>
        <div style="font-size:11px"><b>Nombre:</b> ${prof.name}</div>
        ${showRut&&prof.rut?`<div style="font-size:11px"><b>RUT:</b> ${prof.rut}</div>`:""}
      </td>
      <td style="width:50%;vertical-align:top">
        <div style="font-size:10px;font-weight:bold;color:#1A1D2E;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid #C9A84C;margin-bottom:6px;padding-bottom:3px">PACIENTE</div>
        ${extra.map(e=>`<div style="font-size:11px"><b>${e.label}:</b> ${e.value}</div>`).join("")}
      </td>
    </tr>
  </table>
</div>`;
  }

  function buildDocSignature(name:string, rut?:string, signatureUrl?:string): string {
    return `
<div style="margin-top:50px;display:flex;justify-content:center">
  <div style="text-align:center;min-width:200px">
    ${signatureUrl
      ? `<img src="${signatureUrl}" style="height:80px;max-width:200px;object-fit:contain;display:block;margin:0 auto 4px"/>`
      : `<div style="height:80px"></div>`}
    <div style="border-top:1.5px solid #374151;padding-top:8px;margin-top:4px">
      <div style="font-size:11px;font-weight:bold;color:#1A1D2E">${name}</div>
      ${rut ? `<div style="font-size:10px;color:#6B7280">RUT: ${rut}</div>` : ""}
      <div style="font-size:10px;color:#6B7280">Clínica Magna</div>
    </div>
  </div>
</div>`;
  }

  function buildClinicFooter(): string {
    const addr = clinicCfg.clinic_address  || "Badajoz 100 Of. 918, Las Condes";
    const phone= clinicCfg.clinic_phone    || "+56 9 6279 3952";
    const mail = clinicCfg.clinic_email    || "administracion@clinicamagna.cl";
    const web  = clinicCfg.clinic_website  || "www.clinicamagna.cl";
    const name = (clinicCfg.clinic_name || "Clínica Magna").toUpperCase();
    return `
<div style="margin-top:32px;border-top:2px solid #C9A84C;padding-top:10px;text-align:center">
  <div style="font-size:8.5px;color:#9CA3AF">${name} &nbsp;|&nbsp; ${addr} &nbsp;|&nbsp; ${phone} &nbsp;|&nbsp; ${mail} &nbsp;|&nbsp; ${web}</div>
</div>`;
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
    const thStyle = `padding:6px 7px;border:1px solid #1A1D2E;font-size:10px;text-align:center;background:#1A1D2E;color:white;font-weight:bold`;
    const medRows = meds.map((m,i)=>`
      <tr style="background:${i%2===0?"#fff":"#F8F9FB"}">
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px;font-weight:bold">${i+1}</td>
        <td style="padding:5px 7px;border:1px solid #E5E7EB;font-size:10px;font-weight:bold;text-transform:uppercase">${m.drug}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${m.dose||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${m.freq||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${m.duration||""}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${m.qty||""}</td>
      </tr>
      ${m.instructions?`<tr style="background:#f8f9fa"><td></td><td colspan="5" style="padding:3px 7px 6px;border:1px solid #E5E7EB;font-size:9.5px;font-style:italic;color:#555">Indicación: ${m.instructions}</td></tr>`:""}
    `).join("");
    return `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#1A1D2E;text-transform:uppercase">RECETA MÉDICA ODONTOLÓGICA</div>
      </div>
      ${buildDocProfPat({name:professional?.name||"",rut:professional?.rut||""}, [
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT / Fecha nac.",value:`${patient.rut}${fmtBD?" / "+fmtBD:""}`},
        {label:"Fecha",value:today}
      ])}
      <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
        <thead><tr>
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
        <div style="font-size:11px;font-weight:bold;color:#1A1D2E;margin-bottom:5px">DIAGNÓSTICO / INDICACIÓN:</div>
        <div style="border:1px solid #E5E7EB;min-height:44px;padding:8px;background:#fff;font-size:10px"></div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:bold;color:#1A1D2E;margin-bottom:5px">OBSERVACIONES:</div>
        <div style="border:1px solid #E5E7EB;min-height:44px;padding:8px;background:#fff;font-size:10px">${rxNotes||""}</div>
      </div>
      ${buildDocSignature(professional?.name||"", professional?.rut, professional?.signatureUrl)}
      ${buildClinicFooter()}`;
  }

  function printRx() {
    if (!patient) return;
    openDocWindow("Receta Médica", buildRxDocBody());
  }

  function buildRxRequestHtml(f: RxFormData, professional: {name:string;rut?:string}|undefined): string {
    if (!patient) return "";
    const today = new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric"});
    const chk = (v:boolean) => v
      ? `<span style="display:inline-block;width:18px;height:18px;border:1.5px solid #1f4e79;border-radius:2px;background:#1f4e79;color:white;font-size:15px;line-height:18px;text-align:center;vertical-align:middle">✓</span>`
      : `<span style="display:inline-block;width:18px;height:18px;border:1.5px solid #999;border-radius:2px;background:white;vertical-align:middle"></span>`;

    const secHdr = (title:string, bg:string) =>
      `<tr style="background:${bg}">
        <td colspan="3" style="padding:4px 8px;font-weight:bold;font-size:16px;letter-spacing:.5px;border:1px solid #bbb">${title}</td>
      </tr>
      <tr style="background:#e8e8e8">
        <td style="padding:3px 8px;font-size:14px;font-weight:bold;border:1px solid #bbb;width:55%">PROCEDIMIENTO</td>
        <td style="padding:3px 8px;font-size:14px;font-weight:bold;border:1px solid #bbb;text-align:center;width:22%">Con Informe</td>
        <td style="padding:3px 8px;font-size:14px;font-weight:bold;border:1px solid #bbb;text-align:center;width:23%">Sin Informe / Envío Mail</td>
      </tr>`;

    const row = (label:string, isChecked:boolean, col1:string="", col2:string="") =>
      `<tr>
        <td style="padding:4px 8px;font-size:15px;border:1px solid #ddd">${chk(isChecked)} ${label}</td>
        <td style="padding:4px 8px;font-size:15px;border:1px solid #ddd;text-align:center">${col1}</td>
        <td style="padding:4px 8px;font-size:15px;border:1px solid #ddd;text-align:center">${col2}</td>
      </tr>`;

    const noMailRow = (label:string, isChecked:boolean) =>
      `<tr>
        <td colspan="3" style="padding:4px 8px;font-size:15px;border:1px solid #ddd">${chk(isChecked)} ${label}</td>
      </tr>`;

    const addr = "Badajoz 100 Of. 918, Las Condes";
    const phone = "+56 9 6279 3952";
    const email = "contacto@clinicamagna.cl";
    const web   = "www.clinicamagna.cl";

    return `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;font-size:16px">

        <!-- HEADER -->
        <div style="background:#1A1D2E;padding:16px 18px;display:flex;align-items:center;gap:16px;margin-bottom:0">
          <div style="background:white;border-radius:8px;padding:4px;flex-shrink:0">
            <img src="/LOGO.jpeg" style="width:56px;height:52px;object-fit:contain;display:block" onerror="this.style.display='none'"/>
          </div>
          <div style="flex:1">
            <div style="font-size:22px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px">CLÍNICA MAGNA</div>
            <div style="font-size:13px;color:#CBD5E1;margin-top:2px">Odontología y Estética Facial</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:4px">${addr} &nbsp;|&nbsp; WHATSAPP ${phone} &nbsp;|&nbsp; ${email} &nbsp;|&nbsp; ${web}</div>
          </div>
          <div style="text-align:right;background:#C9A84C;color:#1A1D2E;padding:10px 16px;border-radius:6px;flex-shrink:0">
            <div style="font-size:17px;font-weight:bold">SOLICITUD DE</div>
            <div style="font-size:17px;font-weight:bold">RADIOGRAFÍA / SCANNER</div>
            <div style="font-size:13px;margin-top:3px">${today}</div>
          </div>
        </div>
        <div style="height:3px;background:#C9A84C;margin-bottom:10px"></div>

        <!-- PROFESIONAL / PACIENTE -->
        <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;padding:12px;margin-bottom:10px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:16px">
                <div style="font-size:12px;font-weight:bold;color:#1A1D2E;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #C9A84C;margin-bottom:5px;padding-bottom:3px">PROFESIONAL</div>
                <div style="font-size:17px;font-weight:bold;color:#1a1a1a">${professional?.name||"—"}</div>
                ${professional?.rut?`<div style="font-size:14.5px;color:#555">RUT: ${professional.rut}</div>`:""}
              </td>
              <td style="width:50%;vertical-align:top">
                <div style="font-size:12px;font-weight:bold;color:#1A1D2E;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid #C9A84C;margin-bottom:5px;padding-bottom:3px">PACIENTE</div>
                <div style="font-size:17px;font-weight:bold;color:#1a1a1a">${patient.firstName} ${patient.lastName}</div>
                <div style="font-size:14.5px;color:#555">RUT: ${patient.rut} &nbsp;·&nbsp; Fecha: ${today}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- TABLAS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          ${secHdr("RX INTRAORAL","#dce8f5")}
          ${row(`Periapical Digital${f.rxi_piezas?` — Piezas: <strong>${f.rxi_piezas}</strong>`:" — Piezas: _______"}`,f.rxi_periapical, chk(f.rxi_mailCon), chk(f.rxi_mailSin))}
          ${row("RX Total",f.rxi_total, chk(f.rxi_mailCon), chk(f.rxi_mailSin))}
          ${row(`Bitewing${f.rxi_bitewingDer?" — Derecha":""}${f.rxi_bitewingIzq?" — Izquierda":""}`,f.rxi_bitewing, chk(f.rxi_mailCon), chk(f.rxi_mailSin))}

          ${secHdr("RX EXTRAORAL","#fdefd8")}
          ${row("Panorámica",f.rxe_panoramica, chk(f.rxe_mailCon), chk(f.rxe_mailSin))}
          ${row(`Telerradiografía${f.rxe_telerLateral?" — Lateral":""}${f.rxe_telerAntero?" — Anteroposterior":""}`,f.rxe_telerLateral||f.rxe_telerAntero, chk(f.rxe_mailCon), chk(f.rxe_mailSin))}
          ${row("RX Mano/Carpo",f.rxe_manoCarpo, chk(f.rxe_mailCon), chk(f.rxe_mailSin))}

          ${secHdr("SCANNER INTRAORAL (ITERO-INVISALIGN)","#d8f5e4")}
          ${noMailRow(`Arcada superior${f.sc_mordidaMIC?" — Mordida en MIC":""}${f.sc_STL?" — STL":""}`,f.sc_arcadaSup)}
          ${noMailRow(`Arcada inferior${f.sc_invisalign?" — Asociar Invisalign Doctor":""}${f.sc_PLY?" — PLY":""}`,f.sc_arcadaInf)}

          ${secHdr("TOMOGRAFÍA - CONE BEAM","#fce8e8")}
          ${row(`Scanner Maxilar Superior — Para Evaluar: ${f.cb_paraEvaluar||"_______"}${f.cb_implantes?" — Implantes":""}`,f.cb_maxilarSup, chk(f.cb_mailCon), chk(f.cb_mailSin))}
          ${row(`Scanner Mandíbula${f.cb_tercerosMolares?" — Terceros Molares":""}${f.cb_cortesPDF?" — Cortes en PDF":""}`,f.cb_mandibula, chk(f.cb_mailCon), chk(f.cb_mailSin))}
          ${row(`Scanner Zona: ${f.cb_zona||"_______"}${f.cb_fractura?" — Fractura":""}`,!!(f.cb_zona||f.cb_fractura), chk(f.cb_mailCon), chk(f.cb_mailSin))}
          ${noMailRow(`ATM${f.cb_bocaAbierta?" — Boca Abierta":""}${f.cb_bocaCerrada?" — Boca Cerrada":""}${f.cb_wetransfer?" — Wetransfer":""}`,f.cb_ATM)}
        </table>

        <!-- ANÁLISIS CEFALOMÉTRICOS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          <tr style="background:#ece8f5">
            <td style="padding:4px 8px;font-weight:bold;font-size:16px;border:1px solid #bbb">ANÁLISIS CEFALOMÉTRICOS</td>
          </tr>
          <tr>
            <td style="padding:6px 8px;font-size:15px;border:1px solid #ddd;line-height:2">
              ${chk(f.cef_ricketts)} Ricketts &nbsp;&nbsp;
              ${chk(f.cef_rothJarabak)} Roth-Jarabak &nbsp;&nbsp;
              ${chk(f.cef_steiner)} Steiner &nbsp;&nbsp;
              ${chk(f.cef_mcnamara)} Mcnamara &nbsp;&nbsp;
              ${chk(f.cef_roth)} Roth &nbsp;&nbsp;
              ${chk(f.cef_sassouniPlus)} Sassouni Plus &nbsp;&nbsp;
              ${chk(f.cef_tweed)} Tweed &nbsp;&nbsp;
              Otro: <span style="border-bottom:1px solid #999;display:inline-block;min-width:80px;padding:0 4px">${f.cef_otro||""}</span>
            </td>
          </tr>
        </table>

        <!-- ESTUDIO DE FOTOS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
          <tr style="background:#f0f0e8">
            <td colspan="2" style="padding:4px 8px;font-weight:bold;font-size:16px;border:1px solid #bbb">ESTUDIO DE FOTOS</td>
          </tr>
          <tr>
            <td style="padding:6px 8px;font-size:15px;border:1px solid #ddd">
              ${chk(f.foto_clinicas)} Fotos Clínicas &nbsp;&nbsp;
              ${chk(f.foto_overjet)} Incluir Overjet
            </td>
            <td style="padding:6px 8px;font-size:15px;border:1px solid #ddd">
              ${chk(f.foto_setPDF)} Set en PDF &nbsp;&nbsp;
              ${chk(f.foto_unitarias)} Unitarias en JPG
            </td>
          </tr>
        </table>

        ${f.meInteresa ? `<div style="font-size:15px;border:1px solid #ccc;padding:5px 8px;margin-bottom:10px;background:#fffde7"><strong>ME INTERESA SABER:</strong> ${f.meInteresa}</div>` : ""}

        <!-- FIRMA -->
        <div style="margin-top:30px;display:flex;justify-content:center">
          <div style="text-align:center;min-width:200px">
            <div style="height:60px"></div>
            <div style="border-top:1.5px solid #374151;padding-top:8px;margin-top:4px">
              <div style="font-size:15px;font-weight:bold;color:#1A1D2E">${professional?.name||"—"}</div>
              ${professional?.rut?`<div style="font-size:13px;color:#6B7280">RUT: ${professional.rut}</div>`:""}
              <div style="font-size:13px;color:#6B7280">Clínica Magna</div>
            </div>
          </div>
        </div>
        <div style="margin-top:24px;border-top:2px solid #C9A84C;padding-top:8px;text-align:center">
          <div style="font-size:11px;color:#9CA3AF">CLÍNICA MAGNA &nbsp;|&nbsp; ${addr} &nbsp;|&nbsp; ${phone} &nbsp;|&nbsp; ${email} &nbsp;|&nbsp; ${web}</div>
        </div>
      </div>
    `;
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
      <div style="font-size:11px;font-weight:bold;color:#1A1D2E;margin:10px 0 7px;text-transform:uppercase;letter-spacing:0.3px">Indicaciones — ${cuidadosTemplate}:</div>
      ${contentHtml}
      ${isCustom?`<div style="margin-top:12px"><div style="font-size:11px;font-weight:bold;color:#555;margin-bottom:5px;text-transform:uppercase">Observaciones adicionales:</div><div style="border:1px solid #E5E7EB;padding:8px;background:#f8fafc;font-size:10.5px;line-height:1.7">${cuidadosText}</div></div>`:""}
      ${buildDocSignature(professional?.name||"", professional?.rut, professional?.signatureUrl)}
      ${buildClinicFooter()}`;
  }

  function printCuidados() {
    if (!patient) return;
    openDocWindow("Indicaciones", buildCuidadosDocBody());
  }

  function buildBudgetDocBody(db: Patient["budgets"][0]): string {
    if (!patient) return "";
    const dbUser = users.find(u => u.id === db.user.id) ?? db.user;
    const baseTotal  = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity,0);
    const itemDisc   = db.items.reduce((s,it)=>s+it.unitPrice*it.quantity*(it.discount||0)/100,0);
    const totalDisc  = itemDisc+(db.discount||0);
    const totalFinal = db.total;
    const thS = `padding:6px 7px;border:1px solid #1A1D2E;font-size:10px;font-weight:bold;background:#1A1D2E;color:white`;
    const tdS = `padding:6px 7px;border:1px solid #E5E7EB;font-size:10.5px`;
    const rows = db.items.map((it,i)=>{
      const discAmt = it.unitPrice * it.quantity * (it.discount||0) / 100;
      return `
      <tr style="background:${i%2===0?"#fff":"#F8F9FB"}">
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px;font-weight:bold">${i+1}</td>
        <td style="padding:5px 7px;border:1px solid #E5E7EB;font-size:10px">${it.description}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${it.tooth||"—"}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #E5E7EB;font-size:10px">${fmt(it.unitPrice)}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${it.quantity||1}</td>
        <td style="padding:5px 7px;text-align:center;border:1px solid #E5E7EB;font-size:10px">${it.discount>0?it.discount+"%":"—"}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #E5E7EB;font-size:10px">${discAmt>0?fmt(discAmt):"—"}</td>
        <td style="padding:5px 7px;text-align:right;border:1px solid #E5E7EB;font-size:10px">${fmt(it.total)}</td>
      </tr>`}).join("");
    const emptyRows = Array.from({length:Math.max(0,6-db.items.length)},(_,i)=>`
      <tr style="background:${(db.items.length+i)%2===0?"#fff":"#F8F9FB"}">
        <td style="padding:5px 7px;border:1px solid #E5E7EB;height:22px"></td>
        <td style="border:1px solid #E5E7EB"></td><td style="border:1px solid #E5E7EB"></td>
        <td style="border:1px solid #E5E7EB"></td><td style="border:1px solid #E5E7EB"></td>
        <td style="border:1px solid #E5E7EB"></td><td style="border:1px solid #E5E7EB"></td>
        <td style="border:1px solid #E5E7EB"></td>
      </tr>`).join("");
    return `
      ${buildDocHeader()}
      <div style="text-align:center;margin:14px 0 10px">
        <div style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#1A1D2E;text-transform:uppercase">PRESUPUESTO DENTAL</div>
        <div style="font-size:10px;color:#6B7280;margin-top:3px">N° ${String(db.number).padStart(4,"0")} · Válido 30 días · ${clinicCfg.clinic_address||"Badajoz 100 Of. 918, Las Condes"}</div>
      </div>
      ${buildDocProfPat({name:dbUser.name,rut:(dbUser as any).rut},[
        {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
        {label:"RUT",value:patient.rut},
        {label:"Fecha",value:db.date}
      ])}
      <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
        <thead><tr>
          <th style="${thS};text-align:center;width:4%">N°</th>
          <th style="${thS};text-align:left;width:28%">Tratamiento</th>
          <th style="${thS};text-align:center;width:10%">Diente(s)</th>
          <th style="${thS};text-align:right;width:13%">P. Unitario</th>
          <th style="${thS};text-align:center;width:8%">Cantidad</th>
          <th style="${thS};text-align:center;width:8%">Dto %</th>
          <th style="${thS};text-align:right;width:10%">Dto $</th>
          <th style="${thS};text-align:right;width:19%">Total</th>
        </tr></thead>
        <tbody>
          ${rows}${emptyRows}
          <tr style="background:#F8F9FB">
            <td colspan="7" style="${tdS};text-align:right;font-weight:bold">Subtotal</td>
            <td style="${tdS};text-align:right;font-weight:bold">${fmt(baseTotal)}</td>
          </tr>
          ${totalDisc>0?`<tr style="background:#F8F9FB">
            <td colspan="7" style="${tdS};text-align:right;font-weight:bold;color:#c0392b">Descuento</td>
            <td style="${tdS};text-align:right;font-weight:bold;color:#c0392b">− ${fmt(totalDisc)}</td>
          </tr>`:""}
          <tr style="background:#1A1D2E">
            <td colspan="7" style="${tdS};text-align:right;font-weight:bold;color:white;font-size:12px">TOTAL A PAGAR</td>
            <td style="${tdS};text-align:right;font-weight:bold;color:white;font-size:12px">${fmt(totalFinal)}</td>
          </tr>
        </tbody>
      </table>
      ${db.notes?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:bold;color:#1A1D2E;margin-bottom:5px">OBSERVACIONES:</div><div style="border:1px solid #E5E7EB;padding:8px;background:#fff;font-size:10.5px;line-height:1.7">${db.notes}</div></div>`:""}
      <div style="border:1px solid #E5E7EB;padding:10px 13px;background:#F8F9FB;border-radius:6px;font-size:9.5px;line-height:1.7">
        <div style="font-weight:bold;margin-bottom:4px;font-size:10.5px;color:#1A1D2E">Condiciones del Presupuesto</div>
        <div>• Este presupuesto tiene una validez de 30 días desde la fecha de emisión.</div>
        <div>• Algunos tratamientos están sujetos a diagnóstico definitivo; los costos pueden variar según hallazgos clínicos y/o radiográficos.</div>
        <div>• Los precios incluyen honorarios profesionales. Insumos especiales, exámenes o derivaciones no están incluidos salvo indicación.</div>
        <div>• Los tratamientos marcados con (*) requieren evaluación adicional antes de iniciar.</div>
      </div>
      ${buildDocSignature(dbUser.name, (dbUser as any).rut, (dbUser as any).signatureUrl)}
      ${buildClinicFooter()}`;
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

  async function saveRxFree() {
    if (!rxFreeForm.userId || !rxFreeForm.content.trim()) return;
    setRxFreeSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: id, userId: rxFreeForm.userId, date: rxFreeForm.date, type: rxTabType, content: rxFreeForm.content }),
      });
      if (!res.ok) { const errJson = await res.json().catch(()=>null); showToast(`❌ ${errJson?.error ?? `Error ${res.status}`}`); setRxFreeSaving(false); return; }
      setRxFreeForm(f => ({ ...f, content: "" }));
      await load();
      showToast(rxTabType==="recipe" ? "✅ Receta guardada" : "✅ Cuidados guardados");
    } catch(e) { showToast(`❌ Error: ${String(e)}`); }
    setRxFreeSaving(false);
  }

  async function emailSavedPrescription(rx: {date:string;type:string;content:string;user:{id:string;name:string}}) {
    if (!patient?.email) { showToast("❌ El paciente no tiene email"); return; }
    const fullName  = `${patient.firstName} ${patient.lastName}`;
    const dateStr   = new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const label     = rx.type === "recipe" ? "Receta Médica" : "Cuidados Post-Procedimiento";
    const professional = users.find(u => u.id === rx.user.id) ?? { name: rx.user.name };
    let bodyHtml: string;
    let parsed: any = null;
    try { if (rx.content.trim().startsWith("{")) parsed = JSON.parse(rx.content); } catch {}
    if (parsed?.medications?.length) {
      bodyHtml = buildRecetaBody({
        professionalName: professional.name,
        professionalRut: (professional as any).rut ?? "",
        signatureUrl: (professional as any).signatureUrl ?? undefined,
        patientName: fullName,
        patientRut: patient.rut,
        date: dateStr,
        medications: parsed.medications.map((m: any) => ({
          drug: m.drug || m.name || "",
          dose: m.dose || m.dosage || "",
          freq: m.freq || m.frequency || "",
          duration: m.duration ?? "",
          qty: m.qty ?? "",
          instructions: m.instructions ?? "",
        })),
        diagnosis: parsed.diagnosis ?? "",
        notes: parsed.notes ?? parsed.observations ?? "",
      }, window.location.origin + "/LOGO.jpeg");
    } else if (rx.type === "cuidados" && parsed?.sections) {
      bodyHtml = buildIndicacionesBody({
        professionalName: professional.name,
        professionalRut: (professional as any).rut ?? "",
        signatureUrl: (professional as any).signatureUrl ?? undefined,
        patientName: fullName,
        date: dateStr,
        procedimiento: parsed.procedimiento ?? "Post-procedimiento",
        sections: parsed.sections,
        observaciones: parsed.observaciones,
      }, window.location.origin + "/LOGO.jpeg");
    } else {
      bodyHtml = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
        <div style="background:#1e3a5f;padding:18px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0;font-size:18px">${label}</h2>
        </div>
        <div style="padding:20px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="margin:0 0 4px;font-size:13px;color:#64748b">Paciente: <strong style="color:#1e293b">${fullName}</strong></p>
          <p style="margin:0 0 4px;font-size:13px;color:#64748b">Profesional: <strong style="color:#1e293b">${professional.name}</strong></p>
          <p style="margin:0 0 16px;font-size:13px;color:#64748b">Fecha: <strong style="color:#1e293b">${dateStr}</strong></p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px"/>
          <pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:13px;color:#1e293b;line-height:1.7;margin:0">${rx.content}</pre>
        </div>
      </div>`;
    }
    try {
      const pdfBase64 = await generatePdfBase64(bodyHtml);
      const r = await fetch("/api/send-document", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ pdfBase64, to: patient.email, subject:`${label} — ${fullName}`,
          filename:`${label.replace(/ /g,"_")}_${patient.firstName}_${patient.lastName}`,
          patientName:fullName, bodyText:`Estimado/a ${fullName}, adjuntamos su ${label.toLowerCase()}. Saludos, Clínica Magna.` }) });
      const d = await r.json();
      showToast(d.ok ? `✅ ${label} enviada por email` : `❌ ${d.error}`);
    } catch(e) { showToast(`❌ Error: ${String(e)}`); }
  }

  async function emailSavedRxRequest(rx: {date:string;content:string;user:{id:string;name:string}}) {
    if (!patient?.email) { showToast("❌ El paciente no tiene email"); return; }
    let parsed: any = {};
    try { parsed = JSON.parse(rx.content); } catch {}
    const professional = users.find(u => u.id === rx.user.id) ?? { name: rx.user.name };
    const bodyHtml = buildRxRequestHtml(parsed as RxFormData, professional);
    try {
      const pdfBase64 = await generatePdfBase64(bodyHtml);
      const fullName = `${patient.firstName} ${patient.lastName}`;
      const r = await fetch("/api/send-document", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ pdfBase64, to: patient.email, subject:`Solicitud de Radiografía — ${fullName}`,
          filename:`SolicitudRx_${patient.firstName}_${patient.lastName}`,
          patientName:fullName, bodyText:`Estimado/a ${fullName}, adjuntamos su solicitud de radiografía/scanner. Saludos, Clínica Magna.` }) });
      const d = await r.json();
      showToast(d.ok ? "✅ Solicitud enviada por email" : `❌ ${d.error}`);
    } catch(e) { showToast(`❌ Error: ${String(e)}`); }
  }

  function waSavedRxRequest(rx: {date:string;content:string;user:{name:string}}) {
    if (!patient?.phone) { showToast("❌ El paciente no tiene teléfono"); return; }
    let parsed: any = {};
    try { parsed = JSON.parse(rx.content); } catch {}
    const items: string[] = [];
    if (parsed.rxi_periapical) items.push(`• Periapical Digital${parsed.rxi_piezas?` piezas: ${parsed.rxi_piezas}`:""}`);
    if (parsed.rxi_total) items.push("• RX Total");
    if (parsed.rxi_bitewing) items.push(`• Bitewing${parsed.rxi_bitewingDer?" Der":""}${parsed.rxi_bitewingIzq?" Izq":""}`);
    if (parsed.rxe_panoramica) items.push("• Panorámica");
    if (parsed.rxe_telerLateral||parsed.rxe_telerAntero) items.push(`• Telerradiografía${parsed.rxe_telerLateral?" Lateral":""}${parsed.rxe_telerAntero?" Anteroposterior":""}`);
    if (parsed.rxe_manoCarpo) items.push("• RX Mano/Carpo");
    if (parsed.sc_arcadaSup||parsed.sc_arcadaInf||parsed.sc_STL||parsed.sc_PLY||parsed.sc_invisalign) items.push(`• Scanner${parsed.sc_arcadaSup?" Arcada Sup":""}${parsed.sc_arcadaInf?" Arcada Inf":""}${parsed.sc_STL?" STL":""}${parsed.sc_PLY?" PLY":""}${parsed.sc_invisalign?" Invisalign":""}`);
    if (parsed.cb_maxilarSup||parsed.cb_mandibula||parsed.cb_ATM) items.push(`• Cone Beam${parsed.cb_maxilarSup?" Maxilar Sup":""}${parsed.cb_mandibula?" Mandíbula":""}${parsed.cb_ATM?" ATM":""}${parsed.cb_zona?` zona ${parsed.cb_zona}`:""}`);
    if (parsed.meInteresa) items.push(`Notas: ${parsed.meInteresa}`);
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const dateStr  = new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL");
    const msg = `*Solicitud de Radiografía / Scanner*\nPaciente: ${fullName}\nFecha: ${dateStr}\nProfesional: ${rx.user.name}\n\n${items.join("\n") || "Sin ítems seleccionados"}\n\nClínica Magna`;
    const clean = patient.phone.replace(/\D/g,"");
    const num   = clean.startsWith("56") ? clean : `56${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function printSavedRxRequest(rx: {content:string;user:{id:string;name:string}}) {
    let parsed: any = {};
    try { parsed = JSON.parse(rx.content); } catch {}
    const professional = users.find(u => u.id === rx.user.id) ?? { name: rx.user.name };
    const bodyHtml = buildRxRequestHtml(parsed as RxFormData, professional);
    const win = window.open("","_blank","width=860,height=1100");
    if (win) { win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Solicitud Rx</title><style>@page{margin:14mm;size:A4 portrait}*{box-sizing:border-box}body{font-family:'Times New Roman',Times,serif;font-size:11px;color:#1a1a1a;margin:0}@media print{.noprint{display:none!important}}</style></head><body>${bodyHtml}<button class="noprint" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:#1f4e79;color:white;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:sans-serif">🖨 Imprimir / PDF</button></body></html>`); win.document.close(); }
  }

  function printSavedPrescription(rx: {date:string;type:string;content:string;user:{id:string;name:string}}) {
    if (!patient) return;
    const professional = users.find(u => u.id === rx.user.id) ?? { name: rx.user.name };
    const label = rx.type === "recipe" ? "Receta Médica" : "Cuidados Post-Procedimiento";
    const dateStr = new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"});
    const logoSrc = window.location.origin + "/LOGO.jpeg";
    let body: string;
    let parsed: any = null;
    try { if (rx.content.trim().startsWith("{")) parsed = JSON.parse(rx.content); } catch {}
    if (parsed?.medications?.length) {
      body = buildRecetaBody({
        professionalName: professional.name,
        professionalRut: (professional as any).rut ?? "",
        signatureUrl: (professional as any).signatureUrl ?? undefined,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientRut: patient.rut,
        date: dateStr,
        medications: parsed.medications.map((m: any) => ({
          drug: m.drug || m.name || "",
          dose: m.dose || m.dosage || "",
          freq: m.freq || m.frequency || "",
          duration: m.duration ?? "",
          qty: m.qty ?? "",
          instructions: m.instructions ?? "",
        })),
        diagnosis: parsed.diagnosis ?? "",
        notes: parsed.notes ?? parsed.observations ?? "",
      }, logoSrc);
    } else if (rx.type === "cuidados" && parsed?.sections) {
      body = buildIndicacionesBody({
        professionalName: professional.name,
        professionalRut: (professional as any).rut ?? "",
        signatureUrl: (professional as any).signatureUrl ?? undefined,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: dateStr,
        procedimiento: parsed.procedimiento ?? "Post-procedimiento",
        sections: parsed.sections,
        observaciones: parsed.observaciones,
      }, logoSrc);
    } else {
      body = `${buildDocHeader()}
        <div style="text-align:center;margin:14px 0 10px">
          <div style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#1A1D2E;text-transform:uppercase">${label.toUpperCase()}</div>
        </div>
        ${buildDocProfPat({name:professional.name,showRut:false},[
          {label:"Nombre",value:`${patient.firstName} ${patient.lastName}`},
          {label:"Fecha",value:dateStr}
        ])}
        <pre style="font-family:inherit;font-size:11px;white-space:pre-wrap;line-height:1.7">${rx.content}</pre>
        ${buildDocSignature(professional.name, (professional as any).rut, (professional as any).signatureUrl)}
        ${buildClinicFooter()}`;
    }
    openDocWindow(label, body);
  }

  async function deleteRx(rxId: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    await fetch(`/api/prescriptions/${rxId}`, { method: "DELETE" });
    const r = await fetch(`/api/prescriptions?patientId=${id}`);
    if (r.ok) setPrescriptions(await r.json());
  }

  async function saveOdontogram(data: any, recordId: string | null, type: string) {
    setOSaving(true);
    const today = new Date().toISOString().split("T")[0];
    if (recordId) {
      await fetch(`/api/odontogram/${recordId}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ data }) });
    } else {
      await fetch("/api/odontogram", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ patientId:id, date:today, type, data }) });
    }
    setOSaving(false);
    const r = await fetch(`/api/odontogram?patientId=${id}`);
    if (r.ok) setOdontograms(await r.json());
  }

  async function deleteOdontogram(recordId: string) {
    await fetch(`/api/odontogram/${recordId}`, { method:"DELETE" });
    const r = await fetch(`/api/odontogram?patientId=${id}`);
    if (r.ok) setOdontograms(await r.json());
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
    <div className="space-y-4 w-full">
      {toast && <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Back */}
      <button onClick={()=>router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 text-sm transition-colors">
        <ArrowLeft size={15}/> Volver a pacientes
      </button>

      {/* ── Encabezado azul estilo DentaLink ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-[#0057FF]/20">
        {/* Banda azul principal */}
        <div className="bg-gradient-to-r from-[#0057FF] to-[#1a6bff] px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-2 ring-white/40">
              <span className="text-white text-[22px] font-bold">{patient.firstName[0]}{patient.lastName[0]}</span>
            </div>

            {/* Nombre + datos */}
            <div className="flex-1 min-w-0">
              <h1 className="text-[20px] font-bold text-white leading-tight">{patient.firstName} {patient.lastName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-blue-100 text-[13px]">RUT {patient.rut}</span>
                {patient.gender && <span className="text-blue-200 text-[13px]">| {patient.gender}</span>}
                {age !== null && patient.birthDate && (() => {
                  const bd = new Date(patient.birthDate);
                  const now = new Date();
                  let mos = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
                  if (now.getDate() < bd.getDate()) mos--;
                  const yrs = Math.floor(mos / 12); const rem = mos % 12;
                  return <span className="text-blue-200 text-[13px]">| {yrs} año{yrs !== 1 ? "s" : ""}{rem > 0 ? `, ${rem} mes${rem !== 1 ? "es" : ""}` : ""}</span>;
                })()}
              </div>
            </div>

            {/* Tarjetas de alerta médica */}
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              <div className={`rounded-xl px-3 py-2 text-center min-w-[110px] ${patient.clinicalRecord?.allergies ? "bg-amber-400/90" : "bg-white/15"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <AlertTriangle size={12} className="text-white flex-shrink-0"/>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide">Alertas médicas</span>
                </div>
                <p className="text-[11px] text-white/80 truncate">{patient.clinicalRecord?.allergies || "Sin información"}</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center min-w-[110px] ${patient.clinicalRecord?.medicalBackground ? "bg-rose-400/80" : "bg-white/15"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Heart size={12} className="text-white flex-shrink-0"/>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide">Enfermedades</span>
                </div>
                <p className="text-[11px] text-white/80 truncate">{patient.clinicalRecord?.medicalBackground?.split("\n")[0] || "Sin información"}</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center min-w-[110px] ${patient.clinicalRecord?.currentMedications ? "bg-violet-400/80" : "bg-white/15"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Pill size={12} className="text-white flex-shrink-0"/>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide">Medicamentos</span>
                </div>
                <p className="text-[11px] text-white/80 truncate">{patient.clinicalRecord?.currentMedications?.split("\n")[0] || "Sin información"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de acciones rápidas bajo el header */}
        <div className="bg-white border-b border-[#E3E8F0] px-4 sm:px-6 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={()=>openEvoModal()} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 hover:bg-[#0057FF] hover:text-white transition-all">
              <Activity size={13}/> Nueva evolución
            </button>
            <button onClick={()=>router.push(`/agenda?patientId=${patient.id}`)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#F0F2F7] text-[#4B5563] border border-[#E3E8F0] hover:bg-[#E3E8F0] transition-all">
              <CalendarPlus size={13}/> Agendar
            </button>
          </div>
          <div className="flex gap-1.5">
            <button onClick={openEditPatient} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#F0F2F7] text-[#4B5563] border border-[#E3E8F0] hover:bg-[#E3E8F0] transition-all">
              <Edit2 size={13}/> Editar paciente
            </button>
            {isAdmin && (
              <button onClick={deletePatientHard} disabled={deletingPatient} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all">
                <Trash2 size={13}/> Eliminar
              </button>
            )}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="bg-[#F8F9FC] px-4 sm:px-6 py-2 flex gap-4 flex-wrap border-b border-[#E3E8F0]">
          {patient.phone && <a href={`tel:${patient.phone}`} className="flex items-center gap-1.5 text-[12px] text-[#4B5563] hover:text-[#0057FF] transition-colors"><Phone size={12} className="text-[#9AA0B4]"/>{patient.phone}</a>}
          {patient.email && <a href={`mailto:${patient.email}`} className="flex items-center gap-1.5 text-[12px] text-[#4B5563] hover:text-[#0057FF] transition-colors"><Mail size={12} className="text-[#9AA0B4]"/>{patient.email}</a>}
          {(patient.address||patient.city) && <span className="flex items-center gap-1.5 text-[12px] text-[#4B5563]"><MapPin size={12} className="text-[#9AA0B4]"/>{[patient.address,patient.city].filter(Boolean).join(", ")}</span>}
          <span className="flex items-center gap-1.5 text-[12px] ml-auto text-[#4B5563]">
            <span className="font-semibold text-[#1A1D2E]">{patient.evolutions.length}</span> evoluciones ·{" "}
            <span className="font-semibold text-emerald-600">{fmtShort(paidTotal)}</span> pagado ·{" "}
            <span className={`font-semibold ${saldo>0?"text-red-600":"text-emerald-600"}`}>{fmtShort(Math.abs(saldo))}</span> {saldo>0?"saldo":"al día"}
          </span>
        </div>

      </div>

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-hide mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-[2px] bg-[#F0F2F7] rounded-[10px] p-[3px] border border-[#E3E8F0] min-w-max">
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>{
              if (budgetEditorOpen && i !== 6) {
                if (!confirm("Tienes un presupuesto abierto con cambios sin guardar. ¿Salir sin guardar?")) return;
                setBudgetEditorOpen(false);
              }
              setTab(i);
            }}
              className={`px-3 py-[9px] text-[13px] rounded-[7px] transition-all duration-150 whitespace-nowrap ${
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
        <DentalChart
          records={odontograms}
          onSave={saveOdontogram}
          onDelete={isAdmin ? deleteOdontogram : undefined}
          isSaving={oSaving}
        />
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
            <button onClick={()=>openEvoModal()} className="btn-primary text-sm">
              <Plus size={14}/> Nueva Evolución
            </button>
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
                        <button onClick={()=>openEvoEdit(e)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C8D0E0] hover:text-[#0057FF] hover:bg-[#EEF3FF] transition-colors">
                            <Pencil size={13}/>
                          </button>
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

      {/* ===== TAB 5: RECETAS Y CUIDADOS ===== */}
      {tab===5&&(
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-[#F0F2F7] rounded-xl p-1 w-fit">
            {([["recipe","Recetas 🖊"],["care","Cuidados 📋"]] as [string,string][]).map(([t,label])=>(
              <button key={t} onClick={()=>setRxTabType(t as any)}
                className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all ${rxTabType===t?"bg-white text-[#1A1D2E] shadow-sm":"text-[#9AA0B4] hover:text-[#1A1D2E]"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Formulario de creación */}
          <div className="bg-white border border-[#E3E8F0] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 pt-4 pb-3 border-b border-[#E3E8F0] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Profesional *</label>
                <select className="select text-[13px]" value={rxFreeForm.userId} onChange={e=>setRxFreeForm(f=>({...f,userId:e.target.value}))}>
                  <option value="">Seleccionar profesional...</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Fecha</label>
                <input type="date" className="input text-[13px]" value={rxFreeForm.date} onChange={e=>setRxFreeForm(f=>({...f,date:e.target.value}))}/>
              </div>
            </div>
            {/* Toolbar */}
            <div className="px-5 pt-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-0.5 bg-[#F0F2F7] rounded-lg p-1">
                {["P","B","I","U","S"].map(b=>(
                  <button key={b} className={`w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-[#4B5563] text-[12px] ${b==="B"?"font-bold":b==="I"?"italic":b==="U"?"underline":b==="S"?"line-through":""}`}>{b}</button>
                ))}
              </div>
              {rxTabType==="recipe" ? (
                <select className="appearance-none text-[12px] font-semibold bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 rounded-lg px-3 py-1.5 pr-6 cursor-pointer focus:outline-none"
                  value="" onChange={e=>{ const tmpl=RX_TEMPLATES[e.target.value]; if(tmpl){const txt=tmpl.map((m:any)=>`${m.drug} ${m.dose} — ${m.freq} × ${m.duration}`).join("\n"); setRxFreeForm(f=>({...f,content:(f.content?f.content+"\n":"")+txt}));} (e.target as HTMLSelectElement).value=""; }}>
                  <option value="">+ Usar plantilla</option>
                  {Object.keys(RX_TEMPLATES).map(k=><option key={k} value={k}>{k}</option>)}
                </select>
              ) : (
                <select className="appearance-none text-[12px] font-semibold bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 rounded-lg px-3 py-1.5 pr-6 cursor-pointer focus:outline-none"
                  value="" onChange={e=>{ const t=CARE_TEMPLATES[e.target.value]; if(t) setRxFreeForm(f=>({...f,content:(f.content?f.content+"\n":"")+t})); (e.target as HTMLSelectElement).value=""; }}>
                  <option value="">+ Usar plantilla</option>
                  {Object.keys(CARE_TEMPLATES).map(k=><option key={k} value={k}>{k}</option>)}
                </select>
              )}
            </div>
            <div className="px-5 pb-4">
              <textarea
                className="w-full text-[13px] border border-[#E3E8F0] rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#0057FF] resize-none leading-relaxed"
                rows={6}
                value={rxFreeForm.content}
                onChange={e=>setRxFreeForm(f=>({...f,content:e.target.value}))}
                placeholder={rxTabType==="recipe"?"Escribe la receta médica aquí...":"Escribe los cuidados post-operatorios aquí..."}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={()=>setRxFreeForm(f=>({...f,content:""}))}
                  className="text-[12px] font-medium px-3 py-2 rounded-lg border border-[#E3E8F0] text-[#4B5563] hover:bg-[#F0F2F7] transition-colors">
                  Limpiar
                </button>
                <button onClick={saveRxFree} disabled={rxFreeSaving||!rxFreeForm.userId||!rxFreeForm.content.trim()}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors disabled:opacity-60">
                  <Save size={13}/> {rxFreeSaving?"Guardando...": rxTabType==="recipe"?"Guardar Receta":"Guardar Cuidados"}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de registros guardados */}
          <div className="space-y-3">
            {prescriptions.filter(p=>p.type===rxTabType).length===0 ? (
              <div className="bg-white border border-[#E3E8F0] rounded-2xl py-10 text-center shadow-sm">
                <p className="text-[13px] text-[#9AA0B4]">{rxTabType==="recipe"?"Sin recetas guardadas":"Sin cuidados guardados"}</p>
              </div>
            ) : prescriptions.filter(p=>p.type===rxTabType).map(rx=>(
              <div key={rx.id} className="bg-white border border-[#E3E8F0] rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F2F7] bg-[#F8F9FC]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0057FF] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[11px] font-bold">{rx.user.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#1A1D2E]">{rx.user.name}</p>
                      <p className="text-[10px] text-[#9AA0B4]">{new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"short",year:"numeric"})}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={()=>printSavedPrescription(rx)}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200" title="Imprimir / PDF">
                      <Printer size={13}/>
                    </button>
                    {patient.phone && (
                      <button onClick={()=>{
                        const clean=patient.phone!.replace(/\D/g,"");
                        const num=clean.startsWith("56")?clean:`56${clean}`;
                        const label=rxTabType==="recipe"?"Receta":"Cuidados post-procedimiento";
                        const msg=`*${label}*\n${patient.firstName} ${patient.lastName}\n${new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL")}\n\n${rx.content}\n\nClínica Magna`;
                        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,"_blank");
                      }} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200" title="Enviar por WhatsApp">
                        <MessageCircle size={13}/>
                      </button>
                    )}
                    {patient.email && (
                      <button onClick={()=>emailSavedPrescription(rx)}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors border border-blue-200" title="Enviar por email">
                        <Mail size={13}/>
                      </button>
                    )}
                    <button onClick={()=>{ setRxFreeForm({userId:sessionUserId,date:new Date().toISOString().split("T")[0],content:rx.content}); window.scrollTo(0,0); }}
                      className="text-[11px] font-semibold text-[#0057FF] hover:underline">
                      Reutilizar
                    </button>
                    {isAdmin&&<button onClick={()=>deleteRx(rx.id)} className="text-[#D4C4A0] hover:text-red-500 transition-colors"><Trash2 size={13}/></button>}
                  </div>
                </div>
                <div className="px-5 py-3">
                  {(() => {
                    let parsed: any = null;
                    try { if (rx.content.trim().startsWith("{")) parsed = JSON.parse(rx.content); } catch {}
                    if (parsed?.medications?.length) {
                      return (
                        <div className="space-y-3">
                          {parsed.diagnosis && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Diagnóstico: </span>
                              <span className="text-[13px] text-amber-900">{parsed.diagnosis}</span>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {parsed.medications.map((m: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                <span className="w-5 h-5 rounded-full bg-[#0057FF] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                                <div>
                                  <p className="text-[13px] font-semibold text-[#1A1D2E]">{m.name || m.drug}</p>
                                  {(m.dosage || m.dose) && <p className="text-[12px] text-[#4B5563]">{m.dosage || [m.dose, m.freq, m.duration].filter(Boolean).join(" · ")}</p>}
                                  {m.instructions && <p className="text-[11px] text-[#9AA0B4] italic">{m.instructions}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                          {parsed.instructions && (
                            <div className="bg-[#F0F2F7] rounded-lg px-3 py-2">
                              <span className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wide">Indicaciones: </span>
                              <span className="text-[13px] text-[#1A1D2E]">{parsed.instructions}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return <p className="text-[13px] text-[#1A1D2E] leading-relaxed whitespace-pre-line">{rx.content}</p>;
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TAB 6: PRESUPUESTOS ===== */}
      {tab===6&&(
        <div className="space-y-4">
          {/* Editor inline */}
          {budgetEditorOpen && (
            <BudgetEditor
              patientId={id}
              budgetId={budgetEditorEditId ?? undefined}
              budgetNumber={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.number : undefined}
              initUserId={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.user.id : sessionUserId}
              initDate={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.date : undefined}
              initValidUntil={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.validUntil ?? undefined : undefined}
              initStatus={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.status : "pending"}
              initDiscount={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.discount : 0}
              initNotes={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.notes ?? "" : ""}
              initLines={budgetEditorEditId ? patient.budgets.find(b=>b.id===budgetEditorEditId)?.items.map((i,idx)=>({_key:String(idx),toothNum:undefined,surfaces:[],description:i.description,quantity:i.quantity,unitPrice:i.unitPrice,discount:i.discount??0,discountAmt:(i as any).discountAmt??0,total:i.total,status:(i as any).status||"pending"})) : []}
              users={users}
              treatments={treatments}
              convenios={convenios}
              isSaving={budgetSaving}
              onCancel={()=>setBudgetEditorOpen(false)}
              onSave={async(data)=>{
                setBudgetSaving(true);
                const wasNew = !budgetEditorEditId;
                if(budgetEditorEditId){
                  await fetch(`/api/budgets/${budgetEditorEditId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
                } else {
                  const res = await fetch("/api/budgets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,patientId:id})});
                  const created = await res.json();
                  if(created?.id) setBudgetEditorEditId(created.id);
                }
                setBudgetSaving(false);
                load();
                showToast(wasNew?"✅ Presupuesto creado":"✅ Presupuesto actualizado");
              }}
            />
          )}

          {!budgetEditorOpen && (
          <>
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

          {patient.budgets.length === 0 ? (
            <div className="bg-white border border-[#E3E8F0] rounded-2xl py-16 text-center shadow-sm">
              <FileText className="w-10 h-10 mx-auto mb-3 text-[#E3E8F0]"/>
              <p className="text-[14px] font-semibold text-[#9AA0B4]">Sin planes de tratamiento</p>
              <p className="text-[12px] text-[#9AA0B4] mt-1">Presiona "+ Nuevo Presupuesto" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Grupo: En ejecución */}
              {patient.budgets.filter(b=>b.status==="approved"||b.status==="pending").length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"/>
                    <span className="text-[13px] font-bold text-[#1A1D2E]">En ejecución</span>
                  </div>
                  {patient.budgets.filter(b=>b.status==="approved"||b.status==="pending").map(b=>{
                    const bPaid = b.payments.reduce((s,p)=>s+p.amount,0);
                    const bBalance = b.total - bPaid;
                    const prog = b.total > 0 ? Math.min(100,Math.round((bPaid/b.total)*100)) : 0;
                    const lastAppt = patient.appointments.find(a=>a.date >= b.date);
                    const financialStatus = bBalance <= 0 ? "Al día" : bBalance < b.total ? "Abono parcial" : "Sin abono";
                    const fColor = bBalance <= 0 ? "text-emerald-600" : bBalance < b.total ? "text-amber-600" : "text-[#9AA0B4]";
                    return (
                      <div key={b.id} className="bg-white border border-[#E3E8F0] rounded-2xl p-4 mb-3 shadow-sm hover:shadow-md transition-shadow">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[14px] font-bold text-[#0057FF]">#{String(b.number).padStart(5,"0")}</span>
                              {editBudgetNameId===b.id ? (
                                <>
                                  <input autoFocus className="text-[14px] font-bold text-[#1A1D2E] border-b border-[#0057FF] bg-transparent outline-none w-40"
                                    value={editBudgetNameVal}
                                    onChange={e=>setEditBudgetNameVal(e.target.value)}
                                    onKeyDown={e=>{ if(e.key==="Enter") saveBudgetName(b.id); if(e.key==="Escape") setEditBudgetNameId(null); }}/>
                                  <button onClick={()=>saveBudgetName(b.id)} className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={13}/></button>
                                  <button onClick={()=>setEditBudgetNameId(null)} className="p-1 rounded-lg text-[#9AA0B4] hover:bg-[#F0F2F7]"><X size={13}/></button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[14px] font-bold text-[#1A1D2E] cursor-pointer hover:text-[#0057FF]"
                                    onClick={()=>{ setEditBudgetNameId(b.id); setEditBudgetNameVal(b.notes||""); }}
                                    title="Haz clic para editar el nombre">
                                    {b.notes || "Sin nombre"}
                                  </span>
                                  <button onClick={()=>{ setEditBudgetNameId(b.id); setEditBudgetNameVal(b.notes||""); }} className="p-1 rounded-lg text-[#9AA0B4] hover:text-[#0057FF] hover:bg-[#EEF3FF] transition-colors">
                                    <Pencil size={13}/>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <button onClick={async()=>{ if(!confirm("¿Eliminar este presupuesto?"))return; await fetch(`/api/budgets/${b.id}`,{method:"DELETE"}); load(); }}
                              className="text-[#D4C4A0] hover:text-red-500 transition-colors p-1">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>

                        {/* Grilla de datos */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <div>
                            <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Profesional</p>
                            <p className="text-[12px] font-medium text-[#1A1D2E]">{b.user.name.split(" ").slice(0,2).join(" ")}</p>
                            <p className="text-[10px] text-[#9AA0B4]">General</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Última cita</p>
                            {lastAppt ? (
                              <><p className="text-[12px] font-medium text-[#1A1D2E]">{lastAppt.date}</p>
                              <p className="text-[10px] text-[#9AA0B4]">{lastAppt.startTime}</p></>
                            ) : <p className="text-[12px] text-[#9AA0B4]">—</p>}
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Progreso</p>
                            {/* Mini círculo de progreso */}
                            <div className="flex items-center gap-2">
                              <svg width="32" height="32" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="13" fill="none" stroke="#E3E8F0" strokeWidth="4"/>
                                <circle cx="16" cy="16" r="13" fill="none" stroke={prog===100?"#22C55E":prog>0?"#0057FF":"#E3E8F0"} strokeWidth="4"
                                  strokeDasharray={`${prog*0.816} 81.6`} strokeDashoffset="20.4" strokeLinecap="round"/>
                              </svg>
                              <span className="text-[12px] font-bold text-[#1A1D2E]">{prog}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-0.5">Estado financiero</p>
                            <p className={`text-[12px] font-bold ${fColor}`}>{financialStatus}</p>
                            <p className="text-[10px] text-[#9AA0B4]">{fmt(bBalance)} saldo</p>
                          </div>
                        </div>

                        {/* Barra de progreso */}
                        <div className="w-full bg-[#E3E8F0] rounded-full h-1.5 mb-3">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{width:`${prog}%`}}/>
                        </div>

                        {/* Fechas + acciones */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] text-[#9AA0B4]">Creado: {b.date}{b.validUntil?` · Válido hasta: ${b.validUntil}`:""}</span>
                          <div className="flex gap-2 items-center">
                            {patient.phone && (
                              <button onClick={()=>sendBudgetWA(b)} className="p-2.5 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors min-h-[40px]" title="Enviar por WhatsApp">
                                <MessageCircle size={18}/>
                              </button>
                            )}
                            {patient.email && (
                              <button onClick={()=>emailPdfBudget(b)} className="p-2.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors min-h-[40px]" title="Enviar por email">
                                <Mail size={18}/>
                              </button>
                            )}
                            <button onClick={()=>openBudgetEdit(b)}
                              className="text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-[#F0F2F7] text-[#4B5563] hover:bg-[#E3E8F0] transition-colors min-h-[40px]">
                              Editar
                            </button>
                            <button onClick={()=>setBudgetDetailId(b.id)}
                              className="text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors min-h-[40px]">
                              Ver detalle
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grupo: Otros */}
              {patient.budgets.filter(b=>b.status!=="approved"&&b.status!=="pending").length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9AA0B4] flex-shrink-0"/>
                    <span className="text-[13px] font-bold text-[#1A1D2E]">Otros</span>
                  </div>
                  {patient.budgets.filter(b=>b.status!=="approved"&&b.status!=="pending").map(b=>{
                    const bPaid = b.payments.reduce((s,p)=>s+p.amount,0);
                    const bBalance = b.total - bPaid;
                    return (
                      <div key={b.id} className="bg-white border border-[#E3E8F0] rounded-2xl p-4 mb-3 shadow-sm opacity-80">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-bold text-[#9AA0B4]">#{String(b.number).padStart(5,"0")}</span>
                              {editBudgetNameId===b.id ? (
                                <>
                                  <input autoFocus className="text-[13px] font-medium text-[#4B5563] border-b border-[#0057FF] bg-transparent outline-none w-36"
                                    value={editBudgetNameVal}
                                    onChange={e=>setEditBudgetNameVal(e.target.value)}
                                    onKeyDown={e=>{ if(e.key==="Enter") saveBudgetName(b.id); if(e.key==="Escape") setEditBudgetNameId(null); }}/>
                                  <button onClick={()=>saveBudgetName(b.id)} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50"><Check size={12}/></button>
                                  <button onClick={()=>setEditBudgetNameId(null)} className="p-0.5 rounded text-[#9AA0B4] hover:bg-[#F0F2F7]"><X size={12}/></button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[13px] text-[#4B5563] cursor-pointer hover:text-[#0057FF]"
                                    onClick={()=>{ setEditBudgetNameId(b.id); setEditBudgetNameVal(b.notes||""); }}>{b.notes || "Sin nombre"}</span>
                                  <button onClick={()=>{ setEditBudgetNameId(b.id); setEditBudgetNameVal(b.notes||""); }} className="p-0.5 rounded text-[#9AA0B4] hover:text-[#0057FF]">
                                    <Pencil size={11}/>
                                  </button>
                                </>
                              )}
                              <Badge value={b.status}/>
                            </div>
                            <p className="text-[11px] text-[#9AA0B4] mt-0.5">{b.user.name} · {b.date} · Total: {fmt(b.total)}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0 items-center">
                            {patient.phone && (
                              <button onClick={()=>sendBudgetWA(b)} className="p-2.5 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors min-h-[40px]" title="WhatsApp">
                                <MessageCircle size={17}/>
                              </button>
                            )}
                            {patient.email && (
                              <button onClick={()=>emailPdfBudget(b)} className="p-2.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors min-h-[40px]" title="Enviar email">
                                <Mail size={17}/>
                              </button>
                            )}
                            <button onClick={()=>openBudgetEdit(b)} className="text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-[#F0F2F7] text-[#0057FF] hover:bg-[#EEF3FF] transition-colors min-h-[40px]">Editar</button>
                            {isAdmin && (
                              <button onClick={async()=>{ if(!confirm("¿Eliminar?"))return; await fetch(`/api/budgets/${b.id}`,{method:"DELETE"}); load(); }}
                                className="p-2.5 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-colors min-h-[40px] flex items-center">
                                <Trash2 size={17}/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* ===== TAB 7: RADIOGRAFÍAS ===== */}
      {tab===7&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap items-center">
              <select className="select text-sm w-auto" value={docType} onChange={e=>setDocType(e.target.value)}>
                <option value="radiografia">Radiografía</option>
                <option value="examen">Examen</option>
                <option value="consentimiento">Consentimiento</option>
                <option value="foto">Fotografía</option>
                <option value="other">Otro</option>
              </select>
              <button onClick={()=>{ setRxDocUserId(sessionUserId); setRxForm({...EMPTY_RX_FORM}); setRxDocModal(true); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-500 hover:text-white transition-all">
                <FileText size={14}/> Solicitud Rx
              </button>
            </div>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading}
              className="btn-primary text-sm flex items-center gap-1.5">
              <Upload size={14}/> {uploading?"Subiendo...":"Subir archivo"}
            </button>
            <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.dcm"
              onChange={e=>{ if(e.target.files?.[0]) uploadDoc(e.target.files[0]); e.target.value=""; }}/>
          </div>
          {patient.documents.filter(d=>["radiografia","examen","foto","consentimiento"].includes(d.type)||docType==="other").length===0 ? (
            <div className="bg-white border border-[#E3E8F0] rounded-2xl py-14 text-center shadow-sm">
              <span className="text-4xl block mb-3">🦷</span>
              <p className="text-[14px] font-semibold text-[#9AA0B4]">Sin radiografías ni documentos clínicos</p>
              <p className="text-[12px] text-[#9AA0B4] mt-1">Sube una imagen o PDF con el botón de arriba</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {patient.documents.map(doc=>(
                <div key={doc.id} className="bg-white border border-[#E3E8F0] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                  <div className="aspect-square bg-[#F0F2F7] flex items-center justify-center text-3xl">
                    {doc.mimeType?.startsWith("image/") ? (
                      <img src={`/api/documents/${doc.id}/file`} alt={doc.name}
                        className="w-full h-full object-cover" onError={e=>(e.currentTarget.style.display="none")}/>
                    ) : (
                      <span>{docIcons[doc.type]||"📎"}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-semibold text-[#1A1D2E] truncate">{doc.name}</p>
                    <p className="text-[10px] text-[#9AA0B4]">{new Date(doc.createdAt).toLocaleDateString("es-CL")}</p>
                    <div className="flex gap-1 mt-1.5">
                      <a href={`/api/documents/${doc.id}/file`} target="_blank"
                        className="flex-1 text-center text-[10px] font-semibold bg-[#EEF3FF] text-[#0057FF] rounded-lg py-1 hover:bg-[#0057FF] hover:text-white transition-colors">
                        Ver
                      </a>
                      {isAdmin&&<button onClick={()=>deleteDoc(doc.id)}
                        className="text-[10px] px-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                        <Trash2 size={10}/>
                      </button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Solicitudes Rx guardadas */}
          {prescriptions.filter(p=>p.type==="rxrequest").length > 0 && (
            <div className="mt-4">
              <h4 className="text-[12px] font-bold text-[#9AA0B4] uppercase tracking-wide mb-2">Solicitudes guardadas</h4>
              <div className="space-y-2">
                {prescriptions.filter(p=>p.type==="rxrequest").map(rx=>{
                  let parsed: any = {};
                  try { parsed = JSON.parse(rx.content); } catch {}
                  return (
                    <div key={rx.id} className="bg-white border border-[#E3E8F0] rounded-xl p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Solicitud Rx</span>
                          <span className="text-[11px] text-[#9AA0B4]">{new Date(rx.date+"T12:00:00").toLocaleDateString("es-CL")}</span>
                          <span className="text-[11px] text-[#9AA0B4]">— {rx.user.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={()=>printSavedRxRequest(rx)}
                            className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200" title="Imprimir / PDF">
                            <Printer size={16}/>
                          </button>
                          {patient.phone && (
                            <button onClick={()=>waSavedRxRequest(rx)}
                              className="p-2.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200" title="Enviar por WhatsApp">
                              <MessageCircle size={16}/>
                            </button>
                          )}
                          {patient.email && (
                            <button onClick={()=>emailSavedRxRequest(rx)}
                              className="p-2.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors border border-blue-200" title="Enviar por email">
                              <Mail size={16}/>
                            </button>
                          )}
                          {isAdmin && <button onClick={()=>deleteRx(rx.id)} className="p-2 rounded-lg text-[#D4C4A0] hover:text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"><Trash2 size={16}/></button>}
                        </div>
                      </div>
                      {/* New structured form display */}
                      {parsed.rxi_periapical && <div className="text-[11px] text-[#1A1D2E]">• Periapical Digital{parsed.rxi_piezas?` — Piezas: ${parsed.rxi_piezas}`:""}</div>}
                      {parsed.rxi_total && <div className="text-[11px] text-[#1A1D2E]">• RX Total</div>}
                      {parsed.rxi_bitewing && <div className="text-[11px] text-[#1A1D2E]">• Bitewing{parsed.rxi_bitewingDer?" Derecha":""}{parsed.rxi_bitewingIzq?" Izquierda":""}</div>}
                      {parsed.rxe_panoramica && <div className="text-[11px] text-[#1A1D2E]">• Panorámica</div>}
                      {(parsed.rxe_telerLateral||parsed.rxe_telerAntero) && <div className="text-[11px] text-[#1A1D2E]">• Telerradiografía{parsed.rxe_telerLateral?" Lateral":""}{parsed.rxe_telerAntero?" Anteroposterior":""}</div>}
                      {parsed.rxe_manoCarpo && <div className="text-[11px] text-[#1A1D2E]">• RX Mano/Carpo</div>}
                      {(parsed.sc_arcadaSup||parsed.sc_arcadaInf) && <div className="text-[11px] text-[#1A1D2E]">• Scanner Intraoral{parsed.sc_arcadaSup?" Sup":""}{parsed.sc_arcadaInf?" Inf":""}</div>}
                      {(parsed.cb_maxilarSup||parsed.cb_mandibula||parsed.cb_ATM) && <div className="text-[11px] text-[#1A1D2E]">• Cone Beam{parsed.cb_maxilarSup?" Maxilar Sup":""}{parsed.cb_mandibula?" Mandíbula":""}{parsed.cb_ATM?" ATM":""}{parsed.cb_zona?` Zona: ${parsed.cb_zona}`:""}</div>}
                      {/* Legacy format support */}
                      {parsed.items?.map((item: any, i: number) => (
                        <div key={i} className="text-[11px] text-[#1A1D2E]">• {item.type}{item.zone?` — ${item.zone}`:""}</div>
                      ))}
                      {parsed.indication && <p className="text-[11px] text-[#9AA0B4] mt-1">Indicación: {parsed.indication}</p>}
                      {parsed.meInteresa && <p className="text-[11px] text-[#9AA0B4] mt-1">Notas: {parsed.meInteresa}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 8: PAGOS ===== */}
      {tab===8&&(
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

      {/* ===== TAB 9: DOCUMENTOS ===== */}
      {tab===9&&(
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

      {/* ===== TAB 10: CITAS ===== */}
      {tab===10&&(
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

      {/* ===== MODAL EVOLUCIÓN (estilo imagen 10) ===== */}
      <Modal open={evoModal} onClose={()=>setEvoModal(false)} title="Nueva evolución" size="lg">
        <div className="overflow-y-auto max-h-[80vh]">

          {/* ── Cabecera: profesional + fecha ── */}
          <div className="px-6 pt-5 pb-4 border-b border-[#E3E8F0] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Profesional *</label>
              <select className="select text-[13px]" value={evoForm.userId} onChange={e=>setEvoForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar profesional...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Fecha</label>
              <input className="input text-[13px]" type="date" value={evoForm.date}
                onChange={e=>setEvoForm(f=>({...f,date:e.target.value}))}/>
            </div>
          </div>

          {/* ── Editor de evolución ── */}
          <div className="px-6 py-4">
            {/* Barra de formato */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-0.5 bg-[#F0F2F7] rounded-lg p-1">
                {[
                  {label:"P", title:"Párrafo", cls:"font-normal text-[12px]"},
                  {label:"B", title:"Negrita", cls:"font-bold text-[13px]"},
                  {label:"I", title:"Cursiva", cls:"italic text-[13px]"},
                  {label:"U", title:"Subrayado", cls:"underline text-[13px]"},
                  {label:"S", title:"Tachado", cls:"line-through text-[12px]"},
                ].map(btn=>(
                  <button key={btn.label} title={btn.title}
                    className={`w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-[#4B5563] ${btn.cls}`}>
                    {btn.label}
                  </button>
                ))}
                <div className="w-px h-5 bg-[#E3E8F0] mx-1"/>
                {[{label:"≡",title:"Alineación"},{label:"↓",title:"Lista"},{label:"A",title:"Color"}].map(btn=>(
                  <button key={btn.label} title={btn.title}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm transition-all text-[#4B5563] text-[13px]">
                    {btn.label}
                  </button>
                ))}
              </div>
              {/* Usar plantilla */}
              <div className="relative">
                <select className="appearance-none text-[12px] font-semibold bg-[#EEF3FF] text-[#0057FF] border border-[#0057FF]/20 rounded-lg px-3 py-1.5 pr-7 cursor-pointer focus:outline-none"
                  value=""
                  onChange={e=>{
                    const tmpl = CARE_TEMPLATES[e.target.value];
                    if (tmpl) setEvoForm(f=>({...f, observations:(f.observations?f.observations+"\n\n":"")+tmpl}));
                    (e.target as HTMLSelectElement).value="";
                  }}>
                  <option value="">+ Usar plantilla</option>
                  {Object.keys(CARE_TEMPLATES).map(k=><option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#0057FF] pointer-events-none rotate-90"/>
              </div>
            </div>

            {/* Área de diagnóstico (opcional) */}
            <input className="input text-[13px] mb-3" value={evoForm.diagnosis}
              onChange={e=>setEvoForm(f=>({...f,diagnosis:e.target.value}))}
              placeholder="Diagnóstico (opcional)..."/>

            {/* Área de texto principal */}
            <div className="relative border border-[#E3E8F0] rounded-xl bg-white overflow-hidden">
              <textarea
                className="w-full text-[13px] px-4 py-3 focus:outline-none resize-none leading-relaxed text-[#1A1D2E]"
                rows={7}
                value={evoForm.observations}
                onChange={e=>setEvoForm(f=>({...f,observations:e.target.value}))}
                placeholder="Escribe o dicta la evolución..."/>
              <div className="px-4 py-2 border-t border-[#F0F2F7] flex items-center justify-end gap-3">
                <button className="text-[11px] text-[#9AA0B4] hover:text-[#0057FF] transition-colors">
                  Danos tu opinión
                </button>
                <button className="flex items-center gap-1.5 text-[12px] font-semibold bg-[#1A1D2E] text-white px-3 py-1.5 rounded-lg hover:bg-[#374151] transition-colors">
                  🎤 Dictar
                </button>
              </div>
            </div>
          </div>

          {/* ── Tratamientos de presupuesto (collapsible) ── */}
          {allActiveBudgetItems.length > 0 && (
            <div className="px-6 pb-4">
              <details className="border border-[#E3E8F0] rounded-xl overflow-hidden">
                <summary className="px-4 py-3 text-[12px] font-semibold text-[#4B5563] cursor-pointer hover:bg-[#F0F2F7] transition-colors select-none">
                  Vincular con tratamientos de presupuesto ({Object.values(evoBudgetSelections).filter(v=>v.selected).length} seleccionados)
                </summary>
                <div className="border-t border-[#E3E8F0] divide-y divide-[#F0F2F7] max-h-48 overflow-y-auto">
                  {allActiveBudgetItems.map(item => {
                    const sel = evoBudgetSelections[item.id] ?? { selected:false, newStatus:item.status||"in_progress" };
                    return (
                      <label key={item.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${sel.selected?"bg-[#EEF3FF]":"hover:bg-[#F8F9FC]"}`}>
                        <input type="checkbox" checked={sel.selected}
                          onChange={e=>setEvoBudgetSelections(s=>({...s,[item.id]:{...(s[item.id]??{selected:false,newStatus:item.status||"in_progress"}),selected:e.target.checked}}))}
                          className="w-3.5 h-3.5 rounded border-[#E3E8F0] text-[#0057FF]"/>
                        <span className="text-[10px] text-[#9AA0B4] font-mono flex-shrink-0">#{item.budgetNumber}</span>
                        <span className="flex-1 text-[12px] font-medium text-[#1A1D2E] truncate">{item.description}</span>
                        {item.tooth&&<span className="text-[10px] text-[#9AA0B4]">D.{item.tooth}</span>}
                        <span className="text-[11px] font-semibold text-[#0057FF]">{fmt(item.total)}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            </div>
          )}

          {/* ── Recordatorio ── */}
          <div className="px-6 pb-4">
            <p className="text-[11px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-2">Recordatorio de control</p>
            <div className="flex gap-1.5 flex-wrap">
              {[{v:0,l:"Sin recordatorio"},{v:3,l:"3 meses"},{v:6,l:"6 meses"},{v:12,l:"12 meses"}].map(opt=>(
                <button key={opt.v} type="button" onClick={()=>setEvoReminder(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${evoReminder===opt.v?"bg-amber-500 text-white border-amber-500":"bg-white text-amber-700 border-amber-200 hover:border-amber-400"}`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-[#E3E8F0] bg-[#F8F9FC] flex items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={()=>setEvoForm(f=>({...f,isPrivate:!f.isPrivate}))}
              className={`relative w-9 h-5 rounded-full transition-colors ${evoForm.isPrivate?"bg-[#0057FF]":"bg-[#D1D5DB]"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${evoForm.isPrivate?"translate-x-4":"translate-x-0.5"}`}/>
            </div>
            <span className="text-[12px] font-medium text-[#4B5563]">Evolución privada</span>
          </label>
          <div className="flex gap-2">
            <button className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors"
              onClick={()=>setEvoModal(false)}>
              Cerrar
            </button>
            <button className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors disabled:opacity-60"
              onClick={saveEvo} disabled={saving||!evoForm.userId||(!evoForm.observations.trim()&&!evoForm.treatment.trim()&&!Object.values(evoBudgetSelections).some(v=>v.selected))}>
              {saving ? "Guardando..." : "Crear nueva evolución"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL EDITAR EVOLUCIÓN ===== */}
      <Modal open={evoEditModal} onClose={()=>setEvoEditModal(false)} title="Editar evolución" size="lg">
        <div className="overflow-y-auto max-h-[80vh]">
          <div className="px-6 pt-5 pb-4 border-b border-[#E3E8F0] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Profesional</label>
              <select className="select text-[13px]" value={evoEditForm.userId} onChange={e=>setEvoEditForm(f=>({...f,userId:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#9AA0B4] uppercase tracking-wide mb-1.5">Fecha</label>
              <input className="input text-[13px]" type="date" value={evoEditForm.date} onChange={e=>setEvoEditForm(f=>({...f,date:e.target.value}))}/>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            <input className="input text-[13px]" value={evoEditForm.diagnosis} onChange={e=>setEvoEditForm(f=>({...f,diagnosis:e.target.value}))} placeholder="Diagnóstico (opcional)..."/>
            <input className="input text-[13px]" value={evoEditForm.treatment} onChange={e=>setEvoEditForm(f=>({...f,treatment:e.target.value}))} placeholder="Tratamiento *"/>
            <input className="input text-[13px]" value={evoEditForm.tooth} onChange={e=>setEvoEditForm(f=>({...f,tooth:e.target.value}))} placeholder="Diente (ej: 1.6)"/>
            <textarea className="input resize-none text-[13px]" rows={5} value={evoEditForm.observations} onChange={e=>setEvoEditForm(f=>({...f,observations:e.target.value}))} placeholder="Observaciones..."/>
            <input type="number" className="input text-[13px]" value={evoEditForm.cost} onChange={e=>setEvoEditForm(f=>({...f,cost:e.target.value}))} placeholder="Costo ($)"/>
          </div>
          <div className="px-6 py-3 border-t border-[#E3E8F0] bg-[#F8F9FC] flex justify-end gap-2">
            <button className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors" onClick={()=>setEvoEditModal(false)}>Cancelar</button>
            <button className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors disabled:opacity-60"
              onClick={saveEvoEdit} disabled={evoEditSaving||!evoEditForm.userId||!evoEditForm.treatment.trim()}>
              {evoEditSaving?"Guardando...":"Guardar cambios"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL SOLICITUD RADIOGRAFÍA ===== */}
      <Modal open={rxDocModal} onClose={()=>setRxDocModal(false)} title="Solicitud de Radiografía / Scanner" size="xl">
        <div className="overflow-y-auto max-h-[85vh]">
          {/* Header */}
          <div className="px-5 py-3 border-b border-[#E3E8F0] grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Paciente</p>
              <p className="font-semibold text-slate-900 text-[13px]">{patient.firstName} {patient.lastName}</p>
              <p className="text-[11px] text-slate-400 font-mono">{patient.rut}</p>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#9AA0B4] uppercase block mb-1">Profesional *</label>
              <select className="select text-[13px]" value={rxDocUserId} onChange={e=>setRxDocUserId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="px-4 py-3 space-y-2.5">
            {/* Helper inline */}
            {(()=>{
              const ck = (key: keyof RxFormData) => (e: React.ChangeEvent<HTMLInputElement>) => setRxForm(f=>({...f,[key]:e.target.checked}));
              const tx = (key: keyof RxFormData) => (e: React.ChangeEvent<HTMLInputElement>) => setRxForm(f=>({...f,[key]:e.target.value}));
              const mailHdr = (con: keyof RxFormData, sin: keyof RxFormData) => (
                <div className="flex items-center gap-2 ml-auto">
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-[#1e40af] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer">
                    <input type="checkbox" checked={rxForm[con] as boolean} onChange={ck(con)} className="w-2.5 h-2.5"/> Con Informe
                  </label>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-[#1e40af] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer">
                    <input type="checkbox" checked={rxForm[sin] as boolean} onChange={ck(sin)} className="w-2.5 h-2.5"/> Sin Informe
                  </label>
                </div>
              );
              return (
                <>
                  {/* RX INTRAORAL */}
                  <div className="border border-blue-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-blue-50">
                      <span className="text-[11px] font-bold text-[#1e40af] uppercase tracking-wide flex-1">RX INTRAORAL</span>
                      {mailHdr("rxi_mailCon","rxi_mailSin")}
                    </div>
                    <div className="divide-y divide-[#F0F2F7]">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input type="checkbox" checked={rxForm.rxi_periapical} onChange={ck("rxi_periapical")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E] flex-shrink-0">Periapical Digital Piezas</span>
                        <input type="text" value={rxForm.rxi_piezas} onChange={tx("rxi_piezas")} placeholder="ej: 1.6, 2.5, 3.7..." className="flex-1 border-b border-[#E3E8F0] bg-transparent text-[12px] outline-none px-1 min-w-0"/>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input type="checkbox" checked={rxForm.rxi_total} onChange={ck("rxi_total")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">RX Total</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.rxi_bitewing} onChange={ck("rxi_bitewing")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">Bitewing</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.rxi_bitewingDer} onChange={ck("rxi_bitewingDer")} className="w-3 h-3"/> Derecha</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.rxi_bitewingIzq} onChange={ck("rxi_bitewingIzq")} className="w-3 h-3"/> Izquierda</label>
                      </div>
                    </div>
                  </div>

                  {/* RX EXTRAORAL */}
                  <div className="border border-amber-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-amber-50">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex-1">RX EXTRAORAL</span>
                      {mailHdr("rxe_mailCon","rxe_mailSin")}
                    </div>
                    <div className="divide-y divide-[#F0F2F7]">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input type="checkbox" checked={rxForm.rxe_panoramica} onChange={ck("rxe_panoramica")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">Panorámica</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.rxe_telerLateral||rxForm.rxe_telerAntero} onChange={e=>{setRxForm(f=>({...f,rxe_telerLateral:e.target.checked,rxe_telerAntero:false}))}} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">Telerradiografía</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.rxe_telerLateral} onChange={ck("rxe_telerLateral")} className="w-3 h-3"/> Lateral</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.rxe_telerAntero} onChange={ck("rxe_telerAntero")} className="w-3 h-3"/> Anteroposterior</label>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input type="checkbox" checked={rxForm.rxe_manoCarpo} onChange={ck("rxe_manoCarpo")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">RX Mano/Carpo</span>
                      </div>
                    </div>
                  </div>

                  {/* SCANNER INTRAORAL */}
                  <div className="border border-emerald-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex-1">SCANNER INTRAORAL (ITERO-INVISALIGN)</span>
                      <label className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded cursor-pointer">
                        <input type="checkbox" checked={rxForm.sc_mail} onChange={ck("sc_mail")} className="w-2.5 h-2.5"/> Envío por Mail
                      </label>
                    </div>
                    <div className="divide-y divide-[#F0F2F7]">
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.sc_arcadaSup} onChange={ck("sc_arcadaSup")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">Arcada superior</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.sc_mordidaMIC} onChange={ck("sc_mordidaMIC")} className="w-3 h-3"/> Mordida en MIC</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.sc_STL} onChange={ck("sc_STL")} className="w-3 h-3"/> STL</label>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.sc_arcadaInf} onChange={ck("sc_arcadaInf")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E]">Arcada inferior</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.sc_invisalign} onChange={ck("sc_invisalign")} className="w-3 h-3"/> Asociar a Invisalign Doctor</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.sc_PLY} onChange={ck("sc_PLY")} className="w-3 h-3"/> PLY</label>
                      </div>
                    </div>
                  </div>

                  {/* TOMOGRAFÍA CONE BEAM */}
                  <div className="border border-red-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2 bg-red-50">
                      <span className="text-[11px] font-bold text-red-800 uppercase tracking-wide flex-1">TOMOGRAFÍA — CONE BEAM</span>
                      {mailHdr("cb_mailCon","cb_mailSin")}
                    </div>
                    <div className="divide-y divide-[#F0F2F7]">
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.cb_maxilarSup} onChange={ck("cb_maxilarSup")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E] flex-shrink-0">Scanner Maxilar Superior</span>
                        <span className="text-[11px] text-[#9AA0B4] flex-shrink-0">Para Evaluar:</span>
                        <input type="text" value={rxForm.cb_paraEvaluar} onChange={tx("cb_paraEvaluar")} className="w-28 border-b border-[#E3E8F0] bg-transparent text-[11px] outline-none px-1"/>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_implantes} onChange={ck("cb_implantes")} className="w-3 h-3"/> Implantes</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_cortesPDF} onChange={ck("cb_cortesPDF")} className="w-3 h-3"/> Cortes en PDF</label>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.cb_mandibula} onChange={ck("cb_mandibula")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E] flex-shrink-0">Scanner Mandíbula</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_tercerosMolares} onChange={ck("cb_tercerosMolares")} className="w-3 h-3"/> Terceros Molares</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_visualizadorCD} onChange={ck("cb_visualizadorCD")} className="w-3 h-3"/> Visualizador en CD/DVD</label>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <span className="text-[12px] font-medium text-[#1A1D2E] flex-shrink-0 pl-5">Scanner Zona:</span>
                        <input type="text" value={rxForm.cb_zona} onChange={tx("cb_zona")} className="w-28 border-b border-[#E3E8F0] bg-transparent text-[11px] outline-none px-1"/>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_fractura} onChange={ck("cb_fractura")} className="w-3 h-3"/> Fractura</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_DICOM} onChange={ck("cb_DICOM")} className="w-3 h-3"/> DICOM nativos .DCM</label>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <span className="pl-5"/>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_zonaMax3} onChange={ck("cb_zonaMax3")} className="w-3 h-3"/> Zona máx. 3 piezas contiguas</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_dienteIncluido} onChange={ck("cb_dienteIncluido")} className="w-3 h-3"/> Diente Incluido</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_wetransfer} onChange={ck("cb_wetransfer")} className="w-3 h-3"/> Visualizador por Wetransfer</label>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                        <input type="checkbox" checked={rxForm.cb_ATM} onChange={ck("cb_ATM")} className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"/>
                        <span className="text-[12px] font-medium text-[#1A1D2E] flex-shrink-0">ATM</span>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_bocaAbierta} onChange={ck("cb_bocaAbierta")} className="w-3 h-3"/> Boca Abierta</label>
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.cb_bocaCerrada} onChange={ck("cb_bocaCerrada")} className="w-3 h-3"/> Boca Cerrada</label>
                      </div>
                    </div>
                  </div>

                  {/* ANÁLISIS CEFALOMÉTRICOS */}
                  <div className="border border-purple-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-purple-50">
                      <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">ANÁLISIS CEFALOMÉTRICOS</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                      {([["cef_ricketts","Ricketts"],["cef_rothJarabak","Roth-Jarabak"],["cef_steiner","Steiner"],["cef_mcnamara","Mcnamara"],["cef_roth","Roth"],["cef_sassouniPlus","Sassouni Plus"],["cef_tweed","Tweed"]] as [keyof RxFormData,string][]).map(([k,l])=>(
                        <label key={k} className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <input type="checkbox" checked={rxForm[k] as boolean} onChange={ck(k)} className="w-3 h-3"/> {l}
                        </label>
                      ))}
                      <span className="text-[11px] text-[#9AA0B4]">Otro:</span>
                      <input type="text" value={rxForm.cef_otro} onChange={e=>setRxForm(f=>({...f,cef_otro:e.target.value}))} className="flex-1 min-w-[80px] border-b border-[#E3E8F0] bg-transparent text-[11px] outline-none px-1"/>
                    </div>
                  </div>

                  {/* ESTUDIO DE FOTOS */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">ESTUDIO DE FOTOS</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.foto_clinicas} onChange={ck("foto_clinicas")} className="w-3 h-3"/> Fotos Clínicas</label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.foto_overjet} onChange={ck("foto_overjet")} className="w-3 h-3"/> Incluir Overjet</label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.foto_setPDF} onChange={ck("foto_setPDF")} className="w-3 h-3"/> Set en PDF</label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="checkbox" checked={rxForm.foto_unitarias} onChange={ck("foto_unitarias")} className="w-3 h-3"/> Unitarias en JPG</label>
                    </div>
                  </div>

                  {/* ME INTERESA SABER */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#9AA0B4] uppercase block mb-1">Me interesa saber</label>
                    <input type="text" value={rxForm.meInteresa} onChange={e=>setRxForm(f=>({...f,meInteresa:e.target.value}))}
                      className="input text-[12px] w-full" placeholder="Observaciones adicionales..."/>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#E3E8F0] flex justify-between items-center gap-3 flex-wrap">
          <button className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#E3E8F0] bg-white text-[#4B5563] hover:bg-[#F0F2F7] transition-colors" onClick={()=>setRxDocModal(false)}>Cancelar</button>
          <button disabled={rxDocPdfSending||!rxDocUserId} onClick={async()=>{
              setRxDocPdfSending(true);
              try {
                const saveRes = await fetch("/api/prescriptions", { method:"POST", headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({ patientId:id, userId:rxDocUserId, date:new Date().toISOString().split("T")[0], type:"rxrequest", content:JSON.stringify(rxForm) }) });
                if(!saveRes.ok){ const errJson = await saveRes.json().catch(()=>null); showToast(`❌ ${errJson?.error ?? `Error ${saveRes.status}`}`); setRxDocPdfSending(false); return; }
                await load();
                showToast("✅ Solicitud guardada");
                setRxDocModal(false);
                setRxForm({...EMPTY_RX_FORM});
              } catch(e){ showToast(`❌ Error: ${String(e)}`); }
              setRxDocPdfSending(false);
            }}
              className="flex items-center gap-1.5 text-[13px] px-5 py-2 rounded-lg bg-[#0057FF] text-white hover:bg-[#0041CC] font-semibold disabled:opacity-40 transition-colors">
              <Save size={14}/> {rxDocPdfSending?"Guardando...":"Guardar"}
            </button>
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
                        <select
                          value={item.status||"pending"}
                          onChange={e=>updateItemStatus(item.id, e.target.value)}
                          className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-1 focus:ring-[#0057FF] cursor-pointer ${
                            item.status==="completed"?"bg-emerald-50 text-emerald-700 border-emerald-200":
                            item.status==="in_progress"?"bg-amber-50 text-amber-700 border-amber-200":
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                          <option value="pending">Pendiente</option>
                          <option value="in_progress">En progreso</option>
                          <option value="completed">Terminado</option>
                        </select>
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
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
