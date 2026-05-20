"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, Calendar, FileText,
  TrendingUp, Settings, Stethoscope, ClipboardList,
  Menu, X, BarChart2, ShieldCheck, LogOut, ChevronRight,
} from "lucide-react";

const navGroups = [
  {
    label: "CLÍNICA",
    items: [
      { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
      { href: "/pacientes",    label: "Pacientes",    icon: Users },
      { href: "/agenda",       label: "Agenda",       icon: Calendar },
    ],
  },
  {
    label: "GESTIÓN",
    items: [
      { href: "/prestaciones", label: "Prestaciones", icon: ClipboardList },
      { href: "/presupuestos", label: "Presupuestos", icon: FileText },
      { href: "/finanzas",     label: "Finanzas",     icon: TrendingUp },
    ],
  },
  {
    label: "ANÁLISIS",
    items: [
      { href: "/reportes",       label: "Reportes",       icon: BarChart2 },
      { href: "/administracion", label: "Administración", icon: ShieldCheck },
    ],
  },
];

export default function Sidebar() {
  const pathname            = usePathname();
  const [open, setOpen]     = useState(false);
  const { data: session }   = useSession();

  const userName   = session?.user?.name ?? "Usuario";
  const role       = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel  = role === "ADMIN" ? "Administrador" : "Dentista";
  const initials   = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  const SidebarContent = () => (
    <>
      {/* Header / Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20">
              <Stethoscope className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight tracking-tight">Clínica Magna</p>
              <p className="text-primary-400 text-[11px] font-medium mt-0.5">Sistema Dental</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden text-primary-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-primary-500 text-[10px] font-bold uppercase tracking-[0.1em] px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? "bg-white/10 text-white border-l-[3px] border-primary-400 pl-[9px]"
                        : "text-primary-200/80 hover:text-white hover:bg-white/[0.06] border-l-[3px] border-transparent pl-[9px]"
                    }`}
                  >
                    <Icon size={17} className="flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span className="flex-1 leading-none">{label}</span>
                    {active && <ChevronRight size={13} className="text-primary-400 flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.07] space-y-0.5">
        <Link href="/configuracion" onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
            isActive("/configuracion")
              ? "bg-white/10 text-white border-l-[3px] border-primary-400 pl-[9px]"
              : "text-primary-200/80 hover:text-white hover:bg-white/[0.06] border-l-[3px] border-transparent pl-[9px]"
          }`}
        >
          <Settings size={17} strokeWidth={isActive("/configuracion") ? 2.5 : 2} />
          <span>Configuración</span>
        </Link>

        {/* User card */}
        <div className="mt-2 flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 ring-2 ring-white/10">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate leading-tight">{userName}</p>
            <p className="text-primary-400 text-[10px] font-medium truncate mt-0.5">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="text-primary-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Top bar móvil */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-primary-900 flex items-center gap-3 px-4 h-14 border-b border-white/[0.07]">
        <button onClick={() => setOpen(true)} className="text-primary-300 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-white font-bold text-sm tracking-tight">Clínica Magna</p>
        </div>
      </div>

      {/* Backdrop móvil */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-primary-900 flex-col h-full">
        <SidebarContent />
      </aside>

      {/* Sidebar móvil (drawer) */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-primary-900 flex flex-col transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
      </aside>
    </>
  );
}
