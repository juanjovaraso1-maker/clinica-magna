"use client";
import { useEffect, useState } from "react";
import { Save, Info } from "lucide-react";
import Badge from "@/components/ui/Badge";

export default function Configuracion() {
  const [users, setUsers] = useState<Array<{id:string;name:string;email:string;role:string;specialty:string}>>([]);
  const [cfg, setCfg] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/users").then(r=>r.json()).then(setUsers);
    fetch("/api/clinic-config").then(r=>r.json()).then(setCfg);
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/clinic-config", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(cfg) });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  const set = (k:string,v:string) => setCfg(c=>({...c,[k]:v}));

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="page-title">Configuración</h1><p className="text-muted">Datos de la clínica y configuración del sistema</p></div>

      {/* Clinic info */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Datos de la Clínica</h2>
        <p className="text-xs text-slate-400">Esta información aparece en los presupuestos y recordatorios</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Nombre de la clínica</label><input className="input" value={cfg.clinic_name??""} onChange={e=>set("clinic_name",e.target.value)} placeholder="Clínica Magna"/></div>
          <div><label className="label">Teléfono</label><input className="input" value={cfg.clinic_phone??""} onChange={e=>set("clinic_phone",e.target.value)} placeholder="+56 2 2345 6789"/></div>
          <div className="col-span-2"><label className="label">Dirección</label><input className="input" value={cfg.clinic_address??""} onChange={e=>set("clinic_address",e.target.value)} placeholder="Av. Principal 123, Santiago"/></div>
          <div><label className="label">Email de la clínica</label><input className="input" type="email" value={cfg.clinic_email??""} onChange={e=>set("clinic_email",e.target.value)} placeholder="contacto@clinicamagna.cl"/></div>
          <div><label className="label">Sitio web</label><input className="input" value={cfg.clinic_website??""} onChange={e=>set("clinic_website",e.target.value)} placeholder="www.clinicamagna.cl"/></div>
          <div className="col-span-2"><label className="label">URL base del sistema</label>
            <input className="input" value={cfg.base_url??""} onChange={e=>set("base_url",e.target.value)} placeholder="http://localhost:3000"/>
            <p className="text-xs text-slate-400 mt-1">Usada en los links de confirmación de citas. Cambiar si el sistema es accesible desde internet.</p>
          </div>
        </div>
      </div>

      {/* Email SMTP */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="section-title">Configuración de Email (SMTP)</h2>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <Info size={15} className="text-blue-600 mt-0.5 flex-shrink-0"/>
          <p className="text-xs text-blue-700">Para Gmail: activa "Contraseñas de aplicación" en tu cuenta Google y usa esa contraseña aquí. <strong>Host: smtp.gmail.com · Puerto: 587</strong></p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Servidor SMTP (Host)</label><input className="input" value={cfg.smtp_host??""} onChange={e=>set("smtp_host",e.target.value)} placeholder="smtp.gmail.com"/></div>
          <div><label className="label">Puerto</label><input className="input" value={cfg.smtp_port??""} onChange={e=>set("smtp_port",e.target.value)} placeholder="587"/></div>
          <div><label className="label">Usuario (Email)</label><input className="input" value={cfg.smtp_user??""} onChange={e=>set("smtp_user",e.target.value)} placeholder="tu@gmail.com"/></div>
          <div><label className="label">Contraseña de aplicación</label><input className="input" type="password" value={cfg.smtp_pass??""} onChange={e=>set("smtp_pass",e.target.value)} placeholder="••••••••••••••••"/></div>
          <div>
            <label className="label">Seguridad</label>
            <select className="select" value={cfg.smtp_secure??""} onChange={e=>set("smtp_secure",e.target.value)}>
              <option value="false">STARTTLS (puerto 587)</option>
              <option value="true">SSL/TLS (puerto 465)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Usuarios */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Usuarios del sistema</h2>
        <div className="space-y-3">
          {users.map(u=>(
            <div key={u.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">{u.name.split(" ").map((w:string)=>w[0]).slice(0,2).join("")}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}{u.specialty?` · ${u.specialty}`:""}</p>
              </div>
              <Badge value={u.role}/>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="card p-6">
        <h2 className="section-title mb-2">Sistema</h2>
        <dl className="space-y-2 text-sm">
          {[["Versión","1.0.0"],["Base de datos","SQLite (local)"],["Capacidad","Hasta 3 usuarios"],["Stack","Next.js 14 · Prisma · Tailwind CSS"]].map(([k,v])=>(
            <div key={k} className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={16}/> {saved?"✅ Guardado":saving?"Guardando...":"Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
