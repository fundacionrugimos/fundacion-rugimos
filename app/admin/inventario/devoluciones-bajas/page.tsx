"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type AjusteInventario = {
  id: string
  tipo: "devolucion" | "baja"
  almacen_origen_id: string
  almacen_destino_id: string | null
  producto_id: string
  producto_nombre: string
  cantidad_base: number
  cantidad_fraccionada: number
  motivo: string | null
  responsable: string | null
  observaciones: string | null
  created_at: string
}

type Almacen = {
  id: string
  nombre: string
  tipo: string | null
  clinica_id: string | null
  activo?: boolean | null
}

type Producto = {
  id: string
  nombre: string
  unidad_base: string | null
  unidad_compra: string | null
  unidad_fraccionada: string | null
  contenido_por_unidad: number | null
  fraccionable: boolean | null
  activo?: boolean | null
}

function formatearFecha(valor?: string | null) {
  if (!valor) return "-"
  return new Date(valor).toLocaleString("es-BO")
}

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export default function AjustesInventarioPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [abiertoModal, setAbiertoModal] = useState(false)

  const [ajustes, setAjustes] = useState<AjusteInventario[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const [busqueda, setBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [filtroAlmacen, setFiltroAlmacen] = useState("todos")

  const [tipo, setTipo] = useState<"devolucion" | "baja">("devolucion")
  const [almacenOrigenId, setAlmacenOrigenId] = useState("")
  const [almacenDestinoId, setAlmacenDestinoId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidadBase, setCantidadBase] = useState("")
  const [motivo, setMotivo] = useState("devolución clínica")
  const [responsable, setResponsable] = useState("admin")
  const [observaciones, setObservaciones] = useState("")

  async function cargarTodo() {
    setCargando(true)

    const [ajustesRes, almacenesRes, productosRes] = await Promise.all([
      supabase
        .from("ajustes_inventario")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id,activo")
        .eq("activo", true)
        .order("tipo", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("productos")
        .select(
          "id,nombre,unidad_base,unidad_compra,unidad_fraccionada,contenido_por_unidad,fraccionable,activo"
        )
        .eq("activo", true)
        .order("nombre", { ascending: true }),
    ])

    if (ajustesRes.error) console.log("Error ajustes:", ajustesRes.error)
    if (almacenesRes.error) console.log("Error almacenes:", almacenesRes.error)
    if (productosRes.error) console.log("Error productos:", productosRes.error)

    const ajustesData = (ajustesRes.data as AjusteInventario[]) || []
    const almacenesData = (almacenesRes.data as Almacen[]) || []
    const productosData = (productosRes.data as Producto[]) || []

    setAjustes(ajustesData)
    setAlmacenes(almacenesData)
    setProductos(productosData)

    const central = almacenesData.find((a) =>
      (a.nombre || "").toLowerCase().includes("central")
    )

    if (central && !almacenDestinoId) {
      setAlmacenDestinoId(central.id)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const productoSeleccionado = useMemo(() => {
    return productos.find((p) => p.id === productoId) || null
  }, [productos, productoId])

  const cantidadBaseNumero = Number(cantidadBase || 0)

  const cantidadFraccionadaCalculada = useMemo(() => {
    if (!productoSeleccionado || !cantidadBaseNumero || cantidadBaseNumero <= 0) return 0

    const contenido = Number(productoSeleccionado.contenido_por_unidad || 1)
    const fraccionable = Boolean(productoSeleccionado.fraccionable)

    return fraccionable ? cantidadBaseNumero * contenido : cantidadBaseNumero
  }, [productoSeleccionado, cantidadBaseNumero])

  const unidadCompraPreview =
    productoSeleccionado?.unidad_compra ||
    productoSeleccionado?.unidad_base ||
    "unidad"

  const unidadFraccionadaPreview =
    productoSeleccionado?.unidad_fraccionada ||
    productoSeleccionado?.unidad_base ||
    "unidad"

  const ajustesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return ajustes.filter((item) => {
      const coincideBusqueda =
        !texto ||
        (item.producto_nombre || "").toLowerCase().includes(texto) ||
        (item.motivo || "").toLowerCase().includes(texto) ||
        (item.responsable || "").toLowerCase().includes(texto)

      const coincideTipo = filtroTipo === "todos" || item.tipo === filtroTipo

      const coincideAlmacen =
        filtroAlmacen === "todos" ||
        item.almacen_origen_id === filtroAlmacen ||
        item.almacen_destino_id === filtroAlmacen

      return coincideBusqueda && coincideTipo && coincideAlmacen
    })
  }, [ajustes, busqueda, filtroTipo, filtroAlmacen])

  const totalDevoluciones = ajustes.filter((a) => a.tipo === "devolucion").length
  const totalBajas = ajustes.filter((a) => a.tipo === "baja").length
  const totalGeneral = ajustes.length

  function limpiarFormulario() {
    setTipo("devolucion")
    setAlmacenOrigenId("")
    const central = almacenes.find((a) =>
      (a.nombre || "").toLowerCase().includes("central")
    )
    setAlmacenDestinoId(central?.id || "")
    setProductoId("")
    setCantidadBase("")
    setMotivo("devolución clínica")
    setResponsable("admin")
    setObservaciones("")
  }

  function abrirModal() {
    limpiarFormulario()
    setAbiertoModal(true)
  }

  function cerrarModal() {
    if (guardando) return
    setAbiertoModal(false)
  }

  async function guardarAjuste() {
    if (!tipo) {
      alert("Seleccione el tipo de ajuste")
      return
    }

    if (!almacenOrigenId) {
      alert("Seleccione el almacén de origen")
      return
    }

    if (tipo === "devolucion" && !almacenDestinoId) {
      alert("Seleccione el almacén de destino")
      return
    }

    if (tipo === "devolucion" && almacenOrigenId === almacenDestinoId) {
      alert("El origen y destino no pueden ser el mismo")
      return
    }

    if (!productoId) {
      alert("Seleccione el producto")
      return
    }

    if (!cantidadBaseNumero || cantidadBaseNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    if (!productoSeleccionado) {
      alert("No se encontró el producto seleccionado")
      return
    }

    setGuardando(true)

    const { error } = await supabase.from("ajustes_inventario").insert({
      tipo,
      almacen_origen_id: almacenOrigenId,
      almacen_destino_id: tipo === "devolucion" ? almacenDestinoId : null,
      producto_id: productoSeleccionado.id,
      producto_nombre: productoSeleccionado.nombre,
      cantidad_base: cantidadBaseNumero,
      cantidad_fraccionada: cantidadFraccionadaCalculada,
      motivo: motivo || null,
      responsable: responsable || null,
      observaciones: observaciones || null,
    })

    if (error) {
      console.log("Error guardando ajuste:", error)
      alert(error.message || "No se pudo guardar el ajuste")
      setGuardando(false)
      return
    }

    alert("Ajuste registrado correctamente")
    setAbiertoModal(false)
    await cargarTodo()
    setGuardando(false)
  }

  function nombreAlmacen(id?: string | null) {
    if (!id) return "-"
    return almacenes.find((a) => a.id === id)?.nombre || "-"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#0F6D6A] border-t-transparent animate-spin mb-5" />
          <h2 className="text-2xl font-bold text-[#0F6D6A]">
            Cargando ajustes
          </h2>
          <p className="text-gray-600 mt-2">
            Preparando devoluciones, bajas, almacenes y productos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-[#0F6D6A] border border-white/10 text-white rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-white/75 font-semibold">
                  Fundación Rugimos
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mt-1">
                  Centro de control de ajustes de inventario
                </h1>
                <p className="text-white/85 mt-3 max-w-3xl">
                  Registro administrativo de devoluciones y bajas del sistema.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/admin/inventario"
                  className="bg-white text-[#0F6D6A] px-5 py-3 rounded-2xl font-bold hover:bg-gray-100 transition"
                >
                  Volver al inventario
                </Link>

                <button
                  type="button"
                  onClick={abrirModal}
                  className="bg-[#F47C3C] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#db6d31] transition"
                >
                  Nuevo ajuste
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 shadow-xl">
              <div className="text-sm text-gray-500">Devoluciones</div>
              <div className="text-3xl font-bold text-[#0F6D6A] mt-2">
                {totalDevoluciones}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-xl">
              <div className="text-sm text-gray-500">Bajas</div>
              <div className="text-3xl font-bold text-red-600 mt-2">
                {totalBajas}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-xl">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {totalGeneral}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-xl">
            <div className="grid xl:grid-cols-4 gap-3">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto, motivo, responsable..."
                className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
              />

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
              >
                <option value="todos">Todos los tipos</option>
                <option value="devolucion">Devoluciones</option>
                <option value="baja">Bajas</option>
              </select>

              <select
                value={filtroAlmacen}
                onChange={(e) => setFiltroAlmacen(e.target.value)}
                className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
              >
                <option value="todos">Todos los almacenes</option>
                {almacenes.map((almacen) => (
                  <option key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setBusqueda("")
                  setFiltroTipo("todos")
                  setFiltroAlmacen("todos")
                }}
                className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="px-4 py-4">Fecha</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Producto</th>
                    <th className="px-4 py-4">Cantidad</th>
                    <th className="px-4 py-4">Origen</th>
                    <th className="px-4 py-4">Destino</th>
                    <th className="px-4 py-4">Motivo</th>
                    <th className="px-4 py-4">Usuario</th>
                  </tr>
                </thead>

                <tbody>
                  {ajustesFiltrados.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatearFecha(item.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.tipo === "devolucion"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.tipo}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-semibold text-gray-900">
                        {item.producto_nombre}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">
                          {formatearNumero(item.cantidad_base)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Fraccionado: {formatearNumero(item.cantidad_fraccionada)}
                        </div>
                      </td>

                      <td className="px-4 py-4">{nombreAlmacen(item.almacen_origen_id)}</td>
                      <td className="px-4 py-4">{nombreAlmacen(item.almacen_destino_id)}</td>
                      <td className="px-4 py-4">{item.motivo || "-"}</td>
                      <td className="px-4 py-4">{item.responsable || "-"}</td>
                    </tr>
                  ))}

                  {ajustesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No hay ajustes registrados con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {abiertoModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-[28px] shadow-2xl overflow-hidden">
            <div className="bg-[#0F6D6A] text-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/70 font-semibold">
                    Inventario
                  </div>
                  <h2 className="text-2xl font-bold mt-1">
                    Nuevo ajuste de inventario
                  </h2>
                  <p className="text-white/80 mt-2">
                    Registre una devolución o una baja administrativa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cerrarModal}
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 transition text-xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de ajuste
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value as "devolucion" | "baja"
                      setTipo(nuevoTipo)
                      setMotivo(
                        nuevoTipo === "devolucion" ? "devolución clínica" : "producto vencido"
                      )
                    }}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="devolucion">Devolución</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Responsable
                  </label>
                  <input
                    type="text"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Ej: admin"
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Almacén origen
                  </label>
                  <select
                    value={almacenOrigenId}
                    onChange={(e) => setAlmacenOrigenId(e.target.value)}
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

                {tipo === "devolucion" ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Almacén destino
                    </label>
                    <select
                      value={almacenDestinoId}
                      onChange={(e) => setAlmacenDestinoId(e.target.value)}
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
                ) : (
                  <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-4 flex items-center">
                    <div>
                      <div className="text-sm font-bold text-red-700">Baja</div>
                      <div className="text-sm text-red-600 mt-1">
                        Este ajuste no tiene almacén destino.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cantidad base
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={cantidadBase}
                    onChange={(e) => setCantidadBase(e.target.value)}
                    placeholder="Ej: 1"
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>
              </div>

              {productoSeleccionado && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-gray-50 border p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Unidad compra
                    </div>
                    <div className="font-bold text-gray-900">
                      {unidadCompraPreview}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 border p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Contenido por unidad
                    </div>
                    <div className="font-bold text-gray-900">
                      {formatearNumero(productoSeleccionado.contenido_por_unidad || 1)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F47C3C]/10 border border-[#F47C3C]/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Resultado fraccionado
                    </div>
                    <div className="font-bold text-[#F47C3C]">
                      {formatearNumero(cantidadFraccionadaCalculada)} {unidadFraccionadaPreview}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Motivo
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    {tipo === "devolucion" ? (
                      <>
                        <option value="devolución clínica">Devolución clínica</option>
                        <option value="sobrante de transferencia">Sobrante de transferencia</option>
                        <option value="retorno a almacén central">Retorno a almacén central</option>
                        <option value="otro">Otro</option>
                      </>
                    ) : (
                      <>
                        <option value="producto vencido">Producto vencido</option>
                        <option value="producto dañado">Producto dañado</option>
                        <option value="pérdida">Pérdida</option>
                        <option value="descarte">Descarte</option>
                        <option value="otro">Otro</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas o aclaraciones..."
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 p-4">
                <div className="text-sm text-gray-600 mb-2">Resumen del ajuste</div>
                <div className="text-base font-bold text-[#0F6D6A]">
                  {tipo === "devolucion" ? "Devolución" : "Baja"} •{" "}
                  {productoSeleccionado?.nombre || "Sin producto"} •{" "}
                  {formatearNumero(cantidadBaseNumero)} {unidadCompraPreview}
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={cerrarModal}
                className="px-5 py-3 rounded-2xl font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarAjuste}
                disabled={guardando}
                className={`px-5 py-3 rounded-2xl font-bold text-white transition ${
                  guardando
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#F47C3C] hover:bg-[#db6d31]"
                }`}
              >
                {guardando ? "Guardando..." : "Guardar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}