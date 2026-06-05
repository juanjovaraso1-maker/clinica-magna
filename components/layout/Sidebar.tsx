"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/agenda",         label: "Agenda" },
  { href: "/pacientes",      label: "Pacientes" },
  { href: "/finanzas",       label: "Finanzas" },
  { href: "/prestaciones",   label: "Prestaciones" },
  { href: "/reportes",       label: "Reportes" },
  { href: "/administracion", label: "Administración" },
  { href: "/configuracion",  label: "Configuración" },
];

export default function Sidebar() {
  const pathname          = usePathname();
  const [mobile, setMobile] = useState(false);
  const { data: session } = useSession();

  const userName  = session?.user?.name ?? "Usuario";
  const role      = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel = role === "ADMIN" ? "Administrador" : role === "RECEPTIONIST" ? "Recepcionista" : "Dentista";
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  function isActive(href: string) {
    return pathname === href || (href !== "/agenda" && pathname.startsWith(href));
  }

  return (
    <>
      {/* ── Barra superior fija ── */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-[#1A1D2E] border-b border-white/[0.06] h-[52px] flex items-center px-4 gap-3">

        {/* Logo */}
        <Link href="/agenda" className="flex items-center gap-2.5 flex-shrink-0 mr-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0057FF] to-[#0041CC] flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px] font-bold">CM</span>
          </div>
          <span className="text-white font-bold text-[14px] hidden lg:block">Clínica Magna</span>
        </Link>

        <div className="h-5 w-px bg-white/10 flex-shrink-0 hidden md:block"/>

        {/* Links de navegación — desktop */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive(href)
                  ? "bg-[#0057FF]/20 text-[#5D96FF]"
                  : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
              }`}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Usuario + logout */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex flex-col text-right leading-tight">
            <span className="text-white text-[12px] font-semibold">{userName}</span>
            <span className="text-[#9AA0B4] text-[10px]">{roleLabel}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3378FF] to-[#0041CC] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} title="Cerrar sesión"
            className="p-1.5 rounded-lg text-[#9AA0B4] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
            <LogOut size={16}/>
          </button>
          {/* Botón menú móvil */}
          <button className="md:hidden p-1.5 rounded-lg text-[#9AA0B4] hover:text-white transition-colors"
            onClick={() => setMobile(true)}>
            <Menu size={20}/>
          </button>
        </div>
      </header>

      {/* ── Menú móvil ── */}
      {mobile && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setMobile(false)}/>
          <div className="fixed top-[52px] left-0 right-0 z-50 bg-[#1A1D2E] border-b border-white/[0.06] p-3 shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-white font-semibold text-[14px]">Menú</span>
              <button onClick={() => setMobile(false)} className="text-[#9AA0B4] hover:text-white p-1">
                <X size={18}/>
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-1.5">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setMobile(false)}
                  className={`px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all text-center ${
                    isActive(href)
                      ? "bg-[#0057FF]/20 text-[#5D96FF]"
                      : "text-[#9AA0B4] hover:bg-white/[0.07] hover:text-white"
                  }`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
