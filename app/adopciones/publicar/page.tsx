"use client"

import {
  ChangeEvent,
  FormEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { compressImage, compressImages, validateImage } from "../../../lib/imageUpload"

type FormDataType = {
  responsable_nombre: string
  responsable_apellido: string
  responsable_ci: string
  responsable_whatsapp: string
  responsable_calle: string
  responsable_barrio: string

  animal_nombre: string
  especie: string
  sexo: string
  edad_anos: string
  edad_meses: string
  peso_kg: string
  peso_g: string
  tamano: string
  raza: string
  color: string

  vacunado: boolean
  esterilizado: boolean
  desparasitado: boolean
  come_croqueta: boolean
  usa_arenero: boolean
  sabe_pasear_con_correa: boolean
  convive_con_perros: boolean
  convive_con_gatos: boolean
  no_se_lleva_bien_con_perros: boolean
  no_se_lleva_bien_con_gatos: boolean
  convive_con_ninos: boolean

  temperamento: string
  historial_medico: string
  observaciones: string
  motivo_adopcion: string
}

const initialForm: FormDataType = {
  responsable_nombre: "",
  responsable_apellido: "",
  responsable_ci: "",
  responsable_whatsapp: "",
  responsable_calle: "",
  responsable_barrio: "",

  animal_nombre: "",
  especie: "",
  sexo: "",
  edad_anos: "",
  edad_meses: "",
  peso_kg: "",
  peso_g: "0",
  tamano: "",
  raza: "",
  color: "",

  vacunado: false,
  esterilizado: false,
  desparasitado: false,
  come_croqueta: false,
  usa_arenero: false,
  sabe_pasear_con_correa: false,
  convive_con_perros: false,
  convive_con_gatos: false,
  no_se_lleva_bien_con_perros: false,
  no_se_lleva_bien_con_gatos: false,
  convive_con_ninos: false,

  temperamento: "",
  historial_medico: "",
  observaciones: "",
  motivo_adopcion: "",
}

const yearsOptions = Array.from({ length: 21 }, (_, i) => String(i))
const monthsOptions = Array.from({ length: 12 }, (_, i) => String(i))
const kgOptions = Array.from({ length: 41 }, (_, i) => String(i))
const gramsOptions = ["0", "100", "200", "300", "400", "500", "600", "700", "800", "900"]

function makeFileName(prefix: string, file: File) {
  const ext = file.type === "image/webp" ? "webp" : "jpg"
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
}

function onlyLetters(value: string) {
  return value.replace(/[^A-Za-zÀ-ÿ\u00f1\u00d1\s]/g, "")
}

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "")
}

function buildEdad(anos: string, meses: string) {
  const partes: string[] = []

  if (anos && anos !== "0") {
    partes.push(`${anos} ${anos === "1" ? "año" : "años"}`)
  }

  if (meses && meses !== "0") {
    partes.push(`${meses} ${meses === "1" ? "mes" : "meses"}`)
  }

  if (!partes.length) return null
  return partes.join(" y ")
}

function buildPesoKg(kg: string, g: string) {
  if (!kg && (!g || g === "0")) return null
  const kgNum = Number(kg || "0")
  const gNum = Number(g || "0")
  return kgNum + gNum / 1000
}

