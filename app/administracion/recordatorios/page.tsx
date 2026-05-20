"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Clock, CheckCircle, XCircle, XCircle as CancelIcon, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useRole";

interface Template { type: string; subject: string; body: string; active: boolean; }
interface Reminder {
  id: string; patientId: string; months: number; sendDate: string;
  sent: boolean; cancelled: boolean; createdAt: string;
  patient: { firstName: string; lastName: string; email: string };
}
interface Log { id: string; toEmail: string; patientName: string; subject: string; status: string; sentAt: string; }

function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`}/>
    </button>
  );
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

const SUBTABS = ["Configuración", "Programados", "Historial"];

export default function RecordatoriosPage() {
  const isAdmin = useIsAdmin();
  const [subtab, setSubtab] = useState(0);
  const [tpl, setTpl]       = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [active, setActive]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [logs, setLogs]           = useState<Log[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tRes, rRes, lRes] = await Promise.all([
      fetch("/api/email-templates/reminder"),
      fetch("/api/reminders"),
      fetch("/api/email-logs?type=reminder"),
    ]);
    const t = await tRes.json();
    setTpl(t); setSubject(t.subject); setBody(t.body); setActive(t.active);
    setReminders(await rRes.json());
    setLogs(await lRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setSaved(false);
    await fetch("/api/email-templates/reminder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, active }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function cancel(id: string) {
    setCancelling(id);
    await fetch(`/api/reminders/${id}`, { method: "PATCH" });
    setCancelling(null);
    load();
  }

  if (!isAdmin) return null;

  const pending   = reminders.filter(r => !r.sent && !r.cancelled);
  const completed = reminders.filter(r => r.sent);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/administracion" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div>
          <h1 className="page-title">Recordatorios de Control</h1>
          <p className="text-muted">Seguimiento automático a 3, 6, 12 o 24 meses</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px gap-1">
          {SUBTABS.map((t, i) => (
            <button key={t} onClick={() => setSubtab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${subtab === i ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {t}
              {i === 1 && pending.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs bg-primary-600 text-white rounded-full">{pending.length > 9 ? "9+" : pending.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Configuración ── */}
      {subtab === 0 && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Envío automático</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {active ? "Activo — los recordatorios se envían al vencer" : "Pausado — ningún recordatorio se enviará"}
              </p>
            </div>
            <Toggle active={active} onChange={setActive}/>
          </div>

          <div className="border-t border-slate-100"/>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Asunto</label>
            <p className="text-xs text-slate-400 mb-1.5">
              Variables: <code className="bg-slate-100 px-1 rounded">{"{nombre}"}</code>{" "}
              <code className="bg-slate-100 px-1 rounded">{"{meses}"}</code>{" "}
              <code className="bg-slate-100 px-1 rounded">{"{fecha}"}</code>
            </p>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="input w-full"/>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className="input w-full resize-y font-sans text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-sm transition-opacity ${saved ? "text-emerald-600 opacity-100" : "opacity-0"}`}>✓ Guardado</span>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </div>
      )}

      {/* ── Programados ── */}
      {subtab === 1 && (
        <div className="card overflow-hidden">
          {pending.length === 0 ? (
            <div className="py-14 text-center text-muted text-sm">No hay recordatorios pendientes.</div>
          ) : (
            <>
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="col-span-4">Paciente</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2 text-center">Meses</div>
                <div className="col-span-2">Fecha envío</div>
                <div className="col-span-1"/>
              </div>
              <div className="divide-y divide-slate-100">
                {pending.map(r => (
                  <div key={r.id} className="px-5 py-3 grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.patient.firstName} {r.patient.lastName}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-slate-500 truncate">{r.patient.email || "—"}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 font-medium">
                        {r.months} m
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">{fmtDate(r.sendDate)}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => cancel(r.id)}
                        disabled={cancelling === r.id}
                        title="Cancelar recordatorio"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <CancelIcon size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Historial ── */}
      {subtab === 2 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Clock size={14} className="text-slate-400"/>
            <h2 className="text-sm font-semibold text-slate-700">Historial de envíos</h2>
          </div>
          {logs.length === 0 ? (
            <div className="py-12 text-center text-muted text-sm">Sin recordatorios enviados aún.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map(l => (
                <div key={l.id} className="px-5 py-3 flex items-center gap-4">
                  {l.status === "sent"
                    ? <CheckCircle size={15} className="text-emerald-500 flex-shrink-0"/>
                    : <XCircle size={15} className="text-red-400 flex-shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{l.patientName}</p>
                    <p className="text-xs text-slate-500 truncate">{l.subject}</p>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">{fmtDateTime(l.sentAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
