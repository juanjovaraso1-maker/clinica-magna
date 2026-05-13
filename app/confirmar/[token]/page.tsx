"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2, XCircle, Stethoscope, Clock, Calendar,
  User, MapPin, Phone, CalendarPlus, ArrowLeft, AlertCircle,
  Loader2,
} from "lucide-react";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  notes: string | null;
  box: number;
  patient: { firstName: string; lastName: string; phone: string };
  user: { name: string };
}

type PageStatus = "loading" | "pending" | "confirmed" | "cancelled" | "already" | "error";
type Step = "view" | "cancel-prompt";

const CANCEL_REASONS = [
  "Tengo otro compromiso",
  "Ya no necesito la atención",
  "Problemas de transporte",
  "Cambio de clínica",
  "Otro motivo",
];

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function downloadICS(appt: Appointment) {
  const d = appt.date.replace(/-/g, "");
  const start = `${d}T${appt.startTime.replace(":", "")}00`;
  const end = `${d}T${appt.endTime.replace(":", "")}00`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinica Magna//ES",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${appt.type} — Clínica Magna`,
    `DESCRIPTION:Dr/a. ${appt.user.name}\\nBox ${appt.box}`,
    `LOCATION:Clínica Magna`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cita-clinica-magna.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConfirmarCita() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [step, setStep] = useState<Step>("view");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/appointments/confirm?token=${token}`);
        const data = await r.json();
        if (data.error) { setStatus("error"); return; }
        setAppt(data.appointment);
        setStatus(data.status);
      } catch {
        setStatus("error");
      }
    }
    load();
  }, [token]);

  async function confirm() {
    setActing(true);
    try {
      const r = await fetch("/api/appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "confirm" }),
      });
      const data = await r.json();
      setAppt(data.appointment);
      setStatus(data.status === "already" ? "already" : "confirmed");
    } catch {
      setStatus("error");
    } finally {
      setActing(false);
    }
  }

  async function cancel() {
    setActing(true);
    try {
      const r = await fetch("/api/appointments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "cancel", reason: cancelReason }),
      });
      const data = await r.json();
      setAppt(data.appointment);
      setStatus(data.status === "already" ? "already" : "cancelled");
      setStep("view");
    } catch {
      setStatus("error");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #344e41 0%, #1e2d24 50%, #0f1a13 100%)" }}>

      <div className="w-full max-w-sm">

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#588157" }}>
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Clínica Magna</p>
            <p className="text-slate-400 text-xs">Sistema de Citas Dental</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Loading */}
          {status === "loading" && (
            <div className="p-10 text-center">
              <Loader2 className="w-10 h-10 text-primary-600 mx-auto animate-spin mb-3" />
              <p className="text-slate-500 text-sm">Cargando tu cita...</p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="p-8 text-center">
              <AlertCircle className="w-14 h-14 text-slate-300 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-slate-700 mb-2">Enlace inválido</h1>
              <p className="text-slate-400 text-sm">Este enlace no es válido o ya ha expirado. Contacta a la clínica si necesitas ayuda.</p>
            </div>
          )}

          {/* Already processed */}
          {status === "already" && (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-14 h-14 text-slate-300 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-slate-600 mb-2">Ya respondida</h1>
              <p className="text-slate-400 text-sm">Esta cita ya fue procesada anteriormente.</p>
            </div>
          )}

          {/* Confirmed */}
          {status === "confirmed" && appt && (
            <>
              <div className="bg-emerald-600 px-6 py-5 text-center">
                <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-2" />
                <h1 className="text-xl font-bold text-white">¡Cita Confirmada!</h1>
                <p className="text-emerald-100 text-sm mt-1">Te esperamos</p>
              </div>
              <div className="p-6 space-y-4">
                <AppointmentDetail appt={appt} />
                <button
                  onClick={() => downloadICS(appt)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50 transition-colors"
                >
                  <CalendarPlus size={16} />
                  Agregar al calendario
                </button>
                <ClinicFooter />
              </div>
            </>
          )}

          {/* Cancelled */}
          {status === "cancelled" && appt && (
            <>
              <div className="bg-red-500 px-6 py-5 text-center">
                <XCircle className="w-12 h-12 text-white mx-auto mb-2" />
                <h1 className="text-xl font-bold text-white">Cita Cancelada</h1>
                <p className="text-red-100 text-sm mt-1">Recibimos tu cancelación</p>
              </div>
              <div className="p-6 space-y-4">
                <AppointmentDetail appt={appt} muted />
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 text-sm font-medium mb-1">¿Necesitas reagendar?</p>
                  <p className="text-amber-700 text-xs">Comunícate con nosotros para buscar un nuevo horario.</p>
                </div>
                <ClinicFooter />
              </div>
            </>
          )}

          {/* Pending — step: view */}
          {status === "pending" && step === "view" && appt && (
            <>
              <div className="px-6 pt-6 pb-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Tu cita está agendada</p>
                <h1 className="text-xl font-bold text-slate-900">Confirma tu asistencia</h1>
                <p className="text-slate-500 text-sm mt-1">Por favor, confirma si podrás asistir a tu cita.</p>
              </div>

              <div className="px-6 pb-4">
                <AppointmentDetail appt={appt} />
              </div>

              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={confirm}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                  style={{ background: acting ? "#9ab893" : "#588157" }}
                >
                  {acting
                    ? <Loader2 size={16} className="animate-spin" />
                    : <CheckCircle2 size={16} />
                  }
                  {acting ? "Confirmando..." : "Sí, confirmo mi asistencia"}
                </button>

                <button
                  onClick={() => setStep("cancel-prompt")}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <XCircle size={15} />
                  Necesito cancelar mi cita
                </button>
              </div>
            </>
          )}

          {/* Pending — step: cancel-prompt */}
          {status === "pending" && step === "cancel-prompt" && appt && (
            <>
              <div className="px-6 pt-6 pb-4">
                <button
                  onClick={() => setStep("view")}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-4 transition-colors"
                >
                  <ArrowLeft size={14} /> Volver
                </button>
                <h1 className="text-lg font-bold text-slate-800">¿Cancelar la cita?</h1>
                <p className="text-slate-500 text-sm mt-1">Cuéntanos el motivo (opcional).</p>
              </div>

              <div className="px-6 pb-4">
                <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1.5 text-sm">
                  <p className="text-slate-600 font-medium capitalize">{fmtDate(appt.date)}</p>
                  <p className="text-slate-500">{appt.startTime} · {appt.type}</p>
                </div>

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Motivo</p>
                <div className="space-y-2">
                  {CANCEL_REASONS.map(r => (
                    <label key={r} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer transition-colors hover:bg-slate-50"
                      style={cancelReason === r ? { borderColor: "#ef4444", background: "#fff5f5" } : {}}>
                      <input
                        type="radio" name="reason" value={r}
                        checked={cancelReason === r}
                        onChange={() => setCancelReason(r)}
                        className="accent-red-500"
                      />
                      <span className="text-sm text-slate-700">{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={cancel}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {acting
                    ? <Loader2 size={16} className="animate-spin" />
                    : <XCircle size={16} />
                  }
                  {acting ? "Cancelando..." : "Confirmar cancelación"}
                </button>
                <button
                  onClick={() => setStep("view")}
                  disabled={acting}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                >
                  Volver — no quiero cancelar
                </button>
              </div>
            </>
          )}

        </div>

        <p className="text-center text-slate-500 text-xs mt-5">
          © {new Date().getFullYear()} Clínica Magna · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}

function AppointmentDetail({ appt, muted = false }: { appt: Appointment; muted?: boolean }) {
  const textBase = muted ? "text-slate-400" : "text-slate-700";
  const textMuted = muted ? "text-slate-300" : "text-slate-500";
  const iconColor = muted ? "text-slate-300" : "text-primary-600";

  return (
    <div className={`rounded-xl border ${muted ? "border-slate-100 bg-slate-50" : "border-primary-100 bg-primary-50"} p-4 space-y-2.5`}>
      <div className={`flex items-center gap-3 text-sm ${textBase}`}>
        <Calendar size={15} className={iconColor} />
        <span className="capitalize font-medium">{fmtDate(appt.date)}</span>
      </div>
      <div className={`flex items-center gap-3 text-sm ${textBase}`}>
        <Clock size={15} className={iconColor} />
        <span>{appt.startTime} — {appt.endTime}</span>
      </div>
      <div className={`flex items-center gap-3 text-sm ${textBase}`}>
        <Stethoscope size={15} className={iconColor} />
        <span>{appt.type}</span>
      </div>
      <div className={`flex items-center gap-3 text-sm ${textBase}`}>
        <User size={15} className={iconColor} />
        <span>Dr/a. {appt.user.name} · Box {appt.box}</span>
      </div>
      <div className={`flex items-center gap-3 text-sm ${textBase}`}>
        <User size={15} className={iconColor} />
        <span className={textMuted}>Paciente: {appt.patient.firstName} {appt.patient.lastName}</span>
      </div>
    </div>
  );
}

function ClinicFooter() {
  return (
    <div className="border-t border-slate-100 pt-4 space-y-1.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contacto</p>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Phone size={12} className="text-primary-500" />
        <span>+56 2 2345 6789</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <MapPin size={12} className="text-primary-500" />
        <span>Av. Providencia 1234, Santiago</span>
      </div>
    </div>
  );
}
