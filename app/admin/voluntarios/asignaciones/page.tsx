"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type Voluntario = {
  id: string
  codigo: string
  nombre_completo: string
  celular: string | null
  email: string | null
  universidad: string | null
  carrera: string | null
  semestre_ano: string | null
  estado: "aprobado" | "activo"
  nivel: "observador" | "asistente" | "avanzado"
  dias_programados: number
  dias_asistidos: number
  porcentaje_asistencia: number
  certificado_elegible: boolean
}

type DisponibilidadRow = {
  clinica_id: string
  clinica_nome: string
  clinica_zona: string | null
  clinica_endereco: string | null
  horario_id: string | null
  hora_inicio: string | null
  hora_fin: string | null
  cupos_voluntarios: number | null
  clinica_activa: boolean
  dia_habilitado: boolean
  tiene_horario_configurado: boolean
}

type ClinicaAgrupada = {
  clinica_id: string
  clinica_nome: string
  clinica_zona: string | null
  clinica_endereco: string | null
  tiene_horario_configurado: boolean
  horarios: {
    horario_id: string
    clinica_id: string
    hora_inicio: string | null
    hora_fin: string | null
    cupos_voluntarios: number | null
  }[]
}

function getTodayLocal() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function formatHour(value?: string | null) {
  if (!value) return "-"
  return value.slice(0, 5)
}

function getNivelLabel(nivel?: Voluntario["nivel"]) {
  switch (nivel) {
    case "observador":
      return "Observador"
    case "asistente":
      return "Asistente"
    case "avanzado":
      return "Avanzado"
    default:
      return "-"
  }
}

