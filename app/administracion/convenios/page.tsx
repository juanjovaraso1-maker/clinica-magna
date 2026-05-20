"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/hooks/useRole";
import Modal from "@/components/ui/Modal";

interface Convenio { id: string; name: string; discount: number; discountType: string; active: boolean; }
interface Form { name: string; discount: string; discountType: string; }

const EMPTY: Form = { name: "", discount: "", discountType: "pct" };

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export default function ConveniosPage() {
  const isAdmin = useIsAdmin();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Convenio | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/convenios");
    setConvenios(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY); setEditTarget(null); setError(""); setModalOpen(true);
  }
  function openEdit(c: Convenio) {
    setForm({ name: c.name, discount: String(c.discount), discountType: c.discountType });
    setEditTarget(c); setError(""); setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.discount) { setError("Completa todos los campos."); return; }
    setSaving(true);
    if (editTarget) {
      await fetch(`/api/convenios/${editTarget.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/convenios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false); setModalOpen(false); load();
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar este convenio?")) return;
    await fetch(`/api/convenios/${id}`, { method: "DELETE" });
    load();
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/administracion" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20}/>
        </Link>
        <div>
          <h1 className="page-title">Convenios</h1>
          <p className="text-muted">Descuentos automáticos para presupuestos</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={15}/> Nuevo convenio
        </button>
      </div>

      <div className="card overflow-hidden">
        {convenios.length === 0 ? (
          <div className="py-14 text-center text-muted text-sm">
            No hay convenios creados. Crea uno para aplicar descuentos automáticos en presupuestos.
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div className="col-span-6">Convenio</div>
              <div className="col-span-4 text-right">Descuento</div>
              <div className="col-span-2"/>
            </div>
            <div className="divide-y divide-slate-100">
              {convenios.map(c => (
                <div key={c.id} className="px-5 py-4 grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6">
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {c.discountType === "pct" ? `${c.discount}%` : fmt(c.discount)}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                      <Edit2 size={14}/>
                    </button>
                    <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Editar convenio" : "Nuevo convenio"} size="sm">
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del convenio</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="input w-full" placeholder="Ej: Isapre Cruz Blanca, Empresa ABC..." required/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descuento</label>
              <input type="number" min="0" step="0.1" value={form.discount}
                onChange={e => setForm(f => ({...f, discount: e.target.value}))}
                className="input w-full" placeholder="10" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-300">
                {[{v:"pct",l:"Porcentaje (%)"},{v:"fixed",l:"Monto fijo ($)"}].map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setForm(f => ({...f, discountType: opt.v}))}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${form.discountType === opt.v ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {opt.v === "pct" ? "%" : "$"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.discountType === "pct" && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Se aplicará un {form.discount || 0}% de descuento a cada ítem del presupuesto.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando…" : editTarget ? "Guardar" : "Crear convenio"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
