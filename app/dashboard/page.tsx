"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Calendar, TrendingUp, TrendingDown, Clock, ChevronRight,
  RefreshCw, UserPlus, CalendarPlus, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Banknote, CreditCard, Building2, CheckCircle2,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

interface TodayAppt {
  id: string; startTime: string; endTime: string; type: string;
  status: string; box: number;
  patient: { id: string; firstName: string; lastName: string };
  user: { name: string };
}

interface NextAppt {
  id: string; date: string; startTime: string; type: string; status: string;
  patient: { id: string; firstName: string; lastName: string };
  user: { name: string };
}

interface DashboardData {
  totalPatients: number;
  newPatientsMonth: number;
  todayAppointments: TodayAppt[];
  monthIncome: number;
  lastMonthIncome: number;
  monthExpenses: number;
  pendingBudgets: number;
  recentPatients: Array<{ id: string; firstName: string; lastName: string; rut: string; createdAt: string }>;
  monthlyChart: Array<{ label: string; income: number }>;
  weeklyChart: Array<{ label: string; citas: number; completadas: number }>;
  statusCount: { scheduled: number; confirmed: number; completed: number; cancelled: number };
  nextAppointments: NextAppt[];
  debtors: Array<{ patientId: string; name: string; balance: number }>;
  totalDebt: number;
  debtorCount: number;
  recentPayments: Array<{
    id: string; date: string; amount: number; method: string; createdAt: string;
    patient: { firstName: string; lastName: string };
  }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return fmt(n);
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
function dayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === tomorrow) return "Mañana";
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  efectivo: <Banknote size={14} className="text-emerald-600" />,
  transferencia: <Building2 size={14} className="text-blue-600" />,
  tarjeta: <CreditCard size={14} className="text-violet-600" />,
};

const CustomTooltipIncome = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-700 mb-1 capitalize">{label}</p>
        <p className="text-primary-700">Ingresos: <span className="font-bold">{fmt(payload[0].value)}</span></p>
      </div>
    );
  }
  return null;
};

