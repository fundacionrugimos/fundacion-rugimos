"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Producto = {
  id: string
  nombre: string
  unidad_base: string | null
  unidad_compra: string | null
  unidad_fraccionada: string | null
  contenido_por_unidad: number | null
  fraccionable: boolean | null
  foto_url: string | null
  categoria_pedido: string | null
  orden_pedido: number | null
  solicitavel_clinica: boolean | null
  activo?: boolean | null
  foto_fit?: "contain" | "cover" | null
  foto_zoom?: number | null
}

type AlmacenClinica = {
  id: string
  nombre: string
  clinica_id: string | null
  tipo: string | null
}

type PedidoItemDraft = {
  producto_id: string
  producto_nombre: string
  cantidad_solicitada: number
  unidad_solicitada: string
  foto_url: string | null
  categoria_pedido: string | null
}

type PedidoResumen = {
  id: string
  estado: string | null
  fecha_solicitada: string | null
  created_at: string
  observaciones: string | null
}

type CategoriaPedidoClinica = {
  id: string
  nombre: string
  activa: boolean
  orden: number
}

type PedidoRecienteItem = {
  id: string
  pedido_id: string
  producto_id: string
  producto_nombre: string
  cantidad_solicitada: number
  unidad_solicitada: string | null
}

function getLocalDateString(baseDate?: Date) {
  const now = baseDate || new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function formatFechaBonita(fecha: string | null | undefined) {
  if (!fecha) return "-"
  const [year, month, day] = fecha.split("-")
  if (!year || !month || !day) return fecha
  return `${day}/${month}/${year}`
}

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function normalizarTexto(valor: string | null | undefined) {
  return (valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function colorEstadoPedido(estado: string | null | undefined) {
  const e = (estado || "").trim().toLowerCase()

  if (e === "borrador") return "bg-gray-100 text-gray-700"
  if (e === "enviado") return "bg-blue-100 text-blue-700"
  if (e === "revisado") return "bg-amber-100 text-amber-700"
  if (e === "aprobado") return "bg-emerald-100 text-emerald-700"
  if (e === "convertido") return "bg-teal-100 text-teal-700"
  if (e === "rechazado") return "bg-red-100 text-red-700"
  if (e === "entregado") return "bg-purple-100 text-purple-700"

  return "bg-gray-100 text-gray-700"
}

export default function ClinicaPedidosPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const [clinicaId, setClinicaId] = useState("")
  const [almacenClinica, setAlmacenClinica] = useState<AlmacenClinica | null>(null)

  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidosRecientes, setPedidosRecientes] = useState<PedidoResumen[]>([])
  const [categoriasPedidoClinica, setCategoriasPedidoClinica] = useState<CategoriaPedidoClinica[]>([])
  const [itemsPedidosRecientes, setItemsPedidosRecientes] = useState<PedidoRecienteItem[]>([])

  const [busqueda, setBusqueda] = useState("")
  const [categoriaActiva, setCategoriaActiva] = useState("todos")

  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [draftItems, setDraftItems] = useState<PedidoItemDraft[]>([])

  const [fechaSolicitada, setFechaSolicitada] = useState("")
  const [observaciones, setObservaciones] = useState("")

  const [pedidoDetalleAbierto, setPedidoDetalleAbierto] = useState<PedidoResumen | null>(null)

  const fechaMinima = useMemo(() => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    return getLocalDateString(manana)
  }, [])

  useEffect(() => {
    setFechaSolicitada(fechaMinima)
  }, [fechaMinima])

  useEffect(() => {
    const clinica = localStorage.getItem("clinica_id")
    const loginTime = localStorage.getItem("clinica_login_time")

    if (!clinica || !loginTime) {
      router.push("/clinica/login")
      return
    }

    const agora = Date.now()
    const cincoMin = 5 * 60 * 1000

    if (agora - Number(loginTime) > cincoMin) {
      localStorage.removeItem("clinica_id")
      localStorage.removeItem("clinica_zona")
      localStorage.removeItem("clinica_login_time")
      router.push("/clinica/login")
      return
    }

    setClinicaId(clinica)
  }, [router])

  async function cargarTodo(idClinica: string) {
    setCargando(true)

    const [almacenRes, productosRes, pedidosRes, categoriasRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,clinica_id,tipo")
        .eq("clinica_id", idClinica)
        .eq("activo", true)
        .order("nombre", { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("productos")
        .select(`
          id,
          nombre,
          unidad_base,
          unidad_compra,
          unidad_fraccionada,
          contenido_por_unidad,
          fraccionable,
          foto_url,
          categoria_pedido,
          orden_pedido,
          solicitavel_clinica,
          activo,
          foto_fit,
          foto_zoom
        `)
        .eq("activo", true)
        .eq("solicitavel_clinica", true)
        .order("categoria_pedido", { ascending: true })
        .order("orden_pedido", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("pedidos_clinicas")
        .select("id,estado,fecha_solicitada,created_at,observaciones")
        .eq("clinica_id", idClinica)
        .order("created_at", { ascending: false })
        .limit(6),

      supabase
        .from("categorias_pedido_clinica")
        .select("id,nombre,activa,orden")
        .eq("activa", true)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true }),
    ])

    if (almacenRes.error) {
      console.log("Error cargando almacén de clínica:", almacenRes.error)
    }

    if (productosRes.error) {
      console.log("Error cargando productos:", productosRes.error)
    }

    if (pedidosRes.error) {
      console.log("Error cargando pedidos recientes:", pedidosRes.error)
    }

    if (categoriasRes.error) {
      console.log("Error cargando categorías de pedido clínico:", categoriasRes.error)
    }

    const pedidosData = (pedidosRes.data as PedidoResumen[]) || []
    setAlmacenClinica((almacenRes.data as AlmacenClinica | null) || null)
    setProductos((productosRes.data as Producto[]) || [])
    setPedidosRecientes(pedidosData)
    setCategoriasPedidoClinica((categoriasRes.data as CategoriaPedidoClinica[]) || [])

    if (pedidosData.length > 0) {
      const pedidoIds = pedidosData.map((p) => p.id)

      const { data: itemsData, error: itemsError } = await supabase
        .from("pedidos_clinicas_items")
        .select(`
          id,
          pedido_id,
          producto_id,
          producto_nombre,
          cantidad_solicitada,
          unidad_solicitada
        `)
        .in("pedido_id", pedidoIds)
        .order("created_at", { ascending: true })

      if (itemsError) {
        console.log("Error cargando items de pedidos recientes:", itemsError)
        setItemsPedidosRecientes([])
      } else {
        setItemsPedidosRecientes((itemsData as PedidoRecienteItem[]) || [])
      }
    } else {
      setItemsPedidosRecientes([])
    }

    setCargando(false)
  }

  useEffect(() => {
    if (!clinicaId) return
    cargarTodo(clinicaId)
  }, [clinicaId])

  const categorias = useMemo(() => {
    const categoriasActivas = categoriasPedidoClinica
      .map((c) => c.nombre.trim())
      .filter(Boolean)

    const categoriasConProductos = Array.from(
      new Set(
        productos
          .map((p) => (p.categoria_pedido || "").trim())
          .filter(Boolean)
          .filter((cat) => categoriasActivas.includes(cat))
      )
    )

    return ["todos", ...categoriasConProductos]
  }, [productos, categoriasPedidoClinica])

  const productosFiltrados = useMemo(() => {
    return productos.filter((producto) => {
      const coincideBusqueda = producto.nombre
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase())

      const categoria = (producto.categoria_pedido || "").trim()

      const categoriaPermitida =
        !categoria ||
        categoriasPedidoClinica.some(
          (c) => c.activa && c.nombre.trim() === categoria
        )

      const coincideCategoria =
        categoriaActiva === "todos" || categoria === categoriaActiva

      return coincideBusqueda && categoriaPermitida && coincideCategoria
    })
  }, [productos, busqueda, categoriaActiva, categoriasPedidoClinica])

  const totalItems = useMemo(() => draftItems.length, [draftItems])

  const totalUnidades = useMemo(() => {
    return draftItems.reduce(
      (acc, item) => acc + Number(item.cantidad_solicitada || 0),
      0
    )
  }, [draftItems])

  const itemsDelPedidoAbierto = useMemo(() => {
    if (!pedidoDetalleAbierto) return []
    return itemsPedidosRecientes.filter(
      (item) => item.pedido_id === pedidoDetalleAbierto.id
    )
  }, [pedidoDetalleAbierto, itemsPedidosRecientes])

  function obtenerUnidadPedido(producto: Producto) {
    return (
      producto.unidad_compra ||
      producto.unidad_base ||
      producto.unidad_fraccionada ||
      "unidad"
    )
  }

  function cambiarCantidad(productoId: string, valor: string) {
    setCantidades((prev) => ({
      ...prev,
      [productoId]: valor,
    }))
  }

  function agregarProducto(producto: Producto) {
    const valorCantidad = cantidades[producto.id] || ""
    const cantidadNumero = Number(valorCantidad)

    if (!valorCantidad) {
      alert("Ingrese una cantidad")
      return
    }

    if (!cantidadNumero || cantidadNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    const unidad = obtenerUnidadPedido(producto)

    setDraftItems((prev) => {
      const existente = prev.find((item) => item.producto_id === producto.id)

      if (!existente) {
        return [
          ...prev,
          {
            producto_id: producto.id,
            producto_nombre: producto.nombre,
            cantidad_solicitada: cantidadNumero,
            unidad_solicitada: unidad,
            foto_url: producto.foto_url,
            categoria_pedido: producto.categoria_pedido || "Otros",
          },
        ]
      }

      return prev.map((item) => {
        if (item.producto_id !== producto.id) return item
        return {
          ...item,
          cantidad_solicitada:
            Number(item.cantidad_solicitada || 0) + cantidadNumero,
        }
      })
    })

    setCantidades((prev) => ({
      ...prev,
      [producto.id]: "",
    }))
  }

  function quitarProducto(productoId: string) {
    setDraftItems((prev) => prev.filter((item) => item.producto_id !== productoId))
  }

  function cambiarCantidadDraft(productoId: string, cantidad: string) {
    const cantidadNumero = Number(cantidad)

    if (!cantidad || cantidadNumero <= 0) {
      setDraftItems((prev) => prev.filter((item) => item.producto_id !== productoId))
      return
    }

    setDraftItems((prev) =>
      prev.map((item) =>
        item.producto_id === productoId
          ? { ...item, cantidad_solicitada: cantidadNumero }
          : item
      )
    )
  }

  function vaciarCarrito() {
    if (draftItems.length === 0) return
    const ok = window.confirm("¿Desea vaciar todo el carrito?")
    if (!ok) return
    setDraftItems([])
  }

  async function enviarPedido() {
    if (!clinicaId) {
      alert("Sesión clínica no encontrada")
      return
    }

    if (!almacenClinica?.id) {
      alert("No se encontró el almacén de esta clínica")
      return
    }

    if (draftItems.length === 0) {
      alert("Agregue al menos un producto al carrito")
      return
    }

    if (!fechaSolicitada) {
      alert("Seleccione una fecha de entrega")
      return
    }

    setEnviando(true)

    try {
      const { data: pedidoCreado, error: pedidoError } = await supabase
        .from("pedidos_clinicas")
        .insert({
          clinica_id: clinicaId,
          almacen_destino_id: almacenClinica.id,
          fecha_solicitada: fechaSolicitada,
          observaciones: observaciones.trim() || null,
          estado: "enviado",
          delivery_estado: "pendiente",
        })
        .select("id")
        .single()

      if (pedidoError || !pedidoCreado) {
        console.log("Error creando pedido:", pedidoError)
        alert("No se pudo crear el pedido")
        setEnviando(false)
        return
      }

      const itemsParaInsertar = draftItems.map((item) => ({
        pedido_id: pedidoCreado.id,
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        cantidad_solicitada: Number(item.cantidad_solicitada || 0),
        unidad_solicitada: item.unidad_solicitada,
      }))

      const { error: itemsError } = await supabase
        .from("pedidos_clinicas_items")
        .insert(itemsParaInsertar)

      if (itemsError) {
        console.log("Error creando items del pedido:", itemsError)
        alert("El pedido principal se creó, pero hubo un error guardando los productos")
        setEnviando(false)
        return
      }

      alert("Pedido enviado correctamente")

      setDraftItems([])
      setObservaciones("")
      setFechaSolicitada(fechaMinima)
      setCantidades({})

      await cargarTodo(clinicaId)
    } catch (error) {
      console.log("Error general enviando pedido:", error)
      alert("Ocurrió un error enviando el pedido")
    }

    setEnviando(false)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#0F6D6A] border-t-transparent animate-spin mb-5" />
          <h2 className="text-2xl font-bold text-[#0F6D6A]">
            Cargando módulo de pedidos
          </h2>
          <p className="text-gray-600 mt-2">
            Preparando productos, carrito y datos de la clínica...
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#0F6D6A] p-4 md:p-6 xl:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-6 md:px-8 md:py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-sm font-semibold mb-3">
                  <span>Portal clínica</span>
                  <span className="opacity-70">/</span>
                  <span>Pedidos</span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Solicitud de insumos
                </h1>
                <p className="text-white/80 mt-2 max-w-3xl">
                  Seleccione productos, agregue cantidades y programe la fecha deseada
                  de entrega para enviarlo directamente al administrativo.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/clinica"
                  className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
                >
                  Volver al portal
                </Link>
              </div>
            </div>
          </div>

          {!almacenClinica && (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-red-700 font-semibold">
                No se encontró un almacén activo vinculado a esta clínica.
              </p>
              <p className="text-red-600 text-sm mt-1">
                Antes de usar este módulo, debe existir un almacén activo para la clínica.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F6D6A]">
                      Catálogo de productos
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Elija los insumos que desea solicitar.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 w-full lg:w-auto">
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    />

                    <select
                      value={categoriaActiva}
                      onChange={(e) => setCategoriaActiva(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    >
                      {categorias.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria === "todos" ? "Todas las categorías" : categoria}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {productosFiltrados.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-gray-300 p-10 text-center">
                    <div className="text-xl font-bold text-gray-700">
                      No hay productos para mostrar
                    </div>
                    <p className="text-gray-500 mt-2">
                      Ajuste la búsqueda o active productos para pedido clínico.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {productosFiltrados.map((producto) => {
                      const unidadPedido = obtenerUnidadPedido(producto)

                      return (
                        <div
                          key={producto.id}
                          className="rounded-[26px] border border-gray-100 bg-[#FCFDFD] shadow-sm hover:shadow-lg transition overflow-hidden"
                        >
                          <div className="aspect-[16/10] bg-white flex items-center justify-center overflow-hidden p-3">
                            {producto.foto_url ? (
                              <img
                                src={producto.foto_url}
                                alt={producto.nombre}
                                className={`w-full h-full ${
                                  (producto.foto_fit || "contain") === "cover"
                                    ? "object-cover"
                                    : "object-contain"
                                }`}
                                style={{
                                  transform: `scale(${Number(producto.foto_zoom ?? 100) / 100})`,
                                }}
                              />
                            ) : (
                              <div className="text-center px-4">
                                <div className="text-4xl mb-2">📦</div>
                                <p className="text-sm text-[#0F6D6A] font-semibold">
                                  Sin foto cargada
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-4">
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-bold text-gray-900 leading-5">
                                  {producto.nombre}
                                </h3>

                                <span className="shrink-0 bg-[#0F6D6A]/10 text-[#0F6D6A] text-xs font-bold px-3 py-1 rounded-full">
                                  {producto.categoria_pedido || "Otros"}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-2xl bg-gray-50 p-3">
                                  <p className="text-gray-500 text-xs">Unidad pedido</p>
                                  <p className="font-bold text-gray-800 mt-1">
                                    {unidadPedido}
                                  </p>
                                </div>

                                <div className="rounded-2xl bg-gray-50 p-3">
                                  <p className="text-gray-500 text-xs">Contenido</p>
                                  <p className="font-bold text-gray-800 mt-1">
                                    {producto.fraccionable
                                      ? `${formatearNumero(producto.contenido_por_unidad)} ${producto.unidad_fraccionada || producto.unidad_base || ""}`
                                      : "No fraccionable"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="Cantidad"
                                value={cantidades[producto.id] || ""}
                                onChange={(e) =>
                                  cambiarCantidad(producto.id, e.target.value)
                                }
                                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                              />

                              <button
                                type="button"
                                onClick={() => agregarProducto(producto)}
                                className="bg-[#F47C3C] hover:bg-[#db6d31] text-white px-4 py-3 rounded-2xl font-bold transition"
                              >
                                Agregar
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F6D6A]">
                      Carrito
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Revise el pedido antes de enviarlo.
                    </p>
                  </div>

                  {draftItems.length > 0 && (
                    <button
                      type="button"
                      onClick={vaciarCarrito}
                      className="text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-4">
                    <p className="text-xs text-gray-500">Productos</p>
                    <p className="text-2xl font-bold text-[#0F6D6A] mt-1">
                      {totalItems}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FFF6F1] border border-[#F8D7C3] p-4">
                    <p className="text-xs text-gray-500">Cantidad total</p>
                    <p className="text-2xl font-bold text-[#F47C3C] mt-1">
                      {formatearNumero(totalUnidades)}
                    </p>
                  </div>
                </div>

                {draftItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                    <div className="text-lg font-bold text-gray-700">
                      No hay productos agregados
                    </div>
                    <p className="text-gray-500 mt-2 text-sm">
                      Agregue productos desde el catálogo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {draftItems.map((item) => (
                      <div
                        key={item.producto_id}
                        className="rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-white overflow-hidden shrink-0 flex items-center justify-center p-1 border border-gray-100">
                            {item.foto_url ? (
                              <img
                                src={item.foto_url}
                                alt={item.producto_nombre}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-xl">📦</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#0F6D6A] leading-5">
                              {item.producto_nombre}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.categoria_pedido || "Otros"}
                            </p>

                            <div className="flex items-center gap-2 mt-3">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.cantidad_solicitada}
                                onChange={(e) =>
                                  cambiarCantidadDraft(item.producto_id, e.target.value)
                                }
                                className="w-24 rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                              />
                              <span className="text-sm text-gray-600">
                                {item.unidad_solicitada}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => quitarProducto(item.producto_id)}
                            className="text-red-500 hover:text-red-700 font-bold text-sm"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fecha deseada de entrega
                    </label>
                    <input
                      type="date"
                      min={fechaMinima}
                      value={fechaSolicitada}
                      onChange={(e) => setFechaSolicitada(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observaciones
                    </label>
                    <textarea
                      rows={4}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej.: entregar por la mañana, producto prioritario, etc."
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A] resize-none"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4 text-sm text-gray-600">
                    <p>
                      <span className="font-bold text-[#0F6D6A]">Almacén destino:</span>{" "}
                      {almacenClinica?.nombre || "No encontrado"}
                    </p>
                    <p className="mt-1">
                      Confirme su pedido antes de enviarlo.  
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={enviarPedido}
                    disabled={enviando || !almacenClinica}
                    className="w-full bg-[#F47C3C] hover:bg-[#db6d31] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-bold shadow transition"
                  >
                    {enviando ? "Enviando pedido..." : "Enviar pedido"}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[28px] shadow-2xl p-5 md:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#0F6D6A]">
                      Pedidos recientes
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Últimos pedidos enviados por esta clínica.
                    </p>
                  </div>
                </div>

                {pedidosRecientes.length === 0 ? (
                  <div className="text-sm text-gray-500 py-6">
                    No hay pedidos recientes todavía.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pedidosRecientes.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="border border-gray-100 rounded-2xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[#0F6D6A]">
                              Pedido #{pedido.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Entrega: {formatFechaBonita(pedido.fecha_solicitada)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Creado: {new Date(pedido.created_at).toLocaleString("es-BO")}
                            </p>
                            {pedido.observaciones && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                {pedido.observaciones}
                              </p>
                            )}
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${colorEstadoPedido(
                              pedido.estado
                            )}`}
                          >
                            {normalizarTexto(pedido.estado) || "ENVIADO"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPedidoDetalleAbierto(pedido)}
                          className="mt-4 w-full bg-[#0F6D6A] hover:bg-[#0c5b59] text-white py-2.5 rounded-2xl font-bold transition"
                        >
                          Ver detalle
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {pedidoDetalleAbierto && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[30px] shadow-2xl overflow-hidden">
            <div className="bg-[#0F6D6A] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/80 font-semibold">
                    Detalle del pedido
                  </p>
                  <h3 className="text-2xl font-bold mt-1">
                    #{pedidoDetalleAbierto.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-white/80 mt-2">
                    Entrega: {formatFechaBonita(pedidoDetalleAbierto.fecha_solicitada)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPedidoDetalleAbierto(null)}
                  className="bg-white/15 hover:bg-white/25 px-4 py-2 rounded-2xl font-bold transition"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${colorEstadoPedido(
                    pedidoDetalleAbierto.estado
                  )}`}
                >
                  {normalizarTexto(pedidoDetalleAbierto.estado) || "ENVIADO"}
                </span>

                <p className="text-sm text-gray-500">
                  Creado: {new Date(pedidoDetalleAbierto.created_at).toLocaleString("es-BO")}
                </p>
              </div>

              {pedidoDetalleAbierto.observaciones && (
                <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4">
                  <p className="text-sm font-semibold text-[#0F6D6A]">
                    Observaciones
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {pedidoDetalleAbierto.observaciones}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-lg font-bold text-[#0F6D6A] mb-3">
                  Productos solicitados
                </h4>

                {itemsDelPedidoAbierto.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                    No se encontraron productos para este pedido.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itemsDelPedidoAbierto.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-gray-900">
                              {item.producto_nombre}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Producto #{item.producto_id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-gray-500">Cantidad</p>
                            <p className="font-bold text-[#0F6D6A] mt-1">
                              {formatearNumero(item.cantidad_solicitada)}{" "}
                              {item.unidad_solicitada || ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPedidoDetalleAbierto(null)}
                  className="w-full bg-[#F47C3C] hover:bg-[#db6d31] text-white py-3 rounded-2xl font-bold transition"
                >
                  Cerrar detalle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}