"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function getClinicaNombre(clinica: any) {
  return clinica?.nome || clinica?.nombre || clinica?.name || "Sin nombre"
}

function getHorarioHora(horario: any) {
  return horario?.hora || horario?.hour || ""
}

function getHorarioCupos(horario: any) {
  return (
    horario?.cupos ??
    horario?.cupos_maximos ??
    horario?.cupo_maximo ??
    horario?.maximo ??
    10
  )
}

function normalizarEstado(estado?: string | null) {
  const valor = (estado || "").trim().toLowerCase()

  if (valor === "programado") return "PROGRAMADO"
  if (valor === "reprogramado") return "REPROGRAMADO"
  if (valor === "atendido" || valor === "realizado") return "REALIZADO"
  if (valor === "cancelado") return "CANCELADO"
  if (valor === "recusado" || valor === "rechazado") return "RECHAZADO"
  if (valor === "falleció" || valor === "fallecio") return "FALLECIO"
  if (valor === "no show" || valor === "noshow" || valor === "no_show") return "NO_SHOW"

  return "OTRO"
}

function labelEstado(estado?: string | null) {
  const normalizado = normalizarEstado(estado)

  switch (normalizado) {
    case "PROGRAMADO":
      return "Programado"
    case "REPROGRAMADO":
      return "Reprogramado"
    case "REALIZADO":
      return "Realizado"
    case "CANCELADO":
      return "Cancelado"
    case "RECHAZADO":
      return "Rechazado"
    case "FALLECIO":
      return "Falleció"
    case "NO_SHOW":
      return "No Show"
    default:
      return estado || "Sin estado"
  }
}

function clasesBadgeEstado(estado?: string | null) {
  const normalizado = normalizarEstado(estado)

  switch (normalizado) {
    case "PROGRAMADO":
      return "bg-yellow-500 text-white"
    case "REPROGRAMADO":
      return "bg-blue-600 text-white"
    case "REALIZADO":
      return "bg-green-600 text-white"
    case "CANCELADO":
      return "bg-red-600 text-white"
    case "RECHAZADO":
      return "bg-gray-700 text-white"
    case "FALLECIO":
      return "bg-black text-white"
    case "NO_SHOW":
      return "bg-gray-300 text-gray-800"
    default:
      return "bg-gray-300 text-gray-800"
  }
}

function ocupaCupo(estado?: string | null) {
  const normalizado = normalizarEstado(estado)
  return normalizado === "PROGRAMADO" || normalizado === "REPROGRAMADO"
}

