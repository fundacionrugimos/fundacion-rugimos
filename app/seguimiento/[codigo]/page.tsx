"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type RegistroData = {
  id: string
  codigo: string
  nombre_responsable?: string | null
  nombre_completo?: string | null
  telefono: string | null
  celular?: string | null
  nombre_animal: string | null
  especie: string | null
  sexo: string | null
  fecha_cirugia_realizada: string | null
  clinica_id: string | null
  clinicas?: {
    id?: string | null
    nome?: string | null
    zona?: string | null
    endereco?: string | null
    telefono?: string | null
    maps_url?: string | null
  } | null
  seguimiento_7d_respondido?: boolean | null
}

type SolicitudFallback = {
  nombre_completo: string | null
  celular: string | null
}

type FormDataType = {
  respondido_por: string
  telefono: string

  estado_general: "Excelente" | "Bueno" | "Regular" | "Malo" | ""

  decaimiento: boolean
  falta_apetito: boolean
  vomitos: boolean
  diarrea: boolean
  ninguno_signos: boolean

  enrojecimiento: "Sí" | "No" | ""
  inflamacion: "Sí" | "No" | ""
  sangrado: "Sí" | "No" | ""
  herida_abierta: "Sí" | "No" | ""

  hubo_complicacion: "Sí" | "No" | ""
  complicacion_descripcion: string

  atencion_clinica: "Muy buena" | "Buena" | "Regular" | "Mala" | ""
  explicaron_postoperatorio: "Sí, claramente" | "Más o menos" | "No me explicaron" | ""
  trato_personal: "Excelente" | "Bueno" | "Regular" | "Malo" | ""
  volveria_clinica: "Sí" | "No" | "No estoy seguro" | ""

  satisfaccion_general: 0 | 1 | 2 | 3 | 4 | 5
  comentario_final: string
}

