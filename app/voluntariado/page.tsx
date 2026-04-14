"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type FormDataType = {
  nombre_completo: string
  fecha_nacimiento: string
  edad: string

  ci_pasaporte: string
  celular: string
  email: string
  direccion: string

  universidad: string
  universidad_otra: string
  carrera: string
  semestre_ano: string
  ultimo_ano: boolean
  internado_actual: boolean

  experiencia_previa: string
  areas_interes: string[]
  aptitudes: string
  motivacion: string
  disponibilidad_texto: string

  contacto_emergencia_nombre: string
  contacto_emergencia_telefono: string

  acepta_terminos: boolean
  acepta_normas: boolean
  confirma_consentimiento: boolean
  acepta_vacunas: boolean
}

const initialForm: FormDataType = {
  nombre_completo: "",
  fecha_nacimiento: "",
  edad: "",

  ci_pasaporte: "",
  celular: "",
  email: "",
  direccion: "",

  universidad: "",
  universidad_otra: "",
  carrera: "",
  semestre_ano: "",
  ultimo_ano: false,
  internado_actual: false,

  experiencia_previa: "",
  areas_interes: [],
  aptitudes: "",
  motivacion: "",
  disponibilidad_texto: "",

  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",

  acepta_terminos: false,
  acepta_normas: false,
  confirma_consentimiento: false,
  acepta_vacunas: false,
}

const interestOptions = [
  "Apoyo en cirugía",
  "Preparación de pacientes",
  "Recuperación postoperatoria",
  "Organización y flujo clínico",
  "Atención y orientación a tutores",
]

const universidadOptions = [
  "UAGRM",
  "UPSA",
  "UDABOL",
  "UNIVALLE",
  "UPDS",
  "UTEPSA",
  "Universidad Católica Boliviana",
  "Otra",
]

function onlyLetters(value: string) {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, "")
}

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "")
}

function cleanCI(value: string) {
  return value.replace(/[^0-9a-zA-Z\-]/g, "").toUpperCase()
}

function calculateAge(dateString: string) {
  if (!dateString) return ""
  const today = new Date()
  const birthDate = new Date(dateString)

  if (Number.isNaN(birthDate.getTime())) return ""

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  if (age < 0) return ""
  return String(age)
}

