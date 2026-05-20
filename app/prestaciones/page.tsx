"use client";
import React, { useEffect, useState, useRef } from "react";
import { Plus, Upload, Pencil, Trash2, Search, X, Package, Pill, BookOpen, GripVertical } from "lucide-react";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";

interface Treatment {
  id: string; name: string; category: string; price: number; description: string; active: boolean;
}
interface Bundle {
  id: string; name: string; category: string; treatmentIds: string[];
}
interface Medication {
  drug: string; dose: string; freq: string; duration: string; route: string; instructions: string;
}
interface RxTemplate {
  id: string; name: string; medications: Medication[]; notes: string;
}
interface CareTemplate {
  id: string; name: string; text: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function uid() { return Math.random().toString(36).slice(2, 10); }

const CATEGORIES = ["Diagnóstico","Preventiva","Periodoncia","Endodoncia","Operatoria","Prótesis","Cirugía Oral","Ortodoncia","Implantología","Radiología","Estética Dental","Estética Facial","General"];
const ROUTES = ["oral","tópica","inyectable","sublingual","inhalatoria","oftálmica"];

const initForm = { name: "", category: "General", price: "", description: "" };
const initBundle = (): Bundle => ({ id: uid(), name: "", category: "General", treatmentIds: [] });
const initMed = (): Medication => ({ drug: "", dose: "", freq: "", duration: "", route: "oral", instructions: "" });
const initRx = (): RxTemplate => ({ id: uid(), name: "", medications: [initMed()], notes: "" });
const initCare = (): CareTemplate => ({ id: uid(), name: "", text: "" });

export default function Prestaciones() {
  const isAdmin = useIsAdmin();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [pageTab, setPageTab] = useState<"tratamientos"|"paquetes"|"recetas"|"indicaciones">("tratamientos");
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

  // RX Templates
  const [rxTemplates, setRxTemplates] = useState<RxTemplate[]>([]);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxEditing, setRxEditing] = useState<RxTemplate | null>(null);
  const [rxForm, setRxForm] = useState<RxTemplate>(initRx());
  const [rxSaving, setRxSaving] = useState(false);

  // Care Templates
  const [careTemplates, setCareTemplates] = useState<CareTemplate[]>([]);
  const [careOpen, setCareOpen] = useState(false);
  const [careEditing, setCareEditing] = useState<CareTemplate | null>(null);
  const [careForm, setCareForm] = useState<CareTemplate>(initCare());
  const [careSaving, setCareSaving] = useState(false);

  async function load() {
    const [tr, cr] = await Promise.all([fetch("/api/treatments"), fetch("/api/clinic-config")]);
    if (tr.ok) setTreatments(await tr.json());
    if (cr.ok) {
      const cfg = await cr.json();
      try { setBundles(JSON.parse(cfg.treatment_bundles ?? "[]")); } catch { setBundles([]); }
      try { setRxTemplates(JSON.parse(cfg.rx_templates ?? "[]")); } catch { setRxTemplates([]); }
      try { setCareTemplates(JSON.parse(cfg.care_templates ?? "[]")); } catch { setCareTemplates([]); }
    }
  }

  useEffect(() => { load(); }, []);

