"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Search, Phone, Calendar, ChevronRight, X, Filter,
  Users, UserCheck, UserX, SlidersHorizontal,
} from "lucide-react";
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

const INSURANCE_OPTIONS = [
  "FONASA", "ISAPRE Cruz Blanca", "ISAPRE Banmédica",
  "ISAPRE Colmena", "ISAPRE Consalud", "Particular",
];

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

function avatarInitials(p: Patient) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function lastVisit(p: Patient) {
  return p.appointments?.[0]?.date
    ? new Date(p.appointments[0].date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
    : null;
}

export default function Pacientes() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [filterInsurance, setFilterInsurance] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/patients?search=${encodeURIComponent(search)}`);
    if (r.ok) setPatients(await r.json());
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const filtered = patients.filter(p => {
    if (filterInsurance && !p.healthInsurance?.startsWith(filterInsurance)) return false;
    if (filterGender && p.gender !== filterGender) return false;
    if (filterActive === "true" && !p.active) return false;
    if (filterActive === "false" && p.active) return false;
    return true;
  });

  const activeCount = patients.filter(p => p.active).length;
  const hasFilters = filterInsurance || filterGender || filterActive;

  function clearFilters() {
    setFilterInsurance(""); setFilterGender(""); setFilterActive("");
  }

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
          <p className="text-muted">{activeCount} activos · {patients.length} en total</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> <span className="hidden sm:inline">Nuevo Paciente</span><span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Total", value: patients.length, color: "text-slate-600", bg: "bg-slate-100" },
          { icon: UserCheck, label: "Activos", value: activeCount, color: "text-primary-600", bg: "bg-primary-50" },
          { icon: UserX, label: "Inactivos", value: patients.length - activeCount, color: "text-slate-400", bg: "bg-slate-100" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="card p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
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
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              hasFilters
                ? "bg-primary-50 border-primary-200 text-primary-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">Filtros</span>
            {hasFilters && <span className="w-4 h-4 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center">!</span>}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            <select
              className="select text-sm py-1.5 pr-8 flex-1 min-w-[140px]"
              value={filterInsurance}
              onChange={e => setFilterInsurance(e.target.value)}
            >
              <option value="">Todas las previsiones</option>
              {INSURANCE_OPTIONS.map(o => <option key={o} value={o.split(" ")[0]}>{o}</option>)}
            </select>
            <select
              className="select text-sm py-1.5 pr-8"
              value={filterGender}
              onChange={e => setFilterGender(e.target.value)}
            >
              <option value="">Todos los sexos</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
            <select
              className="select text-sm py-1.5 pr-8"
              value={filterActive}
              onChange={e => setFilterActive(e.target.value as "" | "true" | "false")}
            >
              <option value="">Todos</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700 px-2 flex items-center gap-1">
                <X size={13} /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      {(search || hasFilters) && (
        <p className="text-sm text-muted px-1">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center text-muted">
            <Users size={32} className="mx-auto mb-3 text-slate-300" />
            <p>No se encontraron pacientes</p>
          </div>
        ) : filtered.map(p => (
          <div key={p.id} className="card p-4 flex gap-3 items-start">
            {/* Avatar */}
            <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center font-semibold text-sm text-white bg-gradient-to-br ${
              p.active ? "from-primary-500 to-primary-600" : "from-slate-400 to-slate-500"
            }`}>
              {avatarInitials(p)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900 text-sm">{p.firstName} {p.lastName}</p>
                {!p.active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">Inactivo</span>}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{p.rut}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                {p.healthInsurance && (
                  <Badge value={p.healthInsurance.split(" ")[0]} />
                )}
                <span className="text-xs text-slate-400">{p.gender === "M" ? "Masculino" : "Femenino"}</span>
                {p.city && <span className="text-xs text-slate-400">{p.city}</span>}
              </div>
              {lastVisit(p) && (
                <p className="text-xs text-slate-400 mt-1">
                  <Calendar size={11} className="inline mr-1" />
                  Última visita: {lastVisit(p)} · {p._count.appointments} cita{p._count.appointments !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {p.phone && (
                <a href={`tel:${p.phone}`}
                  className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                  title="Llamar"
                >
                  <Phone size={14} />
                </a>
              )}
              <Link href={`/agenda?patient=${p.id}`}
                className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 flex items-center justify-center transition-colors"
                title="Nueva cita"
              >
                <Calendar size={14} />
              </Link>
              <Link href={`/pacientes/${p.id}`}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
                title="Ver ficha"
              >
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">RUT</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Teléfono</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Previsión</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Citas</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Última visita</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right hidden lg:table-cell">Acciones</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-muted">
                  <Users size={28} className="mx-auto mb-2 text-slate-300" />
                  No se encontraron pacientes
                </td>
              </tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="table-row border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold bg-gradient-to-br ${
                      p.active ? "from-primary-500 to-primary-600" : "from-slate-400 to-slate-500"
                    }`}>
                      {avatarInitials(p)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-400">{p.gender === "M" ? "Masc." : "Fem."} · {p.city}</p>
                    </div>
                    {!p.active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium ml-1">Inactivo</span>}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">{p.rut}</td>
                <td className="px-4 py-3.5 text-slate-600 hidden lg:table-cell">
                  {p.phone
                    ? <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:text-primary-600 transition-colors">
                        <Phone size={13} className="text-slate-400" />{p.phone}
                      </a>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-4 py-3.5">
                  {p.healthInsurance ? <Badge value={p.healthInsurance.split(" ")[0]} /> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3.5 text-slate-600 hidden xl:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    {p._count.appointments}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-500 text-xs hidden xl:table-cell">
                  {lastVisit(p) ?? <span className="text-slate-300">Sin visitas</span>}
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/agenda?patient=${p.id}`}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="Nueva cita"
                    >
                      <Calendar size={15} />
                    </Link>
                  </div>
                </td>
                <td className="px-2 py-3.5">
                  <Link href={`/pacientes/${p.id}`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Juan" />
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="González" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de nacimiento</label>
              <input className="input" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </div>
            <div>
              <label className="label">Previsión de salud</label>
              <select className="select" value={form.healthInsurance} onChange={(e) => set("healthInsurance", e.target.value)}>
                {INSURANCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
