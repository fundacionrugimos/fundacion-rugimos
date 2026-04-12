"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id: string
  nome?: string | null
  zona?: string | null
}

type Almacen = {
  id: string
  nombre?: string | null
  tipo?: string | null
  clinica_id?: string | null
}

type Producto = {
  id: string
  nombre: string
  unidad_base: string | null
  contenido_por_unidad: number | null
  unidad_compra: string | null
  unidad_fraccionada: string | null
  fraccionable: boolean | null
  activo?: boolean | null
  solicitavel_clinica?: boolean | null
  categoria_pedido?: string | null
  orden_pedido?: number | null
}

type PedidoItem = {
  id: string
  pedido_id: string
  producto_id: string
  producto_nombre: string
  cantidad_solicitada: number
  unidad_solicitada: string | null
  cantidad_aprobada: number | null
}

type PedidoClinica = {
  id: string
  clinica_id: string
  almacen_destino_id: string
  fecha_solicitada: string | null
  observaciones: string | null
  estado: string | null
  transferencia_id: string | null
  aprobado_por: string | null
  fecha_aprobacion: string | null
  rechazado_por: string | null
  fecha_rechazo: string | null
  motivo_rechazo: string | null
  delivery_estado: string | null
  delivery_asignado: string | null
  fecha_entregado: string | null
  created_at: string
  updated_at: string
  clinica?: Clinica | null
  almacen?: Almacen | null
  items?: PedidoItem[]
}

type FiltroEstado =
  | "todos"
  | "enviado"
  | "revisado"
  | "aprobado"
  | "rechazado"
  | "convertido"
  | "entregado"

type EditableItem = {
  temp_id: string
  producto_id: string
  producto_nombre: string
  cantidad_solicitada: number
  unidad_solicitada: string
  cantidad_aprobada: number | null
}

function normalizarEstado(estado: string | null | undefined) {
  return (estado || "").trim().toLowerCase()
}

function formatearFecha(valor?: string | null) {
  if (!valor) return "-"
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return fecha.toLocaleString("es-BO")
}

function formatearFechaCorta(valor?: string | null) {
  if (!valor) return "-"
  const [year, month, day] = valor.split("-")
  if (!year || !month || !day) return valor
  return `${day}/${month}/${year}`
}

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function colorEstado(estado: string | null | undefined) {
  const e = normalizarEstado(estado)

  if (e === "enviado") return "bg-blue-100 text-blue-700 border-blue-200"
  if (e === "revisado") return "bg-amber-100 text-amber-700 border-amber-200"
  if (e === "aprobado") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (e === "rechazado") return "bg-red-100 text-red-700 border-red-200"
  if (e === "convertido") return "bg-teal-100 text-teal-700 border-teal-200"
  if (e === "entregado") return "bg-purple-100 text-purple-700 border-purple-200"

  return "bg-gray-100 text-gray-700 border-gray-200"
}

function labelEstado(estado: string | null | undefined) {
  const e = normalizarEstado(estado)
  if (!e) return "PENDIENTE"
  return e.toUpperCase()
}

function obtenerUnidadPedido(producto: Producto) {
  return (
    producto.unidad_compra ||
    producto.unidad_base ||
    producto.unidad_fraccionada ||
    "unidad"
  )
}

function pedidoFueEntregado(pedido?: PedidoClinica | null) {
  if (!pedido) return false

  return (
    normalizarEstado(pedido.estado) === "entregado" ||
    normalizarEstado(pedido.delivery_estado) === "entregado" ||
    !!pedido.fecha_entregado
  )
}

