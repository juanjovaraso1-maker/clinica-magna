"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Clock, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useRole";

interface Template { id: string; type: string; subject: string; body: string; active: boolean; }
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
  return new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function CumpleanosPage() {
  const isAdmin = useIsAdmin();
  const [tpl, setTpl]       = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [active, setActive]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [logs, setLogs]       = useState<Log[]>([]);

  const load = useCallback(async () => {
    const [tRes, lRes] = await Promise.all([
      fetch("/api/email-templates/birthday"),
      fetch("/api/email-logs?type=birthday"),
    ]);
    const t = await tRes.json();
    setTpl(t); setSubject(t.subject); setBody(t.body); setActive(t.active);
    setLogs(await lRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setSaved(false);
    await fetch("/api/email-templates/birthday", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, active }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/administracion" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div>
          <h1 className="page-title">Email de Cumpleaños</h1>
          <p className="text-muted">Se envía automáticamente cada día a las 9:00 AM</p>
        </div>
      </div>

      {/* Toggle + editor */}
      <div className="card p-5 space-y-5">
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Envío automático</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {active ? "Activo — se enviará a pacientes que cumplan años hoy" : "Pausado — no se enviará"}
            </p>
          </div>
          <Toggle active={active} onChange={v => { setActive(v); }}/>
        </div>

        <div className="border-t border-slate-100"/>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Asunto</label>
          <p className="text-xs text-slate-400 mb-1.5">Variables: <code className="bg-slate-100 px-1 rounded">{"{nombre}"}</code> <code className="bg-slate-100 px-1 rounded">{"{fecha}"}</code></p>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="input w-full"
          />
        </div>

        {/* Body */}
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
          <span className={`text-sm transition-opacity ${saved ? "text-emerald-600 opacity-100" : "opacity-0"}`}>
            ✓ Guardado
          </span>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Clock size={14} className="text-slate-400"/>
          <h2 className="text-sm font-semibold text-slate-700">Historial de envíos</h2>
        </div>
        {logs.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">Sin envíos registrados aún.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map(l => (
              <div key={l.id} className="px-5 py-3 flex items-center gap-4">
                {l.status === "sent"
                  ? <CheckCircle size={15} className="text-emerald-500 flex-shrink-0"/>
                  : <XCircle size={15} className="text-red-400 flex-shrink-0"/>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.patientName}</p>
                  <p className="text-xs text-slate-500 truncate">{l.toEmail}</p>
                </div>
                <p className="text-xs text-slate-400 flex-shrink-0">{fmtDate(l.sentAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
