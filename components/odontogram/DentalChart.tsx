"use client";
import { useState } from "react";

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export const CONDITIONS: Record<string, { label: string; bg: string; border: string; text: string }> = {
  healthy:    { label: "Sano",         bg: "bg-emerald-50",  border: "border-emerald-300", text: "text-emerald-700" },
  caries:     { label: "Caries",       bg: "bg-red-100",     border: "border-red-400",     text: "text-red-700" },
  filling:    { label: "Obturado",     bg: "bg-blue-100",    border: "border-blue-400",    text: "text-blue-700" },
  crown:      { label: "Corona",       bg: "bg-yellow-100",  border: "border-yellow-400",  text: "text-yellow-700" },
  extracted:  { label: "Extraído",     bg: "bg-slate-200",   border: "border-slate-400",   text: "text-slate-500" },
  implant:    { label: "Implante",     bg: "bg-purple-100",  border: "border-purple-400",  text: "text-purple-700" },
  root_canal: { label: "Conducto",     bg: "bg-orange-100",  border: "border-orange-400",  text: "text-orange-700" },
  absent:     { label: "Ausente",      bg: "bg-slate-100",   border: "border-dashed border-slate-300", text: "text-slate-400" },
  bridge:     { label: "Puente",       bg: "bg-sky-100",     border: "border-sky-400",     text: "text-sky-700" },
  fracture:   { label: "Fractura",     bg: "bg-rose-100",    border: "border-rose-400",    text: "text-rose-700" },
};

interface ToothData { condition: string; notes: string }
type OdontogramData = Record<string, ToothData>;

interface Props {
  data: OdontogramData;
  onChange: (data: OdontogramData) => void;
  readonly?: boolean;
}

export default function DentalChart({ data, onChange, readonly }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ToothData>({ condition: "healthy", notes: "" });

  function openTooth(tooth: number) {
    if (readonly) return;
    const current = data[tooth] ?? { condition: "healthy", notes: "" };
    setForm(current);
    setEditing(String(tooth));
  }

  function saveTooth() {
    if (!editing) return;
    onChange({ ...data, [editing]: form });
    setEditing(null);
  }

  function clearTooth() {
    if (!editing) return;
    const next = { ...data };
    delete next[editing];
    onChange(next);
    setEditing(null);
  }

  function Tooth({ n }: { n: number }) {
    const key = String(n);
    const d = data[key];
    const c = d ? CONDITIONS[d.condition] ?? CONDITIONS.healthy : null;
    return (
      <button onClick={() => openTooth(n)} title={`Diente ${n}${d ? ` — ${CONDITIONS[d.condition]?.label}` : ""}`}
        className={`relative w-9 h-10 rounded border-2 flex flex-col items-center justify-center text-xs font-bold transition-all hover:scale-110 ${
          c ? `${c.bg} ${c.border} ${c.text}` : "bg-white border-slate-200 text-slate-500 hover:border-blue-400"
        } ${readonly ? "cursor-default" : "cursor-pointer"}`}
      >
        <span className="text-[10px] leading-none">{n}</span>
        {d && d.condition === "extracted" && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-lg font-light">×</span>
        )}
      </button>
    );
  }

  return (
    <div className="select-none">
      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(CONDITIONS).map(([k, v]) => (
          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${v.bg} ${v.border} ${v.text}`}>
            {v.label}
          </span>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-1">
        {/* Upper teeth */}
        <p className="text-xs text-slate-400 text-center mb-1">MAXILAR SUPERIOR</p>
        <div className="flex justify-center gap-0.5 flex-wrap">
          {UPPER.map((n) => <Tooth key={n} n={n} />)}
        </div>
        {/* Divider */}
        <div className="border-t-2 border-dashed border-slate-300 my-2" />
        {/* Lower teeth */}
        <div className="flex justify-center gap-0.5 flex-wrap">
          {LOWER.map((n) => <Tooth key={n} n={n} />)}
        </div>
        <p className="text-xs text-slate-400 text-center mt-1">MAXILAR INFERIOR</p>
      </div>

      {/* Edit popup */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-5 w-72 z-10">
            <h3 className="font-semibold text-slate-900 mb-3">Diente {editing}</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Condición</label>
                <select className="select" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                  {Object.entries(CONDITIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={clearTooth} className="text-xs text-red-500 hover:underline mr-auto">Limpiar</button>
              <button onClick={() => setEditing(null)} className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
              <button onClick={saveTooth} className="btn-primary text-xs px-3 py-1.5">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
