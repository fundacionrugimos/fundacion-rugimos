"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"

type Almacen = {
  id: string
  nombre: string
}

type EntradaContable = {
  id: string
  created_at: string
  almacen_id: string | null
  proveedor_id: string | null
  tipo_origen: "compra" | "donacion" | "ajuste" | "devolucion" | null
  proveedor: string | null
  costo_total: number | null
  metodo_pago: string | null
  estado_pago: string | null
  monto_pagado: number | null
  saldo_pendiente: number | null
  fecha_compra: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
  comprobante_url: string | null
  observacion: string | null
}

type PagoEntrada = {
  id: string
  entrada_id: string
  monto: number | null
  metodo_pago: string | null
  fecha_pago: string | null
  referencia: string | null
  comprobante_url: string | null
  observacion: string | null
  created_at: string
}

type PagoProveedor = {
  id: string
  proveedor_id: string | null
  proveedor_nombre: string | null
  monto: number | null
  metodo_pago: string | null
  fecha_pago: string | null
  referencia: string | null
  comprobante_url: string | null
  observacion: string | null
  created_at: string
}

type DonacionJuridica = {
  id: string
  created_at: string
  fecha: string
  empresa: string
  tipo_aporte: "dinero" | "especie"
  monto_total: number
  observacion: string | null
}

type MetodoPago = "efectivo" | "transferencia" | "qr" | "tarjeta" | "credito"

type ResumenProveedor = {
  key: string
  proveedor_id: string | null
  proveedor_nombre: string
  total_comprado: number
  total_pagado: number
  total_pendiente: number
  compras: number
  pendientes: number
}

type ResumenAlmacen = {
  nombre: string
  compras: number
  donaciones: number
  devoluciones: number
  pagado: number
  pendiente: number
  movimientos: number
}

type ProductoDetalle = {
  nombre: string | null
  categoria: string | null
  unidad_base: string | null
}

type EntradaItemDetalle = {
  entrada_id: string
  cantidad: number | null
  costo_unitario: number | null
  producto: ProductoDetalle | null
}