const CustomTooltipWeek = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-700 mb-1 capitalize">{label}</p>
        <p className="text-primary-600">Citas: <span className="font-bold">{payload[0]?.value}</span></p>
        <p className="text-emerald-600">Completadas: <span className="font-bold">{payload[1]?.value}</span></p>
      </div>
    );
  }
  return null;
};

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
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const net = data.monthIncome - data.monthExpenses;
  const margin = data.monthIncome > 0 ? Math.round((net / data.monthIncome) * 100) : 0;
  const incomeTrend = data.lastMonthIncome > 0
    ? Math.round(((data.monthIncome - data.lastMonthIncome) / data.lastMonthIncome) * 100)
    : null;

  const todayDate = new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Group upcoming appointments by date
  const upcomingByDate = data.nextAppointments.reduce<Record<string, NextAppt[]>>((acc, a) => {
    (acc[a.date] ??= []).push(a);
    return acc;
  }, {});

  const maxDebt = data.debtors[0]?.balance ?? 1;

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-400 mb-0.5 capitalize">{todayDate}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{greeting()}, Clínica Magna</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/agenda" className="btn-primary text-sm">
            <CalendarPlus size={15} /> Nueva Cita
          </Link>
          <Link href="/pacientes" className="btn-secondary text-sm">
            <UserPlus size={15} /> Nuevo Paciente
          </Link>
          <button onClick={seed} disabled={seeding} className="btn-secondary text-xs">
            <RefreshCw size={13} className={seeding ? "animate-spin" : ""} />
            {seeding ? "Cargando..." : "Demo"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-3 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pacientes</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{data.totalPatients}</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-0.5">
                <ArrowUpRight size={11} /> +{data.newPatientsMonth} este mes
              </p>
            </div>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-700" />
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Citas Hoy</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{data.todayAppointments.length}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {data.statusCount.confirmed > 0 && (
                  <span className="text-xs text-primary-600">{data.statusCount.confirmed} conf.</span>
                )}
                {data.statusCount.completed > 0 && (
                  <span className="text-xs text-slate-400">{data.statusCount.completed} compl.</span>
                )}
                {data.statusCount.scheduled > 0 && (
                  <span className="text-xs text-blue-500">{data.statusCount.scheduled} agend.</span>
                )}
              </div>
            </div>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Ingresos Mes</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{fmtShort(data.monthIncome)}</p>
              {incomeTrend !== null ? (
                <p className={`text-xs mt-1 flex items-center gap-0.5 ${incomeTrend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {incomeTrend >= 0
                    ? <><ArrowUpRight size={11} />+{incomeTrend}%</>
                    : <><ArrowDownRight size={11} />{incomeTrend}%</>
                  }
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Neto {fmtShort(net)}</p>
              )}
            </div>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              {incomeTrend === null || incomeTrend >= 0
                ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
              }
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium leading-tight">Deudas</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{fmtShort(data.totalDebt)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {data.debtorCount} pac. · {data.pendingBudgets} presup.
              </p>
            </div>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Ingresos — Últimos 6 meses</h2>
              <p className="text-xs text-slate-400 mt-0.5">Total cobrado por mes</p>
            </div>
            <Link href="/finanzas" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
              Ver finanzas <ChevronRight size={12} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.monthlyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#588157" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#588157" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={48} />
              <Tooltip content={<CustomTooltipIncome />} />
              <Area type="monotone" dataKey="income" stroke="#588157" strokeWidth={2.5} fill="url(#incomeGrad)" dot={{ fill: "#588157", r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Citas esta semana</h2>
              <p className="text-xs text-slate-400 mt-0.5">Por día</p>
            </div>
            <Link href="/agenda" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
              Agenda <ChevronRight size={12} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.weeklyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
              <Tooltip content={<CustomTooltipWeek />} />
              <Bar dataKey="citas" fill="#c4d5bc" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="completadas" fill="#588157" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-primary-200 inline-block" /><span>Agendadas</span></div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-primary-500 inline-block" /><span>Completadas</span></div>
          </div>
        </div>
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Today's appointments */}
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="section-title">Citas de Hoy</h2>
              <p className="text-xs text-slate-400">
                {data.todayAppointments.length > 0
                  ? `${data.statusCount.completed} completadas · ${data.statusCount.confirmed + data.statusCount.scheduled} restantes`
                  : "Sin citas programadas"}
              </p>
            </div>
            <Link href="/agenda" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
              Ver agenda <ChevronRight size={12} />
            </Link>
          </div>
          {data.todayAppointments.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-muted text-sm">No hay citas programadas para hoy</p>
              <Link href="/agenda" className="text-xs text-primary-600 hover:underline mt-2 inline-block">Ir a la agenda →</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.todayAppointments.map((a) => (
                <Link key={a.id} href={`/pacientes/${a.patient.id}`}
                  className="px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-12 sm:w-14 text-center flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 whitespace-nowrap">{a.startTime}</p>
                    <p className="text-xs text-slate-400">{a.endTime}</p>
                  </div>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 text-xs font-bold">{a.box}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary-700 transition-colors">
                      {a.patient.firstName} {a.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{a.type} · {a.user.name.split(" ")[0]}</p>
                  </div>
                  <Badge value={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Financial summary */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Resumen del Mes</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Ingresos
                </span>
                <span className="text-sm font-semibold text-emerald-700">{fmt(data.monthIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Gastos
                </span>
                <span className="text-sm font-semibold text-red-600">{fmt(data.monthExpenses)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Resultado neto</span>
                <span className={`text-sm font-bold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(net)}</span>
              </div>
              {data.monthIncome > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Margen</span>
                    <span>{margin}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${net >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
                      style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
                    />
                  </div>
                </div>
              )}
              <Link href="/finanzas" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5 pt-1">
                Ver finanzas detalladas <ChevronRight size={11} />
              </Link>
            </div>
          </div>

          {/* Recent payments */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="section-title">Últimos Pagos</h2>
              <Link href="/finanzas" className="text-xs text-primary-600 hover:underline">Ver todos</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentPayments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400 text-center">Sin pagos registrados</p>
              ) : data.recentPayments.slice(0, 5).map((p) => (
                <div key={p.id} className="px-5 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {METHOD_ICON[p.method] ?? <span className="text-xs text-slate-400">$</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {p.patient.firstName} {p.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-400">{p.date}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700 flex-shrink-0">{fmtShort(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Upcoming appointments + Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Upcoming appointments */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="section-title">Próximas Citas</h2>
              <p className="text-xs text-slate-400">Próximos 7 días</p>
            </div>
            <Link href="/agenda" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
              Agenda <ChevronRight size={12} />
            </Link>
          </div>
          {data.nextAppointments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin citas en los próximos 7 días</p>
            </div>
          ) : (
            <div>
              {Object.entries(upcomingByDate).slice(0, 4).map(([date, appts]) => (
                <div key={date}>
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{dayLabel(date)}</span>
                  </div>
                  {appts.map((a) => (
                    <Link key={a.id} href={`/pacientes/${a.patient.id}`}
                      className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary-700">
                          {initials(a.patient.firstName, a.patient.lastName)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-primary-700 transition-colors">
                          {a.patient.firstName} {a.patient.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{a.startTime} · {a.type} · {a.user.name.split(" ")[0]}</p>
                      </div>
                      <Badge value={a.status} />
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debtors */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="section-title">Deudores</h2>
              <p className="text-xs text-slate-400">
                {data.debtorCount} pacientes · Total {fmtShort(data.totalDebt)}
              </p>
            </div>
            <Link href="/presupuestos" className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
              Presupuestos <ChevronRight size={12} />
            </Link>
          </div>
          {data.debtors.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin deudas pendientes significativas</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.debtors.map((d) => (
                <Link key={d.patientId} href={`/pacientes/${d.patientId}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-red-600">
                      {d.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-900 truncate group-hover:text-primary-700 transition-colors">{d.name}</p>
                      <span className="text-sm font-bold text-red-600 ml-2 flex-shrink-0">{fmtShort(d.balance)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-red-400 transition-all"
                        style={{ width: `${Math.round((d.balance / maxDebt) * 100)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
