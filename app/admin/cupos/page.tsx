
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id: string
  nome?: string
  nombre?: string
  zona?: string
  endereco?: string
  ativa?: boolean
  dias_funcionamento?: string[] | null
}

type Horario = {
  id: string
  clinica_id: string
  hora?: string
  horario?: string
  horario_inicio?: string
  cupos_maximos?: number
  cupos?: number
}

type CupoDiario = {
  id: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  ocupados: number
}

type Registro = {
  id: string
  clinica_id?: string
  horario_id?: string
  fecha_programada?: string
  hora?: string | null
  estado_cita?: string | null
  codigo?: string | null
  nombre_animal?: string | null
  especie?: string | null
  sexo?: string | null
  tipo_animal?: string | null
  telefono?: string | null
  celular?: string | null
  nombre_responsable?: string | null
  nombre_completo?: string | null
  responsable?: string | null
  tutor?: string | null
  propietario?: string | null
}

type CupoEspecialFecha = {
  id?: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  activo?: boolean
}

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function getClinicaNombre(clinica: Clinica) {
  return clinica?.nome || clinica?.nombre || "Sin nombre"
}

function getHorarioHora(horario: Horario) {
  return horario?.hora || horario?.horario || horario?.horario_inicio || ""
}

function getHorarioCupos(horario: Horario) {
  return Number(horario?.cupos_maximos ?? horario?.cupos ?? 0)
}

function normalizarEstado(estado?: string | null) {
  const valor = (estado || "").trim().toLowerCase()

  if (valor === "programado") return "PROGRAMADO"
  if (valor === "reprogramado") return "REPROGRAMADO"
  if (valor === "realizado" || valor === "atendido") return "REALIZADO"
  if (valor === "cancelado") return "CANCELADO"
  if (valor === "rechazado" || valor === "rejeitado") return "RECHAZADO"
  if (valor === "no show" || valor === "noshow" || valor === "no_show") return "NO_SHOW"
  if (valor === "fallecio" || valor === "falleció") return "FALLECIO"

  return "OTRO"
}

function ocupaCupo(estado?: string | null) {
  const normalizado = normalizarEstado(estado)
  return normalizado === "PROGRAMADO" || normalizado === "REPROGRAMADO"
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
    case "NO_SHOW":
      return "No show"
    case "FALLECIO":
      return "Falleció"
    default:
      return estado || "Sin estado"
  }
}

function clasesEstado(estado?: string | null) {
  const normalizado = normalizarEstado(estado)

  switch (normalizado) {
    case "PROGRAMADO":
      return "bg-amber-100 text-amber-800 border border-amber-200"
    case "REPROGRAMADO":
      return "bg-sky-100 text-sky-800 border border-sky-200"
    case "REALIZADO":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200"
    case "CANCELADO":
      return "bg-rose-100 text-rose-800 border border-rose-200"
    case "RECHAZADO":
    case "NO_SHOW":
      return "bg-zinc-100 text-zinc-700 border border-zinc-200"
    case "FALLECIO":
      return "bg-zinc-800 text-white border border-zinc-800"
    default:
      return "bg-zinc-50 text-zinc-700 border border-zinc-200"
  }
}

function obtenerDiaSemana(fecha: string) {
  const diasMap: Record<number, string> = {
    0: "domingo",
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    6: "sabado",
  }

  const numero = new Date(`${fecha}T12:00:00`).getDay()
  return diasMap[numero]
}

function clinicaAbreEseDia(clinica: Clinica, fecha: string) {
  if (!clinica?.dias_funcionamento || clinica.dias_funcionamento.length === 0) {
    return true
  }

  const dia = obtenerDiaSemana(fecha)
  return clinica.dias_funcionamento.includes(dia)
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split("-")
  return `${d}/${m}/${y}`
}

function getResponsable(registro: Registro) {
  return (
    registro?.nombre_responsable ||
    registro?.nombre_completo ||
    registro?.responsable ||
    registro?.tutor ||
    registro?.propietario ||
    "Sin nombre"
  )
}

function getTelefono(registro: Registro) {
  return registro?.telefono || registro?.celular || "Sin teléfono"
}

function getSlotTone(cupos: number, ocupados: number) {
  if (cupos <= 0) return "hidden"
  const disponibles = Math.max(0, cupos - ocupados)
  if (disponibles <= 0) return "full"
  const ratio = ocupados / Math.max(1, cupos)
  if (ratio >= 0.7) return "warning"
  return "ok"
}

