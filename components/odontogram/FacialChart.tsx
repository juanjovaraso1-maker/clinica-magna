"use client";
import { useState } from "react";

export const FACIAL_ZONES = [
  { id: "frontal",         label: "Frontal",            x: 120, y: 20,  w: 110, h: 38 },
  { id: "temporal_d",      label: "Temporal D",          x: 20,  y: 40,  w: 90,  h: 30 },
  { id: "temporal_i",      label: "Temporal I",          x: 240, y: 40,  w: 90,  h: 30 },
  { id: "glabela",         label: "Glabela",             x: 145, y: 64,  w: 60,  h: 26 },
  { id: "periorbital_d",   label: "Periorb. D",          x: 45,  y: 80,  w: 90,  h: 28 },
  { id: "periorbital_i",   label: "Periorb. I",          x: 215, y: 80,  w: 90,  h: 28 },
  { id: "nasal",           label: "Nasal",               x: 145, y: 96,  w: 60,  h: 36 },
  { id: "malar_d",         label: "Malar D",             x: 40,  y: 116, w: 95,  h: 32 },
  { id: "malar_i",         label: "Malar I",             x: 215, y: 116, w: 95,  h: 32 },
  { id: "nasogeniano_d",   label: "Nasog. D",            x: 55,  y: 155, w: 80,  h: 28 },
  { id: "nasogeniano_i",   label: "Nasog. I",            x: 215, y: 155, w: 80,  h: 28 },
  { id: "labio_superior",  label: "Labio Sup",           x: 140, y: 142, w: 70,  h: 24 },
  { id: "labio_inferior",  label: "Labio Inf",           x: 140, y: 170, w: 70,  h: 24 },
  { id: "menton",          label: "Mentón",              x: 130, y: 198, w: 90,  h: 28 },
  { id: "mandibula_d",     label: "Mandíbula D",         x: 40,  y: 188, w: 80,  h: 32 },
  { id: "mandibula_i",     label: "Mandíbula I",         x: 230, y: 188, w: 80,  h: 32 },
  { id: "cuello",          label: "Cuello",              x: 120, y: 232, w: 110, h: 36 },
];

const TREATMENTS = [
  "Botox", "Ácido Hialurónico", "Biorrevitalización", "Mesoterapia",
  "Bioestimulación", "Lifting", "PRP", "Grasa autóloga", "Otro",
];

interface ZoneData { treatment: string; units: number; notes: string }
type FacialData = Record<string, ZoneData>;

interface Props { data: FacialData; onChange: (d: FacialData) => void; readonly?: boolean }

export default function FacialChart({ data, onChange, readonly }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneData>({ treatment: "Botox", units: 0, notes: "" });

  function openZone(id: string) {
    if (readonly) return;
    setForm(data[id] ?? { treatment: "Botox", units: 0, notes: "" });
    setEditing(id);
  }

  function save() {
    if (!editing) return;
    onChange({ ...data, [editing]: form });
    setEditing(null);
  }

  function clear() {
    if (!editing) return;
    const next = { ...data };
    delete next[editing];
    onChange(next);
    setEditing(null);
  }

  const zone = editing ? FACIAL_ZONES.find((z) => z.id === editing) : null;

  return (
    <div>
      <div className="flex gap-4 items-start">
        {/* SVG Face */}
        <div className="relative flex-shrink-0">
          <svg width="350" height="280" viewBox="0 0 350 280" className="bg-slate-50 rounded-xl border border-slate-200">
            {/* Face outline */}
            <ellipse cx="175" cy="140" rx="130" ry="128" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" opacity="0.3" />
            {/* Zones */}
            {FACIAL_ZONES.map((z) => {
              const d = data[z.id];
              const filled = !!d;
              return (
                <g key={z.id} onClick={() => openZone(z.id)} style={{ cursor: readonly ? "default" : "pointer" }}>
                  <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={6}
                    fill={filled ? "#dbeafe" : "#f8fafc"}
                    stroke={filled ? "#3b82f6" : "#e2e8f0"}
                    strokeWidth={filled ? 1.5 : 1}
                    className="transition-all hover:fill-blue-100"
                  />
                  <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} textAnchor="middle"
                    fontSize="9" fill={filled ? "#1d4ed8" : "#94a3b8"} fontWeight={filled ? "600" : "400"}>
                    {z.label}
                  </text>
                  {filled && (
                    <text x={z.x + z.w / 2} y={z.y + z.h - 4} textAnchor="middle"
                      fontSize="8" fill="#3b82f6">
                      {d.treatment}{d.units ? ` (${d.units}U)` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend - zones with data */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Zonas tratadas</p>
          {Object.entries(data).length === 0 ? (
            <p className="text-sm text-slate-400 italic">Haz clic en una zona para registrar un tratamiento</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data).map(([id, d]) => {
                const z = FACIAL_ZONES.find((z) => z.id === id);
                return (
                  <div key={id} className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-blue-800">{z?.label ?? id}</p>
                        <p className="text-xs text-blue-700">{d.treatment}{d.units ? ` · ${d.units} U` : ""}</p>
                        {d.notes && <p className="text-xs text-blue-500 italic">{d.notes}</p>}
                      </div>
                      {!readonly && (
                        <button onClick={() => openZone(id)} className="text-blue-400 hover:text-blue-600 text-xs ml-2">
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-5 w-72 z-10">
            <h3 className="font-semibold text-slate-900 mb-1">{zone?.label}</h3>
            <p className="text-xs text-slate-400 mb-3">Estética facial</p>
            <div className="space-y-3">
              <div>
                <label className="label">Tratamiento</label>
                <select className="select" value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}>
                  {TREATMENTS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unidades / Ml</label>
                <input className="input" type="number" min="0" step="0.5" value={form.units}
                  onChange={(e) => setForm((f) => ({ ...f, units: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={clear} className="text-xs text-red-500 hover:underline mr-auto">Limpiar</button>
              <button onClick={() => setEditing(null)} className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
              <button onClick={save} className="btn-primary text-xs px-3 py-1.5">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
