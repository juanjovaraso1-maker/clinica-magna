const variants: Record<string, string> = {
  scheduled:   "bg-[#EEF3FF] text-[#0057FF]",
  confirmed:   "bg-[#E6F7F1] text-[#00A86B]",
  completed:   "bg-[#E6F7F1] text-[#00A86B]",
  cancelled:   "bg-[#FDECEA] text-[#E53935]",
  "no-show":   "bg-[#FEF3C7] text-[#92600A]",
  waiting:     "bg-[#FEF3C7] text-[#92600A]",
  in_progress: "bg-[#EDE9FE] text-[#7C3AED]",
  pending:     "bg-[#FEF3C7] text-[#92600A]",
  approved:    "bg-[#E6F7F1] text-[#00A86B]",
  rejected:    "bg-[#FDECEA] text-[#E53935]",
  expired:     "bg-[#F0F2F7] text-[#9AA0B4]",
  admin:       "bg-[#EDE9FE] text-[#7C3AED]",
  dentist:     "bg-[#EEF3FF] text-[#0057FF]",
  secretary:   "bg-[#E0F2FE] text-[#0891B2]",
  FONASA:      "bg-[#E0F2FE] text-[#0891B2]",
  default:     "bg-[#F0F2F7] text-[#5A6072]",
};

const labels: Record<string, string> = {
  scheduled:   "Programada",
  confirmed:   "Confirmada",
  completed:   "Completada",
  cancelled:   "Cancelada",
  "no-show":   "No asistió",
  waiting:     "En sala de espera",
  in_progress: "En atención",
  pending:     "Pendiente",
  approved:    "Aprobado",
  rejected:    "Rechazado",
  expired:     "Vencido",
  admin:       "Administrador",
  dentist:     "Dentista",
  secretary:   "Secretaria",
};

export default function Badge({ value, className = "" }: { value: string; className?: string }) {
  const style = variants[value] ?? variants.default;
  const label = labels[value] ?? value;
  return (
    <span className={`inline-flex items-center px-[10px] py-[3px] text-[11px] font-semibold rounded-full ${style} ${className}`}>
      {label}
    </span>
  );
}
