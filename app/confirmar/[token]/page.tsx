"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Stethoscope, Clock, Calendar } from "lucide-react";

export default function ConfirmarCita() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const action = params.get("action");
  const [status, setStatus] = useState<"loading" | "confirmed" | "rejected" | "already" | "error">("loading");
  const [appt, setAppt] = useState<{ date: string; startTime: string; type: string; patient: { firstName: string }; user: { name: string } } | null>(null);

  useEffect(() => {
    async function handle() {
      const r = await fetch(`/api/appointments/confirm?token=${token}&action=${action ?? "view"}`);
      const data = await r.json();
      if (data.error) { setStatus("error"); return; }
      setAppt(data.appointment);
      setStatus(data.status);
    }
    handle();
  }, [token, action]);

  const icons = {
    confirmed: <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />,
    rejected: <XCircle className="w-16 h-16 text-red-500 mx-auto" />,
    already: <CheckCircle2 className="w-16 h-16 text-slate-400 mx-auto" />,
    loading: <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />,
    error: <XCircle className="w-16 h-16 text-slate-400 mx-auto" />,
  };

  const messages = {
    confirmed: { title: "¡Cita Confirmada!", sub: "Gracias por confirmar su asistencia. Le esperamos.", color: "text-emerald-700" },
    rejected: { title: "Cita Cancelada", sub: "Hemos registrado la cancelación. Lo contactaremos para reagendar.", color: "text-red-700" },
    already: { title: "Ya respondida", sub: "Esta cita ya fue respondida anteriormente.", color: "text-slate-600" },
    loading: { title: "Procesando...", sub: "", color: "text-slate-600" },
    error: { title: "Link inválido", sub: "El enlace no es válido o ya expiró.", color: "text-slate-600" },
  };

  const msg = messages[status];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">Clínica Magna</p>
            <p className="text-slate-400 text-xs">Sistema Dental</p>
          </div>
        </div>
        <div className="p-8 text-center space-y-4">
          {icons[status]}
          <h1 className={`text-xl font-bold ${msg.color}`}>{msg.title}</h1>
          {appt && (
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar size={15} className="text-blue-600" />
                <span><strong>Fecha:</strong> {appt.date}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Clock size={15} className="text-blue-600" />
                <span><strong>Hora:</strong> {appt.startTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Stethoscope size={15} className="text-blue-600" />
                <span><strong>Tipo:</strong> {appt.type}</span>
              </div>
            </div>
          )}
          <p className="text-slate-500 text-sm">{msg.sub}</p>
          {status === "loading" && <p className="text-slate-400 text-sm">Un momento...</p>}
          {action === "view" && status === "loading" && (
            <div className="flex gap-3 justify-center mt-4">
              <a href={`/confirmar/${token}?action=confirm`}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                ✓ Confirmar asistencia
              </a>
              <a href={`/confirmar/${token}?action=reject`}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
                ✗ Cancelar cita
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
