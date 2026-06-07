"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, X, Upload, Trash2, PenLine, Search, User, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/agenda",         label: "Agenda",         adminOnly: false },
  { href: "/pacientes",      label: "Pacientes",      adminOnly: false },
  { href: "/finanzas",       label: "Finanzas",       adminOnly: true  },
  { href: "/prestaciones",   label: "Prestaciones",   adminOnly: false },
  { href: "/reportes",       label: "Reportes",       adminOnly: true  },
  { href: "/administracion", label: "Administración", adminOnly: true  },
];

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  rut: string;
}

export default function Sidebar() {
  const pathname          = usePathname();
  const router            = useRouter();
  const [mobile, setMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sigPreview, setSigPreview]   = useState<string | null>(null);
  const [sigLoaded, setSigLoaded]     = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [deleting,  setDeleting]      = useState(false);
  const [sigError,  setSigError]      = useState("");
  const { data: session } = useSession();

  // Patient search
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState<PatientResult[]>([]);
  const [searchOpen, setSearchOpen]         = useState(false);
  const [searchLoading, setSearchLoading]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userName  = session?.user?.name ?? "Usuario";
  const userId    = (session?.user as any)?.id as string | undefined;
  const role      = (session?.user as any)?.role ?? "DENTIST";
  const roleLabel = role === "ADMIN" ? "Administrador" : role === "RECEPTIONIST" ? "Recepcionista" : "Dentista";
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    try {
      const r = await fetch(`/api/patients?search=${encodeURIComponent(q.trim())}`);
      if (r.ok) {
        const data = await r.json();
        setSearchResults(data.slice(0, 8));
        setSearchOpen(true);
      }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimerRef.current = setTimeout(() => doSearch(val), 220);
  }

  function selectPatient(id: string) {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    router.push(`/pacientes/${id}`);
  }

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
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
            <img src="/LOGO.jpeg" alt="Logo" className="w-full h-full object-contain bg-white"/>
          </div>
          <span className="text-white font-bold text-[14px] hidden lg:block">Clínica Magna</span>
        </Link>

        <div className="h-5 w-px bg-white/10 flex-shrink-0 hidden md:block"/>

        {/* Links de navegación — desktop */}
        <nav className="hidden md:flex items-center gap-0.5 flex-shrink-0">
          {NAV_ITEMS.filter(item => !item.adminOnly || role === "ADMIN").map(({ href, label }) => (
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

        <div className="flex-1"/>

        {/* Buscador de pacientes — pegado al usuario */}
        <div ref={searchRef} className="relative hidden md:block">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0B4] pointer-events-none"/>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              placeholder="Buscar paciente..."
              className="w-[340px] pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.07] border border-white/10 text-white text-[13px] placeholder-[#9AA0B4] outline-none focus:bg-white/[0.10] focus:border-[#0057FF]/60 transition-all"
            />
            {searchLoading && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-[#0057FF]/40 border-t-[#0057FF] rounded-full animate-spin"/>
            )}
          </div>

          {/* Dropdown resultados */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 right-0 w-[260px] bg-[#1E2235] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => selectPatient(p.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.07] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-[#0057FF]/20 flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-[#5D96FF]"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[#9AA0B4] text-[11px]">{p.rut}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchOpen && !searchLoading && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute top-full mt-1.5 right-0 w-[260px] bg-[#1E2235] border border-white/10 rounded-xl shadow-2xl z-50 px-3 py-3 text-center text-[#9AA0B4] text-[12px]">
              Sin resultados para "{searchQuery}"
            </div>
          )}
        </div>

        {/* Usuario + logout */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

            {/* Buscador móvil */}
            <div ref={undefined} className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0B4] pointer-events-none"/>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscar paciente..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.07] border border-white/10 text-white text-[13px] placeholder-[#9AA0B4] outline-none focus:border-[#0057FF]/60 transition-all"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="bg-[#1E2235] border border-white/10 rounded-xl overflow-hidden mb-3">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => { setMobile(false); selectPatient(p.id); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.07] transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#0057FF]/20 flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-[#5D96FF]"/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[13px] font-medium truncate">{p.firstName} {p.lastName}</p>
                      <p className="text-[#9AA0B4] text-[11px]">{p.rut}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <nav className="grid grid-cols-2 gap-1.5">
              {NAV_ITEMS.filter(item => !item.adminOnly || role === "ADMIN").map(({ href, label }) => (
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
            <div className="border-t border-slate-100 px-5 py-3 space-y-1">
              <Link href="/configuracion" onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 w-full text-[13px] text-slate-500 hover:text-[#0057FF] transition-colors font-medium py-1">
                <Settings size={15}/> Configuración
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full text-[13px] text-slate-500 hover:text-red-600 transition-colors font-medium py-1">
                <LogOut size={15}/> Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
