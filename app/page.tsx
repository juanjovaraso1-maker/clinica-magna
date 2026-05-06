"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Calendar, TrendingUp, Clock, ChevronRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface DashboardData {
  totalPatients: number;
  todayAppointments: Array<{
    id: string; startTime: string; endTime: string; type: string; status: string; box: number;
    patient: { firstName: string; lastName: string };
    user: { name: string };
  }>;
  monthIncome: number;
  monthExpenses: number;
  pendingBudgets: number;
  recentPatients: Array<{ id: string; firstName: string; lastName: string; rut: string; phone: string }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/dashboard");
      if (r.ok) setData(await r.json());
    } catch {}
  }

  async function seed() {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await load();
    setSeeding(false);
  }

  useEffect(() => { load(); }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm">Cargando...</p>
      </div>
    </div>
  );

  const stats = [
    { label: "Total Pacientes", value: data.totalPatients, icon: Users, color: "bg-blue-500", sub: "activos" },
    { label: "Citas de Hoy", value: data.todayAppointments.length, icon: Calendar, color: "bg-emerald-500", sub: "programadas" },
    { label: "Ingresos del Mes", value: fmt(data.monthIncome), icon: TrendingUp, color: "bg-violet-500", sub: "recaudados" },
    { label: "Presupuestos Pendientes", value: data.pendingBudgets, icon: Clock, color: "bg-amber-500", sub: "por aprobar" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted mt-0.5">
            {new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button onClick={seed} disabled={seeding}
          className="btn-secondary text-xs"
        >
          <RefreshCw size={14} className={seeding ? "animate-spin" : ""} />
          {seeding ? "Cargando datos..." : "Cargar datos demo"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's appointments */}
        <div className="card lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="section-title">Citas de Hoy</h2>
            <Link href="/agenda" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Ver agenda <ChevronRight size={12} />
            </Link>
          </div>
          {data.todayAppointments.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted">No hay citas programadas para hoy</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.todayAppointments.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-16 text-center">
                    <p className="text-sm font-semibold text-slate-900">{a.startTime}</p>
                    <p className="text-xs text-slate-400">{a.endTime}</p>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 text-xs font-bold">{a.box}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {a.patient.firstName} {a.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{a.type} · {a.user.name.split(" ")[0]} {a.user.name.split(" ").slice(-1)[0]}</p>
                  </div>
                  <Badge value={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary card */}
        <div className="space-y-4">
          {/* Finance summary */}
          <div className="card p-5">
            <h2 className="section-title mb-4">Resumen Financiero</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">Ingresos</span>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{fmt(data.monthIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-sm text-slate-600">Gastos</span>
                </div>
                <span className="text-sm font-semibold text-red-600">{fmt(data.monthExpenses)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Resultado neto</span>
                <span className={`text-sm font-bold ${data.monthIncome - data.monthExpenses >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(data.monthIncome - data.monthExpenses)}
                </span>
              </div>
            </div>
            <Link href="/finanzas" className="mt-4 flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline">
              Ver finanzas <ChevronRight size={12} />
            </Link>
          </div>

          {/* Recent patients */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Últimos Pacientes</h2>
            <div className="space-y-2">
              {data.recentPatients.map((p) => (
                <Link key={p.id} href={`/pacientes/${p.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-600">
                      {p.firstName[0]}{p.lastName[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-slate-400">{p.rut}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/pacientes" className="mt-3 flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
