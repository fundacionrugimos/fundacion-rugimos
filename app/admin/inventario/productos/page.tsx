"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  unidad_base: string
  stock_minimo: number
  controla_stock: boolean
  activo: boolean
  observaciones: string | null
  contenido_por_unidad: number | null
  unidad_compra: string | null
  unidad_fraccionada: string | null
  fraccionable: boolean

  solicitavel_clinica?: boolean | null
  foto_url?: string | null
  categoria_pedido?: string | null
  orden_pedido?: number | null
  foto_fit?: "contain" | "cover" | null
  foto_zoom?: number | null
}

type CategoriaPedidoClinica = {
  id: string
  nombre: string
  activa: boolean
  orden: number
  created_at?: string
  updated_at?: string
}

const UNIDADES_BASE = [
  "unidad",
  "ml",
  "ampolla",
  "frasco",
  "caja",
  "rollo",
  "botella",
  "paquete",
  "cm",
]

const UNIDADES_COMPRA = [
  "unidad",
  "caja",
  "frasco",
  "botella",
  "rollo",
  "paquete",
]

const ITEMS_POR_PAGINA = 12

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export default function AdminInventarioProductosPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [categoriasPedidoClinica, setCategoriasPedidoClinica] = useState<CategoriaPedidoClinica[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [nombre, setNombre] = useState("")
  const [categoria, setCategoria] = useState("")
  const [unidadBase, setUnidadBase] = useState("unidad")
  const [stockMinimo, setStockMinimo] = useState("0")
  const [controlaStock, setControlaStock] = useState(true)
  const [activo, setActivo] = useState(true)
  const [observaciones, setObservaciones] = useState("")
  const [contenidoPorUnidad, setContenidoPorUnidad] = useState("1")
  const [unidadCompra, setUnidadCompra] = useState("unidad")
  const [unidadFraccionada, setUnidadFraccionada] = useState("unidad")
  const [fraccionable, setFraccionable] = useState(false)

  const [solicitavelClinica, setSolicitavelClinica] = useState(true)
  const [fotoUrl, setFotoUrl] = useState("")
  const [categoriaPedido, setCategoriaPedido] = useState("")
  const [ordenPedido, setOrdenPedido] = useState("0")
  const [fotoFit, setFotoFit] = useState<"contain" | "cover">("contain")
  const [fotoZoom, setFotoZoom] = useState("100")

  const [categorias, setCategorias] = useState<string[]>([])
  const [crearNuevaCategoria, setCrearNuevaCategoria] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState("")

  const [mostrarGestorCategoriasPedido, setMostrarGestorCategoriasPedido] = useState(false)
  const [nuevaCategoriaPedido, setNuevaCategoriaPedido] = useState("")
  const [nuevoOrdenCategoriaPedido, setNuevoOrdenCategoriaPedido] = useState("0")
  const [guardandoCategoriaPedido, setGuardandoCategoriaPedido] = useState(false)
  const [actualizandoCategoriaPedidoId, setActualizandoCategoriaPedidoId] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroSolicitudClinica, setFiltroSolicitudClinica] = useState("todos")
  const [paginaActual, setPaginaActual] = useState(1)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function cargarProductos() {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) {
      console.log(error)
      alert("No se pudieron cargar los productos")
      setProductos([])
      return
    }

    setProductos((data as Producto[]) || [])
  }

  async function cargarCategorias() {
    const { data, error } = await supabase
      .from("categorias_producto")
      .select("nombre")
      .eq("activa", true)
      .order("nombre", { ascending: true })

    if (error) {
      console.log(error)
      return
    }

    setCategorias((data || []).map((c: any) => c.nombre))
  }

  async function cargarCategoriasPedidoClinica() {
    const { data, error } = await supabase
      .from("categorias_pedido_clinica")
      .select("*")
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true })

    if (error) {
      console.log(error)
      alert("No se pudieron cargar las categorías del pedido clínico")
      setCategoriasPedidoClinica([])
      return
    }

    setCategoriasPedidoClinica((data as CategoriaPedidoClinica[]) || [])
  }

  async function cargarTodo() {
    setCargando(true)
    await Promise.all([
      cargarProductos(),
      cargarCategorias(),
      cargarCategoriasPedidoClinica(),
    ])
    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  function limpiarFormulario() {
    setEditandoId(null)
    setNombre("")
    setCategoria("")
    setUnidadBase("unidad")
    setStockMinimo("0")
    setControlaStock(true)
    setActivo(true)
    setObservaciones("")
    setContenidoPorUnidad("1")
    setUnidadCompra("unidad")
    setUnidadFraccionada("unidad")
    setFraccionable(false)

    setSolicitavelClinica(true)
    setFotoUrl("")
    setCategoriaPedido(
      categoriasPedidoClinica.find((c) => c.activa)?.nombre || ""
    )
    setOrdenPedido("0")
    setFotoFit("contain")
    setFotoZoom("100")

    setCrearNuevaCategoria(false)
    setNuevaCategoria("")
  }

  useEffect(() => {
    if (!editandoId && categoriasPedidoClinica.length > 0 && !categoriaPedido) {
      setCategoriaPedido(categoriasPedidoClinica.find((c) => c.activa)?.nombre || "")
    }
  }, [categoriasPedidoClinica, categoriaPedido, editandoId])

  function cargarParaEditar(producto: Producto) {
    setEditandoId(producto.id)
    setNombre(producto.nombre || "")
    setCategoria(producto.categoria || "")
    setUnidadBase(producto.unidad_base || "unidad")
    setStockMinimo(String(producto.stock_minimo ?? 0))
    setControlaStock(!!producto.controla_stock)
    setActivo(!!producto.activo)
    setObservaciones(producto.observaciones || "")
    setContenidoPorUnidad(String(producto.contenido_por_unidad ?? 1))
    setUnidadCompra(producto.unidad_compra || "unidad")
    setUnidadFraccionada(producto.unidad_fraccionada || "unidad")
    setFraccionable(!!producto.fraccionable)

    setSolicitavelClinica(producto.solicitavel_clinica ?? true)
    setFotoUrl(producto.foto_url || "")
    setCategoriaPedido(producto.categoria_pedido || categoriasPedidoClinica.find((c) => c.activa)?.nombre || "")
    setOrdenPedido(String(producto.orden_pedido ?? 0))
    setFotoFit((producto.foto_fit as "contain" | "cover") || "contain")
    setFotoZoom(String(producto.foto_zoom ?? 100))

    setCrearNuevaCategoria(false)
    setNuevaCategoria("")

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function asegurarCategoria(nombreCategoria: string) {
    const categoriaFinal = nombreCategoria.trim()

    if (!categoriaFinal) return false

    const { data: categoriaExistente, error: errorBusqueda } = await supabase
      .from("categorias_producto")
      .select("id")
      .eq("nombre", categoriaFinal)
      .maybeSingle()

    if (errorBusqueda) {
      console.log(errorBusqueda)
      alert("No se pudo verificar la categoría")
      return false
    }

    if (!categoriaExistente) {
      const { error: errorCrear } = await supabase
        .from("categorias_producto")
        .insert({
          nombre: categoriaFinal,
          activa: true,
        })

      if (errorCrear) {
        console.log(errorCrear)
        alert(errorCrear.message || "No se pudo crear la nueva categoría")
        return false
      }
    }

    return true
  }

  async function guardarProducto() {
    if (!nombre.trim()) {
      alert("Debe ingresar el nombre del producto")
      return
    }

    const categoriaFinal = crearNuevaCategoria
      ? nuevaCategoria.trim()
      : categoria.trim()

    if (!categoriaFinal) {
      alert("Debe seleccionar una categoría")
      return
    }

    if (solicitavelClinica && !categoriaPedido.trim()) {
      alert("Debe seleccionar una categoría para el portal de pedidos")
      return
    }

    const minimo = Number(stockMinimo)
    const contenido = Number(contenidoPorUnidad)
    const ordenCatalogo = Number(ordenPedido)
    const zoom = Number(fotoZoom)

    if (Number.isNaN(minimo) || minimo < 0) {
      alert("El stock mínimo no es válido")
      return
    }

    if (Number.isNaN(contenido) || contenido <= 0) {
      alert("El contenido por unidad no es válido")
      return
    }

    if (Number.isNaN(ordenCatalogo) || ordenCatalogo < 0) {
      alert("El orden del catálogo no es válido")
      return
    }

    if (Number.isNaN(zoom) || zoom < 50 || zoom > 200) {
      alert("El zoom de la foto debe estar entre 50 y 200")
      return
    }

    setGuardando(true)

    const categoriaOk = await asegurarCategoria(categoriaFinal)

    if (!categoriaOk) {
      setGuardando(false)
      return
    }

    const payload = {
      nombre: nombre.trim(),
      categoria: categoriaFinal,
      unidad_base: unidadBase,
      stock_minimo: minimo,
      controla_stock: controlaStock,
      activo,
      observaciones: observaciones.trim() || null,
      contenido_por_unidad: contenido,
      unidad_compra: unidadCompra || null,
      unidad_fraccionada: fraccionable ? unidadFraccionada : null,
      fraccionable,

      solicitavel_clinica: solicitavelClinica,
      foto_url: fotoUrl.trim() || null,
      categoria_pedido: solicitavelClinica ? categoriaPedido.trim() || "Otros" : null,
      orden_pedido: solicitavelClinica ? ordenCatalogo : 0,
      foto_fit: fotoFit,
      foto_zoom: zoom,
    }

    if (editandoId) {
      const { error } = await supabase
        .from("productos")
        .update(payload)
        .eq("id", editandoId)

      if (error) {
        console.log(error)
        alert(error.message || "No se pudo actualizar el producto")
        setGuardando(false)
        return
      }

      alert("Producto actualizado correctamente")
    } else {
      const { error } = await supabase.from("productos").insert(payload)

      if (error) {
        console.log(error)
        alert(error.message || "No se pudo crear el producto")
        setGuardando(false)
        return
      }

      alert("Producto creado correctamente")
    }

    await cargarCategorias()
    await cargarProductos()
    limpiarFormulario()
    setGuardando(false)
  }

  async function cambiarEstado(producto: Producto) {
    const { error } = await supabase
      .from("productos")
      .update({ activo: !producto.activo })
      .eq("id", producto.id)

    if (error) {
      console.log(error)
      alert("No se pudo cambiar el estado del producto")
      return
    }

    await cargarProductos()
  }

  async function subirFotoProducto(file: File) {
    if (!file) return

    const maxSizeMb = 4
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`La imagen supera ${maxSizeMb} MB`)
      return
    }

    setSubiendoFoto(true)

    try {
      const extension = file.name.split(".").pop() || "jpg"
      const nombreBase = slugify(nombre || "producto")
      const filePath = `productos/${Date.now()}-${nombreBase}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.log(uploadError)
        alert(uploadError.message || "No se pudo subir la imagen")
        setSubiendoFoto(false)
        return
      }

      const { data } = supabase.storage.from("productos").getPublicUrl(filePath)

      if (!data?.publicUrl) {
        alert("La imagen se subió, pero no se pudo obtener la URL pública")
        setSubiendoFoto(false)
        return
      }

      setFotoUrl(data.publicUrl)
      alert("Imagen subida correctamente")
    } catch (error) {
      console.log(error)
      alert("Ocurrió un error subiendo la imagen")
    }

    setSubiendoFoto(false)
  }

  async function crearCategoriaPedidoClinica() {
    const nombreFinal = nuevaCategoriaPedido.trim()
    const ordenFinal = Number(nuevoOrdenCategoriaPedido)

    if (!nombreFinal) {
      alert("Debe escribir el nombre de la categoría")
      return
    }

    if (Number.isNaN(ordenFinal) || ordenFinal < 0) {
      alert("El orden no es válido")
      return
    }

    setGuardandoCategoriaPedido(true)

    const { error } = await supabase
      .from("categorias_pedido_clinica")
      .insert({
        nombre: nombreFinal,
        activa: true,
        orden: ordenFinal,
      })

    if (error) {
      console.log(error)
      alert(error.message || "No se pudo crear la categoría del pedido")
      setGuardandoCategoriaPedido(false)
      return
    }

    setNuevaCategoriaPedido("")
    setNuevoOrdenCategoriaPedido("0")
    await cargarCategoriasPedidoClinica()
    alert("Categoría de pedido creada correctamente")
    setGuardandoCategoriaPedido(false)
  }

  async function toggleCategoriaPedidoActiva(categoriaItem: CategoriaPedidoClinica) {
    setActualizandoCategoriaPedidoId(categoriaItem.id)

    const { error } = await supabase
      .from("categorias_pedido_clinica")
      .update({
        activa: !categoriaItem.activa,
      })
      .eq("id", categoriaItem.id)

    if (error) {
      console.log(error)
      alert("No se pudo actualizar el estado de la categoría")
      setActualizandoCategoriaPedidoId(null)
      return
    }

    await cargarCategoriasPedidoClinica()
    setActualizandoCategoriaPedidoId(null)
  }

  async function actualizarOrdenCategoriaPedido(
    categoriaItem: CategoriaPedidoClinica,
    nuevoOrden: number
  ) {
    if (Number.isNaN(nuevoOrden) || nuevoOrden < 0) {
      alert("El orden no es válido")
      return
    }

    setActualizandoCategoriaPedidoId(categoriaItem.id)

    const { error } = await supabase
      .from("categorias_pedido_clinica")
      .update({
        orden: nuevoOrden,
      })
      .eq("id", categoriaItem.id)

    if (error) {
      console.log(error)
      alert("No se pudo actualizar el orden de la categoría")
      setActualizandoCategoriaPedidoId(null)
      return
    }

    await cargarCategoriasPedidoClinica()
    setActualizandoCategoriaPedidoId(null)
  }

  const categoriasDisponibles = useMemo(() => {
    const delBanco = productos
      .map((p) => p.categoria)
      .filter(Boolean) as string[]

    return Array.from(new Set([...categorias, ...delBanco])).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [categorias, productos])

  const categoriasPedidoActivas = useMemo(() => {
    return categoriasPedidoClinica
      .filter((c) => c.activa)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
  }, [categoriasPedidoClinica])

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideBusqueda =
        !busqueda.trim() ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoria_pedido || "").toLowerCase().includes(busqueda.toLowerCase())

      const coincideCategoria =
        !filtroCategoria || (p.categoria || "") === filtroCategoria

      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activos" && p.activo) ||
        (filtroEstado === "inactivos" && !p.activo)

      const coincideSolicitudClinica =
        filtroSolicitudClinica === "todos" ||
        (filtroSolicitudClinica === "si" && !!p.solicitavel_clinica) ||
        (filtroSolicitudClinica === "no" && !p.solicitavel_clinica)

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideEstado &&
        coincideSolicitudClinica
      )
    })
  }, [productos, busqueda, filtroCategoria, filtroEstado, filtroSolicitudClinica])

  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroCategoria, filtroEstado, filtroSolicitudClinica])

  const totalPaginas = Math.max(
    1,
    Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  )

  const productosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
    const fin = inicio + ITEMS_POR_PAGINA
    return productosFiltrados.slice(inicio, fin)
  }, [productosFiltrados, paginaActual])

  const resumen = useMemo(() => {
    const activos = productos.filter((p) => p.activo).length
    const inactivos = productos.filter((p) => !p.activo).length
    const fraccionables = productos.filter((p) => p.fraccionable).length
    const conMinimo = productos.filter((p) => Number(p.stock_minimo || 0) > 0).length
    const solicitables = productos.filter((p) => !!p.solicitavel_clinica).length

    return {
      total: productos.length,
      activos,
      inactivos,
      fraccionables,
      conMinimo,
      solicitables,
    }
  }, [productos])

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-lg font-semibold">
        Cargando productos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-3 md:p-4">
      <div className="max-w-[1450px] mx-auto space-y-4">
        <div className="rounded-[22px] bg-teal-800 text-white shadow-xl overflow-hidden">
          <div className="px-4 py-5 md:px-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100">
                Fundación Rugimos
              </p>
              <h1 className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight">
                Productos
              </h1>
              <p className="mt-2 text-sm text-white/85 max-w-3xl">
                Gestión completa de productos del inventario, mínimos, unidades, fraccionamiento y catálogo de pedidos clínicos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/inventario"
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-teal-800 transition hover:opacity-95"
              >
                Volver a Inventario
              </Link>
            </div>
          </div>

          <div className="bg-zinc-100 px-4 py-4 md:px-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Productos</div>
                <div className="mt-1 text-3xl font-extrabold text-teal-700">{resumen.total}</div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Activos</div>
                <div className="mt-1 text-3xl font-extrabold text-emerald-600">{resumen.activos}</div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Inactivos</div>
                <div className="mt-1 text-3xl font-extrabold text-zinc-500">{resumen.inactivos}</div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Fraccionables</div>
                <div className="mt-1 text-3xl font-extrabold text-amber-600">{resumen.fraccionables}</div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Con mínimo</div>
                <div className="mt-1 text-3xl font-extrabold text-[#F47C3C]">{resumen.conMinimo}</div>
              </div>

              <div className="rounded-[20px] bg-white px-4 py-3 shadow-sm min-w-0">
                <div className="text-sm text-zinc-500">Pedido clínico</div>
                <div className="mt-1 text-3xl font-extrabold text-blue-600">{resumen.solicitables}</div>
              </div>
            </div>

            <div className="mt-4 grid xl:grid-cols-12 gap-4">
              <div className="xl:col-span-4 space-y-4">
                <div className="bg-white rounded-[22px] shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-xl md:text-2xl font-extrabold text-[#0F6D6A]">
                      {editandoId ? "Editar producto" : "Nuevo producto"}
                    </h2>

                    {editandoId && (
                      <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-bold">
                        Edición
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Gasa, Tramadol, Aguja N25..."
                        className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">
                        Categoría
                      </label>

                      {!crearNuevaCategoria ? (
                        <div className="space-y-2">
                          <select
                            value={categoria}
                            onChange={(e) => setCategoria(e.target.value)}
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                          >
                            <option value="">Seleccionar categoría...</option>
                            {categoriasDisponibles.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setCrearNuevaCategoria(true)
                              setNuevaCategoria("")
                            }}
                            className="text-sm font-semibold text-[#0F6D6A] hover:opacity-80"
                          >
                            + Nueva categoría
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={nuevaCategoria}
                            onChange={(e) => setNuevaCategoria(e.target.value)}
                            placeholder="Escriba la nueva categoría"
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setCrearNuevaCategoria(false)
                              setNuevaCategoria("")
                            }}
                            className="text-sm font-semibold text-zinc-500 hover:opacity-80"
                          >
                            Cancelar nueva categoría
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          Unidad base
                        </label>
                        <select
                          value={unidadBase}
                          onChange={(e) => setUnidadBase(e.target.value)}
                          className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                        >
                          {UNIDADES_BASE.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          Stock mínimo
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={stockMinimo}
                          onChange={(e) => setStockMinimo(e.target.value)}
                          className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          Contenido por unidad
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={contenidoPorUnidad}
                          onChange={(e) => setContenidoPorUnidad(e.target.value)}
                          className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          Unidad de compra
                        </label>
                        <select
                          value={unidadCompra}
                          onChange={(e) => setUnidadCompra(e.target.value)}
                          className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                        >
                          {UNIDADES_COMPRA.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-zinc-800">Producto fraccionable</p>
                          <p className="text-sm text-zinc-500">
                            Activa esta opción si se divide en una unidad menor.
                          </p>
                        </div>

                        <input
                          type="checkbox"
                          checked={fraccionable}
                          onChange={(e) => setFraccionable(e.target.checked)}
                          className="h-5 w-5"
                        />
                      </div>

                      {fraccionable && (
                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-zinc-700 mb-2">
                            Unidad fraccionada
                          </label>
                          <select
                            value={unidadFraccionada}
                            onChange={(e) => setUnidadFraccionada(e.target.value)}
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                          >
                            {UNIDADES_BASE.map((unidad) => (
                              <option key={unidad} value={unidad}>
                                {unidad}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-blue-800">Disponible para pedido clínico</p>
                          <p className="text-sm text-blue-700">
                            Define si este producto aparecerá en el portal de pedidos de las clínicas.
                          </p>
                        </div>

                        <input
                          type="checkbox"
                          checked={solicitavelClinica}
                          onChange={(e) => setSolicitavelClinica(e.target.checked)}
                          className="h-5 w-5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          Foto del producto
                        </label>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={subiendoFoto}
                            className="rounded-2xl bg-[#0F6D6A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c5b59] disabled:opacity-60 transition"
                          >
                            {subiendoFoto ? "Subiendo..." : "Subir imagen"}
                          </button>

                          {fotoUrl && (
                            <button
                              type="button"
                              onClick={() => setFotoUrl("")}
                              className="rounded-2xl bg-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-300 transition"
                            >
                              Quitar foto
                            </button>
                          )}
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              await subirFotoProducto(file)
                            }
                            e.currentTarget.value = ""
                          }}
                        />

                        <p className="text-xs text-zinc-500 mt-2">
                          Puede elegir de la galería o tomar foto desde el celular.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-2">
                          URL final de la imagen
                        </label>
                        <input
                          type="text"
                          value={fotoUrl}
                          onChange={(e) => setFotoUrl(e.target.value)}
                          placeholder="Se completa automáticamente al subir"
                          className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-zinc-700 mb-2">
                            Ajuste de foto
                          </label>
                          <select
                            value={fotoFit}
                            onChange={(e) => setFotoFit(e.target.value as "contain" | "cover")}
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="contain">Mostrar completa</option>
                            <option value="cover">Llenar espacio</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-zinc-700 mb-2">
                            Zoom
                          </label>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            step="5"
                            value={fotoZoom}
                            onChange={(e) => setFotoZoom(e.target.value)}
                            className="w-full"
                          />
                          <p className="text-xs text-zinc-500 mt-1">{fotoZoom}%</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-blue-200 bg-white p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-2">
                          Vista previa
                        </p>
                        <div className="w-full h-44 rounded-2xl overflow-hidden bg-white flex items-center justify-center p-3">
                          {fotoUrl ? (
                            <img
                              src={fotoUrl}
                              alt="Vista previa del producto"
                              className={`w-full h-full ${fotoFit === "cover" ? "object-cover" : "object-contain"}`}
                              style={{ transform: `scale(${Number(fotoZoom) / 100})` }}
                              onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : (
                            <span className="text-4xl">📦</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-blue-800">Categorías del portal</p>
                          <p className="text-sm text-blue-700">
                            Solo las categorías activas aparecerán en el pedido clínico.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setMostrarGestorCategoriasPedido((prev) => !prev)
                          }
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-blue-700 border border-blue-200 hover:bg-blue-50 transition"
                        >
                          {mostrarGestorCategoriasPedido ? "Ocultar" : "Gestionar"}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-zinc-700 mb-2">
                            Categoría del pedido
                          </label>
                          <select
                            value={categoriaPedido}
                            onChange={(e) => setCategoriaPedido(e.target.value)}
                            disabled={!solicitavelClinica}
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                          >
                            <option value="">Seleccionar categoría...</option>
                            {categoriasPedidoActivas.map((cat) => (
                              <option key={cat.id} value={cat.nombre}>
                                {cat.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-zinc-700 mb-2">
                            Orden en catálogo
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={ordenPedido}
                            onChange={(e) => setOrdenPedido(e.target.value)}
                            disabled={!solicitavelClinica}
                            className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>

                    {mostrarGestorCategoriasPedido && (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 space-y-4">
                        <div>
                          <h3 className="text-lg font-bold text-purple-800">
                            Gestor de categorías del portal
                          </h3>
                          <p className="text-sm text-purple-700 mt-1">
                            Aquí puede crear, activar, desactivar y ordenar las categorías del pedido clínico.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-3">
                          <input
                            type="text"
                            value={nuevaCategoriaPedido}
                            onChange={(e) => setNuevaCategoriaPedido(e.target.value)}
                            placeholder="Nueva categoría"
                            className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-200"
                          />

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={nuevoOrdenCategoriaPedido}
                            onChange={(e) => setNuevoOrdenCategoriaPedido(e.target.value)}
                            placeholder="Orden"
                            className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-200"
                          />

                          <button
                            type="button"
                            onClick={crearCategoriaPedidoClinica}
                            disabled={guardandoCategoriaPedido}
                            className="rounded-2xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-60 transition"
                          >
                            {guardandoCategoriaPedido ? "Guardando..." : "Agregar"}
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {categoriasPedidoClinica.map((cat) => (
                            <div
                              key={cat.id}
                              className="rounded-2xl border border-purple-100 bg-white p-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                  <p className="font-bold text-zinc-800">{cat.nombre}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        cat.activa
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-zinc-100 text-zinc-600"
                                      }`}
                                    >
                                      {cat.activa ? "Activa" : "Inactiva"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    defaultValue={cat.orden}
                                    onBlur={(e) =>
                                      actualizarOrdenCategoriaPedido(
                                        cat,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-24 border border-zinc-300 bg-white text-zinc-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => toggleCategoriaPedidoActiva(cat)}
                                    disabled={actualizandoCategoriaPedidoId === cat.id}
                                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                      cat.activa
                                        ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    } disabled:opacity-60`}
                                  >
                                    {actualizandoCategoriaPedidoId === cat.id
                                      ? "Guardando..."
                                      : cat.activa
                                      ? "Desactivar"
                                      : "Activar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {categoriasPedidoClinica.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-purple-200 p-6 text-center text-purple-700 text-sm">
                              No hay categorías creadas todavía.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3">
                        <input
                          type="checkbox"
                          checked={controlaStock}
                          onChange={(e) => setControlaStock(e.target.checked)}
                        />
                        <span className="font-medium text-sm text-zinc-700">Controla stock</span>
                      </label>

                      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3">
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={(e) => setActivo(e.target.checked)}
                        />
                        <span className="font-medium text-sm text-zinc-700">Producto activo</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">
                        Observaciones
                      </label>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        rows={3}
                        placeholder="Observaciones opcionales"
                        className="w-full border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={guardarProducto}
                        disabled={guardando}
                        className={`flex-1 py-3 rounded-2xl font-bold text-white transition ${
                          guardando
                            ? "bg-zinc-400 cursor-not-allowed"
                            : "bg-[#F47C3C] hover:bg-[#df6f34]"
                        }`}
                      >
                        {guardando
                          ? "Guardando..."
                          : editandoId
                          ? "Guardar cambios"
                          : "Crear producto"}
                      </button>

                      <button
                        onClick={limpiarFormulario}
                        type="button"
                        className="px-5 py-3 rounded-2xl font-bold bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition"
                      >
                        {editandoId ? "Cancelar" : "Limpiar"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-8 bg-white rounded-[22px] shadow-sm p-4 min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-[#0F6D6A]">
                      Lista de productos
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                      Busca, filtra y edita productos directamente desde esta pantalla.
                    </p>
                  </div>

                  <div className="text-sm text-zinc-500">
                    Total filtrado: <span className="font-bold text-zinc-700">{productosFiltrados.length}</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3 mb-4">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o categoría..."
                    className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                  />

                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">Todas las categorías</option>
                    {categoriasDisponibles.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="activos">Solo activos</option>
                    <option value="inactivos">Solo inactivos</option>
                  </select>

                  <select
                    value={filtroSolicitudClinica}
                    onChange={(e) => setFiltroSolicitudClinica(e.target.value)}
                    className="border border-zinc-300 bg-white text-zinc-800 rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="todos">Pedido clínico: todos</option>
                    <option value="si">Solo visibles en pedido</option>
                    <option value="no">Solo ocultos del pedido</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                  <table className="w-full text-xs md:text-sm table-fixed">
                    <thead className="bg-zinc-50">
                      <tr className="text-left text-zinc-600">
                        <th className="py-3 px-2 font-bold w-[22%]">Producto</th>
                        <th className="py-3 px-2 font-bold w-[12%]">Categoría</th>
                        <th className="py-3 px-2 font-bold w-[7%]">Unidad</th>
                        <th className="py-3 px-2 font-bold w-[7%]">Mínimo</th>
                        <th className="py-3 px-2 font-bold w-[8%]">Compra</th>
                        <th className="py-3 px-2 font-bold w-[8%]">Fracción</th>
                        <th className="py-3 px-2 font-bold w-[10%]">Pedido</th>
                        <th className="py-3 px-2 font-bold w-[10%]">Cat. pedido</th>
                        <th className="py-3 px-2 font-bold w-[5%]">Orden</th>
                        <th className="py-3 px-2 font-bold w-[6%]">Estado</th>
                        <th className="py-3 px-2 font-bold w-[13%] text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosPaginados.map((producto) => (
                        <tr
                          key={producto.id}
                          className="border-t border-zinc-200 hover:bg-zinc-50/60 transition"
                        >
                          <td className="py-3 px-2 align-top">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-11 h-11 rounded-xl border border-zinc-200 bg-white flex items-center justify-center shrink-0 p-1 overflow-hidden">
                                {producto.foto_url ? (
                                  <img
                                    src={producto.foto_url}
                                    alt={producto.nombre}
                                    className={`w-full h-full ${(producto.foto_fit || "contain") === "cover" ? "object-cover" : "object-contain"}`}
                                    style={{ transform: `scale(${Number(producto.foto_zoom ?? 100) / 100})` }}
                                  />
                                ) : (
                                  <span className="text-base">📦</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-bold text-zinc-800 leading-4 break-words">
                                  {producto.nombre}
                                </div>
                                <div className="text-[11px] text-zinc-500 mt-1">
                                  {producto.controla_stock ? "Controla stock" : "Sin control"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-2 text-zinc-700 align-top break-words">
                            {producto.categoria || "-"}
                          </td>

                          <td className="py-3 px-2 text-zinc-700 align-top break-words">
                            {producto.unidad_base}
                          </td>

                          <td className="py-3 px-2 text-zinc-700 font-semibold align-top">
                            {Number(producto.stock_minimo || 0).toFixed(0)}
                          </td>

                          <td className="py-3 px-2 text-zinc-700 align-top break-words">
                            {producto.unidad_compra || "-"}
                          </td>

                          <td className="py-3 px-2 align-top">
                            {producto.fraccionable ? (
                              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                {producto.unidad_fraccionada || "Sí"}
                              </span>
                            ) : (
                              <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                No
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-2 align-top">
                            {producto.solicitavel_clinica ? (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                Visible
                              </span>
                            ) : (
                              <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                Oculto
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-2 text-zinc-700 align-top break-words">
                            {producto.categoria_pedido || "-"}
                          </td>

                          <td className="py-3 px-2 text-zinc-700 font-semibold align-top">
                            {producto.orden_pedido ?? 0}
                          </td>

                          <td className="py-3 px-2 align-top">
                            {producto.activo ? (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                Activo
                              </span>
                            ) : (
                              <span className="bg-zinc-200 text-zinc-700 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
                                Inactivo
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-2 align-top">
                            <div className="flex justify-end gap-1 flex-wrap">
                              <button
                                onClick={() => cargarParaEditar(producto)}
                                className="bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-xl text-[10px] font-bold hover:bg-blue-200 transition"
                              >
                                Editar
                              </button>

                              <button
                                onClick={() => cambiarEstado(producto)}
                                className="bg-orange-100 text-orange-700 px-2.5 py-1.5 rounded-xl text-[10px] font-bold hover:bg-orange-200 transition"
                              >
                                {producto.activo ? "Desactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {productosPaginados.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-10 text-center text-zinc-500">
                            No se encontraron productos con esos filtros
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-zinc-500">
                    Página <span className="font-bold text-zinc-700">{paginaActual}</span> de{" "}
                    <span className="font-bold text-zinc-700">{totalPaginas}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                      className="px-4 py-2 rounded-xl bg-zinc-200 text-zinc-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-300 transition"
                    >
                      Anterior
                    </button>

                    <button
                      onClick={() =>
                        setPaginaActual((p) => Math.min(totalPaginas, p + 1))
                      }
                      disabled={paginaActual === totalPaginas}
                      className="px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-800 transition"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm text-zinc-500">
                  Ahora puede controlar desde aquí qué productos aparecen en el pedido clínico, subir foto, ajustar cómo se ve y manejar categorías activas del portal.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}