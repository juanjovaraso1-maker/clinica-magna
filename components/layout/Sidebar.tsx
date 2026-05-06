"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, FileText,
  TrendingUp, Settings, Stethoscope, ChevronRight, ClipboardList,
} from "lucide-react";

const nav = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/pacientes",    label: "Pacientes",    icon: Users },
  { href: "/agenda",       label: "Agenda",       icon: Calendar },
  { href: "/prestaciones", label: "Prestaciones", icon: ClipboardList },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/finanzas",     label: "Finanzas",     icon: TrendingUp },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Clínica Magna</p>
            <p className="text-slate-400 text-xs">Sistema Dental</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Módulos</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800 space-y-0.5">
        <Link href="/configuracion"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pathname === "/configuracion" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Settings size={18} />
          <span>Configuración</span>
        </Link>
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">CM</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">Dr. Carlos Magna</p>
            <p className="text-slate-500 text-xs truncate">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
