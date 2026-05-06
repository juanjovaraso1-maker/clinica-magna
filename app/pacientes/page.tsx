"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, UserCheck, Phone, Calendar, ChevronRight, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface Patient {
  id: string; rut: string; firstName: string; lastName: string;
  email: string; phone: string; gender: string; city: string;
  healthInsurance: string; active: boolean; createdAt: string;
  appointments: Array<{ date: string }>;
  _count: { appointments: number; evolutions: number };
}

const initialForm = {
  rut: "", firstName: "", lastName: "", email: "", phone: "+569",
  birthDate: "", gender: "M", address: "", city: "Santiago",
  healthInsurance: "FONASA", notes: "",
};

function formatRut(value: string): string {
  const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
}

function handlePhone(value: string): string {
  const prefix = "+569";
  if (!value.startsWith(prefix)) return prefix;
  const digits = value.slice(prefix.length).replace(/\D/g, "").slice(0, 8);
  return prefix + digits;
}

export default function Pacientes() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/patients?search=${encodeURIComponent(search)}`);
    if (r.ok) setPatients(await r.json());
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setError("");
    const r = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) { setOpen(false); setForm(initialForm); load(); }
    else { const d = await r.json(); setError(d.error || "Error al guardar paciente"); }
    setSaving(false);
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="text-muted">{patients.length} pacientes registrados</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> Nuevo Paciente
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 pr-8"
            placeholder="Buscar por nombre, RUT o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">RUT</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Teléfono</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Previsión</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Citas</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Última visita</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted">
                  No se encontraron pacientes
                </td>
              </tr>
            ) : patients.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {p.firstName[0]}{p.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-400">{p.gender === "M" ? "Masculino" : "Femenino"} · {p.city}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell font-mono text-xs">{p.rut}</td>
                <td className="px-4 py-3.5 text-slate-600 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    {p.phone || "—"}
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  {p.healthInsurance ? <Badge value={p.healthInsurance.split(" ")[0]} /> : "—"}
                </td>
                <td className="px-4 py-3.5 text-slate-600 hidden xl:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    {p._count.appointments}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-500 text-xs hidden xl:table-cell">
                  {p.appointments?.[0]?.date
                    ? new Date(p.appointments[0].date).toLocaleDateString("es-CL")
                    : "Sin visitas"}
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/pacientes/${p.id}`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo paciente */}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo Paciente" size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Juan" />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="González" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">RUT *</label>
              <input className="input" value={form.rut} onChange={(e) => set("rut", formatRut(e.target.value))} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="label">Sexo</label>
              <select className="select" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={(e) => set("phone", handlePhone(e.target.value))} placeholder="+56987654321" />
              <p className="text-xs text-slate-400 mt-1">Máx. 8 dígitos después de +569</p>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@email.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input className="input" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </div>
            <div>
              <label className="label">Previsión de salud</label>
              <select className="select" value={form.healthInsurance} onChange={(e) => set("healthInsurance", e.target.value)}>
                <option>FONASA</option>
                <option>ISAPRE Cruz Blanca</option>
                <option>ISAPRE Banmédica</option>
                <option>ISAPRE Colmena</option>
                <option>ISAPRE Consalud</option>
                <option>Particular</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Observaciones</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => { setOpen(false); setError(""); }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.firstName || !form.lastName || !form.rut}>
              {saving ? "Guardando..." : "Guardar Paciente"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
