"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, X, Upload, Trash2, PenLine } from "lucide-react";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [sigPreview, setSigPreview]   = useState<string | null>(null);
  const [sigLoaded, setSigLoaded]     = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [deleting,  setDeleting]      = useState(false);
  const [sigError,  setSigError]      = useState("");
  const { data: session } = useSession();

  const userName  = session?.user?.name ?? "Usuario";
  const userId    = (session?.user as any)?.id as string | undefined;
  const role      = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel = role === "ADMIN" ? "Administrador" : role === "RECEPTIONIST" ? "Recepcionista" : "Dentista";
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  async function openProfile() {
    setProfileOpen(true);
    setSigError("");
    if (!sigLoaded && userId) {
      const r = await fetch("/api/users");
      if (r.ok) {
        const users: any[] = await r.json();
        const me = users.find(u => u.id === userId);
        setSigPreview(me?.signatureUrl ?? null);
        setSigLoaded(true);
      }
    }
  }

  async function uploadSig(file: File) {
    if (!userId) return;
    if (!["image/png","image/jpeg","image/jpg","image/webp"].includes(file.type)) {
      setSigError("Solo PNG, JPG o WebP"); return;
    }
    if (file.size > 2 * 1024 * 1024) { setSigError("Máximo 2MB"); return; }
    setUploading(true); setSigError("");
    const fd = new FormData(); fd.append("signature", file);
    const r  = await fetch(`/api/users/${userId}/signature`, { method: "POST", body: fd });
    const d  = await r.json();
    if (d.ok) {
      const reader = new FileReader();
      reader.onload = e => setSigPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setSigError(d.error || "Error al subir"); }
    setUploading(false);
  }

  async function deleteSig() {
    if (!userId) return;
    setDeleting(true);
    await fetch(`/api/users/${userId}/signature`, { method: "DELETE" });
    setSigPreview(null);
    setDeleting(false);
  }

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
          <button onClick={openProfile}
            className="hidden sm:flex flex-col text-right leading-tight hover:opacity-80 transition-opacity cursor-pointer">
            <span className="text-white text-[12px] font-semibold">{userName}</span>
            <span className="text-[#9AA0B4] text-[10px]">{roleLabel}</span>
          </button>
          <button onClick={openProfile} title="Mi perfil y firma"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3378FF] to-[#0041CC] flex items-center justify-center flex-shrink-0 hover:ring-2 hover:ring-white/30 transition-all cursor-pointer">
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </button>
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
      {/* ── Modal Mi Perfil / Firma ── */}
      {profileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => setProfileOpen(false)}/>
          <div className="fixed top-[60px] right-4 z-50 w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-[#1A1D2E] px-5 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3378FF] to-[#0041CC] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[14px] font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[14px] truncate">{userName}</p>
                <p className="text-[#9AA0B4] text-[11px]">{roleLabel}</p>
              </div>
              <button onClick={() => setProfileOpen(false)} className="text-[#9AA0B4] hover:text-white transition-colors p-1">
                <X size={16}/>
              </button>
            </div>

            {/* Firma */}
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PenLine size={15} className="text-[#0057FF]"/>
                  <p className="text-[13px] font-bold text-[#1A1D2E]">Mi firma digital</p>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Se mostrará en recetas, presupuestos y documentos clínicos.</p>

                {/* Preview */}
                <div className="w-full h-[110px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden mb-3">
                  {sigPreview
                    ? <img src={sigPreview} alt="Firma" className="max-h-[100px] max-w-full object-contain p-2"/>
                    : <div className="text-center">
                        <PenLine size={24} className="mx-auto mb-1.5 text-slate-300"/>
                        <p className="text-[11px] text-slate-400">Sin firma cargada</p>
                      </div>
                  }
                </div>

                {/* Acciones */}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-[#0057FF]/30 bg-[#EEF3FF] text-[#0057FF] font-semibold text-[13px] cursor-pointer hover:bg-[#0057FF] hover:text-white transition-all ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload size={15}/>
                  {uploading ? "Subiendo..." : sigPreview ? "Reemplazar firma" : "Subir firma"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadSig(f); e.target.value = ""; }}/>
                </label>

                {sigPreview && (
                  <button onClick={deleteSig} disabled={deleting}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50 mt-2">
                    <Trash2 size={14}/> {deleting ? "Eliminando..." : "Eliminar firma"}
                  </button>
                )}

                {sigError && <p className="text-red-500 text-[12px] mt-2 text-center">{sigError}</p>}
                <p className="text-[10px] text-slate-400 text-center mt-2">PNG, JPG o WebP · Máx. 2MB · Fondo transparente recomendado</p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-5 py-3">
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full text-[13px] text-slate-500 hover:text-red-600 transition-colors font-medium">
                <LogOut size={15}/> Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