export default function AdminVoluntariosAsignacionesPage() {
  const [loadingVoluntarios, setLoadingVoluntarios] = useState(true)
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false)
  const [saving, setSaving] = useState(false)

  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([])
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadRow[]>([])

  const [voluntarioId, setVoluntarioId] = useState("")
  const [fecha, setFecha] = useState(getTodayLocal())
  const [observacion, setObservacion] = useState("")
  const [filtroTexto, setFiltroTexto] = useState("")

  const [selectedClinicaId, setSelectedClinicaId] = useState("")
  const [selectedHorarioId, setSelectedHorarioId] = useState("")

  const [selectedHorario, setSelectedHorario] = useState<{
  horario_id: string
  clinica_id: string
  hora_inicio: string | null
  hora_fin: string | null
  cupos_voluntarios: number | null
} | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchVoluntarios() {
    setLoadingVoluntarios(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("vw_voluntarios_admin_activos")
        .select("*")
        .order("nombre_completo", { ascending: true })

      if (error) throw error
      setVoluntarios((data || []) as Voluntario[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No se pudieron cargar los voluntarios.")
    } finally {
      setLoadingVoluntarios(false)
    }
  }

  async function fetchDisponibilidad(selectedFecha: string) {
    if (!selectedFecha) return

    setLoadingDisponibilidad(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.rpc(
        "admin_listar_disponibilidad_clinicas_voluntariado",
        { p_fecha: selectedFecha }
      )

      if (error) throw error
      setDisponibilidad((data || []) as DisponibilidadRow[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No se pudo cargar la disponibilidad de clínicas.")
      setDisponibilidad([])
    } finally {
      setLoadingDisponibilidad(false)
    }
  }

  useEffect(() => {
    fetchVoluntarios()
  }, [])

  useEffect(() => {
    setSelectedClinicaId("")
    setSelectedHorarioId("")
    fetchDisponibilidad(fecha)
  }, [fecha])

  const voluntarioSeleccionado = useMemo(() => {
    return voluntarios.find((v) => v.id === voluntarioId) || null
  }, [voluntarios, voluntarioId])

  const clinicasAgrupadas = useMemo<ClinicaAgrupada[]>(() => {
    const texto = filtroTexto.trim().toLowerCase()

    const filtradas = disponibilidad.filter((row) => {
      if (!texto) return true
      return (
        row.clinica_nome?.toLowerCase().includes(texto) ||
        row.clinica_zona?.toLowerCase().includes(texto) ||
        row.clinica_endereco?.toLowerCase().includes(texto)
      )
    })

    const map = new Map<string, ClinicaAgrupada>()

    for (const row of filtradas) {
      if (!map.has(row.clinica_id)) {
        map.set(row.clinica_id, {
          clinica_id: row.clinica_id,
          clinica_nome: row.clinica_nome,
          clinica_zona: row.clinica_zona,
          clinica_endereco: row.clinica_endereco,
          tiene_horario_configurado: row.tiene_horario_configurado,
          horarios: [],
        })
      }

      if (row.horario_id) {
  map.get(row.clinica_id)!.horarios.push({
    horario_id: row.horario_id,
    clinica_id: row.clinica_id,
    hora_inicio: row.hora_inicio,
    hora_fin: row.hora_fin,
    cupos_voluntarios: row.cupos_voluntarios,
  })
}
    }

    return Array.from(map.values()).sort((a, b) =>
      a.clinica_nome.localeCompare(b.clinica_nome)
    )
  }, [disponibilidad, filtroTexto])

  const selectedClinica = useMemo(() => {
    return clinicasAgrupadas.find((c) => c.clinica_id === selectedClinicaId) || null
  }, [clinicasAgrupadas, selectedClinicaId])

  function handleSelectClinica(clinicaId: string) {
  setSelectedClinicaId(clinicaId)
  setSelectedHorarioId("")
  setSelectedHorario(null)
}

  async function handleProgramar() {
    if (!voluntarioId) {
      setError("Seleccione un voluntario.")
      return
    }

    if (!fecha) {
      setError("Seleccione una fecha.")
      return
    }

    if (!selectedClinicaId) {
      setError("Seleccione una clínica.")
      return
    }

    if (!selectedHorarioId) {
      setError("Seleccione un horario de pasantía.")
      return
    }

    if (!selectedHorario) {
  setError("Seleccione un horario válido.")
  return
}

if (String(selectedHorario.clinica_id) !== String(selectedClinicaId)) {
  setError("El horario no pertenece a la clínica seleccionada.")
  return
}

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const { data, error } = await supabase.rpc("admin_programar_voluntario", {
        p_voluntario_id: voluntarioId,
        p_clinica_id: selectedClinicaId,
        p_horario_id: selectedHorarioId,
        p_fecha: fecha,
        p_observacion: observacion.trim() || null,
        p_creado_por: "admin",
      })

      if (error) throw error
      if (!data?.ok) throw new Error(data?.message || "No fue posible crear la asignación.")

      setSuccess(data?.message || "Asignación creada correctamente.")
setObservacion("")
setSelectedClinicaId("")
setSelectedHorarioId("")
setSelectedHorario(null)
await fetchDisponibilidad(fecha)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Ocurrió un error al programar la asignación.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#026A6A] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/75">
              🐾 FUNDACIÓN RUGIMOS 🐾
            </p>
            <h1 className="text-3xl font-bold text-white md:text-5xl">
              Central de Asignaciones de Voluntariado
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/85 md:text-base">
              Programa voluntarios por fecha, clínica y horario de pasantía disponible.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#026A6A] shadow-lg transition hover:opacity-90"
            >
              Volver al dashboard
            </Link>

            <Link
              href="/admin/voluntarios"
              className="rounded-2xl bg-[#F47C3C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Ver voluntarios
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
            <p className="font-semibold">Revisar</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-[24px] border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32] shadow-md">
            <p className="font-semibold">Excelente</p>
            <p className="mt-1">{success}</p>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-bold text-[#026A6A]">1. Selección del voluntario</h2>

            {loadingVoluntarios ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                Cargando voluntarios...
              </div>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold text-[#026A6A]">
                  Voluntario aprobado / activo
                </label>

                <select
                  value={voluntarioId}
                  onChange={(e) => setVoluntarioId(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#026A6A]"
                >
                  <option value="">Seleccionar voluntario</option>
                  {voluntarios.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre_completo} — {v.codigo}
                    </option>
                  ))}
                </select>

                {voluntarioSeleccionado ? (
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoPill label="Código" value={voluntarioSeleccionado.codigo} />
                    <InfoPill label="Nivel" value={getNivelLabel(voluntarioSeleccionado.nivel)} />
                    <InfoPill
                      label="Asistidos"
                      value={String(voluntarioSeleccionado.dias_asistidos || 0)}
                    />
                    <InfoPill
                      label="% asistencia"
                      value={`${Number(voluntarioSeleccionado.porcentaje_asistencia || 0).toFixed(2)}%`}
                    />
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24]">
                    Seleccione un voluntario para continuar con la programación.
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-bold text-[#026A6A]">2. Fecha y observación</h2>

            <div className="grid grid-cols-1 gap-4">
              <Field label="Fecha de asignación">
                <Input
                  type="date"
                  value={fecha}
                  min={getTodayLocal()}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>

              <Field label="Observación (opcional)">
                <Textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Ej. apoyo en jornada intensa / refuerzo / voluntario nuevo"
                />
              </Field>
            </div>
          </section>
        </div>

        <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#026A6A]">3. Clínicas activas y horarios de pasantía</h2>
              <p className="mt-1 text-sm text-slate-600">
                Se muestran todas las clínicas activas. Solo se puede programar cuando la clínica
                tenga horarios de voluntariado configurados para la fecha elegida.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <input
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar clínica, zona o dirección..."
                className="h-12 min-w-[280px] rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#026A6A]"
              />

              <button
                type="button"
                onClick={() => fetchDisponibilidad(fecha)}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#026A6A] ring-1 ring-slate-200 transition hover:scale-[1.02]"
              >
                Actualizar
              </button>
            </div>
          </div>

          {loadingDisponibilidad ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Cargando disponibilidad...
            </div>
          ) : clinicasAgrupadas.length === 0 ? (
            <div className="rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-6 text-sm text-[#8f4f24]">
              No encontramos clínicas activas para la fecha seleccionada.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                {clinicasAgrupadas.map((clinica) => {
                  const isSelected = selectedClinicaId === clinica.clinica_id

                  return (
                    <button
                      key={clinica.clinica_id}
                      type="button"
                      onClick={() => handleSelectClinica(clinica.clinica_id)}
                      className={`w-full rounded-[24px] border p-5 text-left transition ${
                        isSelected
                          ? "border-[#026A6A] bg-[#eef8f7] shadow-md"
                          : "border-slate-200 bg-white hover:border-[#92ccc6] hover:bg-[#f8fcfb]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-[#026A6A]">{clinica.clinica_nome}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            Zona: {clinica.clinica_zona || "No definida"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {clinica.clinica_endereco || "Sin dirección"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            clinica.tiene_horario_configurado
                              ? "bg-[#dff3f0] text-[#026A6A]"
                              : "bg-[#fff3e9] text-[#8f4f24]"
                          }`}
                        >
                          {clinica.tiene_horario_configurado
                            ? `${clinica.horarios.length} horario${clinica.horarios.length === 1 ? "" : "s"}`
                            : "Sin horario configurado"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {clinica.horarios.length > 0 ? (
                          clinica.horarios.map((h) => (
                            <span
                              key={h.horario_id}
                              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                            >
                              {formatHour(h.hora_inicio)} - {formatHour(h.hora_fin)} · cupo {h.cupos_voluntarios ?? 0}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-[#fff3e9] px-3 py-1 text-xs font-semibold text-[#8f4f24]">
                            Configure horario en Gestión de Voluntarios
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-bold text-[#026A6A]">Horario seleccionado</h3>

                {!selectedClinica ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    Seleccione una clínica para ver y elegir sus horarios.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-[#026A6A]">
                        {selectedClinica.clinica_nome}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Zona: {selectedClinica.clinica_zona || "No definida"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedClinica.clinica_endereco || "Sin dirección"}
                      </p>
                    </div>

                    {selectedClinica.horarios.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24]">
                        Esta clínica está activa, pero todavía no tiene horarios de pasantía configurados.
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {selectedClinica.horarios
                          .sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""))
                          .map((horario) => {
                            const selected = selectedHorarioId === horario.horario_id

                            return (
                              <button
                                key={horario.horario_id}
                                type="button"
                                onClick={() => {
  setSelectedHorarioId(horario.horario_id)
  setSelectedHorario(horario)
}}
                                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                  selected
                                    ? "border-[#F47C3C] bg-[#fff3e9] text-[#8f4f24]"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-[#f2b48f] hover:bg-[#fff8f3]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-base font-bold">
                                      {formatHour(horario.hora_inicio)} - {formatHour(horario.hora_fin)}
                                    </p>
                                    <p className="mt-1 text-sm">
                                      Cupos voluntarios: {horario.cupos_voluntarios ?? 0}
                                    </p>
                                  </div>

                                  {selected ? (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                                      Seleccionado
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    )}

                    <div className="mt-6 rounded-2xl border border-[#d1e7dd] bg-[#eef8f7] p-4 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-[#026A6A]">Voluntario:</span>{" "}
                        {voluntarioSeleccionado?.nombre_completo || "No seleccionado"}
                      </p>
                      <p className="mt-2">
                        <span className="font-semibold text-[#026A6A]">Fecha:</span> {fecha || "-"}
                      </p>
                      <p className="mt-2">
                        <span className="font-semibold text-[#026A6A]">Clínica:</span>{" "}
                        {selectedClinica.clinica_nome}
                      </p>
                      <p className="mt-2">
                        <span className="font-semibold text-[#026A6A]">Horario:</span>{" "}
                        {selectedClinica.horarios.find((h) => h.horario_id === selectedHorarioId)
                          ? `${formatHour(selectedClinica.horarios.find((h) => h.horario_id === selectedHorarioId)?.hora_inicio)} - ${formatHour(selectedClinica.horarios.find((h) => h.horario_id === selectedHorarioId)?.hora_fin)}`
                          : "-"}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleProgramar}
                        disabled={saving || selectedClinica.horarios.length === 0}
                        className="rounded-full bg-[#F47C3C] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                      >
                        {saving ? "Programando..." : "Programar asignación"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
  setSelectedClinicaId("")
  setSelectedHorarioId("")
  setSelectedHorario(null)
  setObservacion("")
  setSuccess(null)
  setError(null)
}}
                        className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#026A6A] ring-1 ring-slate-200 transition hover:scale-[1.02]"
                      >
                        Limpiar selección
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
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
      <label className="mb-2 block text-sm font-semibold text-[#026A6A]">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props
  return (
    <input
      {...rest}
      className={`h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#026A6A] ${className}`}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props
  return (
    <textarea
      {...rest}
      rows={4}
      className={`min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#026A6A] ${className}`}
    />
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
      <p className="text-xs font-semibold uppercase tracking-wide text-[#026A6A]/70">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}