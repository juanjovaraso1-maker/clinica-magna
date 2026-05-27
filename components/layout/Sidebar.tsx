"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, Calendar, FileText,
  TrendingUp, Settings, ClipboardList,
  Menu, X, BarChart2, ShieldCheck, LogOut,
} from "lucide-react";

const navGroups = [
  {
    items: [
      { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
      { href: "/pacientes",    label: "Pacientes",    icon: Users },
      { href: "/agenda",       label: "Agenda",       icon: Calendar },
    ],
  },
  {
    items: [
      { href: "/prestaciones", label: "Prestaciones", icon: ClipboardList },
      { href: "/presupuestos", label: "Presupuestos", icon: FileText },
      { href: "/finanzas",     label: "Finanzas",     icon: TrendingUp },
    ],
  },
  {
    items: [
      { href: "/reportes",       label: "Reportes",       icon: BarChart2 },
      { href: "/administracion", label: "Administración", icon: ShieldCheck },
    ],
  },
];

export default function Sidebar() {
  const pathname          = usePathname();
  const [open, setOpen]   = useState(false);
  const { data: session } = useSession();

  const userName  = session?.user?.name ?? "Usuario";
  const role      = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel = role === "ADMIN" ? "Administrador" : "Dentista";
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  /* ── Desktop icon-only sidebar ── */
  const DesktopSidebar = () => (
    <aside className="hidden md:flex w-[52px] flex-shrink-0 flex-col h-full bg-[#1A1D2E]">
      {/* Logo */}
      <div className="flex items-center justify-center h-[56px] flex-shrink-0 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-[#0057FF] to-[#0041CC] flex items-center justify-center shadow-sm">
          <span className="text-white text-[11px] font-bold tracking-tight">CM</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col items-center gap-0.5 w-full px-[7px]">
            {gi > 0 && (
              <div className="w-6 h-px bg-white/[0.07] my-2 mx-auto" />
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <div key={href} className="relative group/nav w-full">
                  <Link
                    href={href}
                    className={`flex items-center justify-center w-full h-[38px] rounded-[10px] transition-all duration-150 ${
                      active
                        ? "bg-[#0057FF]/20 text-[#5D96FF]"
                        : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  </Link>
                  {/* CSS tooltip */}
                  <div className="
                    absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[200]
                    bg-[#1A1D2E] border border-white/10 text-white text-[12px] font-medium
                    px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg
                    pointer-events-none
                    opacity-0 group-hover/nav:opacity-100
                    transition-opacity duration-150
                  ">
                    {label}
                    <span className="absolute right-full top-1/2 -translate-y-1/2
                      border-4 border-transparent border-r-[#1A1D2E]" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col items-center py-3 gap-1 border-t border-white/[0.06] px-[7px]">
        {/* Config */}
        <div className="relative group/nav w-full">
          <Link
            href="/configuracion"
            className={`flex items-center justify-center w-full h-[38px] rounded-[10px] transition-all duration-150 ${
              isActive("/configuracion")
                ? "bg-[#0057FF]/20 text-[#5D96FF]"
                : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <Settings size={18} strokeWidth={isActive("/configuracion") ? 2.5 : 2} />
          </Link>
          <div className="
            absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[200]
            bg-[#1A1D2E] border border-white/10 text-white text-[12px] font-medium
            px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none
            opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150
          ">
            Configuración
            <span className="absolute right-full top-1/2 -translate-y-1/2
              border-4 border-transparent border-r-[#1A1D2E]" />
          </div>
        </div>

        {/* User avatar + logout */}
        <div className="relative group/nav w-full mt-1">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="flex items-center justify-center w-full h-[38px] rounded-[10px] transition-all duration-150
                       text-[#9AA0B4] hover:bg-[#E53935]/10 hover:text-[#E53935]"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3378FF] to-[#0041CC] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
          </button>
          <div className="
            absolute left-full ml-2.5 bottom-0 z-[200]
            bg-[#1A1D2E] border border-white/10 text-white text-[12px] font-medium
            px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none
            opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150
          ">
            <p className="font-semibold text-[11px]">{userName}</p>
            <p className="text-[#9AA0B4] text-[10px]">{roleLabel} · Cerrar sesión</p>
            <span className="absolute right-full bottom-3
              border-4 border-transparent border-r-[#1A1D2E]" />
          </div>
        </div>
      </div>
    </aside>
  );

  /* ── Mobile drawer (full width, shows labels) ── */
  const MobileDrawerContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-[56px] border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-[#0057FF] to-[#0041CC] flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">CM</span>
          </div>
          <div>
            <p className="text-white font-semibold text-[13px] leading-tight">Clínica Magna</p>
            <p className="text-[#9AA0B4] text-[11px]">Sistema Dental</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-[#9AA0B4] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="h-px bg-white/[0.07] mx-2 mb-4" />}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? "bg-[#0057FF]/20 text-[#5D96FF]"
                        : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-0.5">
        <Link href="/configuracion" onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 ${
            isActive("/configuracion")
              ? "bg-[#0057FF]/20 text-[#5D96FF]"
              : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
          }`}
        >
          <Settings size={17} />
          Configuración
        </Link>
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3378FF] to-[#0041CC] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{userName}</p>
            <p className="text-[#9AA0B4] text-[10px]">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="text-[#9AA0B4] hover:text-[#E53935] transition-colors p-1.5 flex-shrink-0"
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
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#1A1D2E] flex items-center gap-3 px-4 h-14 border-b border-white/[0.06]">
        <button onClick={() => setOpen(true)} className="text-[#9AA0B4] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0057FF] to-[#0041CC] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">CM</span>
          </div>
          <p className="text-white font-semibold text-sm">Clínica Magna</p>
        </div>
      </div>

      {/* Backdrop móvil */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <DesktopSidebar />

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#1A1D2E] flex flex-col transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <MobileDrawerContent />
      </aside>
    </>
  );
}
