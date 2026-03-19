"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Receta = {
  id: string
  nombre_receta: string
  especie: string
  sexo: string
  activo: boolean
}

type Producto = {
  id: string
  nombre: string
  unidad_base: string
}

type RecetaItem = {
  id: string
  receta_id: string
  producto_id: string
  cantidad: number
  unidad: string | null
  observacion: string | null
  productos: any
}

export default function AdminInventarioRecetasPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [recetas, setRecetas] = useState<Receta[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [items, setItems] = useState<RecetaItem[]>([])

  const [recetaSeleccionada, setRecetaSeleccionada] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [unidad, setUnidad] = useState("")
  const [observacion, setObservacion] = useState("")
  const [editandoId, setEditandoId] = useState<string | null>(null)

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [recetasRes, productosRes, itemsRes] = await Promise.all([
      supabase
        .from("recetas_consumo")
        .select("id,nombre_receta,especie,sexo,activo")
        .order("nombre_receta", { ascending: true }),

      supabase
        .from("productos")
        .select("id,nombre,unidad_base")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("receta_items")
        .select(`
          id,
          receta_id,
          producto_id,
          cantidad,
          unidad,
          observacion,
          productos:producto_id (
            id,
            nombre,
            unidad_base
          )
        `),
    ])

    if (recetasRes.error) console.log(recetasRes.error)
    if (productosRes.error) console.log(productosRes.error)
    if (itemsRes.error) console.log(itemsRes.error)

    const recetasData = (recetasRes.data as Receta[]) || []
    const productosData = (productosRes.data as Producto[]) || []
    const itemsData: RecetaItem[] = ((itemsRes.data as any[]) || []).map((item) => ({
      ...item,
      productos: normalizarRelacion(item.productos),
    }))

    setRecetas(recetasData)
    setProductos(productosData)
    setItems(itemsData)

    if (!recetaSeleccionada && recetasData.length > 0) {
      setRecetaSeleccionada(recetasData[0].id)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  function limpiarFormulario() {
    setProductoId("")
    setCantidad("")
    setUnidad("")
    setObservacion("")
    setEditandoId(null)
  }

  function cargarParaEditar(item: RecetaItem) {
    setEditandoId(item.id)
    setRecetaSeleccionada(item.receta_id)
    setProductoId(item.producto_id)
    setCantidad(String(item.cantidad))
    setUnidad(item.unidad || item.productos?.unidad_base || "")
    setObservacion(item.observacion || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function guardarItem() {
    if (!recetaSeleccionada) {
      alert("Debe seleccionar una receta")
      return
    }

    if (!productoId) {
      alert("Debe seleccionar un producto")
      return
    }

    const cantidadNumero = Number(cantidad)

    if (!cantidadNumero || cantidadNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    setGuardando(true)

    const producto = productos.find((p) => p.id === productoId)

    const payload = {
      receta_id: recetaSeleccionada,
      producto_id: productoId,
      cantidad: cantidadNumero,
      unidad: unidad.trim() || producto?.unidad_base || null,
      observacion: observacion.trim() || null,
    }

    if (editandoId) {
      const { error } = await supabase
        .from("receta_items")
        .update(payload)
        .eq("id", editandoId)

      if (error) {
        console.log(error)
        alert(error.message || "No se pudo actualizar el item")
        setGuardando(false)
        return
      }

      alert("Item actualizado correctamente")
    } else {
      const { error } = await supabase
        .from("receta_items")
        .insert(payload)

      if (error) {
        console.log(error)
        alert(error.message || "No se pudo agregar el item")
        setGuardando(false)
        return
      }

      alert("Item agregado correctamente")
    }

    limpiarFormulario()
    await cargarTodo()
    setGuardando(false)
  }

  async function eliminarItem(id: string) {
    const ok = window.confirm("¿Desea eliminar este item de la receta?")
    if (!ok) return

    const { error } = await supabase
      .from("receta_items")
      .delete()
      .eq("id", id)

    if (error) {
      console.log(error)
      alert("No se pudo eliminar el item")
      return
    }

    await cargarTodo()
  }

  const itemsFiltrados = useMemo(() => {
    return items
      .filter((item) => item.receta_id === recetaSeleccionada)
      .sort((a, b) => (a.productos?.nombre || "").localeCompare(b.productos?.nombre || ""))
  }, [items, recetaSeleccionada])

  const recetaActual = recetas.find((r) => r.id === recetaSeleccionada)

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando recetas...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Recetas de Consumo
            </h1>
            <p className="text-white/80 mt-1">
              Configure el consumo automático por tipo de cirugía
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              href="/admin/inventario"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver a Inventario
            </Link>
          </div>
        </div>

        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">
              {editandoId ? "Editar item de receta" : "Agregar item a receta"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Receta
                </label>
                <select
                  value={recetaSeleccionada}
                  onChange={(e) => setRecetaSeleccionada(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="">Seleccionar receta</option>
                  {recetas.map((receta) => (
                    <option key={receta.id} value={receta.id}>
                      {receta.nombre_receta}
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
                  onChange={(e) => {
                    const val = e.target.value
                    setProductoId(val)
                    const prod = productos.find((p) => p.id === val)
                    if (prod && !unidad) setUnidad(prod.unidad_base)
                  }}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre} ({producto.unidad_base})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Ej: 1 o 0.333333"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unidad
                </label>
                <input
                  type="text"
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  placeholder="Ej: unidad / ampolla"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observación
                </label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl px-4 py-3"
                  placeholder='Ej: 1/3 de ampolla'
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarItem}
                  disabled={guardando}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition ${
                    guardando
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#F47C3C] hover:bg-[#db6d31]"
                  }`}
                >
                  {guardando
                    ? "Guardando..."
                    : editandoId
                    ? "Actualizar"
                    : "Agregar item"}
                </button>

                <button
                  onClick={limpiarFormulario}
                  type="button"
                  className="px-4 py-3 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-[#0F6D6A]">
                Items de la receta
              </h2>

              <select
                value={recetaSeleccionada}
                onChange={(e) => setRecetaSeleccionada(e.target.value)}
                className="border rounded-xl px-4 py-2"
              >
                {recetas.map((receta) => (
                  <option key={receta.id} value={receta.id}>
                    {receta.nombre_receta}
                  </option>
                ))}
              </select>
            </div>

            {recetaActual && (
              <div className="mb-4">
                <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                  {recetaActual.especie} - {recetaActual.sexo}
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-3">Producto</th>
                    <th className="py-3 pr-3">Cantidad</th>
                    <th className="py-3 pr-3">Unidad</th>
                    <th className="py-3 pr-3">Observación</th>
                    <th className="py-3 pr-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {item.productos?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {Number(item.cantidad).toFixed(6)}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {item.unidad || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {item.observacion || "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => cargarParaEditar(item)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-200 transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => eliminarItem(item.id)}
                            className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {itemsFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No hay items cargados en esta receta
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}