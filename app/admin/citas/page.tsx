"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Registro = {
  id: string
  codigo: string
  nombre_animal: string | null
  especie: string | null
  sexo: string | null
  tipo_animal: string | null
  hora: string | null
  fecha_programada: string | null
  estado_cita: string | null
  estado_clinica: string | null
  clinica_id: string | null
}

type Clinica = {
  id: string
  nome: string
}

type EstadoFiltro =
  | "todos"
  | "pendiente"
  | "apto"
  | "no_apto"
  | "reprogramado"

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function parseLocalDate(fecha?: string | null) {
  if (!fecha) return null
  const [year, month, day] = fecha.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("es-BO", {
    month: "long",
    year: "numeric",
  })
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
  }
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const firstWeekDay = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const days: Array<{ date: Date | null; key: string }> = []

  for (let i = 0; i < firstWeekDay; i++) {
    days.push({ date: null, key: `empty-start-${i}` })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    days.push({ date, key: formatDateKey(date) })
  }

  while (days.length % 7 !== 0) {
    days.push({ date: null, key: `empty-end-${days.length}` })
  }

  return days
}

function normalizarTexto(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

function normalizarEstadoBase(valor?: string | null) {
  const estado = normalizarTexto(valor)

  if (estado === "programado") return "PROGRAMADO"
  if (estado === "atendido" || estado === "realizado") return "REALIZADO"
  if (estado === "cancelado") return "CANCELADO"
  if (estado === "reprogramado") return "REPROGRAMADO"
  if (estado === "recusado" || estado === "rechazado") return "RECHAZADO"
  if (estado === "falleció" || estado === "fallecio" || estado === "fallecido") return "FALLECIO"
  if (estado === "no show" || estado === "noshow" || estado === "no_show") return "NO_SHOW"

  return "OTRO"
}

/**
 * Nesta V6 executiva, "NO_SHOW" não aparece como categoria visual separada.
 * Para manter o painel mais limpo, ele entra dentro de "PENDIENTE" nesta tela.
 */
function obtenerEstadoVisualEjecutivo(registro: Registro) {
  const estadoClinica = normalizarTexto(registro.estado_clinica)
  const estadoCita = normalizarEstadoBase(registro.estado_cita)

  if (estadoClinica === "apto") return "APTO"

  if (estadoCita === "REPROGRAMADO" || estadoClinica === "reprogramado") {
    return "REPROGRAMADO"
  }

  if (
    estadoCita === "RECHAZADO" ||
    estadoCita === "CANCELADO" ||
    estadoCita === "FALLECIO" ||
    estadoClinica === "rechazado" ||
    estadoClinica === "recusado" ||
    estadoClinica === "no apto"
  ) {
    return "NO_APTO"
  }

  if (
    estadoCita === "REALIZADO" ||
    estadoClinica === "realizado" ||
    estadoClinica === "atendido"
  ) {
    return "APTO"
  }

  return "PENDIENTE"
}

function getEstadoLabel(estado: string) {
  switch (estado) {
    case "APTO":
      return "Apto"
    case "NO_APTO":
      return "No apto"
    case "REPROGRAMADO":
      return "Reprogramado"
    default:
      return "Pendiente"
  }
}

function getEstadoClasses(estado: string) {
  switch (estado) {
    case "APTO":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
    case "NO_APTO":
      return "bg-rose-50 text-rose-700 border border-rose-200"
    case "REPROGRAMADO":
      return "bg-amber-50 text-amber-700 border border-amber-200"
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200"
  }
}

function formatHora(hora: string | null) {
  if (!hora) return "Sin hora"
  return hora.slice(0, 5)
}

function contarEstados(items: Registro[]) {
  let pendientes = 0
  let aptos = 0
  let noAptos = 0
  let reprogramados = 0

  items.forEach((item) => {
    const estado = obtenerEstadoVisualEjecutivo(item)
    if (estado === "PENDIENTE") pendientes++
    else if (estado === "APTO") aptos++
    else if (estado === "NO_APTO") noAptos++
    else if (estado === "REPROGRAMADO") reprogramados++
  })

  const total = items.length
  const eficiencia = total > 0 ? (aptos / total) * 100 : 0

  return {
    total,
    pendientes,
    aptos,
    noAptos,
    reprogramados,
    eficiencia,
  }
}

function getSemaforo(stats: ReturnType<typeof contarEstados>) {
  const problema = stats.noAptos + stats.pendientes

  if (stats.total === 0) {
    return {
      ring: "ring-gray-200",
      badge: "bg-gray-100 text-gray-700 border border-gray-200",
      label: "Sin datos",
    }
  }

  if (stats.eficiencia >= 75) {
    return {
      ring: "ring-emerald-200",
      badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      label: "Buen avance",
    }
  }

  if (problema / stats.total >= 0.45) {
    return {
      ring: "ring-rose-200",
      badge: "bg-rose-50 text-rose-700 border border-rose-200",
      label: "Atención",
    }
  }

  return {
    ring: "ring-amber-200",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Seguimiento",
  }
}

export default function AdminCitasPage() {
  const hoy = getLocalDateString()
  const hoyDate = parseLocalDate(hoy) || new Date()

  const [mesActual, setMesActual] = useState(
    new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1)
  )
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy)
  const [clinicaFiltro, setClinicaFiltro] = useState("todas")
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos")
  const [registrosMes, setRegistrosMes] = useState<Registro[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [clinicasAbiertas, setClinicasAbiertas] = useState<Record<string, boolean>>({})

  useEffect(() => {
    cargarClinicas()
  }, [])

  useEffect(() => {
    const { start, end } = getMonthRange(mesActual)
    cargarRegistrosMes(start, end)
  }, [mesActual])

  useEffect(() => {
    const interval = setInterval(() => {
      const { start, end } = getMonthRange(mesActual)
      cargarRegistrosMes(start, end, false)
    }, 15000)

    return () => clearInterval(interval)
  }, [mesActual])

  async function cargarClinicas() {
    const { data, error } = await supabase
      .from("clinicas")
      .select("id,nome")
      .order("nome", { ascending: true })

    if (error) {
      console.log("Error cargando clínicas:", error)
      return
    }

    setClinicas(data || [])
  }

  async function cargarRegistrosMes(start: string, end: string, showLoader = true) {
    if (showLoader) setLoading(true)

    const { data, error } = await supabase
      .from("registros")
      .select(
        "id,codigo,nombre_animal,especie,sexo,tipo_animal,hora,fecha_programada,estado_cita,estado_clinica,clinica_id"
      )
      .gte("fecha_programada", start)
      .lte("fecha_programada", end)
      .order("fecha_programada", { ascending: true })
      .order("hora", { ascending: true })

    if (error) {
      console.log("Error cargando registros del mes:", error)
      if (showLoader) setLoading(false)
      return
    }

    setRegistrosMes(data || [])
    setLastUpdated(new Date())
    if (showLoader) setLoading(false)
  }

  const clinicasMap = useMemo(() => {
    const map: Record<string, string> = {}
    clinicas.forEach((c) => {
      map[c.id] = c.nome
    })
    return map
  }, [clinicas])

  const registrosPorDia = useMemo(() => {
    const grupos: Record<string, Registro[]> = {}

    registrosMes.forEach((registro) => {
      const fecha = registro.fecha_programada
      if (!fecha) return
      if (!grupos[fecha]) grupos[fecha] = []
      grupos[fecha].push(registro)
    })

    return grupos
  }, [registrosMes])

  const resumenPorDia = useMemo(() => {
    const resumen: Record<string, ReturnType<typeof contarEstados>> = {}

    Object.entries(registrosPorDia).forEach(([fecha, items]) => {
      resumen[fecha] = contarEstados(items)
    })

    return resumen
  }, [registrosPorDia])

  const registrosDiaSeleccionado = useMemo(() => {
    return registrosPorDia[fechaSeleccionada] || []
  }, [registrosPorDia, fechaSeleccionada])

  const registrosBase = useMemo(() => {
    if (clinicaFiltro === "todas") return registrosDiaSeleccionado
    return registrosDiaSeleccionado.filter((r) => r.clinica_id === clinicaFiltro)
  }, [registrosDiaSeleccionado, clinicaFiltro])

  const registrosFiltrados = useMemo(() => {
    if (estadoFiltro === "todos") return registrosBase

    return registrosBase.filter((r) => {
      const estado = obtenerEstadoVisualEjecutivo(r)

      if (estadoFiltro === "pendiente") return estado === "PENDIENTE"
      if (estadoFiltro === "apto") return estado === "APTO"
      if (estadoFiltro === "no_apto") return estado === "NO_APTO"
      if (estadoFiltro === "reprogramado") return estado === "REPROGRAMADO"

      return true
    })
  }, [registrosBase, estadoFiltro])

  const resumenDia = useMemo(() => contarEstados(registrosBase), [registrosBase])

  const agrupadoPorClinica = useMemo(() => {
    const grupos: Record<string, Registro[]> = {}

    registrosFiltrados.forEach((r) => {
      const clinicaNombre = r.clinica_id
        ? clinicasMap[r.clinica_id] || "Clínica sin nombre"
        : "Sin clínica"

      if (!grupos[clinicaNombre]) grupos[clinicaNombre] = []
      grupos[clinicaNombre].push(r)
    })

    return Object.entries(grupos)
      .map(([clinicaNombre, items]) => {
        const horarios: Record<string, Registro[]> = {}

        items.forEach((item) => {
          const horaKey = item.hora || "Sin hora"
          if (!horarios[horaKey]) horarios[horaKey] = []
          horarios[horaKey].push(item)
        })

        const horariosOrdenados = Object.entries(horarios).sort((a, b) =>
          a[0].localeCompare(b[0])
        )

        return {
          clinicaNombre,
          items,
          stats: contarEstados(items),
          horarios: horariosOrdenados.map(([hora, registrosHora]) => ({
            hora,
            items: registrosHora,
            stats: contarEstados(registrosHora),
          })),
        }
      })
      .sort((a, b) => a.clinicaNombre.localeCompare(b.clinicaNombre))
  }, [registrosFiltrados, clinicasMap])

  useEffect(() => {
    setClinicasAbiertas((prev) => {
      const next = { ...prev }
      agrupadoPorClinica.forEach((grupo) => {
        if (typeof next[grupo.clinicaNombre] === "undefined") {
          next[grupo.clinicaNombre] = true
        }
      })
      return next
    })
  }, [agrupadoPorClinica])

  function toggleClinica(clinicaNombre: string) {
    setClinicasAbiertas((prev) => ({
      ...prev,
      [clinicaNombre]: !prev[clinicaNombre],
    }))
  }

  function moverMes(direccion: -1 | 1) {
    setMesActual((prev) => {
      const novo = new Date(prev.getFullYear(), prev.getMonth() + direccion, 1)
      return novo
    })
  }

  const calendarioDias = useMemo(() => buildCalendarDays(mesActual), [mesActual])

  const quickFilters = [
    { key: "todos", label: "Todos" },
    { key: "pendiente", label: "Pendientes" },
    { key: "apto", label: "Aptos" },
    { key: "no_apto", label: "No aptos" },
    { key: "reprogramado", label: "Reprogramados" },
  ] as const

  const summaryCards = [
    { label: "Total", value: resumenDia.total, color: "text-[#02686A]" },
    { label: "Pendientes", value: resumenDia.pendientes, color: "text-amber-500" },
    { label: "Aptos", value: resumenDia.aptos, color: "text-emerald-600" },
    { label: "No aptos", value: resumenDia.noAptos, color: "text-rose-600" },
    { label: "Reprogramados", value: resumenDia.reprogramados, color: "text-orange-500" },
    { label: "Eficiencia", value: `${resumenDia.eficiencia.toFixed(0)}%`, color: "text-[#02686A]" },
  ]

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02686A] via-[#0A7B7D] to-[#0f5254] px-4 md:px-6 py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 shadow-2xl p-5 md:p-7">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-white text-sm font-medium mb-3">
                Fundación Rugimos · Calendario ejecutivo
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Citas
              </h1>

              <p className="text-white/80 mt-2 text-sm md:text-base">
                Vista mensual con eficiencia diaria y detalle por clínica.
              </p>

              <div className="mt-3 text-xs md:text-sm text-white/70">
                {lastUpdated
                  ? `Actualizado automáticamente: ${lastUpdated.toLocaleTimeString()}`
                  : "Cargando actualización..."}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const { start, end } = getMonthRange(mesActual)
                  cargarRegistrosMes(start, end, true)
                }}
                className="bg-white text-[#02686A] px-5 py-3 rounded-2xl font-semibold shadow-lg hover:scale-[1.02] transition"
              >
                Actualizar ahora
              </button>

              <Link
                href="/admin"
                className="bg-white/15 text-white border border-white/20 px-5 py-3 rounded-2xl font-semibold shadow-lg hover:bg-white/20 transition"
              >
                Volver al dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6 mb-6 border border-white/60">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => moverMes(-1)}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-700 font-semibold hover:bg-slate-200 transition"
            >
              ←
            </button>

            <div className="rounded-2xl bg-slate-100 px-5 py-3 text-[#02686A] font-bold capitalize min-w-[180px] text-center">
              {getMonthLabel(mesActual)}
            </div>

            <button
              onClick={() => moverMes(1)}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-700 font-semibold hover:bg-slate-200 transition"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-3 mb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs md:text-sm font-semibold text-slate-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {calendarioDias.map((item) => {
              if (!item.date) {
                return (
                  <div
                    key={item.key}
                    className="min-h-[96px] md:min-h-[110px] rounded-2xl bg-transparent"
                  />
                )
              }

              const dateKey = formatDateKey(item.date)
              const resumen = resumenPorDia[dateKey]
              const total = resumen?.total || 0
              const eficiencia = resumen?.eficiencia || 0
              const isSelected = fechaSeleccionada === dateKey
              const isToday = hoy === dateKey

              return (
                <button
                  key={item.key}
                  onClick={() => setFechaSeleccionada(dateKey)}
                  className={`relative overflow-hidden min-h-[96px] md:min-h-[110px] rounded-2xl border text-left p-3 transition ${
                    isSelected
                      ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/30 bg-white shadow-lg"
                      : "border-slate-200 bg-white hover:border-[#F47C3C]/50 hover:shadow-md"
                  }`}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#02686A]/14 transition-all"
                    style={{ height: `${Math.max(0, Math.min(100, eficiencia))}%` }}
                  />

                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm md:text-base font-bold text-slate-800">
                        {item.date.getDate()}
                      </span>

                      {isToday && (
                        <span className="rounded-full bg-[#02686A] text-white px-2 py-0.5 text-[10px] font-semibold">
                          Hoy
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] md:text-xs font-semibold text-slate-600">
                        {total > 0 ? `${total} citas` : "Sin citas"}
                      </div>
                      <div className="text-[11px] md:text-xs font-bold text-[#02686A]">
                        {total > 0 ? `${eficiencia.toFixed(0)}% eficiencia` : "—"}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#02686A]/14 border border-[#02686A]/20" />
              <span>Cuanto más lleno, mayor eficiencia del día</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm border-2 border-[#F47C3C]" />
              <span>Día seleccionado</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6 mb-6 border border-white/60">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#02686A]">
                Resumen del día
              </h2>
              <p className="text-slate-500 mt-1">
                Fecha seleccionada: {fechaSeleccionada}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 w-full xl:w-auto xl:min-w-[520px]">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Clínica
                </label>
                <select
                  value={clinicaFiltro}
                  onChange={(e) => setClinicaFiltro(e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#02686A] bg-gray-50"
                >
                  <option value="todas">Todas</option>
                  {clinicas.map((clinica) => (
                    <option key={clinica.id} value={clinica.id}>
                      {clinica.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado rápido
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#02686A] bg-gray-50"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="apto">Aptos</option>
                  <option value="no_apto">No aptos</option>
                  <option value="reprogramado">Reprogramados</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {quickFilters.map((item) => {
              const active = estadoFiltro === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setEstadoFiltro(item.key as EstadoFiltro)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[#02686A] text-white shadow"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-7">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-3xl p-5 shadow-xl border border-white/70"
            >
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-[28px] p-10 shadow-2xl text-center text-gray-600">
            Cargando calendario...
          </div>
        ) : agrupadoPorClinica.length === 0 ? (
          <div className="bg-white rounded-[28px] p-10 shadow-2xl text-center text-gray-600">
            No hay citas registradas para esta fecha con los filtros seleccionados.
          </div>
        ) : (
          <div className="space-y-5">
            {agrupadoPorClinica.map((grupo) => {
              const abierto = clinicasAbiertas[grupo.clinicaNombre] ?? true
              const semaforo = getSemaforo(grupo.stats)

              return (
                <div
                  key={grupo.clinicaNombre}
                  className={`bg-white rounded-[30px] shadow-2xl overflow-hidden border border-white/70 ring-4 ${semaforo.ring}`}
                >
                  <button
                    onClick={() => toggleClinica(grupo.clinicaNombre)}
                    className="w-full text-left bg-gradient-to-r from-[#F47C3C] to-[#F29A5A] text-white px-5 md:px-6 py-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-bold tracking-tight">
                            {grupo.clinicaNombre}
                          </h2>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${semaforo.badge}`}
                          >
                            {semaforo.label}
                          </span>
                        </div>

                        <p className="text-white/90 mt-1 text-sm">
                          {abierto ? "Ocultar detalle" : "Expandir detalle"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/75">Total</p>
                          <p className="text-2xl font-bold">{grupo.stats.total}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/75">Aptos</p>
                          <p className="text-2xl font-bold">{grupo.stats.aptos}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/75">Pendientes</p>
                          <p className="text-2xl font-bold">{grupo.stats.pendientes}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/75">No aptos</p>
                          <p className="text-2xl font-bold">{grupo.stats.noAptos}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/75">Eficiencia</p>
                          <p className="text-2xl font-bold">{grupo.stats.eficiencia.toFixed(0)}%</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  {abierto && (
                    <div className="p-5 md:p-6 space-y-5">
                      {grupo.horarios.map((horario) => (
                        <div
                          key={`${grupo.clinicaNombre}-${horario.hora}`}
                          className="rounded-[24px] border border-slate-200 bg-slate-50/70"
                        >
                          <div className="px-5 py-4 border-b border-slate-200 bg-white rounded-t-[24px]">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-bold text-[#02686A]">
                                  Horario {formatHora(horario.hora === "Sin hora" ? null : horario.hora)}
                                </h3>
                              </div>

                              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                                  Total: {horario.stats.total}
                                </span>
                                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-emerald-700">
                                  Aptos: {horario.stats.aptos}
                                </span>
                                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-amber-700">
                                  Pendientes: {horario.stats.pendientes}
                                </span>
                                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-rose-700">
                                  No aptos: {horario.stats.noAptos}
                                </span>
                                <span className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-[#02686A]">
                                  {horario.stats.eficiencia.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            {horario.items.map((item) => {
                              const estado = obtenerEstadoVisualEjecutivo(item)

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm"
                                >
                                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-[#02686A] font-bold text-base">
                                          {item.codigo}
                                        </span>
                                        <span
                                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getEstadoClasses(
                                            estado
                                          )}`}
                                        >
                                          {getEstadoLabel(estado)}
                                        </span>
                                      </div>

                                      <div className="text-base font-semibold text-gray-900">
                                        {item.nombre_animal || "Sin nombre"}
                                      </div>

                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                                        <span>Especie: {item.especie || "-"}</span>
                                        <span>Sexo: {item.sexo || "-"}</span>
                                        <span>Tipo: {item.tipo_animal || "-"}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 md:justify-end">
                                      <span className="rounded-full bg-[#02686A]/10 text-[#02686A] px-3 py-1 text-xs font-semibold">
                                        {formatHora(item.hora)}
                                      </span>

                                      {item.fecha_programada && (
                                        <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold">
                                          {item.fecha_programada}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}