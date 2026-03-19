"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Almacen = {
  id: string
  nombre: string
  tipo: string
  clinica_id: string | null
}

type Producto = {
  id: string
  nombre: string
  unidad_base: string | null
  contenido_por_unidad: number | null
  unidad_compra: string | null
  unidad_fraccionada: string | null
  fraccionable: boolean | null
}

type TransferenciaItemDraft = {
  producto_id: string
  producto_nombre: string
  cantidad_base: number
  unidad_compra: string
  contenido_por_unidad: number
  cantidad_fraccionada: number
  unidad_fraccionada: string
  fraccionable: boolean
}

type Transferencia = {
  id: string
  created_at: string
  estado: string
  motivo: string | null
  entregado_por: string | null
  almacen_origen_id: string
  almacen_destino_id: string
  almacenes_origen?: { nombre: string } | null
  almacenes_destino?: { nombre: string } | null
  items?: TransferenciaItemDB[]
}

type TransferenciaItemDB = {
  id: string
  transferencia_id: string
  producto_id: string
  producto_nombre: string
  cantidad_base: number
  unidad_compra: string | null
  contenido_por_unidad: number
  cantidad_fraccionada: number
  unidad_fraccionada: string | null
}

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function formatearFecha(valor: string) {
  return new Date(valor).toLocaleString("es-BO")
}

export default function AdminInventarioTransferenciasNuevoPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])

  const [almacenOrigen, setAlmacenOrigen] = useState("")
  const [almacenDestino, setAlmacenDestino] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("Transferencia de stock")
  const [entregadoPor, setEntregadoPor] = useState("admin")

  const [draftItems, setDraftItems] = useState<TransferenciaItemDraft[]>([])

  const productoSeleccionado = useMemo(() => {
    return productos.find((p) => p.id === productoId) || null
  }, [productos, productoId])

  const cantidadNumero = Number(cantidad || 0)

  const cantidadFraccionadaPreview = useMemo(() => {
    if (!productoSeleccionado || !cantidadNumero || cantidadNumero <= 0) return 0

    const contenido = Number(productoSeleccionado.contenido_por_unidad || 1)
    const esFraccionable = Boolean(productoSeleccionado.fraccionable)

    return esFraccionable ? cantidadNumero * contenido : cantidadNumero
  }, [productoSeleccionado, cantidadNumero])

  const totalItems = draftItems.length

  const totalCantidadBase = useMemo(() => {
    return draftItems.reduce((acc, item) => acc + Number(item.cantidad_base || 0), 0)
  }, [draftItems])

  async function cargarTodo() {
    setCargando(true)

    const [almacenesRes, productosRes, transferenciasRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("tipo", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("productos")
        .select(
          "id,nombre,unidad_base,contenido_por_unidad,unidad_compra,unidad_fraccionada,fraccionable"
        )
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("transferencias_inventario")
        .select(`
          id,
          created_at,
          estado,
          motivo,
          entregado_por,
          almacen_origen_id,
          almacen_destino_id
        `)
        .order("created_at", { ascending: false })
        .limit(12),
    ])

    if (almacenesRes.error) console.log("Error almacenes:", almacenesRes.error)
    if (productosRes.error) console.log("Error productos:", productosRes.error)
    if (transferenciasRes.error) console.log("Error transferencias:", transferenciasRes.error)

    const almacenesData = (almacenesRes.data as Almacen[]) || []
    const productosData = (productosRes.data as Producto[]) || []
    const transferenciasData = (transferenciasRes.data as Transferencia[]) || []

    const idsOrigen = transferenciasData.map((t) => t.almacen_origen_id)
    const idsDestino = transferenciasData.map((t) => t.almacen_destino_id)
    const idsAlmacenesUnicos = Array.from(new Set([...idsOrigen, ...idsDestino]))

    let mapaAlmacenes = new Map<string, { nombre: string }>()
    if (idsAlmacenesUnicos.length > 0) {
      const { data: almacenesLookup } = await supabase
        .from("almacenes")
        .select("id,nombre")
        .in("id", idsAlmacenesUnicos)

      ;(almacenesLookup || []).forEach((a: any) => {
        mapaAlmacenes.set(a.id, { nombre: a.nombre })
      })
    }

    let itemsMap = new Map<string, TransferenciaItemDB[]>()
    if (transferenciasData.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from("transferencias_inventario_items")
        .select(`
          id,
          transferencia_id,
          producto_id,
          producto_nombre,
          cantidad_base,
          unidad_compra,
          contenido_por_unidad,
          cantidad_fraccionada,
          unidad_fraccionada
        `)
        .in(
          "transferencia_id",
          transferenciasData.map((t) => t.id)
        )
        .order("created_at", { ascending: true })

      if (itemsError) {
        console.log("Error items transferencia:", itemsError)
      }

      ;(itemsData || []).forEach((item: any) => {
        const lista = itemsMap.get(item.transferencia_id) || []
        lista.push(item as TransferenciaItemDB)
        itemsMap.set(item.transferencia_id, lista)
      })
    }

    const transferenciasCompletas: Transferencia[] = transferenciasData.map((t) => ({
      ...t,
      almacenes_origen: mapaAlmacenes.get(t.almacen_origen_id) || null,
      almacenes_destino: mapaAlmacenes.get(t.almacen_destino_id) || null,
      items: itemsMap.get(t.id) || [],
    }))

    setAlmacenes(almacenesData)
    setProductos(productosData)
    setTransferencias(transferenciasCompletas)

    const central = almacenesData.find((a) => a.tipo === "central")
    if (central && !almacenOrigen) setAlmacenOrigen(central.id)

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function limpiarItemActual() {
    setProductoId("")
    setCantidad("")
  }

  function agregarProducto() {
    if (!productoId || !cantidad) {
      alert("Seleccione producto y cantidad")
      return
    }

    if (!cantidadNumero || cantidadNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    const producto = productos.find((p) => p.id === productoId)
    if (!producto) {
      alert("Producto no encontrado")
      return
    }

    const contenido = Number(producto.contenido_por_unidad || 1)
    const esFraccionable = Boolean(producto.fraccionable)
    const unidadCompra = producto.unidad_compra || producto.unidad_base || "unidad"
    const unidadFraccionada =
      producto.unidad_fraccionada || producto.unidad_base || "unidad"

    const nuevoItem: TransferenciaItemDraft = {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      cantidad_base: cantidadNumero,
      unidad_compra: unidadCompra,
      contenido_por_unidad: contenido,
      cantidad_fraccionada: esFraccionable ? cantidadNumero * contenido : cantidadNumero,
      unidad_fraccionada: unidadFraccionada,
      fraccionable: esFraccionable,
    }

    setDraftItems((prev) => {
      const existente = prev.find((item) => item.producto_id === producto.id)

      if (!existente) {
        return [...prev, nuevoItem]
      }

      return prev.map((item) => {
        if (item.producto_id !== producto.id) return item

        const nuevaCantidadBase = Number(item.cantidad_base) + cantidadNumero
        return {
          ...item,
          cantidad_base: nuevaCantidadBase,
          cantidad_fraccionada: esFraccionable
            ? nuevaCantidadBase * contenido
            : nuevaCantidadBase,
        }
      })
    })

    limpiarItemActual()
  }

  function eliminarItem(productoIdEliminar: string) {
    setDraftItems((prev) => prev.filter((item) => item.producto_id !== productoIdEliminar))
  }

  function vaciarBorrador() {
    if (draftItems.length === 0) return
    const ok = window.confirm("¿Desea vaciar todos los productos de esta transferencia?")
    if (!ok) return
    setDraftItems([])
  }

  async function guardarTransferenciaCompleta() {
    if (!almacenOrigen || !almacenDestino) {
      alert("Seleccione almacén origen y destino")
      return
    }

    if (almacenOrigen === almacenDestino) {
      alert("El almacén de origen y destino no pueden ser el mismo")
      return
    }

    if (draftItems.length === 0) {
      alert("Agregue al menos un producto a la transferencia")
      return
    }

    setGuardando(true)

    const { data: transferencia, error: errorTransferencia } = await supabase
      .from("transferencias_inventario")
      .insert({
        almacen_origen_id: almacenOrigen,
        almacen_destino_id: almacenDestino,
        estado: "pendiente",
        motivo: motivo || "Transferencia de stock",
        entregado_por: entregadoPor || "admin",
      })
      .select()
      .single()

    if (errorTransferencia || !transferencia) {
      console.log("Error creando transferencia:", errorTransferencia)
      alert(errorTransferencia?.message || "No se pudo crear la transferencia")
      setGuardando(false)
      return
    }

    const itemsParaInsertar = draftItems.map((item) => ({
      transferencia_id: transferencia.id,
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      cantidad_base: item.cantidad_base,
      unidad_compra: item.unidad_compra,
      contenido_por_unidad: item.contenido_por_unidad,
      cantidad_fraccionada: item.cantidad_fraccionada,
      unidad_fraccionada: item.unidad_fraccionada,
    }))

    const { error: errorItems } = await supabase
      .from("transferencias_inventario_items")
      .insert(itemsParaInsertar)

    if (errorItems) {
      console.log("Error creando items:", errorItems)
      alert(errorItems.message || "No se pudieron guardar los productos de la transferencia")
      setGuardando(false)
      return
    }

    alert("Transferencia pendiente creada correctamente")

    setDraftItems([])
    setProductoId("")
    setCantidad("")
    setMotivo("Transferencia de stock")

    await cargarTodo()
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#0F6D6A] border-t-transparent animate-spin mb-5" />
          <h2 className="text-2xl font-bold text-[#0F6D6A]">
            Cargando transferencias
          </h2>
          <p className="text-gray-600 mt-2">
            Preparando almacenes, productos y transferencias nuevas...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-sm font-semibold mb-3">
              <span>Inventario</span>
              <span className="opacity-70">/</span>
              <span>Transferencia múltiple</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Transferencias Profesionales
            </h1>
            <p className="text-white/80 mt-2 max-w-3xl">
              Cree una sola transferencia con varios productos. El sistema calculará
              automáticamente el fraccionamiento para la clínica.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              href="/admin/inventario/transferencias"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Ver transferencias antiguas
            </Link>

            <Link
              href="/admin/inventario"
              className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
            >
              Volver a Inventario
            </Link>
          </div>
        </div>

        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">
                    Nueva transferencia
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Agregue varios productos al mismo envío.
                  </p>
                </div>

                <div className="bg-[#0F6D6A]/10 text-[#0F6D6A] text-xs font-bold px-3 py-1 rounded-full">
                  Borrador
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Almacén origen
                  </label>
                  <select
                    value={almacenOrigen}
                    onChange={(e) => setAlmacenOrigen(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="">Seleccionar origen</option>
                    {almacenes.map((almacen) => (
                      <option key={almacen.id} value={almacen.id}>
                        {almacen.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Almacén destino
                  </label>
                  <select
                    value={almacenDestino}
                    onChange={(e) => setAlmacenDestino(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="">Seleccionar destino</option>
                    {almacenes.map((almacen) => (
                      <option key={almacen.id} value={almacen.id}>
                        {almacen.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Producto
                  </label>
                  <select
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cantidad base
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      placeholder="Ej: 1"
                      className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Entregado por
                    </label>
                    <input
                      type="text"
                      value={entregadoPor}
                      onChange={(e) => setEntregadoPor(e.target.value)}
                      className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Motivo general
                  </label>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={agregarProducto}
                    className="w-full py-3 rounded-2xl font-bold text-white bg-[#0F6D6A] hover:bg-[#0a5654] transition"
                  >
                    Añadir producto
                  </button>

                  <button
                    onClick={limpiarItemActual}
                    type="button"
                    className="w-full py-3 rounded-2xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Limpiar item
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-[#0F6D6A] mb-4">
                Resumen automático
              </h3>

              {!productoSeleccionado ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-gray-500 text-sm">
                  Seleccione un producto para ver la conversión automática.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#0F6D6A]/5 p-4">
                    <div className="text-sm text-gray-500 mb-1">Producto</div>
                    <div className="font-bold text-[#0F6D6A] text-lg">
                      {productoSeleccionado.nombre}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Unidad compra
                      </div>
                      <div className="font-bold text-gray-800">
                        {productoSeleccionado.unidad_compra ||
                          productoSeleccionado.unidad_base ||
                          "-"}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Unidad fraccionada
                      </div>
                      <div className="font-bold text-gray-800">
                        {productoSeleccionado.unidad_fraccionada ||
                          productoSeleccionado.unidad_base ||
                          "-"}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Contenido por unidad
                      </div>
                      <div className="font-bold text-gray-800">
                        {formatearNumero(productoSeleccionado.contenido_por_unidad || 1)}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Fraccionable
                      </div>
                      <div
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${
                          productoSeleccionado.fraccionable
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {productoSeleccionado.fraccionable ? "Sí" : "No"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F47C3C]/10 border border-[#F47C3C]/20 p-5">
                    <div className="text-sm text-gray-600 mb-2">
                      Resultado estimado de este item
                    </div>

                    <div className="text-xl font-bold text-[#F47C3C]">
                      {formatearNumero(cantidadNumero || 0)}{" "}
                      {productoSeleccionado.unidad_compra ||
                        productoSeleccionado.unidad_base ||
                        "unidad"}
                      {"  "}→{"  "}
                      {formatearNumero(cantidadFraccionadaPreview)}{" "}
                      {productoSeleccionado.unidad_fraccionada ||
                        productoSeleccionado.unidad_base ||
                        "unidad"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">
                    Productos de esta transferencia
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Todos estos productos se guardarán en una sola transferencia pendiente.
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="bg-[#0F6D6A]/10 text-[#0F6D6A] text-sm font-bold px-4 py-2 rounded-full">
                    {totalItems} productos
                  </div>
                  <div className="bg-[#F47C3C]/10 text-[#F47C3C] text-sm font-bold px-4 py-2 rounded-full">
                    Base total: {formatearNumero(totalCantidadBase)}
                  </div>
                </div>
              </div>

              {draftItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-300 p-10 text-center">
                  <div className="text-xl font-bold text-gray-700">
                    No hay productos en el borrador
                  </div>
                  <p className="text-gray-500 mt-2">
                    Agregue productos desde el formulario de la izquierda.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {draftItems.map((item) => (
                    <div
                      key={item.producto_id}
                      className="border rounded-3xl p-5 hover:shadow-md transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div>
                            <div className="text-lg font-bold text-gray-900">
                              {item.producto_nombre}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {item.fraccionable
                                ? "Conversión automática habilitada"
                                : "Sin fraccionamiento"}
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Cantidad base
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.cantidad_base)} {item.unidad_compra}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Contenido
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.contenido_por_unidad)}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Fraccionado
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.cantidad_fraccionada)}{" "}
                                {item.unidad_fraccionada}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Estado
                              </div>
                              <div
                                className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${
                                  item.fraccionable
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.fraccionable ? "Fraccionable" : "Directo"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="lg:min-w-[180px] flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={() => eliminarItem(item.producto_id)}
                            className="w-full py-3 rounded-2xl font-bold bg-red-50 text-red-700 hover:bg-red-100 transition"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={vaciarBorrador}
                      className="px-5 py-3 rounded-2xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Vaciar borrador
                    </button>

                    <button
                      type="button"
                      onClick={guardarTransferenciaCompleta}
                      disabled={guardando}
                      className={`px-5 py-3 rounded-2xl font-bold text-white transition ${
                        guardando
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-[#F47C3C] hover:bg-[#db6d31]"
                      }`}
                    >
                      {guardando
                        ? "Guardando transferencia..."
                        : "Guardar transferencia pendiente"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">
                    Últimas transferencias nuevas
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Transferencias registradas en el flujo profesional.
                  </p>
                </div>

                <div className="bg-[#0F6D6A]/10 text-[#0F6D6A] text-sm font-bold px-4 py-2 rounded-full">
                  {transferencias.length} registradas
                </div>
              </div>

              <div className="space-y-4">
                {transferencias.map((t) => (
                  <div
                    key={t.id}
                    className="border rounded-3xl p-5 hover:shadow-md transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {formatearFecha(t.created_at)}
                          </span>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              t.estado === "confirmada"
                                ? "bg-green-100 text-green-700"
                                : t.estado === "cancelada"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {t.estado}
                          </span>

                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0F6D6A]/10 text-[#0F6D6A]">
                            {(t.items || []).length} producto(s)
                          </span>
                        </div>

                        <div className="text-sm text-gray-500">
                          {t.almacenes_origen?.nombre || "-"} →{" "}
                          {t.almacenes_destino?.nombre || "-"}
                        </div>

                        <div className="space-y-2">
                          {(t.items || []).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl bg-gray-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                            >
                              <div className="font-semibold text-gray-800">
                                {item.producto_nombre}
                              </div>

                              <div className="text-sm text-gray-600">
                                {formatearNumero(item.cantidad_base)} {item.unidad_compra || "-"}
                                {"  "}→{"  "}
                                {formatearNumero(item.cantidad_fraccionada)}{" "}
                                {item.unidad_fraccionada || "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="lg:min-w-[220px] space-y-3">
                        <div className="rounded-2xl bg-[#0F6D6A]/5 p-4">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Entregado por
                          </div>
                          <div className="font-bold text-[#0F6D6A]">
                            {t.entregado_por || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#F47C3C]/10 p-4">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                            Motivo
                          </div>
                          <div className="font-semibold text-gray-800">
                            {t.motivo || "-"}
                          </div>
                        </div>

                        <Link
                          href={`/admin/inventario/transferencias-nuevo/${t.id}`}
                          className="block w-full text-center py-3 rounded-2xl font-bold bg-[#0F6D6A] text-white hover:bg-[#0a5654] transition"
                        >
                          Ver detalle
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {transferencias.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-gray-300 p-10 text-center">
                    <div className="text-xl font-bold text-gray-700">
                      No hay transferencias nuevas todavía
                    </div>
                    <p className="text-gray-500 mt-2">
                      Cree la primera transferencia pendiente desde el formulario.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}