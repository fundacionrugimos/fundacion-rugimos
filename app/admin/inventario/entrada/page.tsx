"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { obtenerNumeroComprobanteEntrada } from "@/lib/comprobantes-entrada"

type PagoEntradaRegistrado = {
  id: string
  monto: number | null
  fecha_pago: string | null
  created_at?: string | null
}

type Almacen = {
  id: string
  nombre: string
  tipo: string | null
  clinica_id: string | null
}

type Producto = {
  id: string
  nombre: string
  stock_minimo: number | null
  unidad_base: string | null
  precio_unitario?: number | null
  costo_unitario?: number | null
  precio_referencial?: number | null
}

type Proveedor = {
  id: string
  nombre: string
  activo: boolean
}

type StockAlmacen = {
  id: string
  almacen_id: string
  producto_id: string
  cantidad_actual: number
  cantidad_minima: number | null
}

type ItemEntrada = {
  localId: string
  itemId?: string | null
  producto_id: string
  cantidad: string
  costo_unitario: string
}

type TipoOrigen = "compra" | "donacion" | "ajuste" | "devolucion"
type MetodoPago = "efectivo" | "transferencia" | "qr" | "tarjeta" | "credito" | ""
type EstadoPago = "pagado" | "parcial" | "pendiente" | ""

const BUCKET_COMPROBANTES = "comprobantes-contabilidad"

type DonacionJuridica = {
  id: string
  fecha: string
  empresa: string
  tipo_aporte: "dinero" | "especie"
  monto_total: number
  observacion: string | null
}

function crearItemVacio(): ItemEntrada {
  return {
    localId: crypto.randomUUID(),
    itemId: null,
    producto_id: "",
    cantidad: "",
    costo_unitario: "",
  }
}