  async function saveCfgKey(key: string, value: string) {
    await fetch("/api/clinic-config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  }

  // ---- Bundles ----
  async function saveBundles(updated: Bundle[]) {
    await saveCfgKey("treatment_bundles", JSON.stringify(updated));
    setBundles(updated);
  }
  function openNewBundle() { setBundleForm(initBundle()); setBundleEditing(null); setBundleOpen(true); }
  function openEditBundle(b: Bundle) { setBundleForm({ ...b, treatmentIds: [...b.treatmentIds] }); setBundleEditing(b); setBundleOpen(true); }
  async function saveBundle() {
    setBundleSaving(true);
    const updated = bundleEditing ? bundles.map(b => b.id === bundleEditing.id ? bundleForm : b) : [...bundles, bundleForm];
    await saveBundles(updated);
    setBundleOpen(false); setBundleSaving(false);
  }
  async function deleteBundle(id: string) {
    if (!confirm("¿Eliminar este paquete?")) return;
    await saveBundles(bundles.filter(b => b.id !== id));
  }
  function toggleTreatmentInBundle(tId: string) {
    setBundleForm(f => ({ ...f, treatmentIds: f.treatmentIds.includes(tId) ? f.treatmentIds.filter(x => x !== tId) : [...f.treatmentIds, tId] }));
  }

  // ---- RX Templates ----
  async function saveRxList(updated: RxTemplate[]) {
    await saveCfgKey("rx_templates", JSON.stringify(updated));
    setRxTemplates(updated);
  }
  function openNewRx() { setRxForm(initRx()); setRxEditing(null); setRxOpen(true); }
  function openEditRx(t: RxTemplate) { setRxForm({ ...t, medications: t.medications.map(m => ({ ...m })) }); setRxEditing(t); setRxOpen(true); }
  async function deleteRx(id: string) {
    if (!confirm("¿Eliminar esta plantilla de receta?")) return;
    await saveRxList(rxTemplates.filter(t => t.id !== id));
  }
  async function saveRx() {
    setRxSaving(true);
    const updated = rxEditing ? rxTemplates.map(t => t.id === rxEditing.id ? rxForm : t) : [...rxTemplates, rxForm];
    await saveRxList(updated);
    setRxOpen(false); setRxSaving(false);
  }
  function addMed() { setRxForm(f => ({ ...f, medications: [...f.medications, initMed()] })); }
  function removeMed(i: number) { setRxForm(f => ({ ...f, medications: f.medications.filter((_, j) => j !== i) })); }
  function updateMed(i: number, k: keyof Medication, v: string) {
    setRxForm(f => ({ ...f, medications: f.medications.map((m, j) => j === i ? { ...m, [k]: v } : m) }));
  }

  // ---- Care Templates ----
  async function saveCareList(updated: CareTemplate[]) {
    await saveCfgKey("care_templates", JSON.stringify(updated));
    setCareTemplates(updated);
  }
  function openNewCare() { setCareForm(initCare()); setCareEditing(null); setCareOpen(true); }
  function openEditCare(t: CareTemplate) { setCareForm({ ...t }); setCareEditing(t); setCareOpen(true); }
  async function deleteCare(id: string) {
    if (!confirm("¿Eliminar esta plantilla de indicaciones?")) return;
    await saveCareList(careTemplates.filter(t => t.id !== id));
  }
  async function saveCare() {
    setCareSaving(true);
    const updated = careEditing ? careTemplates.map(t => t.id === careEditing.id ? careForm : t) : [...careTemplates, careForm];
    await saveCareList(updated);
    setCareOpen(false); setCareSaving(false);
  }

  // ---- Treatments CRUD ----
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
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/treatments/import", { method: "POST", body: fd });
    const d = await r.json();
    alert(`✅ ${d.imported} prestaciones importadas`);
    load(); setImporting(false);
  }

  const filtered = treatments.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || t.category === catFilter;
    return matchSearch && matchCat;
  });
  const byCategory = filtered.reduce<Record<string, Treatment[]>>((acc, t) => { (acc[t.category] ??= []).push(t); return acc; }, {});
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function bundleTotal(b: Bundle) {
    return b.treatmentIds.reduce((s, tid) => { const t = treatments.find(x => x.id === tid); return s + (t?.price ?? 0); }, 0);
  }
  const filteredBundles = bundles.filter(b => !bundleSearch || b.name.toLowerCase().includes(bundleSearch.toLowerCase()) || b.category.toLowerCase().includes(bundleSearch.toLowerCase()));
  const bundleByCat = filteredBundles.reduce<Record<string, Bundle[]>>((acc, b) => { (acc[b.category] ??= []).push(b); return acc; }, {});

  const TABS: { key: "tratamientos"|"paquetes"|"recetas"|"indicaciones"; label: string; count: number; icon?: React.ElementType }[] = [
    { key: "tratamientos", label: "Tratamientos", count: treatments.length },
    { key: "paquetes", label: "Paquetes", count: bundles.length, icon: Package },
    { key: "recetas", label: "Recetas", count: rxTemplates.length, icon: Pill },
    { key: "indicaciones", label: "Indicaciones", count: careTemplates.length, icon: BookOpen },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Prestaciones y Plantillas</h1>
          <p className="text-muted">{treatments.length} tratamientos · {bundles.length} paquetes · {rxTemplates.length} recetas · {careTemplates.length} indicaciones</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files?.[0]) importExcel(e.target.files[0]); }} />
          {pageTab === "tratamientos" && (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-xs">
                <Upload size={14} /> {importing ? "Importando..." : "Importar Excel"}
              </button>
              <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva Prestación</button>
            </>
          )}
          {pageTab === "paquetes" && <button onClick={openNewBundle} className="btn-primary"><Plus size={16} /> Nuevo Paquete</button>}
          {pageTab === "recetas" && <button onClick={openNewRx} className="btn-primary"><Plus size={16} /> Nueva Plantilla</button>}
          {pageTab === "indicaciones" && <button onClick={openNewCare} className="btn-primary"><Plus size={16} /> Nueva Plantilla</button>}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
        {TABS.map(({ key, label, count, icon: Icon }) => (
          <button key={key} onClick={() => setPageTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${pageTab === key ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {Icon && <Icon size={13} />}
            {label}
            {count > 0 && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      {/* ===== TRATAMIENTOS ===== */}
      {pageTab === "tratamientos" && (
        <>
          <div className="card p-4 bg-primary-50 border-primary-200">
            <p className="text-sm text-primary-800 font-medium">📊 Formato Excel para importar</p>
            <p className="text-xs text-primary-600 mt-1">El archivo debe tener columnas: <strong>Nombre | Categoría | Precio | Descripción</strong></p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
            </div>
            <div className="flex gap-1 flex-wrap">
              {["Todos", ...CATEGORIES].map(c => (
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
                  {items.map(t => (
                    <tr key={t.id} className="table-row">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{t.name}</p>
                        {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 w-32">{fmt(t.price)}</td>
                      <td className="px-4 py-3 w-20">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(t)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Pencil size={13} /></button>
                          {isAdmin && <button onClick={() => remove(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {filtered.length === 0 && <div className="card py-12 text-center text-muted">No hay prestaciones. Crea una o importa desde Excel.</div>}
        </>
      )}

      {/* ===== PAQUETES ===== */}
      {pageTab === "paquetes" && (
        <>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800 font-medium">📦 ¿Qué son los paquetes?</p>
            <p className="text-xs text-amber-700 mt-1">Agrupa tratamientos relacionados para agregarlos al presupuesto con un clic — por ejemplo <em>"Endodoncia molar"</em> incluye: endodoncia + medicación + reconstrucción.</p>
          </div>
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 text-sm" placeholder="Buscar paquetes..." value={bundleSearch} onChange={e => setBundleSearch(e.target.value)} />
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
                              {tList.map(t => <span key={t.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.name}</span>)}
                              {b.treatmentIds.length === 0 && <span className="text-xs text-slate-400 italic">Sin tratamientos asignados</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openEditBundle(b)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Pencil size={13} /></button>
                            {isAdmin && <button onClick={() => deleteBundle(b.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>}
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

      {/* ===== RECETAS ===== */}
      {pageTab === "recetas" && (
        <>
          <div className="card p-4 bg-violet-50 border-violet-200">
            <p className="text-sm text-violet-800 font-medium"><Pill size={14} className="inline mr-1" />Plantillas de receta médica</p>
            <p className="text-xs text-violet-700 mt-1">Crea recetas tipo que aparecerán como opciones rápidas al generar una receta desde el perfil del paciente. Incluye los fármacos, dosis y duración habituales.</p>
          </div>
          {rxTemplates.length === 0 ? (
            <div className="card py-16 text-center">
              <Pill className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">No hay plantillas de receta creadas</p>
              <button onClick={openNewRx} className="btn-primary text-sm"><Plus size={14} /> Crear primera plantilla</button>
            </div>
          ) : (
            <div className="space-y-3">
              {rxTemplates.map(t => (
                <div key={t.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Pill size={16} className="text-violet-600 flex-shrink-0" />
                      <p className="font-semibold text-slate-900">{t.name}</p>
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{t.medications.filter(m => m.drug.trim()).length} fármacos</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEditRx(t)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Pencil size={13} /></button>
                      {isAdmin && <button onClick={() => deleteRx(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {t.medications.filter(m => m.drug.trim()).map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-slate-400 font-mono text-xs mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                        <div>
                          <span className="font-medium text-slate-800">{m.drug}</span>
                          {m.dose && <span className="text-slate-500"> — {m.dose}</span>}
                          <span className="text-xs text-slate-400 ml-1">{[m.freq, m.duration, m.route].filter(Boolean).join(" · ")}</span>
                          {m.instructions && <p className="text-xs text-slate-400 italic">{m.instructions}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {t.notes && <p className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 italic">{t.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== INDICACIONES ===== */}
      {pageTab === "indicaciones" && (
        <>
          <div className="card p-4 bg-teal-50 border-teal-200">
            <p className="text-sm text-teal-800 font-medium"><BookOpen size={14} className="inline mr-1" />Plantillas de instrucciones de cuidado</p>
            <p className="text-xs text-teal-700 mt-1">Crea instrucciones postoperatorias que el profesional puede seleccionar, editar e imprimir o enviar por WhatsApp desde el perfil del paciente.</p>
          </div>
          {careTemplates.length === 0 ? (
            <div className="card py-16 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-4">No hay plantillas de indicaciones creadas</p>
              <button onClick={openNewCare} className="btn-primary text-sm"><Plus size={14} /> Crear primera plantilla</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {careTemplates.map(t => (
                <div key={t.id} className="card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={15} className="text-teal-600 flex-shrink-0" />
                      <p className="font-semibold text-slate-900">{t.name}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEditCare(t)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Pencil size={13} /></button>
                      {isAdmin && <button onClick={() => deleteCare(t.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-line">{t.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== MODAL: Tratamiento ===== */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar Prestación" : "Nueva Prestación"}>
        <div className="p-6 space-y-4">
          <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Extracción dental simple" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Precio ($)</label><input className="input" type="number" min="0" value={form.price} onChange={e => set("price", e.target.value)} placeholder="0" /></div>
          </div>
          <div><label className="label">Descripción</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} /></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form.name}>{saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}</button>
        </div>
      </Modal>

      {/* ===== MODAL: Paquete ===== */}
      <Modal open={bundleOpen} onClose={() => setBundleOpen(false)} title={bundleEditing ? "Editar Paquete" : "Nuevo Paquete"} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre del paquete *</label>
              <input className="input" value={bundleForm.name} onChange={e => setBundleForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Endodoncia molar completa" />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={bundleForm.category} onChange={e => setBundleForm(f => ({ ...f, category: e.target.value }))}>
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
                        <label key={t.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors ${checked ? "bg-primary-50" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleTreatmentInBundle(t.id)} className="accent-primary-600 w-4 h-4 rounded" />
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
                <span className="font-semibold text-primary-700">Total: {fmt(bundleForm.treatmentIds.reduce((s, tid) => s + (treatments.find(x => x.id === tid)?.price ?? 0), 0))}</span>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setBundleOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveBundle} disabled={bundleSaving || !bundleForm.name}>{bundleSaving ? "Guardando..." : bundleEditing ? "Actualizar" : "Crear paquete"}</button>
        </div>
      </Modal>

      {/* ===== MODAL: Receta ===== */}
      <Modal open={rxOpen} onClose={() => setRxOpen(false)} title={rxEditing ? "Editar Plantilla de Receta" : "Nueva Plantilla de Receta"} size="xl">
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="label">Nombre de la plantilla *</label>
            <input className="input" value={rxForm.name} onChange={e => setRxForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Post-exodoncia, Post-implante..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Fármacos</label>
              <button onClick={addMed} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus size={12} /> Agregar fármaco</button>
            </div>
            <div className="space-y-3">
              {rxForm.medications.map((m, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fármaco {i + 1}</span>
                    {rxForm.medications.length > 1 && (
                      <button onClick={() => removeMed(i)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 rounded transition-colors"><X size={12} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 font-medium">Nombre del fármaco *</label>
                      <input className="input mt-0.5 text-sm" value={m.drug} onChange={e => updateMed(i, "drug", e.target.value)} placeholder="Amoxicilina 500 mg" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Dosis</label>
                      <input className="input mt-0.5 text-sm" value={m.dose} onChange={e => updateMed(i, "dose", e.target.value)} placeholder="1 comprimido" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Vía</label>
                      <select className="select mt-0.5 text-sm" value={m.route} onChange={e => updateMed(i, "route", e.target.value)}>
                        {ROUTES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Frecuencia</label>
                      <input className="input mt-0.5 text-sm" value={m.freq} onChange={e => updateMed(i, "freq", e.target.value)} placeholder="c/8h" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Duración</label>
                      <input className="input mt-0.5 text-sm" value={m.duration} onChange={e => updateMed(i, "duration", e.target.value)} placeholder="7 días" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 font-medium">Instrucciones adicionales</label>
                      <input className="input mt-0.5 text-sm" value={m.instructions} onChange={e => updateMed(i, "instructions", e.target.value)} placeholder="Tomar con alimentos, no mezclar con alcohol..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Indicaciones generales (opcional)</label>
            <textarea className="input resize-none text-sm" rows={2} value={rxForm.notes}
              onChange={e => setRxForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Reposo relativo, dieta blanda, control en 7 días..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setRxOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveRx} disabled={rxSaving || !rxForm.name || rxForm.medications.every(m => !m.drug.trim())}>
            {rxSaving ? "Guardando..." : rxEditing ? "Actualizar" : "Crear plantilla"}
          </button>
        </div>
      </Modal>

      {/* ===== MODAL: Indicaciones ===== */}
      <Modal open={careOpen} onClose={() => setCareOpen(false)} title={careEditing ? "Editar Plantilla de Indicaciones" : "Nueva Plantilla de Indicaciones"} size="lg">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nombre de la plantilla *</label>
            <input className="input" value={careForm.name} onChange={e => setCareForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Post-exodoncia, Post-blanqueamiento..." />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Instrucciones *</label>
              <span className="text-xs text-slate-400">Usa • para viñetas y Ctrl+Enter para nueva línea</span>
            </div>
            <textarea
              className="input resize-none font-mono text-sm leading-relaxed"
              rows={12}
              value={careForm.text}
              onChange={e => setCareForm(f => ({ ...f, text: e.target.value }))}
              placeholder={"• Primera instrucción...\n• Segunda instrucción...\n• Tercera instrucción..."}
            />
            <p className="text-xs text-slate-400 mt-1">{careForm.text.split("\n").filter(l => l.trim()).length} líneas · {careForm.text.length} caracteres</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setCareOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={saveCare} disabled={careSaving || !careForm.name || !careForm.text.trim()}>
            {careSaving ? "Guardando..." : careEditing ? "Actualizar" : "Crear plantilla"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