export default function PublicarAdopcionPage() {
  const [form, setForm] = useState<FormDataType>(initialForm)
  const [fotoPrincipal, setFotoPrincipal] = useState<File | null>(null)
  const [fotosExtras, setFotosExtras] = useState<File[]>([])
  const [acepta, setAcepta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const principalInputRef = useRef<HTMLInputElement | null>(null)
  const extrasInputRef = useRef<HTMLInputElement | null>(null)

  const previewPrincipal = useMemo(() => {
    return fotoPrincipal ? URL.createObjectURL(fotoPrincipal) : ""
  }, [fotoPrincipal])

  const previewExtras = useMemo(() => {
    return fotosExtras.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }))
  }, [fotosExtras])

  function handleInputChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }

    let finalValue = value

    if (
      name === "responsable_nombre" ||
      name === "responsable_apellido" ||
      name === "color" ||
      name === "responsable_barrio"
    ) {
      finalValue = onlyLetters(value)
    }

    if (name === "responsable_ci") {
      finalValue = onlyNumbers(value)
    }

    if (name === "responsable_whatsapp") {
      finalValue = onlyNumbers(value).slice(0, 8)
    }

    setForm((prev) => ({ ...prev, [name]: finalValue }))
  }

  function handleFotoPrincipal(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      validateImage(file)
      setFotoPrincipal(file)
    } catch (error: any) {
      alert(error.message || "No se pudo cargar la imagen.")
    }
  }

  function handleFotosExtras(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])

    try {
      if (files.length > 5) {
        throw new Error("Solo puedes subir hasta 5 fotos extra.")
      }

      files.forEach(validateImage)
      setFotosExtras(files)
    } catch (error: any) {
      alert(error.message || "No se pudieron cargar las imágenes.")
    }
  }

  function removeExtra(index: number) {
    setFotosExtras((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadPrincipal(file: File) {
    const compressed = await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.72,
      outputType: "image/jpeg",
    })

    const path = makeFileName("principal", compressed)

    const { data, error } = await supabase.storage
      .from("adopciones")
      .upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: compressed.type,
      })

    if (error) throw error

    const { data: publicData } = supabase.storage.from("adopciones").getPublicUrl(data.path)
    return publicData.publicUrl
  }

  async function uploadExtras(files: File[]) {
    if (!files.length) return []

    const compressedFiles = await compressImages(files, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.72,
      outputType: "image/jpeg",
    })

    const urls: string[] = []

    for (const file of compressedFiles) {
      const path = makeFileName("extras", file)

      const { data, error } = await supabase.storage
        .from("adopciones")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })

      if (error) throw error

      const { data: publicData } = supabase.storage.from("adopciones").getPublicUrl(data.path)
      urls.push(publicData.publicUrl)
    }

    return urls
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!acepta) {
      alert("Debes confirmar la información antes de enviar.")
      return
    }

    if (!fotoPrincipal) {
      alert("Debes subir una foto principal del animal.")
      return
    }

    if (form.responsable_whatsapp.length !== 8) {
      alert("El número de WhatsApp debe tener exactamente 8 dígitos.")
      return
    }

    if (
      !form.responsable_nombre ||
      !form.responsable_ci ||
      !form.responsable_whatsapp ||
      !form.animal_nombre ||
      !form.especie ||
      !form.sexo
    ) {
      alert("Completa los campos obligatorios.")
      return
    }

    try {
      setSaving(true)

      const foto_principal_url = await uploadPrincipal(fotoPrincipal)
      const fotos_extra = await uploadExtras(fotosExtras)

      const payload = {
        responsable_nombre: form.responsable_nombre,
        responsable_apellido: form.responsable_apellido || null,
        responsable_ci: form.responsable_ci || null,
        responsable_telefono: form.responsable_whatsapp ? `591${form.responsable_whatsapp}` : null,
        responsable_whatsapp: form.responsable_whatsapp ? `591${form.responsable_whatsapp}` : null,
        responsable_calle: form.responsable_calle || null,
        responsable_zona: form.responsable_barrio || null,
        responsable_direccion: null,

        animal_nombre: form.animal_nombre,
        especie: form.especie,
        sexo: form.sexo,
        edad: buildEdad(form.edad_anos, form.edad_meses),
        peso: buildPesoKg(form.peso_kg, form.peso_g),
        tamano: form.tamano || null,
        raza: form.raza || null,
        color: form.color || null,

        vacunado: form.vacunado,
        esterilizado: form.esterilizado,
        desparasitado: form.desparasitado,
        come_croqueta: form.come_croqueta,
        usa_arenero: form.usa_arenero,
        sabe_pasear_con_correa: form.sabe_pasear_con_correa,
        convive_con_perros: form.convive_con_perros,
        convive_con_gatos: form.convive_con_gatos,
        no_se_lleva_bien_con_perros: form.no_se_lleva_bien_con_perros,
        no_se_lleva_bien_con_gatos: form.no_se_lleva_bien_con_gatos,
        convive_con_ninos: form.convive_con_ninos,

        temperamento: form.temperamento || null,
        historial_medico: form.historial_medico || null,
        observaciones: form.observaciones || null,
        motivo_adopcion: form.motivo_adopcion || null,

        foto_principal_url,
        fotos_extra,
        estado: "pendiente",
        visible_publico: false,
        destacado: false,
      }

      const { error } = await supabase.from("adopciones").insert(payload)

      if (error) throw error

      setSuccess(true)
      setForm(initialForm)
      setFotoPrincipal(null)
      setFotosExtras([])
      setAcepta(false)
    } catch (error) {
      console.error(error)
      alert("No se pudo enviar la solicitud de adopción.")
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>

            <h1 className="text-3xl font-bold leading-tight text-[#43a047] md:text-4xl">
           ✅ Solicitud enviada correctamente
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Gracias por enviarnos el perfil. Nuestro equipo revisará la información antes
              de publicar al animal en la sección de adopciones.
            </p>

           <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32]">
            <p className="font-semibold">📌 Importante:</p>
            <p className="mt-1">
             Una vez que el animal sea adoptado, el responsable debe comunicarse con el número oficial de Fundación Rugimos (+591 78556854) para que podamos desactivar la publicación y mantener la plataforma actualizada.
            </p>
          </div>

          </div>

          <div className="mx-auto mt-8 w-full max-w-xl rounded-[28px] border border-[#f2dfcf] bg-[#fff7f1] px-5 py-6 text-center sm:p-6">
            <h2 className="mx-auto max-w-[280px] text-center text-[22px] leading-snug font-bold text-[#b85d27] sm:max-w-md sm:text-2xl">
            ¿Te gustaría colaborar con la fundación?
           </h2>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              Puedes colaborar escaneando nuestro QR de donación.
              Tu ayuda es muy importante. Con cada aporte podemos seguir mejorando
              nuestros servicios, llegar a más animales y fortalecer una adopción responsable y segura.
            </p>

            <div className="mt-6 flex justify-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <img
                src="/qr.png"
                alt="QR de donación Fundación Rugimos"
                className="h-64 w-64 object-contain md:h-72 md:w-72"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setSuccess(false)}
              className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              Enviar otro animal
            </button>

            <Link
              href="/"
              className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
            >
              Volver
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center text-white">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            🐾 Fundación Rugimos 🐾
          </p>

          <h1 className="text-4xl font-bold md:text-5xl">Dar en adopción</h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm text-white/85 md:text-base">
            Ayúdanos a encontrar un hogar responsable y lleno de amor para cada animal.
          </p>

        </div>

        <div className="mb-6 rounded-[24px] border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24] shadow-md">
          <p className="font-semibold">Importante</p>
          <p className="mt-1">
            El envío de este formulario no publica automáticamente al animal. Primero será revisado por nuestro equipo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section title="Datos del responsable">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nombre">
                <Input
                  name="responsable_nombre"
                  value={form.responsable_nombre}
                  onChange={handleInputChange}
                />
              </Field>

              <Field label="Apellido">
                <Input
                  name="responsable_apellido"
                  value={form.responsable_apellido}
                  onChange={handleInputChange}
                />
              </Field>

              <Field label="CI del responsable">
                <Input
                  name="responsable_ci"
                  value={form.responsable_ci}
                  onChange={handleInputChange}
                  inputMode="numeric"
                />
              </Field>

              <Field label="WhatsApp">
                <Input
                  name="responsable_whatsapp"
                  value={form.responsable_whatsapp}
                  onChange={handleInputChange}
                  inputMode="numeric"
                  maxLength={8}
                />
                <p className="mt-1 text-xs text-slate-500">Debe tener exactamente 8 números.</p>
              </Field>

              <Field label="Calle">
                <Input
                  name="responsable_calle"
                  value={form.responsable_calle}
                  onChange={handleInputChange}
                />
              </Field>

              <Field label="Barrio">
                <Input
                  name="responsable_barrio"
                  value={form.responsable_barrio}
                  onChange={handleInputChange}
                />
              </Field>
            </div>
          </Section>

          <Section title="Datos del animal">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Nombre del animal">
                <Input
                  name="animal_nombre"
                  value={form.animal_nombre}
                  onChange={handleInputChange}
                />
              </Field>

              <Field label="Especie">
                <Select name="especie" value={form.especie} onChange={handleInputChange}>
                  <option value="">Seleccionar</option>
                  <option value="Perro">Perro</option>
                  <option value="Gato">Gato</option>
                </Select>
              </Field>

              <Field label="Sexo">
                <Select name="sexo" value={form.sexo} onChange={handleInputChange}>
                  <option value="">Seleccionar</option>
                  <option value="Macho">Macho</option>
                  <option value="Hembra">Hembra</option>
                </Select>
              </Field>

              <Field label="Edad">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Select name="edad_anos" value={form.edad_anos} onChange={handleInputChange}>
                      <option value="">Años</option>
                      {yearsOptions.map((value) => (
                        <option key={value} value={value}>
                          {value} años
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Select name="edad_meses" value={form.edad_meses} onChange={handleInputChange}>
                      <option value="">Meses</option>
                      {monthsOptions.map((value) => (
                        <option key={value} value={value}>
                          {value} meses
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </Field>

              <Field label="Peso">
                <div className="grid grid-cols-2 gap-2">
                  <Select name="peso_kg" value={form.peso_kg} onChange={handleInputChange}>
                    <option value="">Kg</option>
                    {kgOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} kg
                      </option>
                    ))}
                  </Select>

                  <Select name="peso_g" value={form.peso_g} onChange={handleInputChange}>
                    {gramsOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} g
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="Tamaño">
              <Select name="tamano" value={form.tamano} onChange={handleInputChange}>
              <option value="">Seleccionar</option>
              <option value="Pequeño">Pequeño</option>
              <option value="Mediano">Mediano</option>
              <option value="Grande">Grande</option>
              </Select>
              </Field>

              <Field label="Raza">
                <Input
                  name="raza"
                  value={form.raza}
                  onChange={handleInputChange}
                />
              </Field>

              <Field label="Color">
                <Input
                  name="color"
                  value={form.color}
                  onChange={handleInputChange}
                />
              </Field>
            </div>
          </Section>

          <Section title="Salud y convivencia">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Check name="vacunado" checked={form.vacunado} onChange={handleInputChange} label="Vacunado" />
              <Check name="esterilizado" checked={form.esterilizado} onChange={handleInputChange} label="Esterilizado" />
              <Check name="desparasitado" checked={form.desparasitado} onChange={handleInputChange} label="Desparasitado" />
              <Check name="come_croqueta" checked={form.come_croqueta} onChange={handleInputChange} label="Come croqueta" />
              <Check name="usa_arenero" checked={form.usa_arenero} onChange={handleInputChange} label="Usa arenero" />
              <Check name="sabe_pasear_con_correa" checked={form.sabe_pasear_con_correa} onChange={handleInputChange} label="Sabe pasear con correa" />
              <Check
  name="convive_con_perros"
  checked={form.convive_con_perros}
  onChange={handleInputChange}
  label="Convive con perros"
/>
<Check
  name="convive_con_gatos"
  checked={form.convive_con_gatos}
  onChange={handleInputChange}
  label="Convive con gatos"
/>
<Check
  name="no_se_lleva_bien_con_perros"
  checked={form.no_se_lleva_bien_con_perros}
  onChange={handleInputChange}
  label="No se lleva bien con perros"
/>
<Check
  name="no_se_lleva_bien_con_gatos"
  checked={form.no_se_lleva_bien_con_gatos}
  onChange={handleInputChange}
  label="No se lleva bien con gatos"
/>
<Check
  name="convive_con_ninos"
  checked={form.convive_con_ninos}
  onChange={handleInputChange}
  label="Convive con niños"
/>
            </div>
          </Section>

          <Section title="Información adicional">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Temperamento">
                <Textarea name="temperamento" value={form.temperamento} onChange={handleInputChange} />
              </Field>

              <Field label="Historial médico">
                <Textarea name="historial_medico" value={form.historial_medico} onChange={handleInputChange} />
              </Field>

              <Field label="Motivo por el que busca adopción">
                <Textarea name="motivo_adopcion" value={form.motivo_adopcion} onChange={handleInputChange} />
              </Field>

              <Field label="Observaciones importantes">
                <Textarea name="observaciones" value={form.observaciones} onChange={handleInputChange} />
              </Field>
            </div>
          </Section>

          <Section title="Fotos del animal">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
                <p className="mb-2 text-sm font-bold text-[#0b6665]">Foto principal del animal</p>
                <p className="mb-4 text-xs text-slate-500">
                  Elige una foto bonita y clara. Esta será la imagen principal de la publicación.
                </p>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-3">
  <p className="font-semibold mb-1">📸 Consejo para la foto</p>
  <p>
    Usa una foto clara, bien iluminada y donde el animal esté completo y centrado.
    Evita fotos cortadas, muy lejanas o borrosas.
  </p>
</div>

                <input
                  ref={principalInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoPrincipal}
                  className="hidden"
                />

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => principalInputRef.current?.click()}
                    className="rounded-full bg-[#f47c3c] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
                  >
                    Seleccionar foto principal
                  </button>
                </div>

                <p className="mt-3 text-center text-xs text-slate-500">
                  {fotoPrincipal ? fotoPrincipal.name : "Ningún archivo seleccionado"}
                </p>

                {previewPrincipal ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <img
                      src={previewPrincipal}
                      alt="Preview principal"
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    Vista previa de la foto principal
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
                <p className="mb-2 text-sm font-bold text-[#0b6665]">Fotos extras del animal</p>
                <p className="mb-4 text-xs text-slate-500">
                  Puedes subir hasta 5 fotos extras. Elige imágenes que ayuden a mostrar bien al animal.
                </p>

                <input
                  ref={extrasInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFotosExtras}
                  className="hidden"
                />

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => extrasInputRef.current?.click()}
                    className="rounded-full bg-[#0d7a75] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
                  >
                    Seleccionar fotos extras
                  </button>
                </div>

                <p className="mt-3 text-center text-xs text-slate-500">
                  {fotosExtras.length > 0
                    ? `${fotosExtras.length} archivo(s) seleccionado(s)`
                    : "Ningún archivo seleccionado"}
                </p>

                {previewExtras.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {previewExtras.map((item, index) => (
                      <div key={item.url} className="relative overflow-hidden rounded-2xl border border-slate-200">
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-32 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtra(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    Vista previa de las fotos extras
                  </div>
                )}
              </div>
            </div>
          </Section>

          <div className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="text-center text-2xl font-bold text-[#0b6665]">
              Confirmación antes de continuar
            </h2>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-1"
              />
              <span>
                Confirmo que la información enviada es verdadera, autorizo el envío de este caso para revisión y publicación.
              </span>
            </label>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
              >
                Volver
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
              >
                {saving ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
      <h2 className="mb-5 text-xl font-bold text-[#0b6665]">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#0b6665]">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={4}
      className="min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Check({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  )
}