"use client";
import { useRef } from "react";

// ─── Data shape ───────────────────────────────────────────────────────────────
export interface FacialFormData {
  motivoConsulta: string;
  zonasTratar: string;
  expectativas: string;

  tipoPiel: string;
  tipoPielOtra: string;
  tonoPiel: string;
  tonoPielOtra: string;
  texturaPiel: string[];
  texturaPielOtra: string;

  arrugas: string;
  arrugasLoc: string[];
  arrugasLocOtra: string;

  manchas: string;
  manchasOrigen: string;
  manchasOrigenOtra: string;

  flacidez: string;
  flacidezZonas: string[];
  flacidezOtra: string;

  fotos: Array<{ dataUrl: string; descripcion: string }>;

  tpZonas: string[];
  tpZonasOtra: string;
  tpTratamientos: string[];
  tpOtro: string;
  tpObservaciones: string;
}

const EMPTY: FacialFormData = {
  motivoConsulta: "", zonasTratar: "", expectativas: "",
  tipoPiel: "", tipoPielOtra: "",
  tonoPiel: "", tonoPielOtra: "",
  texturaPiel: [], texturaPielOtra: "",
  arrugas: "", arrugasLoc: [], arrugasLocOtra: "",
  manchas: "", manchasOrigen: "", manchasOrigenOtra: "",
  flacidez: "", flacidezZonas: [], flacidezOtra: "",
  fotos: [{ dataUrl: "", descripcion: "" }, { dataUrl: "", descripcion: "" }, { dataUrl: "", descripcion: "" }],
  tpZonas: [], tpZonasOtra: "", tpTratamientos: [], tpOtro: "", tpObservaciones: "",
};

function normalize(raw: any): FacialFormData {
  if (raw && typeof raw === "object" && "motivoConsulta" in raw) return { ...EMPTY, ...raw };
  return { ...EMPTY };
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#F0F2F7] px-4 py-2.5 rounded-t-[10px] border-b border-[#E3E8F0] flex items-center justify-between mb-4">
      <h3 className="text-[13px] font-bold text-[#1A1D2E] uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function Radio({ name, value, checked, label, onChange }: { name: string; value: string; checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange}
        className="w-3.5 h-3.5 accent-[#0057FF] cursor-pointer flex-shrink-0" />
      <span className="text-[12px] text-[#1A1D2E]">{label}</span>
    </label>
  );
}

function Cb({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="w-3.5 h-3.5 accent-[#0057FF] cursor-pointer flex-shrink-0" />
      <span className="text-[12px] text-[#1A1D2E]">{label}</span>
    </label>
  );
}

