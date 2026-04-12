"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type RegistroData = {
  id: string
  codigo: string
  nombre_completo: string | null
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
    nombre?: string | null
    endereco?: string | null
    direccion?: string | null
  } | null
  seguimiento_7d_respondido?: boolean | null
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

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function RadioCard({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
        selected
          ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
      }`}
    >
      {label}
    </button>
  )
}

function CheckboxCard({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
        checked
          ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
      }`}
    >
      {label}
    </button>
  )
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

      if (registroData.clinica_id) {
        const { data: clinica, error: clinicaError } = await supabase
          .from("clinicas")
          .select("id, nome, nombre, endereco, direccion")
          .eq("id", registroData.clinica_id)
          .maybeSingle()

        if (clinicaError) {
          console.error("Erro buscando clínica:", clinicaError)
        } else {
          clinicaData = clinica
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

      const tutorNombre = registroData.nombre_completo || ""
      const tutorTelefono = registroData.telefono || registroData.celular || ""

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
    return registro?.clinicas?.nome || registro?.clinicas?.nombre || "Clínica asignada"
  }, [registro])

  const clinicAddress = useMemo(() => {
    return registro?.clinicas?.endereco || registro?.clinicas?.direccion || ""
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
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
          <p className="text-center text-slate-600">Cargando seguimiento...</p>
        </div>
      </main>
    )
  }

  if (error && !registro) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
          <div className="mb-4 text-center text-5xl">🐾</div>
          <h1 className="text-center text-2xl font-semibold text-slate-900">
            Seguimiento no disponible
          </h1>
          <p className="mt-3 text-center text-slate-600">{error}</p>
        </div>
      </main>
    )
  }

  if (success || alreadyAnswered) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
          <div className="mb-4 text-center text-5xl">💚</div>
          <h1 className="text-center text-3xl font-semibold text-slate-900">
            ¡Muchas gracias!
          </h1>
          <p className="mt-4 text-center text-slate-600">
            {success
              ? "Su respuesta fue enviada correctamente. Nos ayuda muchísimo a mejorar la atención y el seguimiento de nuestras campañas."
              : "Este seguimiento ya fue respondido anteriormente. Gracias por su colaboración."}
          </p>

          {registro ? (
            <div className="mt-8 rounded-2xl bg-emerald-50 p-5">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Código:</span> {registro.codigo}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Mascota:</span>{" "}
                {registro.nombre_animal || "-"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Clínica:</span> {clinicName}
              </p>
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 px-4 py-6 md:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-500" />
          <div className="p-6 md:p-8">
            <div className="mb-5 text-center">
              <div className="mb-3 text-4xl">🐾</div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                FUNDACIÓN RUGIMOS
              </h1>
              <p className="mt-2 text-lg text-emerald-700">Seguimiento Post Esterilización</p>
            </div>

            <p className="text-slate-700">
              Gracias por confiar en nosotros. Esta breve encuesta nos ayuda a verificar el
              bienestar de su mascota y mejorar continuamente la calidad de nuestras campañas.
            </p>

            <div className="mt-5 grid gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-900">Tutor/a:</span>{" "}
                {registro?.nombre_completo || "-"}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Mascota:</span>{" "}
                {registro?.nombre_animal || "-"}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Clínica:</span> {clinicName}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Fecha cirugía:</span>{" "}
                {formatDate(registro?.fecha_cirugia_realizada)}
              </div>
              {clinicAddress ? (
                <div className="md:col-span-2">
                  <span className="font-semibold text-slate-900">Dirección:</span> {clinicAddress}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
              <span>⏱️ Tiempo estimado: 1 minuto</span>
              <span>🔒 Información confidencial</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Datos de contacto" subtitle="Para identificar correctamente la respuesta.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
                <input
                  type="text"
                  value={form.respondido_por}
                  onChange={(e) => setField("respondido_por", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500"
                  placeholder="Su nombre"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="1. Estado general de la mascota">
            <div className="grid gap-3 sm:grid-cols-2">
              {["Excelente", "Bueno", "Regular", "Malo"].map((item) => (
                <RadioCard
                  key={item}
                  label={item}
                  selected={form.estado_general === item}
                  onClick={() => setField("estado_general", item as FormDataType["estado_general"])}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="2. ¿Ha presentado alguno de estos signos?">
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxCard
                label="Decaimiento"
                checked={form.decaimiento}
                onClick={() => toggleSign("decaimiento")}
              />
              <CheckboxCard
                label="Falta de apetito"
                checked={form.falta_apetito}
                onClick={() => toggleSign("falta_apetito")}
              />
              <CheckboxCard
                label="Vómitos"
                checked={form.vomitos}
                onClick={() => toggleSign("vomitos")}
              />
              <CheckboxCard
                label="Diarrea"
                checked={form.diarrea}
                onClick={() => toggleSign("diarrea")}
              />
              <div className="sm:col-span-2">
                <CheckboxCard
                  label="Ninguno"
                  checked={form.ninguno_signos}
                  onClick={toggleNoneSigns}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="3. Estado de la herida quirúrgica">
            <div className="space-y-5">
              {[
                { key: "enrojecimiento", label: "¿Observa enrojecimiento?" },
                { key: "inflamacion", label: "¿Observa inflamación?" },
                { key: "sangrado", label: "¿Hubo sangrado?" },
                { key: "herida_abierta", label: "¿La herida se abrió?" },
              ].map((item) => (
                <div key={item.key}>
                  <p className="mb-2 text-sm font-medium text-slate-700">{item.label}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RadioCard
                      label="Sí"
                      selected={form[item.key as keyof FormDataType] === "Sí"}
                      onClick={() => setField(item.key as keyof FormDataType, "Sí" as never)}
                    />
                    <RadioCard
                      label="No"
                      selected={form[item.key as keyof FormDataType] === "No"}
                      onClick={() => setField(item.key as keyof FormDataType, "No" as never)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="4. Complicaciones">
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                ¿Considera que hubo alguna complicación?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <RadioCard
                  label="Sí"
                  selected={form.hubo_complicacion === "Sí"}
                  onClick={() => setField("hubo_complicacion", "Sí")}
                />
                <RadioCard
                  label="No"
                  selected={form.hubo_complicacion === "No"}
                  onClick={() => setField("hubo_complicacion", "No")}
                />
              </div>
            </div>

            {form.hubo_complicacion === "Sí" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Si marcó “Sí”, por favor describa brevemente:
                </label>
                <textarea
                  value={form.complicacion_descripcion}
                  onChange={(e) => setField("complicacion_descripcion", e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500"
                  placeholder="Describa la complicación"
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="5. Atención recibida en la clínica">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  ¿Cómo califica la atención recibida?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["Muy buena", "Buena", "Regular", "Mala"].map((item) => (
                    <RadioCard
                      key={item}
                      label={item}
                      selected={form.atencion_clinica === item}
                      onClick={() =>
                        setField("atencion_clinica", item as FormDataType["atencion_clinica"])
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  ¿Le explicaron bien el cuidado postoperatorio?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["Sí, claramente", "Más o menos", "No me explicaron"].map((item) => (
                    <RadioCard
                      key={item}
                      label={item}
                      selected={form.explicaron_postoperatorio === item}
                      onClick={() =>
                        setField(
                          "explicaron_postoperatorio",
                          item as FormDataType["explicaron_postoperatorio"]
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  ¿Cómo fue el trato del personal?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["Excelente", "Bueno", "Regular", "Malo"].map((item) => (
                    <RadioCard
                      key={item}
                      label={item}
                      selected={form.trato_personal === item}
                      onClick={() =>
                        setField("trato_personal", item as FormDataType["trato_personal"])
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  ¿Volvería a atenderse en esta clínica?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {["Sí", "No", "No estoy seguro"].map((item) => (
                    <RadioCard
                      key={item}
                      label={item}
                      selected={form.volveria_clinica === item}
                      onClick={() =>
                        setField("volveria_clinica", item as FormDataType["volveria_clinica"])
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="6. Satisfacción general">
            <p className="mb-3 text-sm text-slate-600">
              ¿Qué tan satisfecho está con la atención recibida?
            </p>
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setField("satisfaccion_general", value as FormDataType["satisfaccion_general"])
                  }
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-lg font-semibold transition ${
                    form.satisfaccion_general === value
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="7. Comentario final" subtitle="Opcional">
            <textarea
              value={form.comentario_final}
              onChange={(e) => setField("comentario_final", e.target.value)}
              className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500"
              placeholder="¿Desea dejarnos algún comentario o sugerencia?"
            />
          </SectionCard>

          <div className="flex flex-col gap-3 pb-10 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-600 px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Enviando..." : "Enviar seguimiento"}
            </button>

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...initialForm,
                  respondido_por: registro?.nombre_completo || "",
                  telefono: registro?.telefono || "",
                })
              }
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar formulario
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}