"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Pedido = {
  id: string
  clinica_id: string | null
  fecha_solicitada: string | null
  estado: string | null
  delivery_estado: string | null
  delivery_fecha: string | null
  fecha_entregado?: string | null
  created_at: string
  observaciones?: string | null
  transferencia_id?: string | null
}

type ItemPedido = {
  id: string
  pedido_id: string
  producto_id: string
  producto_nombre: string
  cantidad_solicitada: number
  unidad_solicitada: string | null
}

type Clinica = {
  id: string
  nome: string | null
  zona?: string | null
}

type TarifaDelivery = {
  id: string
  clinica_id: string
  valor: number | string | null
  activo?: boolean | null
}

type DeliveryMovimiento = {
  id: string
  clinica_id: string | null
  pedido_id: string | null
  tipo: string
  fecha_movimiento: string
  cantidad: number
  valor_unitario: number | string | null
  monto_total: number | string | null
  descripcion?: string | null
  observacion?: string | null
  pagado?: boolean | null
  fecha_pago?: string | null
  activo?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

type FiltroPeriodo = "hoy" | "semana" | "mes"

function formatFecha(fecha?: string | null) {
  if (!fecha) return "-"
  const [year, month, day] = fecha.split("-")
  if (!year || !month || !day) return fecha
  return `${day}/${month}/${year}`
}

function formatFechaHora(fecha?: string | null) {
  if (!fecha) return "-"
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString("es-BO")
}

function normalizarEstado(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

function colorEstadoDelivery(estado?: string | null) {
  const e = normalizarEstado(estado)

  if (e === "en_ruta") return "bg-blue-100 text-blue-700"
  if (e === "entregado") return "bg-emerald-100 text-emerald-700"

  return "bg-amber-100 text-amber-700"
}

function labelEstadoDelivery(estado?: string | null) {
  const e = normalizarEstado(estado)

  if (e === "en_ruta") return "En ruta"
  if (e === "entregado") return "Entregado"

  return "Pendiente"
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatearMoneda(valor: unknown) {
  return `Bs ${toNumber(valor).toFixed(2)}`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function estaDentroDelPeriodo(fecha?: string | null, periodo: FiltroPeriodo = "mes") {
  if (!fecha) return false

  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return false

  const inicio =
    periodo === "hoy"
      ? startOfToday()
      : periodo === "semana"
      ? startOfWeek()
      : startOfMonth()

  return d >= inicio
}

function fechaEntregaPrincipal(pedido: Pedido) {
  return pedido.fecha_entregado || pedido.delivery_fecha || null
}

export default function DeliveryPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [items, setItems] = useState<ItemPedido[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [tarifasDelivery, setTarifasDelivery] = useState<TarifaDelivery[]>([])
  const [movimientosDelivery, setMovimientosDelivery] = useState<DeliveryMovimiento[]>([])

  const [filtroIngresos, setFiltroIngresos] = useState<FiltroPeriodo>("mes")
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null)

  useEffect(() => {
    const user = localStorage.getItem("delivery_user")
    const time = localStorage.getItem("delivery_login_time")

    if (!user || !time) {
      router.push("/delivery/login")
      return
    }

    const now = Date.now()
    const limite = 6 * 60 * 60 * 1000

    if (now - Number(time) > limite) {
      localStorage.removeItem("delivery_user")
      localStorage.removeItem("delivery_login_time")
      router.push("/delivery/login")
      return
    }

    cargarDatos()
  }, [router])

  async function cargarDatos() {
    setLoading(true)

    const [pedidosRes, itemsRes, clinicasRes, tarifasRes, movimientosRes] =
      await Promise.all([
        supabase
          .from("pedidos_clinicas")
          .select(`
            id,
            clinica_id,
            fecha_solicitada,
            estado,
            delivery_estado,
            delivery_fecha,
            fecha_entregado,
            created_at,
            observaciones,
            transferencia_id
          `)
          .in("estado", ["aprobado", "convertido", "entregado"])
          .order("fecha_solicitada", { ascending: true })
          .order("created_at", { ascending: false }),

        supabase
          .from("pedidos_clinicas_items")
          .select(`
            id,
            pedido_id,
            producto_id,
            producto_nombre,
            cantidad_solicitada,
            unidad_solicitada
          `)
          .order("created_at", { ascending: true }),

        supabase.from("clinicas").select("id,nome,zona"),

        supabase
          .from("tarifas_delivery")
          .select("id,clinica_id,valor,activo")
          .eq("activo", true),

        supabase
          .from("delivery_movimientos")
          .select(`
            id,
            clinica_id,
            pedido_id,
            tipo,
            fecha_movimiento,
            cantidad,
            valor_unitario,
            monto_total,
            descripcion,
            observacion,
            pagado,
            fecha_pago,
            activo,
            created_at,
            updated_at
          `)
          .eq("activo", true)
          .order("fecha_movimiento", { ascending: false })
          .order("created_at", { ascending: false }),
      ])

    if (pedidosRes.error) {
      console.log("Error cargando pedidos delivery:", pedidosRes.error)
    }

    if (itemsRes.error) {
      console.log("Error cargando items delivery:", itemsRes.error)
    }

    if (clinicasRes.error) {
      console.log("Error cargando clínicas delivery:", clinicasRes.error)
    }

    if (tarifasRes.error) {
      console.log("Tarifas delivery no disponibles todavía:", tarifasRes.error)
    }

    if (movimientosRes.error) {
      console.log("Error cargando movimientos delivery:", movimientosRes.error)
    }

    setPedidos((pedidosRes.data as Pedido[]) || [])
    setItems((itemsRes.data as ItemPedido[]) || [])
    setClinicas((clinicasRes.data as Clinica[]) || [])
    setTarifasDelivery((tarifasRes.data as TarifaDelivery[]) || [])
    setMovimientosDelivery((movimientosRes.data as DeliveryMovimiento[]) || [])
    setLoading(false)
  }

  const mapaClinicas = useMemo(() => {
    const map = new Map<string, Clinica>()
    clinicas.forEach((clinica) => {
      map.set(clinica.id, clinica)
    })
    return map
  }, [clinicas])

  const mapaTarifas = useMemo(() => {
    const map = new Map<string, number>()
    tarifasDelivery.forEach((tarifa) => {
      map.set(tarifa.clinica_id, toNumber(tarifa.valor))
    })
    return map
  }, [tarifasDelivery])

  const movimientosActivos = useMemo(() => {
    return movimientosDelivery.filter((mov) => mov.activo !== false)
  }, [movimientosDelivery])

  const movimientosPorPedidoAutomatico = useMemo(() => {
    const map = new Map<string, DeliveryMovimiento>()

    movimientosActivos.forEach((mov) => {
      if (mov.pedido_id && normalizarEstado(mov.tipo) === "automatico" && !map.has(mov.pedido_id)) {
        map.set(mov.pedido_id, mov)
      }
    })

    return map
  }, [movimientosActivos])

  const pedidosConDatos = useMemo(() => {
    return pedidos.map((pedido) => {
      const clinica = pedido.clinica_id ? mapaClinicas.get(pedido.clinica_id) : null
      const itemsPedido = items.filter((item) => item.pedido_id === pedido.id)

      const movimientoAutomatico = movimientosPorPedidoAutomatico.get(pedido.id)
      const valorTarifa = pedido.clinica_id ? mapaTarifas.get(pedido.clinica_id) || 0 : 0

      const valorDelivery =
        movimientoAutomatico
          ? toNumber(movimientoAutomatico.monto_total)
          : normalizarEstado(pedido.delivery_estado) === "entregado"
          ? valorTarifa
          : valorTarifa

      const valorGanado =
        normalizarEstado(pedido.delivery_estado) === "entregado"
          ? valorDelivery
          : 0

      return {
        ...pedido,
        clinicaNombre: clinica?.nome || "Clínica",
        clinicaZona: clinica?.zona || null,
        items: itemsPedido,
        cantidadItems: itemsPedido.length,
        valorDelivery,
        valorGanado,
        entregaPrincipal: fechaEntregaPrincipal(pedido),
        movimientoAutomatico,
      }
    })
  }, [pedidos, items, mapaClinicas, movimientosPorPedidoAutomatico, mapaTarifas])

  const resumenOperativo = useMemo(() => {
    const total = pedidosConDatos.length
    const enRuta = pedidosConDatos.filter(
      (p) => normalizarEstado(p.delivery_estado) === "en_ruta"
    ).length
    const entregados = pedidosConDatos.filter(
      (p) => normalizarEstado(p.delivery_estado) === "entregado"
    ).length
    const pendientes = total - enRuta - entregados

    return {
      total,
      pendientes,
      enRuta,
      entregados,
    }
  }, [pedidosConDatos])

  const resumenFinanciero = useMemo(() => {
  const pedidosEntregadosPeriodo = pedidosConDatos.filter(
    (pedido) =>
      normalizarEstado(pedido.delivery_estado) === "entregado" &&
      estaDentroDelPeriodo(pedido.entregaPrincipal || pedido.fecha_solicitada, filtroIngresos)
  )

  const pedidosEntregadosHoy = pedidosConDatos.filter(
    (pedido) =>
      normalizarEstado(pedido.delivery_estado) === "entregado" &&
      estaDentroDelPeriodo(pedido.entregaPrincipal || pedido.fecha_solicitada, "hoy")
  )

  const pedidosEntregadosSemana = pedidosConDatos.filter(
    (pedido) =>
      normalizarEstado(pedido.delivery_estado) === "entregado" &&
      estaDentroDelPeriodo(pedido.entregaPrincipal || pedido.fecha_solicitada, "semana")
  )

  const pedidosEntregadosMes = pedidosConDatos.filter(
    (pedido) =>
      normalizarEstado(pedido.delivery_estado) === "entregado" &&
      estaDentroDelPeriodo(pedido.entregaPrincipal || pedido.fecha_solicitada, "mes")
  )

  const movimientosAdminPeriodo = movimientosActivos.filter(
    (mov) =>
      ["manual", "ajuste_positivo", "ajuste_negativo"].includes(normalizarEstado(mov.tipo)) &&
      estaDentroDelPeriodo(mov.fecha_movimiento, filtroIngresos)
  )

  const movimientosAdminHoy = movimientosActivos.filter(
    (mov) =>
      ["manual", "ajuste_positivo", "ajuste_negativo"].includes(normalizarEstado(mov.tipo)) &&
      estaDentroDelPeriodo(mov.fecha_movimiento, "hoy")
  )

  const movimientosAdminSemana = movimientosActivos.filter(
    (mov) =>
      ["manual", "ajuste_positivo", "ajuste_negativo"].includes(normalizarEstado(mov.tipo)) &&
      estaDentroDelPeriodo(mov.fecha_movimiento, "semana")
  )

  const movimientosAdminMes = movimientosActivos.filter(
    (mov) =>
      ["manual", "ajuste_positivo", "ajuste_negativo"].includes(normalizarEstado(mov.tipo)) &&
      estaDentroDelPeriodo(mov.fecha_movimiento, "mes")
  )

  const totalPedidosPeriodo = pedidosEntregadosPeriodo.reduce(
    (acc, pedido) => acc + toNumber(pedido.valorDelivery),
    0
  )

  const totalPedidosHoy = pedidosEntregadosHoy.reduce(
    (acc, pedido) => acc + toNumber(pedido.valorDelivery),
    0
  )

  const totalPedidosSemana = pedidosEntregadosSemana.reduce(
    (acc, pedido) => acc + toNumber(pedido.valorDelivery),
    0
  )

  const totalPedidosMes = pedidosEntregadosMes.reduce(
    (acc, pedido) => acc + toNumber(pedido.valorDelivery),
    0
  )

  const totalAdminPeriodo = movimientosAdminPeriodo.reduce(
    (acc, mov) => acc + toNumber(mov.monto_total),
    0
  )

  const totalAdminHoy = movimientosAdminHoy.reduce(
    (acc, mov) => acc + toNumber(mov.monto_total),
    0
  )

  const totalAdminSemana = movimientosAdminSemana.reduce(
    (acc, mov) => acc + toNumber(mov.monto_total),
    0
  )

  const totalAdminMes = movimientosAdminMes.reduce(
    (acc, mov) => acc + toNumber(mov.monto_total),
    0
  )

  const porClinicaMap = new Map<
    string,
    { clinica_id: string; clinica: string; entregas: number; total: number }
  >()

  pedidosEntregadosPeriodo.forEach((pedido) => {
    const clinicaId = pedido.clinica_id || "sin_clinica"
    const clinicaNombre = pedido.clinicaNombre || "Clínica"

    const actual = porClinicaMap.get(clinicaId) || {
      clinica_id: clinicaId,
      clinica: clinicaNombre,
      entregas: 0,
      total: 0,
    }

    actual.entregas += 1
    actual.total += toNumber(pedido.valorDelivery)

    porClinicaMap.set(clinicaId, actual)
  })

  movimientosAdminPeriodo.forEach((mov) => {
    const clinicaId = mov.clinica_id || "sin_clinica"
    const clinicaNombre =
      (mov.clinica_id ? mapaClinicas.get(mov.clinica_id)?.nome : null) || "Clínica"

    const actual = porClinicaMap.get(clinicaId) || {
      clinica_id: clinicaId,
      clinica: clinicaNombre,
      entregas: 0,
      total: 0,
    }

    actual.entregas += toNumber(mov.cantidad)
    actual.total += toNumber(mov.monto_total)

    porClinicaMap.set(clinicaId, actual)
  })

  const porClinica = Array.from(porClinicaMap.values()).sort((a, b) => b.total - a.total)

  return {
    totalPeriodo: totalPedidosPeriodo + totalAdminPeriodo,
    totalHoy: totalPedidosHoy + totalAdminHoy,
    totalSemana: totalPedidosSemana + totalAdminSemana,
    totalMes: totalPedidosMes + totalAdminMes,

    carrerasPeriodo:
      pedidosEntregadosPeriodo.length +
      movimientosAdminPeriodo.reduce((acc, mov) => acc + toNumber(mov.cantidad), 0),

    carrerasHoy:
      pedidosEntregadosHoy.length +
      movimientosAdminHoy.reduce((acc, mov) => acc + toNumber(mov.cantidad), 0),

    carrerasSemana:
      pedidosEntregadosSemana.length +
      movimientosAdminSemana.reduce((acc, mov) => acc + toNumber(mov.cantidad), 0),

    carrerasMes:
      pedidosEntregadosMes.length +
      movimientosAdminMes.reduce((acc, mov) => acc + toNumber(mov.cantidad), 0),

    totalPedidosPeriodo,
    totalAdminPeriodo,
    totalPedidosHoy,
    totalAdminHoy,
    totalPedidosSemana,
    totalAdminSemana,
    totalPedidosMes,
    totalAdminMes,

    porClinica,
  }
}, [pedidosConDatos, movimientosActivos, filtroIngresos, mapaClinicas])

  async function cambiarEstado(
    pedidoId: string,
    nuevoEstado: "en_ruta" | "entregado"
  ) {
    setActualizandoId(pedidoId)

    const ahora = new Date().toISOString()

    const payload =
      nuevoEstado === "entregado"
        ? {
            estado: "entregado",
            delivery_estado: "entregado",
            delivery_fecha: ahora,
            fecha_entregado: ahora,
          }
        : {
            delivery_estado: "en_ruta",
          }

    const { error } = await supabase
      .from("pedidos_clinicas")
      .update(payload)
      .eq("id", pedidoId)

    if (error) {
      console.log("Error actualizando estado delivery:", error)
      alert("No se pudo actualizar el estado del pedido")
      setActualizandoId(null)
      return
    }

    await cargarDatos()
    setActualizandoId(null)
  }

  function cerrarSesion() {
    localStorage.removeItem("delivery_user")
    localStorage.removeItem("delivery_login_time")
    router.push("/delivery/login")
  }

  function toggleExpandirPedido(pedidoId: string) {
    setPedidoExpandido((actual) => (actual === pedidoId ? null : pedidoId))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-lg font-semibold">
        Cargando pedidos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-4 md:p-6 xl:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-6 md:px-8 md:py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-sm font-semibold mb-3">
                <span>🚚 Delivery</span>
                <span className="opacity-70">/</span>
                <span>Panel</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Panel Delivery
              </h1>
              <p className="text-white/80 mt-2 max-w-3xl">
                Revise los pedidos listos para entrega, vea a qué clínica van,
                actualice el estado del trayecto y controle sus ingresos.
              </p>
            </div>

            <button
              type="button"
              onClick={cerrarSesion}
              className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-[24px] p-5 shadow-xl">
            <p className="text-sm text-gray-500 font-semibold">Pedidos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumenOperativo.total}
            </p>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xl">
            <p className="text-sm text-gray-500 font-semibold">Pendientes</p>
            <p className="text-3xl font-bold text-amber-600 mt-2">
              {resumenOperativo.pendientes}
            </p>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xl">
            <p className="text-sm text-gray-500 font-semibold">En ruta</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {resumenOperativo.enRuta}
            </p>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-xl">
            <p className="text-sm text-gray-500 font-semibold">Entregados</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {resumenOperativo.entregados}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#0F6D6A]/10 text-[#0F6D6A] px-3 py-1 rounded-full text-sm font-semibold mb-3">
                💰 Mis ingresos
              </div>

              <h2 className="text-2xl md:text-3xl font-bold text-[#0F6D6A]">
                Resumen financiero del delivery
              </h2>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Aquí puede ver cuánto ya realizó y cuánto lleva acumulado según
                los movimientos financieros registrados en el sistema.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroIngresos("hoy")}
                className={`px-4 py-2 rounded-2xl font-bold transition ${
                  filtroIngresos === "hoy"
                    ? "bg-[#0F6D6A] text-white shadow"
                    : "bg-[#F5FAFA] text-[#0F6D6A] border border-[#DDEEEE]"
                }`}
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setFiltroIngresos("semana")}
                className={`px-4 py-2 rounded-2xl font-bold transition ${
                  filtroIngresos === "semana"
                    ? "bg-[#0F6D6A] text-white shadow"
                    : "bg-[#F5FAFA] text-[#0F6D6A] border border-[#DDEEEE]"
                }`}
              >
                Semana
              </button>

              <button
                type="button"
                onClick={() => setFiltroIngresos("mes")}
                className={`px-4 py-2 rounded-2xl font-bold transition ${
                  filtroIngresos === "mes"
                    ? "bg-[#0F6D6A] text-white shadow"
                    : "bg-[#F5FAFA] text-[#0F6D6A] border border-[#DDEEEE]"
                }`}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
            <div className="rounded-[24px] border border-[#DDEEEE] bg-[#F7FBFB] p-5">
              <p className="text-sm text-gray-500 font-semibold">
                Ganado en el período
              </p>
              <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
                {formatearMoneda(resumenFinanciero.totalPeriodo)}
              </p>
            </div>

            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700 font-semibold">
                Carreras del período
              </p>
              <p className="text-3xl font-bold text-emerald-700 mt-2">
                {filtroIngresos === "hoy"
                  ? resumenFinanciero.carrerasHoy
                  : filtroIngresos === "semana"
                  ? resumenFinanciero.carrerasSemana
                  : resumenFinanciero.carrerasMes}
              </p>
            </div>

            <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm text-blue-700 font-semibold">Ganado hoy</p>
              <p className="text-3xl font-bold text-blue-700 mt-2">
                {formatearMoneda(resumenFinanciero.totalHoy)}
              </p>
            </div>

            <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5">
              <p className="text-sm text-amber-700 font-semibold">Ganado este mes</p>
              <p className="text-3xl font-bold text-amber-700 mt-2">
                {formatearMoneda(resumenFinanciero.totalMes)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="rounded-[24px] border border-[#E7F1F1] bg-white p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-[#0F6D6A]">
                  Ingresos por clínica
                </h3>
                <span className="text-xs text-gray-500">
                  {resumenFinanciero.porClinica.length} clínicas
                </span>
              </div>

              {resumenFinanciero.porClinica.length === 0 ? (
                <div className="rounded-2xl bg-[#F8FAFA] border border-[#E7F1F1] p-4 text-sm text-gray-500">
                  Aún no hay movimientos registrados en este período.
                </div>
              ) : (
                <div className="space-y-3">
                  {resumenFinanciero.porClinica.map((item) => (
                    <div
                      key={item.clinica_id}
                      className="rounded-2xl border border-[#EDF3F3] p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{item.clinica}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {item.entregas} carrera{item.entregas === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-[#0F6D6A] mt-1">
                          {formatearMoneda(item.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[#E7F1F1] bg-[#F8FAFA] p-5">
              <h3 className="text-lg font-bold text-[#0F6D6A] mb-4">
                Resumen rápido
              </h3>

              <div className="space-y-3">
                <div className="rounded-2xl bg-white border border-[#E7F1F1] p-4">
                  <p className="text-xs text-gray-500">Hoy</p>
                  <p className="text-xl font-bold text-[#0F6D6A] mt-1">
                    {formatearMoneda(resumenFinanciero.totalHoy)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white border border-[#E7F1F1] p-4">
                  <p className="text-xs text-gray-500">Esta semana</p>
                  <p className="text-xl font-bold text-[#0F6D6A] mt-1">
                    {formatearMoneda(resumenFinanciero.totalSemana)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white border border-[#E7F1F1] p-4">
                  <p className="text-xs text-gray-500">Este mes</p>
                  <p className="text-xl font-bold text-[#0F6D6A] mt-1">
                    {formatearMoneda(resumenFinanciero.totalMes)}
                  </p>
                </div>
              </div>

              {!tarifasDelivery.length && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Aún no se encontraron tarifas de delivery activas. La parte
                  operativa funciona normal, pero revise las tarifas en contabilidad.
                </div>
              )}
            </div>
          </div>
        </div>

        {pedidosConDatos.length === 0 ? (
          <div className="bg-white rounded-[28px] shadow-2xl p-10 text-center">
            <div className="text-2xl font-bold text-gray-700">
              No hay pedidos para delivery
            </div>
            <p className="text-gray-500 mt-2">
              Cuando existan pedidos aprobados o convertidos, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidosConDatos.map((pedido) => {
              const expandido = pedidoExpandido === pedido.id
              const estadoActual = normalizarEstado(pedido.delivery_estado)

              return (
                <div
                  key={pedido.id}
                  className="bg-white rounded-[28px] p-5 md:p-6 shadow-2xl border border-white/70"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-bold text-[#0F6D6A]">
                          {pedido.clinicaNombre}
                        </h2>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${colorEstadoDelivery(
                            pedido.delivery_estado
                          )}`}
                        >
                          {labelEstadoDelivery(pedido.delivery_estado)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>Pedido #{pedido.id.slice(0, 8).toUpperCase()}</span>
                        {pedido.clinicaZona && <span>Zona: {pedido.clinicaZona}</span>}
                        <span>{pedido.cantidadItems} ítems</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:min-w-[620px]">
                      <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-4">
                        <p className="text-xs text-gray-500">Entrega</p>
                        <p className="font-bold text-[#0F6D6A] mt-1">
                          {formatFecha(pedido.fecha_solicitada)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                        <p className="text-xs text-gray-500">Entregado</p>
                        <p className="font-bold text-gray-800 mt-1 text-sm">
                          {pedido.entregaPrincipal
                            ? formatFechaHora(pedido.entregaPrincipal)
                            : "-"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                        <p className="text-xs text-emerald-700">Valor entrega</p>
                        <p className="font-bold text-emerald-700 mt-1">
                          {formatearMoneda(pedido.valorDelivery)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                        <p className="text-xs text-blue-700">Ganado</p>
                        <p className="font-bold text-blue-700 mt-1">
                          {formatearMoneda(pedido.valorGanado)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpandirPedido(pedido.id)}
                      className="bg-[#0F6D6A] hover:opacity-95 text-white px-5 py-3 rounded-2xl font-bold transition"
                    >
                      {expandido ? "Ocultar detalle" : "Ver detalle"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        actualizandoId === pedido.id || estadoActual === "entregado"
                      }
                      onClick={() => cambiarEstado(pedido.id, "en_ruta")}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-3 rounded-2xl font-bold transition"
                    >
                      {actualizandoId === pedido.id && estadoActual !== "entregado"
                        ? "Actualizando..."
                        : "En ruta"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        actualizandoId === pedido.id || estadoActual === "entregado"
                      }
                      onClick={() => cambiarEstado(pedido.id, "entregado")}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-3 rounded-2xl font-bold transition"
                    >
                      {actualizandoId === pedido.id && estadoActual === "entregado"
                        ? "Actualizando..."
                        : "Entregado"}
                    </button>
                  </div>

                  {expandido && (
                    <div className="mt-5 space-y-5">
                      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="rounded-2xl bg-white border border-[#E8F0F0] p-4">
                          <p className="text-xs text-gray-500">Estado sistema</p>
                          <p className="font-bold text-gray-900 mt-1">
                            {pedido.estado || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-[#E8F0F0] p-4">
                          <p className="text-xs text-gray-500">Estado delivery</p>
                          <p className="font-bold text-gray-900 mt-1">
                            {labelEstadoDelivery(pedido.delivery_estado)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-[#E8F0F0] p-4">
                          <p className="text-xs text-gray-500">Creado</p>
                          <p className="font-bold text-gray-900 mt-1">
                            {formatFechaHora(pedido.created_at)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-[#E8F0F0] p-4">
                          <p className="text-xs text-gray-500">Transferencia</p>
                          <p className="font-bold text-gray-900 mt-1 break-all">
                            {pedido.transferencia_id
                              ? `#${pedido.transferencia_id.slice(0, 8).toUpperCase()}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {pedido.observaciones && (
                        <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4">
                          <p className="text-sm font-semibold text-[#0F6D6A]">
                            Observaciones
                          </p>
                          <p className="text-sm text-gray-700 mt-2">
                            {pedido.observaciones}
                          </p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h3 className="text-lg font-bold text-[#0F6D6A]">
                            Productos
                          </h3>
                          <span className="text-xs text-gray-500">
                            {pedido.items.length} ítems
                          </span>
                        </div>

                        <div className="space-y-3">
                          {pedido.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900">
                                  {item.producto_nombre}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 break-all">
                                  Producto #{item.producto_id.slice(0, 8).toUpperCase()}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs text-gray-500">Cantidad</p>
                                <p className="font-bold text-[#0F6D6A] mt-1">
                                  {item.cantidad_solicitada}{" "}
                                  {item.unidad_solicitada || ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {!!pedido.movimientoAutomatico && (
                        <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-4">
                          <p className="text-sm font-semibold text-[#0F6D6A]">
                            Movimiento financiero vinculado
                          </p>
                          <div className="mt-3 grid md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Fecha</p>
                              <p className="font-bold text-gray-900">
                                {formatFecha(pedido.movimientoAutomatico.fecha_movimiento)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Tipo</p>
                              <p className="font-bold text-gray-900">
                                {pedido.movimientoAutomatico.tipo}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Monto</p>
                              <p className="font-bold text-gray-900">
                                {formatearMoneda(pedido.movimientoAutomatico.monto_total)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Pago</p>
                              <p className="font-bold text-gray-900">
                                {pedido.movimientoAutomatico.pagado ? "Pagado" : "Pendiente"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
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