function OtroInput({ value, onChange, placeholder = "Otro:" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="text-[12px] border-b border-[#CBD5E1] bg-transparent outline-none px-1 w-28 text-[#1A1D2E] placeholder:text-[#9AA0B4] focus:border-[#0057FF]" />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { data: any; onChange: (d: any) => void; readonly?: boolean }

export default function FacialChart({ data, onChange, readonly }: Props) {
  const form = normalize(data);
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  function set<K extends keyof FacialFormData>(key: K, val: FacialFormData[K]) {
    onChange({ ...form, [key]: val });
  }

  function toggleArr(key: "texturaPiel" | "arrugasLoc" | "flacidezZonas" | "tpZonas" | "tpTratamientos", val: string) {
    const cur: string[] = form[key] as string[];
    set(key, cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]);
  }

  function setFotoDesc(i: number, desc: string) {
    const next = form.fotos.map((f, idx) => idx === i ? { ...f, descripcion: desc } : f);
    set("fotos", next);
  }

  async function handleFoto(i: number, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const next = form.fotos.map((f, idx) => idx === i ? { ...f, dataUrl: reader.result as string } : f);
      set("fotos", next);
    };
    reader.readAsDataURL(file);
  }

  const ro = !!readonly;

  return (
    <div className="space-y-0">

      {/* ── DATOS GENERALES ── */}
      <div className="bg-white border border-[#E3E8F0] rounded-[12px] overflow-hidden mb-4">
        <SectionHeader title="Datos generales" />
        <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["motivoConsulta", "zonasTratar", "expectativas"] as const).map((k, i) => (
            <textarea key={k} disabled={ro} value={form[k]}
              onChange={e => set(k, e.target.value)}
              placeholder={["Motivo de consulta", "Zonas a tratar", "Expectativas del tratamiento"][i]}
              rows={3}
              className="w-full text-[12px] border border-[#E3E8F0] rounded-[8px] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#0057FF] placeholder:text-[#9AA0B4] text-[#1A1D2E] disabled:bg-[#F8FAFC]"
            />
          ))}
        </div>
      </div>

      {/* ── EVALUACIÓN ESTÉTICA FACIAL INICIAL ── */}
      <div className="bg-white border border-[#E3E8F0] rounded-[12px] overflow-hidden mb-4">
        <SectionHeader title="Evaluación estética facial inicial" />
        <div className="px-4 pb-5 space-y-5">

          {/* Tipo de piel */}
          <div>
            <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Tipo de piel:</span>
            <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
              {["Normal","Seca","Grasa","Mixta","Sensible","Madura"].map(v => (
                <Radio key={v} name="tipoPiel" value={v} checked={form.tipoPiel === v} label={v}
                  onChange={() => !ro && set("tipoPiel", v)} />
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="tipoPiel" value="Otra" checked={form.tipoPiel === "Otra"}
                  onChange={() => !ro && set("tipoPiel", "Otra")}
                  className="w-3.5 h-3.5 accent-[#0057FF]" disabled={ro} />
                <span className="text-[12px] text-[#1A1D2E]">Otra:</span>
                <OtroInput value={form.tipoPielOtra} onChange={v => !ro && set("tipoPielOtra", v)} />
              </label>
            </div>
          </div>

          {/* Tono de piel */}
          <div>
            <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Tono de piel:</span>
            <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
              {["Muy clara","Clara","Medio","Trigueña","Oscura","Muy oscura"].map(v => (
                <Radio key={v} name="tonoPiel" value={v} checked={form.tonoPiel === v} label={v}
                  onChange={() => !ro && set("tonoPiel", v)} />
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="tonoPiel" value="Otra" checked={form.tonoPiel === "Otra"}
                  onChange={() => !ro && set("tonoPiel", "Otra")}
                  className="w-3.5 h-3.5 accent-[#0057FF]" disabled={ro} />
                <span className="text-[12px] text-[#1A1D2E]">Otra:</span>
                <OtroInput value={form.tonoPielOtra} onChange={v => !ro && set("tonoPielOtra", v)} />
              </label>
            </div>
          </div>

          {/* Escala de Fitzpatrick */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[12px] font-semibold text-[#1A1D2E] mb-2">Escala de Fitzpatrick</p>
              <table className="w-full text-[11px] border border-[#E3E8F0] rounded-[8px] overflow-hidden">
                <thead className="bg-[#F0F2F7]">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#9AA0B4]">Tipo</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#9AA0B4]">Características</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["I",  "Muy clara, se quema siempre, no se broncea"],
                    ["II", "Clara, se quema fácilmente, bronceado mínimo"],
                    ["III","Intermedia, se quema a veces, se broncea uniformemente"],
                    ["IV", "Trigueña, se quema mínimamente, se broncea bien"],
                    ["V",  "Morena, rara vez se quema, se broncea mucho"],
                    ["VI", "Muy oscura, nunca se quema"],
                  ].map(([t, c]) => (
                    <tr key={t} className="border-t border-[#F0F2F7] hover:bg-[#F8FAFC]">
                      <td className="px-2 py-1.5 font-bold text-[#0057FF] text-center w-8">{t}</td>
                      <td className="px-2 py-1.5 text-[#4B5563]">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Textura de la piel */}
            <div>
              <p className="text-[12px] font-semibold text-[#1A1D2E] mb-2">Textura de la piel</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                {["Lisa","Poros dilatados","Rugosa","Fina","Gruesa","Con impurezas","Acné activo","Cicatrices/Marcas"].map(v => (
                  <Cb key={v} label={v} checked={form.texturaPiel.includes(v)}
                    onChange={() => !ro && toggleArr("texturaPiel", v)} />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[12px] text-[#1A1D2E]">Otro:</span>
                <OtroInput value={form.texturaPielOtra} onChange={v => !ro && set("texturaPielOtra", v)} />
              </div>
            </div>
          </div>

          {/* Arrugas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Presencia de arrugas:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                {["Ninguna","Finas o superficiales","Moderadas","Profundas"].map(v => (
                  <Radio key={v} name="arrugas" value={v} checked={form.arrugas === v} label={v}
                    onChange={() => !ro && set("arrugas", v)} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-2">Localización:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                {["Frente","Entrecejo","Contorno de ojos","Labio superior","Cuello/Escote"].map(v => (
                  <Cb key={v} label={v} checked={form.arrugasLoc.includes(v)}
                    onChange={() => !ro && toggleArr("arrugasLoc", v)} />
                ))}
                <label className="flex items-center gap-1.5">
                  <Cb label="Otro:" checked={form.arrugasLoc.includes("Otro")}
                    onChange={() => !ro && toggleArr("arrugasLoc", "Otro")} />
                  <OtroInput value={form.arrugasLocOtra} onChange={v => !ro && set("arrugasLocOtra", v)} />
                </label>
              </div>
            </div>
          </div>

          {/* Manchas */}
          <div className="space-y-2">
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Presencia de manchas:</span>
              <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                {["Ninguna","Pigmentación leve (pequeñas zonas)","Pigmentación moderada (varias zonas)","Hiperpigmentación generalizada"].map(v => (
                  <Radio key={v} name="manchas" value={v} checked={form.manchas === v} label={v}
                    onChange={() => !ro && set("manchas", v)} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Origen o tipo:</span>
              <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5">
                {["Solares","Melasma","Post-inflamatorias","Lentigos seniles"].map(v => (
                  <Radio key={v} name="manchasOrigen" value={v} checked={form.manchasOrigen === v} label={v}
                    onChange={() => !ro && set("manchasOrigen", v)} />
                ))}
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="manchasOrigen" value="Otro" checked={form.manchasOrigen === "Otro"}
                    onChange={() => !ro && set("manchasOrigen", "Otro")}
                    className="w-3.5 h-3.5 accent-[#0057FF]" disabled={ro} />
                  <span className="text-[12px] text-[#1A1D2E]">Otro:</span>
                  <OtroInput value={form.manchasOrigenOtra} onChange={v => !ro && set("manchasOrigenOtra", v)} />
                </label>
              </div>
            </div>
          </div>

          {/* Flacidez */}
          <div className="space-y-2">
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-3">Presencia de flacidez:</span>
              <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                {[
                  ["Ausente","Ausente"],
                  ["Leve","Leve (ligera pérdida de firmeza)"],
                  ["Moderada","Moderada (descenso visible en pómulos, óvalo facial)"],
                  ["Severa","Severa (descolgamiento notorio, papada marcada)"],
                ].map(([v, lbl]) => (
                  <Radio key={v} name="flacidez" value={v} checked={form.flacidez === v} label={lbl}
                    onChange={() => !ro && set("flacidez", v)} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[#1A1D2E] mr-2">Zonas:</span>
              <div className="inline-flex flex-wrap gap-x-4 gap-y-1.5">
                {["Contorno facial","Cuello","Párpados/cejas","Zona peribucal"].map(v => (
                  <Cb key={v} label={v} checked={form.flacidezZonas.includes(v)}
                    onChange={() => !ro && toggleArr("flacidezZonas", v)} />
                ))}
                <label className="flex items-center gap-1.5">
                  <Cb label="Otro:" checked={form.flacidezZonas.includes("Otro")}
                    onChange={() => !ro && toggleArr("flacidezZonas", "Otro")} />
                  <OtroInput value={form.flacidezOtra} onChange={v => !ro && set("flacidezOtra", v)} />
                </label>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── EVALUACIÓN FOTOGRÁFICA ── */}
      <div className="bg-white border border-[#E3E8F0] rounded-[12px] overflow-hidden mb-4">
        <SectionHeader title="Evaluación fotográfica" />
        <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {form.fotos.map((foto, i) => (
            <div key={i} className="space-y-2">
              {/* Photo area */}
              <div
                onClick={() => !ro && fileRefs[i]?.current?.click()}
                className={`h-44 border-2 border-dashed border-[#CBD5E1] rounded-[10px] overflow-hidden flex items-center justify-center bg-[#F8FAFC] ${!ro ? "cursor-pointer hover:border-[#0057FF] hover:bg-[#EEF3FF] transition-colors" : ""}`}
              >
                {foto.dataUrl ? (
                  <img src={foto.dataUrl} alt={`foto ${i+1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#CBD5E1] text-4xl font-thin select-none">+</span>
                )}
              </div>
              {!ro && (
                <input ref={fileRefs[i]} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFoto(i, e.target.files[0])} />
              )}
              {/* Description + button */}
              <div className="flex gap-2">
                <input
                  disabled={ro}
                  value={foto.descripcion}
                  onChange={e => setFotoDesc(i, e.target.value)}
                  placeholder="Añadir descripción"
                  className="flex-1 text-[12px] border border-[#E3E8F0] rounded-[6px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0057FF] placeholder:text-[#9AA0B4] disabled:bg-[#F8FAFC]"
                />
                {!ro && (
                  <button onClick={() => fileRefs[i]?.current?.click()}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-[6px] bg-[#0057FF] text-white hover:bg-[#0041CC] transition-colors flex-shrink-0">
                    Añadir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ZONAS CON TRATAMIENTO PREVIO ── */}
      <div className="bg-white border border-[#E3E8F0] rounded-[12px] overflow-hidden mb-4">
        <SectionHeader title="Zonas con tratamiento previo" />
        <div className="px-4 pb-5 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zonas faciales */}
            <div>
              <p className="text-[12px] font-semibold text-[#1A1D2E] mb-2">Zonas faciales:</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                {["Frente","Entrecejo","Contorno de ojos","Pómulos","Surcos nasogenianos","Labios","Mentón","Mandíbula","Cuello"].map(v => (
                  <Cb key={v} label={v} checked={form.tpZonas.includes(v)}
                    onChange={() => !ro && toggleArr("tpZonas", v)} />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Cb label="Otra:" checked={form.tpZonas.includes("Otra")}
                  onChange={() => !ro && toggleArr("tpZonas", "Otra")} />
                <OtroInput value={form.tpZonasOtra} onChange={v => !ro && set("tpZonasOtra", v)} />
              </div>
            </div>

            {/* Tratamientos previos */}
            <div>
              <p className="text-[12px] font-semibold text-[#1A1D2E] mb-2">Tratamiento previo:</p>
              <div className="grid grid-cols-1 gap-y-1.5">
                {[
                  "Bótox / Toxina botulínica",
                  "Ácido hialurónico (relleno)",
                  "Hilos tensores",
                  "Mesoterapia",
                  "Peeling químico",
                  "Láser / IPL",
                  "Radiofrecuencia",
                  "Plasma rico en plaquetas (PRF)",
                ].map(v => (
                  <Cb key={v} label={v} checked={form.tpTratamientos.includes(v)}
                    onChange={() => !ro && toggleArr("tpTratamientos", v)} />
                ))}
                <div className="flex items-center gap-1.5 mt-1">
                  <Cb label="Otro:" checked={form.tpTratamientos.includes("Otro")}
                    onChange={() => !ro && toggleArr("tpTratamientos", "Otro")} />
                  <OtroInput value={form.tpOtro} onChange={v => !ro && set("tpOtro", v)} />
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <p className="text-[12px] font-semibold text-[#1A1D2E] mb-1.5">Observaciones del tratamiento previo</p>
            <textarea
              disabled={ro}
              value={form.tpObservaciones}
              onChange={e => set("tpObservaciones", e.target.value)}
              rows={4}
              className="w-full text-[12px] border border-[#E3E8F0] rounded-[8px] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#0057FF] placeholder:text-[#9AA0B4] text-[#1A1D2E] disabled:bg-[#F8FAFC]"
              placeholder="Observaciones sobre tratamientos anteriores..."
            />
          </div>

        </div>
      </div>

    </div>
  );
}