function slotClasses(tone: string) {
  if (tone === "full") {
    return "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
}

function normalizarHoraParaGuardar(hora: string) {
  if (!hora) return ""
  return hora.length === 5 ? `${hora}:00` : hora
}

function normalizarHoraParaInput(hora: string) {
  if (!hora) return ""
  return hora.slice(0, 5)
}

export default function AdminCuposPage() {
  const [fecha, setFecha] = useState(getLocalDateString())
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [cuposDiarios, setCuposDiarios] = useState<CupoDiario[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [cuposEspecialesFecha, setCuposEspecialesFecha] = useState<CupoEspecialFecha[]>([])

  const [busqueda, setBusqueda] = useState("")
  const [zonaFiltro, setZonaFiltro] = useState("Todas")
  const [mostrarSoloConDisponibles, setMostrarSoloConDisponibles] = useState(false)

  const [detalleAbierto, setDetalleAbierto] = useState(false)
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<{
    clinicaId: string
    clinicaNombre: string
    horarioId: string
    hora: string
  } | null>(null)

  const [gestionAbierta, setGestionAbierta] = useState(false)
  const [clinicaGestion, setClinicaGestion] = useState<Clinica | null>(null)

  const [nuevoHorarioHora, setNuevoHorarioHora] = useState("")
  const [nuevoHorarioCupo, setNuevoHorarioCupo] = useState("10")

  const [editandoHorarioId, setEditandoHorarioId] = useState<string | null>(null)
  const [guardandoHorario, setGuardandoHorario] = useState(false)

  const clinicaIds = useMemo(() => clinicas.map((c) => c.id), [clinicas])

  async function cargarBase() {
    setLoading(true)

    const { data: clinicasData, error: clinicasError } = await supabase
      .from("clinicas")
      .select("*")
      .eq("ativa", true)
      .order("nome", { ascending: true })

    if (clinicasError) {
      console.error("Error cargando clínicas:", clinicasError)
      setClinicas([])
      setHorarios([])
      setLoading(false)
      return
    }

    const clinicasActivas = (clinicasData || []) as Clinica[]
    setClinicas(clinicasActivas)

    const ids = clinicasActivas.map((c) => c.id)

    if (ids.length === 0) {
      setHorarios([])
      setCuposDiarios([])
      setRegistros([])
      setCuposEspecialesFecha([])
      setLoading(false)
      return
    }

    const [horariosRes, cuposRes, registrosRes, especialesFechaRes] = await Promise.all([
      supabase.from("horarios_clinica").select("*").in("clinica_id", ids),
      supabase.from("cupos_diarios").select("*").eq("fecha", fecha).in("clinica_id", ids),
      supabase.from("registros").select("*").eq("fecha_programada", fecha).in("clinica_id", ids),
      supabase.from("cupos_horario_fecha_especifica").select("*").in("clinica_id", ids).eq("activo", true),
    ])

    if (horariosRes.error) {
      console.error("Error cargando horarios:", horariosRes.error)
      setHorarios([])
    } else {
      setHorarios(((horariosRes.data || []) as Horario[]).sort((a, b) => getHorarioHora(a).localeCompare(getHorarioHora(b))))
    }

    if (cuposRes.error) {
      console.error("Error cargando cupos diarios:", cuposRes.error)
      setCuposDiarios([])
    } else {
      setCuposDiarios((cuposRes.data || []) as CupoDiario[])
    }

    if (registrosRes.error) {
      console.error("Error cargando registros:", registrosRes.error)
      setRegistros([])
    } else {
      setRegistros((registrosRes.data || []) as Registro[])
    }

    if (especialesFechaRes.error) {
      console.error("Error cargando cupos especiales por fecha:", especialesFechaRes.error)
      setCuposEspecialesFecha([])
    } else {
      setCuposEspecialesFecha((especialesFechaRes.data || []) as CupoEspecialFecha[])
    }

    setLoading(false)
  }

  async function cargarDatosFecha(fechaActual: string, idsExternos?: string[]) {
    const ids = idsExternos || clinicaIds
    if (ids.length === 0) {
      setCuposDiarios([])
      setRegistros([])
      return
    }

    const [cuposRes, registrosRes] = await Promise.all([
      supabase.from("cupos_diarios").select("*").eq("fecha", fechaActual).in("clinica_id", ids),
      supabase.from("registros").select("*").eq("fecha_programada", fechaActual).in("clinica_id", ids),
    ])

    if (cuposRes.error) {
      console.error("Error cargando cupos diarios:", cuposRes.error)
      setCuposDiarios([])
    } else {
      setCuposDiarios((cuposRes.data || []) as CupoDiario[])
    }

    if (registrosRes.error) {
      console.error("Error cargando registros:", registrosRes.error)
      setRegistros([])
    } else {
      setRegistros((registrosRes.data || []) as Registro[])
    }
  }

  useEffect(() => {
    cargarBase()
  }, [])

  useEffect(() => {
    if (clinicaIds.length > 0) {
      cargarDatosFecha(fecha)
    }
  }, [fecha])

  const zonas = useMemo(() => {
    return ["Todas", ...Array.from(new Set(clinicas.map((c) => c.zona).filter(Boolean) as string[])).sort()]
  }, [clinicas])

  const clinicasVisibles = useMemo(() => {
    let base = clinicas.filter((clinica) => clinicaAbreEseDia(clinica, fecha))

    if (zonaFiltro !== "Todas") {
      base = base.filter((c) => c.zona === zonaFiltro)
    }

    const texto = busqueda.trim().toLowerCase()
    if (texto) {
      base = base.filter((c) => {
        return (
          getClinicaNombre(c).toLowerCase().includes(texto) ||
          String(c.zona || "").toLowerCase().includes(texto) ||
          String(c.endereco || "").toLowerCase().includes(texto)
        )
      })
    }

    return base
  }, [clinicas, fecha, zonaFiltro, busqueda])

  const clinicaIdsVisibles = useMemo(() => clinicasVisibles.map((c) => c.id), [clinicasVisibles])

  const horariosFiltrados = useMemo(() => {
    return horarios.filter((h) => clinicaIdsVisibles.includes(h.clinica_id))
  }, [horarios, clinicaIdsVisibles])

  const horariosUnicos = useMemo(() => {
    const horas = Array.from(new Set(horariosFiltrados.map((h) => getHorarioHora(h)).filter(Boolean)))
    return horas.sort((a, b) => a.localeCompare(b))
  }, [horariosFiltrados])

  const horarioPorClinicaHora = useMemo(() => {
    const mapa = new Map<string, Horario>()
    for (const horario of horariosFiltrados) {
      const hora = getHorarioHora(horario)
      if (!hora) continue
      mapa.set(`${horario.clinica_id}__${hora}`, horario)
    }
    return mapa
  }, [horariosFiltrados])

  const cupoPorClinicaHorario = useMemo(() => {
    const mapa = new Map<string, CupoDiario>()
    for (const cupo of cuposDiarios) {
      mapa.set(`${cupo.clinica_id}__${cupo.horario_id}`, cupo)
    }
    return mapa
  }, [cuposDiarios])

  const registrosPorClinicaHorario = useMemo(() => {
    const mapa = new Map<string, Registro[]>()
    for (const registro of registros) {
      if (!registro.clinica_id || !registro.horario_id) continue
      const clave = `${registro.clinica_id}__${registro.horario_id}`
      if (!mapa.has(clave)) mapa.set(clave, [])
      mapa.get(clave)!.push(registro)
    }
    return mapa
  }, [registros])

  const ocupadosPorClinicaHorario = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const registro of registros) {
      if (!registro.clinica_id || !registro.horario_id) continue
      if (!ocupaCupo(registro.estado_cita)) continue
      const clave = `${registro.clinica_id}__${registro.horario_id}`
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    }
    return mapa
  }, [registros])

  const especialesFechaMap = useMemo(() => {
    const mapa = new Map<string, CupoEspecialFecha>()
    for (const item of cuposEspecialesFecha) {
      mapa.set(`${item.clinica_id}__${item.horario_id}__${item.fecha}`, item)
    }
    return mapa
  }, [cuposEspecialesFecha])

  function obtenerHorario(clinicaId: string, hora: string) {
    return horarioPorClinicaHora.get(`${clinicaId}__${hora}`) || null
  }

  function obtenerCupoDiario(clinicaId: string, horarioId: string) {
    return cupoPorClinicaHorario.get(`${clinicaId}__${horarioId}`) || null
  }

  function obtenerOcupadosReales(clinicaId: string, horarioId: string) {
    return ocupadosPorClinicaHorario.get(`${clinicaId}__${horarioId}`) || 0
  }

  function obtenerRegistrosHorario(clinicaId: string, horarioId: string) {
    return registrosPorClinicaHorario.get(`${clinicaId}__${horarioId}`) || []
  }

  function obtenerCupoFechaEspecifica(clinicaId: string, horarioId: string, fechaTarget: string) {
    return especialesFechaMap.get(`${clinicaId}__${horarioId}__${fechaTarget}`) || null
  }

  const resumen = useMemo(() => {
    let cuposTotales = 0
    let ocupadosTotales = 0
    let registrosDia = 0

    for (const horario of horariosFiltrados) {
      const clinicaId = horario.clinica_id
      const horarioId = horario.id
      const cupoDiario = obtenerCupoDiario(clinicaId, horarioId)
      const cupos = Number(cupoDiario?.cupos ?? getHorarioCupos(horario))
      const ocupados = obtenerOcupadosReales(clinicaId, horarioId)
      if (cupos === 0 && ocupados === 0) continue
      cuposTotales += cupos
      ocupadosTotales += ocupados
    }

    registrosDia = registros.filter((r) => clinicaIdsVisibles.includes(r.clinica_id || "")).length

    return {
      cuposTotales,
      ocupadosTotales,
      disponiblesTotales: Math.max(0, cuposTotales - ocupadosTotales),
      registrosDia,
    }
  }, [horariosFiltrados, cuposDiarios, registros, clinicaIdsVisibles])

  const clinicasTarjetas = useMemo(() => {
    return clinicasVisibles
      .map((clinica) => {
        const slots = horariosUnicos
          .map((hora) => {
            const horario = obtenerHorario(clinica.id, hora)
            if (!horario) return null
            const cupoDiario = obtenerCupoDiario(clinica.id, horario.id)
            const cupos = Number(cupoDiario?.cupos ?? getHorarioCupos(horario))
            const ocupados = obtenerOcupadosReales(clinica.id, horario.id)

            if (cupos === 0 && ocupados === 0) return null

            return {
              horario,
              hora,
              cupos,
              ocupados,
              disponibles: Math.max(0, cupos - ocupados),
              tone: getSlotTone(cupos, ocupados),
            }
          })
          .filter(Boolean) as {
            horario: Horario
            hora: string
            cupos: number
            ocupados: number
            disponibles: number
            tone: string
          }[]

        const totales = slots.reduce(
          (acc, slot) => {
            acc.cupos += slot.cupos
            acc.ocupados += slot.ocupados
            return acc
          },
          { cupos: 0, ocupados: 0 }
        )

        return {
          clinica,
          slots,
          cupos: totales.cupos,
          ocupados: totales.ocupados,
          disponibles: Math.max(0, totales.cupos - totales.ocupados),
        }
      })
      .filter((item) => !mostrarSoloConDisponibles || item.disponibles > 0)
  }, [clinicasVisibles, horariosUnicos, cuposDiarios, registros, mostrarSoloConDisponibles])

  function cambiarFecha(dias: number) {
    const base = new Date(`${fecha}T00:00:00`)
    base.setDate(base.getDate() + dias)
    const yyyy = base.getFullYear()
    const mm = String(base.getMonth() + 1).padStart(2, "0")
    const dd = String(base.getDate()).padStart(2, "0")
    setFecha(`${yyyy}-${mm}-${dd}`)
  }

  async function obtenerCupoProgramadoDesdeBD(
    clinicaId: string,
    horarioId: string,
    fechaTarget: string,
    cupoBase: number
  ) {
    const especialFecha = obtenerCupoFechaEspecifica(clinicaId, horarioId, fechaTarget)
    if (especialFecha && Number.isFinite(Number(especialFecha.cupos))) {
      return Number(especialFecha.cupos)
    }

    const diaSemana = new Date(`${fechaTarget}T12:00:00`).getDay()
    const { data: especialDia, error: errorDia } = await supabase
      .from("cupos_horario_dia_semana")
      .select("cupos")
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)
      .eq("dia_semana", diaSemana)
      .eq("activo", true)
      .maybeSingle()

    if (errorDia) {
      console.error("Error buscando cupo especial por día:", errorDia)
    }

    if (especialDia && Number.isFinite(Number(especialDia.cupos))) {
      return Number(especialDia.cupos)
    }

    return cupoBase
  }

  async function obtenerOCrearCupoDiario(clinicaId: string, horarioId: string, fechaTarget: string) {
    const { data: existente, error: errorBuscar } = await supabase
      .from("cupos_diarios")
      .select("*")
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)
      .eq("fecha", fechaTarget)
      .maybeSingle()

    if (errorBuscar) throw errorBuscar

    const horarioBase = horarios.find((h) => h.id === horarioId && h.clinica_id === clinicaId)
    if (!horarioBase) throw new Error("No se encontró el horario base.")

    const cupoBase = Number(getHorarioCupos(horarioBase))
    const cupoProgramado = await obtenerCupoProgramadoDesdeBD(clinicaId, horarioId, fechaTarget, cupoBase)

    if (existente) {
      const ocupadosActuales = Number(existente.ocupados || 0)
      const cupoFinal = Math.max(cupoProgramado, ocupadosActuales)

      if (Number(existente.cupos) !== cupoFinal) {
        const { data: actualizado, error: errorUpdate } = await supabase
          .from("cupos_diarios")
          .update({ cupos: cupoFinal })
          .eq("id", existente.id)
          .select("*")
          .single()

        if (errorUpdate) throw errorUpdate
        return actualizado as CupoDiario
      }

      return existente as CupoDiario
    }

    const { data: nuevo, error: errorInsert } = await supabase
      .from("cupos_diarios")
      .insert([
        {
          clinica_id: clinicaId,
          horario_id: horarioId,
          fecha: fechaTarget,
          cupos: cupoProgramado,
          ocupados: 0,
        },
      ])
      .select("*")
      .single()

    if (errorInsert) throw errorInsert
    return nuevo as CupoDiario
  }

  async function sincronizarCupos() {
    try {
      setSincronizando(true)

      if (clinicaIdsVisibles.length === 0) {
        alert("No hay clínicas activas para ese día.")
        return
      }

      const { data: registrosData, error: registrosError } = await supabase
        .from("registros")
        .select("id, clinica_id, horario_id, fecha_programada, estado_cita")
        .eq("fecha_programada", fecha)
        .in("clinica_id", clinicaIdsVisibles)

      if (registrosError) throw registrosError

      const registrosValidos = ((registrosData || []) as Registro[]).filter(
        (r) => r.clinica_id && r.horario_id && ocupaCupo(r.estado_cita)
      )

      const claves = new Set<string>()
      for (const horario of horariosFiltrados) {
        if (horario.clinica_id && horario.id) {
          claves.add(`${horario.clinica_id}__${horario.id}`)
        }
      }

      const { data: cuposActuales, error: cuposError } = await supabase
        .from("cupos_diarios")
        .select("*")
        .eq("fecha", fecha)
        .in("clinica_id", clinicaIdsVisibles)

      if (cuposError) throw cuposError

      const mapaCupos: Record<string, CupoDiario> = {}
      for (const cupo of ((cuposActuales || []) as CupoDiario[])) {
        mapaCupos[`${cupo.clinica_id}__${cupo.horario_id}`] = cupo
      }

      for (const clave of Array.from(claves)) {
        const [clinicaId, horarioId] = clave.split("__")
        if (!mapaCupos[clave]) {
          const creado = await obtenerOCrearCupoDiario(clinicaId, horarioId, fecha)
          mapaCupos[clave] = creado
        }
      }

      const conteoPorClave: Record<string, number> = {}
      for (const registro of registrosValidos) {
        const clave = `${registro.clinica_id}__${registro.horario_id}`
        conteoPorClave[clave] = (conteoPorClave[clave] || 0) + 1
      }

      const updates = Object.keys(mapaCupos).map(async (clave) => {
        const cupo = mapaCupos[clave]
        const ocupadosReales = conteoPorClave[clave] || 0
        const [clinicaId, horarioId] = clave.split("__")

        const horarioBase = horarios.find((h) => h.clinica_id === clinicaId && h.id === horarioId)
        const cuposBase = Number(horarioBase?.cupos_maximos ?? horarioBase?.cupos ?? cupo?.cupos ?? 0)
        const cupoProgramado = await obtenerCupoProgramadoDesdeBD(clinicaId, horarioId, fecha, cuposBase)
        const cupoFinal = Math.max(cupoProgramado, ocupadosReales)

        if (Number(cupo.ocupados || 0) !== ocupadosReales || Number(cupo.cupos || 0) !== cupoFinal) {
          const { error: updateError } = await supabase
            .from("cupos_diarios")
            .update({ ocupados: ocupadosReales, cupos: cupoFinal })
            .eq("id", cupo.id)

          if (updateError) throw updateError
        }
      })

      await Promise.all(updates)
      await cargarDatosFecha(fecha, clinicaIdsVisibles)
      alert("Cupos sincronizados correctamente.")
    } catch (error: any) {
      console.error("Error sincronizando cupos:", error)
      alert(error.message || "Error al sincronizar cupos.")
    } finally {
      setSincronizando(false)
    }
  }

  function abrirDetalle(clinicaId: string, hora: string) {
    const horario = obtenerHorario(clinicaId, hora)
    const clinica = clinicas.find((c) => c.id === clinicaId)
    if (!horario || !clinica) return

    setDetalleSeleccionado({
      clinicaId,
      clinicaNombre: getClinicaNombre(clinica),
      horarioId: horario.id,
      hora,
    })
    setDetalleAbierto(true)
  }

  function cerrarDetalle() {
    setDetalleAbierto(false)
    setDetalleSeleccionado(null)
  }

  function abrirGestion(clinica: Clinica) {
    setClinicaGestion(clinica)
    setGestionAbierta(true)
    setEditandoHorarioId(null)
  }

  function cerrarGestion() {
    setGestionAbierta(false)
    setClinicaGestion(null)
    setEditandoHorarioId(null)
    setNuevoHorarioHora("")
    setNuevoHorarioCupo("10")
  }

  async function actualizarCupoDelDia(clinicaId: string, horarioId: string, nuevoCupo: number) {
    if (Number.isNaN(nuevoCupo) || nuevoCupo < 0) {
      alert("Ingresa un cupo válido.")
      return
    }

    try {
      const existente = await obtenerOCrearCupoDiario(clinicaId, horarioId, fecha)
      const ocupados = obtenerOcupadosReales(clinicaId, horarioId)
      const cupoFinal = Math.max(nuevoCupo, ocupados)

      const { error } = await supabase
        .from("cupos_diarios")
        .update({ cupos: cupoFinal })
        .eq("id", existente.id)

      if (error) throw error

      await cargarDatosFecha(fecha)
      alert("Cupo del día actualizado.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo actualizar el cupo del día.")
    }
  }

  async function restaurarBaseDelDia(clinicaId: string, horarioId: string) {
    try {
      const horarioBase = horarios.find((h) => h.id === horarioId && h.clinica_id === clinicaId)
      if (!horarioBase) {
        alert("No se encontró el horario base.")
        return
      }

      const existente = await obtenerOCrearCupoDiario(clinicaId, horarioId, fecha)
      const ocupados = obtenerOcupadosReales(clinicaId, horarioId)
      const baseProgramada = await obtenerCupoProgramadoDesdeBD(clinicaId, horarioId, fecha, getHorarioCupos(horarioBase))
      const cupoFinal = Math.max(baseProgramada, ocupados)

      const { error } = await supabase
        .from("cupos_diarios")
        .update({ cupos: cupoFinal })
        .eq("id", existente.id)

      if (error) throw error

      await cargarDatosFecha(fecha)
      alert("Cupo restaurado según la configuración base.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo restaurar el cupo.")
    }
  }

  async function ocultarHoy(clinicaId: string, horarioId: string) {
    const ocupados = obtenerOcupadosReales(clinicaId, horarioId)
    if (ocupados > 0) {
      alert("Este horario ya tiene ocupados. No se puede ocultar totalmente hoy.")
      return
    }

    await actualizarCupoDelDia(clinicaId, horarioId, 0)
  }

  async function guardarFechaEspecifica(clinicaId: string, horarioId: string, fechaTarget: string, cupos: number) {
    if (!fechaTarget) {
      alert("Selecciona una fecha.")
      return
    }

    if (Number.isNaN(cupos) || cupos < 0) {
      alert("Ingresa un cupo válido.")
      return
    }

    try {
      const existente = obtenerCupoFechaEspecifica(clinicaId, horarioId, fechaTarget)

      if (existente) {
        const { error } = await supabase
          .from("cupos_horario_fecha_especifica")
          .update({ cupos, activo: true })
          .eq("clinica_id", clinicaId)
          .eq("horario_id", horarioId)
          .eq("fecha", fechaTarget)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("cupos_horario_fecha_especifica")
          .insert([
            {
              clinica_id: clinicaId,
              horario_id: horarioId,
              fecha: fechaTarget,
              cupos,
              activo: true,
            },
          ])

        if (error) throw error
      }

      const yaEsFechaVista = fechaTarget === fecha
      if (yaEsFechaVista) {
        await obtenerOCrearCupoDiario(clinicaId, horarioId, fechaTarget)
        await restaurarBaseDelDia(clinicaId, horarioId)
      }

      const ids = clinicaGestion ? [clinicaGestion.id] : clinicaIds
      const { data, error } = await supabase
        .from("cupos_horario_fecha_especifica")
        .select("*")
        .in("clinica_id", ids)
        .eq("activo", true)

      if (!error) {
        setCuposEspecialesFecha((data || []) as CupoEspecialFecha[])
      }

      alert("Fecha específica guardada correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo guardar la fecha específica.")
    }
  }

  async function eliminarFechaEspecifica(clinicaId: string, horarioId: string, fechaTarget: string) {
    try {
      const { error } = await supabase
        .from("cupos_horario_fecha_especifica")
        .delete()
        .eq("clinica_id", clinicaId)
        .eq("horario_id", horarioId)
        .eq("fecha", fechaTarget)

      if (error) throw error

      setCuposEspecialesFecha((prev) =>
        prev.filter((i) => !(i.clinica_id === clinicaId && i.horario_id === horarioId && i.fecha === fechaTarget))
      )

      if (fechaTarget === fecha) {
        await restaurarBaseDelDia(clinicaId, horarioId)
      }

      alert("Fecha específica eliminada.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo eliminar la fecha específica.")
    }
  }

  async function agregarHorarioEnPanel() {
    if (!clinicaGestion) return

    const hora = normalizarHoraParaGuardar(nuevoHorarioHora)
    const cupos = Number(nuevoHorarioCupo)

    if (!hora) {
      alert("Selecciona una hora.")
      return
    }

    if (Number.isNaN(cupos) || cupos < 0) {
      alert("Ingresa una cantidad válida de cupos.")
      return
    }

    const existe = horarios.some((h) => h.clinica_id === clinicaGestion.id && getHorarioHora(h) === hora)
    if (existe) {
      alert("Ese horario ya existe para esta clínica.")
      return
    }

    try {
      const { error } = await supabase
        .from("horarios_clinica")
        .insert([
          {
            clinica_id: clinicaGestion.id,
            hora,
            cupos_maximos: cupos,
            cupos_ocupados: 0,
          },
        ])

      if (error) throw error

      setNuevoHorarioHora("")
      setNuevoHorarioCupo("10")
      await cargarBase()
      await cargarDatosFecha(fecha)
      alert("Horario añadido correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo añadir el horario.")
    }
  }

  async function guardarHorarioBase(horarioId: string, nuevaHora: string, nuevoCupo: number) {
    if (!clinicaGestion) return

    if (!nuevaHora) {
      alert("La hora es obligatoria.")
      return
    }

    if (Number.isNaN(nuevoCupo) || nuevoCupo < 0) {
      alert("El cupo debe ser válido.")
      return
    }

    const horaNormalizada = normalizarHoraParaGuardar(nuevaHora)
    const duplicado = horarios.some(
      (h) => h.clinica_id === clinicaGestion.id && h.id !== horarioId && getHorarioHora(h) === horaNormalizada
    )
    if (duplicado) {
      alert("Ya existe otro horario con esa hora.")
      return
    }

    try {
      setGuardandoHorario(true)

      const { error } = await supabase
        .from("horarios_clinica")
        .update({
          hora: horaNormalizada,
          cupos_maximos: nuevoCupo,
        })
        .eq("id", horarioId)

      if (error) throw error

      const cuposFuturosRes = await supabase
        .from("cupos_diarios")
        .select("id, fecha, ocupados")
        .eq("clinica_id", clinicaGestion.id)
        .eq("horario_id", horarioId)
        .gte("fecha", getLocalDateString())

      if (!cuposFuturosRes.error) {
        const especialesClinicaHorario = cuposEspecialesFecha.filter(
          (i) => i.clinica_id === clinicaGestion.id && i.horario_id === horarioId
        )

        for (const item of (cuposFuturosRes.data || []) as { id: string; fecha: string; ocupados: number }[]) {
          const especial = especialesClinicaHorario.find((e) => e.fecha === item.fecha)
          const cupoDeseado = especial ? Number(especial.cupos) : nuevoCupo
          const cupoFinal = Math.max(Number(item.ocupados || 0), cupoDeseado)

          await supabase.from("cupos_diarios").update({ cupos: cupoFinal }).eq("id", item.id)
        }
      }

      await cargarBase()
      await cargarDatosFecha(fecha)
      alert("Horario base actualizado.")
    } catch (error: any) {
      console.error(error)
      alert(error.message || "No se pudo actualizar el horario.")
    } finally {
      setGuardandoHorario(false)
      setEditandoHorarioId(null)
    }
  }

  async function ocultarBase(horarioId: string) {
    if (!clinicaGestion) return
    const confirmar = confirm("¿Ocultar este horario base? Se dejará en cupo 0 sin borrar historial.")
    if (!confirmar) return
    await guardarHorarioBase(horarioId, normalizarHoraParaInput(getHorarioHora(horarios.find((h) => h.id === horarioId)!)), 0)
  }

  const detalleInfo = useMemo(() => {
    if (!detalleSeleccionado) return null
    const { clinicaId, horarioId } = detalleSeleccionado
    const horario = horarios.find((h) => h.id === horarioId)
    if (!horario) return null

    const cupoDiario = obtenerCupoDiario(clinicaId, horarioId)
    const cupos = Number(cupoDiario?.cupos ?? getHorarioCupos(horario))
    const ocupados = obtenerOcupadosReales(clinicaId, horarioId)
    const registrosHorario = obtenerRegistrosHorario(clinicaId, horarioId).sort((a, b) =>
      String(a.nombre_animal || "").localeCompare(String(b.nombre_animal || ""))
    )
    const especialFecha = obtenerCupoFechaEspecifica(clinicaId, horarioId, fecha)

    return {
      horario,
      cupos,
      ocupados,
      disponibles: Math.max(0, cupos - ocupados),
      registros: registrosHorario,
      especialFecha,
    }
  }, [detalleSeleccionado, horarios, cuposDiarios, registros, cuposEspecialesFecha, fecha])

  const horariosClinicaGestion = useMemo(() => {
    if (!clinicaGestion) return []
    return horarios
      .filter((h) => h.clinica_id === clinicaGestion.id)
      .sort((a, b) => getHorarioHora(a).localeCompare(getHorarioHora(b)))
  }, [clinicaGestion, horarios])

  return (
    <main className="min-h-screen bg-[#026A6A] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[30px] bg-gradient-to-r from-[#055f5d] to-[#0a7471] px-6 py-7 text-white shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">Fundación Rugimos</p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">Panel de Cupos V4 Ejecutiva</h1>
              <p className="mt-3 max-w-3xl text-sm text-white/85 md:text-base">
                Vista ejecutiva y operativa para mover cupos con libertad, incluyendo ajustes por fecha específica
                para un horario puntual sin cambiar toda la semana.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-[#026A6A] shadow-lg transition hover:opacity-90"
              >
                Volver al dashboard
              </Link>

              <button
                onClick={() => cargarBase()}
                className="rounded-2xl bg-[#F28C38] px-5 py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
              >
                Actualizar
              </button>

              <button
                onClick={sincronizarCupos}
                disabled={sincronizando}
                className="rounded-2xl bg-white/15 px-5 py-3 font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-60"
              >
                {sincronizando ? "Sincronizando..." : "Sincronizar cupos"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] bg-white/95 p-4 shadow-xl">
          <div className="grid gap-3 lg:grid-cols-[180px_auto_auto_1fr_auto_auto]">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
            />

            <button
              onClick={() => cambiarFecha(-1)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Día anterior
            </button>

            <button
              onClick={() => setFecha(getLocalDateString())}
              className="rounded-2xl border border-zinc-200 px-4 py-3 font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Hoy
            </button>

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar clínica, zona o dirección..."
              className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
            />

            <select
              value={zonaFiltro}
              onChange={(e) => setZonaFiltro(e.target.value)}
              className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
            >
              {zonas.map((zona) => (
                <option key={zona} value={zona}>
                  {zona}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={mostrarSoloConDisponibles}
                onChange={(e) => setMostrarSoloConDisponibles(e.target.checked)}
              />
              Solo con disponibles
            </label>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Cupos totales", value: resumen.cuposTotales, color: "text-[#026A6A]" },
            { label: "Ocupados", value: resumen.ocupadosTotales, color: "text-[#DB7A12]" },
            { label: "Disponibles", value: resumen.disponiblesTotales, color: "text-emerald-600" },
            { label: "Registros del día", value: resumen.registrosDia, color: "text-zinc-900" },
          ].map((item) => (
            <div key={item.label} className="rounded-[28px] bg-white p-5 shadow-xl">
              <p className="text-sm text-zinc-500">{item.label}</p>
              <p className={`mt-2 text-5xl font-black ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Disponible
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Pocos cupos
          </span>
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            Lleno
          </span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
            Fecha específica configurable
          </span>
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="rounded-[28px] bg-white p-10 text-center text-zinc-500 shadow-xl">
              Cargando panel...
            </div>
          ) : clinicasTarjetas.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center text-zinc-500 shadow-xl">
              No hay clínicas visibles con esos filtros para esta fecha.
            </div>
          ) : (
            <div className="grid gap-5">
              {clinicasTarjetas.map(({ clinica, slots, cupos, ocupados, disponibles }) => (
                <div key={clinica.id} className="rounded-[30px] bg-white p-5 shadow-xl">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-zinc-900">{getClinicaNombre(clinica)}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                          {clinica.zona || "Sin zona"}
                        </span>
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">Cupos: {cupos}</span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                          Ocupados: {ocupados}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                          Disponibles: {disponibles}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => abrirGestion(clinica)}
                        className="rounded-2xl bg-[#026A6A] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
                      >
                        Gestionar horarios
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                    {slots.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                        Esta clínica no tiene cupos visibles para el día seleccionado.
                      </div>
                    ) : (
                      slots.map((slot) => (
                        <button
                          key={`${clinica.id}-${slot.hora}`}
                          onClick={() => abrirDetalle(clinica.id, slot.hora)}
                          className={`rounded-[24px] border p-4 text-left shadow-sm transition ${slotClasses(slot.tone)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-2xl font-black">{slot.hora.slice(0, 5)}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                                {slot.ocupados} / {slot.cupos} ocupados
                              </p>
                            </div>
                            {obtenerCupoFechaEspecifica(clinica.id, slot.horario.id, fecha) ? (
                              <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-800">
                                ESPECIAL
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-5">
                            <p className="text-sm font-semibold">Disponibles: {slot.disponibles}</p>
                            <p className="mt-2 text-xs opacity-75">Clic para ver detalle y acciones rápidas</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {detalleAbierto && detalleSeleccionado && detalleInfo ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#026A6A]">Detalle del horario</p>
                <h3 className="mt-2 text-4xl font-black text-zinc-900">{detalleSeleccionado.clinicaNombre}</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  {formatFecha(fecha)} · {detalleSeleccionado.hora.slice(0, 5)}
                </p>
              </div>

              <button
                onClick={cerrarDetalle}
                className="rounded-full bg-zinc-100 px-4 py-3 text-zinc-600 hover:bg-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[1.2fr_1fr] max-h-[calc(92vh-110px)]">
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Cupos", value: detalleInfo.cupos },
                    { label: "Ocupados", value: detalleInfo.ocupados },
                    { label: "Disponibles", value: detalleInfo.disponibles },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] bg-zinc-50 p-4">
                      <p className="text-xs font-bold uppercase text-zinc-500">{item.label}</p>
                      <p className="mt-2 text-4xl font-black text-zinc-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[28px] border border-zinc-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-black text-zinc-900">Pacientes del horario</h4>
                    {detalleInfo.especialFecha ? (
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">
                        Fecha específica activa
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {detalleInfo.registros.length === 0 ? (
                      <div className="rounded-3xl bg-zinc-50 p-5 text-sm text-zinc-500">
                        No hay registros en este horario.
                      </div>
                    ) : (
                      detalleInfo.registros.map((registro) => (
                        <div key={registro.id} className="rounded-[24px] border border-zinc-200 p-4 shadow-sm">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-2xl font-bold text-zinc-900">{registro.nombre_animal || "Sin nombre"}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Código: {registro.codigo || "—"} · {registro.especie || "—"} · {registro.sexo || "—"} ·{" "}
                                {registro.tipo_animal || "—"}
                              </p>
                              <p className="mt-3 text-sm text-zinc-700">Responsable: {getResponsable(registro)}</p>
                              <p className="mt-1 text-sm text-zinc-700">Tel: {getTelefono(registro)}</p>
                            </div>

                            <div className="flex flex-col items-start gap-2 md:items-end">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${clasesEstado(registro.estado_cita)}`}>
                                {labelEstado(registro.estado_cita)}
                              </span>
                              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                                Hora registro: {(registro.hora || detalleSeleccionado.hora || "").slice(0, 5)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-zinc-100 p-4">
                  <h4 className="text-lg font-black text-zinc-900">Acciones rápidas del día</h4>
                  <p className="mt-1 text-sm text-zinc-500">
                    Para ajustar solamente esta fecha visible sin tocar toda la semana.
                  </p>

                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => {
                        const valor = window.prompt("Nuevo cupo para esta fecha:", String(detalleInfo.cupos))
                        if (valor === null) return
                        actualizarCupoDelDia(detalleSeleccionado.clinicaId, detalleSeleccionado.horarioId, Number(valor))
                      }}
                      className="w-full rounded-2xl bg-[#026A6A] px-4 py-3 font-semibold text-white hover:opacity-95"
                    >
                      Editar cupo del día
                    </button>

                    <button
                      onClick={() => restaurarBaseDelDia(detalleSeleccionado.clinicaId, detalleSeleccionado.horarioId)}
                      className="w-full rounded-2xl border border-zinc-200 px-4 py-3 font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Restaurar base
                    </button>

                    <button
                      onClick={() => ocultarHoy(detalleSeleccionado.clinicaId, detalleSeleccionado.horarioId)}
                      className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Ocultar hoy
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-zinc-100 p-4">
                  <h4 className="text-lg font-black text-zinc-900">Fecha específica</h4>
                  <p className="mt-1 text-sm text-zinc-500">
                    Ejemplo: esta viernes a las 07:00 subir de 10 a 30 solo para ese día.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <input
                      id="fecha-especifica-input"
                      type="date"
                      defaultValue={fecha}
                      className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
                    />
                    <input
                      id="fecha-especifica-cupo"
                      type="number"
                      min={0}
                      defaultValue={String(detalleInfo.cupos)}
                      className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
                    />

                    <button
                      onClick={() => {
                        const fechaInput = document.getElementById("fecha-especifica-input") as HTMLInputElement | null
                        const cupoInput = document.getElementById("fecha-especifica-cupo") as HTMLInputElement | null
                        guardarFechaEspecifica(
                          detalleSeleccionado.clinicaId,
                          detalleSeleccionado.horarioId,
                          fechaInput?.value || "",
                          Number(cupoInput?.value || 0)
                        )
                      }}
                      className="rounded-2xl bg-[#F28C38] px-4 py-3 font-semibold text-white hover:opacity-95"
                    >
                      Guardar fecha específica
                    </button>

                    {detalleInfo.especialFecha ? (
                      <button
                        onClick={() =>
                          eliminarFechaEspecifica(
                            detalleSeleccionado.clinicaId,
                            detalleSeleccionado.horarioId,
                            detalleInfo.especialFecha!.fecha
                          )
                        }
                        className="rounded-2xl border border-zinc-200 px-4 py-3 font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Eliminar especial de la fecha visible
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {gestionAbierta && clinicaGestion ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="mx-auto max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#026A6A]">Gestión ejecutiva</p>
                <h3 className="mt-2 text-4xl font-black text-zinc-900">{getClinicaNombre(clinicaGestion)}</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Aquí puedes ajustar el horario base y también un cupo especial por fecha puntual.
                </p>
              </div>

              <button
                onClick={cerrarGestion}
                className="rounded-full bg-zinc-100 px-4 py-3 text-zinc-600 hover:bg-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[calc(94vh-110px)] overflow-y-auto p-6">
              <div className="rounded-[28px] bg-zinc-50 p-4">
                <h4 className="text-lg font-black text-zinc-900">Añadir nuevo horario</h4>
                <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_auto]">
                  <input
                    type="time"
                    value={nuevoHorarioHora}
                    onChange={(e) => setNuevoHorarioHora(e.target.value)}
                    className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    value={nuevoHorarioCupo}
                    onChange={(e) => setNuevoHorarioCupo(e.target.value)}
                    className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
                  />
                  <button
                    onClick={agregarHorarioEnPanel}
                    className="rounded-2xl bg-[#026A6A] px-4 py-3 font-semibold text-white hover:opacity-95"
                  >
                    Añadir horario
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {horariosClinicaGestion.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-zinc-200 p-6 text-zinc-500">
                    Esta clínica aún no tiene horarios.
                  </div>
                ) : (
                  horariosClinicaGestion.map((horario) => {
                    const fechasEspecialesHorario = cuposEspecialesFecha
                      .filter((item) => item.clinica_id === clinicaGestion.id && item.horario_id === horario.id)
                      .sort((a, b) => a.fecha.localeCompare(b.fecha))

                    return (
                      <HorarioEditorCard
                        key={horario.id}
                        horario={horario}
                        fechasEspeciales={fechasEspecialesHorario}
                        editando={editandoHorarioId === horario.id}
                        loading={guardandoHorario}
                        onStartEdit={() => setEditandoHorarioId(horario.id)}
                        onCancelEdit={() => setEditandoHorarioId(null)}
                        onSave={guardarHorarioBase}
                        onHideBase={ocultarBase}
                        onSaveSpecial={(fechaTarget, cupos) =>
                          guardarFechaEspecifica(clinicaGestion.id, horario.id, fechaTarget, cupos)
                        }
                        onDeleteSpecial={(fechaTarget) =>
                          eliminarFechaEspecifica(clinicaGestion.id, horario.id, fechaTarget)
                        }
                      />
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function HorarioEditorCard({
  horario,
  fechasEspeciales,
  editando,
  loading,
  onStartEdit,
  onCancelEdit,
  onSave,
  onHideBase,
  onSaveSpecial,
  onDeleteSpecial,
}: {
  horario: Horario
  fechasEspeciales: CupoEspecialFecha[]
  editando: boolean
  loading: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (horarioId: string, nuevaHora: string, nuevoCupo: number) => Promise<void>
  onHideBase: (horarioId: string) => Promise<void>
  onSaveSpecial: (fecha: string, cupos: number) => Promise<void>
  onDeleteSpecial: (fecha: string) => Promise<void>
}) {
  const [horaEdit, setHoraEdit] = useState(normalizarHoraParaInput(getHorarioHora(horario)))
  const [cupoEdit, setCupoEdit] = useState(String(getHorarioCupos(horario)))
  const [fechaEspecial, setFechaEspecial] = useState(getLocalDateString())
  const [cupoEspecial, setCupoEspecial] = useState(String(getHorarioCupos(horario)))

  useEffect(() => {
    setHoraEdit(normalizarHoraParaInput(getHorarioHora(horario)))
    setCupoEdit(String(getHorarioCupos(horario)))
  }, [horario.id, horario.hora, horario.cupos_maximos])

  return (
    <div className="rounded-[28px] border border-zinc-200 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-2xl font-black text-zinc-900">{getHorarioHora(horario).slice(0, 5)}</h5>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              Base: {getHorarioCupos(horario)}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Usa “fecha específica” para subir o bajar solo un día puntual sin tocar toda la semana.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editando ? (
            <>
              <button
                onClick={onStartEdit}
                className="rounded-2xl bg-[#026A6A] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
              >
                Editar base
              </button>
              <button
                onClick={() => onHideBase(horario.id)}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Ocultar base
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSave(horario.id, horaEdit, Number(cupoEdit))}
                disabled={loading}
                className="rounded-2xl bg-[#F28C38] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                Guardar base
              </button>
              <button
                onClick={onCancelEdit}
                className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {editando ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            type="time"
            value={horaEdit}
            onChange={(e) => setHoraEdit(e.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
          />
          <input
            type="number"
            min={0}
            value={cupoEdit}
            onChange={(e) => setCupoEdit(e.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
          />
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] bg-zinc-50 p-4">
        <h6 className="text-base font-black text-zinc-900">Configurar fecha específica</h6>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input
            type="date"
            value={fechaEspecial}
            onChange={(e) => setFechaEspecial(e.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
          />
          <input
            type="number"
            min={0}
            value={cupoEspecial}
            onChange={(e) => setCupoEspecial(e.target.value)}
            className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none"
          />
          <button
            onClick={() => onSaveSpecial(fechaEspecial, Number(cupoEspecial))}
            className="rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white hover:opacity-95"
          >
            Guardar fecha
          </button>
        </div>

        {fechasEspeciales.length > 0 ? (
          <div className="mt-4 space-y-2">
            {fechasEspeciales.map((item) => (
              <div
                key={`${item.horario_id}-${item.fecha}`}
                className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{formatFecha(item.fecha)}</p>
                  <p className="text-sm text-zinc-500">Cupo especial: {item.cupos}</p>
                </div>

                <button
                  onClick={() => onDeleteSpecial(item.fecha)}
                  className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Sin fechas específicas todavía.</p>
        )}
      </div>
    </div>
  )
}