export default function AdminInventarioPedidosClinicasPage() {
  const [cargando, setCargando] = useState(true)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [generandoTransferenciaId, setGenerandoTransferenciaId] = useState<string | null>(null)
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState<string | null>(null)

  const [pedidos, setPedidos] = useState<PedidoClinica[]>([])
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([])
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [pedidoExpandidoId, setPedidoExpandidoId] = useState<string | null>(null)

  const [editandoPedidoId, setEditandoPedidoId] = useState<string | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [nuevoProductoId, setNuevoProductoId] = useState("")
  const [nuevaCantidad, setNuevaCantidad] = useState("1")

  async function cargarTodo() {
    setCargando(true)

    const [pedidosRes, itemsRes, clinicasRes, almacenesRes, productosRes] = await Promise.all([
      supabase
        .from("pedidos_clinicas")
        .select(`
          id,
          clinica_id,
          almacen_destino_id,
          fecha_solicitada,
          observaciones,
          estado,
          transferencia_id,
          aprobado_por,
          fecha_aprobacion,
          rechazado_por,
          fecha_rechazo,
          motivo_rechazo,
          delivery_estado,
          delivery_asignado,
          fecha_entregado,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false }),

      supabase
        .from("pedidos_clinicas_items")
        .select(`
          id,
          pedido_id,
          producto_id,
          producto_nombre,
          cantidad_solicitada,
          unidad_solicitada,
          cantidad_aprobada
        `)
        .order("created_at", { ascending: true }),

      supabase
        .from("clinicas")
        .select("id,nome,zona"),

      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id"),

      supabase
        .from("productos")
        .select(`
          id,
          nombre,
          unidad_base,
          contenido_por_unidad,
          unidad_compra,
          unidad_fraccionada,
          fraccionable,
          activo,
          solicitavel_clinica,
          categoria_pedido,
          orden_pedido
        `)
        .eq("activo", true)
        .order("categoria_pedido", { ascending: true })
        .order("orden_pedido", { ascending: true })
        .order("nombre", { ascending: true }),
    ])

    if (pedidosRes.error) console.log("Error cargando pedidos:", pedidosRes.error)
    if (itemsRes.error) console.log("Error cargando items:", itemsRes.error)
    if (clinicasRes.error) console.log("Error cargando clínicas:", clinicasRes.error)
    if (almacenesRes.error) console.log("Error cargando almacenes:", almacenesRes.error)
    if (productosRes.error) console.log("Error cargando productos catálogo:", productosRes.error)

    const pedidosData = (pedidosRes.data as PedidoClinica[]) || []
    const itemsData = (itemsRes.data as PedidoItem[]) || []
    const clinicasData = (clinicasRes.data as Clinica[]) || []
    const almacenesData = (almacenesRes.data as Almacen[]) || []
    const productosData = (productosRes.data as Producto[]) || []

    const mapaClinicas = new Map<string, Clinica>()
    clinicasData.forEach((clinica) => {
      mapaClinicas.set(clinica.id, clinica)
    })

    const mapaAlmacenes = new Map<string, Almacen>()
    almacenesData.forEach((almacen) => {
      mapaAlmacenes.set(almacen.id, almacen)
    })

    const mapaItems = new Map<string, PedidoItem[]>()
    itemsData.forEach((item) => {
      const lista = mapaItems.get(item.pedido_id) || []
      lista.push(item)
      mapaItems.set(item.pedido_id, lista)
    })

    const pedidosCompletos: PedidoClinica[] = pedidosData.map((pedido) => ({
      ...pedido,
      clinica: mapaClinicas.get(pedido.clinica_id) || null,
      almacen: mapaAlmacenes.get(pedido.almacen_destino_id) || null,
      items: mapaItems.get(pedido.id) || [],
    }))

    setPedidos(pedidosCompletos)
    setProductosCatalogo(productosData)

    if (!pedidoExpandidoId && pedidosCompletos.length > 0) {
      setPedidoExpandidoId(pedidosCompletos[0].id)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contadores = useMemo(() => {
    return {
      todos: pedidos.length,
      enviado: pedidos.filter((p) => normalizarEstado(p.estado) === "enviado").length,
      revisado: pedidos.filter((p) => normalizarEstado(p.estado) === "revisado").length,
      aprobado: pedidos.filter((p) => normalizarEstado(p.estado) === "aprobado").length,
      rechazado: pedidos.filter((p) => normalizarEstado(p.estado) === "rechazado").length,
      convertido: pedidos.filter((p) => normalizarEstado(p.estado) === "convertido").length,
      entregado: pedidos.filter((p) => normalizarEstado(p.estado) === "entregado").length,
    }
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    let base = [...pedidos]

    if (filtroEstado !== "todos") {
      base = base.filter((pedido) => normalizarEstado(pedido.estado) === filtroEstado)
    }

    const texto = busqueda.trim().toLowerCase()
    if (!texto) return base

    return base.filter((pedido) => {
      const nombreClinica = (pedido.clinica?.nome || "").toLowerCase()
      const almacen = (pedido.almacen?.nombre || "").toLowerCase()
      const obs = (pedido.observaciones || "").toLowerCase()
      const idCorto = pedido.id.slice(0, 8).toLowerCase()
      const productos = (pedido.items || [])
        .map((item) => item.producto_nombre.toLowerCase())
        .join(" ")

      return (
        nombreClinica.includes(texto) ||
        almacen.includes(texto) ||
        obs.includes(texto) ||
        idCorto.includes(texto) ||
        productos.includes(texto)
      )
    })
  }, [pedidos, filtroEstado, busqueda])

  const pedidoExpandido = useMemo(() => {
    return pedidos.find((pedido) => pedido.id === pedidoExpandidoId) || null
  }, [pedidos, pedidoExpandidoId])

  const productosDisponiblesParaAgregar = useMemo(() => {
    const idsEnPedido = new Set(editableItems.map((item) => item.producto_id))
    return productosCatalogo.filter((producto) => !idsEnPedido.has(producto.id))
  }, [productosCatalogo, editableItems])

  async function actualizarEstadoPedido(
    pedidoId: string,
    nuevoEstado: "revisado" | "aprobado" | "rechazado"
  ) {
    setActualizandoId(pedidoId)

    try {
      if (nuevoEstado === "rechazado") {
        const motivo = window.prompt("Motivo del rechazo:")
        if (!motivo || !motivo.trim()) {
          setActualizandoId(null)
          return
        }

        const { error } = await supabase
          .from("pedidos_clinicas")
          .update({
            estado: "rechazado",
            rechazado_por: "admin",
            fecha_rechazo: new Date().toISOString(),
            motivo_rechazo: motivo.trim(),
          })
          .eq("id", pedidoId)

        if (error) {
          console.log("Error rechazando pedido:", error)
          alert("No se pudo rechazar el pedido")
          setActualizandoId(null)
          return
        }

        alert("Pedido rechazado correctamente")
      }

      if (nuevoEstado === "revisado") {
        const { error } = await supabase
          .from("pedidos_clinicas")
          .update({
            estado: "revisado",
          })
          .eq("id", pedidoId)

        if (error) {
          console.log("Error marcando como revisado:", error)
          alert("No se pudo marcar el pedido como revisado")
          setActualizandoId(null)
          return
        }

        alert("Pedido marcado como revisado")
      }

      if (nuevoEstado === "aprobado") {
        const { error } = await supabase
          .from("pedidos_clinicas")
          .update({
            estado: "aprobado",
            aprobado_por: "admin",
            fecha_aprobacion: new Date().toISOString(),
            motivo_rechazo: null,
            rechazado_por: null,
            fecha_rechazo: null,
          })
          .eq("id", pedidoId)

        if (error) {
          console.log("Error aprobando pedido:", error)
          alert("No se pudo aprobar el pedido")
          setActualizandoId(null)
          return
        }

        alert("Pedido aprobado correctamente")
      }

      await cargarTodo()
    } catch (error) {
      console.log("Error general actualizando pedido:", error)
      alert("Ocurrió un error actualizando el pedido")
    }

    setActualizandoId(null)
  }

  async function generarTransferenciaDesdePedido(pedido: PedidoClinica) {
    if (!pedido?.id) {
      alert("Pedido inválido")
      return
    }

    if (!pedido.almacen_destino_id) {
      alert("Este pedido no tiene almacén destino")
      return
    }

    if (!pedido.items || pedido.items.length === 0) {
      alert("Este pedido no tiene productos")
      return
    }

    const estadoPedido = normalizarEstado(pedido.estado)

    if (estadoPedido !== "aprobado" && estadoPedido !== "revisado") {
      alert("Solo se puede generar transferencia desde un pedido aprobado o revisado")
      return
    }

    if (pedido.transferencia_id) {
      alert("Este pedido ya tiene una transferencia vinculada")
      return
    }

    const confirmar = window.confirm(
      `¿Desea generar la transferencia para ${pedido.clinica?.nome || "esta clínica"}?`
    )
    if (!confirmar) return

    setGenerandoTransferenciaId(pedido.id)

    try {
      const { data: almacenCentral, error: almacenCentralError } = await supabase
        .from("almacenes")
        .select("id,nombre,tipo")
        .eq("activo", true)
        .eq("tipo", "central")
        .order("nombre", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (almacenCentralError) {
        console.log("Error buscando almacén central:", almacenCentralError)
        alert("No se pudo encontrar el almacén central")
        setGenerandoTransferenciaId(null)
        return
      }

      if (!almacenCentral?.id) {
        alert("No existe un almacén central activo")
        setGenerandoTransferenciaId(null)
        return
      }

      const productoIds = pedido.items.map((item) => item.producto_id)

      const { data: productosData, error: productosError } = await supabase
        .from("productos")
        .select(`
          id,
          nombre,
          unidad_base,
          contenido_por_unidad,
          unidad_compra,
          unidad_fraccionada,
          fraccionable
        `)
        .in("id", productoIds)

      if (productosError) {
        console.log("Error cargando productos del pedido:", productosError)
        alert("No se pudieron cargar los productos del pedido")
        setGenerandoTransferenciaId(null)
        return
      }

      const mapaProductos = new Map<string, Producto>()
      ;((productosData as Producto[]) || []).forEach((producto) => {
        mapaProductos.set(producto.id, producto)
      })

      const itemsTransferencia = pedido.items.map((item) => {
        const producto = mapaProductos.get(item.producto_id)

        if (!producto) {
          throw new Error(`No se encontró el producto ${item.producto_nombre}`)
        }

        const cantidadBase = Number(
          item.cantidad_aprobada !== null && item.cantidad_aprobada !== undefined
            ? item.cantidad_aprobada
            : item.cantidad_solicitada
        )

        const contenidoPorUnidad = Number(producto.contenido_por_unidad || 1)
        const esFraccionable = Boolean(producto.fraccionable)
        const unidadCompra =
          producto.unidad_compra || producto.unidad_base || "unidad"
        const unidadFraccionada =
          producto.unidad_fraccionada || producto.unidad_base || "unidad"

        return {
          transferencia_id: "",
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          cantidad_base: cantidadBase,
          unidad_compra: unidadCompra,
          contenido_por_unidad: contenidoPorUnidad,
          cantidad_fraccionada: esFraccionable
            ? cantidadBase * contenidoPorUnidad
            : cantidadBase,
          unidad_fraccionada: unidadFraccionada,
        }
      })

      const motivoTransferencia = `Pedido clínica - ${
        pedido.clinica?.nome || "Clínica"
      } - entrega ${pedido.fecha_solicitada || ""}`

      const { data: transferencia, error: errorTransferencia } = await supabase
        .from("transferencias_inventario")
        .insert({
          almacen_origen_id: almacenCentral.id,
          almacen_destino_id: pedido.almacen_destino_id,
          estado: "pendiente",
          motivo: motivoTransferencia,
          entregado_por: "admin",
        })
        .select()
        .single()

      if (errorTransferencia || !transferencia) {
        console.log("Error creando transferencia:", errorTransferencia)
        alert(errorTransferencia?.message || "No se pudo crear la transferencia")
        setGenerandoTransferenciaId(null)
        return
      }

      const itemsParaInsertar = itemsTransferencia.map((item) => ({
        ...item,
        transferencia_id: transferencia.id,
      }))

      const { error: errorItems } = await supabase
        .from("transferencias_inventario_items")
        .insert(itemsParaInsertar)

      if (errorItems) {
        console.log("Error creando items de transferencia:", errorItems)
        alert(errorItems.message || "No se pudieron guardar los items de la transferencia")
        setGenerandoTransferenciaId(null)
        return
      }

      const { error: updatePedidoError } = await supabase
        .from("pedidos_clinicas")
        .update({
          estado: "convertido",
          transferencia_id: transferencia.id,
        })
        .eq("id", pedido.id)

      if (updatePedidoError) {
        console.log("Error vinculando pedido con transferencia:", updatePedidoError)
        alert("La transferencia se creó, pero no se pudo vincular al pedido")
        setGenerandoTransferenciaId(null)
        return
      }

      alert("Transferencia generada correctamente")
      await cargarTodo()
    } catch (error: any) {
      console.log("Error general generando transferencia:", error)
      alert(error?.message || "Ocurrió un error generando la transferencia")
    }

    setGenerandoTransferenciaId(null)
  }

  function iniciarEdicionPedido(pedido: PedidoClinica) {
    if (pedido.transferencia_id) {
      alert("No se puede editar un pedido que ya tiene transferencia vinculada")
      return
    }

    if (pedidoFueEntregado(pedido)) {
      alert("No se puede editar un pedido que ya fue entregado")
      return
    }

    const itemsBase = (pedido.items || []).map((item, index) => ({
      temp_id: item.id || `existente-${index}`,
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      cantidad_solicitada: Number(item.cantidad_solicitada || 0),
      unidad_solicitada: item.unidad_solicitada || "unidad",
      cantidad_aprobada: item.cantidad_aprobada ?? null,
    }))

    setEditandoPedidoId(pedido.id)
    setEditableItems(itemsBase)
    setNuevoProductoId("")
    setNuevaCantidad("1")
  }

  function cancelarEdicionPedido() {
    setEditandoPedidoId(null)
    setEditableItems([])
    setNuevoProductoId("")
    setNuevaCantidad("1")
  }

  function cambiarCantidadEditable(tempId: string, valor: string) {
    const cantidad = Number(valor)
    setEditableItems((prev) =>
      prev.map((item) =>
        item.temp_id === tempId
          ? {
              ...item,
              cantidad_solicitada: Number.isNaN(cantidad) ? 0 : cantidad,
            }
          : item
      )
    )
  }

  function quitarItemEditable(tempId: string) {
    setEditableItems((prev) => prev.filter((item) => item.temp_id !== tempId))
  }

  function agregarProductoEditable() {
    if (!nuevoProductoId) {
      alert("Seleccione un producto")
      return
    }

    const cantidad = Number(nuevaCantidad)

    if (Number.isNaN(cantidad) || cantidad <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    const producto = productosCatalogo.find((p) => p.id === nuevoProductoId)

    if (!producto) {
      alert("Producto no encontrado")
      return
    }

    if (editableItems.some((item) => item.producto_id === nuevoProductoId)) {
      alert("Ese producto ya está en el pedido")
      return
    }

    setEditableItems((prev) => [
      ...prev,
      {
        temp_id: `nuevo-${Date.now()}`,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad_solicitada: cantidad,
        unidad_solicitada: obtenerUnidadPedido(producto),
        cantidad_aprobada: null,
      },
    ])

    setNuevoProductoId("")
    setNuevaCantidad("1")
  }

  async function guardarEdicionPedido(pedido: PedidoClinica) {
    if (!pedido?.id) return

    if (pedidoFueEntregado(pedido)) {
      alert("No se puede editar un pedido que ya fue entregado")
      return
    }

    if (editableItems.length === 0) {
      alert("El pedido debe tener al menos un producto")
      return
    }

    const hayCantidadInvalida = editableItems.some(
      (item) => !item.cantidad_solicitada || Number(item.cantidad_solicitada) <= 0
    )

    if (hayCantidadInvalida) {
      alert("Todas las cantidades deben ser mayores que cero")
      return
    }

    setGuardandoEdicion(true)

    try {
      const { error: deleteError } = await supabase
        .from("pedidos_clinicas_items")
        .delete()
        .eq("pedido_id", pedido.id)

      if (deleteError) {
        console.log("Error eliminando items previos:", deleteError)
        alert("No se pudieron limpiar los productos anteriores del pedido")
        setGuardandoEdicion(false)
        return
      }

      const itemsParaInsertar = editableItems.map((item) => ({
        pedido_id: pedido.id,
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        cantidad_solicitada: Number(item.cantidad_solicitada),
        unidad_solicitada: item.unidad_solicitada || "unidad",
        cantidad_aprobada: item.cantidad_aprobada ?? null,
      }))

      const { error: insertError } = await supabase
        .from("pedidos_clinicas_items")
        .insert(itemsParaInsertar)

      if (insertError) {
        console.log("Error guardando items editados:", insertError)
        alert(insertError.message || "No se pudieron guardar los cambios del pedido")
        setGuardandoEdicion(false)
        return
      }

      alert("Pedido actualizado correctamente")
      cancelarEdicionPedido()
      await cargarTodo()
    } catch (error) {
      console.log("Error general editando pedido:", error)
      alert("Ocurrió un error guardando la edición del pedido")
    }

    setGuardandoEdicion(false)
  }

  async function eliminarPedido(pedido: PedidoClinica) {
    if (!pedido?.id) return

    if (pedido.transferencia_id) {
      alert("No se puede eliminar un pedido que ya tiene transferencia vinculada")
      return
    }

    const confirmar = window.confirm(
      `¿Desea eliminar el pedido #${pedido.id.slice(0, 8).toUpperCase()} de ${pedido.clinica?.nome || "esta clínica"}?`
    )

    if (!confirmar) return

    setEliminandoPedidoId(pedido.id)

    try {
      const { error: deleteItemsError } = await supabase
        .from("pedidos_clinicas_items")
        .delete()
        .eq("pedido_id", pedido.id)

      if (deleteItemsError) {
        console.log("Error eliminando items del pedido:", deleteItemsError)
        alert("No se pudieron eliminar los productos del pedido")
        setEliminandoPedidoId(null)
        return
      }

      const { error: deletePedidoError } = await supabase
        .from("pedidos_clinicas")
        .delete()
        .eq("id", pedido.id)

      if (deletePedidoError) {
        console.log("Error eliminando pedido:", deletePedidoError)
        alert("No se pudo eliminar el pedido")
        setEliminandoPedidoId(null)
        return
      }

      if (pedidoExpandidoId === pedido.id) {
        setPedidoExpandidoId(null)
      }

      if (editandoPedidoId === pedido.id) {
        cancelarEdicionPedido()
      }

      alert("Pedido eliminado correctamente")
      await cargarTodo()
    } catch (error) {
      console.log("Error general eliminando pedido:", error)
      alert("Ocurrió un error eliminando el pedido")
    }

    setEliminandoPedidoId(null)
  }

  function toggleExpandirPedido(id: string) {
    setPedidoExpandidoId((prev) => (prev === id ? null : id))
  }

  function colorCardActivo(
    activo: boolean,
    variante: "normal" | "blue" | "amber" | "green" | "red" | "purple" = "normal"
  ) {
    if (!activo) return "bg-white border-white/50 hover:border-white/80"

    if (variante === "blue") return "bg-blue-50 border-blue-300 shadow-lg"
    if (variante === "amber") return "bg-amber-50 border-amber-300 shadow-lg"
    if (variante === "green") return "bg-emerald-50 border-emerald-300 shadow-lg"
    if (variante === "red") return "bg-red-50 border-red-300 shadow-lg"
    if (variante === "purple") return "bg-purple-50 border-purple-300 shadow-lg"

    return "bg-teal-50 border-teal-300 shadow-lg"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#0F6D6A] border-t-transparent animate-spin mb-5" />
          <h2 className="text-2xl font-bold text-[#0F6D6A]">
            Cargando pedidos clínicos
          </h2>
          <p className="text-gray-600 mt-2">
            Preparando pedidos, clínicas, almacenes e historial...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-6 md:px-8 md:py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-sm font-semibold mb-3">
                <span>Inventario</span>
                <span className="opacity-70">/</span>
                <span>Pedidos clínicas</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Pedidos de clínicas
              </h1>
              <p className="text-white/80 mt-2 text-sm md:text-base max-w-3xl">
                Revise las solicitudes enviadas por las clínicas, edítelas si es necesario
                y conviértalas en transferencias reales de inventario.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/admin/inventario"
                className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
              >
                Volver a inventario
              </Link>

              <Link
                href="/admin/inventario/transferencias-nuevo"
                className="bg-[#F47C3C] text-white px-4 py-2.5 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Ir a transferencias
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <button
            type="button"
            onClick={() => setFiltroEstado("todos")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "todos",
              "normal"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Todos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{contadores.todos}</p>
            <p className="text-xs text-gray-400 mt-2">Vista general</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado("enviado")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "enviado",
              "blue"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Enviados</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{contadores.enviado}</p>
            <p className="text-xs text-gray-400 mt-2">Pendientes de revisión</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado("revisado")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "revisado",
              "amber"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Revisados</p>
            <p className="text-3xl font-bold text-amber-600 mt-2">{contadores.revisado}</p>
            <p className="text-xs text-gray-400 mt-2">Listos para decisión</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado("aprobado")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "aprobado",
              "green"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Aprobados</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{contadores.aprobado}</p>
            <p className="text-xs text-gray-400 mt-2">Pendientes de transferencia</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado("rechazado")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "rechazado",
              "red"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Rechazados</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{contadores.rechazado}</p>
            <p className="text-xs text-gray-400 mt-2">Con motivo registrado</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado("entregado")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroEstado === "entregado",
              "purple"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Entregados</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{contadores.entregado}</p>
            <p className="text-xs text-gray-400 mt-2">Ciclo completado</p>
          </button>
        </div>

        <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0F6D6A]">
                Solicitudes recibidas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Busque, filtre y abra el detalle de cada pedido.
              </p>
            </div>

            <div className="w-full lg:max-w-sm">
              <input
                type="text"
                placeholder="Buscar por clínica, producto, observación o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
              />
            </div>
          </div>
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="bg-white rounded-[28px] shadow-2xl p-10 text-center">
            <div className="text-2xl font-bold text-gray-700">
              No hay pedidos para mostrar
            </div>
            <p className="text-gray-500 mt-2">
              Pruebe con otro filtro o espere nuevas solicitudes de las clínicas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-4">
              {pedidosFiltrados.map((pedido) => {
                const totalItems = pedido.items?.length || 0
                const totalCantidad = (pedido.items || []).reduce(
                  (acc, item) => acc + Number(item.cantidad_solicitada || 0),
                  0
                )
                const expandido = pedidoExpandidoId === pedido.id

                return (
                  <div
                    key={pedido.id}
                    className={`bg-white rounded-[28px] shadow-2xl border transition-all ${
                      expandido ? "border-[#0F6D6A]/25" : "border-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpandirPedido(pedido.id)}
                      className="w-full text-left p-5 md:p-6"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold text-[#0F6D6A]">
                              {pedido.clinica?.nome || "Clínica sin nombre"}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold border ${colorEstado(
                                pedido.estado
                              )}`}
                            >
                              {labelEstado(pedido.estado)}
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                            <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-3">
                              <p className="text-gray-500 text-xs">Pedido</p>
                              <p className="font-bold text-[#0F6D6A] mt-1">
                                #{pedido.id.slice(0, 8).toUpperCase()}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#FFF6F1] border border-[#F8D7C3] p-3">
                              <p className="text-gray-500 text-xs">Entrega solicitada</p>
                              <p className="font-bold text-[#F47C3C] mt-1">
                                {formatearFechaCorta(pedido.fecha_solicitada)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <p className="text-gray-500 text-xs">Almacén destino</p>
                              <p className="font-bold text-gray-800 mt-1">
                                {pedido.almacen?.nombre || "-"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <p className="text-gray-500 text-xs">Creado</p>
                              <p className="font-bold text-gray-800 mt-1">
                                {formatearFecha(pedido.created_at)}
                              </p>
                            </div>
                          </div>

                          {pedido.observaciones && (
                            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                              <p className="text-xs text-gray-500 mb-1">Observaciones</p>
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {pedido.observaciones}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:w-[210px] shrink-0">
                          <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-4 text-center">
                            <p className="text-xs text-gray-500">Productos</p>
                            <p className="text-2xl font-bold text-[#0F6D6A] mt-1">
                              {totalItems}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#FFF6F1] border border-[#F8D7C3] p-4 text-center">
                            <p className="text-xs text-gray-500">Cantidad</p>
                            <p className="text-2xl font-bold text-[#F47C3C] mt-1">
                              {formatearNumero(totalCantidad)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            <div>
              {!pedidoExpandido ? (
                <div className="bg-white rounded-[28px] shadow-2xl p-8 text-center sticky top-6">
                  <div className="text-2xl font-bold text-gray-700">
                    Seleccione un pedido
                  </div>
                  <p className="text-gray-500 mt-2">
                    Abra un pedido para ver el detalle completo y tomar acciones.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6 sticky top-6 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500 font-semibold">
                        Detalle del pedido
                      </p>
                      <h2 className="text-2xl font-bold text-[#0F6D6A] mt-1">
                        {pedidoExpandido.clinica?.nome || "Clínica"}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        #{pedidoExpandido.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${colorEstado(
                        pedidoExpandido.estado
                      )}`}
                    >
                      {labelEstado(pedidoExpandido.estado)}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Entrega solicitada</p>
                      <p className="font-bold text-gray-800 mt-1">
                        {formatearFechaCorta(pedidoExpandido.fecha_solicitada)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Almacén destino</p>
                      <p className="font-bold text-gray-800 mt-1">
                        {pedidoExpandido.almacen?.nombre || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Creado</p>
                      <p className="font-bold text-gray-800 mt-1">
                        {formatearFecha(pedidoExpandido.created_at)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Delivery estado</p>
                      <p className="font-bold text-gray-800 mt-1">
                        {pedidoExpandido.delivery_estado || "pendiente"}
                      </p>
                      {pedidoExpandido.fecha_entregado && (
                        <p className="text-xs text-emerald-600 mt-2">
                          Entregado: {formatearFecha(pedidoExpandido.fecha_entregado)}
                        </p>
                      )}
                    </div>
                  </div>

                  {pedidoExpandido.transferencia_id && (
                    <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4">
                      <p className="text-sm font-semibold text-teal-700">
                        Transferencia vinculada
                      </p>
                      <p className="text-sm text-teal-700 mt-2">
                        #{pedidoExpandido.transferencia_id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  )}

                  {pedidoExpandido.observaciones && (
                    <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4">
                      <p className="text-sm font-semibold text-[#0F6D6A]">
                        Observaciones de la clínica
                      </p>
                      <p className="text-sm text-gray-700 mt-2">
                        {pedidoExpandido.observaciones}
                      </p>
                    </div>
                  )}

                  {pedidoExpandido.motivo_rechazo && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                      <p className="text-sm font-semibold text-red-700">
                        Motivo de rechazo
                      </p>
                      <p className="text-sm text-red-600 mt-2">
                        {pedidoExpandido.motivo_rechazo}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-[#0F6D6A]">
                        Productos solicitados
                      </h3>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {(editandoPedidoId === pedidoExpandido.id
                            ? editableItems.length
                            : pedidoExpandido.items?.length) || 0} ítems
                        </span>

                        {editandoPedidoId !== pedidoExpandido.id && !pedidoExpandido.transferencia_id && !pedidoFueEntregado(pedidoExpandido) && (
                          <button
                            type="button"
                            onClick={() => iniciarEdicionPedido(pedidoExpandido)}
                            className="bg-[#0F6D6A] hover:bg-[#0c5b59] text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                          >
                            Editar pedido
                          </button>
                        )}

                        {!pedidoExpandido.transferencia_id && (
                          <button
                            type="button"
                            disabled={
                              eliminandoPedidoId === pedidoExpandido.id ||
                              editandoPedidoId === pedidoExpandido.id
                            }
                            onClick={() => eliminarPedido(pedidoExpandido)}
                            className="bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-700 border border-red-200 px-3 py-2 rounded-xl text-xs font-bold transition"
                          >
                            {eliminandoPedidoId === pedidoExpandido.id ? "Eliminando..." : "Eliminar pedido"}
                          </button>
                        )}
                      </div>
                    </div>

                    {editandoPedidoId === pedidoExpandido.id ? (
                      <div className="space-y-4">
                        {editableItems.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-500 text-sm">
                            No hay productos. Agregue uno abajo.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                            {editableItems.map((item) => (
                              <div
                                key={item.temp_id}
                                className="rounded-2xl border border-gray-100 p-4"
                              >
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-900 leading-5">
                                        {item.producto_nombre}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Producto ID: {item.producto_id.slice(0, 8).toUpperCase()}
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => quitarItemEditable(item.temp_id)}
                                      className="text-red-600 hover:text-red-700 text-xs font-bold"
                                    >
                                      Quitar
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                                        Cantidad
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={item.cantidad_solicitada}
                                        onChange={(e) =>
                                          cambiarCantidadEditable(item.temp_id, e.target.value)
                                        }
                                        className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                                        Unidad
                                      </label>
                                      <div className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 text-gray-700">
                                        {item.unidad_solicitada}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4 space-y-3">
                          <p className="text-sm font-semibold text-[#0F6D6A]">
                            Agregar otro producto
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
                            <select
                              value={nuevoProductoId}
                              onChange={(e) => setNuevoProductoId(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                            >
                              <option value="">Seleccionar producto...</option>
                              {productosDisponiblesParaAgregar.map((producto) => (
                                <option key={producto.id} value={producto.id}>
                                  {producto.nombre}
                                  {producto.categoria_pedido ? ` - ${producto.categoria_pedido}` : ""}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={nuevaCantidad}
                              onChange={(e) => setNuevaCantidad(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                            />

                            <button
                              type="button"
                              onClick={agregarProductoEditable}
                              className="bg-[#F47C3C] hover:bg-[#db6d31] text-white px-4 py-2 rounded-xl font-bold transition"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={guardandoEdicion}
                            onClick={() => guardarEdicionPedido(pedidoExpandido)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-2xl font-bold transition"
                          >
                            {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                          </button>

                          <button
                            type="button"
                            disabled={guardandoEdicion}
                            onClick={cancelarEdicionPedido}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-2xl font-bold transition"
                          >
                            Cancelar edición
                          </button>
                        </div>
                      </div>
                    ) : !pedidoExpandido.items || pedidoExpandido.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-500 text-sm">
                        Este pedido no tiene productos cargados.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                        {pedidoExpandido.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-gray-100 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 leading-5">
                                  {item.producto_nombre}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Producto ID: {item.producto_id.slice(0, 8).toUpperCase()}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs text-gray-500">
                                  Cantidad solicitada
                                </p>
                                <p className="font-bold text-[#0F6D6A] mt-1">
                                  {formatearNumero(item.cantidad_solicitada)}{" "}
                                  {item.unidad_solicitada || ""}
                                </p>
                                {item.cantidad_aprobada !== null && (
                                  <p className="text-xs text-emerald-600 mt-1">
                                    Aprobada: {formatearNumero(item.cantidad_aprobada)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-5">
                    <h3 className="text-lg font-bold text-[#0F6D6A] mb-3">
                      Acciones
                    </h3>

                    {pedidoFueEntregado(pedidoExpandido) && (
                      <div className="mb-4 rounded-2xl bg-purple-50 border border-purple-200 p-4 text-sm text-purple-700">
                        Este pedido ya fue entregado. Desde aquí ya no se puede editar ni cambiar su estado.
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={
                          actualizandoId === pedidoExpandido.id ||
                          !!pedidoExpandido.transferencia_id ||
                          editandoPedidoId === pedidoExpandido.id ||
                          pedidoFueEntregado(pedidoExpandido)
                        }
                        onClick={() =>
                          actualizarEstadoPedido(pedidoExpandido.id, "revisado")
                        }
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-3 rounded-2xl font-bold transition"
                      >
                        {actualizandoId === pedidoExpandido.id
                          ? "Actualizando..."
                          : "Marcar revisado"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          actualizandoId === pedidoExpandido.id ||
                          !!pedidoExpandido.transferencia_id ||
                          editandoPedidoId === pedidoExpandido.id ||
                          pedidoFueEntregado(pedidoExpandido)
                        }
                        onClick={() =>
                          actualizarEstadoPedido(pedidoExpandido.id, "aprobado")
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-2xl font-bold transition"
                      >
                        {actualizandoId === pedidoExpandido.id
                          ? "Actualizando..."
                          : "Aprobar"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          actualizandoId === pedidoExpandido.id ||
                          !!pedidoExpandido.transferencia_id ||
                          editandoPedidoId === pedidoExpandido.id ||
                          pedidoFueEntregado(pedidoExpandido)
                        }
                        onClick={() =>
                          actualizarEstadoPedido(pedidoExpandido.id, "rechazado")
                        }
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-3 rounded-2xl font-bold transition"
                      >
                        {actualizandoId === pedidoExpandido.id
                          ? "Actualizando..."
                          : "Rechazar"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          generandoTransferenciaId === pedidoExpandido.id ||
                          !!pedidoExpandido.transferencia_id ||
                          !["aprobado", "revisado"].includes(normalizarEstado(pedidoExpandido.estado)) ||
                          editandoPedidoId === pedidoExpandido.id ||
                          pedidoFueEntregado(pedidoExpandido)
                        }
                        onClick={() => generarTransferenciaDesdePedido(pedidoExpandido)}
                        className="bg-[#0F6D6A] hover:bg-[#0c5b59] disabled:opacity-60 text-white py-3 rounded-2xl font-bold transition"
                      >
                        {generandoTransferenciaId === pedidoExpandido.id
                          ? "Generando..."
                          : "Generar transferencia"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4 text-sm text-gray-600">
                      La transferencia se crea como <b>pendiente</b>, usando el
                      almacén central como origen y el almacén de la clínica como destino.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}