export default function Page() {
  const [fecha, setFecha] = useState(getLocalDateString())
  const [clinicas, setClinicas] = useState<any[]>([])
  const [horarios, setHorarios] = useState<any[]>([])
  const [cuposDiarios, setCuposDiarios] = useState<any[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const [errorClinicas, setErrorClinicas] = useState("")
  const [errorHorarios, setErrorHorarios] = useState("")
  const [errorCupos, setErrorCupos] = useState("")
  const [errorRegistros, setErrorRegistros] = useState("")

  const [modalHorario, setModalHorario] = useState(false)
  const [detalleHorario, setDetalleHorario] = useState<{
    clinicaId: string
    clinicaNombre: string
    horarioId: string
    hora: string
  } | null>(null)

  useEffect(() => {
    cargarBase()
  }, [])

  useEffect(() => {
    if (clinicas.length > 0 || horarios.length > 0) {
      cargarCuposPorFecha()
    }
  }, [fecha, clinicas.length, horarios.length])

  async function cargarBase() {
    setLoading(true)
    setErrorClinicas("")
    setErrorHorarios("")

    const { data: clinicasData, error: clinicasError } = await supabase
      .from("clinicas")
      .select("*")

    if (clinicasError) {
      console.log("Error cargando clínicas:", clinicasError)
      setErrorClinicas(clinicasError.message || "Error cargando clínicas")
    }

    const { data: horariosData, error: horariosError } = await supabase
      .from("horarios_clinica")
      .select("*")

    if (horariosError) {
      console.log("Error cargando horarios:", horariosError)
      setErrorHorarios(horariosError.message || "Error cargando horarios")
    }

    const clinicasOrdenadas = [...(clinicasData || [])].sort((a, b) =>
      getClinicaNombre(a).localeCompare(getClinicaNombre(b))
    )

    const horariosOrdenados = [...(horariosData || [])].sort((a, b) =>
      getHorarioHora(a).localeCompare(getHorarioHora(b))
    )

    setClinicas(clinicasOrdenadas)
    setHorarios(horariosOrdenados)
    setLoading(false)
  }

  async function cargarCuposPorFecha() {
    setLoading(true)
    setErrorCupos("")
    setErrorRegistros("")

    const { data: cuposData, error: cuposError } = await supabase
      .from("cupos_diarios")
      .select("*")
      .eq("fecha", fecha)

    if (cuposError) {
      console.log("Error cargando cupos diarios:", cuposError)
      setErrorCupos(cuposError.message || "Error cargando cupos diarios")
      setCuposDiarios([])
    } else {
      setCuposDiarios(cuposData || [])
    }

    const { data: registrosData, error: registrosError } = await supabase
      .from("registros")
      .select("*")
      .eq("fecha_programada", fecha)

    if (registrosError) {
      console.log("Error cargando registros:", registrosError)
      setErrorRegistros(registrosError.message || "Error cargando registros")
      setRegistros([])
    } else {
      setRegistros(registrosData || [])
    }

    setLoading(false)
  }

  async function obtenerOCrearCupoDiario(
    clinicaId: string,
    horarioId: string,
    fechaSeleccionada: string
  ) {
    const { data: existente, error: errorBuscar } = await supabase
      .from("cupos_diarios")
      .select("*")
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)
      .eq("fecha", fechaSeleccionada)
      .maybeSingle()

    if (errorBuscar) throw errorBuscar

    if (existente) {
      return existente
    }

    const horarioBase = horarios.find(
      (h) => h.id === horarioId && h.clinica_id === clinicaId
    )

    if (!horarioBase) {
      throw new Error("No se encontró el horario base para crear el cupo diario.")
    }

    const cuposIniciales = Number(getHorarioCupos(horarioBase))

    const { data: nuevoCupo, error: errorInsert } = await supabase
      .from("cupos_diarios")
      .insert([
        {
          clinica_id: clinicaId,
          horario_id: horarioId,
          fecha: fechaSeleccionada,
          cupos: cuposIniciales,
          ocupados: 0,
        },
      ])
      .select("*")
      .single()

    if (errorInsert) throw errorInsert

    return nuevoCupo
  }

  async function sincronizarCuposReales() {
    setSincronizando(true)
    setErrorCupos("")
    setErrorRegistros("")

    try {
      const { data: registrosData, error: registrosError } = await supabase
        .from("registros")
        .select("id, clinica_id, horario_id, fecha_programada, estado_cita")
        .eq("fecha_programada", fecha)

      if (registrosError) throw registrosError

      const registrosValidos = (registrosData || []).filter(
        (registro) =>
          registro.clinica_id &&
          registro.horario_id &&
          ocupaCupo(registro.estado_cita)
      )

      const clavesNecesarias = new Set<string>()

      registrosValidos.forEach((registro) => {
        const clave = `${registro.clinica_id}__${registro.horario_id}`
        clavesNecesarias.add(clave)
      })

      horarios.forEach((horario) => {
        if (!horario?.clinica_id || !horario?.id) return
        const clave = `${horario.clinica_id}__${horario.id}`
        clavesNecesarias.add(clave)
      })

      const mapaCupos: Record<string, any> = {}

      const { data: cuposActuales, error: cuposError } = await supabase
        .from("cupos_diarios")
        .select("*")
        .eq("fecha", fecha)

      if (cuposError) throw cuposError

      ;(cuposActuales || []).forEach((cupo) => {
        const clave = `${cupo.clinica_id}__${cupo.horario_id}`
        mapaCupos[clave] = cupo
      })

      for (const clave of Array.from(clavesNecesarias)) {
        const [clinicaId, horarioId] = clave.split("__")

        if (!mapaCupos[clave]) {
          const nuevoCupo = await obtenerOCrearCupoDiario(clinicaId, horarioId, fecha)
          mapaCupos[clave] = nuevoCupo
        }
      }

      const conteoPorClave: Record<string, number> = {}

      registrosValidos.forEach((registro) => {
        const clave = `${registro.clinica_id}__${registro.horario_id}`
        conteoPorClave[clave] = (conteoPorClave[clave] || 0) + 1
      })

      for (const clave of Object.keys(mapaCupos)) {
        const cupo = mapaCupos[clave]
        const ocupadosReales = conteoPorClave[clave] || 0
        const ocupadosActuales = Number(cupo?.ocupados ?? cupo?.cupos_ocupados ?? 0)

        if (ocupadosActuales !== ocupadosReales) {
          const { error: updateError } = await supabase
            .from("cupos_diarios")
            .update({ ocupados: ocupadosReales })
            .eq("id", cupo.id)

          if (updateError) throw updateError
        }
      }

      await cargarCuposPorFecha()
      alert("Cupos sincronizados correctamente con los registros reales.")
    } catch (error: any) {
      console.error("Error sincronizando cupos:", error)
      alert(error.message || "Ocurrió un error al sincronizar los cupos.")
    } finally {
      setSincronizando(false)
    }
  }

  const horariosUnicos = useMemo(() => {
    const horas = Array.from(
      new Set(horarios.map((h) => getHorarioHora(h)).filter(Boolean))
    )

    return horas.sort((a, b) => a.localeCompare(b))
  }, [horarios])

  function obtenerHorario(clinicaId: string, hora: string) {
    return horarios.find((h) => {
      const horaHorario = getHorarioHora(h)
      return h.clinica_id === clinicaId && horaHorario === hora
    })
  }

  function obtenerCupoDiario(clinicaId: string, horarioId: string) {
    return cuposDiarios.find(
      (c) => c.clinica_id === clinicaId && c.horario_id === horarioId
    )
  }

  function obtenerRegistrosHorario(clinicaId: string, horarioId: string) {
    return registros
      .filter(
        (r) =>
          r.clinica_id === clinicaId &&
          r.horario_id === horarioId &&
          r.fecha_programada === fecha
      )
      .sort((a, b) => {
        const nombreA = (a?.nombre_animal || "").toLowerCase()
        const nombreB = (b?.nombre_animal || "").toLowerCase()
        return nombreA.localeCompare(nombreB)
      })
  }

  function obtenerOcupadosReales(clinicaId: string, horarioId: string) {
    return obtenerRegistrosHorario(clinicaId, horarioId).filter((r) =>
      ocupaCupo(r.estado_cita)
    ).length
  }

  function abrirDetalleHorario(clinicaId: string, hora: string) {
    const horario = obtenerHorario(clinicaId, hora)
    const clinica = clinicas.find((c) => c.id === clinicaId)

    if (!horario || !clinica) return

    setDetalleHorario({
      clinicaId,
      clinicaNombre: getClinicaNombre(clinica),
      horarioId: horario.id,
      hora,
    })
    setModalHorario(true)
  }

  function cerrarDetalleHorario() {
    setModalHorario(false)
    setDetalleHorario(null)
  }

  function renderCupo(clinicaId: string, hora: string) {
    const horario = obtenerHorario(clinicaId, hora)

    if (!horario) {
      return <span className="text-gray-400">-</span>
    }

    const cupoDiario = obtenerCupoDiario(clinicaId, horario.id)
    const cupos = Number(cupoDiario?.cupos ?? getHorarioCupos(horario))
    const ocupados = obtenerOcupadosReales(clinicaId, horario.id)
    const disponibles = Math.max(0, cupos - ocupados)

    let color = "text-green-700 bg-green-50 border-green-200"
    if (disponibles === 0) color = "text-red-700 bg-red-50 border-red-200"
    else if (disponibles <= 2) color = "text-yellow-700 bg-yellow-50 border-yellow-200"

    return (
      <button
        onClick={() => abrirDetalleHorario(clinicaId, hora)}
        className={`inline-flex flex-col rounded-xl px-3 py-2 border transition hover:scale-[1.02] hover:shadow ${color}`}
      >
        <span className="font-bold text-sm">
          {ocupados} / {cupos}
        </span>
        <span className="text-xs">
          Disponibles: {disponibles}
        </span>
      </button>
    )
  }

  const resumenGeneral = useMemo(() => {
    let cuposTotales = 0
    let ocupadosTotales = 0

    clinicas.forEach((clinica) => {
      horarios
        .filter((h) => h.clinica_id === clinica.id)
        .forEach((horario) => {
          const cupoDiario = obtenerCupoDiario(clinica.id, horario.id)
          const cupos = Number(cupoDiario?.cupos ?? getHorarioCupos(horario))
          const ocupados = obtenerOcupadosReales(clinica.id, horario.id)

          cuposTotales += cupos
          ocupadosTotales += ocupados
        })
    })

    return {
      cuposTotales,
      ocupadosTotales,
      disponiblesTotales: Math.max(0, cuposTotales - ocupadosTotales),
    }
  }, [clinicas, horarios, cuposDiarios, registros])

  const registrosDetalle = useMemo(() => {
    if (!detalleHorario) return []
    return obtenerRegistrosHorario(detalleHorario.clinicaId, detalleHorario.horarioId)
  }, [detalleHorario, registros, fecha])

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[#0f6b6b] p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">🐾 Panel de Cupos — Fundación Rugimos</h1>
              <p className="text-white/80 mt-2">
                Control diario de cupos por clínica y horario
              </p>
            </div>

            <Link
              href="/admin"
              className="bg-white text-[#0f6b6b] px-4 py-2 rounded-xl font-semibold w-fit"
            >
              ← Volver al dashboard
            </Link>
          </div>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0f6b6b]"
              />
            </div>

            <button
              onClick={cargarCuposPorFecha}
              className="bg-[#f47c2a] text-white px-5 py-3 rounded-xl font-semibold"
            >
              Actualizar
            </button>

            <button
              onClick={sincronizarCuposReales}
              disabled={sincronizando}
              className="bg-[#0f6b6b] text-white px-5 py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {sincronizando ? "Sincronizando..." : "Sincronizar cupos"}
            </button>
          </div>
        </div>

        {(errorClinicas || errorHorarios || errorCupos || errorRegistros) && (
          <div className="p-6 border-b bg-red-50">
            <h2 className="font-bold text-red-700 mb-3">Errores detectados</h2>

            {errorClinicas && (
              <p className="text-sm text-red-700 mb-1">
                <strong>Clínicas:</strong> {errorClinicas}
              </p>
            )}

            {errorHorarios && (
              <p className="text-sm text-red-700 mb-1">
                <strong>Horarios:</strong> {errorHorarios}
              </p>
            )}

            {errorCupos && (
              <p className="text-sm text-red-700 mb-1">
                <strong>Cupos diarios:</strong> {errorCupos}
              </p>
            )}

            {errorRegistros && (
              <p className="text-sm text-red-700">
                <strong>Registros:</strong> {errorRegistros}
              </p>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 p-6 border-b bg-white">
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">Cupos totales</p>
            <p className="text-3xl font-bold text-[#0f6b6b]">
              {resumenGeneral.cuposTotales}
            </p>
          </div>

          <div className="bg-red-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">Ocupados</p>
            <p className="text-3xl font-bold text-red-700">
              {resumenGeneral.ocupadosTotales}
            </p>
          </div>

          <div className="bg-green-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">Disponibles</p>
            <p className="text-3xl font-bold text-green-700">
              {resumenGeneral.disponiblesTotales}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 p-6 border-b bg-gray-50">
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Clínicas cargadas</p>
            <p className="text-2xl font-bold text-[#0f6b6b]">{clinicas.length}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Horarios cargados</p>
            <p className="text-2xl font-bold text-[#0f6b6b]">{horarios.length}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Cupos diarios cargados</p>
            <p className="text-2xl font-bold text-[#0f6b6b]">{cuposDiarios.length}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Registros del día</p>
            <p className="text-2xl font-bold text-[#0f6b6b]">{registros.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-600">
            Cargando cupos...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-4 text-lg font-bold">Clínica</th>
                  {horariosUnicos.map((hora) => (
                    <th key={hora} className="p-4 text-lg font-bold text-center">
                      {hora.slice(0, 5)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {clinicas.map((clinica) => (
                  <tr key={clinica.id} className="border-t border-gray-200">
                    <td className="p-4 font-medium whitespace-nowrap">
                      {getClinicaNombre(clinica)}
                    </td>

                    {horariosUnicos.map((hora) => (
                      <td key={`${clinica.id}-${hora}`} className="p-4 text-center">
                        {renderCupo(clinica.id, hora)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && clinicas.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No se encontraron clínicas.
              </div>
            )}
          </div>
        )}
      </div>

      {modalHorario && detalleHorario && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0f6b6b]">
                  {detalleHorario.clinicaNombre} — {detalleHorario.hora.slice(0, 5)}
                </h2>
                <p className="text-gray-600 mt-1">Fecha: {fecha}</p>
              </div>

              <button
                onClick={cerrarDetalleHorario}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {registrosDetalle.length === 0 ? (
              <div className="rounded-2xl border bg-gray-50 p-6 text-center text-gray-600">
                No hay registros en este horario.
              </div>
            ) : (
              <div className="space-y-4">
                {registrosDetalle.map((registro) => (
                  <div
                    key={registro.id}
                    className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-[#0f6b6b]">
                        {registro.nombre_animal || "Sin nombre"} — {registro.codigo}
                      </p>
                      <p className="text-sm text-gray-700">
                        <b>Responsable:</b> {registro.nombre_responsable || "-"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <b>Teléfono:</b> {registro.telefono || "-"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <b>Especie:</b> {registro.especie || "-"}{" "}
                        <span className="mx-1">•</span>
                        <b>Sexo:</b> {registro.sexo || "-"}
                      </p>
                    </div>

                    <div className="flex flex-col md:items-end gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${clasesBadgeEstado(
                          registro.estado_cita
                        )}`}
                      >
                        {labelEstado(registro.estado_cita)}
                      </span>

                      <Link
                        href={`/admin/registros`}
                        className="bg-[#0f6b6b] hover:bg-[#0c5555] text-white px-4 py-2 rounded-xl text-sm font-semibold w-fit"
                      >
                        Ver registros
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={cerrarDetalleHorario}
                className="px-5 py-3 rounded-xl bg-gray-200 text-gray-800 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
