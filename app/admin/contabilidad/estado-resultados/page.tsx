"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { supabase } from "@/lib/supabase"

type DonacionNatural = {
  id: string
  fecha: string
  anio: number
  mes: number
  monto_total: number
}

type DonacionJuridica = {
  id: string
  fecha: string
  empresa: string
  tipo_aporte: "dinero" | "especie"
  monto_total: number
}

type GastoOperativo = {
  id: string
  fecha: string
  categoria: string
  monto: number
}

type EntradaContable = {
  id: string
  tipo_origen: "compra" | "donacion" | "ajuste" | "devolucion" | null
  costo_total: number | null
  fecha_compra: string | null
  created_at: string
}

type DeliveryMovimiento = {
  id: string
  fecha_movimiento: string
  tipo: string
  monto_total: number | null
  activo: boolean | null
}

type PedidoDelivery = {
  id: string
  clinica_id: string | null
  fecha_solicitada: string | null
  delivery_estado: string | null
  delivery_fecha: string | null
  fecha_entregado: string | null
  estado?: string | null
}

type TarifaDelivery = {
  id: string
  clinica_id: string
  valor: number | string | null
  activo: boolean | null
}

type ClinicaResumen = {
  clinica: string
  monto: number
}

type HonorarioVeterinarioExterno = {
  id: string
  clinica_id: string | null
  clinica_nombre: string | null
  fecha: string
  concepto: string
  especie: string | null
  nombre_animal: string | null
  monto: number
  estado_pago: string
  fecha_pago: string | null
  observacion: string | null
  created_at: string
}

type RowKind = "header" | "data" | "subtotal" | "total"

type Row = {
  categoria: string
  mesActual?: number
  acumuladoAnio?: number
  kind: RowKind
}

type GroupBlock = {
  title: string
  rows: Row[]
}

type EstructuraEstado = {
  blocks: GroupBlock[]
  totalIngresos: { mesActual: number; acumuladoAnio: number }
  totalCostosDirectos: { mesActual: number; acumuladoAnio: number }
  totalGastosOperativos: { mesActual: number; acumuladoAnio: number }
  totalObligaciones: { mesActual: number; acumuladoAnio: number }
  resultadoPeriodo: { mesActual: number; acumuladoAnio: number }
}

const BRAND = "#0F6D6A"
const BRAND_DARK = "#0B5A58"
const SOFT = "#E8F4F3"
const SOFT_2 = "#DDF0EE"

const CLINICAS_FIJAS = [
  "Centro veterinario Dama",
  "Veterinaria Clacipet",
  "Veterinaria Reino de los Gatos",
  "Veterinaria Mivet",
  "Veterinaria Zoocenter",
]

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatBs(value: number | null | undefined) {
  return `Bs ${round2(toNumber(value)).toFixed(2)}`
}

function getFirstDayOfMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}-01`
}

function getLastDayOfMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

function getYearStart(fechaHasta: string) {
  const year = new Date(fechaHasta).getFullYear()
  return `${year}-01-01`
}

function inRange(dateValue: string | null | undefined, desde: string, hasta: string) {
  if (!dateValue) return false
  const date = dateValue.slice(0, 10)
  return date >= desde && date <= hasta
}

function monthNameEs(index: number) {
  const names = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ]
  return names[index] || ""
}

function normalizeDeliveryDate(pedido: PedidoDelivery) {
  return pedido.fecha_entregado || pedido.delivery_fecha || pedido.fecha_solicitada || ""
}

function inferirGrupoGasto(categoria: string) {
  const c = (categoria || "").toLowerCase()
  if (c.startsWith("recaudacion_")) return "recaudacion"
  if (c.startsWith("admin_") || c.startsWith("administrativo_")) return "administrativo"
  if (
    c.includes("publicidad") ||
    c.includes("difusion") ||
    c.includes("rrss") ||
    c.includes("recaudacion") ||
    c.includes("colecta") ||
    c.includes("comision") ||
    c.includes("diseno") ||
    c.includes("evento")
  ) {
    return "recaudacion"
  }
  return "operativo"
}

function sumByRange<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getAmount: (item: T) => number,
  desde: string,
  hasta: string
) {
  return round2(
    items.reduce((acc, item) => {
      return acc + (inRange(getDate(item), desde, hasta) ? getAmount(item) : 0)
    }, 0)
  )
}

function sumMonth<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getAmount: (item: T) => number,
  desde: string,
  hasta: string
) {
  return sumByRange(items, getDate, getAmount, desde, hasta)
}

function sumYtd<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getAmount: (item: T) => number,
  hasta: string
) {
  const yearStart = getYearStart(hasta)
  return sumByRange(items, getDate, getAmount, yearStart, hasta)
}

function slugClinica(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^veterinaria\s+/, "")
    .replace(/^centro veterinario\s+/, "")
    .replace(/^clinica veterinaria\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizarNombreClinica(value: string) {
  const slug = slugClinica(value)

  if (slug === "dama") return "Centro veterinario Dama"
  if (slug === "clacipet") return "Veterinaria Clacipet"
  if (slug === "reino de los gatos" || slug === "el reino de los gatos") {
    return "Veterinaria Reino de los Gatos"
  }
  if (slug === "mivet") return "Veterinaria Mivet"
  if (slug === "zoocenter") return "Veterinaria Zoocenter"

  return value?.trim() || "Sin clínica"
}

export default function EstadoResultadosPage() {
  const today = new Date()
  const currentYear = today.getFullYear()

  const [fechaDesde, setFechaDesde] = useState(getFirstDayOfMonth())
  const [fechaHasta, setFechaHasta] = useState(getLastDayOfMonth())
  const [anioGrafico, setAnioGrafico] = useState(currentYear)
  const [mostrarEvolucion, setMostrarEvolucion] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadingMensual, setLoadingMensual] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [donacionesNaturales, setDonacionesNaturales] = useState<DonacionNatural[]>([])
  const [donacionesJuridicas, setDonacionesJuridicas] = useState<DonacionJuridica[]>([])
  const [gastos, setGastos] = useState<GastoOperativo[]>([])
  const [entradas, setEntradas] = useState<EntradaContable[]>([])
  const [deliveryMovimientos, setDeliveryMovimientos] = useState<DeliveryMovimiento[]>([])
  const [pedidosDelivery, setPedidosDelivery] = useState<PedidoDelivery[]>([])
  const [tarifasDelivery, setTarifasDelivery] = useState<TarifaDelivery[]>([])
  const [costosClinicasMes, setCostosClinicasMes] = useState<ClinicaResumen[]>([])
  const [costosClinicasYtd, setCostosClinicasYtd] = useState<ClinicaResumen[]>([])
  const [honorariosExternos, setHonorariosExternos] = useState<HonorarioVeterinarioExterno[]>([])
  const [mensual, setMensual] = useState<Array<{ mes: number; ingresos: number; costos: number; gastos: number; resultado: number }>>([])

  async function cargarTodo() {
    setLoading(true)
    setError(null)

    try {
      const yearStart = getYearStart(fechaHasta)

      const [
        naturalesRes,
        juridicasRes,
        gastosRes,
        clinicasMesRes,
        clinicasYtdRes,
        entradasRes,
        deliveryMovRes,
        pedidosRes,
        tarifasRes,
        honorariosExternosRes,
      ] = await Promise.all([
        fetch("/api/contabilidad/donaciones-naturales", { cache: "no-store" }),
        fetch("/api/contabilidad/donaciones-juridicas", { cache: "no-store" }),
        fetch("/api/contabilidad/gastos-operativos", { cache: "no-store" }),
        fetch(`/api/contabilidad/estado-resultados-clinicas?desde=${fechaDesde}&hasta=${fechaHasta}`, { cache: "no-store" }),
        fetch(`/api/contabilidad/estado-resultados-clinicas?desde=${yearStart}&hasta=${fechaHasta}`, { cache: "no-store" }),
        supabase
          .from("entradas_inventario")
          .select("id,tipo_origen,costo_total,fecha_compra,created_at")
          .order("fecha_compra", { ascending: false }),
        supabase
          .from("delivery_movimientos")
          .select("id,fecha_movimiento,tipo,monto_total,activo")
          .order("fecha_movimiento", { ascending: false }),
        supabase
          .from("pedidos_clinicas")
          .select("id,clinica_id,fecha_solicitada,delivery_estado,delivery_fecha,fecha_entregado,estado"),
        supabase
          .from("tarifas_delivery")
          .select("id,clinica_id,valor,activo"),
        supabase
          .from("honorarios_veterinarios_externos")
          .select("id,clinica_id,clinica_nombre,fecha,concepto,especie,nombre_animal,monto,estado_pago,fecha_pago,observacion,created_at")
          .order("fecha", { ascending: false }),
      ])

      const naturalesJson = await naturalesRes.json()
      const juridicasJson = await juridicasRes.json()
      const gastosJson = await gastosRes.json()
      const clinicasMesJson = await clinicasMesRes.json()
      const clinicasYtdJson = await clinicasYtdRes.json()

      if (!naturalesRes.ok) throw new Error(naturalesJson.error || "No se pudieron cargar donaciones naturales.")
      if (!juridicasRes.ok) throw new Error(juridicasJson.error || "No se pudieron cargar donaciones jurídicas.")
      if (!gastosRes.ok) throw new Error(gastosJson.error || "No se pudieron cargar gastos.")
      if (!clinicasMesRes.ok) throw new Error(clinicasMesJson.error || "No se pudieron cargar pagos por clínicas del período.")
      if (!clinicasYtdRes.ok) throw new Error(clinicasYtdJson.error || "No se pudieron cargar pagos por clínicas acumulados.")
      if (entradasRes.error) throw new Error(entradasRes.error.message)
      if (deliveryMovRes.error) throw new Error(deliveryMovRes.error.message)
      if (pedidosRes.error) throw new Error(pedidosRes.error.message)
      if (tarifasRes.error) throw new Error(tarifasRes.error.message)
      if (honorariosExternosRes.error) throw new Error(honorariosExternosRes.error.message)

      setDonacionesNaturales((naturalesJson.data || []) as DonacionNatural[])
      setDonacionesJuridicas((juridicasJson.data || []) as DonacionJuridica[])
      setGastos((gastosJson.data || []) as GastoOperativo[])
      setCostosClinicasMes((clinicasMesJson.data || []) as ClinicaResumen[])
      setCostosClinicasYtd((clinicasYtdJson.data || []) as ClinicaResumen[])
      setEntradas((entradasRes.data || []) as EntradaContable[])
      setDeliveryMovimientos((deliveryMovRes.data || []) as DeliveryMovimiento[])
      setPedidosDelivery((pedidosRes.data || []) as PedidoDelivery[])
      setTarifasDelivery((tarifasRes.data || []) as TarifaDelivery[])
      setHonorariosExternos(
        ((honorariosExternosRes.data || []) as HonorarioVeterinarioExterno[]).map((item) => ({
          ...item,
          monto: toNumber(item.monto),
        }))
      )
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No se pudieron cargar los datos del estado de resultados.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargarTodo()
  }, [fechaDesde, fechaHasta])

  const mapaTarifas = useMemo(() => {
    const map = new Map<string, TarifaDelivery>()
    tarifasDelivery.forEach((t) => map.set(t.clinica_id, t))
    return map
  }, [tarifasDelivery])

  const costosClinicaDetalle = useMemo(() => {
  const mesMap = new Map<string, number>()
  const ytdMap = new Map<string, number>()

  costosClinicasMes.forEach((item) => {
    const nombre = normalizarNombreClinica(item.clinica)
    mesMap.set(nombre, round2((mesMap.get(nombre) || 0) + toNumber(item.monto)))
  })

  costosClinicasYtd.forEach((item) => {
    const nombre = normalizarNombreClinica(item.clinica)
    ytdMap.set(nombre, round2((ytdMap.get(nombre) || 0) + toNumber(item.monto)))
  })

  const rows = CLINICAS_FIJAS.map((nombre) => ({
    clinica: nombre,
    mesActual: mesMap.get(nombre) || 0,
    acumuladoAnio: ytdMap.get(nombre) || 0,
  }))

  const fijasNormalizadas = new Set(CLINICAS_FIJAS.map((c) => c.trim()))

  const extras = Array.from(
    new Set([
      ...Array.from(mesMap.keys()),
      ...Array.from(ytdMap.keys()),
    ])
  )
    .filter((nombre) => !fijasNormalizadas.has(nombre))
    .map((nombre) => ({
      clinica: nombre,
      mesActual: mesMap.get(nombre) || 0,
      acumuladoAnio: ytdMap.get(nombre) || 0,
    }))

  return [...rows, ...extras]
}, [costosClinicasMes, costosClinicasYtd])

  const deliveryCalculado = useMemo(() => {
    const yearStart = getYearStart(fechaHasta)

    const manualMes = deliveryMovimientos
      .filter((m) => m.activo !== false)
      .filter((m) => inRange(m.fecha_movimiento, fechaDesde, fechaHasta))
      .reduce((acc, m) => acc + toNumber(m.monto_total), 0)

    const manualYtd = deliveryMovimientos
      .filter((m) => m.activo !== false)
      .filter((m) => inRange(m.fecha_movimiento, yearStart, fechaHasta))
      .reduce((acc, m) => acc + toNumber(m.monto_total), 0)

    const pedidoMes = pedidosDelivery
      .filter((p) => (p.delivery_estado || "").toLowerCase() === "entregado")
      .filter((p) => inRange(normalizeDeliveryDate(p), fechaDesde, fechaHasta))
      .reduce((acc, p) => {
        const tarifa = p.clinica_id ? mapaTarifas.get(p.clinica_id) : null
        const valor = tarifa?.activo === false ? 0 : toNumber(tarifa?.valor)
        return acc + valor
      }, 0)

    const pedidoYtd = pedidosDelivery
      .filter((p) => (p.delivery_estado || "").toLowerCase() === "entregado")
      .filter((p) => inRange(normalizeDeliveryDate(p), yearStart, fechaHasta))
      .reduce((acc, p) => {
        const tarifa = p.clinica_id ? mapaTarifas.get(p.clinica_id) : null
        const valor = tarifa?.activo === false ? 0 : toNumber(tarifa?.valor)
        return acc + valor
      }, 0)

    return {
      mesActual: round2(manualMes + pedidoMes),
      acumuladoAnio: round2(manualYtd + pedidoYtd),
    }
  }, [deliveryMovimientos, pedidosDelivery, mapaTarifas, fechaDesde, fechaHasta])

  const comprasInventario = useMemo(() => {
    const compras = entradas.filter((e) => e.tipo_origen === "compra")
    return {
      mesActual: sumMonth(compras, (e) => e.fecha_compra || e.created_at, (e) => toNumber(e.costo_total), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(compras, (e) => e.fecha_compra || e.created_at, (e) => toNumber(e.costo_total), fechaHasta),
    }
  }, [entradas, fechaDesde, fechaHasta])

  const honorariosVeterinariosExternos = useMemo(() => {
    return {
      mesActual: sumMonth(
        honorariosExternos,
        (h) => h.fecha,
        (h) => toNumber(h.monto),
        fechaDesde,
        fechaHasta
      ),
      acumuladoAnio: sumYtd(
        honorariosExternos,
        (h) => h.fecha,
        (h) => toNumber(h.monto),
        fechaHasta
      ),
    }
  }, [honorariosExternos, fechaDesde, fechaHasta])

  const ingresosDonacionesNaturales = useMemo(
    () => ({
      mesActual: sumMonth(donacionesNaturales, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(donacionesNaturales, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaHasta),
    }),
    [donacionesNaturales, fechaDesde, fechaHasta]
  )

  const ingresosDonacionesJuridicasDinero = useMemo(() => {
    const rows = donacionesJuridicas.filter((d) => d.tipo_aporte === "dinero")
    return {
      mesActual: sumMonth(rows, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(rows, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaHasta),
    }
  }, [donacionesJuridicas, fechaDesde, fechaHasta])

  const ingresosDonacionesJuridicasEspecie = useMemo(() => {
    const rows = donacionesJuridicas.filter((d) => d.tipo_aporte === "especie")
    return {
      mesActual: sumMonth(rows, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(rows, (d) => d.fecha, (d) => toNumber(d.monto_total), fechaHasta),
    }
  }, [donacionesJuridicas, fechaDesde, fechaHasta])

  const gastosInfraestructura = useMemo(() => {
    const categoriasBase = [
      { key: "infra_alquiler", label: "Alquiler de instalaciones" },
      { key: "infra_energia", label: "Energía eléctrica" },
      { key: "infra_agua", label: "Agua y alcantarillado" },
      { key: "infra_internet", label: "Internet y telecomunicaciones" },
      { key: "infra_gas", label: "Gas y combustibles" },
      { key: "infra_mantenimiento", label: "Mantenimiento y reparaciones" },
    ]

    const rowsBase = categoriasBase.map((item) => ({
      categoria: item.label,
      mesActual: sumMonth(
        gastos.filter((g) => g.categoria === item.key),
        (g) => g.fecha,
        (g) => toNumber(g.monto),
        fechaDesde,
        fechaHasta
      ),
      acumuladoAnio: sumYtd(
        gastos.filter((g) => g.categoria === item.key),
        (g) => g.fecha,
        (g) => toNumber(g.monto),
        fechaHasta
      ),
    }))

    const usados = new Set(categoriasBase.map((c) => c.key))

    const otrosInfra = gastos.filter((g) => {
      const c = (g.categoria || "").toLowerCase()
      return (
        inferirGrupoGasto(c) === "operativo" &&
        !usados.has(g.categoria) &&
        !c.includes("publicidad") &&
        !c.includes("difusion") &&
        !c.includes("rrss") &&
        !c.includes("recaudacion") &&
        !c.includes("evento") &&
        !c.includes("comision")
      )
    })

    rowsBase.push({
      categoria: "Otros gastos operativos",
      mesActual: sumMonth(otrosInfra, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(otrosInfra, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
    })

    return rowsBase
  }, [gastos, fechaDesde, fechaHasta])

  const gastosAdministrativos = useMemo(() => {
    const categoriasBase = [
      { key: "admin_sueldos", label: "Sueldos y salarios (personal administrativo)" },
      { key: "admin_cargas_sociales", label: "Cargas sociales y aportes patronales" },
      { key: "admin_oficina", label: "Material de escritorio y oficina" },
      { key: "admin_transporte", label: "Gastos de transporte y movilidad" },
      { key: "admin_seguros", label: "Seguros" },
      { key: "admin_honorarios", label: "Honorarios profesionales (contabilidad, legal)" },
      { key: "admin_depreciacion", label: "Depreciación de activos fijos" },
    ]

    const rowsBase = categoriasBase.map((item) => ({
      categoria: item.label,
      mesActual: sumMonth(
        gastos.filter((g) => g.categoria === item.key),
        (g) => g.fecha,
        (g) => toNumber(g.monto),
        fechaDesde,
        fechaHasta
      ),
      acumuladoAnio: sumYtd(
        gastos.filter((g) => g.categoria === item.key),
        (g) => g.fecha,
        (g) => toNumber(g.monto),
        fechaHasta
      ),
    }))

    const usados = new Set(categoriasBase.map((c) => c.key))

    const otrosAdmin = gastos.filter((g) => {
      return inferirGrupoGasto(g.categoria || "") === "administrativo" && !usados.has(g.categoria)
    })

    rowsBase.push({
      categoria: "Otros gastos administrativos",
      mesActual: sumMonth(otrosAdmin, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
      acumuladoAnio: sumYtd(otrosAdmin, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
    })

    return rowsBase
  }, [gastos, fechaDesde, fechaHasta])

  const gastosRecaudacion = useMemo(() => {
    const rows = gastos.filter((g) => inferirGrupoGasto(g.categoria) === "recaudacion")
    const publicidad = rows.filter((g) => g.categoria === "recaudacion_publicidad" || g.categoria.includes("publicidad") || g.categoria.includes("rrss"))
    const diseno = rows.filter((g) => g.categoria === "recaudacion_diseno" || g.categoria.includes("diseno") || g.categoria.includes("difusion"))
    const eventos = rows.filter((g) => g.categoria === "recaudacion_eventos" || g.categoria.includes("evento"))
    const comisiones = rows.filter((g) => g.categoria === "recaudacion_comisiones" || g.categoria.includes("comision"))
    const usados = new Set([...publicidad, ...diseno, ...eventos, ...comisiones].map((g) => g.id))
    const otros = rows.filter((g) => !usados.has(g.id))

    return [
      {
        categoria: "Publicidad y redes sociales",
        mesActual: sumMonth(publicidad, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
        acumuladoAnio: sumYtd(publicidad, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
      },
      {
        categoria: "Diseño gráfico y material de difusión",
        mesActual: sumMonth(diseno, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
        acumuladoAnio: sumYtd(diseno, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
      },
      {
        categoria: "Organización de eventos de recaudación",
        mesActual: sumMonth(eventos, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
        acumuladoAnio: sumYtd(eventos, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
      },
      {
        categoria: "Comisiones por plataformas de donación online",
        mesActual: sumMonth(comisiones, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
        acumuladoAnio: sumYtd(comisiones, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
      },
      {
        categoria: "Otros gastos de recaudación",
        mesActual: sumMonth(otros, (g) => g.fecha, (g) => toNumber(g.monto), fechaDesde, fechaHasta),
        acumuladoAnio: sumYtd(otros, (g) => g.fecha, (g) => toNumber(g.monto), fechaHasta),
      },
    ]
  }, [gastos, fechaDesde, fechaHasta])

  const estrutura = useMemo<EstructuraEstado>(() => {
    const subtotalDonaciones = {
      mesActual: round2(
        ingresosDonacionesNaturales.mesActual +
          ingresosDonacionesJuridicasDinero.mesActual +
          ingresosDonacionesJuridicasEspecie.mesActual
      ),
      acumuladoAnio: round2(
        ingresosDonacionesNaturales.acumuladoAnio +
          ingresosDonacionesJuridicasDinero.acumuladoAnio +
          ingresosDonacionesJuridicasEspecie.acumuladoAnio
      ),
    }

    const subtotalAuspicios = { mesActual: 0, acumuladoAnio: 0 }
    const subtotalServicios = { mesActual: 0, acumuladoAnio: 0 }
    const subtotalOtrosIngresos = { mesActual: 0, acumuladoAnio: 0 }

    const totalIngresos = {
      mesActual: round2(
        subtotalDonaciones.mesActual +
          subtotalAuspicios.mesActual +
          subtotalServicios.mesActual +
          subtotalOtrosIngresos.mesActual
      ),
      acumuladoAnio: round2(
        subtotalDonaciones.acumuladoAnio +
          subtotalAuspicios.acumuladoAnio +
          subtotalServicios.acumuladoAnio +
          subtotalOtrosIngresos.acumuladoAnio
      ),
    }

    const subtotalCostosVeterinarios = {
      mesActual: round2(
        costosClinicaDetalle.reduce((acc, row) => acc + row.mesActual, 0) +
          comprasInventario.mesActual +
          honorariosVeterinariosExternos.mesActual
      ),
      acumuladoAnio: round2(
        costosClinicaDetalle.reduce((acc, row) => acc + row.acumuladoAnio, 0) +
          comprasInventario.acumuladoAnio +
          honorariosVeterinariosExternos.acumuladoAnio
      ),
    }

    const subtotalCostosEventos = { mesActual: 0, acumuladoAnio: 0 }

    const totalCostosDirectos = {
      mesActual: round2(subtotalCostosVeterinarios.mesActual + subtotalCostosEventos.mesActual),
      acumuladoAnio: round2(subtotalCostosVeterinarios.acumuladoAnio + subtotalCostosEventos.acumuladoAnio),
    }

    const margenBruto = {
      mesActual: round2(totalIngresos.mesActual - totalCostosDirectos.mesActual),
      acumuladoAnio: round2(totalIngresos.acumuladoAnio - totalCostosDirectos.acumuladoAnio),
    }

    const subtotalInfraestructura = {
      mesActual: round2(gastosInfraestructura.reduce((acc, row) => acc + row.mesActual, 0)),
      acumuladoAnio: round2(gastosInfraestructura.reduce((acc, row) => acc + row.acumuladoAnio, 0)),
    }

    const subtotalAdministrativos = {
      mesActual: round2(
        gastosAdministrativos.reduce((acc, row) => acc + row.mesActual, 0) + deliveryCalculado.mesActual
      ),
      acumuladoAnio: round2(
        gastosAdministrativos.reduce((acc, row) => acc + row.acumuladoAnio, 0) + deliveryCalculado.acumuladoAnio
      ),
    }

    const subtotalRecaudacion = {
      mesActual: round2(gastosRecaudacion.reduce((acc, row) => acc + row.mesActual, 0)),
      acumuladoAnio: round2(gastosRecaudacion.reduce((acc, row) => acc + row.acumuladoAnio, 0)),
    }

    const totalGastosOperativos = {
      mesActual: round2(
        subtotalInfraestructura.mesActual +
          subtotalAdministrativos.mesActual +
          subtotalRecaudacion.mesActual
      ),
      acumuladoAnio: round2(
        subtotalInfraestructura.acumuladoAnio +
          subtotalAdministrativos.acumuladoAnio +
          subtotalRecaudacion.acumuladoAnio
      ),
    }

    const totalObligaciones = { mesActual: 0, acumuladoAnio: 0 }

    const resultadoPeriodo = {
      mesActual: round2(
        margenBruto.mesActual - totalGastosOperativos.mesActual - totalObligaciones.mesActual
      ),
      acumuladoAnio: round2(
        margenBruto.acumuladoAnio - totalGastosOperativos.acumuladoAnio - totalObligaciones.acumuladoAnio
      ),
    }

    const blocks: GroupBlock[] = [
      {
        title: "I. INGRESOS",
        rows: [
          { categoria: "Ingresos por Donaciones", kind: "header" },
          { categoria: "Donaciones en efectivo de personas naturales", mesActual: ingresosDonacionesNaturales.mesActual, acumuladoAnio: ingresosDonacionesNaturales.acumuladoAnio, kind: "data" },
          { categoria: "Donaciones en efectivo de empresas / instituciones", mesActual: ingresosDonacionesJuridicasDinero.mesActual, acumuladoAnio: ingresosDonacionesJuridicasDinero.acumuladoAnio, kind: "data" },
          { categoria: "Donaciones en especie (valoradas)", mesActual: ingresosDonacionesJuridicasEspecie.mesActual, acumuladoAnio: ingresosDonacionesJuridicasEspecie.acumuladoAnio, kind: "data" },
          { categoria: "Aportes de socios fundadores", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subvenciones y subsidios", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Donaciones", mesActual: subtotalDonaciones.mesActual, acumuladoAnio: subtotalDonaciones.acumuladoAnio, kind: "subtotal" },

          { categoria: "Ingresos por Auspicios y Patrocinios (facturados con IVA 13%)", kind: "header" },
          { categoria: "Auspicios empresariales — visibilidad de marca", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Patrocinios de eventos", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Acuerdos de co-branding / menciones en RRSS", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Auspicios / Patrocinios", mesActual: subtotalAuspicios.mesActual, acumuladoAnio: subtotalAuspicios.acumuladoAnio, kind: "subtotal" },

          { categoria: "Ingresos por Servicios Veterinarios (facturados con IVA 13%)", kind: "header" },
          { categoria: "Atención clínica y consultas veterinarias", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Cirugías y procedimientos", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Vacunaciones y desparasitaciones", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Venta de medicamentos e insumos", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Otros servicios veterinarios", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Servicios Veterinarios", mesActual: subtotalServicios.mesActual, acumuladoAnio: subtotalServicios.acumuladoAnio, kind: "subtotal" },

          { categoria: "Otros Ingresos", kind: "header" },
          { categoria: "Ingresos por eventos y campañas", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Venta de merchandising / artículos solidarios", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Intereses bancarios", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Otros ingresos no clasificados", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Otros Ingresos", mesActual: subtotalOtrosIngresos.mesActual, acumuladoAnio: subtotalOtrosIngresos.acumuladoAnio, kind: "subtotal" },

          { categoria: "TOTAL INGRESOS", mesActual: totalIngresos.mesActual, acumuladoAnio: totalIngresos.acumuladoAnio, kind: "total" },
        ],
      },
      {
        title: "II. COSTOS DIRECTOS DE OPERACIÓN",
        rows: [
          { categoria: "Costos Veterinarios Directos", kind: "header" },
          ...costosClinicaDetalle.map((item) => ({
            categoria: item.clinica,
            mesActual: item.mesActual,
            acumuladoAnio: item.acumuladoAnio,
            kind: "data" as const,
          })),
          { categoria: "Medicamentos e insumos veterinarios", mesActual: comprasInventario.mesActual, acumuladoAnio: comprasInventario.acumuladoAnio, kind: "data" },
          {
            categoria: "Honorarios veterinarios externos",
            mesActual: honorariosVeterinariosExternos.mesActual,
            acumuladoAnio: honorariosVeterinariosExternos.acumuladoAnio,
            kind: "data"
          },
          { categoria: "Subtotal Costos Veterinarios", mesActual: subtotalCostosVeterinarios.mesActual, acumuladoAnio: subtotalCostosVeterinarios.acumuladoAnio, kind: "subtotal" },

          { categoria: "Costos de Eventos y Campañas", kind: "header" },
          { categoria: "Materiales y logística de eventos", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Servicio de catering / refrigerios", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Otros costos directos de eventos", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Costos de Eventos", mesActual: subtotalCostosEventos.mesActual, acumuladoAnio: subtotalCostosEventos.acumuladoAnio, kind: "subtotal" },

          { categoria: "TOTAL COSTOS DIRECTOS", mesActual: totalCostosDirectos.mesActual, acumuladoAnio: totalCostosDirectos.acumuladoAnio, kind: "total" },
          { categoria: "MARGEN BRUTO (Superávit Bruto Operativo)", mesActual: margenBruto.mesActual, acumuladoAnio: margenBruto.acumuladoAnio, kind: "total" },
        ],
      },
      {
        title: "III. GASTOS OPERATIVOS",
        rows: [
          { categoria: "Gastos de Infraestructura y Servicios", kind: "header" },
          ...gastosInfraestructura.map((item) => ({ ...item, kind: "data" as const })),
          { categoria: "Subtotal Infraestructura", mesActual: subtotalInfraestructura.mesActual, acumuladoAnio: subtotalInfraestructura.acumuladoAnio, kind: "subtotal" },

          { categoria: "Gastos Administrativos", kind: "header" },
          ...gastosAdministrativos.map((item) => ({ ...item, kind: "data" as const })),
          { categoria: "Delivery y logística a clínicas", mesActual: deliveryCalculado.mesActual, acumuladoAnio: deliveryCalculado.acumuladoAnio, kind: "data" },
          { categoria: "Subtotal Gastos Administrativos", mesActual: subtotalAdministrativos.mesActual, acumuladoAnio: subtotalAdministrativos.acumuladoAnio, kind: "subtotal" },

          { categoria: "Gastos de Recaudación y Difusión", kind: "header" },
          ...gastosRecaudacion.map((item) => ({ ...item, kind: "data" as const })),
          { categoria: "Subtotal Gastos de Recaudación", mesActual: subtotalRecaudacion.mesActual, acumuladoAnio: subtotalRecaudacion.acumuladoAnio, kind: "subtotal" },

          { categoria: "TOTAL GASTOS OPERATIVOS", mesActual: totalGastosOperativos.mesActual, acumuladoAnio: totalGastosOperativos.acumuladoAnio, kind: "total" },
        ],
      },
      {
        title: "IV. OBLIGACIONES TRIBUTARIAS (sobre servicios facturados)",
        rows: [
          { categoria: "Impuestos sobre Auspicios y Servicios Veterinarios", kind: "header" },
          { categoria: "IVA débito fiscal 13% — Auspicios (Form. 200)", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "IVA débito fiscal 13% — Servicios Veterinarios (Form. 200)", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "IT 3% — Auspicios (Form. 400)", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "IT 3% — Servicios Veterinarios (Form. 400)", mesActual: 0, acumuladoAnio: 0, kind: "data" },
          { categoria: "Subtotal Obligaciones Tributarias", mesActual: totalObligaciones.mesActual, acumuladoAnio: totalObligaciones.acumuladoAnio, kind: "subtotal" },
          { categoria: "TOTAL OBLIGACIONES TRIBUTARIAS", mesActual: totalObligaciones.mesActual, acumuladoAnio: totalObligaciones.acumuladoAnio, kind: "total" },
        ],
      },
      {
        title: "V. RESULTADO DEL PERÍODO",
        rows: [
          { categoria: "SUPERÁVIT / (DÉFICIT) DEL PERÍODO", mesActual: resultadoPeriodo.mesActual, acumuladoAnio: resultadoPeriodo.acumuladoAnio, kind: "total" },
        ],
      },
    ]

    return {
      blocks,
      totalIngresos,
      totalCostosDirectos,
      totalGastosOperativos,
      totalObligaciones,
      resultadoPeriodo,
    }
  }, [
    ingresosDonacionesNaturales,
    ingresosDonacionesJuridicasDinero,
    ingresosDonacionesJuridicasEspecie,
    costosClinicaDetalle,
    comprasInventario,
    honorariosVeterinariosExternos,
    gastosInfraestructura,
    gastosAdministrativos,
    gastosRecaudacion,
    deliveryCalculado,
  ])

  async function exportarExcel() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Estado de Resultados")

    const navy = "FF0F6D6A"
    const blue = "FF0F6D6A"
    const blueSoft = "FFE8F4F3"
    const white = "FFFFFFFF"
    const gray = "FFF7FAF9"
    const line = "FFD7E3E2"

    const response = await fetch("/logo.png")
    if (response.ok) {
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      const imageId = workbook.addImage({ buffer, extension: "png" })
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 60 } })
    }

    sheet.mergeCells("B1:D1")
    sheet.getCell("B1").value = "FUNDACIÓN RUGIMOS"
    sheet.getCell("B1").font = { bold: true, size: 18, color: { argb: white } }
    sheet.getCell("B1").alignment = { horizontal: "center" }
    sheet.getCell("B1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } }

    sheet.mergeCells("B2:D2")
    sheet.getCell("B2").value = "ESTADO DE RESULTADOS — ORGANISMO SIN FINES DE LUCRO"
    sheet.getCell("B2").font = { bold: true, size: 12, color: { argb: white } }
    sheet.getCell("B2").alignment = { horizontal: "center" }
    sheet.getCell("B2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } }

    sheet.mergeCells("B3:D3")
    sheet.getCell("B3").value = `Expresado en Bolivianos (Bs.) — Período: del ${fechaDesde} al ${fechaHasta} de ${new Date(fechaHasta).getFullYear()}`
    sheet.getCell("B3").font = { italic: true, color: { argb: white } }
    sheet.getCell("B3").alignment = { horizontal: "center" }
    sheet.getCell("B3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } }

    sheet.getRow(5).values = ["", "CONCEPTO", "MES ACTUAL (Bs.)", "ACUMULADO AÑO (Bs.)"]
    for (let c = 2; c <= 4; c += 1) {
      const cell = sheet.getRow(5).getCell(c)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } }
      cell.font = { bold: true, color: { argb: white } }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = {
        top: { style: "thin", color: { argb: line } },
        left: { style: "thin", color: { argb: line } },
        bottom: { style: "thin", color: { argb: line } },
        right: { style: "thin", color: { argb: line } },
      }
    }

    let rowIndex = 7

    estrutura.blocks.forEach((block) => {
      sheet.mergeCells(`B${rowIndex}:D${rowIndex}`)
      const titleCell = sheet.getCell(`B${rowIndex}`)
      titleCell.value = block.title
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } }
      titleCell.font = { bold: true, color: { argb: white }, size: 12 }
      rowIndex += 1

      block.rows.forEach((row, idx) => {
        sheet.getCell(`B${rowIndex}`).value = row.categoria
        sheet.getCell(`C${rowIndex}`).value = row.kind === "header" ? "" : toNumber(row.mesActual)
        sheet.getCell(`D${rowIndex}`).value = row.kind === "header" ? "" : toNumber(row.acumuladoAnio)

        const fill =
          row.kind === "total"
            ? navy
            : row.kind === "subtotal" || row.kind === "header"
            ? blueSoft
            : idx % 2 === 0
            ? gray
            : white

        for (const col of ["B", "C", "D"] as const) {
          const cell = sheet.getCell(`${col}${rowIndex}`)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
          cell.border = {
            top: { style: "thin", color: { argb: line } },
            left: { style: "thin", color: { argb: line } },
            bottom: { style: "thin", color: { argb: line } },
            right: { style: "thin", color: { argb: line } },
          }
          cell.alignment = { vertical: "middle" }

          if (col !== "B" && row.kind !== "header") {
            cell.numFmt = '"Bs" #,##0.00'
            cell.alignment = { horizontal: "right", vertical: "middle" }
          }

          if (row.kind === "total") {
            cell.font = { bold: true, color: { argb: white } }
          } else if (row.kind === "subtotal" || row.kind === "header") {
            cell.font = { bold: true, color: { argb: navy } }
          }
        }

        rowIndex += 1
      })

      rowIndex += 1
    })

    sheet.mergeCells(`B${rowIndex}:D${rowIndex}`)
    sheet.getCell(`B${rowIndex}`).value =
      "Nota: Las donaciones y subvenciones están exentas de IVA e IT conforme al Art. 8 de la Ley N° 843. Los ingresos por auspicios y servicios veterinarios están sujetos a IVA (13%) e IT (3%) por existir contraprestación. La fundación está exenta del IUE por ser organismo sin fines de lucro (Cód. 9499910)."
    sheet.getCell(`B${rowIndex}`).font = { italic: true, size: 9, color: { argb: "FF4B5C68" } }
    sheet.getCell(`B${rowIndex}`).alignment = { wrapText: true }

    sheet.columns = [
      { width: 4 },
      { width: 54 },
      { width: 20 },
      { width: 22 },
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `estado_resultados_fundacion_rugimos_${fechaDesde}_${fechaHasta}.xlsx`
    )
  }

  useEffect(() => {
    async function cargarMensual() {
      try {
        setLoadingMensual(true)

        const monthData = Array.from({ length: 12 }, (_, idx) => {
          const month = idx + 1
          const from = `${anioGrafico}-${String(month).padStart(2, "0")}-01`
          const to = `${anioGrafico}-${String(month).padStart(2, "0")}-${String(
            new Date(anioGrafico, month, 0).getDate()
          ).padStart(2, "0")}`

          const ingresos =
            sumByRange(donacionesNaturales, (d) => d.fecha, (d) => toNumber(d.monto_total), from, to) +
            sumByRange(donacionesJuridicas, (d) => d.fecha, (d) => toNumber(d.monto_total), from, to)

          const costos =
            sumByRange(costosClinicasMes, () => from, (c) => 0, from, to) + 0

          const costosClinicasMesPeriodo = sumByRange(
            costosClinicasMes,
            () => from,
            () => 0,
            from,
            to
          )

          const honorariosExternosMes = sumByRange(
            honorariosExternos,
            (h) => h.fecha,
            (h) => toNumber(h.monto),
            from,
            to
          )

          const costosReales =
            costosClinicasMesPeriodo +
            sumByRange(
              entradas.filter((e) => e.tipo_origen === "compra"),
              (e) => e.fecha_compra || e.created_at,
              (e) => toNumber(e.costo_total),
              from,
              to
            ) +
            honorariosExternosMes

          const gastosMes =
            sumByRange(gastos, (g) => g.fecha, (g) => toNumber(g.monto), from, to) +
            sumByRange(
              deliveryMovimientos.filter((m) => m.activo !== false),
              (m) => m.fecha_movimiento,
              (m) => toNumber(m.monto_total),
              from,
              to
            )

          return {
            mes: month,
            ingresos: round2(ingresos),
            costos: round2(costosReales),
            gastos: round2(gastosMes),
            resultado: round2(ingresos - costosReales - gastosMes),
          }
        })

        setMensual(monthData)
      } finally {
        setLoadingMensual(false)
      }
    }

    if (mostrarEvolucion) {
      void cargarMensual()
    }
  }, [mostrarEvolucion, anioGrafico, donacionesNaturales, donacionesJuridicas, costosClinicasMes, entradas, gastos, deliveryMovimientos, honorariosExternos])

  const maxIngresos = useMemo(
    () => (!mensual.length ? 0 : Math.max(...mensual.map((m) => Number(m.ingresos || 0)), 0)),
    [mensual]
  )
  const maxResultado = useMemo(
    () => (!mensual.length ? 0 : Math.max(...mensual.map((m) => Math.abs(Number(m.resultado || 0))), 0)),
    [mensual]
  )

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <Link href="/admin/contabilidad" className="rounded-xl bg-white px-4 py-2 font-bold text-[#0F6D6A] shadow hover:bg-gray-100 transition">
              Volver a contabilidad
            </Link>
            <Link href="/admin" className="rounded-xl bg-[#F47C3C] px-4 py-2 font-bold text-white shadow hover:bg-[#db6d31] transition">
              Volver al admin
            </Link>
          </div>

          <div className="flex gap-3">
            <button onClick={exportarExcel} className="rounded-xl bg-[#F47C3C] px-5 py-2 font-bold text-white shadow hover:bg-[#db6d31] transition">
              Exportar Excel
            </button>
            <button onClick={() => void cargarTodo()} className="rounded-xl bg-[#0F6D6A] px-5 py-2 font-bold text-white shadow hover:bg-[#0c5a58] transition">
              Actualizar
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-2xl md:p-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-[#0F6D6A] md:text-4xl">Estado de Resultados</h1>
              <p className="mt-2 max-w-3xl text-gray-500">
                Vista contable basada en el formato oficial del Excel: mes actual, acumulado año y búsqueda por rango de fechas.
              </p>
            </div>

            <div className="grid min-w-full grid-cols-2 gap-3 md:grid-cols-4 lg:min-w-[640px]">
              <StatCard title="Total ingresos" value={formatBs(estrutura.totalIngresos.mesActual)} />
              <StatCard title="Costos directos" value={formatBs(estrutura.totalCostosDirectos.mesActual)} />
              <StatCard title="Gastos operativos" value={formatBs(estrutura.totalGastosOperativos.mesActual)} />
              <StatCard
                title="Resultado del período"
                value={formatBs(estrutura.resultadoPeriodo.mesActual)}
                valueClass={estrutura.resultadoPeriodo.mesActual < 0 ? "text-red-600" : "text-[#0F6D6A]"}
              />
            </div>
          </div>

          <div className="mb-8 rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F6D6A]">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#0F6D6A]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F6D6A]">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#0F6D6A]"
                  />
                </div>
              </div>

              <button
                onClick={() => void cargarTodo()}
                disabled={loading}
                className="rounded-2xl bg-[#0F6D6A] px-6 py-3 font-bold text-white shadow transition hover:bg-[#0c5a58] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setMostrarEvolucion((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50"
            >
              <div>
                <h2 className="text-xl font-extrabold text-[#0F6D6A]">Evolución mensual {anioGrafico}</h2>
                <p className="mt-1 text-sm text-gray-500">Resumen visual de ingresos, costos y resultado por mes.</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#0F6D6A]/10 px-3 py-1 text-xs font-bold text-[#0F6D6A]">
                  {mostrarEvolucion ? "Ocultar" : "Expandir"}
                </span>
                <span className="text-2xl font-bold text-[#0F6D6A]">{mostrarEvolucion ? "−" : "+"}</span>
              </div>
            </button>

            {mostrarEvolucion && (
              <div className="p-5">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-gray-500">
                    Visual basado en el mismo criterio del estado contable.
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-[#0F6D6A]">Año</label>
                    <input
                      type="number"
                      value={anioGrafico}
                      onChange={(e) => setAnioGrafico(Number(e.target.value || currentYear))}
                      className="w-28 rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#0F6D6A]"
                    />
                  </div>
                </div>

                {loadingMensual ? (
                  <div className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">Cargando evolución mensual...</div>
                ) : !mensual.length ? (
                  <div className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">No hay datos mensuales para mostrar.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {mensual.map((item) => (
                      <MonthlyCard key={item.mes} item={item} maxIngresos={maxIngresos} maxResultado={maxResultado} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-xl font-extrabold text-[#0F6D6A]">Estado de resultados detallado</h2>
              <p className="mt-1 text-sm text-gray-500">Estructura alineada al Excel oficial de la fundación.</p>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">Cargando datos...</div>
            ) : (
              <div className="space-y-6 p-5">
                {estrutura.blocks.map((block) => (
                  <GrupoTabla key={block.title} grupo={block.title} rows={block.rows} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  valueClass = "text-[#0F6D6A]",
}: {
  title: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm">
      <div className="h-2 bg-gradient-to-r from-[#0F6D6A] to-[#2DA49D]" />
      <div className="p-5">
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`mt-2 text-2xl font-extrabold ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