const initialForm: FormDataType = {
  respondido_por: "",
  telefono: "",

  estado_general: "",

  decaimiento: false,
  falta_apetito: false,
  vomitos: false,
  diarrea: false,
  ninguno_signos: false,

  enrojecimiento: "",
  inflamacion: "",
  sangrado: "",
  herida_abierta: "",

  hubo_complicacion: "",
  complicacion_descripcion: "",

  atencion_clinica: "",
  explicaron_postoperatorio: "",
  trato_personal: "",
  volveria_clinica: "",

  satisfaccion_general: 0,
  comentario_final: "",
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function normalizePhoneDisplay(phone?: string | null) {
  if (!phone) return ""
  const cleaned = String(phone).replace(/\D/g, "")
  if (!cleaned) return ""

  if (cleaned.startsWith("591") && cleaned.length > 3) {
    return cleaned.slice(3)
  }

  return cleaned
}

export default function SeguimientoPage() {
  const params = useParams()
  const codigo = String(params?.codigo || "").trim().toUpperCase()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [registro, setRegistro] = useState<RegistroData | null>(null)
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<FormDataType>(initialForm)

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError(null)

      const codigoNormalizado = codigo.trim().toUpperCase()

      const { data: registroData, error: registroError } = await supabase
        .from("registros")
        .select(`
          id,
          codigo,
          nombre_responsable,
          nombre_completo,
          telefono,
          celular,
          nombre_animal,
          especie,
          sexo,
          fecha_cirugia_realizada,
          clinica_id,
          seguimiento_7d_respondido
        `)
        .eq("codigo", codigoNormalizado)
        .maybeSingle()

      if (registroError) {
        console.error("Erro buscando registro:", registroError)
        if (mounted) {
          setError(`Error al buscar el registro: ${registroError.message}`)
          setLoading(false)
        }
        return
      }

      if (!registroData) {
        if (mounted) {
          setError(`No encontramos un registro válido para el código ${codigoNormalizado}.`)
          setLoading(false)
        }
        return
      }

      if (!registroData.fecha_cirugia_realizada) {
        if (mounted) {
          setError("Este caso aún no tiene una cirugía registrada.")
          setLoading(false)
        }
        return
      }

      let clinicaData: RegistroData["clinicas"] = null
      let solicitudData: SolicitudFallback | null = null

      if (registroData.clinica_id) {
        const { data: clinica, error: clinicaError } = await supabase
          .from("clinicas")
          .select("id, nome, zona, endereco, telefono, maps_url")
          .eq("id", registroData.clinica_id)
          .maybeSingle()

        if (clinicaError) {
          console.error("Erro buscando clínica:", clinicaError)
        } else {
          clinicaData = clinica
        }
      }

      const tutorVacio =
        !registroData.nombre_responsable?.trim() &&
        !registroData.nombre_completo?.trim()

      const telefonoVacio =
        !registroData.telefono?.trim() &&
        !registroData.celular?.trim()

      if (tutorVacio || telefonoVacio) {
        const { data: solicitud, error: solicitudError } = await supabase
          .from("solicitudes")
          .select("nombre_completo, celular")
          .eq("codigo", codigoNormalizado)
          .maybeSingle()

        if (solicitudError) {
          console.error("Erro buscando solicitud fallback:", solicitudError)
        } else {
          solicitudData = solicitud
        }
      }

      const { data: existing, error: existingError } = await supabase
        .from("seguimientos_postoperatorios")
        .select("id")
        .eq("registro_id", registroData.id)
        .maybeSingle()

      if (existingError) {
        console.error("Erro buscando seguimiento existente:", existingError)
      }

      if (!mounted) return

      const tutorNombre =
        registroData.nombre_responsable?.trim() ||
        registroData.nombre_completo?.trim() ||
        solicitudData?.nombre_completo?.trim() ||
        ""

      const tutorTelefono =
        normalizePhoneDisplay(registroData.telefono) ||
        normalizePhoneDisplay(registroData.celular) ||
        normalizePhoneDisplay(solicitudData?.celular) ||
        ""

      setRegistro({
        ...registroData,
        nombre_completo: tutorNombre,
        telefono: tutorTelefono,
        clinicas: clinicaData,
      } as RegistroData)

      setAlreadyAnswered(!!existing || !!registroData.seguimiento_7d_respondido)

      setForm((prev) => ({
        ...prev,
        respondido_por: tutorNombre,
        telefono: tutorTelefono,
      }))

      setLoading(false)
    }

    if (codigo) {
      loadData()
    }

    return () => {
      mounted = false
    }
  }, [codigo])

  const clinicName = useMemo(() => {
    if (!registro?.clinicas?.nome) return "Clínica atendida"
    return `${registro.clinicas.nome}${registro.clinicas.zona ? ` - ${registro.clinicas.zona}` : ""}`
  }, [registro])

  const clinicAddress = useMemo(() => {
    return registro?.clinicas?.endereco || ""
  }, [registro])

  function setField<K extends keyof FormDataType>(field: K, value: FormDataType[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleSign(field: "decaimiento" | "falta_apetito" | "vomitos" | "diarrea") {
    setForm((prev) => ({
      ...prev,
      [field]: !prev[field],
      ninguno_signos: false,
    }))
  }

  function toggleNoneSigns() {
    setForm((prev) => {
      const next = !prev.ninguno_signos
      return {
        ...prev,
        ninguno_signos: next,
        decaimiento: false,
        falta_apetito: false,
        vomitos: false,
        diarrea: false,
      }
    })
  }

  function validateForm() {
    if (!registro) return "Registro inválido."
    if (!form.respondido_por.trim()) return "Por favor, indique su nombre."
    if (!form.estado_general) return "Seleccione el estado general de la mascota."
    if (!form.enrojecimiento) return "Responda sobre el enrojecimiento."
    if (!form.inflamacion) return "Responda sobre la inflamación."
    if (!form.sangrado) return "Responda sobre el sangrado."
    if (!form.herida_abierta) return "Responda sobre la apertura de la herida."
    if (!form.hubo_complicacion) return "Indique si hubo complicación."
    if (form.hubo_complicacion === "Sí" && !form.complicacion_descripcion.trim()) {
      return "Describa la complicación observada."
    }
    if (!form.atencion_clinica) return "Califique la atención de la clínica."
    if (!form.explicaron_postoperatorio) return "Indique si explicaron el postoperatorio."
    if (!form.trato_personal) return "Califique el trato del personal."
    if (!form.volveria_clinica) return "Indique si volvería a atenderse en esta clínica."
    if (!form.satisfaccion_general) return "Seleccione una satisfacción general de 1 a 5."
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!registro) return

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const payload = {
        registro_id: registro.id,
        codigo: registro.codigo,
        clinica_id: registro.clinica_id,

        estado_general: form.estado_general,

        decaimiento: form.decaimiento,
        falta_apetito: form.falta_apetito,
        vomitos: form.vomitos,
        diarrea: form.diarrea,
        ninguno_signos: form.ninguno_signos,

        enrojecimiento: form.enrojecimiento === "Sí",
        inflamacion: form.inflamacion === "Sí",
        sangrado: form.sangrado === "Sí",
        herida_abierta: form.herida_abierta === "Sí",

        hubo_complicacion: form.hubo_complicacion === "Sí",
        complicacion_descripcion:
          form.hubo_complicacion === "Sí" ? form.complicacion_descripcion.trim() : null,

        atencion_clinica: form.atencion_clinica,
        explicaron_postoperatorio: form.explicaron_postoperatorio,
        trato_personal: form.trato_personal,
        volveria_clinica: form.volveria_clinica,

        satisfaccion_general: form.satisfaccion_general,
        comentario_final: form.comentario_final.trim() || null,

        respondido_por: form.respondido_por.trim(),
        telefono: form.telefono.trim() || null,
      }

      const { error: insertError } = await supabase
        .from("seguimientos_postoperatorios")
        .insert(payload)

      if (insertError) {
        if (
          insertError.message?.toLowerCase().includes("duplicate") ||
          insertError.message?.toLowerCase().includes("unique")
        ) {
          setAlreadyAnswered(true)
          setSuccess(false)
          return
        }
        throw insertError
      }

      const { error: updateError } = await supabase
        .from("registros")
        .update({
          seguimiento_7d_respondido: true,
          seguimiento_7d_respondido_at: new Date().toISOString(),
        })
        .eq("id", registro.id)

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      setAlreadyAnswered(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      console.error("Erro al guardar seguimiento:", err)
      setError(err?.message || "Ocurrió un error al guardar la encuesta.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>
            <h1 className="text-3xl font-bold text-[#0b6665] md:text-4xl">
              Cargando seguimiento...
            </h1>
            <p className="mt-4 text-slate-600">
              Estamos preparando la información del paciente.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !registro) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>
            <h1 className="text-3xl font-bold leading-tight text-[#c65b24] md:text-4xl">
              Seguimiento no disponible
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {error}
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24]">
            Verifique que el enlace sea correcto o comuníquese con Fundación Rugimos si necesita ayuda.
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

  if (success || alreadyAnswered) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>

            <h1 className="text-3xl font-bold leading-tight text-[#43a047] md:text-4xl">
              {success ? "✅ Seguimiento enviado correctamente" : "💚 Seguimiento ya respondido"}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {success
                ? "Gracias por responder. Su información nos ayuda a verificar la recuperación del paciente y mejorar la calidad de nuestras campañas."
                : "Este seguimiento ya fue respondido anteriormente. Gracias por su colaboración y por apoyar el cuidado responsable."}
            </p>

            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32]">
              <p className="font-semibold">📌 Información del caso</p>
              <div className="mt-2 grid gap-2 text-left sm:grid-cols-2">
                <p>
                  <span className="font-semibold">Responsable:</span>{" "}
                  {registro?.nombre_completo || "-"}
                </p>
                <p>
                  <span className="font-semibold">Mascota:</span> {registro?.nombre_animal || "-"}
                </p>
                <p>
                  <span className="font-semibold">Clínica:</span> {clinicName}
                </p>
                <p>
                  <span className="font-semibold">Fecha cirugía:</span>{" "}
                  {formatDate(registro?.fecha_cirugia_realizada)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
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

          <h1 className="text-4xl font-bold md:text-5xl">Seguimiento Post Esterilización</h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm text-white/85 md:text-base">
            Gracias por confiar en nosotros. Esta breve encuesta nos ayuda a verificar el bienestar
            de su mascota y mejorar continuamente la calidad de nuestras campañas.
          </p>

          <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-full bg-white/15">
            <div className="h-2 w-full bg-[#f47c3c]" />
          </div>
        </div>

        <div className="mb-6 rounded-[24px] border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24] shadow-md">
          <p className="font-semibold">Importante</p>
          <p className="mt-1">
            Esta encuesta es confidencial y solo toma 1 minuto. Su respuesta nos ayuda a detectar
            oportunamente cualquier problema y mejorar la atención brindada.
          </p>
        </div>

        <div className="mb-6 rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
          <h2 className="mb-5 text-xl font-bold text-[#0b6665]">Resumen del caso</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="Responsable" value={registro?.nombre_completo || "-"} />
            <InfoPill label="Mascota" value={registro?.nombre_animal || "-"} />
            <InfoPill label="Clínica atendida" value={clinicName} />
            <InfoPill label="Fecha cirugía" value={formatDate(registro?.fecha_cirugia_realizada)} />
          </div>

          {clinicAddress ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-[#0b6665]">Dirección de la clínica:</span>{" "}
              {clinicAddress}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
            <p className="font-semibold">Revisar</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section title="Datos de contacto">
            <div className="mb-4 rounded-2xl border border-[#d1e7dd] bg-[#eef8f7] px-4 py-3 text-sm text-[#0b6665]">
              Estos datos ya fueron precargados automáticamente. Puede corregirlos si lo desea.
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del responsable">
                <Input
                  value={form.respondido_por}
                  onChange={(e) => setField("respondido_por", e.target.value)}
                  placeholder="Nombre del responsable"
                />
              </Field>

              <Field label="Teléfono del responsable">
                <Input
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                  placeholder="Teléfono"
                />
              </Field>
            </div>
          </Section>

          <Section title="1. Estado general de la mascota">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(["Excelente", "Bueno", "Regular", "Malo"] as const).map((item) => (
                <ChoicePill
                  key={item}
                  label={item}
                  selected={form.estado_general === item}
                  onClick={() => setField("estado_general", item)}
                />
              ))}
            </div>
          </Section>

          <Section title="2. ¿Ha presentado alguno de estos signos?">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <CheckCard
                label="Decaimiento"
                checked={form.decaimiento}
                onClick={() => toggleSign("decaimiento")}
              />
              <CheckCard
                label="Falta de apetito"
                checked={form.falta_apetito}
                onClick={() => toggleSign("falta_apetito")}
              />
              <CheckCard
                label="Vómitos"
                checked={form.vomitos}
                onClick={() => toggleSign("vomitos")}
              />
              <CheckCard
                label="Diarrea"
                checked={form.diarrea}
                onClick={() => toggleSign("diarrea")}
              />
              <CheckCard
                label="Ninguno"
                checked={form.ninguno_signos}
                onClick={toggleNoneSigns}
              />
            </div>
          </Section>

          <Section title="3. Estado de la herida quirúrgica">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <QuestionBlock
                label="¿Observa enrojecimiento?"
                value={form.enrojecimiento}
                onChange={(value) => setField("enrojecimiento", value)}
              />
              <QuestionBlock
                label="¿Observa inflamación?"
                value={form.inflamacion}
                onChange={(value) => setField("inflamacion", value)}
              />
              <QuestionBlock
                label="¿Hubo sangrado?"
                value={form.sangrado}
                onChange={(value) => setField("sangrado", value)}
              />
              <QuestionBlock
                label="¿La herida se abrió?"
                value={form.herida_abierta}
                onChange={(value) => setField("herida_abierta", value)}
              />
            </div>
          </Section>

          <Section title="4. Complicaciones">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ChoicePill
                label="Sí"
                selected={form.hubo_complicacion === "Sí"}
                onClick={() => setField("hubo_complicacion", "Sí")}
              />
              <ChoicePill
                label="No"
                selected={form.hubo_complicacion === "No"}
                onClick={() => setField("hubo_complicacion", "No")}
              />
            </div>

            {form.hubo_complicacion === "Sí" ? (
              <div className="mt-5">
                <Field label="Si marcó “Sí”, por favor describa brevemente">
                  <Textarea
                    value={form.complicacion_descripcion}
                    onChange={(e) => setField("complicacion_descripcion", e.target.value)}
                    placeholder="Describa la complicación observada"
                  />
                </Field>
              </div>
            ) : null}
          </Section>

          <Section title="5. Atención recibida en la clínica">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ChoiceGroup
                label="¿Cómo califica la atención recibida?"
                options={["Muy buena", "Buena", "Regular", "Mala"]}
                value={form.atencion_clinica}
                onChange={(value) =>
                  setField("atencion_clinica", value as FormDataType["atencion_clinica"])
                }
              />

              <ChoiceGroup
                label="¿Le explicaron bien el cuidado postoperatorio?"
                options={["Sí, claramente", "Más o menos", "No me explicaron"]}
                value={form.explicaron_postoperatorio}
                onChange={(value) =>
                  setField(
                    "explicaron_postoperatorio",
                    value as FormDataType["explicaron_postoperatorio"]
                  )
                }
              />

              <ChoiceGroup
                label="¿Cómo fue el trato del personal?"
                options={["Excelente", "Bueno", "Regular", "Malo"]}
                value={form.trato_personal}
                onChange={(value) =>
                  setField("trato_personal", value as FormDataType["trato_personal"])
                }
              />

              <ChoiceGroup
                label="¿Volvería a atenderse en esta clínica?"
                options={["Sí", "No", "No estoy seguro"]}
                value={form.volveria_clinica}
                onChange={(value) =>
                  setField("volveria_clinica", value as FormDataType["volveria_clinica"])
                }
              />
            </div>
          </Section>

          <Section title="6. Satisfacción general">
            <p className="mb-4 text-sm text-slate-600">
              ¿Qué tan satisfecho está con la atención recibida?
            </p>

            <div className="grid grid-cols-5 gap-3 md:max-w-md">
              {[1, 2, 3, 4, 5].map((value) => (
                <ScaleButton
                  key={value}
                  value={value}
                  selected={form.satisfaccion_general === value}
                  onClick={() =>
                    setField("satisfaccion_general", value as FormDataType["satisfaccion_general"])
                  }
                />
              ))}
            </div>
          </Section>

          <Section title="7. Comentario final">
            <Field label="Comentario o sugerencia (opcional)">
              <Textarea
                value={form.comentario_final}
                onChange={(e) => setField("comentario_final", e.target.value)}
                placeholder="Cuéntenos cualquier detalle importante que desee compartir"
              />
            </Field>
          </Section>

          <div className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="text-center text-2xl font-bold text-[#0b6665]">
              Confirmación antes de enviar
            </h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Al enviar este formulario, confirmo que la información proporcionada corresponde al
              estado actual de la mascota y autorizo su registro para seguimiento interno de
              Fundación Rugimos.
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
                onClick={() =>
                  setForm({
                    ...initialForm,
                    respondido_por: registro?.nombre_completo || "",
                    telefono: registro?.telefono || "",
                  })
                }
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b6665] ring-1 ring-slate-200 transition hover:scale-[1.02]"
              >
                Limpiar formulario
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
              >
                {submitting ? "Enviando..." : "Enviar seguimiento"}
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
      className={`h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75] ${className}`}
    />
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

function QuestionBlock({
  label,
  value,
  onChange,
}: {
  label: string
  value: "Sí" | "No" | ""
  onChange: (value: "Sí" | "No") => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-[#0b6665]">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <ChoicePill label="Sí" selected={value === "Sí"} onClick={() => onChange("Sí")} />
        <ChoicePill label="No" selected={value === "No"} onClick={() => onChange("No")} />
      </div>
    </div>
  )
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#0b6665]">{label}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((item) => (
          <ChoicePill
            key={item}
            label={item}
            selected={value === item}
            onClick={() => onChange(item)}
          />
        ))}
      </div>
    </div>
  )
}

function ScaleButton({
  value,
  selected,
  onClick,
}: {
  value: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 items-center justify-center rounded-2xl border text-lg font-bold transition ${
        selected
          ? "border-[#f47c3c] bg-[#fff3e9] text-[#c65b24] shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#f2b48f] hover:bg-[#fff8f3]"
      }`}
    >
      {value}
    </button>
  )
}

function InfoPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0b6665]/70">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}