const BUCKET_COMPROBANTES = "comprobantes-contabilidad"
const BRAND = "#0F6D6A"
const ACCENT = "#F47C3C"

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatMoney(value: number | null | undefined) {
  return `Bs ${round2(toNumber(value)).toFixed(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("es-BO")
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString("es-BO")
}

function isImage(url: string | null | undefined) {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
}

function calcularEstadoPago(costoTotal: number, montoPagado: number) {
  const saldo = Math.max(round2(costoTotal) - round2(montoPagado), 0)
  if (saldo <= 0 && costoTotal > 0) return "pagado"
  if (montoPagado > 0 && saldo > 0) return "parcial"
  return "pendiente"
}

function chipClase(tipo: string) {
  if (tipo === "compra") return "bg-red-50 text-red-700 border-red-100"
  if (tipo === "donacion") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (tipo === "devolucion") return "bg-sky-50 text-sky-700 border-sky-100"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

function estadoPagoClase(estado: string) {
  if (estado === "pagado") return "bg-emerald-50 text-emerald-700 border-emerald-100"
  if (estado === "parcial") return "bg-amber-50 text-amber-700 border-amber-100"
  if (estado === "pendiente") return "bg-red-50 text-red-700 border-red-100"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

function claveProveedor(entrada: EntradaContable) {
  const manual = (entrada.proveedor || "").trim().toLowerCase()
  return entrada.proveedor_id || `manual:${manual || "sin-proveedor"}`
}

function nombreProveedor(entrada: Pick<EntradaContable, "proveedor">) {
  return (entrada.proveedor || "Sin proveedor").trim() || "Sin proveedor"
}

async function subirComprobante(file: File, carpeta: "pagos" | "entradas" | "proveedores") {
  const nombreLimpio = file.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "")

  const path = `${carpeta}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${nombreLimpio}`

  const { error } = await supabase.storage.from(BUCKET_COMPROBANTES).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET_COMPROBANTES).getPublicUrl(path)
  return data.publicUrl
}

export default function ComprasInventarioPage() {
  const [cargando, setCargando] = useState(true)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [guardandoPagoProveedor, setGuardandoPagoProveedor] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [guardandoPagoEditado, setGuardandoPagoEditado] = useState(false)
  const [eliminandoEntradaId, setEliminandoEntradaId] = useState<string | null>(null)
  const [eliminandoPagoId, setEliminandoPagoId] = useState<string | null>(null)

  const [entradas, setEntradas] = useState<EntradaContable[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [pagos, setPagos] = useState<PagoEntrada[]>([])
  const [pagosProveedor, setPagosProveedor] = useState<PagoProveedor[]>([])
  const [donacionesJuridicas, setDonacionesJuridicas] = useState<DonacionJuridica[]>([])
  const [entradaItems, setEntradaItems] = useState<EntradaItemDetalle[]>([])

  const [busqueda, setBusqueda] = useState("")
  const [almacenFiltro, setAlmacenFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [metodoFiltro, setMetodoFiltro] = useState("")
  const [origenFiltro, setOrigenFiltro] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

  const [entradaPago, setEntradaPago] = useState<EntradaContable | null>(null)
  const [montoPago, setMontoPago] = useState("")
  const [metodoPagoModal, setMetodoPagoModal] = useState<MetodoPago>("transferencia")
  const [fechaPagoModal, setFechaPagoModal] = useState(new Date().toISOString().slice(0, 10))
  const [referenciaPago, setReferenciaPago] = useState("")
  const [observacionPago, setObservacionPago] = useState("")
  const [archivoPago, setArchivoPago] = useState<File | null>(null)

  const [entradaEditando, setEntradaEditando] = useState<EntradaContable | null>(null)
  const [editAlmacenId, setEditAlmacenId] = useState("")
  const [editTipoOrigen, setEditTipoOrigen] = useState<"compra" | "donacion" | "ajuste" | "devolucion">("compra")
  const [editProveedor, setEditProveedor] = useState("")
  const [editCostoTotal, setEditCostoTotal] = useState("")
  const [editMetodoPago, setEditMetodoPago] = useState<MetodoPago>("efectivo")
  const [editMontoPagado, setEditMontoPagado] = useState("")
  const [editFechaCompra, setEditFechaCompra] = useState("")
  const [editFechaVencimiento, setEditFechaVencimiento] = useState("")
  const [editFechaPago, setEditFechaPago] = useState("")
  const [editObservacion, setEditObservacion] = useState("")
  const [editArchivoComprobante, setEditArchivoComprobante] = useState<File | null>(null)
  const [eliminarComprobanteActual, setEliminarComprobanteActual] = useState(false)

  const [pagoEditando, setPagoEditando] = useState<PagoEntrada | null>(null)
  const [editPagoMonto, setEditPagoMonto] = useState("")
  const [editPagoMetodo, setEditPagoMetodo] = useState<MetodoPago>("transferencia")
  const [editPagoFecha, setEditPagoFecha] = useState("")
  const [editPagoReferencia, setEditPagoReferencia] = useState("")
  const [editPagoObservacion, setEditPagoObservacion] = useState("")
  const [editPagoArchivo, setEditPagoArchivo] = useState<File | null>(null)
  const [editPagoEliminarComprobanteActual, setEditPagoEliminarComprobanteActual] = useState(false)

  const [proveedorPagoGeneral, setProveedorPagoGeneral] = useState<ResumenProveedor | null>(null)
  const [montoPagoProveedor, setMontoPagoProveedor] = useState("")
  const [metodoPagoProveedor, setMetodoPagoProveedor] = useState<MetodoPago>("credito")
  const [fechaPagoProveedor, setFechaPagoProveedor] = useState(new Date().toISOString().slice(0, 10))
  const [referenciaPagoProveedor, setReferenciaPagoProveedor] = useState("")
  const [observacionPagoProveedor, setObservacionPagoProveedor] = useState("")
  const [archivoPagoProveedor, setArchivoPagoProveedor] = useState<File | null>(null)

  const [previewComprobante, setPreviewComprobante] = useState<string | null>(null)
  const [mostrarDetalleContable, setMostrarDetalleContable] = useState(true)
  const [mostrarResumenProveedor, setMostrarResumenProveedor] = useState(true)
  const [mostrarPagosGenerales, setMostrarPagosGenerales] = useState(true)
  const [mostrarHistorialPagos, setMostrarHistorialPagos] = useState(true)
  const [proveedoresExpandido, setProveedoresExpandido] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void cargar()
  }, [])

  async function cargar() {
    setCargando(true)

    const [entradasRes, almacenesRes, pagosRes, pagosProveedorRes, donacionesJuridicasRes, entradaItemsRes] =
      await Promise.all([
        supabase
          .from("entradas_inventario")
          .select(
            "id,created_at,almacen_id,proveedor_id,tipo_origen,proveedor,costo_total,metodo_pago,estado_pago,monto_pagado,saldo_pendiente,fecha_compra,fecha_vencimiento,fecha_pago,comprobante_url,observacion"
          )
          .order("created_at", { ascending: false }),
        supabase.from("almacenes").select("id,nombre").order("nombre", { ascending: true }),
        supabase
          .from("pagos_entrada_inventario")
          .select("id,entrada_id,monto,metodo_pago,fecha_pago,referencia,comprobante_url,observacion,created_at")
          .order("fecha_pago", { ascending: false }),
        supabase
          .from("pagos_proveedor")
          .select("id,proveedor_id,proveedor_nombre,monto,metodo_pago,fecha_pago,referencia,comprobante_url,observacion,created_at")
          .order("fecha_pago", { ascending: false }),
        supabase.from("donaciones_juridicas").select("*").order("fecha", { ascending: false }),
        supabase
          .from("entradas_inventario_items")
          .select("entrada_id,cantidad,costo_unitario,producto:productos(nombre,categoria,unidad_base)"),
      ])

    if (entradasRes.error) alert("No se pudieron cargar las entradas contables.")
    if (almacenesRes.error) alert("No se pudieron cargar los almacenes.")
    if (pagosRes.error) alert("No se pudieron cargar los pagos por compra.")
    if (pagosProveedorRes.error) alert("No se pudieron cargar los pagos generales por proveedor.")
    if (donacionesJuridicasRes.error) alert("No se pudieron cargar las donaciones jurídicas.")
    if (entradaItemsRes.error) alert("No se pudieron cargar los productos de las entradas.")

    setEntradas((entradasRes.data || []) as EntradaContable[])
    setAlmacenes((almacenesRes.data || []) as Almacen[])
    setPagos((pagosRes.data || []) as PagoEntrada[])
    setPagosProveedor((pagosProveedorRes.data || []) as PagoProveedor[])
    setDonacionesJuridicas((donacionesJuridicasRes.data || []) as DonacionJuridica[])

    const entradaItemsNormalizados = ((entradaItemsRes.data || []) as any[]).map((item) => ({
      ...item,
      producto: Array.isArray(item.producto) ? item.producto[0] || null : item.producto || null,
    }))

    setEntradaItems(entradaItemsNormalizados as EntradaItemDetalle[])

    setCargando(false)
  }

  async function recalcularEntrada(entradaId: string) {
    const { data: entradaDb, error: entradaError } = await supabase
      .from("entradas_inventario")
      .select("id,costo_total")
      .eq("id", entradaId)
      .single()

    if (entradaError || !entradaDb) throw new Error(entradaError?.message || "No se encontró la entrada.")

    const { data: pagosDb, error: pagosError } = await supabase
      .from("pagos_entrada_inventario")
      .select("monto,fecha_pago,metodo_pago")
      .eq("entrada_id", entradaId)

    if (pagosError) throw new Error(pagosError.message)

    const costoTotal = round2(toNumber(entradaDb.costo_total))
    const montoPagado = round2((pagosDb || []).reduce((acc, pago) => acc + toNumber(pago.monto), 0))
    const saldoPendiente = round2(Math.max(costoTotal - montoPagado, 0))
    const estadoPago = calcularEstadoPago(costoTotal, montoPagado)

    const ultimoPago = [...(pagosDb || [])]
      .filter((p) => p.fecha_pago)
      .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))[0]

    const { error: updateError } = await supabase
      .from("entradas_inventario")
      .update({
        monto_pagado: montoPagado,
        saldo_pendiente: saldoPendiente,
        estado_pago: estadoPago,
        fecha_pago: ultimoPago?.fecha_pago || null,
        metodo_pago: (ultimoPago?.metodo_pago as MetodoPago | null) || null,
      })
      .eq("id", entradaId)

    if (updateError) throw new Error(updateError.message)
  }

  const almacenesMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of almacenes) map.set(a.id, a.nombre)
    return map
  }, [almacenes])

  const entradasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return entradas.filter((e) => {
      const proveedor = (e.proveedor || "").toLowerCase()
      const observacion = (e.observacion || "").toLowerCase()
      const almacen = e.almacen_id ? (almacenesMap.get(e.almacen_id) || "").toLowerCase() : ""
      const tipo = (e.tipo_origen || "").toLowerCase()
      const metodo = (e.metodo_pago || "").toLowerCase()
      const estado = (e.estado_pago || "").toLowerCase()

      if (q) {
        const texto = `${proveedor} ${observacion} ${almacen} ${tipo} ${metodo} ${estado}`
        if (!texto.includes(q)) return false
      }

      if (almacenFiltro && e.almacen_id !== almacenFiltro) return false
      if (estadoFiltro && (e.estado_pago || "") !== estadoFiltro) return false
      if (metodoFiltro && (e.metodo_pago || "") !== metodoFiltro) return false
      if (origenFiltro && (e.tipo_origen || "") !== origenFiltro) return false

      const fecha = e.fecha_compra || e.created_at?.slice(0, 10) || ""
      if (fechaDesde && fecha < fechaDesde) return false
      if (fechaHasta && fecha > fechaHasta) return false

      return true
    })
  }, [entradas, almacenesMap, busqueda, almacenFiltro, estadoFiltro, metodoFiltro, origenFiltro, fechaDesde, fechaHasta])

  const resumen = useMemo(() => {
    let totalCompras = 0
    let totalPagado = 0
    let totalPendiente = 0
    let totalDonacionesEspecie = 0
    let totalDevoluciones = 0
    let totalPendientesCount = 0
    let totalParcialesCount = 0
    let totalVencidas = 0

    const hoy = new Date()

    for (const e of entradasFiltradas) {
      const tipo = e.tipo_origen || ""
      const costo = round2(toNumber(e.costo_total))
      const pagado = round2(toNumber(e.monto_pagado))
      const pendiente = round2(toNumber(e.saldo_pendiente))

      if (tipo === "compra") {
        totalCompras += costo
        totalPagado += pagado
        totalPendiente += pendiente
        if ((e.estado_pago || "") === "pendiente") totalPendientesCount += 1
        if ((e.estado_pago || "") === "parcial") totalParcialesCount += 1
        if (pendiente > 0 && e.fecha_vencimiento && new Date(e.fecha_vencimiento) < new Date(hoy.toDateString())) {
          totalVencidas += 1
        }
      }

      if (tipo === "donacion") totalDonacionesEspecie += costo
      if (tipo === "devolucion") totalDevoluciones += costo
    }

    return {
      totalCompras: round2(totalCompras),
      totalPagado: round2(totalPagado),
      totalPendiente: round2(totalPendiente),
      totalDonacionesEspecie: round2(totalDonacionesEspecie),
      totalDevoluciones: round2(totalDevoluciones),
      totalPendientesCount,
      totalParcialesCount,
      totalVencidas,
    }
  }, [entradasFiltradas])

  const resumenPorAlmacen = useMemo<ResumenAlmacen[]>(() => {
    const map = new Map<string, ResumenAlmacen>()
    for (const e of entradasFiltradas) {
      const nombre = e.almacen_id ? almacenesMap.get(e.almacen_id) || "Sin almacén" : "Sin almacén"
      const actual = map.get(nombre) || {
        nombre,
        compras: 0,
        donaciones: 0,
        devoluciones: 0,
        pagado: 0,
        pendiente: 0,
        movimientos: 0,
      }

      if (e.tipo_origen === "compra") {
        actual.compras += round2(toNumber(e.costo_total))
        actual.pagado += round2(toNumber(e.monto_pagado))
        actual.pendiente += round2(toNumber(e.saldo_pendiente))
      }

      if (e.tipo_origen === "donacion") actual.donaciones += round2(toNumber(e.costo_total))
      if (e.tipo_origen === "devolucion") actual.devoluciones += round2(toNumber(e.costo_total))
      actual.movimientos += 1
      map.set(nombre, actual)
    }
    return Array.from(map.values()).sort((a, b) => b.compras - a.compras)
  }, [entradasFiltradas, almacenesMap])

  const resumenPorProveedor = useMemo<ResumenProveedor[]>(() => {
    const map = new Map<string, ResumenProveedor>()
    for (const e of entradasFiltradas) {
      if (e.tipo_origen !== "compra") continue
      const key = claveProveedor(e)
      const actual = map.get(key) || {
        key,
        proveedor_id: e.proveedor_id || null,
        proveedor_nombre: nombreProveedor(e),
        total_comprado: 0,
        total_pagado: 0,
        total_pendiente: 0,
        compras: 0,
        pendientes: 0,
      }
      actual.total_comprado += round2(toNumber(e.costo_total))
      actual.total_pagado += round2(toNumber(e.monto_pagado))
      actual.total_pendiente += round2(toNumber(e.saldo_pendiente))
      actual.compras += 1
      if (toNumber(e.saldo_pendiente) > 0) actual.pendientes += 1
      map.set(key, actual)
    }
    return Array.from(map.values()).sort((a, b) => b.total_pendiente - a.total_pendiente)
  }, [entradasFiltradas])

  const pagosMap = useMemo(() => {
    const map = new Map<string, PagoEntrada[]>()
    for (const pago of pagos) {
      const actual = map.get(pago.entrada_id) || []
      actual.push(pago)
      map.set(pago.entrada_id, actual)
    }
    return map
  }, [pagos])

  const donacionesEspecieMap = useMemo(() => {
    const map = new Map<string, DonacionJuridica>()
    for (const item of donacionesJuridicas) {
      if (item.tipo_aporte === "especie") {
        map.set(item.empresa.trim().toLowerCase(), item)
      }
    }
    return map
  }, [donacionesJuridicas])

  const entradaItemsMap = useMemo(() => {
    const map = new Map<string, EntradaItemDetalle[]>()
    for (const item of entradaItems) {
      const actual = map.get(item.entrada_id) || []
      actual.push(item)
      map.set(item.entrada_id, actual)
    }
    return map
  }, [entradaItems])

  function getProductoDetalle(item: EntradaItemDetalle): ProductoDetalle | null {
    if (!item.producto) return null
    return Array.isArray(item.producto) ? item.producto[0] || null : item.producto
  }

  function resumirCategoriasEntrada(entradaId: string) {
    const items = entradaItemsMap.get(entradaId) || []
    const categorias = Array.from(
      new Set(
        items
          .map((item) => getProductoDetalle(item)?.categoria?.trim())
          .filter(Boolean) as string[]
      )
    )

    if (!categorias.length) return "Sin categoría"
    return categorias.join(" · ")
  }

  function resumirProductosEntrada(entradaId: string) {
    const items = entradaItemsMap.get(entradaId) || []
    if (!items.length) return "Sin detalle de productos"

    return items
      .slice(0, 4)
      .map((item) => {
        const nombre = getProductoDetalle(item)?.nombre || "Producto"
        const cantidad = round2(toNumber(item.cantidad))
        const unidad = getProductoDetalle(item)?.unidad_base || "u"
        return `${nombre} · ${cantidad} ${unidad}`
      })
      .join(" | ")
  }

  function repartirTotalEnPartes(total: number, partes: number) {
    const totalCentavos = Math.round(round2(total) * 100)
    const base = Math.floor(totalCentavos / Math.max(partes, 1))
    const resto = totalCentavos % Math.max(partes, 1)

    return Array.from({ length: Math.max(partes, 1) }, (_, index) => (base + (index < resto ? 1 : 0)) / 100)
  }

  const pagosRecientes = useMemo(() => pagos.slice(0, 8), [pagos])
  const pagosProveedorRecientes = useMemo(() => pagosProveedor.slice(0, 8), [pagosProveedor])

  const previewEstadoEditado = useMemo(() => {
    const costo = round2(Math.max(toNumber(editCostoTotal), 0))
    const pagado = round2(Math.max(toNumber(editMontoPagado), 0))
    return calcularEstadoPago(costo, pagado)
  }, [editCostoTotal, editMontoPagado])

  const previewSaldoEditado = useMemo(() => {
    const costo = round2(Math.max(toNumber(editCostoTotal), 0))
    const pagado = round2(Math.max(toNumber(editMontoPagado), 0))
    return round2(Math.max(costo - pagado, 0))
  }, [editCostoTotal, editMontoPagado])

  function limpiarFiltros() {
    setBusqueda("")
    setAlmacenFiltro("")
    setEstadoFiltro("")
    setMetodoFiltro("")
    setOrigenFiltro("")
    setFechaDesde("")
    setFechaHasta("")
  }

  async function exportarExcel() {
    const compras = entradasFiltradas.filter((e) => e.tipo_origen === "compra")
    const donaciones = entradasFiltradas.filter((e) => e.tipo_origen === "donacion")
    const devoluciones = entradasFiltradas.filter((e) => e.tipo_origen === "devolucion")

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Fundación Rugimos"
    workbook.company = "Fundación Rugimos"
    workbook.subject = "Compras / Inventario / Cuentas por pagar"
    workbook.created = new Date()

    const palette = {
      navy: "FF1E3A6D",
      teal: "FF0F6D6A",
      tealSoft: "FFE8F4F3",
      orange: "FFF47C3C",
      line: "FFD6E0E3",
      white: "FFFFFFFF",
      subtitle: "FF5B6B73",
      gray: "FFF7F9FA",
      redSoft: "FFFFE5E7",
      greenSoft: "FFEAF8EF",
      skySoft: "FFEAF5FF",
      blueSection: "FF2D7CC1",
      blueLight: "FFDCEEFF",
    } as const

    async function tryAddLogo() {
      try {
        const response = await fetch("/logo.png")
        if (!response.ok) return null
        const blob = await response.blob()
        const buffer = await blob.arrayBuffer()
        return workbook.addImage({
          buffer,
          extension: "png",
        })
      } catch {
        return null
      }
    }

    function setBorder(cell: ExcelJS.Cell) {
      cell.border = {
        top: { style: "thin", color: { argb: palette.line } },
        left: { style: "thin", color: { argb: palette.line } },
        bottom: { style: "thin", color: { argb: palette.line } },
        right: { style: "thin", color: { argb: palette.line } },
      }
    }

    function styleRange(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: number, endCol: number, fill: string, fontColor = palette.white, bold = true) {
      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber)
        for (let col = startCol; col <= endCol; col += 1) {
          const cell = row.getCell(col)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
          cell.font = { color: { argb: fontColor }, bold }
          cell.alignment = { vertical: "middle", horizontal: "center" }
          setBorder(cell)
        }
      }
    }

    function makeMoney(cell: ExcelJS.Cell) {
      cell.numFmt = '"Bs" #,##0.00'
      cell.alignment = { horizontal: "right", vertical: "middle" }
    }

    function applyTableBorders(worksheet: ExcelJS.Worksheet, rowNumber: number, totalCols: number) {
      for (let col = 1; col <= totalCols; col += 1) {
        setBorder(worksheet.getRow(rowNumber).getCell(col))
      }
    }

    function autosizeAndWrap(worksheet: ExcelJS.Worksheet) {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = {
            ...(cell.alignment || {}),
            vertical: "middle",
            wrapText: true,
          }
        })
      })
    }

    function buildInventoryRows(entries: EntradaContable[], mode: "compra" | "donacion" | "devolucion") {
      const rows: Array<Record<string, string | number>> = []
      const grouped = new Map<string, Array<Record<string, string | number>>>()

      entries.forEach((entrada) => {
        const items = entradaItemsMap.get(entrada.id) || []
        const fallbackCategoria = "Sin categoría"

        if (!items.length) {
          const categoria = fallbackCategoria
          const record = {
            codigo: entrada.id,
            producto: entrada.proveedor || "Sin detalle",
            unidad: "u",
            cantidad: 0,
            unitario: 0,
            total: round2(toNumber(entrada.costo_total)),
            fecha: formatDate(entrada.fecha_compra || entrada.created_at),
            observaciones: entrada.observacion || "",
            almacen: entrada.almacen_id ? almacenesMap.get(entrada.almacen_id) || "Sin almacén" : "Sin almacén",
            proveedor: entrada.proveedor || "-",
            categoria,
          }
          const bucket = grouped.get(categoria) || []
          bucket.push(record)
          grouped.set(categoria, bucket)
          return
        }

        items.forEach((item, index) => {
          const cantidad = round2(toNumber(item.cantidad))
          const unitario = round2(toNumber(item.costo_unitario))
          const producto = getProductoDetalle(item)
          const categoria = (producto?.categoria || fallbackCategoria).trim() || fallbackCategoria
          const record = {
            codigo: `${categoria.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
            producto: producto?.nombre || entrada.proveedor || "Producto",
            unidad: producto?.unidad_base || "u",
            cantidad,
            unitario,
            total: round2(cantidad * unitario),
            fecha: formatDate(entrada.fecha_compra || entrada.created_at),
            observaciones: entrada.observacion || "",
            almacen: entrada.almacen_id ? almacenesMap.get(entrada.almacen_id) || "Sin almacén" : "Sin almacén",
            proveedor: entrada.proveedor || "-",
            categoria,
          }
          const bucket = grouped.get(categoria) || []
          bucket.push(record)
          grouped.set(categoria, bucket)
        })
      })

      Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([categoria, items]) => {
          items.forEach((item) => rows.push(item))
          rows.push({
            codigo: "",
            producto: `Subtotal ${categoria}`,
            unidad: "",
            cantidad: "",
            unitario: "",
            total: round2(items.reduce((acc, item) => acc + Number(item.total || 0), 0)),
            fecha: "",
            observaciones: "",
            almacen: "",
            proveedor: "",
            categoria: `SUBTOTAL:${categoria}`,
          })
        })

      return rows
    }

    function addFoundationHeader(worksheet: ExcelJS.Worksheet, title: string, subtitle?: string, origin?: string, showLogo = true) {
      worksheet.mergeCells("A1:I1")
      worksheet.mergeCells("A2:I2")
      worksheet.mergeCells("A3:I3")
      worksheet.getCell("A1").value = "FUNDACIÓN RUGIMOS"
      worksheet.getCell("A2").value = title
      worksheet.getCell("A3").value = subtitle || "Expresado en Bolivianos (Bs.)"

      styleRange(worksheet, 1, 1, 1, 9, palette.navy)
      styleRange(worksheet, 2, 2, 1, 9, palette.navy)
      styleRange(worksheet, 3, 3, 1, 9, palette.blueSection)

      worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: palette.white } }
      worksheet.getCell("A2").font = { bold: true, size: 12, color: { argb: palette.white } }
      worksheet.getCell("A3").font = { bold: true, size: 10, color: { argb: palette.white } }

      worksheet.getRow(1).height = 24
      worksheet.getRow(2).height = 20
      worksheet.getRow(3).height = 18

      if (origin) {
        worksheet.mergeCells("A4:I4")
        worksheet.getCell("A4").value = origin
        styleRange(worksheet, 4, 4, 1, 9, palette.teal, palette.white, true)
        worksheet.getCell("A4").font = { bold: true, size: 10, color: { argb: palette.white } }
      }
    }

    function buildStyledInventorySheet(
      name: string,
      title: string,
      origin: string,
      rows: Array<Record<string, string | number>>,
      providerHeader: string,
    ) {
      const worksheet = workbook.addWorksheet(name)
      worksheet.views = [{ state: "frozen", ySplit: 5 }]
      worksheet.properties.defaultRowHeight = 18
      worksheet.pageSetup = { fitToPage: true, fitToWidth: 1, orientation: "landscape", paperSize: 9 }

      addFoundationHeader(worksheet, title, "Santa Cruz, Bolivia", origin)

      const headerRow = 5
      const headers = ["CÓDIGO", "PRODUCTO / INSUMO", "UNIDAD", "CANTIDAD", "VALOR UNIT. (Bs.)", "VALOR TOTAL (Bs.)", "FECHA INGRESO", "OBSERVACIONES", providerHeader]
      worksheet.getRow(headerRow).values = headers
      styleRange(worksheet, headerRow, headerRow, 1, headers.length, palette.blueSection)
      worksheet.getRow(headerRow).font = { bold: true, size: 10, color: { argb: palette.white } }
      worksheet.getRow(headerRow).height = 22

      worksheet.columns = [
        { width: 14 },
        { width: 38 },
        { width: 12 },
        { width: 12 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 26 },
        { width: 24 },
      ]

      let rowNumber = headerRow + 1
      let grandTotal = 0
      let currentCategory = ""

      rows.forEach((item) => {
        const categoria = String(item.categoria || "Sin categoría")
        const isSubtotal = categoria.startsWith("SUBTOTAL:")
        const cleanCategory = isSubtotal ? categoria.replace("SUBTOTAL:", "") : categoria

        if (!isSubtotal && cleanCategory !== currentCategory) {
          worksheet.mergeCells(`A${rowNumber}:I${rowNumber}`)
          const catCell = worksheet.getCell(`A${rowNumber}`)
          catCell.value = cleanCategory.toUpperCase()
          catCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.blueLight } }
          catCell.font = { bold: true, color: { argb: palette.navy }, size: 10 }
          catCell.alignment = { horizontal: "left", vertical: "middle" }
          applyTableBorders(worksheet, rowNumber, 9)
          rowNumber += 1
          currentCategory = cleanCategory
        }

        if (isSubtotal) {
          worksheet.getCell(`A${rowNumber}`).value = ""
          worksheet.getCell(`B${rowNumber}`).value = `Subtotal ${cleanCategory}`
          worksheet.getCell(`F${rowNumber}`).value = Number(item.total || 0)
          for (let col = 1; col <= 9; col += 1) {
            const cell = worksheet.getRow(rowNumber).getCell(col)
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.tealSoft } }
            cell.font = { bold: true, color: { argb: palette.teal } }
            setBorder(cell)
          }
          makeMoney(worksheet.getCell(`F${rowNumber}`))
          rowNumber += 1
          return
        }

        worksheet.getCell(`A${rowNumber}`).value = String(item.codigo || "")
        worksheet.getCell(`B${rowNumber}`).value = String(item.producto || "")
        worksheet.getCell(`C${rowNumber}`).value = String(item.unidad || "")
        worksheet.getCell(`D${rowNumber}`).value = Number(item.cantidad || 0)
        worksheet.getCell(`E${rowNumber}`).value = Number(item.unitario || 0)
        worksheet.getCell(`F${rowNumber}`).value = Number(item.total || 0)
        worksheet.getCell(`G${rowNumber}`).value = String(item.fecha || "")
        worksheet.getCell(`H${rowNumber}`).value = String(item.observaciones || "")
        worksheet.getCell(`I${rowNumber}`).value = providerHeader === "PROVEEDOR / EMPRESA" ? String(item.proveedor || "") : String(item.almacen || "")

        applyTableBorders(worksheet, rowNumber, 9)
        worksheet.getRow(rowNumber).height = 20
        makeMoney(worksheet.getCell(`E${rowNumber}`))
        makeMoney(worksheet.getCell(`F${rowNumber}`))
        grandTotal += Number(item.total || 0)
        rowNumber += 1
      })

      worksheet.mergeCells(`A${rowNumber}:E${rowNumber}`)
      worksheet.getCell(`A${rowNumber}`).value = "TOTAL INVENTARIO VALORADO"
      worksheet.getCell(`F${rowNumber}`).value = round2(grandTotal)
      styleRange(worksheet, rowNumber, rowNumber, 1, 9, palette.navy)
      worksheet.getCell(`A${rowNumber}`).font = { bold: true, size: 11, color: { argb: palette.white } }
      makeMoney(worksheet.getCell(`F${rowNumber}`))
      worksheet.getCell(`F${rowNumber}`).font = { bold: true, size: 11, color: { argb: palette.white } }

      worksheet.mergeCells(`A${rowNumber + 1}:I${rowNumber + 1}`)
      worksheet.getCell(`A${rowNumber + 1}`).value = "Instrucciones: Complete los insumos adquiridos o donados. El valor total se calcula automáticamente para facilitar el control contable y la conciliación con Balance General."
      worksheet.getCell(`A${rowNumber + 1}`).font = { italic: true, size: 9, color: { argb: palette.subtitle } }
      worksheet.getCell(`A${rowNumber + 1}`).alignment = { wrapText: true }

      autosizeAndWrap(worksheet)
      return worksheet
    }

    const resumenSheet = workbook.addWorksheet("Resumen")
    resumenSheet.views = [{ state: "frozen", ySplit: 5 }]
    addFoundationHeader(resumenSheet, "RESUMEN DE COMPRAS E INVENTARIO", "Santa Cruz, Bolivia", "Vista consolidada del período")
    resumenSheet.columns = [{ width: 40 }, { width: 18 }, { width: 18 }]
    const resumenRows = [
      ["Compras inventario", resumen.totalCompras, palette.redSoft],
      ["Pagado", resumen.totalPagado, palette.greenSoft],
      ["Pendiente", resumen.totalPendiente, palette.redSoft],
      ["Donaciones en especie", resumen.totalDonacionesEspecie, palette.skySoft],
      ["Devoluciones / recuperaciones", resumen.totalDevoluciones, palette.skySoft],
    ] as const

    let resumenRow = 6
    resumenRows.forEach(([label, value, fill]) => {
      resumenSheet.getCell(`A${resumenRow}`).value = label
      resumenSheet.getCell(`B${resumenRow}`).value = Number(value)
      resumenSheet.getCell(`C${resumenRow}`).value = label === "Pendiente" ? `${resumen.totalPendientesCount} pendientes` : ""
      for (let col = 1; col <= 3; col += 1) {
        const cell = resumenSheet.getRow(resumenRow).getCell(col)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
        cell.font = { bold: col !== 3, color: { argb: palette.teal } }
        setBorder(cell)
      }
      makeMoney(resumenSheet.getCell(`B${resumenRow}`))
      resumenRow += 1
    })

    const providerRows = buildInventoryRows(compras, "compra")
    const donationRows = buildInventoryRows(donaciones, "donacion")
    const devolucionRows = buildInventoryRows(devoluciones, "devolucion")

    buildStyledInventorySheet(
      "Almacén Compras",
      "ALMACÉN DE INSUMOS Y MEDICAMENTOS — COMPRAS",
      "ORIGEN: COMPRA CON FACTURA · Genera IVA crédito fiscal deducible",
      providerRows,
      "PROVEEDOR / EMPRESA",
    )

    buildStyledInventorySheet(
      "Donaciones Especie",
      "ALMACÉN DE INSUMOS Y MEDICAMENTOS — DONACIONES EN ESPECIE",
      "ORIGEN: DONACIÓN DE INSUMOS / MEDICAMENTOS",
      donationRows,
      "PROVEEDOR / EMPRESA",
    )

    buildStyledInventorySheet(
      "Devoluciones",
      "ALMACÉN DE INSUMOS Y MEDICAMENTOS — DEVOLUCIONES",
      "ORIGEN: DEVOLUCIÓN / RECUPERACIÓN DE INSUMOS",
      devolucionRows,
      "PROVEEDOR / EMPRESA",
    )

    const proveedoresSheet = workbook.addWorksheet("Proveedores")
    addFoundationHeader(proveedoresSheet, "RESUMEN POR PROVEEDOR", "Santa Cruz, Bolivia", "Compras registradas y saldo por pagar")
    proveedoresSheet.columns = [
      { width: 30 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
    ]
    proveedoresSheet.getRow(5).values = ["Proveedor", "Comprado", "Pagado", "Pendiente", "Compras", "Pendientes"]
    styleRange(proveedoresSheet, 5, 5, 1, 6, palette.blueSection)
    let provRow = 6
    resumenPorProveedor.forEach((p) => {
      proveedoresSheet.getCell(`A${provRow}`).value = p.proveedor_nombre
      proveedoresSheet.getCell(`B${provRow}`).value = round2(p.total_comprado)
      proveedoresSheet.getCell(`C${provRow}`).value = round2(p.total_pagado)
      proveedoresSheet.getCell(`D${provRow}`).value = round2(p.total_pendiente)
      proveedoresSheet.getCell(`E${provRow}`).value = p.compras
      proveedoresSheet.getCell(`F${provRow}`).value = p.pendientes
      for (let col = 1; col <= 6; col += 1) {
        const cell = proveedoresSheet.getRow(provRow).getCell(col)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col === 4 ? palette.redSoft : palette.gray } }
        cell.font = { color: { argb: palette.teal }, bold: col === 1 }
        setBorder(cell)
      }
      makeMoney(proveedoresSheet.getCell(`B${provRow}`))
      makeMoney(proveedoresSheet.getCell(`C${provRow}`))
      makeMoney(proveedoresSheet.getCell(`D${provRow}`))
      provRow += 1
    })

    const logoId = await tryAddLogo()
    if (logoId) {
      ;[resumenSheet, workbook.getWorksheet("Almacén Compras"), workbook.getWorksheet("Donaciones Especie"), workbook.getWorksheet("Devoluciones"), proveedoresSheet]
        .filter(Boolean)
        .forEach((sheet) => {
          sheet!.addImage(logoId, {
            tl: { col: 8.15, row: 0.15 },
            ext: { width: 92, height: 50 },
          })
        })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    saveAs(blob, `compras_inventario_fundacion_rugimos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function abrirModalPago(entrada: EntradaContable) {
    setEntradaPago(entrada)
    setMontoPago("")
    setMetodoPagoModal((entrada.metodo_pago as MetodoPago) || "transferencia")
    setFechaPagoModal(new Date().toISOString().slice(0, 10))
    setReferenciaPago("")
    setObservacionPago("")
    setArchivoPago(null)
  }

  function cerrarModalPago() {
    setEntradaPago(null)
    setMontoPago("")
    setMetodoPagoModal("transferencia")
    setFechaPagoModal(new Date().toISOString().slice(0, 10))
    setReferenciaPago("")
    setObservacionPago("")
    setArchivoPago(null)
  }

  function aplicarPorcentajePago(porcentaje: number) {
    if (!entradaPago) return
    const saldo = round2(toNumber(entradaPago.saldo_pendiente))
    setMontoPago(String(round2((saldo * porcentaje) / 100)))
  }

  function abrirModalEdicion(entrada: EntradaContable) {
    setEntradaEditando(entrada)
    setEditAlmacenId(entrada.almacen_id || "")
    setEditTipoOrigen((entrada.tipo_origen as any) || "compra")
    setEditProveedor(entrada.proveedor || "")
    setEditCostoTotal(String(round2(toNumber(entrada.costo_total))))
    setEditMetodoPago((entrada.metodo_pago as MetodoPago) || "efectivo")
    setEditMontoPagado(String(round2(toNumber(entrada.monto_pagado))))
    setEditFechaCompra(entrada.fecha_compra || "")
    setEditFechaVencimiento(entrada.fecha_vencimiento || "")
    setEditFechaPago(entrada.fecha_pago || "")
    setEditObservacion(entrada.observacion || "")
    setEditArchivoComprobante(null)
    setEliminarComprobanteActual(false)
  }

  function cerrarModalEdicion() {
    setEntradaEditando(null)
    setEditAlmacenId("")
    setEditTipoOrigen("compra")
    setEditProveedor("")
    setEditCostoTotal("")
    setEditMetodoPago("efectivo")
    setEditMontoPagado("")
    setEditFechaCompra("")
    setEditFechaVencimiento("")
    setEditFechaPago("")
    setEditObservacion("")
    setEditArchivoComprobante(null)
    setEliminarComprobanteActual(false)
  }

  function abrirModalEditarPago(pago: PagoEntrada) {
    setPagoEditando(pago)
    setEditPagoMonto(String(round2(toNumber(pago.monto))))
    setEditPagoMetodo((pago.metodo_pago as MetodoPago) || "transferencia")
    setEditPagoFecha(pago.fecha_pago || new Date().toISOString().slice(0, 10))
    setEditPagoReferencia(pago.referencia || "")
    setEditPagoObservacion(pago.observacion || "")
    setEditPagoArchivo(null)
    setEditPagoEliminarComprobanteActual(false)
  }

  function cerrarModalEditarPago() {
    setPagoEditando(null)
    setEditPagoMonto("")
    setEditPagoMetodo("transferencia")
    setEditPagoFecha("")
    setEditPagoReferencia("")
    setEditPagoObservacion("")
    setEditPagoArchivo(null)
    setEditPagoEliminarComprobanteActual(false)
  }

  function abrirModalPagoProveedor(proveedor: ResumenProveedor) {
    setProveedorPagoGeneral(proveedor)
    setMontoPagoProveedor("")
    setMetodoPagoProveedor("credito")
    setFechaPagoProveedor(new Date().toISOString().slice(0, 10))
    setReferenciaPagoProveedor("")
    setObservacionPagoProveedor("")
    setArchivoPagoProveedor(null)
  }

  function cerrarModalPagoProveedor() {
    setProveedorPagoGeneral(null)
    setMontoPagoProveedor("")
    setMetodoPagoProveedor("credito")
    setFechaPagoProveedor(new Date().toISOString().slice(0, 10))
    setReferenciaPagoProveedor("")
    setObservacionPagoProveedor("")
    setArchivoPagoProveedor(null)
  }

  function aplicarPorcentajePagoProveedor(porcentaje: number) {
    if (!proveedorPagoGeneral) return
    const saldo = round2(toNumber(proveedorPagoGeneral.total_pendiente))
    setMontoPagoProveedor(String(round2((saldo * porcentaje) / 100)))
  }

  async function registrarPagoEntrada() {
    if (!entradaPago) return

    const monto = round2(toNumber(montoPago))
    const saldo = round2(toNumber(entradaPago.saldo_pendiente))

    if (monto <= 0) return alert("Ingrese un monto válido.")
    if (monto > saldo + 0.01) return alert("El monto no puede superar el saldo pendiente.")
    if (!fechaPagoModal) return alert("Ingrese la fecha de pago.")

    setGuardandoPago(true)
    try {
      let comprobanteUrl: string | null = null
      if (archivoPago) comprobanteUrl = await subirComprobante(archivoPago, "pagos")

      const { error } = await supabase.from("pagos_entrada_inventario").insert([
        {
          entrada_id: entradaPago.id,
          monto,
          metodo_pago: metodoPagoModal,
          fecha_pago: fechaPagoModal,
          referencia: referenciaPago.trim() || null,
          comprobante_url: comprobanteUrl,
          observacion: observacionPago.trim() || null,
        },
      ])

      if (error) throw new Error(error.message)

      await recalcularEntrada(entradaPago.id)
      await cargar()
      cerrarModalPago()
      alert("Pago registrado correctamente.")
    } catch (error: any) {
      alert(`No se pudo registrar el pago: ${error.message || "error interno"}`)
    } finally {
      setGuardandoPago(false)
    }
  }

  async function editarEntrada() {
    if (!entradaEditando) return

    const costoTotal = round2(toNumber(editCostoTotal))
    const montoPagado = round2(toNumber(editMontoPagado))
    const saldoPendiente = round2(Math.max(costoTotal - montoPagado, 0))
    const estadoPago = editTipoOrigen === "compra" ? calcularEstadoPago(costoTotal, montoPagado) : null

    if (!editAlmacenId) return alert("Seleccione un almacén.")
    if (!editFechaCompra) return alert("Ingrese la fecha.")
    if ((editTipoOrigen === "compra" || editTipoOrigen === "donacion" || editTipoOrigen === "devolucion") && costoTotal <= 0) {
      return alert("Ingrese un monto total válido.")
    }
    if (editTipoOrigen === "compra" && !editProveedor.trim()) return alert("Ingrese el proveedor.")

    setGuardandoEdicion(true)
    try {
      let comprobanteUrl = entradaEditando.comprobante_url
      if (eliminarComprobanteActual) comprobanteUrl = null
      if (editArchivoComprobante) comprobanteUrl = await subirComprobante(editArchivoComprobante, "entradas")

      const payload: Record<string, unknown> = {
        almacen_id: editAlmacenId,
        tipo_origen: editTipoOrigen,
        proveedor: editProveedor.trim() || null,
        costo_total: costoTotal,
        fecha_compra: editFechaCompra,
        observacion: editObservacion.trim() || null,
        comprobante_url: comprobanteUrl,
      }

      if (editTipoOrigen === "compra") {
        payload.metodo_pago = editMetodoPago
        payload.monto_pagado = montoPagado
        payload.saldo_pendiente = saldoPendiente
        payload.estado_pago = estadoPago
        payload.fecha_pago = editFechaPago || null
        payload.fecha_vencimiento = editFechaVencimiento || null
      } else {
        payload.metodo_pago = null
        payload.monto_pagado = 0
        payload.saldo_pendiente = 0
        payload.estado_pago = null
        payload.fecha_pago = null
        payload.fecha_vencimiento = null
      }

      const { error } = await supabase.from("entradas_inventario").update(payload).eq("id", entradaEditando.id)
      if (error) throw new Error(error.message)

      if (editTipoOrigen === "compra") await recalcularEntrada(entradaEditando.id)
      await cargar()
      cerrarModalEdicion()
      alert("Entrada actualizada correctamente.")
    } catch (error: any) {
      alert(`No se pudo actualizar la entrada: ${error.message || "error interno"}`)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function editarPagoCompra() {
    if (!pagoEditando) return
    const monto = round2(toNumber(editPagoMonto))
    if (monto <= 0) return alert("Ingrese un monto válido.")
    if (!editPagoFecha) return alert("Ingrese la fecha de pago.")

    setGuardandoPagoEditado(true)
    try {
      let comprobanteUrl = pagoEditando.comprobante_url
      if (editPagoEliminarComprobanteActual) comprobanteUrl = null
      if (editPagoArchivo) comprobanteUrl = await subirComprobante(editPagoArchivo, "pagos")

      const { error } = await supabase
        .from("pagos_entrada_inventario")
        .update({
          monto,
          metodo_pago: editPagoMetodo,
          fecha_pago: editPagoFecha,
          referencia: editPagoReferencia.trim() || null,
          observacion: editPagoObservacion.trim() || null,
          comprobante_url: comprobanteUrl,
        })
        .eq("id", pagoEditando.id)

      if (error) throw new Error(error.message)

      await recalcularEntrada(pagoEditando.entrada_id)
      await cargar()
      cerrarModalEditarPago()
      alert("Pago actualizado correctamente.")
    } catch (error: any) {
      alert(`No se pudo actualizar el pago: ${error.message || "error interno"}`)
    } finally {
      setGuardandoPagoEditado(false)
    }
  }

  async function eliminarPagoCompra(id: string, entradaId: string) {
    const ok = window.confirm("¿Seguro que deseas eliminar este pago?")
    if (!ok) return

    setEliminandoPagoId(id)
    try {
      const { error } = await supabase.from("pagos_entrada_inventario").delete().eq("id", id)
      if (error) throw new Error(error.message)
      await recalcularEntrada(entradaId)
      await cargar()
      alert("Pago eliminado correctamente.")
    } catch (error: any) {
      alert(`No se pudo eliminar el pago: ${error.message || "error interno"}`)
    } finally {
      setEliminandoPagoId(null)
    }
  }

  async function registrarPagoGeneralProveedor() {
  if (!proveedorPagoGeneral) return

  const montoTotal = round2(toNumber(montoPagoProveedor))

  if (montoTotal <= 0) {
    alert("Ingrese un monto válido.")
    return
  }

  if (!fechaPagoProveedor) {
    alert("Ingrese la fecha de pago.")
    return
  }

  if (montoTotal > round2(toNumber(proveedorPagoGeneral.total_pendiente)) + 0.01) {
    alert("El pago no puede superar el pendiente del proveedor.")
    return
  }

  setGuardandoPagoProveedor(true)

  try {
    let comprobanteUrl: string | null = null

    if (archivoPagoProveedor) {
      comprobanteUrl = await subirComprobante(archivoPagoProveedor, "proveedores")
    }

    // 1) guardar el pago general
    const { error: pagoGeneralError } = await supabase.from("pagos_proveedor").insert([
      {
        proveedor_id: proveedorPagoGeneral.proveedor_id,
        proveedor_nombre: proveedorPagoGeneral.proveedor_nombre,
        monto: montoTotal,
        metodo_pago: metodoPagoProveedor,
        fecha_pago: fechaPagoProveedor,
        referencia: referenciaPagoProveedor.trim() || null,
        comprobante_url: comprobanteUrl,
        observacion: observacionPagoProveedor.trim() || null,
      },
    ])

    if (pagoGeneralError) {
      throw new Error(pagoGeneralError.message)
    }

    // 2) buscar entradas pendientes del proveedor
    const entradasPendientes = [...entradas]
      .filter((e) => {
        if ((e.tipo_origen || "") !== "compra") return false
        if (round2(toNumber(e.saldo_pendiente)) <= 0) return false

        // match por proveedor_id si existe
        if (proveedorPagoGeneral.proveedor_id) {
          return e.proveedor_id === proveedorPagoGeneral.proveedor_id
        }

        // match manual por nombre cuando no hay proveedor_id
        return (
          !e.proveedor_id &&
          (e.proveedor || "").trim().toLowerCase() ===
            proveedorPagoGeneral.proveedor_nombre.trim().toLowerCase()
        )
      })
      .sort((a, b) => {
        const fechaA = a.fecha_compra || a.created_at || ""
        const fechaB = b.fecha_compra || b.created_at || ""
        return fechaA.localeCompare(fechaB)
      })

    if (!entradasPendientes.length) {
      throw new Error("No hay entradas pendientes para este proveedor.")
    }

    // 3) distribuir el pago entre las entradas
    let restante = round2(montoTotal)

    for (const entrada of entradasPendientes) {
      if (restante <= 0) break

      const saldoActual = round2(toNumber(entrada.saldo_pendiente))
      if (saldoActual <= 0) continue

      const abono = round2(Math.min(restante, saldoActual))
      const nuevoMontoPagado = round2(toNumber(entrada.monto_pagado) + abono)
      const nuevoSaldoPendiente = round2(Math.max(round2(toNumber(entrada.costo_total)) - nuevoMontoPagado, 0))
      const nuevoEstadoPago = calcularEstadoPago(round2(toNumber(entrada.costo_total)), nuevoMontoPagado)

      const { error: updateError } = await supabase
        .from("entradas_inventario")
        .update({
          monto_pagado: nuevoMontoPagado,
          saldo_pendiente: nuevoSaldoPendiente,
          estado_pago: nuevoEstadoPago,
          fecha_pago: fechaPagoProveedor,
          metodo_pago: metodoPagoProveedor,
        })
        .eq("id", entrada.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      restante = round2(restante - abono)
    }

    await cargar()
    cerrarModalPagoProveedor()
    alert("Pago general registrado correctamente.")
  } catch (error: any) {
    alert(`No se pudo registrar el pago general: ${error.message || "error interno"}`)
  } finally {
    setGuardandoPagoProveedor(false)
  }
}

  async function eliminarEntrada(id: string) {
    const ok = window.confirm(
      "¿Seguro que deseas eliminar esta entrada? Esto puede afectar compras, pagos, stock y conciliación contable."
    )
    if (!ok) return

    setEliminandoEntradaId(id)
    try {
      const { error: pagosError } = await supabase.from("pagos_entrada_inventario").delete().eq("entrada_id", id)
      if (pagosError) throw new Error(pagosError.message)

      const { error } = await supabase.from("entradas_inventario").delete().eq("id", id)
      if (error) throw new Error(error.message)

      await cargar()
      alert("Entrada eliminada correctamente.")
    } catch (error: any) {
      alert(`No se pudo eliminar la entrada: ${error.message || "error interno"}`)
    } finally {
      setEliminandoEntradaId(null)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] p-6 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl px-6 py-5 text-[#0F6D6A] font-semibold">
          Cargando compras e inventario...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-4 md:p-6 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/contabilidad" className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition">
            Volver a contabilidad
          </Link>

          <Link href="/admin/inventario/entrada" className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition">
            Nueva entrada
          </Link>

          <button onClick={exportarExcel} className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition">
            Exportar Excel
          </button>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-5 md:p-7 border border-white/60">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">Compras · Inventario · Cuentas por pagar</h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Control contable de compras de insumos, donaciones en especie, devoluciones, pagos por compra,
                pendientes por proveedor y comprobantes.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-full xl:min-w-[430px]">
              <StatChip title="Módulo" value="Compras" tone="teal" />
              <StatChip title="Enfoque" value="Inventario" tone="orange" />
              <StatChip title="Estado" value="Activo" tone="green" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
            <MetricCard label="Compras" value={formatMoney(resumen.totalCompras)} accent="border-red-400" valueClass="text-red-600" />
            <MetricCard label="Pagado" value={formatMoney(resumen.totalPagado)} accent="border-emerald-400" valueClass="text-emerald-600" />
            <MetricCard label="Pendiente" value={formatMoney(resumen.totalPendiente)} accent="border-rose-400" valueClass="text-rose-600" />
            <MetricCard label="Donaciones especie" value={formatMoney(resumen.totalDonacionesEspecie)} accent="border-sky-400" valueClass="text-sky-600" />
            <MetricCard label="Devoluciones" value={formatMoney(resumen.totalDevoluciones)} accent="border-cyan-400" valueClass="text-cyan-600" />
            <MetricCard label="Vencidas" value={String(resumen.totalVencidas)} accent="border-amber-400" valueClass="text-amber-600" />
          </div>

          <div className="rounded-3xl border border-gray-200 p-4 md:p-5 mb-6 bg-gray-50/60">
            <h2 className="text-2xl font-bold text-[#0F6D6A] mb-4">Filtros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar proveedor, observación, almacén..." className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800" />
              <select value={almacenFiltro} onChange={(e) => setAlmacenFiltro(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800">
                <option value="">Todos los almacenes</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800">
                <option value="">Todos los estados</option>
                <option value="pagado">Pagado</option>
                <option value="parcial">Parcial</option>
                <option value="pendiente">Pendiente</option>
              </select>
              <select value={metodoFiltro} onChange={(e) => setMetodoFiltro(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800">
                <option value="">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">QR</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="credito">Crédito</option>
              </select>
              <select value={origenFiltro} onChange={(e) => setOrigenFiltro(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800">
                <option value="">Todos los orígenes</option>
                <option value="compra">Compra</option>
                <option value="donacion">Donación</option>
                <option value="devolucion">Devolución</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800" />
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800" />
              <button onClick={limpiarFiltros} className="md:col-span-2 xl:col-span-1 bg-gray-200 hover:bg-gray-300 transition rounded-2xl px-4 py-3 font-semibold text-gray-700">
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            <div className="xl:col-span-2 rounded-3xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">Resumen por proveedor</h2>
                  <p className="text-sm text-gray-500">Vista rápida de compras y saldo por pagar.</p>
                </div>
                <button onClick={() => setMostrarResumenProveedor((v) => !v)} className="text-sm font-semibold text-[#0F6D6A]">
                  {mostrarResumenProveedor ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {mostrarResumenProveedor && (
                <div className="space-y-4">
                  {resumenPorProveedor.length === 0 && <Empty text="No hay proveedores con compras en el filtro actual." />}
                  {resumenPorProveedor.map((proveedor) => {
                    const abierto = !!proveedoresExpandido[proveedor.key]
                    const comprasProveedor = entradasFiltradas.filter((e) => e.tipo_origen === "compra" && claveProveedor(e) === proveedor.key)
                    return (
                      <div key={proveedor.key} className="overflow-hidden rounded-[28px] border border-[#0F6D6A]/10 bg-gradient-to-br from-white via-[#f8fbfb] to-[#eef7f6] shadow-sm">
                        <div className="border-b border-[#0F6D6A]/8 bg-white/80 px-5 py-5">
                          <div className="space-y-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full bg-[#0F6D6A]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F6D6A]">
                                  Proveedor
                                </span>
                                {proveedor.pendientes > 0 && (
                                  <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 border border-rose-100">
                                    {proveedor.pendientes} pendiente{proveedor.pendientes === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-3 text-2xl md:text-3xl font-extrabold leading-tight text-[#0F6D6A] break-words max-w-full">
                                {proveedor.proveedor_nombre}
                              </h3>
                              <p className="mt-2 text-sm text-gray-500">
                                {proveedor.compras} compra{proveedor.compras === 1 ? "" : "s"} registradas en el período actual.
                              </p>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <MiniMetric label="Comprado" value={formatMoney(proveedor.total_comprado)} tone="sky" />
                                <MiniMetric label="Pagado" value={formatMoney(proveedor.total_pagado)} tone="green" />
                                <MiniMetric label="Pendiente" value={formatMoney(proveedor.total_pendiente)} tone="rose" />
                              </div>

                              <div className="grid grid-cols-1 gap-2 lg:self-stretch">
                                <button
                                  onClick={() => setProveedoresExpandido((prev) => ({ ...prev, [proveedor.key]: !prev[proveedor.key] }))}
                                  className="w-full rounded-2xl border border-[#0F6D6A]/15 bg-white px-4 py-3 text-sm font-bold text-[#0F6D6A] shadow-sm transition hover:bg-[#0F6D6A]/5"
                                >
                                  {abierto ? "Ocultar detalles" : "Ver detalles"}
                                </button>
                                <button
                                  onClick={() => abrirModalPagoProveedor(proveedor)}
                                  disabled={proveedor.total_pendiente <= 0}
                                  className="w-full rounded-2xl bg-[#F47C3C] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#db6d31] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Registrar pago general
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {abierto && (
                          <div className="bg-[#f7fbfb] px-5 py-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#0F6D6A]">
                                  Compras del proveedor
                                </h4>
                                <p className="text-xs text-gray-500">
                                  Detalle rápido para revisión y pago.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {comprasProveedor.map((compra) => (
                                <div key={compra.id} className="rounded-2xl border border-[#0F6D6A]/10 bg-white p-4 shadow-sm">
                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] lg:items-center">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-sm font-extrabold text-[#0F6D6A]">{formatDate(compra.fecha_compra)}</span>
                                        <span className={`inline-flex px-3 py-1 rounded-full border text-[11px] font-bold ${estadoPagoClase(compra.estado_pago || "")}`}>
                                          {compra.estado_pago || "-"}
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-gray-700 break-words">
                                        {compra.almacen_id ? almacenesMap.get(compra.almacen_id) || "Sin almacén" : "Sin almacén"}
                                      </p>
                                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
                                        Categorías
                                      </p>
                                      <p className="text-xs text-gray-600 break-words">{resumirCategoriasEntrada(compra.id)}</p>
                                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
                                        Productos
                                      </p>
                                      <p className="text-xs text-gray-500 break-words">{resumirProductosEntrada(compra.id)}</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <MiniMetric label="Total" value={formatMoney(compra.costo_total)} tone="sky" />
                                      <MiniMetric label="Pagado" value={formatMoney(compra.monto_pagado)} tone="green" />
                                      <MiniMetric label="Pendiente" value={formatMoney(compra.saldo_pendiente)} tone="rose" />
                                    </div>

                                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[132px]">
                                      <button onClick={() => abrirModalPago(compra)} disabled={toNumber(compra.saldo_pendiente) <= 0} className="rounded-xl bg-[#0F6D6A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0c5e5b] disabled:cursor-not-allowed disabled:opacity-50">
                                        Registrar pago
                                      </button>
                                      <button onClick={() => abrirModalEdicion(compra)} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200">
                                        Editar compra
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 p-5 bg-gray-50/50">
              <h2 className="text-2xl font-bold text-[#0F6D6A] mb-4">Resumen por almacén</h2>
              <div className="space-y-3">
                {resumenPorAlmacen.length === 0 && <Empty text="No hay movimientos para mostrar." />}
                {resumenPorAlmacen.map((item) => (
                  <div key={item.nombre} className="rounded-2xl bg-white border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#0F6D6A]">{item.nombre}</h3>
                        <p className="text-xs text-gray-500">Movimientos: {item.movimientos}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div>Compras: <span className="font-semibold">{formatMoney(item.compras)}</span></div>
                        <div>Donación: <span className="font-semibold text-sky-600">{formatMoney(item.donaciones)}</span></div>
                        <div>Pendiente: <span className="font-semibold text-rose-600">{formatMoney(item.pendiente)}</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            <div className="xl:col-span-2 rounded-3xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">Detalle contable</h2>
                  <p className="text-sm text-gray-500">Compras, donaciones en especie y devoluciones registradas.</p>
                </div>
                <button onClick={() => setMostrarDetalleContable((v) => !v)} className="text-sm font-semibold text-[#0F6D6A]">
                  {mostrarDetalleContable ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {mostrarDetalleContable && (
                <div className="space-y-3">
                  {entradasFiltradas.map((entrada) => (
                    <div key={entrada.id} className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-sm font-bold text-[#0F6D6A]">{formatDate(entrada.fecha_compra || entrada.created_at)}</span>
                            <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${chipClase(entrada.tipo_origen || "")}`}>
                              {entrada.tipo_origen || "-"}
                            </span>
                            {entrada.estado_pago && (
                              <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${estadoPagoClase(entrada.estado_pago)}`}>
                                {entrada.estado_pago}
                              </span>
                            )}
                          </div>

                          <h3 className="text-[26px] font-extrabold text-gray-900 leading-tight break-words">
                            {entrada.proveedor || "-"}
                          </h3>
                          <p className="text-sm text-gray-600 mt-2">
                            {entrada.almacen_id ? almacenesMap.get(entrada.almacen_id) || "Sin almacén" : "Sin almacén"}
                          </p>
                          <p className="text-xs text-sky-700 font-semibold mt-3 break-words">{resumirCategoriasEntrada(entrada.id)}</p>
                          <p className="text-xs text-gray-500 mt-1 break-words">{resumirProductosEntrada(entrada.id)}</p>
                          <p className="text-xs text-gray-400 mt-2 break-words whitespace-pre-wrap">{entrada.observacion || "Sin observaciones"}</p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {entrada.tipo_origen === "compra" && (
                              <button
                                onClick={() => abrirModalPago(entrada)}
                                disabled={toNumber(entrada.saldo_pendiente) <= 0}
                                className="px-4 py-2.5 rounded-xl bg-[#0F6D6A] text-white text-sm font-semibold disabled:opacity-50"
                              >
                                Registrar pago
                              </button>
                            )}
                            <button
                              onClick={() => abrirModalEdicion(entrada)}
                              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => void eliminarEntrada(entrada.id)}
                              disabled={eliminandoEntradaId === entrada.id}
                              className="px-4 py-2.5 rounded-xl bg-rose-100 text-rose-700 text-sm font-semibold hover:bg-rose-200 transition disabled:opacity-50"
                            >
                              {eliminandoEntradaId === entrada.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 xl:pt-1">
                          <MiniMetric label="Total" value={formatMoney(entrada.costo_total)} tone="sky" />
                          <MiniMetric label="Pagado" value={entrada.tipo_origen === "compra" ? formatMoney(entrada.monto_pagado) : "-"} tone="green" />
                          <MiniMetric label="Pendiente" value={entrada.tipo_origen === "compra" ? formatMoney(entrada.saldo_pendiente) : "-"} tone="rose" />
                          <div className="rounded-[22px] border border-gray-200 bg-gray-50 px-4 py-4 shadow-sm flex flex-col justify-between min-h-[112px]">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] leading-none text-gray-500">
                              Comprobante
                            </div>
                            <div className="mt-3 text-sm font-semibold text-[#0F6D6A] break-words">
                              {entrada.comprobante_url ? (
                                <button
                                  onClick={() => setPreviewComprobante(entrada.comprobante_url)}
                                  className="underline underline-offset-2"
                                >
                                  Ver archivo
                                </button>
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {entradasFiltradas.length === 0 && <Empty text="No hay movimientos para el filtro actual." />}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F6D6A]">Pagos recientes</h2>
                    <p className="text-sm text-gray-500">Pagos aplicados a compras específicas.</p>
                  </div>
                  <button onClick={() => setMostrarHistorialPagos((v) => !v)} className="text-sm font-semibold text-[#0F6D6A]">{mostrarHistorialPagos ? "Ocultar" : "Mostrar"}</button>
                </div>

                {mostrarHistorialPagos && (
                  <div className="space-y-3">
                    {pagosRecientes.length === 0 && <Empty text="Aún no hay pagos por compra." />}
                    {pagosRecientes.map((pago) => (
                      <div key={pago.id} className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-[#0F6D6A]">{formatMoney(pago.monto)}</div>
                            <div className="text-sm text-gray-600">{formatDate(pago.fecha_pago)} · {pago.metodo_pago || "-"}</div>
                            <div className="text-xs text-gray-500 mt-1">{pago.referencia || pago.observacion || "Sin detalle"}</div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <button onClick={() => abrirModalEditarPago(pago)} className="px-3 py-2 rounded-xl bg-[#0F6D6A] text-white text-xs font-semibold">Editar</button>
                            <button onClick={() => void eliminarPagoCompra(pago.id, pago.entrada_id)} disabled={eliminandoPagoId === pago.id} className="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 text-xs font-semibold disabled:opacity-50">
                              {eliminandoPagoId === pago.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F6D6A]">Pagos generales</h2>
                    <p className="text-sm text-gray-500">Abatimientos globales por proveedor.</p>
                  </div>
                  <button onClick={() => setMostrarPagosGenerales((v) => !v)} className="text-sm font-semibold text-[#0F6D6A]">{mostrarPagosGenerales ? "Ocultar" : "Mostrar"}</button>
                </div>

                {mostrarPagosGenerales && (
                  <div className="space-y-3">
                    {pagosProveedorRecientes.length === 0 && <Empty text="Aún no hay pagos generales." />}
                    {pagosProveedorRecientes.map((pago) => (
                      <div key={pago.id} className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                        <div className="font-bold text-[#0F6D6A]">{pago.proveedor_nombre || "Sin proveedor"}</div>
                        <div className="text-sm text-gray-600">{formatMoney(pago.monto)} · {formatDate(pago.fecha_pago)} · {pago.metodo_pago || "-"}</div>
                        <div className="text-xs text-gray-500 mt-1">{pago.referencia || pago.observacion || "Sin detalle"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {entradaPago && (
        <Modal title="Registrar pago por compra" onClose={cerrarModalPago}>
          <div className="space-y-4">
            <InfoLine label="Proveedor" value={entradaPago.proveedor || "Sin proveedor"} />
            <InfoLine label="Total compra" value={formatMoney(entradaPago.costo_total)} />
            <InfoLine label="Pendiente" value={formatMoney(entradaPago.saldo_pendiente)} danger />

            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((pct) => (
                <button key={pct} onClick={() => aplicarPorcentajePago(pct)} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700">
                  {pct}%
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Monto">
                <input value={montoPago} onChange={(e) => setMontoPago(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Método">
                <select value={metodoPagoModal} onChange={(e) => setMetodoPagoModal(e.target.value as MetodoPago)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="qr">QR</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">Crédito</option>
                </select>
              </Field>
              <Field label="Fecha pago">
                <input type="date" value={fechaPagoModal} onChange={(e) => setFechaPagoModal(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Referencia">
                <input value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
            </div>

            <Field label="Observación">
              <textarea value={observacionPago} onChange={(e) => setObservacionPago(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            <Field label="Comprobante">
              <input type="file" onChange={(e) => setArchivoPago(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={cerrarModalPago} className="px-5 py-3 rounded-2xl bg-gray-200 font-semibold text-gray-800">Cancelar</button>
              <button onClick={() => void registrarPagoEntrada()} disabled={guardandoPago} className="px-5 py-3 rounded-2xl bg-[#0F6D6A] text-white font-semibold disabled:opacity-50">
                {guardandoPago ? "Guardando..." : "Guardar pago"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {entradaEditando && (
        <Modal title="Editar entrada contable" onClose={cerrarModalEdicion}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Almacén">
                <select value={editAlmacenId} onChange={(e) => setEditAlmacenId(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                  <option value="">Seleccione</option>
                  {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <Field label="Tipo origen">
                <select value={editTipoOrigen} onChange={(e) => setEditTipoOrigen(e.target.value as any)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                  <option value="compra">Compra</option>
                  <option value="donacion">Donación</option>
                  <option value="devolucion">Devolución</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </Field>
              <Field label="Proveedor / empresa">
                <input value={editProveedor} onChange={(e) => setEditProveedor(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Fecha">
                <input type="date" value={editFechaCompra} onChange={(e) => setEditFechaCompra(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Monto total">
                <input value={editCostoTotal} onChange={(e) => setEditCostoTotal(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              {editTipoOrigen === "compra" && (
                <Field label="Método pago">
                  <select value={editMetodoPago} onChange={(e) => setEditMetodoPago(e.target.value as MetodoPago)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="qr">QR</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="credito">Crédito</option>
                  </select>
                </Field>
              )}
              {editTipoOrigen === "compra" && (
                <Field label="Monto pagado">
                  <input value={editMontoPagado} onChange={(e) => setEditMontoPagado(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
                </Field>
              )}
              {editTipoOrigen === "compra" && (
                <Field label="Fecha pago">
                  <input type="date" value={editFechaPago} onChange={(e) => setEditFechaPago(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
                </Field>
              )}
              {editTipoOrigen === "compra" && (
                <Field label="Fecha vencimiento">
                  <input type="date" value={editFechaVencimiento} onChange={(e) => setEditFechaVencimiento(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
                </Field>
              )}
            </div>

            <Field label="Observación">
              <textarea value={editObservacion} onChange={(e) => setEditObservacion(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            {editTipoOrigen === "compra" && (
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm space-y-1">
                <div>Estado calculado: <span className="font-bold text-[#0F6D6A]">{previewEstadoEditado}</span></div>
                <div>Saldo calculado: <span className="font-bold text-rose-600">{formatMoney(previewSaldoEditado)}</span></div>
              </div>
            )}

            <Field label="Nuevo comprobante">
              <input type="file" onChange={(e) => setEditArchivoComprobante(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            {entradaEditando.comprobante_url && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={eliminarComprobanteActual} onChange={(e) => setEliminarComprobanteActual(e.target.checked)} />
                Eliminar comprobante actual
              </label>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={cerrarModalEdicion} className="px-5 py-3 rounded-2xl bg-gray-200 font-semibold text-gray-800">Cancelar</button>
              <button onClick={() => void editarEntrada()} disabled={guardandoEdicion} className="px-5 py-3 rounded-2xl bg-[#0F6D6A] text-white font-semibold disabled:opacity-50">
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pagoEditando && (
        <Modal title="Editar pago" onClose={cerrarModalEditarPago}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Monto">
                <input value={editPagoMonto} onChange={(e) => setEditPagoMonto(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Método">
                <select value={editPagoMetodo} onChange={(e) => setEditPagoMetodo(e.target.value as MetodoPago)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="qr">QR</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">Crédito</option>
                </select>
              </Field>
              <Field label="Fecha">
                <input type="date" value={editPagoFecha} onChange={(e) => setEditPagoFecha(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Referencia">
                <input value={editPagoReferencia} onChange={(e) => setEditPagoReferencia(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
            </div>

            <Field label="Observación">
              <textarea value={editPagoObservacion} onChange={(e) => setEditPagoObservacion(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            <Field label="Nuevo comprobante">
              <input type="file" onChange={(e) => setEditPagoArchivo(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            {pagoEditando.comprobante_url && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editPagoEliminarComprobanteActual} onChange={(e) => setEditPagoEliminarComprobanteActual(e.target.checked)} />
                Eliminar comprobante actual
              </label>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={cerrarModalEditarPago} className="px-5 py-3 rounded-2xl bg-gray-200 font-semibold text-gray-800">Cancelar</button>
              <button onClick={() => void editarPagoCompra()} disabled={guardandoPagoEditado} className="px-5 py-3 rounded-2xl bg-[#0F6D6A] text-white font-semibold disabled:opacity-50">
                {guardandoPagoEditado ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {proveedorPagoGeneral && (
        <Modal title="Registrar pago general a proveedor" onClose={cerrarModalPagoProveedor}>
          <div className="space-y-4">
            <InfoLine label="Proveedor" value={proveedorPagoGeneral.proveedor_nombre} />
            <InfoLine label="Pendiente" value={formatMoney(proveedorPagoGeneral.total_pendiente)} danger />

            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((pct) => (
                <button key={pct} onClick={() => aplicarPorcentajePagoProveedor(pct)} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700">
                  {pct}%
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Monto">
                <input value={montoPagoProveedor} onChange={(e) => setMontoPagoProveedor(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Método">
                <select value={metodoPagoProveedor} onChange={(e) => setMetodoPagoProveedor(e.target.value as MetodoPago)} className="w-full border border-gray-300 rounded-2xl px-4 py-3">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="qr">QR</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="credito">Crédito</option>
                </select>
              </Field>
              <Field label="Fecha pago">
                <input type="date" value={fechaPagoProveedor} onChange={(e) => setFechaPagoProveedor(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
              <Field label="Referencia">
                <input value={referenciaPagoProveedor} onChange={(e) => setReferenciaPagoProveedor(e.target.value)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
              </Field>
            </div>

            <Field label="Observación">
              <textarea value={observacionPagoProveedor} onChange={(e) => setObservacionPagoProveedor(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            <Field label="Comprobante">
              <input type="file" onChange={(e) => setArchivoPagoProveedor(e.target.files?.[0] || null)} className="w-full border border-gray-300 rounded-2xl px-4 py-3" />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={cerrarModalPagoProveedor} className="px-5 py-3 rounded-2xl bg-gray-200 font-semibold text-gray-800">Cancelar</button>
              <button onClick={() => void registrarPagoGeneralProveedor()} disabled={guardandoPagoProveedor} className="px-5 py-3 rounded-2xl bg-[#0F6D6A] text-white font-semibold disabled:opacity-50">
                {guardandoPagoProveedor ? "Guardando..." : "Guardar pago general"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {previewComprobante && (
        <Modal title="Vista de comprobante" onClose={() => setPreviewComprobante(null)} wide>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-3 bg-gray-50">
              <a href={previewComprobante} target="_blank" rel="noreferrer" className="text-[#0F6D6A] font-semibold underline">
                Abrir en otra pestaña
              </a>
            </div>
            {isImage(previewComprobante) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewComprobante} alt="Comprobante" className="w-full rounded-2xl border border-gray-200" />
            ) : (
              <iframe src={previewComprobante} title="Comprobante" className="w-full h-[70vh] rounded-2xl border border-gray-200 bg-white" />
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function MetricCard({ label, value, accent, valueClass }: { label: string; value: string; accent: string; valueClass?: string }) {
  return (
    <div className={`rounded-3xl border ${accent} bg-white p-4 shadow-sm`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${valueClass || "text-[#0F6D6A]"}`}>{value}</p>
    </div>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "sky" | "green" | "rose" }) {
  const tones = {
    sky: "bg-sky-50 border-sky-100 text-sky-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700",
  }

  const limpio = String(value).replace(/^Bs\s*/i, "")

  return (
    <div className={`min-w-0 w-full min-h-[112px] rounded-[22px] border px-4 py-4 shadow-sm flex flex-col justify-between overflow-hidden ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] leading-none opacity-80">{label}</div>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold">Bs</div>
        <div className="mt-2 text-[16px] md:text-[18px] font-extrabold tracking-tight leading-[1.1] break-words">
          {limpio}
        </div>
      </div>
    </div>
  )
}

function StatChip({ title, value, tone }: { title: string; value: string; tone: "teal" | "orange" | "green" }) {
  const tones = {
    teal: "border-[#0F6D6A]/10 bg-[#0F6D6A]/5 text-[#0F6D6A]",
    orange: "border-[#F47C3C]/10 bg-[#F47C3C]/10 text-[#F47C3C]",
    green: "border-emerald-100 bg-emerald-50 text-emerald-600",
  }
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">{text}</div>
}

function InfoLine({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`font-bold ${danger ? "text-rose-600" : "text-[#0F6D6A]"}`}>{value}</span>
    </div>
  )
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className={`w-full ${wide ? "max-w-5xl" : "max-w-3xl"} max-h-[92vh] overflow-y-auto rounded-[2rem] bg-white shadow-2xl border border-white/60`}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-[2rem]">
          <h3 className="text-2xl font-extrabold text-[#0F6D6A]">{title}</h3>
          <button onClick={onClose} className="rounded-xl bg-gray-100 hover:bg-gray-200 px-3 py-2 text-gray-700 font-semibold">Cerrar</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