function MonthlyCard({
  item,
  maxIngresos,
  maxResultado,
}: {
  item: { mes: number; ingresos: number; costos: number; gastos: number; resultado: number }
  maxIngresos: number
  maxResultado: number
}) {
  const ingresosWidth = maxIngresos > 0 ? Math.max((item.ingresos / maxIngresos) * 100, 4) : 0
  const resultadoWidth = maxResultado > 0 ? Math.max((Math.abs(item.resultado) / maxResultado) * 100, 4) : 0

  return (
    <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-[#0F6D6A]">{monthNameEs(item.mes - 1)}</h3>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Ingresos</span>
            <span>{formatBs(item.ingresos)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${ingresosWidth}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Resultado final</span>
            <span>{formatBs(item.resultado)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${item.resultado >= 0 ? "bg-gradient-to-r from-violet-500 to-violet-600" : "bg-gradient-to-r from-red-500 to-rose-600"}`}
              style={{ width: `${resultadoWidth}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
        <div className="rounded-xl bg-white p-3">
          <p>Costos</p>
          <p className="mt-1 font-bold text-[#0F6D6A]">{formatBs(item.costos)}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p>Gastos</p>
          <p className="mt-1 font-bold text-[#0F6D6A]">{formatBs(item.gastos)}</p>
        </div>
      </div>
    </div>
  )
}

function GrupoTabla({ grupo, rows }: { grupo: string; rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[#d7e3e2]">
      <div className="bg-[#0F6D6A] px-5 py-3 text-sm font-extrabold text-white">{grupo}</div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#E8F4F3] text-left text-xs uppercase tracking-wide text-[#0B5A58]">
              <th className="px-5 py-3">Concepto</th>
              <th className="px-5 py-3 text-right">Mes actual (Bs.)</th>
              <th className="px-5 py-3 text-right">Acumulado año (Bs.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowClass =
                row.kind === "total"
                  ? "bg-[#0F6D6A]"
                  : row.kind === "subtotal"
                  ? "bg-[#DDF0EE]"
                  : row.kind === "header"
                  ? "bg-[#E8F4F3]"
                  : index % 2 === 0
                  ? "bg-white"
                  : "bg-gray-50"

              const textClass =
                row.kind === "total"
                  ? "text-white font-extrabold"
                  : row.kind === "subtotal" || row.kind === "header"
                  ? "text-[#0B5A58] font-bold"
                  : "text-gray-700"

              return (
                <tr
                  key={`${grupo}-${row.categoria}-${index}`}
                  className={`border-t border-[#d7e3e2] ${rowClass}`}
                >
                  <td className={`px-5 py-3 ${textClass}`}>{row.categoria}</td>
                  <td className={`px-5 py-3 text-right ${textClass}`}>
                    {row.kind === "header" ? "" : formatBs(row.mesActual)}
                  </td>
                  <td className={`px-5 py-3 text-right ${textClass}`}>
                    {row.kind === "header" ? "" : formatBs(row.acumuladoAnio)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
