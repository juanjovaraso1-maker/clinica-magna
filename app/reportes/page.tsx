"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  CheckCircle2, ChevronRight, AlertCircle, UserX, RefreshCw, UserPlus, Download,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

interface ReportData {
  monthlyFinance:      Array<{ label:string; ingresos:number; gastos:number }>;
  monthlyPatients:     Array<{ label:string; nuevos:number }>;
  monthlyAppointments: Array<{ label:string; citas:number; completadas:number }>;
  statusCount:         Array<{ name:string; value:number }>;
  topTreatments:       Array<{ name:string; count:number }>;
  insuranceData:       Array<{ name:string; value:number }>;
  debtors:             Array<{ patientId:string; name:string; rut:string; budgetNumber:number; total:number; paid:number; balance:number }>;
  kpis: { totalIncome:number; totalExpenses:number; net:number; totalPatients:number; newPatients:number; totalAppointments:number; completionRate:number };
}

interface PatientAnalysis {
  total: number; newLast30: number; returningCount: number; newCount: number;
  neverAppt: number; atRiskCount: number; dormant180: number;
  ageData:       Array<{ name:string; value:number }>;
  genderData:    Array<{ name:string; value:number }>;
  insuranceData: Array<{ name:string; value:number }>;
  cityData:      Array<{ name:string; value:number }>;
  atRisk:        Array<{ id:string; name:string; lastActivity:string|null; daysSince:number|null }>;
}

const STATUS_LABELS: Record<string,string> = { scheduled:"Agendada", confirmed:"Confirmada", completed:"Completada", cancelled:"Cancelada", "no-show":"No asistió" };
const STATUS_COLORS: Record<string,string> = { scheduled:"#588157", confirmed:"#10b981", completed:"#94a3b8", cancelled:"#f87171", "no-show":"#fbbf24" };
const PIE_COLORS = ["#588157","#6f9769","#9ab893","#c4d5bc","#e2eade","#10b981","#f59e0b"];

function fmt(n:number) { return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n); }
function fmtShort(n:number) {
  if(n>=1000000) return `$${(n/1000000).toFixed(1)}M`;
  if(n>=1000) return `$${(n/1000).toFixed(0)}K`;
  return fmt(n);
}

