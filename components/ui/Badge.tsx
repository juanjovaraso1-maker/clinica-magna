const variants: Record<string, string> = {
  scheduled:  "bg-primary-50 text-primary-700 border-primary-200",
  confirmed:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed:  "bg-slate-100 text-slate-600 border-slate-200",
  cancelled:  "bg-red-50 text-red-700 border-red-200",
  "no-show":  "bg-amber-50 text-amber-700 border-amber-200",
  waiting:    "bg-sky-50 text-sky-700 border-sky-200",
  in_progress:"bg-violet-50 text-violet-700 border-violet-200",
  pending:    "bg-amber-50 text-amber-700 border-amber-200",
  approved:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:   "bg-red-50 text-red-700 border-red-200",
  expired:    "bg-slate-100 text-slate-500 border-slate-200",
  admin:      "bg-purple-50 text-purple-700 border-purple-200",
  dentist:    "bg-primary-50 text-primary-700 border-primary-200",
  secretary:  "bg-teal-50 text-teal-700 border-teal-200",
  FONASA:     "bg-sky-50 text-sky-700 border-sky-200",
  default:    "bg-slate-100 text-slate-600 border-slate-200",
};

const labels: Record<string, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  "no-show":   "No asistió",
  waiting:     "En sala de espera",
  in_progress: "En atención",
  pending:   "Pendiente",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  expired:   "Vencido",
  admin:     "Administrador",
  dentist:   "Dentista",
  secretary: "Secretaria",
};

export default function Badge({ value, className = "" }: { value: string; className?: string }) {
  const style = variants[value] ?? variants.default;
  const label = labels[value] ?? value;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${style} ${className}`}>
      {label}
    </span>
  );
}
