"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, Calendar, FileText,
  TrendingUp, Settings, Stethoscope, ClipboardList,
  Menu, X, BarChart2, ShieldCheck, LogOut,
} from "lucide-react";

const nav = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/pacientes",    label: "Pacientes",    icon: Users },
  { href: "/agenda",       label: "Agenda",       icon: Calendar },
  { href: "/prestaciones", label: "Prestaciones", icon: ClipboardList },
  { href: "/presupuestos", label: "Presupuestos", icon: FileText },
  { href: "/finanzas",     label: "Finanzas",     icon: TrendingUp },
  { href: "/reportes",        label: "Reportes",        icon: BarChart2 },
  { href: "/administracion",  label: "Administración",  icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname            = usePathname();
  const [open, setOpen]     = useState(false);
  const { data: session }   = useSession();

  const userName   = session?.user?.name ?? "Usuario";
  const role       = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel  = role === "ADMIN" ? "Administrador" : "Dentista";
  const initials   = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="px-5 py-5 border-b border-primary-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Clínica Magna</p>
              <p className="text-primary-300 text-xs">Sistema Dental</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden text-primary-300 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-primary-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">Módulos</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-primary-200 hover:text-white hover:bg-primary-800"
              }`}
            >
              <Icon size={20} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: config + user + logout */}
      <div className="px-3 py-4 border-t border-primary-800 space-y-1">
        <Link href="/configuracion" onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname === "/configuracion"
              ? "bg-primary-500 text-white shadow-sm"
              : "text-primary-200 hover:text-white hover:bg-primary-800"
          }`}
        >
          <Settings size={20} />
          <span>Configuración</span>
        </Link>

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{userName}</p>
            <p className="text-primary-400 text-xs truncate">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="text-primary-400 hover:text-red-400 transition-colors p-1 flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior móvil */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-primary-900 flex items-center gap-3 px-4 h-14 border-b border-primary-800">
        <button onClick={() => setOpen(true)} className="text-primary-300 hover:text-white p-1.5 rounded-lg hover:bg-primary-800 transition-colors">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <p className="text-white font-semibold text-sm">Clínica Magna</p>
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