const TooltipFinance = ({ active, payload, label }:any) => {
  if(!active||!payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-slate-600 capitalize mb-1">{label}</p>
      <p className="text-emerald-700">Ingresos: <b>{fmt(payload[0]?.value??0)}</b></p>
      <p className="text-red-500">Gastos: <b>{fmt(payload[1]?.value??0)}</b></p>
      <p className="text-slate-700 border-t pt-1">Neto: <b>{fmt((payload[0]?.value??0)-(payload[1]?.value??0))}</b></p>
    </div>
  );
};
const TooltipGeneric = ({ active, payload, label }:any) => {
  if(!active||!payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 capitalize mb-1">{label}</p>
      {payload.map((p:any)=>(
        <p key={p.dataKey} style={{color:p.color}}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  );
};

const PERIODS = [
  { value:"3m", label:"3 meses" },
  { value:"6m", label:"6 meses" },
  { value:"12m", label:"12 meses" },
];

const TABS_REPORT = ["Financiero","Pacientes"];

export default function Reportes() {
  const [data, setData] = useState<ReportData|null>(null);
  const [period, setPeriod] = useState("6m");
  const [activeTab, setActiveTab] = useState(0);
  const [pData, setPData] = useState<PatientAnalysis|null>(null);

  useEffect(() => {
    fetch(`/api/reportes?period=${period}`)
      .then(r => r.json()).then(setData);
  }, [period]);

  useEffect(() => {
    if (activeTab === 1 && !pData) {
      fetch("/api/reportes/patients").then(r => r.json()).then(setPData);
    }
  }, [activeTab]);

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.monthlyFinance.map(r=>({ Mes:r.label, Ingresos:r.ingresos, Gastos:r.gastos, Neto:r.ingresos-r.gastos }))), "Financiero");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.monthlyAppointments.map(r=>({ Mes:r.label, "Total Citas":r.citas, Completadas:r.completadas }))), "Citas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.topTreatments.map(r=>({ Tratamiento:r.name, Cantidad:r.count }))), "Tratamientos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.debtors.map(r=>({ Paciente:r.name, RUT:r.rut, "N° Presup":r.budgetNumber, Total:r.total, Abonado:r.paid, Saldo:r.balance }))), "Deudores");
    if (pData) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData.atRisk.map(r=>({ Paciente:r.name, "Última Actividad":r.lastActivity??"Sin actividad", "Días sin actividad":r.daysSince??"-" }))), "Pacientes en riesgo");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData.ageData.map(r=>({ Rango:r.name, Cantidad:r.value }))), "Edades");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData.cityData.map(r=>({ Ciudad:r.name, Cantidad:r.value }))), "Ciudades");
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Métrica:"Ingresos totales", Valor:data.kpis.totalIncome }, { Métrica:"Gastos totales", Valor:data.kpis.totalExpenses }, { Métrica:"Neto", Valor:data.kpis.net }, { Métrica:"Pacientes activos", Valor:data.kpis.totalPatients }, { Métrica:"Pacientes nuevos (período)", Valor:data.kpis.newPatients }, { Métrica:"Total citas", Valor:data.kpis.totalAppointments }, { Métrica:"Tasa completadas (%)", Valor:data.kpis.completionRate } ]), "Resumen");
    XLSX.writeFile(wb, `Reportes_ClinicaMagna_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const { kpis } = data;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-muted">Métricas y análisis de la clínica</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 0 && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {PERIODS.map(p => (
                <button key={p.value} onClick={()=>setPeriod(p.value)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${period===p.value?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={exportExcel} className="btn-secondary text-sm flex items-center gap-2">
            <Download size={15}/> Exportar Excel
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="border-b border-slate-200 -mb-2">
        <nav className="flex -mb-px gap-1">
          {TABS_REPORT.map((t,i) => (
            <button key={t} onClick={()=>setActiveTab(i)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab===i?"border-primary-600 text-primary-700":"border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ===== FINANCIERO ===== */}
      {activeTab === 0 && <>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Ingresos</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmtShort(kpis.totalIncome)}</p>
              <p className="text-xs text-slate-400 mt-0.5">en el período</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600"/>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Gastos</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{fmtShort(kpis.totalExpenses)}</p>
              <p className="text-xs text-slate-400 mt-0.5">en el período</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500"/>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Resultado Neto</p>
              <p className={`text-2xl font-bold mt-1 ${kpis.net>=0?"text-emerald-700":"text-red-600"}`}>{fmtShort(kpis.net)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{kpis.totalIncome>0?`${Math.round((kpis.net/kpis.totalIncome)*100)}% margen`:"—"}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpis.net>=0?"bg-emerald-100":"bg-red-100"}`}>
              <DollarSign className={`w-5 h-5 ${kpis.net>=0?"text-emerald-600":"text-red-500"}`}/>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pacientes</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.totalPatients}</p>
              <p className="text-xs text-emerald-600 mt-0.5">+{kpis.newPatients} nuevos</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600"/>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Citas</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.totalAppointments}</p>
              <p className="text-xs text-slate-400 mt-0.5">en el período</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600"/>
            </div>
          </div>
        </div>
        <div className="card p-5 md:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Tasa de Completación</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.completionRate}%</p>
              <p className="text-xs text-slate-400 mt-0.5">citas completadas vs total agendadas</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-violet-600"/>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
            <div className="bg-primary-500 h-2 rounded-full transition-all" style={{width:`${kpis.completionRate}%`}}/>
          </div>
        </div>
      </div>

      {/* Finance chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">Ingresos vs Gastos</h2>
            <p className="text-xs text-slate-400">Evolución mensual del período</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.monthlyFinance} margin={{top:4,right:4,left:0,bottom:0}} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={52}/>
            <Tooltip content={<TooltipFinance/>}/>
            <Bar dataKey="ingresos" fill="#588157" radius={[4,4,0,0]} maxBarSize={32} name="Ingresos"/>
            <Bar dataKey="gastos"   fill="#fca5a5" radius={[4,4,0,0]} maxBarSize={32} name="Gastos"/>
            <Legend iconType="circle" iconSize={8} formatter={(v)=>v==="ingresos"?"Ingresos":"Gastos"} wrapperStyle={{fontSize:11,paddingTop:8}}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Middle row: Appointments + New patients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Monthly appointments */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="section-title">Citas por mes</h2>
            <p className="text-xs text-slate-400">Agendadas vs completadas</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.monthlyAppointments} margin={{top:4,right:4,left:0,bottom:0}} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} width={24}/>
              <Tooltip content={<TooltipGeneric/>}/>
              <Bar dataKey="citas"       fill="#c4d5bc" radius={[4,4,0,0]} maxBarSize={20} name="Agendadas"/>
              <Bar dataKey="completadas" fill="#588157" radius={[4,4,0,0]} maxBarSize={20} name="Completadas"/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11,paddingTop:8}}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* New patients */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="section-title">Pacientes Nuevos</h2>
            <p className="text-xs text-slate-400">Crecimiento mensual</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.monthlyPatients} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="patientsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#588157" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#588157" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="label" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} width={24}/>
              <Tooltip content={<TooltipGeneric/>}/>
              <Area type="monotone" dataKey="nuevos" stroke="#588157" strokeWidth={2.5} fill="url(#patientsGrad)" dot={{fill:"#588157",r:3}} name="Nuevos"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: Status pie + Top treatments + Insurance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Status donut */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Estado de Citas</h2>
          {data.statusCount.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.statusCount} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {data.statusCount.map((entry,i)=>(
                    <Cell key={i} fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[i%PIE_COLORS.length]}/>
                  ))}
                </Pie>
                <Tooltip formatter={(v,n)=>[v, STATUS_LABELS[n as string]??n]}/>
                <Legend iconType="circle" iconSize={8} formatter={(n)=>STATUS_LABELS[n]??n} wrapperStyle={{fontSize:11}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top treatments */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Especialidades más frecuentes</h2>
          {data.topTreatments.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">Sin datos</div>
          ) : (
            <div className="space-y-2.5">
              {data.topTreatments.map((t, i) => {
                const max = data.topTreatments[0].count;
                const pct = Math.round((t.count / max) * 100);
                return (
                  <div key={t.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium truncate max-w-[160px]">{t.name}</span>
                      <span className="text-slate-500 flex-shrink-0">{t.count} citas</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{width:`${pct}%`, backgroundColor: PIE_COLORS[i%PIE_COLORS.length]}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insurance distribution */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Previsión de Salud</h2>
          {data.insuranceData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.insuranceData} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {data.insuranceData.map((_,i)=>(
                    <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>
                  ))}
                </Pie>
                <Tooltip/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Debtors */}
      {data.debtors.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500"/>
              <h2 className="section-title">Pacientes con Saldo Pendiente</h2>
            </div>
            <span className="text-xs text-slate-400 bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
              {data.debtors.length} pacientes
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Paciente</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">RUT</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase tracking-wide hidden md:table-cell">Presup.</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500 uppercase tracking-wide">Pagado</th>
                <th className="text-right px-5 py-3 text-xs text-slate-500 uppercase tracking-wide">Saldo</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {data.debtors.map((d, i) => (
                <tr key={i} className="table-row">
                  <td className="px-5 py-3 font-medium text-slate-900">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">{d.rut}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">#{String(d.budgetNumber).padStart(4,"0")}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmt(d.total)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmt(d.paid)}</td>
                  <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(d.balance)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/pacientes/${d.patientId}`}
                      className="text-xs text-primary-600 hover:underline flex items-center gap-0.5 justify-end">
                      Ver <ChevronRight size={12}/>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </> /* end financiero tab */}

      {/* ===== ANÁLISIS DE PACIENTES ===== */}
      {activeTab === 1 && (
        pData === null ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : (
          <div className="space-y-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total pacientes</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{pData.total}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">+{pData.newLast30} últimos 30 días</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-600"/>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Recurrentes</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{pData.returningCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">2+ visitas</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-emerald-600"/>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">En riesgo</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{pData.atRiskCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">sin visita 90+ días</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600"/>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Inactivos 6m</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{pData.dormant180}</p>
                    <p className="text-xs text-slate-400 mt-0.5">sin visita 180+ días</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <UserX className="w-5 h-5 text-red-500"/>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Age distribution */}
              <div className="card p-5">
                <h2 className="section-title mb-4">Distribución por edad</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pData.ageData} cx="50%" cy="50%" outerRadius={75}
                      dataKey="value" nameKey="name" paddingAngle={2}>
                      {pData.ageData.map((_,i) => (
                        <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>
                      ))}
                    </Pie>
                    <Tooltip/>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Gender distribution */}
              <div className="card p-5">
                <h2 className="section-title mb-4">Distribución por género</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pData.genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      {pData.genderData.map((_,i) => (
                        <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>
                      ))}
                    </Pie>
                    <Tooltip/>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Insurance */}
              <div className="card p-5">
                <h2 className="section-title mb-4">Previsión de salud</h2>
                {pData.insuranceData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted text-sm">Sin datos</div>
                ) : (
                  <div className="space-y-2.5 mt-1">
                    {pData.insuranceData.slice(0,7).map((ins, i) => {
                      const max = pData.insuranceData[0].value;
                      const pct = Math.round((ins.value / max) * 100);
                      return (
                        <div key={ins.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700 font-medium truncate max-w-[140px]">{ins.name}</span>
                            <span className="text-slate-500 flex-shrink-0">{ins.value}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{width:`${pct}%`, backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* City distribution */}
            {pData.cityData.filter(c => c.name !== "Sin ciudad").length > 0 && (
              <div className="card p-5">
                <h2 className="section-title mb-4">Distribución geográfica</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={pData.cityData.filter(c=>c.name!=="Sin ciudad")} margin={{top:4,right:4,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} allowDecimals={false} width={24}/>
                    <Tooltip/>
                    <Bar dataKey="value" fill="#588157" radius={[4,4,0,0]} maxBarSize={40} name="Pacientes"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* At-risk patients table */}
            {pData.atRisk.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500"/>
                    <h2 className="section-title">Pacientes en riesgo de deserción</h2>
                  </div>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Sin visita 90+ días
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {pData.atRisk.map(p => (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-700 text-xs font-semibold">{p.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {p.lastActivity
                            ? `Última visita: ${new Date(p.lastActivity+"T12:00:00").toLocaleDateString("es-CL",{day:"numeric",month:"short",year:"numeric"})}`
                            : "Sin visitas registradas"}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        !p.daysSince || p.daysSince > 180 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {p.daysSince ? `${p.daysSince} días` : "Nunca"}
                      </span>
                      <Link href={`/pacientes/${p.id}`}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-0.5 flex-shrink-0">
                        Ver <ChevronRight size={12}/>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
