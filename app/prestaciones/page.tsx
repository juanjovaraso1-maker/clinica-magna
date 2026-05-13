"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Pencil, Trash2, Search, X, Package, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Treatment {
  id: string; name: string; category: string; price: number; description: string; active: boolean;
}

interface Bundle {
  id: string;
  name: string;
  category: string;
  treatmentIds: string[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function uid() { return Math.random().toString(36).slice(2, 10); }

const CATEGORIES = ["Diagnóstico", "Preventiva", "Periodoncia", "Endodoncia", "Operatoria", "Prótesis", "Cirugía Oral", "Ortodoncia", "Implantología", "Radiología", "Estética Dental", "Estética Facial", "General"];

const initForm = { name: "", category: "General", price: "", description: "" };
const initBundle = (): Bundle => ({ id: uid(), name: "", category: "General", treatmentIds: [] });

export default function Prestaciones() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [pageTab, setPageTab] = useState<"tratamientos" | "paquetes">("tratamientos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bundles
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleEditing, setBundleEditing] = useState<Bundle | null>(null);
  const [bundleForm, setBundleForm] = useState<Bundle>(initBundle());
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleSearch, setBundleSearch] = useState("");

  async function load() {
    const [tr, cr] = await Promise.all([fetch("/api/treatments"), fetch("/api/clinic-config")]);
    if (tr.ok) setTreatments(await tr.json());
    if (cr.ok) {
      const cfg = await cr.json();
      try { setBundles(JSON.parse(cfg.treatment_bundles ?? "[]")); } catch { setBundles([]); }
    }
  }

  useEffect(() => { load(); }, []);

