"use client";
import { useEffect, useState, useCallback } from "react";
import { Send, Clock, Users, ChevronLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useRole";

interface Campaign {
  id: string; subject: string; body: string;
  recipientFilter: string; sentCount: number; sentAt: string;
}

const FILTERS = [
  { value: "all",   label: "Todos los pacientes con email" },
  { value: "Fonasa", label: "Solo pacientes con Fonasa" },
  { value: "Isapre", label: "Solo pacientes con Isapre" },
  { value: "Particular", label: "Solo pacientes particulares" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function CampanasPage() {
  const isAdmin = useIsAdmin();

  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");
  const [filter, setFilter]     = useState("all");
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ sent: number; total: number } | null>(null);
  const [error, setError]       = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/email-campaigns");
    setCampaigns(await res.json());
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("Completa el asunto y el mensaje."); return; }
    setSending(true); setError(""); setResult(null);
    const res = await fetch("/api/email-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, recipientFilter: filter }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) { setError(json.error || "Error al enviar."); return; }
    setResult({ sent: json.sent, total: json.total });
    setSubject(""); setBody(""); setFilter("all");
    loadHistory();
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/administracion" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div>
          <h1 className="page-title">Campañas de Email</h1>
          <p className="text-muted">Envíos masivos a pacientes</p>
        </div>
      </div>

      {/* Composer */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Nuevo envío</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="input w-full"
            placeholder="Ej: Promoción de blanqueamiento dental"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje</label>
          <p className="text-xs text-slate-400 mb-1.5">Puedes usar <code className="bg-slate-100 px-1 rounded">{"{nombre}"}</code> para personalizar con el nombre del paciente.</p>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            className="input w-full resize-y font-sans text-sm"
            placeholder="Estimado/a {nombre}, ..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Destinatarios</label>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input w-full">
            {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
            <Send size={14}/> Enviado a <strong>{result.sent}</strong> de {result.total} pacientes con email.
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending || !subject.trim() || !body.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Send size={15}/>
            {sending ? "Enviando…" : "Enviar ahora"}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Clock size={14} className="text-slate-400"/>
          <h2 className="text-sm font-semibold text-slate-700">Historial de campañas</h2>
        </div>
        {campaigns.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">Sin campañas enviadas aún.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.map(c => (
              <div key={c.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.body}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-slate-500 justify-end">
                      <Users size={11}/> {c.sentCount} enviados
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(c.sentAt)}</p>
                  </div>
                </div>
                {c.recipientFilter !== "all" && (
                  <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                    Filtro: {c.recipientFilter}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
