"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

function normalizarEstado(valor?: string | null) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function inicioMesISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function ultimoNDiasISO(n: number) {
  const fechas: string[] = []
  const base = new Date()

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    fechas.push(d.toISOString().slice(0, 10))
  }

  return fechas
}

type RegistroLite = {
  id: string
  clinica_id: string | null
  especie: string | null
  sexo: string | null
  pagado: boolean | null
  estado_clinica?: string | null
  estado_cita?: string | null
  fecha_programada?: string | null
  fecha_cirugia_realizada?: string | null
}

type ClinicaLite = {
  id: string
  nome: string
  ativa?: boolean | null
}

function fechaSolo(valor?: string | null) {
  return valor ? valor.slice(0, 10) : ""
}

function fechaBaseContabilizada(registro: RegistroLite) {
  if (esContabilizado(registro)) {
    return fechaSolo(registro.fecha_cirugia_realizada) || registro.fecha_programada || ""
  }
  return registro.fecha_programada || ""
}

async function fetchAllRows<T>(
  table: string,
  selectClause: string,
  build?: (query: any) => any,
  pageSize = 1000
): Promise<T[]> {
  let from = 0
  let allRows: T[] = []

  while (true) {
    let query = supabase.from(table).select(selectClause)

    if (build) query = build(query)

    const { data, error } = await query.range(from, from + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as T[]
    allRows = allRows.concat(rows)

    if (rows.length < pageSize) break
    from += pageSize
  }

  return allRows
}

function esContabilizado(registro: RegistroLite) {
  const estadoCita = normalizarEstado(registro.estado_cita)
  const estadoClinica = normalizarEstado(registro.estado_clinica)

  return (
    estadoCita === "realizado" ||
    estadoCita === "atendido" ||
    estadoCita === "fallecido" ||
    estadoCita === "fallecio" ||
    estadoClinica === "realizado" ||
    estadoClinica === "atendido" ||
    estadoClinica === "apto" ||
    estadoClinica === "fallecido" ||
    estadoClinica === "fallecio"
  )
}

export default function AdminInformesPage() {
  const [cargando, setCargando] = useState(true)

  const [solicitudesTotales, setSolicitudesTotales] = useState(0)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)

  const [registrosProgramados, setRegistrosProgramados] = useState(0)
  const [cirugiasContabilizadas, setCirugiasContabilizadas] = useState(0)
  const [noShow, setNoShow] = useState(0)
  const [cancelados, setCancelados] = useState(0)

  const [clinicasActivas, setClinicasActivas] = useState(0)

  const [stockBajo, setStockBajo] = useState(0)
  const [stockNegativo, setStockNegativo] = useState(0)

  const [programadosHoy, setProgramadosHoy] = useState(0)
  const [contabilizadosHoy, setContabilizadosHoy] = useState(0)

  const [registros, setRegistros] = useState<RegistroLite[]>([])
  const [clinicas, setClinicas] = useState<ClinicaLite[]>([])

  async function cargarDatos() {
    setCargando(true)

    const hoy = hoyISO()

    const [
      solicitudesRes,
      solicitudesPendientesRes,
      registrosRes,
      clinicasRes,
      stockRes,
    ] = await Promise.all([
      supabase.from("solicitudes").select("*", { count: "exact", head: true }),

      supabase
        .from("solicitudes")
        .select("*", { count: "exact", head: true })
        .eq("estado", "pendiente"),

      fetchAllRows<RegistroLite>(
  "registros",
  "id, clinica_id, especie, sexo, pagado, estado_clinica, estado_cita, fecha_programada, fecha_cirugia_realizada"
),

      supabase
        .from("clinicas")
        .select("id,nome,ativa")
        .order("nome", { ascending: true }),

      supabase
        .from("stock_almacen")
        .select("cantidad_actual, cantidad_minima"),
    ])

    setSolicitudesTotales(solicitudesRes.count || 0)
    setSolicitudesPendientes(solicitudesPendientesRes.count || 0)

    const registrosData = registrosRes as RegistroLite[]
    const clinicasData = (clinicasRes.data || []) as ClinicaLite[]

    setRegistros(registrosData)
    setClinicas(clinicasData)

    const clinicasActivasCount = clinicasData.filter((c) => c.ativa === true).length
    setClinicasActivas(clinicasActivasCount)

    const programados = registrosData.filter((r) => {
      const estado = normalizarEstado(r.estado_cita)
      return estado === "programado" || estado === "reprogramado"
    }).length

    const contabilizadas = registrosData.filter((r) => esContabilizado(r)).length

    const noShowTotal = registrosData.filter((r) => {
      const estado = normalizarEstado(r.estado_cita)
      const estadoClinica = normalizarEstado(r.estado_clinica)
      return estado === "no show" || estadoClinica === "no show"
    }).length

    const canceladosTotal = registrosData.filter((r) => {
      const estado = normalizarEstado(r.estado_cita)
      const estadoClinica = normalizarEstado(r.estado_clinica)

      return (
        estado === "cancelado" ||
        estado === "rechazado" ||
        estadoClinica === "rechazado" ||
        estadoClinica === "no apto"
      )
    }).length

    const programadosHoyCount = registrosData.filter((r) => {
      const estado = normalizarEstado(r.estado_cita)
      return r.fecha_programada === hoy && (estado === "programado" || estado === "reprogramado")
    }).length

    const contabilizadosHoyCount = registrosData.filter((r) => {
  return fechaBaseContabilizada(r) === hoy && esContabilizado(r)
}).length

    setRegistrosProgramados(programados)
    setCirugiasContabilizadas(contabilizadas)
    setNoShow(noShowTotal)
    setCancelados(canceladosTotal)
    setProgramadosHoy(programadosHoyCount)
    setContabilizadosHoy(contabilizadosHoyCount)

    const bajo = (stockRes.data || []).filter((item: any) => {
      return item.cantidad_actual >= 0 && item.cantidad_actual <= item.cantidad_minima
    }).length

    const negativo = (stockRes.data || []).filter((item: any) => {
      return item.cantidad_actual < 0
    }).length

    setStockBajo(bajo)
    setStockNegativo(negativo)

    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const mapaClinicas = useMemo(() => {
    const mapa: Record<string, string> = {}
    clinicas.forEach((c) => {
      mapa[c.id] = c.nome
    })
    return mapa
  }, [clinicas])

  const estadisticasMes = useMemo(() => {
  const inicioMes = inicioMesISO()

  const delMes = registros.filter((r) => {
    const fecha = fechaBaseContabilizada(r)
    return fecha >= inicioMes
  })

  const contabilizadosMes = delMes.filter((r) => esContabilizado(r)).length

  const noShowMes = delMes.filter((r) => {
    const estado = normalizarEstado(r.estado_cita)
    const estadoClinica = normalizarEstado(r.estado_clinica)
    return estado === "no show" || estadoClinica === "no show"
  }).length

  const canceladosMes = delMes.filter((r) => {
    const estado = normalizarEstado(r.estado_cita)
    const estadoClinica = normalizarEstado(r.estado_clinica)

    return (
      estado === "cancelado" ||
      estado === "rechazado" ||
      estadoClinica === "rechazado" ||
      estadoClinica === "no apto"
    )
  }).length

  const pendientesMes = delMes.filter((r) => {
    const estado = normalizarEstado(r.estado_cita)
    return estado === "programado" || estado === "reprogramado"
  }).length

  return {
    contabilizadosMes,
    noShowMes,
    canceladosMes,
    pendientesMes,
  }
}, [registros])

  const evolucionSemanal = useMemo(() => {
  const dias = ultimoNDiasISO(7)

  return dias.map((fecha) => {
    const total = registros.filter((r) => fechaBaseContabilizada(r) === fecha).length
    const contabilizados = registros.filter(
      (r) => fechaBaseContabilizada(r) === fecha && esContabilizado(r)
    ).length

    return {
      fecha,
      etiqueta: fecha.slice(5),
      total,
      contabilizados,
    }
  })
}, [registros])

  const maximoGrafico = useMemo(() => {
    if (!evolucionSemanal.length) return 1
    return Math.max(...evolucionSemanal.map((d) => d.contabilizados), 1)
  }, [evolucionSemanal])

  const rankingClinicas = useMemo(() => {
    const mapa: Record<
      string,
      { clinica: string; contabilizados: number; programados: number; noShow: number }
    > = {}

    registros.forEach((r) => {
  const clinica = r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica"

  if (!mapa[clinica]) {
    mapa[clinica] = {
      clinica,
      contabilizados: 0,
      programados: 0,
      noShow: 0,
    }
  }

  const estado = normalizarEstado(r.estado_cita)
  const estadoClinica = normalizarEstado(r.estado_clinica)

  if (esContabilizado(r)) mapa[clinica].contabilizados += 1
  if (estado === "programado" || estado === "reprogramado") mapa[clinica].programados += 1
  if (estado === "no show" || estadoClinica === "no show") mapa[clinica].noShow += 1
})

    return Object.values(mapa)
      .filter((c) => c.clinica !== "Sin clínica")
      .sort((a, b) => b.contabilizados - a.contabilizados)
      .slice(0, 5)
  }, [registros, mapaClinicas])

  const hoyPorClinica = useMemo(() => {
    const hoy = hoyISO()

    const mapa: Record<
      string,
      { clinica: string; programados: number; contabilizados: number }
    > = {}

    registros
  .filter((r) => fechaBaseContabilizada(r) === hoy || r.fecha_programada === hoy)
      .forEach((r) => {
        const clinica = r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica"

        if (!mapa[clinica]) {
          mapa[clinica] = {
            clinica,
            programados: 0,
            contabilizados: 0,
          }
        }

        const estado = normalizarEstado(r.estado_cita)

        if (estado === "programado" || estado === "reprogramado") {
          mapa[clinica].programados += 1
        }

        if (esContabilizado(r)) {
          mapa[clinica].contabilizados += 1
        }
      })

    return Object.values(mapa)
      .filter((c) => c.clinica !== "Sin clínica")
      .sort((a, b) => b.programados - a.programados)
  }, [registros, mapaClinicas])

  const alertas = useMemo(() => {
    const items: { texto: string; color: string; href: string }[] = []

    if (solicitudesPendientes > 0) {
      items.push({
        texto: `${solicitudesPendientes} solicitudes pendientes`,
        color: "bg-yellow-100 text-yellow-800",
        href: "/admin/solicitudes",
      })
    }

    if (programadosHoy > 0) {
      items.push({
        texto: `${programadosHoy} programados hoy`,
        color: "bg-blue-100 text-blue-800",
        href: "/admin/citas",
      })
    }

    if (noShow > 0) {
      items.push({
        texto: `${noShow} no show acumulados`,
        color: "bg-gray-200 text-gray-800",
        href: "/admin/registros",
      })
    }

    if (stockBajo > 0) {
      items.push({
        texto: `${stockBajo} insumos con stock bajo`,
        color: "bg-orange-100 text-orange-700",
        href: "/admin/informes/inventario",
      })
    }

    if (stockNegativo > 0) {
      items.push({
        texto: `${stockNegativo} movimientos con stock negativo`,
        color: "bg-red-100 text-red-700",
        href: "/admin/informes/inventario",
      })
    }

    return items
  }, [solicitudesPendientes, programadosHoy, noShow, stockBajo, stockNegativo])

  function cardClassBySeverity(type: "neutral" | "good" | "warn" | "danger" | "info") {
    switch (type) {
      case "good":
        return "border-l-4 border-green-500"
      case "warn":
        return "border-l-4 border-yellow-500"
      case "danger":
        return "border-l-4 border-red-500"
      case "info":
        return "border-l-4 border-blue-500"
      default:
        return "border-l-4 border-[#0F6D6A]"
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando informes...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Informes
            </h1>
            <p className="text-white/80">
              Centro de control operativo, financiero e institucional de la fundación
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={cargarDatos}
              className="bg-[#F47C2A] text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90 transition"
            >
              Actualizar panel
            </button>

            <Link
              href="/admin"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver al Admin
            </Link>
          </div>
        </div>

        <div className="bg-[#EAF7F6] border border-white/20 rounded-2xl shadow-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0F6D6A]">
                Alertas rápidas
              </h2>
              <p className="text-sm text-gray-600">
                Lo más importante para revisar ahora mismo
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {alertas.length > 0 ? (
                alertas.map((alerta, index) => (
                  <Link
                    key={index}
                    href={alerta.href}
                    className={`${alerta.color} px-3 py-2 rounded-full text-sm font-semibold hover:scale-[1.02] transition`}
                  >
                    {alerta.texto}
                  </Link>
                ))
              ) : (
                <span className="bg-green-100 text-green-700 px-3 py-2 rounded-full text-sm font-semibold">
                  Todo en orden
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-white text-xl font-bold mb-4">Hoy</h2>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(programadosHoy > 0 ? "info" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Programados hoy</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{programadosHoy}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(contabilizadosHoy > 0 ? "good" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Contabilizados hoy</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{contabilizadosHoy}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(solicitudesPendientes > 0 ? "warn" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Solicitudes pendientes</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{solicitudesPendientes}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(stockNegativo > 0 ? "danger" : "warn")}`}>
              <p className="text-sm text-gray-500 font-semibold">Stock negativo</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stockNegativo}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-white text-xl font-bold mb-4">Este mes</h2>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity("good")}`}>
              <p className="text-sm text-gray-500 font-semibold">Procedimientos contabilizados</p>
              <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{estadisticasMes.contabilizadosMes}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(estadisticasMes.pendientesMes > 0 ? "warn" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Pendientes del mes</p>
              <p className="text-3xl font-bold text-red-500 mt-2">{estadisticasMes.pendientesMes}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(noShow > 20 ? "danger" : "warn")}`}>
              <p className="text-sm text-gray-500 font-semibold">No Show</p>
              <p className="text-3xl font-bold text-gray-700 mt-2">{estadisticasMes.noShowMes}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(estadisticasMes.canceladosMes > 0 ? "warn" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Rechazadas / no aptas</p>
              <p className="text-3xl font-bold text-orange-500 mt-2">{estadisticasMes.canceladosMes}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-white text-xl font-bold mb-4">Resumen general</h2>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl shadow-xl p-5 border-l-4 border-[#0F6D6A]">
              <p className="text-sm text-gray-500 font-semibold">Solicitudes totales</p>
              <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{solicitudesTotales}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-5 border-l-4 border-blue-500">
              <p className="text-sm text-gray-500 font-semibold">Registros programados</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{registrosProgramados}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-5 border-l-4 border-green-500">
              <p className="text-sm text-gray-500 font-semibold">Cirugías contabilizadas</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{cirugiasContabilizadas}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-5 border-l-4 border-[#0F6D6A]">
              <p className="text-sm text-gray-500 font-semibold">Clínicas activas</p>
              <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{clinicasActivas}</p>
            </div>

            <div className={`bg-white rounded-2xl shadow-xl p-5 ${cardClassBySeverity(stockBajo > 0 ? "warn" : "neutral")}`}>
              <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
              <p className="text-3xl font-bold text-orange-500 mt-2">{stockBajo}</p>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F6D6A]">
                Evolución semanal
              </h2>
              <Link
                href="/admin/informes/gestion"
                className="text-sm bg-[#0F6D6A] text-white px-3 py-2 rounded-lg"
              >
                Ver gestión
              </Link>
            </div>

            <div className="space-y-3">
              {evolucionSemanal.map((item, index) => {
                const largura = `${(item.contabilizados / maximoGrafico) * 100}%`
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">{item.etiqueta}</span>
                      <span className="text-gray-600">
                        {item.total} total / {item.contabilizados} contabilizados
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-[#F47C2A] h-4 rounded-full"
                        style={{ width: largura }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F6D6A]">
                Ranking de clínicas
              </h2>
              <Link
                href="/admin/informes/contabilidad"
                className="text-sm bg-[#0F6D6A] text-white px-3 py-2 rounded-lg"
              >
                Ver contabilidad
              </Link>
            </div>

            <div className="space-y-3">
              {rankingClinicas.length > 0 ? (
                rankingClinicas.map((item, index) => (
                  <div
                    key={index}
                    className="border rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-[#0F6D6A]">
                        #{index + 1} {item.clinica}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Programados: {item.programados} • No Show: {item.noShow}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">Contabilizados</p>
                      <p className="text-2xl font-bold text-green-600">{item.contabilizados}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No hay datos para mostrar.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <h2 className="text-xl font-bold text-[#0F6D6A]">
              Hoy por clínica
            </h2>
            <Link
              href="/admin/citas"
              className="text-sm bg-[#0F6D6A] text-white px-3 py-2 rounded-lg"
            >
              Ver citas
            </Link>
          </div>

          {hoyPorClinica.length > 0 ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {hoyPorClinica.map((item, index) => (
                <div key={index} className="border rounded-2xl p-4">
                  <p className="font-bold text-[#0F6D6A] text-lg">{item.clinica}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Programados hoy</p>
                      <p className="text-2xl font-bold text-blue-600">{item.programados}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Contabilizados hoy</p>
                      <p className="text-2xl font-bold text-green-600">{item.contabilizados}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No hay actividad cargada para hoy por clínica.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">
            Accesos rápidos
          </h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Link
              href="/admin/informes/gestion"
              className="bg-[#0F6D6A] text-white rounded-2xl p-5 shadow hover:scale-[1.01] transition"
            >
              <p className="text-lg font-bold">📋 Gestión de cirugías</p>
              <p className="text-white/80 text-sm mt-2">
                Ver programadas, realizadas, canceladas, reprogramadas y métricas operativas.
              </p>
            </Link>

            <Link
              href="/admin/informes/inventario"
              className="bg-[#0F6D6A] text-white rounded-2xl p-5 shadow hover:scale-[1.01] transition"
            >
              <p className="text-lg font-bold">📦 Inventario</p>
              <p className="text-white/80 text-sm mt-2">
                Supervisar stock bajo, stock negativo y estado general de insumos.
              </p>
            </Link>

            <Link
              href="/admin/informes/detallados"
              className="bg-[#0F6D6A] text-white rounded-2xl p-5 shadow hover:scale-[1.01] transition"
            >
              <p className="text-lg font-bold">🧾 Informes detallados</p>
              <p className="text-white/80 text-sm mt-2">
                Consultar reportes ampliados y revisión más fina de registros y movimientos.
              </p>
            </Link>

            <Link
              href="/admin/informes/contabilidad"
              className="bg-[#0F6D6A] text-white rounded-2xl p-5 shadow hover:scale-[1.01] transition"
            >
              <p className="text-lg font-bold">📊 Contabilidad</p>
              <p className="text-white/80 text-sm mt-2">
                Revisar procedimientos contabilizados, pendientes, pagos y exportaciones Excel.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}