  async function saveBundles(updated: Bundle[]) {
    await fetch("/api/clinic-config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treatment_bundles: JSON.stringify(updated) }),
    });
    setBundles(updated);
  }

  function openNewBundle() { setBundleForm(initBundle()); setBundleEditing(null); setBundleOpen(true); }
  function openEditBundle(b: Bundle) { setBundleForm({ ...b, treatmentIds: [...b.treatmentIds] }); setBundleEditing(b); setBundleOpen(true); }

  async function saveBundle() {
    setBundleSaving(true);
    const updated = bundleEditing
      ? bundles.map(b => b.id === bundleEditing.id ? bundleForm : b)
      : [...bundles, bundleForm];
    await saveBundles(updated);
    setBundleOpen(false);
    setBundleSaving(false);
  }

  async function deleteBundle(id: string) {
    if (!confirm("¿Eliminar este paquete?")) return;
    await saveBundles(bundles.filter(b => b.id !== id));
  }

  function toggleTreatmentInBundle(tId: string) {
    setBundleForm(f => ({
      ...f,
      treatmentIds: f.treatmentIds.includes(tId)
        ? f.treatmentIds.filter(x => x !== tId)
        : [...f.treatmentIds, tId],
    }));
  }

  function openNew() { setForm(initForm); setEditing(null); setOpen(true); }
  function openEdit(t: Treatment) {
    setForm({ name: t.name, category: t.category, price: String(t.price), description: t.description ?? "" });
    setEditing(t); setOpen(true);
  }

  async function save() {
    setSaving(true);
    const body = { ...form, price: parseFloat(form.price) || 0 };
    if (editing) {
      await fetch("/api/treatments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...body }) });
    } else {
      await fetch("/api/treatments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setOpen(false); load(); setSaving(false);
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

  // Bundle treatments resolved
  function bundleTotal(b: Bundle) {
    return b.treatmentIds.reduce((s, tid) => {
      const t = treatments.find(x => x.id === tid);
      return s + (t?.price ?? 0);
    }, 0);
  }

  const filteredBundles = bundles.filter(b =>
    !bundleSearch || b.name.toLowerCase().includes(bundleSearch.toLowerCase()) || b.category.toLowerCase().includes(bundleSearch.toLowerCase())
  );

  const bundleByCat = filteredBundles.reduce<Record<string, Bundle[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Prestaciones</h1>
          <p className="text-muted">{treatments.length} tratamientos · {bundles.length} paquetes</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importExcel(e.target.files[0]); }} />
          {pageTab === "tratamientos" ? (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-xs">
                <Upload size={14} /> {importing ? "Importando..." : "Importar Excel"}
              </button>
              <button onClick={openNew} className="btn-primary">
                <Plus size={16} /> Nueva Prestación
              </button>
            </>
          ) : (
            <button onClick={openNewBundle} className="btn-primary">
              <Plus size={16} /> Nuevo Paquete
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setPageTab("tratamientos")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${pageTab === "tratamientos" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
          Tratamientos
        </button>
        <button onClick={() => setPageTab("paquetes")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${pageTab === "paquetes" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
          <Package size={14} /> Paquetes
          {bundles.length > 0 && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 rounded-full">{bundles.length}</span>}
        </button>
      </div>

      {/* ===== TRATAMIENTOS TAB ===== */}
      {pageTab === "tratamientos" && (
        <>
          <div className="card p-4 bg-primary-50 border-primary-200">
            <p className="text-sm text-primary-800 font-medium">📊 Formato Excel para importar</p>
            <p className="text-xs text-primary-600 mt-1">El archivo debe tener columnas: <strong>Nombre | Categoría | Precio | Descripción</strong></p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 text-sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
            </div>
            <div className="flex gap-1 flex-wrap">
              {["Todos", ...CATEGORIES].map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${catFilter === c ? "bg-primary-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} className="card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{cat}</p>
                  <p className="text-xs text-slate-400">{items.length} prestación{items.length !== 1 ? "es" : ""}</p>
                </div>
                <span className="text-xs text-slate-400">{fmt(items.reduce((s, t) => s + t.price, 0) / items.length)} promedio</span>
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
                          <button onClick={() => openEdit(t)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
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
            <div className="card py-12 text-center text-muted">No hay prestaciones. Crea una o importa desde Excel.</div>
          )}
        </>
      )}

      {/* ===== PAQUETES TAB ===== */}
      {pageTab === "paquetes" && (
        <>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800 font-medium">📦 ¿Qué son los paquetes?</p>
            <p className="text-xs text-amber-700 mt-1">Agrupa tratamientos relacionados. Al crear un presupuesto, puedes seleccionar un paquete completo con un clic — por ejemplo <em>"Endodoncia molar"</em> agrega automáticamente: endodoncia, medicación y reconstrucción.</p>
          </div>

          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-sm" placeholder="Buscar paquetes..." value={bundleSearch} onChange={(e) => setBundleSearch(e.target.value)} />
          </div>

          {bundles.length === 0 ? (
            <div className="card py-16 text-center">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">No hay paquetes creados aún</p>
              <button onClick={openNewBundle} className="btn-primary text-sm"><Plus size={14} /> Crear primer paquete</button>
            </div>
          ) : (
            Object.entries(bundleByCat).map(([cat, bList]) => (
              <div key={cat} className="card overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">{cat}</p>
                  <p className="text-xs text-slate-400">{bList.length} paquete{bList.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {bList.map(b => {
                    const total = bundleTotal(b);
                    const tList = b.treatmentIds.map(tid => treatments.find(x => x.id === tid)).filter(Boolean) as Treatment[];
                    return (
                      <div key={b.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Package size={14} className="text-primary-600 flex-shrink-0" />
                              <p className="font-semibold text-slate-900">{b.name}</p>
                              {total > 0 && <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{fmt(total)}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {tList.map(t => (
                                <span key={t.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.name}</span>
                              ))}
                              {b.treatmentIds.length === 0 && <span className="text-xs text-slate-400 italic">Sin tratamientos asignados</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openEditBundle(b)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => deleteBundle(b.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Modal: Tratamiento */}
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

      {/* Modal: Paquete */}
      <Modal open={bundleOpen} onClose={() => setBundleOpen(false)} title={bundleEditing ? "Editar Paquete" : "Nuevo Paquete"} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre del paquete *</label>
              <input className="input" value={bundleForm.name}
                onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Endodoncia molar completa" />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={bundleForm.category}
                onChange={e => setBundleForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tratamientos incluidos</label>
            <p className="text-xs text-slate-400 mb-2">Selecciona los tratamientos que componen este paquete.</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              {CATEGORIES.map(cat => {
                const catItems = treatments.filter(t => t.category === cat);
                if (!catItems.length) return null;
                return (
                  <div key={cat}>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 sticky top-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat}</p>
                    </div>
                    {catItems.map(t => {
                      const checked = bundleForm.treatmentIds.includes(t.id);
                      return (
                        <label key={t.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors ${checked ? "bg-primary-50" : ""}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleTreatmentInBundle(t.id)}
                            className="accent-primary-600 w-4 h-4 rounded" />
                          <span className="flex-1 text-sm text-slate-800">{t.name}</span>
                          <span className="text-xs text-slate-400">{fmt(t.price)}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {bundleForm.treatmentIds.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">{bundleForm.treatmentIds.length} tratamiento(s) seleccionado(s)</span>
                <span className="font-semibold text-primary-700">
                  Total: {fmt(bundleForm.treatmentIds.reduce((s, tid) => s + (treatments.find(x => x.id === tid)?.price ?? 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setBundleOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveBundle} disabled={bundleSaving || !bundleForm.name}>
            {bundleSaving ? "Guardando..." : bundleEditing ? "Actualizar" : "Crear paquete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