export default function VoluntariadoPage() {
  const [form, setForm] = useState<FormDataType>(initialForm)

  const [documentoFile, setDocumentoFile] = useState<File | null>(null)
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [vacunasFile, setVacunasFile] = useState<File | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null)

  const mostrarTermo = form.acepta_terminos && form.acepta_normas
  const universidadFinal =
    form.universidad === "Otra" ? form.universidad_otra.trim() : form.universidad.trim()

  useEffect(() => {
    const edadCalculada = calculateAge(form.fecha_nacimiento)
    setForm((prev) => {
      if (prev.edad === edadCalculada) return prev
      return { ...prev, edad: edadCalculada }
    })
  }, [form.fecha_nacimiento])

  const progress = useMemo(() => {
    const checks = [
      form.nombre_completo,
      form.fecha_nacimiento,
      form.edad,
      form.ci_pasaporte,
      form.celular,
      form.email,
      form.direccion,
      universidadFinal,
      form.carrera,
      form.semestre_ano,
      form.motivacion,
      form.disponibilidad_texto,
      form.contacto_emergencia_nombre,
      form.contacto_emergencia_telefono,
      form.acepta_terminos,
      form.acepta_normas,
      form.acepta_vacunas,
      form.confirma_consentimiento,
      documentoFile,
      comprobanteFile,
      vacunasFile,
    ]

    const filled = checks.filter(Boolean).length
    return Math.round((filled / checks.length) * 100)
  }, [form, documentoFile, comprobanteFile, vacunasFile, universidadFinal])

  function setField<K extends keyof FormDataType>(field: K, value: FormDataType[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleInterest(value: string) {
    setForm((prev) => {
      const exists = prev.areas_interes.includes(value)
      return {
        ...prev,
        areas_interes: exists
          ? prev.areas_interes.filter((item) => item !== value)
          : [...prev.areas_interes, value],
      }
    })
  }

  function validateForm() {
    if (!form.nombre_completo.trim()) return "Por favor, complete el nombre completo."
    if (!form.fecha_nacimiento) return "Por favor, complete la fecha de nacimiento."
    if (!form.edad) return "No fue posible calcular la edad. Revise la fecha de nacimiento."
    if (!form.ci_pasaporte.trim()) return "Por favor, complete el CI / Pasaporte."
    if (!form.celular.trim()) return "Por favor, complete el celular."
    if (!form.email.trim()) return "Por favor, complete el email."
    if (!form.direccion.trim()) return "Por favor, complete la dirección."
    if (!universidadFinal) return "Por favor, indique la universidad."
    if (!form.carrera.trim()) return "Por favor, indique la carrera."
    if (!form.semestre_ano.trim()) return "Por favor, indique en qué semestre o año está."
    if (!form.motivacion.trim()) return "Por favor, cuéntenos su motivación."
    if (!form.disponibilidad_texto.trim()) return "Por favor, indique su disponibilidad."
    if (!form.contacto_emergencia_nombre.trim()) {
      return "Por favor, complete el nombre del contacto de emergencia."
    }
    if (!form.contacto_emergencia_telefono.trim()) {
      return "Por favor, complete el teléfono del contacto de emergencia."
    }
    if (!documentoFile) return "Debe subir un documento de identidad."
    if (!comprobanteFile) return "Debe subir un comprobante de estudio."
    if (!vacunasFile) return "Debe subir el carnet de vacunación."
    if (!form.acepta_terminos) return "Debe aceptar el compromiso de voluntariado."
    if (!form.acepta_normas) return "Debe aceptar las normas y supervisión."
    if (!form.acepta_vacunas) {
      return "Debe confirmar que cuenta con vacunas obligatorias al día y asumir la responsabilidad de su participación."
    }
    if (!form.confirma_consentimiento) {
      return "Debe leer y confirmar el consentimiento de voluntariado antes de enviar la postulación."
    }
    return null
  }

  async function uploadFile(file: File, folder: string) {
    const ext = file.name.split(".").pop() || "dat"
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("voluntarios-documentos")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Error al subir archivo (${file.name}): ${uploadError.message}`)
    }

    const { data } = supabase.storage.from("voluntarios-documentos").getPublicUrl(fileName)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    try {
      setLoading(true)

      const documentoUrl = documentoFile
        ? await uploadFile(documentoFile, "documento-identidad")
        : null

      const comprobanteUrl = comprobanteFile
        ? await uploadFile(comprobanteFile, "comprobante-estudio")
        : null

      const vacunasUrl = vacunasFile ? await uploadFile(vacunasFile, "carnet-vacunacion") : null
      const cvUrl = cvFile ? await uploadFile(cvFile, "hoja-vida") : null

      const edadNumber =
        form.edad && !Number.isNaN(Number(form.edad)) ? Number(form.edad) : null

      const { data: voluntario, error: insertError } = await supabase
        .from("voluntarios")
        .insert({
          nombre_completo: form.nombre_completo.trim(),
          fecha_nacimiento: form.fecha_nacimiento || null,
          edad: edadNumber,

          ci_pasaporte: form.ci_pasaporte.trim() || null,
          celular: form.celular.trim() || null,
          email: form.email.trim() || null,
          ciudad: null,
          zona: null,
          direccion: form.direccion.trim() || null,

          universidad: universidadFinal || null,
          carrera: form.carrera.trim() || null,
          semestre_ano: form.semestre_ano.trim() || null,
          ultimo_ano: form.ultimo_ano,
          internado_actual: form.internado_actual,

          experiencia_previa: form.experiencia_previa.trim() || null,
          areas_interes: form.areas_interes,
          aptitudes: form.aptitudes.trim() || null,
          motivacion: form.motivacion.trim() || null,
          disponibilidad_texto: form.disponibilidad_texto.trim() || null,

          contacto_emergencia_nombre: form.contacto_emergencia_nombre.trim() || null,
          contacto_emergencia_telefono: form.contacto_emergencia_telefono.trim() || null,

          documento_identidad_url: documentoUrl,
          comprobante_estudio_url: comprobanteUrl,
          carnet_vacunacion_url: vacunasUrl,
          hoja_vida_url: cvUrl,

          acepta_terminos: form.acepta_terminos,
          acepta_normas: form.acepta_normas,
          acepta_vacunas: form.acepta_vacunas,

          estado: "pendiente",
          nivel: "observador",
        })
        .select("id, codigo")
        .single()

      if (insertError) throw insertError

      setCodigoGenerado(voluntario?.codigo || null)
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Ocurrió un error al registrar la postulación.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setLoading(false)
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
              ✅ Postulación enviada correctamente
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Gracias por postularse al Programa de Voluntariado Clínico de Fundación Rugimos.
              Su solicitud será revisada por nuestro equipo y nos contactaremos si avanza a la
              siguiente etapa.
            </p>

            {codigoGenerado ? (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32]">
                <p className="font-semibold">Código de postulación</p>
                <p className="mt-2 text-xl font-bold">{codigoGenerado}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex justify-center">
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
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/75">
            🐾 FUNDACIÓN RUGIMOS 🐾
          </p>

          <h1 className="text-4xl font-bold md:text-5xl">Programa de Voluntariado Clínico</h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm text-white/85 md:text-base">
            Si estás en una etapa avanzada de tu formación y deseas aprender, apoyar y contribuir
            al bienestar animal, te invitamos a postularte como voluntario clínico.
          </p>

          <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-full bg-white/15">
            <div
              className="h-2 rounded-full bg-[#f47c3c] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-3 text-sm text-white/85">Formulario completado: {progress}%</p>
        </div>

        <div className="mb-6 rounded-[24px] border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24] shadow-md">
          <p className="font-semibold">Importante</p>
          <p className="mt-1">
            Este programa está orientado a personas con compromiso, responsabilidad y verdadero
            interés en apoyar jornadas clínicas reales, bajo supervisión y siguiendo el manejo de
            cada clínica.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
            <p className="font-semibold">Revisar</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section title="Datos personales">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre completo">
                <Input
                  value={form.nombre_completo}
                  onChange={(e) => setField("nombre_completo", onlyLetters(e.target.value))}
                  placeholder="Nombre y apellidos"
                />
              </Field>

              <Field label="Fecha de nacimiento">
                <Input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) => setField("fecha_nacimiento", e.target.value)}
                />
              </Field>

              <Field label="Edad">
                <Input
                  value={form.edad ? `${form.edad} años` : ""}
                  disabled
                  placeholder="Edad calculada automáticamente"
                />
              </Field>

              <Field label="CI / Pasaporte">
                <Input
                  value={form.ci_pasaporte}
                  onChange={(e) => setField("ci_pasaporte", cleanCI(e.target.value))}
                  placeholder="Documento de identidad"
                  inputMode="text"
                />
              </Field>

              <Field label="Celular">
                <Input
                  value={form.celular}
                  onChange={(e) => setField("celular", onlyNumbers(e.target.value))}
                  placeholder="Número de celular"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Dirección completa">
                <Input
                  value={form.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  placeholder="Ej. Zona Norte, Av. Banzer, Calle 3"
                />
              </Field>
            </div>
          </Section>

          <Section title="Formación académica">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Universidad / institución">
                <Select
                  value={form.universidad}
                  onChange={(e) => setField("universidad", e.target.value)}
                >
                  <option value="">Seleccione su universidad</option>
                  {universidadOptions.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Carrera">
                <Input
                  value={form.carrera}
                  onChange={(e) => setField("carrera", onlyLetters(e.target.value))}
                  placeholder="Ej. Medicina Veterinaria"
                />
              </Field>

              {form.universidad === "Otra" ? (
                <Field label="Indique su universidad">
                  <Input
                    value={form.universidad_otra}
                    onChange={(e) => setField("universidad_otra", e.target.value)}
                    placeholder="Escriba el nombre de su universidad"
                  />
                </Field>
              ) : null}

              <Field label="Semestre / año actual">
                <Input
                  value={form.semestre_ano}
                  onChange={(e) => setField("semestre_ano", e.target.value)}
                  placeholder="Ej. 5to año / Internado"
                />
              </Field>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <CheckCard
                label="Estoy en el último año o una etapa avanzada"
                checked={form.ultimo_ano}
                onClick={() => setField("ultimo_ano", !form.ultimo_ano)}
              />

              <CheckCard
                label="Actualmente realizo internado / práctica clínica"
                checked={form.internado_actual}
                onClick={() => setField("internado_actual", !form.internado_actual)}
              />
            </div>
          </Section>

          <Section title="Intereses, perfil y motivación">
            <Field label="Áreas de interés">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {interestOptions.map((item) => (
                  <ChoicePill
                    key={item}
                    label={item}
                    selected={form.areas_interes.includes(item)}
                    onClick={() => toggleInterest(item)}
                  />
                ))}
              </div>
            </Field>

            <div className="mt-5 grid grid-cols-1 gap-5">
              <Field label="Experiencia previa (opcional)">
                <Textarea
                  value={form.experiencia_previa}
                  onChange={(e) => setField("experiencia_previa", e.target.value)}
                  placeholder="Cuéntenos si ya participó en clínicas, campañas, voluntariados o apoyo quirúrgico"
                />
              </Field>

              <Field label="Aptitudes o fortalezas">
                <Textarea
                  value={form.aptitudes}
                  onChange={(e) => setField("aptitudes", e.target.value)}
                  placeholder="Ej. responsabilidad, puntualidad, trabajo en equipo, manejo básico clínico, organización"
                />
              </Field>

              <Field label="¿Por qué quiere formar parte del voluntariado clínico?">
                <Textarea
                  value={form.motivacion}
                  onChange={(e) => setField("motivacion", e.target.value)}
                  placeholder="Escriba su motivación para participar"
                />
              </Field>

              <Field label="Disponibilidad">
                <Textarea
                  value={form.disponibilidad_texto}
                  onChange={(e) => setField("disponibilidad_texto", e.target.value)}
                  placeholder="Indique qué días y horarios podría asistir"
                />
              </Field>
            </div>
          </Section>

          <Section title="Documentación">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Documento de identidad">
                <FileInput
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(file) => setDocumentoFile(file)}
                />
                {documentoFile ? <FileTag name={documentoFile.name} /> : null}
              </Field>

              <Field label="Comprobante de estudio">
                <FileInput
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(file) => setComprobanteFile(file)}
                />
                {comprobanteFile ? <FileTag name={comprobanteFile.name} /> : null}
              </Field>

              <Field label="Carnet de vacunación">
                <FileInput
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(file) => setVacunasFile(file)}
                />
                {vacunasFile ? <FileTag name={vacunasFile.name} /> : null}
              </Field>

              <Field label="Hoja de vida / CV (opcional)">
                <FileInput
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(file) => setCvFile(file)}
                />
                {cvFile ? <FileTag name={cvFile.name} /> : null}
              </Field>
            </div>
          </Section>

          <Section title="Contacto de emergencia">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del contacto">
                <Input
                  value={form.contacto_emergencia_nombre}
                  onChange={(e) =>
                    setField("contacto_emergencia_nombre", onlyLetters(e.target.value))
                  }
                  placeholder="Nombre del contacto de emergencia"
                />
              </Field>

              <Field label="Teléfono del contacto">
                <Input
                  value={form.contacto_emergencia_telefono}
                  onChange={(e) =>
                    setField("contacto_emergencia_telefono", onlyNumbers(e.target.value))
                  }
                  placeholder="Teléfono del contacto"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </Section>

          <Section title="Compromiso y normas">
            <div className="grid grid-cols-1 gap-3">
              <CheckCard
                label="Acepto que este voluntariado está sujeto a revisión, aprobación y supervisión."
                checked={form.acepta_terminos}
                onClick={() => setField("acepta_terminos", !form.acepta_terminos)}
              />

              <CheckCard
                label="Entiendo que debo respetar las normas de cada clínica y que no puedo actuar fuera de supervisión."
                checked={form.acepta_normas}
                onClick={() => setField("acepta_normas", !form.acepta_normas)}
              />
            </div>

            {!mostrarTermo ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#92ccc6] bg-[#eef8f7] p-5 text-sm text-[#0b6665]">
                Marque ambas casillas para habilitar el Termo de Voluntariado y la confirmación
                final.
              </div>
            ) : null}
          </Section>

          <div
            className={`overflow-hidden transition-all duration-500 ${
              mostrarTermo ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
              <div className="mb-5 text-center">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#0b6665]/70">
                  🐾 Fundación Rugimos
                </p>
                <h2 className="text-2xl font-bold text-[#0b6665] md:text-3xl">
                  Termo de Voluntariado
                </h2>
                <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
                  Lea con atención los siguientes términos y responsabilidades antes de confirmar su
                  postulación al Programa de Voluntariado Clínico.
                </p>
              </div>

              <div className="rounded-[26px] border border-[#cfe8e4] bg-white p-5 md:p-6">
                <div className="grid gap-5">
                  <ConsentBlock
                    title="Sobre el trabajo voluntario"
                    items={[
                      "El voluntariado en Fundación Rugimos implica apoyo directo en jornadas de esterilización y actividades clínicas reales.",
                      "Las funciones pueden incluir recepción y orientación de tutores, organización del flujo de atención, apoyo en triagem, limpieza y organización del ambiente, apoyo en preparación básica cuando sea indicado por el equipo, y acompañamiento en el postoperatorio inmediato.",
                      "Todas las actividades se realizan bajo coordinación y supervisión del equipo responsable de la jornada.",
                    ]}
                  />

                  <ConsentBlock
                    title="Compromisos del voluntario"
                    items={[
                      "Llegar puntualmente en el horario acordado.",
                      "Trabajar en equipo de manera respetuosa, colaborativa y responsable.",
                      "Mantener el ambiente limpio, ordenado y funcional durante la jornada.",
                      "Tratar a los animales con cuidado, empatía y respeto en todo momento.",
                      "Ser cordial con tutores, médicos veterinarios, responsables clínicos y demás voluntarios.",
                      "Seguir las indicaciones del equipo encargado y respetar la dinámica de cada clínica.",
                      "Avisar con anticipación en caso de no poder asistir a una asignación programada.",
                      "No intervenir en procedimientos médicos, quirúrgicos o decisiones clínicas sin autorización expresa del equipo responsable.",
                    ]}
                  />

                  <ConsentBlock
                    title="Seguridad sanitaria y responsabilidad personal"
                    items={[
                      "Para participar del voluntariado es obligatorio contar con el esquema de vacunación completo y actualizado.",
                      "Se requiere especialmente vacuna antirrábica y antitetánica vigentes, debido al riesgo inherente al manejo de animales.",
                      "Fundación Rugimos y las clínicas NO proporcionan profilaxis antirrábica preventiva.",
                      "En caso de exposición, mordedura, accidente o cualquier incidente relacionado con animales o con el entorno clínico, la atención médica, tratamientos, vacunas, profilaxis y cualquier medida derivada correrán exclusivamente por cuenta del voluntario.",
                      "El voluntario participa bajo su propia responsabilidad, entendiendo y aceptando los riesgos asociados al entorno clínico veterinario.",
                      "La fundación y las clínicas no asumen responsabilidad por accidentes, incidentes, lesiones o consecuencias derivadas de la participación en el programa.",
                      "Si el voluntario no cumple con estos requisitos, no podrá participar en el programa bajo ninguna circunstancia.",
                    ]}
                  />

                  <ConsentBlock
                    title="Importante"
                    items={[
                      "Este es un trabajo voluntario y no implica relación laboral ni remuneración económica.",
                      "La participación exige compromiso, responsabilidad y conducta adecuada dentro del entorno clínico.",
                      "Fundación Rugimos prioriza el bienestar animal, la seguridad del equipo y el trato digno hacia todas las personas involucradas.",
                    ]}
                  />

                  <div className="rounded-2xl border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm leading-7 text-[#b53a3a]">
                    <p className="font-bold">Advertencia obligatoria</p>
                    <p className="mt-2">
                      La participación en el voluntariado requiere vacunas al día, especialmente
                      antirrábica y antitetánica. La fundación y las clínicas no asumirán costos,
                      tratamientos ni responsabilidades derivadas de accidentes, mordeduras,
                      exposiciones o riesgos propios del entorno veterinario.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#f0d6c2] bg-[#fff7ef] p-4 text-sm leading-7 text-[#8f4f24]">
                    <p className="font-bold">Declaración</p>
                    <p className="mt-2">
                      Declaro que he leído y comprendido los términos anteriormente descritos, y
                      que acepto las responsabilidades, límites y compromisos del Programa de
                      Voluntariado Clínico de Fundación Rugimos.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#cfe8e4] bg-[#eef8f7] p-4">
                    <CheckCard
                      label="Declaro que cuento con vacunas obligatorias al día, especialmente antirrábica y antitetánica, y asumo completamente la responsabilidad de mi participación en el voluntariado."
                      checked={form.acepta_vacunas}
                      onClick={() => setField("acepta_vacunas", !form.acepta_vacunas)}
                    />
                  </div>

                  <div className="rounded-2xl border border-[#cfe8e4] bg-[#eef8f7] p-4">
                    <CheckCard
                      label="He leído el Termo de Voluntariado y confirmo que estoy de acuerdo con sus condiciones y responsabilidades."
                      checked={form.confirma_consentimiento}
                      onClick={() =>
                        setField("confirma_consentimiento", !form.confirma_consentimiento)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="text-center text-2xl font-bold text-[#0b6665]">
              Confirmación antes de enviar
            </h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Al confirmar esta postulación, declara que la información proporcionada es verídica y
              que comprende que Fundación Rugimos evaluará su perfil antes de una eventual
              aprobación e incorporación al programa.
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
              >
                Volver
              </Link>

              <button
                type="button"
                onClick={() => {
                  setForm(initialForm)
                  setDocumentoFile(null)
                  setComprobanteFile(null)
                  setVacunasFile(null)
                  setCvFile(null)
                  setError(null)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b6665] ring-1 ring-slate-200 transition hover:scale-[1.02]"
              >
                Limpiar formulario
              </button>

              <button
                type="submit"
                disabled={
                  loading ||
                  !form.acepta_terminos ||
                  !form.acepta_normas ||
                  !form.acepta_vacunas ||
                  !form.confirma_consentimiento
                }
                className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Confirmar postulación"}
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
  const { className = "", ...rest } = props
  return (
    <input
      {...rest}
      className={`h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props
  return (
    <select
      {...rest}
      className={`h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75] ${className}`}
    >
      {children}
    </select>
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props
  return (
    <textarea
      {...rest}
      rows={4}
      className={`min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0d7a75] ${className}`}
    />
  )
}

function ChoicePill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
        selected
          ? "border-[#0d7a75] bg-[#dff3f0] text-[#0b6665] shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#92ccc6] hover:bg-[#eef8f7]"
      }`}
    >
      {label}
    </button>
  )
}

function CheckCard({
  label,
  checked,
  onClick,
}: {
  label: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
        checked
          ? "border-[#0d7a75] bg-[#dff3f0] text-[#0b6665] shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#92ccc6] hover:bg-[#eef8f7]"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] ${
          checked
            ? "border-[#0d7a75] bg-[#0d7a75] text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="font-medium">{label}</span>
    </button>
  )
}

function ConsentBlock({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#fcfefe] p-4">
      <p className="text-base font-bold text-[#0b6665]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-3 text-sm leading-7 text-slate-700">
            <span className="mt-[6px] h-2.5 w-2.5 flex-none rounded-full bg-[#f47c3c]" />
            <p>{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FileInput({
  accept,
  onChange,
}: {
  accept?: string
  onChange: (file: File | null) => void
}) {
  return (
    <label className="flex min-h-[120px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#92ccc6] bg-[#eef8f7] px-4 py-6 text-center transition hover:bg-[#e6f5f3]">
      <div>
        <p className="text-sm font-semibold text-[#0b6665]">Haga clic para subir un archivo</p>
        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG o formatos permitidos</p>
      </div>

      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </label>
  )
}

function FileTag({ name }: { name: string }) {
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      Archivo seleccionado: <span className="font-semibold">{name}</span>
    </div>
  )
}