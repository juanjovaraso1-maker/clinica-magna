"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Pencil, Trash2, Search, X } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Treatment {
  id: string; name: string; category: string; price: number; description: string; active: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

const CATEGORIES = ["Diagnóstico", "Preventiva", "Periodoncia", "Endodoncia", "Operatoria", "Prótesis", "Cirugía Oral", "Ortodoncia", "Implantología", "Radiología", "Estética Dental", "Estética Facial", "General"];

const initForm = { name: "", category: "General", price: "", description: "" };

export default function Prestaciones() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/treatments");
    if (r.ok) setTreatments(await r.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(initForm); setEditing(null); setOpen(true); }
  function openEdit(t: Treatment) { setForm({ name: t.name, category: t.category, price: String(t.price), description: t.description ?? "" }); setEditing(t); setOpen(true); }

  async function save() {
    setSaving(true);
    const body = { ...form, price: parseFloat(form.price) || 0 };
    if (editing) {
      await fetch("/api/treatments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...body }) });
    } else {
      await fetch("/api/treatments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setOpen(false); load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta prestación?")) return;
    await fetch("/api/treatments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function importExcel(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/treatments/import", { method: "POST", body: fd });
    const d = await r.json();
    alert(`✅ ${d.imported} prestaciones importadas`);
    load();
    setImporting(false);
  }

  const filtered = treatments.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || t.category === catFilter;
    return matchSearch && matchCat;
  });

  const byCategory = filtered.reduce<Record<string, Treatment[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Prestaciones</h1>
          <p className="text-muted">{treatments.length} tratamientos registrados</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importExcel(e.target.files[0]); }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-xs">
            <Upload size={14} /> {importing ? "Importando..." : "Importar Excel"}
          </button>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Nueva Prestación
          </button>
        </div>
      </div>

      {/* Formato excel info */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800 font-medium">📊 Formato Excel para importar</p>
        <p className="text-xs text-blue-600 mt-1">El archivo debe tener columnas: <strong>Nombre | Categoría | Precio | Descripción</strong></p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 text-sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {["Todos", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${catFilter === c ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped by category */}
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat} className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{cat}</p>
            <p className="text-xs text-slate-400">{items.length} prestación{items.length !== 1 ? "es" : ""}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{t.name}</p>
                    {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 w-32">{fmt(t.price)}</td>
                  <td className="px-4 py-3 w-20">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => remove(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="card py-12 text-center text-muted">
          No hay prestaciones. Crea una o importa desde Excel.
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar Prestación" : "Nueva Prestación"}>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Extracción dental simple" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Precio ($)</label>
              <input className="input" type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form.name}>
            {saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