function toNumber(value: string | number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function calcularEstadoPagoLocal(costoTotal: number, montoPagado: number): EstadoPago {
  const saldo = Math.max(costoTotal - montoPagado, 0)

  if (saldo <= 0 && costoTotal > 0) return "pagado"
  if (montoPagado > 0 && saldo > 0) return "parcial"
  return "pendiente"
}

function InventarioEntradaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])

  const [almacenId, setAlmacenId] = useState("")
  const [motivo, setMotivo] = useState("compra")
  const [observacion, setObservacion] = useState("")
  const [items, setItems] = useState<ItemEntrada[]>([crearItemVacio()])

  const [tipoOrigen, setTipoOrigen] = useState<TipoOrigen>("compra")
  const [proveedorId, setProveedorId] = useState("")
  const [proveedorManual, setProveedorManual] = useState("")
  const [fechaCompra, setFechaCompra] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo")
  const [estadoPago, setEstadoPago] = useState<EstadoPago>("pagado")
  const [montoPagado, setMontoPagado] = useState("")
  const [fechaPago, setFechaPago] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)

  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const [donacionesJuridicas, setDonacionesJuridicas] = useState<DonacionJuridica[]>([])
  const [donacionJuridicaId, setDonacionJuridicaId] = useState("")
  const [empresaDonante, setEmpresaDonante] = useState("")

  const [modoEdicion, setModoEdicion] = useState(false)
  const [entradaEditandoId, setEntradaEditandoId] = useState<string | null>(null)

  const [entradaCreadaId, setEntradaCreadaId] = useState<string | null>(null)
  const [numeroComprobanteCreado, setNumeroComprobanteCreado] = useState("")
  const [mostrarModalComprobante, setMostrarModalComprobante] = useState(false)

  const [resumenComprobante, setResumenComprobante] = useState<{
  total: number
  productos: number
} | null>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (cargandoDatos) return

    if (!editId) {
      setModoEdicion(false)
      setEntradaEditandoId(null)
      return
    }

    cargarEntradaParaEditar(editId)
  }, [editId, cargandoDatos])

  useEffect(() => {
    if (tipoOrigen === "donacion") {
      setMetodoPago("")
      setEstadoPago("pagado")
      setMontoPagado("0")
      setFechaPago("")
      setFechaVencimiento("")
      setComprobanteFile(null)
      setProveedorId("")
      setProveedorManual("")
      setMotivo("donacion")
      return
    }

    if (tipoOrigen === "ajuste") {
      setMetodoPago("")
      setEstadoPago("")
      setMontoPagado("0")
      setFechaPago("")
      setFechaVencimiento("")
      setComprobanteFile(null)
      setProveedorId("")
      setProveedorManual("")
      setMotivo("ajuste_inicial")
      return
    }

    if (tipoOrigen === "devolucion") {
      setMetodoPago("")
      setEstadoPago("")
      setMontoPagado("0")
      setFechaPago("")
      setFechaVencimiento("")
      setComprobanteFile(null)
      setProveedorId("")
      setProveedorManual("")
      setMotivo("devolucion")
      return
    }

    if (tipoOrigen === "compra" && (motivo === "donacion" || motivo === "devolucion")) {
      setMotivo("compra")
    }
  }, [tipoOrigen, motivo])

  const costoTotalNumero = useMemo(() => {
    return items.reduce((acc, item) => {
      const cantidad = toNumber(item.cantidad)
      const costoUnitario = toNumber(item.costo_unitario)
      return acc + cantidad * costoUnitario
    }, 0)
  }, [items])

  useEffect(() => {
    if (tipoOrigen !== "compra") return

    if (estadoPago === "pagado") {
      setMontoPagado(costoTotalNumero > 0 ? String(costoTotalNumero) : "0")
      setFechaVencimiento("")
      if (!fechaPago) {
        setFechaPago(fechaCompra || new Date().toISOString().slice(0, 10))
      }
    }

    if (estadoPago === "pendiente") {
      setMontoPagado("0")
      setFechaPago("")
    }
  }, [estadoPago, costoTotalNumero, tipoOrigen, fechaCompra, fechaPago])

  async function cargarDatos() {
    setCargandoDatos(true)

    const [
      almacenesRes,
      productosRes,
      proveedoresRes,
      donacionesJuridicasRes,
      entradasDonacionRes,
    ] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("productos")
        .select("id,nombre,stock_minimo,unidad_base,precio_unitario,costo_unitario,precio_referencial")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("proveedores")
        .select("id,nombre,activo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("donaciones_juridicas")
        .select("id,fecha,empresa,tipo_aporte,monto_total,observacion")
        .eq("tipo_aporte", "especie")
        .order("fecha", { ascending: false }),

      supabase
        .from("entradas_inventario")
        .select("donacion_juridica_id")
        .not("donacion_juridica_id", "is", null),
    ])

    if (almacenesRes.error) {
      console.error(almacenesRes.error)
      alert("No se pudieron cargar los almacenes.")
    }

    if (productosRes.error) {
      console.error(productosRes.error)
      alert("No se pudieron cargar los productos.")
    }

    if (proveedoresRes.error) {
      console.error(proveedoresRes.error)
      alert("No se pudieron cargar los proveedores.")
    }

    if (donacionesJuridicasRes.error) {
      console.error(donacionesJuridicasRes.error)
      alert("No se pudieron cargar las donaciones jurídicas en especie.")
    }

    if (entradasDonacionRes.error) {
      console.error(entradasDonacionRes.error)
      alert("No se pudieron verificar las donaciones ya vinculadas.")
    }

    const almacenesData = (almacenesRes.data || []) as Almacen[]
    const productosData = (productosRes.data || []) as Producto[]
    const proveedoresData = (proveedoresRes.data || []) as Proveedor[]
    const donacionesData = (donacionesJuridicasRes.data || []) as DonacionJuridica[]
    const entradasDonacionData = (entradasDonacionRes.data || []) as {
      donacion_juridica_id: string | null
    }[]

    const idsYaVinculados = new Set(
      entradasDonacionData
        .map((item) => item.donacion_juridica_id)
        .filter(Boolean) as string[]
    )

    const donacionesDisponibles = donacionesData.filter(
      (item) => !idsYaVinculados.has(item.id)
    )

    setAlmacenes(almacenesData)
    setProductos(productosData)
    setProveedores(proveedoresData)
    setDonacionesJuridicas(donacionesDisponibles)

    if (almacenesData.length > 0 && !modoEdicion) {
      const almacenCentral =
        almacenesData.find((a) =>
          (a.nombre || "").toLowerCase().includes("central")
        ) || almacenesData[0]

      setAlmacenId(almacenCentral.id)
    }

    setCargandoDatos(false)
  }

  async function cargarEntradaParaEditar(id: string) {
    try {
      const { data: entrada, error: entradaError } = await supabase
        .from("entradas_inventario")
        .select(`
          id,
          almacen_id,
          motivo,
          observacion,
          tipo_origen,
          proveedor_id,
          proveedor,
          empresa_donante,
          donacion_juridica_id,
          fecha_compra,
          metodo_pago,
          estado_pago,
          monto_pagado,
          fecha_pago,
          fecha_vencimiento
        `)
        .eq("id", id)
        .single()

      if (entradaError || !entrada) {
        console.error(entradaError)
        alert("No se pudo cargar la entrada para editar.")
        return
      }

      const { data: itemsDb, error: itemsError } = await supabase
        .from("entradas_inventario_items")
        .select(`
          id,
          producto_id,
          cantidad,
          costo_unitario
        `)
        .eq("entrada_id", id)

      if (itemsError) {
        console.error(itemsError)
        alert("No se pudieron cargar los productos de la entrada.")
        return
      }

      if (
        entrada.tipo_origen === "donacion" &&
        entrada.donacion_juridica_id &&
        !donacionesJuridicas.some((d) => d.id === entrada.donacion_juridica_id)
      ) {
        const { data: donacionActual } = await supabase
          .from("donaciones_juridicas")
          .select("id,fecha,empresa,tipo_aporte,monto_total,observacion")
          .eq("id", entrada.donacion_juridica_id)
          .single()

        if (donacionActual) {
          setDonacionesJuridicas((prev) => {
            const existe = prev.some((d) => d.id === donacionActual.id)
            if (existe) return prev
            return [donacionActual as DonacionJuridica, ...prev]
          })
        }
      }

      setModoEdicion(true)
      setEntradaEditandoId(entrada.id)

      setAlmacenId(entrada.almacen_id || "")
      setObservacion(entrada.observacion || "")
      setTipoOrigen((entrada.tipo_origen as TipoOrigen) || "compra")
      setProveedorId(entrada.proveedor_id || "")
      setProveedorManual(entrada.proveedor || "")
      setEmpresaDonante(entrada.empresa_donante || "")
      setDonacionJuridicaId(entrada.donacion_juridica_id || "")
      setFechaCompra(entrada.fecha_compra || new Date().toISOString().slice(0, 10))
      setMetodoPago((entrada.metodo_pago as MetodoPago) || "")
      setEstadoPago((entrada.estado_pago as EstadoPago) || "")
      setMontoPagado(String(Number(entrada.monto_pagado || 0)))
      setFechaPago(entrada.fecha_pago || "")
      setFechaVencimiento(entrada.fecha_vencimiento || "")

      const motivoMap: Record<string, string> = {
        Compra: "compra",
        Donación: "donacion",
        "Ajuste inicial": "ajuste_inicial",
        Reposición: "reposicion",
        Devolución: "devolucion",
      }

      setMotivo(motivoMap[entrada.motivo || ""] || "compra")

      const itemsFormateados: ItemEntrada[] = (itemsDb || []).map((item: any) => ({
        localId: crypto.randomUUID(),
        itemId: item.id,
        producto_id: item.producto_id || "",
        cantidad: String(Number(item.cantidad || 0)),
        costo_unitario: String(Number(item.costo_unitario || 0)),
      }))

      setItems(itemsFormateados.length ? itemsFormateados : [crearItemVacio()])
      setComprobanteFile(null)
    } catch (error) {
      console.error(error)
      alert("Ocurrió un error al cargar la entrada para edición.")
    }
  }

  const almacenSeleccionado = useMemo(() => {
    return almacenes.find((a) => a.id === almacenId) || null
  }, [almacenes, almacenId])

  const proveedorSeleccionado = useMemo(() => {
    return proveedores.find((p) => p.id === proveedorId) || null
  }, [proveedores, proveedorId])

  const donacionJuridicaSeleccionada = useMemo(() => {
    return donacionesJuridicas.find((d) => d.id === donacionJuridicaId) || null
  }, [donacionesJuridicas, donacionJuridicaId])

  const montoDonacionSeleccionada = useMemo(() => {
    return Number(donacionJuridicaSeleccionada?.monto_total || 0)
  }, [donacionJuridicaSeleccionada])

  const diferenciaDonacion = useMemo(() => {
    return Math.abs(costoTotalNumero - montoDonacionSeleccionada)
  }, [costoTotalNumero, montoDonacionSeleccionada])

  const donacionCuadra = useMemo(() => {
    return diferenciaDonacion <= 0.01
  }, [diferenciaDonacion])

  useEffect(() => {
    if (tipoOrigen !== "donacion") {
      setDonacionJuridicaId("")
      setEmpresaDonante("")
      return
    }

    if (!donacionJuridicaSeleccionada) {
      setEmpresaDonante("")
      return
    }

    setEmpresaDonante(donacionJuridicaSeleccionada.empresa)
    setProveedorManual(donacionJuridicaSeleccionada.empresa)
    setProveedorId("")
  }, [tipoOrigen, donacionJuridicaSeleccionada])

  const nombreProveedorResumen = useMemo(() => {
    if (tipoOrigen === "donacion") {
      return empresaDonante.trim() || proveedorManual.trim() || "-"
    }

    return proveedorSeleccionado?.nombre || proveedorManual.trim() || "-"
  }, [tipoOrigen, empresaDonante, proveedorSeleccionado, proveedorManual])

  const motivoLabel = useMemo(() => {
    if (motivo === "compra") return "Compra"
    if (motivo === "donacion") return "Donación"
    if (motivo === "ajuste_inicial") return "Ajuste inicial"
    if (motivo === "reposicion") return "Reposición"
    if (motivo === "devolucion") return "Devolución"
    return "Entrada manual"
  }, [motivo])

  const totalItemsValidos = useMemo(() => {
    return items.filter((item) => {
      const cantidad = Number(item.cantidad)
      return item.producto_id && Number.isFinite(cantidad) && cantidad > 0
    }).length
  }, [items])

  const totalUnidades = useMemo(() => {
    return items.reduce((acc, item) => {
      const n = Number(item.cantidad)
      return acc + (Number.isFinite(n) && n > 0 ? n : 0)
    }, 0)
  }, [items])

  const montoPagadoNumero = useMemo(() => toNumber(montoPagado), [montoPagado])

  const saldoPendienteNumero = useMemo(() => {
    if (tipoOrigen !== "compra") return 0
    const saldo = costoTotalNumero - montoPagadoNumero
    return saldo > 0 ? saldo : 0
  }, [tipoOrigen, costoTotalNumero, montoPagadoNumero])

  const mostrarBloqueFinanzas = tipoOrigen === "compra"

  function obtenerPrecioSugeridoProducto(productoId: string) {
    const producto = productos.find((p) => p.id === productoId)
    if (!producto) return ""

    const candidatos = [
      producto.precio_unitario,
      producto.costo_unitario,
      producto.precio_referencial,
    ]

    const encontrado = candidatos.find((valor) => {
      const n = Number(valor)
      return Number.isFinite(n) && n > 0
    })

    return encontrado ? String(Number(encontrado)) : ""
  }

  function actualizarItem(
    localId: string,
    campo: "producto_id" | "cantidad" | "costo_unitario",
    valor: string
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item

        if (campo === "producto_id") {
          const precioSugerido = obtenerPrecioSugeridoProducto(valor)
          const debeAutocompletarPrecio =
            !item.costo_unitario || Number(item.costo_unitario) === 0

          return {
            ...item,
            producto_id: valor,
            costo_unitario: debeAutocompletarPrecio
              ? precioSugerido
              : item.costo_unitario,
          }
        }

        return { ...item, [campo]: valor }
      })
    )
  }

  

  function agregarItem() {
    setItems((prev) => [...prev, crearItemVacio()])
  }

  function eliminarItem(localId: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((item) => item.localId !== localId)
    })
  }

  function productoDeItem(productoId: string) {
    return productos.find((p) => p.id === productoId) || null
  }

  function resetFormulario() {
    setMotivo("compra")
    setObservacion("")
    setItems([crearItemVacio()])

    setTipoOrigen("compra")
    setProveedorId("")
    setProveedorManual("")
    setFechaCompra(new Date().toISOString().slice(0, 10))
    setMetodoPago("efectivo")
    setEstadoPago("pagado")
    setMontoPagado("")
    setFechaPago("")
    setFechaVencimiento("")
    setComprobanteFile(null)
    setDonacionJuridicaId("")
    setEmpresaDonante("")
    setModoEdicion(false)
    setEntradaEditandoId(null)
  }

  async function subirComprobante(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin"
    const nombreLimpio = file.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-_]/g, "")

    const path = `compras/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${nombreLimpio || `archivo.${extension}`}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from(BUCKET_COMPROBANTES)
      .getPublicUrl(path)

    return data.publicUrl
  }

  async function ajustarStockItem(
    almacenIdParam: string,
    productoId: string,
    deltaCantidad: number
  ) {
    const producto = productoDeItem(productoId)

    const { data: stockExistente, error: stockError } = await supabase
      .from("stock_almacen")
      .select("id,almacen_id,producto_id,cantidad_actual,cantidad_minima")
      .eq("almacen_id", almacenIdParam)
      .eq("producto_id", productoId)
      .maybeSingle()

    if (stockError) {
      throw new Error(stockError.message)
    }

    if (stockExistente) {
      const row = stockExistente as StockAlmacen
      const nuevaCantidad = Number(row.cantidad_actual || 0) + deltaCantidad

      const { error: updateError } = await supabase
        .from("stock_almacen")
        .update({
          cantidad_actual: nuevaCantidad,
        })
        .eq("id", row.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    } else {
      if (deltaCantidad < 0) {
        throw new Error("No existe stock previo para descontar este producto.")
      }

      const cantidadMinima = Number(producto?.stock_minimo || 0)

      const { error: insertError } = await supabase
        .from("stock_almacen")
        .insert([
          {
            almacen_id: almacenIdParam,
            producto_id: productoId,
            cantidad_actual: deltaCantidad,
            cantidad_minima: cantidadMinima,
          },
        ])

      if (insertError) {
        throw new Error(insertError.message)
      }
    }
  }

  async function sincronizarPagosCompraAlEditar(
  entradaId: string,
  nuevoCostoTotal: number
) {
  const { data: pagosDb, error: pagosError } = await supabase
    .from("pagos_entrada_inventario")
    .select("id,monto,fecha_pago,created_at")
    .eq("entrada_id", entradaId)

  if (pagosError) {
    throw new Error(pagosError.message)
  }

  const pagos = ((pagosDb || []) as PagoEntradaRegistrado[])
    .sort((a, b) => {
      const fechaA = a.fecha_pago || a.created_at || ""
      const fechaB = b.fecha_pago || b.created_at || ""
      return fechaB.localeCompare(fechaA) // mais recente primeiro
    })

  const totalPagadoActual = pagos.reduce(
    (acc, pago) => acc + Number(pago.monto || 0),
    0
  )

  // Se o total pago já cabe dentro do novo total, não precisa mexer nos pagamentos
  if (totalPagadoActual <= nuevoCostoTotal) {
    return {
      totalPagadoFinal: totalPagadoActual,
    }
  }

  // Precisamos reduzir o excesso
  let exceso = totalPagadoActual - nuevoCostoTotal

  for (const pago of pagos) {
    if (exceso <= 0) break

    const montoActual = Number(pago.monto || 0)

    if (montoActual <= exceso) {
      // apaga o pagamento inteiro
      const { error: deleteError } = await supabase
        .from("pagos_entrada_inventario")
        .delete()
        .eq("id", pago.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      exceso -= montoActual
    } else {
      // reduz parcialmente este pagamento
      const nuevoMonto = montoActual - exceso

      const { error: updateError } = await supabase
        .from("pagos_entrada_inventario")
        .update({
          monto: nuevoMonto,
          observacion: "Pago ajustado automáticamente por edición de entrada",
        })
        .eq("id", pago.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      exceso = 0
    }
  }

  const { data: pagosRecalculados, error: pagosRecalculadosError } = await supabase
    .from("pagos_entrada_inventario")
    .select("monto")
    .eq("entrada_id", entradaId)

  if (pagosRecalculadosError) {
    throw new Error(pagosRecalculadosError.message)
  }

  const totalPagadoFinal = (pagosRecalculados || []).reduce(
    (acc, pago) => acc + Number(pago.monto || 0),
    0
  )

  return {
    totalPagadoFinal,
  }
}

  async function registrarEntrada(e: React.FormEvent) {
    e.preventDefault()

    if (!almacenId) {
      alert("Seleccione un almacén.")
      return
    }

    if (tipoOrigen === "donacion") {
      if (!donacionJuridicaId) {
        alert("Seleccione la donación jurídica en especie vinculada.")
        return
      }

      if (!empresaDonante.trim()) {
        alert("No se pudo identificar la empresa donante.")
        return
      }
    }

    if (tipoOrigen === "donacion") {
      const montoDonacion = Number(donacionJuridicaSeleccionada?.monto_total || 0)
      const diferencia = Math.abs(costoTotalNumero - montoDonacion)

      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la donación.")
        return
      }

      if (diferencia > 0.01) {
        alert(
          `El total de los productos (${costoTotalNumero.toFixed(2)}) debe coincidir con el monto de la donación jurídica (${montoDonacion.toFixed(2)}).`
        )
        return
      }
    }

    if (tipoOrigen === "devolucion") {
      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la devolución.")
        return
      }

      const esAlmacenCentral = (almacenSeleccionado?.nombre || "")
        .toLowerCase()
        .includes("central")

      if (!esAlmacenCentral) {
        const confirmar = window.confirm(
          "La devolución normalmente debe ingresar al almacén central. ¿Desea continuar de todos modos?"
        )
        if (!confirmar) return
      }
    }

    const itemsValidos = items
      .map((item) => ({
        ...item,
        cantidadNumero: Number(item.cantidad),
        costoUnitarioNumero: Number(item.costo_unitario),
        costoTotalNumero:
          Number(item.cantidad || 0) * Number(item.costo_unitario || 0),
      }))
      .filter((item) => {
        const cantidadValida =
          item.producto_id &&
          item.cantidad !== "" &&
          !Number.isNaN(item.cantidadNumero) &&
          item.cantidadNumero > 0

        const costoValido =
          item.costo_unitario !== "" &&
          !Number.isNaN(item.costoUnitarioNumero) &&
          item.costoUnitarioNumero >= 0

        if (
          tipoOrigen === "compra" ||
          tipoOrigen === "donacion" ||
          tipoOrigen === "devolucion"
        ) {
          return cantidadValida && costoValido
        }

        return cantidadValida
      })

    if (itemsValidos.length === 0) {
      alert("Agregue al menos un producto válido.")
      return
    }

    const productosDuplicados = new Set<string>()
    const repetidos = new Set<string>()

    for (const item of itemsValidos) {
      if (productosDuplicados.has(item.producto_id)) {
        repetidos.add(item.producto_id)
      }
      productosDuplicados.add(item.producto_id)
    }

    if (repetidos.size > 0) {
      alert("Hay productos repetidos en la misma entrada. Unifique las cantidades.")
      return
    }

    if (tipoOrigen === "compra") {
      if (!proveedorId && !proveedorManual.trim()) {
        alert("Seleccione un proveedor registrado o ingrese un proveedor manual.")
        return
      }

      if (!fechaCompra) {
        alert("Ingrese la fecha de compra.")
        return
      }

      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la compra.")
        return
      }

      if (!metodoPago) {
        alert("Seleccione un método de pago.")
        return
      }

      if (!estadoPago) {
        alert("Seleccione el estado del pago.")
        return
      }

      if (montoPagadoNumero < 0) {
        alert("El monto pagado no puede ser negativo.")
        return
      }

      if (montoPagadoNumero > costoTotalNumero) {
        alert("El monto pagado no puede ser mayor al costo total.")
        return
      }

      if (estadoPago === "pagado") {
        if (costoTotalNumero <= 0) {
          alert("No se puede marcar como pagado una compra sin total válido.")
          return
        }
      }

      if (estadoPago === "parcial") {
        if (montoPagadoNumero <= 0) {
          alert("Ingrese un monto pagado válido para pago parcial.")
          return
        }
        if (montoPagadoNumero >= costoTotalNumero) {
          alert("Si el monto pagado es igual al total, use estado 'pagado'.")
          return
        }
        if (!fechaPago) {
          alert("Ingrese la fecha del pago parcial.")
          return
        }
      }

      if (estadoPago === "pendiente") {
        if (!fechaVencimiento) {
          alert("Ingrese la fecha de vencimiento para una compra pendiente.")
          return
        }
      }
    }

    setGuardando(true)

    try {
      
      let urlComprobanteFinal: string | null = null

      if (comprobanteFile) {
        urlComprobanteFinal = await subirComprobante(comprobanteFile)
      }

      const proveedorSeleccionadoFinal =
        proveedores.find((p) => p.id === proveedorId) || null

      const nombreProveedorFinal =
        proveedorSeleccionadoFinal?.nombre || proveedorManual.trim() || null

      const montoPagadoFinal =
        tipoOrigen === "compra"
          ? estadoPago === "pagado"
            ? costoTotalNumero
            : estadoPago === "pendiente"
            ? 0
            : montoPagadoNumero
          : 0

      const saldoPendienteFinal =
        tipoOrigen === "compra"
          ? Math.max(costoTotalNumero - montoPagadoFinal, 0)
          : 0

      const metodoPagoFinal: MetodoPago =
        tipoOrigen === "compra" ? metodoPago : ""

      const estadoPagoFinal: EstadoPago =
        tipoOrigen === "compra" ? estadoPago : ""

      const fechaPagoFinal =
        tipoOrigen === "compra" && estadoPago === "pagado"
          ? fechaPago || fechaCompra || null
          : tipoOrigen === "compra" && estadoPago === "parcial"
          ? fechaPago || null
          : null

      const fechaVencimientoFinal =
        tipoOrigen === "compra" && estadoPago !== "pagado"
          ? fechaVencimiento || null
          : null

      const proveedorTextoFinal =
        tipoOrigen === "donacion"
          ? empresaDonante.trim() || null
          : tipoOrigen === "devolucion"
          ? proveedorManual.trim() || "Devolución de clínica / almacén externo"
          : nombreProveedorFinal

      const numeroComprobante = await obtenerNumeroComprobanteEntrada()
      const fechaComprobante = new Date().toISOString()

      const registradoPor = "Administrador"
      const registradoPorEmail = null    

      const { data: entradaCreada, error: entradaError } = await supabase
        .from("entradas_inventario")
        .insert([
          {
            almacen_id: almacenId,
            motivo: motivoLabel,
            observacion: observacion.trim() || null,

            numero_comprobante: numeroComprobante,
            registrado_por: registradoPor,
            registrado_por_email: registradoPorEmail,
            fecha_comprobante: fechaComprobante,

            tipo_origen: tipoOrigen,
            proveedor_id: tipoOrigen === "compra" ? proveedorId || null : null,
            proveedor: proveedorTextoFinal,
            empresa_donante: tipoOrigen === "donacion" ? empresaDonante.trim() || null : null,
            donacion_juridica_id: tipoOrigen === "donacion" ? donacionJuridicaId || null : null,
            costo_total:
              tipoOrigen === "compra" ||
              tipoOrigen === "donacion" ||
              tipoOrigen === "devolucion"
                ? costoTotalNumero
                : 0,
            metodo_pago: metodoPagoFinal || null,
            estado_pago: estadoPagoFinal || null,
            monto_pagado: montoPagadoFinal,
            saldo_pendiente: saldoPendienteFinal,
            fecha_compra: fechaCompra || null,
            fecha_vencimiento: fechaVencimientoFinal,
            fecha_pago: fechaPagoFinal,
            comprobante_url: urlComprobanteFinal,
          },
        ])
        .select("id")
        .single()

      if (entradaError || !entradaCreada) {
        console.error(entradaError)
        alert("No se pudo crear la entrada.")
        return
      }

      const entradaId = entradaCreada.id

      if (
        tipoOrigen === "compra" &&
        montoPagadoFinal > 0 &&
        metodoPagoFinal
      ) {
        const referenciaInicial =
          estadoPago === "pagado"
            ? "Pago inicial registrado junto con la compra"
            : "Pago parcial inicial registrado junto con la compra"

        const { error: pagoInicialError } = await supabase
          .from("pagos_entrada_inventario")
          .insert([
            {
              entrada_id: entradaId,
              monto: montoPagadoFinal,
              metodo_pago: metodoPagoFinal,
              fecha_pago: fechaPagoFinal || fechaCompra || new Date().toISOString().slice(0, 10),
              referencia: referenciaInicial,
              comprobante_url: urlComprobanteFinal,
              observacion: observacion.trim() || null,
            },
          ])

        if (pagoInicialError) {
          console.error(pagoInicialError)
          alert("La compra se creó, pero falló el registro del pago inicial.")
          return
        }
      }

      const itemsParaHistorico = itemsValidos.map((item) => {
        const producto = productoDeItem(item.producto_id)
        return {
          entrada_id: entradaId,
          producto_id: item.producto_id,
          cantidad: item.cantidadNumero,
          unidad: producto?.unidad_base || "unidad",
          costo_unitario:
            tipoOrigen === "compra" ||
            tipoOrigen === "donacion" ||
            tipoOrigen === "devolucion"
              ? item.costoUnitarioNumero
              : 0,
          costo_total:
            tipoOrigen === "compra" ||
            tipoOrigen === "donacion" ||
            tipoOrigen === "devolucion"
              ? item.costoTotalNumero
              : 0,
        }
      })

      const { error: itemsHistoricoError } = await supabase
        .from("entradas_inventario_items")
        .insert(itemsParaHistorico)

      if (itemsHistoricoError) {
        console.error(itemsHistoricoError)
        alert("Se creó la entrada, pero falló el historial de items.")
        return
      }

      for (const item of itemsValidos) {
        const producto = productoDeItem(item.producto_id)
        const cantidadNumero = item.cantidadNumero

        const { data: stockExistente, error: stockError } = await supabase
          .from("stock_almacen")
          .select("id,almacen_id,producto_id,cantidad_actual,cantidad_minima")
          .eq("almacen_id", almacenId)
          .eq("producto_id", item.producto_id)
          .maybeSingle()

        if (stockError) {
          console.error(stockError)
          alert(`No se pudo verificar stock de ${producto?.nombre || "un producto"}.`)
          return
        }

        let cantidadMinima = Number(producto?.stock_minimo || 0)

        if (stockExistente) {
          const row = stockExistente as StockAlmacen
          cantidadMinima = Number(row.cantidad_minima ?? producto?.stock_minimo ?? 0)

          const { error: updateError } = await supabase
            .from("stock_almacen")
            .update({
              cantidad_actual: Number(row.cantidad_actual || 0) + cantidadNumero,
            })
            .eq("id", row.id)

          if (updateError) {
            console.error(updateError)
            alert(`No se pudo actualizar stock de ${producto?.nombre || "un producto"}.`)
            return
          }
        } else {
          const { error: insertStockError } = await supabase
            .from("stock_almacen")
            .insert([
              {
                almacen_id: almacenId,
                producto_id: item.producto_id,
                cantidad_actual: cantidadNumero,
                cantidad_minima: cantidadMinima,
              },
            ])

          if (insertStockError) {
            console.error(insertStockError)
            alert(`No se pudo crear stock para ${producto?.nombre || "un producto"}.`)
            return
          }
        }

        const motivoMovimiento = observacion.trim()
          ? `${motivoLabel} - ${observacion.trim()}`
          : motivoLabel

        const { error: movimientoError } = await supabase
          .from("movimientos_stock")
          .insert([
            {
              producto_id: item.producto_id,
              almacen_destino_id: almacenId,
              tipo_movimiento: "entrada_manual",
              cantidad: cantidadNumero,
              motivo: motivoMovimiento,
            },
          ])

        if (movimientoError) {
          console.error(movimientoError)
          alert(
            `El stock de ${producto?.nombre || "un producto"} se actualizó, pero falló el movimiento.`
          )
          return
        }
      }

      const resumenAntesDeLimpiar = {
  total: costoTotalNumero,
  productos: totalItemsValidos,
}

setEntradaCreadaId(entradaId)
setNumeroComprobanteCreado(numeroComprobante)
setResumenComprobante(resumenAntesDeLimpiar)
setMostrarModalComprobante(true)

await cargarDatos()
resetFormulario()

    } catch (error: any) {
      console.error(error)
      alert(`Ocurrió un error al registrar la entrada: ${error.message || "error interno"}`)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEdicionEntrada() {
    if (!entradaEditandoId) return

    if (!almacenId) {
      alert("Seleccione un almacén.")
      return
    }

    if (tipoOrigen === "donacion") {
      if (!donacionJuridicaId) {
        alert("Seleccione la donación jurídica en especie vinculada.")
        return
      }

      if (!empresaDonante.trim()) {
        alert("No se pudo identificar la empresa donante.")
        return
      }
    }

    if (tipoOrigen === "donacion") {
      const montoDonacion = Number(donacionJuridicaSeleccionada?.monto_total || 0)
      const diferencia = Math.abs(costoTotalNumero - montoDonacion)

      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la donación.")
        return
      }

      if (diferencia > 0.01) {
        alert(
          `El total de los productos (${costoTotalNumero.toFixed(2)}) debe coincidir con el monto de la donación jurídica (${montoDonacion.toFixed(2)}).`
        )
        return
      }
    }

    if (tipoOrigen === "devolucion") {
      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la devolución.")
        return
      }

      const esAlmacenCentral = (almacenSeleccionado?.nombre || "")
        .toLowerCase()
        .includes("central")

      if (!esAlmacenCentral) {
        const confirmar = window.confirm(
          "La devolución normalmente debe ingresar al almacén central. ¿Desea continuar de todos modos?"
        )
        if (!confirmar) return
      }
    }

    const itemsValidos = items
      .map((item) => ({
        ...item,
        cantidadNumero: Number(item.cantidad),
        costoUnitarioNumero: Number(item.costo_unitario),
        costoTotalNumero:
          Number(item.cantidad || 0) * Number(item.costo_unitario || 0),
      }))
      .filter((item) => {
        const cantidadValida =
          item.producto_id &&
          item.cantidad !== "" &&
          !Number.isNaN(item.cantidadNumero) &&
          item.cantidadNumero > 0

        const costoValido =
          item.costo_unitario !== "" &&
          !Number.isNaN(item.costoUnitarioNumero) &&
          item.costoUnitarioNumero >= 0

        if (
          tipoOrigen === "compra" ||
          tipoOrigen === "donacion" ||
          tipoOrigen === "devolucion"
        ) {
          return cantidadValida && costoValido
        }

        return cantidadValida
      })

    if (itemsValidos.length === 0) {
      alert("Agregue al menos un producto válido.")
      return
    }

    const productosDuplicados = new Set<string>()
    const repetidos = new Set<string>()

    for (const item of itemsValidos) {
      if (productosDuplicados.has(item.producto_id)) {
        repetidos.add(item.producto_id)
      }
      productosDuplicados.add(item.producto_id)
    }

    if (repetidos.size > 0) {
      alert("Hay productos repetidos en la misma entrada. Unifique las cantidades.")
      return
    }

    if (tipoOrigen === "compra") {
      if (!proveedorId && !proveedorManual.trim()) {
        alert("Seleccione un proveedor registrado o ingrese un proveedor manual.")
        return
      }

      if (!fechaCompra) {
        alert("Ingrese la fecha de compra.")
        return
      }

      if (costoTotalNumero <= 0) {
        alert("Ingrese precios válidos en los productos de la compra.")
        return
      }

      if (!metodoPago) {
        alert("Seleccione un método de pago.")
        return
      }

      if (montoPagadoNumero < 0) {
        alert("El monto pagado no puede ser negativo.")
        return
      }
    }

    setGuardandoEdicion(true)

    try {
      const { data: entradaAnterior, error: entradaAnteriorError } = await supabase
        .from("entradas_inventario")
        .select("id,almacen_id,tipo_origen,monto_pagado")
        .eq("id", entradaEditandoId)
        .single()

      if (entradaAnteriorError || !entradaAnterior) {
        throw new Error(entradaAnteriorError?.message || "No se encontró la entrada original.")
      }

      const { data: itemsAnteriores, error: itemsAnterioresError } = await supabase
        .from("entradas_inventario_items")
        .select("id,producto_id,cantidad")
        .eq("entrada_id", entradaEditandoId)

      if (itemsAnterioresError) {
        throw new Error(itemsAnterioresError.message)
      }

      const { data: pagosActuales, error: pagosActualesError } = await supabase
  .from("pagos_entrada_inventario")
  .select("id,monto,fecha_pago,created_at")
  .eq("entrada_id", entradaEditandoId)

if (pagosActualesError) {
  throw new Error(pagosActualesError.message)
}

const montoPagadoRegistrado = (pagosActuales || []).reduce(
  (acc, pago) => acc + Number(pago.monto || 0),
  0
)

if (tipoOrigen !== "compra" && montoPagadoRegistrado > 0) {
  alert("Esta entrada ya tiene pagos registrados. No puede cambiarse a un tipo sin control de pago.")
  return
}

      for (const itemAnterior of itemsAnteriores || []) {
        await ajustarStockItem(
          entradaAnterior.almacen_id,
          itemAnterior.producto_id,
          -Number(itemAnterior.cantidad || 0)
        )

        const { error: movimientoReversionError } = await supabase
  .from("movimientos_stock")
  .insert([
    {
      producto_id: itemAnterior.producto_id,
      almacen_destino_id: entradaAnterior.almacen_id,
      tipo_movimiento: "entrada_manual",
      cantidad: Number(itemAnterior.cantidad || 0),
      motivo: `Reversión por edición de entrada ${entradaEditandoId}`,
    },
  ])

        if (movimientoReversionError) {
          throw new Error(movimientoReversionError.message)
        }
      }

      const { error: deleteItemsError } = await supabase
        .from("entradas_inventario_items")
        .delete()
        .eq("entrada_id", entradaEditandoId)

      if (deleteItemsError) {
        throw new Error(deleteItemsError.message)
      }

      let urlComprobanteFinal: string | null = null

      const { data: comprobanteActualRes } = await supabase
        .from("entradas_inventario")
        .select("comprobante_url")
        .eq("id", entradaEditandoId)
        .single()

      urlComprobanteFinal = comprobanteActualRes?.comprobante_url || null

      if (comprobanteFile) {
        urlComprobanteFinal = await subirComprobante(comprobanteFile)
      }

      const proveedorSeleccionadoFinal =
        proveedores.find((p) => p.id === proveedorId) || null

      const nombreProveedorFinal =
        proveedorSeleccionadoFinal?.nombre || proveedorManual.trim() || null

      const costoTotalNuevo = itemsValidos.reduce(
        (acc, item) => acc + item.costoTotalNumero,
        0
      )

      let montoPagadoRealFinal = montoPagadoRegistrado

if (tipoOrigen === "compra") {
  const ajustePagos = await sincronizarPagosCompraAlEditar(
    entradaEditandoId,
    costoTotalNuevo
  )

  montoPagadoRealFinal = ajustePagos.totalPagadoFinal
} else {
  montoPagadoRealFinal = 0
}

      const montoPagadoFinal =
  tipoOrigen === "compra"
    ? montoPagadoRealFinal
    : 0

const saldoPendienteFinal =
  tipoOrigen === "compra"
    ? Math.max(costoTotalNuevo - montoPagadoFinal, 0)
    : 0

const estadoPagoFinal =
  tipoOrigen === "compra"
    ? calcularEstadoPagoLocal(costoTotalNuevo, montoPagadoFinal)
    : null

      const proveedorTextoFinal =
        tipoOrigen === "donacion"
          ? empresaDonante.trim() || null
          : tipoOrigen === "devolucion"
          ? proveedorManual.trim() || "Devolución de clínica / almacén externo"
          : nombreProveedorFinal


          let fechaPagoFinalCabecera: string | null = null

if (tipoOrigen === "compra") {
  const { data: pagosFinales, error: pagosFinalesError } = await supabase
    .from("pagos_entrada_inventario")
    .select("fecha_pago")
    .eq("entrada_id", entradaEditandoId)

  if (pagosFinalesError) {
    throw new Error(pagosFinalesError.message)
  }

  const ultimoPago = [...(pagosFinales || [])]
    .filter((p) => p.fecha_pago)
    .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)))[0]

  fechaPagoFinalCabecera = ultimoPago?.fecha_pago || null
}

      const { error: updateEntradaError } = await supabase
        .from("entradas_inventario")
        .update({
          almacen_id: almacenId,
          motivo: motivoLabel,
          observacion: observacion.trim() || null,
          tipo_origen: tipoOrigen,
          proveedor_id: tipoOrigen === "compra" ? proveedorId || null : null,
          proveedor: proveedorTextoFinal,
          empresa_donante: tipoOrigen === "donacion" ? empresaDonante.trim() || null : null,
          donacion_juridica_id: tipoOrigen === "donacion" ? donacionJuridicaId || null : null,
          costo_total:
            tipoOrigen === "compra" ||
            tipoOrigen === "donacion" ||
            tipoOrigen === "devolucion"
              ? costoTotalNuevo
              : 0,
          metodo_pago: tipoOrigen === "compra" ? metodoPago || null : null,
          estado_pago: estadoPagoFinal,
          monto_pagado: montoPagadoFinal,
          saldo_pendiente: saldoPendienteFinal,
          fecha_compra: fechaCompra || null,
          fecha_vencimiento: tipoOrigen === "compra" ? fechaVencimiento || null : null,
          fecha_pago: tipoOrigen === "compra" ? fechaPagoFinalCabecera : null,
          comprobante_url: urlComprobanteFinal,

          editado: true,
          fecha_ultima_edicion: new Date().toISOString(),
          motivo_edicion: "Edición manual desde historial de entradas",
        })
        .eq("id", entradaEditandoId)

        

      if (updateEntradaError) {
        throw new Error(updateEntradaError.message)
      }

      const itemsParaHistorico = itemsValidos.map((item) => {
        const producto = productoDeItem(item.producto_id)

        return {
          entrada_id: entradaEditandoId,
          producto_id: item.producto_id,
          cantidad: item.cantidadNumero,
          unidad: producto?.unidad_base || "unidad",
          costo_unitario:
            tipoOrigen === "compra" ||
            tipoOrigen === "donacion" ||
            tipoOrigen === "devolucion"
              ? item.costoUnitarioNumero
              : 0,
          costo_total:
            tipoOrigen === "compra" ||
            tipoOrigen === "donacion" ||
            tipoOrigen === "devolucion"
              ? item.costoTotalNumero
              : 0,
        }
      })

      const { error: insertItemsError } = await supabase
        .from("entradas_inventario_items")
        .insert(itemsParaHistorico)

      if (insertItemsError) {
        throw new Error(insertItemsError.message)
      }

      for (const itemNuevo of itemsValidos) {
        await ajustarStockItem(
          almacenId,
          itemNuevo.producto_id,
          itemNuevo.cantidadNumero
        )

        const { error: movimientoError } = await supabase
          .from("movimientos_stock")
          .insert([
            {
              producto_id: itemNuevo.producto_id,
              almacen_destino_id: almacenId,
              tipo_movimiento: "entrada_manual",
              cantidad: itemNuevo.cantidadNumero,
              motivo: `Aplicación por edición de entrada ${entradaEditandoId} - ${motivoLabel}`,
            },
          ])

        if (movimientoError) {
          throw new Error(movimientoError.message)
        }
      }

      alert("Entrada editada correctamente.")
      resetFormulario()
      router.push("/admin/inventario/entrada")
      await cargarDatos()
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo editar la entrada: ${error.message || "error interno"}`)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/inventario"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a Inventario
          </Link>

          <Link
            href="/admin/proveedores"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Proveedores
          </Link>

          <Link
            href="/admin/inventario/entradas"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Historial de entradas
          </Link>

          <Link
            href="/admin/inventario/stock"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Stock por almacén
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
          <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0F6D6A]">
                {modoEdicion ? "Editar entrada" : "Registrar entrada premium"}
              </h1>
              <p className="text-gray-500 mt-2">
                {modoEdicion
                  ? "Edite la entrada y el sistema ajustará stock, historial y valores sincronizados."
                  : "Controle inventario, compras, donaciones, devoluciones y cuentas pendientes desde un solo lugar."}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500">Productos válidos</p>
                <p className="text-xl font-bold text-[#0F6D6A]">{totalItemsValidos}</p>
              </div>

              <div className="bg-[#F47C3C]/10 border border-[#F47C3C]/20 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500">Unidades</p>
                <p className="text-xl font-bold text-[#F47C3C]">{totalUnidades}</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500">
                  {tipoOrigen === "devolucion" ? "Valor recuperado" : "Pagado"}
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  Bs {(tipoOrigen === "devolucion" ? costoTotalNumero : montoPagadoNumero).toFixed(2)}
                </p>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500">
                  {tipoOrigen === "devolucion" ? "No pendiente" : "Pendiente"}
                </p>
                <p className="text-xl font-bold text-red-500">
                  Bs {(tipoOrigen === "devolucion" ? 0 : saldoPendienteNumero).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {cargandoDatos ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              Cargando datos...
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (modoEdicion) {
                  guardarEdicionEntrada()
                } else {
                  registrarEntrada(e)
                }
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 rounded-3xl p-5">
                    <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
                      Información general
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Almacén
                        </label>
                        <select
                          value={almacenId}
                          onChange={(e) => setAlmacenId(e.target.value)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        >
                          <option value="">Seleccione...</option>
                          {almacenes.map((almacen) => (
                            <option key={almacen.id} value={almacen.id}>
                              {almacen.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Motivo operativo
                        </label>
                        <select
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        >
                          <option value="compra">Compra</option>
                          <option value="donacion">Donación</option>
                          <option value="ajuste_inicial">Ajuste inicial</option>
                          <option value="reposicion">Reposición</option>
                          <option value="devolucion">Devolución</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tipo de origen
                        </label>
                        <select
                          value={tipoOrigen}
                          onChange={(e) => setTipoOrigen(e.target.value as TipoOrigen)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        >
                          <option value="compra">Compra</option>
                          <option value="donacion">Donación</option>
                          <option value="ajuste">Ajuste</option>
                          <option value="devolucion">Devolución</option>
                        </select>
                      </div>

                      {tipoOrigen === "donacion" && (
                        <>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Donación jurídica vinculada
                            </label>
                            <select
                              value={donacionJuridicaId}
                              onChange={(e) => setDonacionJuridicaId(e.target.value)}
                              className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                            >
                              <option value="">Seleccione...</option>
                              {donacionesJuridicas.map((donacion) => (
                                <option key={donacion.id} value={donacion.id}>
                                  {donacion.empresa} · {donacion.fecha} · Bs{" "}
                                  {Number(donacion.monto_total || 0).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Empresa donante
                            </label>
                            <input
                              value={empresaDonante}
                              readOnly
                              placeholder="Se completa al elegir la donación"
                              className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 bg-gray-100"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Proveedor registrado
                        </label>
                        <select
                          value={proveedorId}
                          onChange={(e) => {
                            setProveedorId(e.target.value)
                            if (e.target.value) setProveedorManual("")
                          }}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                          disabled={tipoOrigen === "ajuste" || tipoOrigen === "devolucion"}
                        >
                          <option value="">Seleccione...</option>
                          {proveedores.map((proveedor) => (
                            <option key={proveedor.id} value={proveedor.id}>
                              {proveedor.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {tipoOrigen === "devolucion" ? "Origen de la devolución" : "O proveedor manual"}
                        </label>
                        <input
                          value={proveedorManual}
                          onChange={(e) => {
                            setProveedorManual(e.target.value)
                            if (e.target.value.trim()) setProveedorId("")
                          }}
                          placeholder={
                            tipoOrigen === "devolucion"
                              ? "Ej: Clínica X / devolución de convenio"
                              : "Ej: Proveedor no registrado"
                          }
                          disabled={tipoOrigen === "ajuste"}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Fecha de compra / ingreso
                        </label>
                        <input
                          type="date"
                          value={fechaCompra}
                          onChange={(e) => setFechaCompra(e.target.value)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        />
                      </div>
                    </div>

                    <div className="mt-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Observación general
                      </label>
                      <textarea
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        rows={3}
                        placeholder="Ej: Compra general de insumos de marzo..."
                        className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="bg-[#F47C3C]/5 border border-[#F47C3C]/10 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <div>
                        <h2 className="text-xl font-bold text-[#0F6D6A]">
                          Productos de la entrada
                        </h2>
                        <p className="text-sm text-gray-500">
                          Agregue todos los productos que llegaron en este ingreso.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={agregarItem}
                        className="px-4 py-2 rounded-xl bg-[#F47C3C] text-white font-semibold hover:bg-[#db6d31] transition"
                      >
                        + Agregar producto
                      </button>
                    </div>

                    <div className="space-y-4">
                      {items.map((item, index) => {
                        const producto = productoDeItem(item.producto_id)
                        const unidad = producto?.unidad_base || "unidad"
                        const subtotalItem =
                          toNumber(item.cantidad) * toNumber(item.costo_unitario)

                        return (
                          <div
                            key={item.localId}
                            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                              <div className="md:col-span-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Producto #{index + 1}
                                </label>
                                <select
                                  value={item.producto_id}
                                  onChange={(e) =>
                                    actualizarItem(item.localId, "producto_id", e.target.value)
                                  }
                                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                                >
                                  <option value="">Seleccione...</option>
                                  {productos.map((producto) => (
                                    <option key={producto.id} value={producto.id}>
                                      {producto.nombre}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Cantidad
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={item.cantidad}
                                  onChange={(e) =>
                                    actualizarItem(item.localId, "cantidad", e.target.value)
                                  }
                                  placeholder="Ej: 20"
                                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Unidad
                                </label>
                                <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-700">
                                  {unidad}
                                </div>
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Precio unitario
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.costo_unitario}
                                  onChange={(e) =>
                                    actualizarItem(item.localId, "costo_unitario", e.target.value)
                                  }
                                  placeholder="Bs 0.00"
                                  disabled={tipoOrigen === "ajuste"}
                                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                                />
                              </div>

                              <div className="md:col-span-1">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Subtotal
                                </label>
                                <div className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-3 text-emerald-700 font-bold text-sm text-center">
                                  Bs {subtotalItem.toFixed(2)}
                                </div>
                              </div>

                              <div className="md:col-span-1">
                                <button
                                  type="button"
                                  onClick={() => eliminarItem(item.localId)}
                                  disabled={items.length === 1}
                                  className="w-full px-3 py-3 rounded-2xl bg-red-100 text-red-700 font-bold disabled:opacity-50"
                                  title="Eliminar producto"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {mostrarBloqueFinanzas && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5">
                      <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
                        Finanzas de la compra
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Costo total calculado
                          </label>
                          <div className="w-full border border-emerald-100 bg-emerald-50 rounded-2xl px-4 py-3 text-emerald-700 font-bold">
                            Bs {costoTotalNumero.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Método de pago
                          </label>
                          <select
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                          >
                            <option value="">Seleccione...</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="qr">QR</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="credito">Crédito</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Estado del pago
                          </label>
                          <select
                            value={estadoPago}
                            onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
                            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                          >
                            <option value="">Seleccione...</option>
                            <option value="pagado">Pagado</option>
                            <option value="parcial">Pago parcial</option>
                            <option value="pendiente">Pendiente</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Monto pagado (Bs)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={montoPagado}
                            onChange={(e) => setMontoPagado(e.target.value)}
                            disabled={estadoPago === "pagado" || estadoPago === "pendiente"}
                            placeholder="Ej: 200"
                            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Fecha de pago
                          </label>
                          <input
                            type="date"
                            value={fechaPago}
                            onChange={(e) => setFechaPago(e.target.value)}
                            disabled={estadoPago === "pendiente"}
                            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Fecha de vencimiento
                          </label>
                          <input
                            type="date"
                            value={fechaVencimiento}
                            onChange={(e) => setFechaVencimiento(e.target.value)}
                            disabled={estadoPago === "pagado"}
                            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
                          />
                        </div>

                        <div className="md:col-span-2 xl:col-span-3">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Comprobante de pago
                          </label>

                          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              onChange={(e) =>
                                setComprobanteFile(e.target.files?.[0] || null)
                              }
                              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-[#0F6D6A] file:px-4 file:py-2 file:text-white"
                            />

                            <p className="text-xs text-gray-500 mt-2">
                              Formatos permitidos: JPG, PNG, WEBP o PDF.
                            </p>

                            {comprobanteFile && (
                              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
                                Archivo seleccionado: <span className="font-semibold">{comprobanteFile.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-white border border-gray-200 p-4">
                          <p className="text-sm text-gray-500">Costo total</p>
                          <p className="text-2xl font-bold text-[#0F6D6A]">
                            Bs {costoTotalNumero.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-emerald-100 p-4">
                          <p className="text-sm text-gray-500">Monto pagado</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            Bs {montoPagadoNumero.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-red-100 p-4">
                          <p className="text-sm text-gray-500">Saldo pendiente</p>
                          <p className="text-2xl font-bold text-red-500">
                            Bs {saldoPendienteNumero.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tipoOrigen === "devolucion" && (
                    <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5">
                      <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
                        Recuperación por devolución
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-white border border-blue-100 p-4">
                          <p className="text-sm text-gray-500">Valor recuperado</p>
                          <p className="text-2xl font-bold text-blue-700">
                            Bs {costoTotalNumero.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-emerald-100 p-4">
                          <p className="text-sm text-gray-500">Pagado</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            Bs 0.00
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white border border-gray-200 p-4">
                          <p className="text-sm text-gray-500">Tratamiento contable</p>
                          <p className="text-base font-bold text-[#0F6D6A]">
                            Recuperación de insumos
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm sticky top-6">
                    <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
                      Resumen inteligente
                    </h2>

                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Almacén</span>
                        <span>{almacenSeleccionado?.nombre || "-"}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Motivo</span>
                        <span>{motivoLabel}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Origen</span>
                        <span className="capitalize">{tipoOrigen}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Proveedor</span>
                        <span className="text-right">{nombreProveedorResumen}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Productos válidos</span>
                        <span>{totalItemsValidos}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Unidades</span>
                        <span>{totalUnidades}</span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Observación</span>
                        <span className="text-right max-w-[180px] truncate">
                          {observacion.trim() || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="my-5 border-t border-dashed border-gray-200" />

                    {tipoOrigen === "compra" ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Estado</span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              estadoPago === "pagado"
                                ? "bg-emerald-100 text-emerald-700"
                                : estadoPago === "parcial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {estadoPago || "-"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Método</span>
                          <span className="capitalize">{metodoPago || "-"}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Total</span>
                          <span className="font-bold text-[#0F6D6A]">
                            Bs {costoTotalNumero.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Pagado</span>
                          <span className="font-bold text-emerald-600">
                            Bs {montoPagadoNumero.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Pendiente</span>
                          <span className="font-bold text-red-500">
                            Bs {saldoPendienteNumero.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-700">Comprobante</span>
                          <span>{comprobanteFile ? "Listo para subir" : "Sin archivo"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 p-4 text-sm text-[#0F6D6A] space-y-2">
                        {tipoOrigen === "donacion" ? (
                          <>
                            <p>
                              Esta entrada se registrará como <span className="font-bold">donación</span>.
                              No generará cuenta pendiente ni egreso financiero.
                            </p>

                            <p>
                              Donación vinculada:{" "}
                              <span className="font-bold">
                                {donacionJuridicaSeleccionada?.empresa || "-"}
                              </span>
                            </p>

                            <p>
                              Monto jurídico:{" "}
                              <span className="font-bold">
                                Bs {montoDonacionSeleccionada.toFixed(2)}
                              </span>
                            </p>

                            <p>
                              Total de productos:{" "}
                              <span className="font-bold">
                                Bs {costoTotalNumero.toFixed(2)}
                              </span>
                            </p>

                            <p>
                              Estado:{" "}
                              <span
                                className={`font-bold ${
                                  donacionCuadra ? "text-emerald-600" : "text-red-500"
                                }`}
                              >
                                {donacionCuadra ? "Cuadra correctamente" : "No coincide con la donación"}
                              </span>
                            </p>
                          </>
                        ) : tipoOrigen === "devolucion" ? (
                          <>
                            <p>
                              Esta entrada se registrará como <span className="font-bold">devolución</span>.
                              Sumará stock, guardará valor contable y no generará cuenta por pagar.
                            </p>

                            <p>
                              Valor recuperado:{" "}
                              <span className="font-bold">
                                Bs {costoTotalNumero.toFixed(2)}
                              </span>
                            </p>

                            <p>
                              Estado: <span className="font-bold text-blue-700">Recuperado</span>
                            </p>
                          </>
                        ) : (
                          <p>
                            Esta entrada se registrará como ajuste operativo. No generará control financiero.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                {modoEdicion ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetFormulario()
                      router.push("/admin/inventario/entrada")
                    }}
                    className="px-6 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold text-center"
                  >
                    Cancelar edición
                  </button>
                ) : (
                  <Link
                    href="/admin/inventario"
                    className="px-6 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold text-center"
                  >
                    Cancelar
                  </Link>
                )}

                <button
                  type="submit"
                  disabled={guardando || guardandoEdicion}
                  className="px-6 py-3 rounded-2xl bg-[#F47C3C] text-white font-semibold disabled:opacity-60"
                >
                  {guardando || guardandoEdicion
                    ? modoEdicion
                      ? "Guardando cambios..."
                      : "Registrando..."
                    : modoEdicion
                    ? "Guardar cambios"
                    : "Registrar entrada premium"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

{mostrarModalComprobante && entradaCreadaId && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="w-full max-w-2xl bg-white rounded-[28px] shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-[#0F6D6A] to-[#159895] text-white p-6">
        <p className="text-sm opacity-90">🐾 Fundación Rugimos</p>
        <h3 className="text-2xl font-bold mt-1">Entrada registrada correctamente</h3>
        <p className="text-white/90 mt-2">
          El comprobante interno ya está listo para visualizar e imprimir.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#0F6D6A]/15 bg-[#0F6D6A]/5 p-4">
            <p className="text-xs text-gray-500">Nº comprobante</p>
            <p className="text-lg font-bold text-[#0F6D6A]">
              {numeroComprobanteCreado}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs text-gray-500">Productos</p>
            <p className="text-lg font-bold text-emerald-600">
              {resumenComprobante?.productos ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-amber-600">
              Bs {(resumenComprobante?.total ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
<Link
  href={`/admin/inventario/entradas/${entradaCreadaId}/comprobante`}
  target="_blank"
  className="px-4 py-3 rounded-2xl bg-[#0F6D6A] text-white font-semibold shadow hover:opacity-95"
>
  Ver comprobante
</Link>

<Link
  href={`/admin/inventario/entradas/${entradaCreadaId}/comprobante?print=1`}
  target="_blank"
  className="px-4 py-3 rounded-2xl bg-white border border-gray-300 text-gray-800 font-semibold shadow-sm hover:bg-gray-50"
>
  Abrir para imprimir
</Link>

          <button
            type="button"
            onClick={() => {
              setMostrarModalComprobante(false)
              setEntradaCreadaId(null)
              setNumeroComprobanteCreado("")
            }}
            className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  )
}

export default function InventarioEntradaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center text-gray-500">
              Cargando entrada...
            </div>
          </div>
        </div>
      }
    >
      <InventarioEntradaContent />
    </Suspense>
  )
}

