"use client"

import { useEffect, useState } from "react"
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
}

const UNIDADES = [
  "unidad",
  "ampolla",
  "ml",
  "rollo",
  "caja",
  "frasco",
  "paquete",
  "fraccion",
]

export default function AdminInventarioProductosPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])

  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [nombre, setNombre] = useState("")
  const [categoria, setCategoria] = useState("")
  const [unidadBase, setUnidadBase] = useState("unidad")
  const [stockMinimo, setStockMinimo] = useState("0")
  const [controlaStock, setControlaStock] = useState(true)
  const [activo, setActivo] = useState(true)
  const [observaciones, setObservaciones] = useState("")

  async function cargarProductos() {
    setCargando(true)

    const { data, error } = await supabase
      .from("productos")
      .select(`
        id,
        nombre,
        categoria,
        unidad_base,
        stock_minimo,
        controla_stock,
        activo,
        observaciones
      `)
      .order("nombre", { ascending: true })

    if (error) {
      console.log(error)
      setCargando(false)
      return
    }

    setProductos((data as Producto[]) || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarProductos()
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
  }

  function cargarParaEditar(producto: Producto) {
    setEditandoId(producto.id)
    setNombre(producto.nombre || "")
    setCategoria(producto.categoria || "")
    setUnidadBase(producto.unidad_base || "unidad")
    setStockMinimo(String(producto.stock_minimo ?? 0))
    setControlaStock(producto.controla_stock)
    setActivo(producto.activo)
    setObservaciones(producto.observaciones || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function guardarProducto() {
    if (!nombre.trim()) {
      alert("Debe ingresar el nombre del producto")
      return
    }

    if (!unidadBase.trim()) {
      alert("Debe seleccionar la unidad")
      return
    }

    const minimoNumero = Number(stockMinimo)

    if (Number.isNaN(minimoNumero) || minimoNumero < 0) {
      alert("El stock mínimo no es válido")
      return
    }

    setGuardando(true)

    const payload = {
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      unidad_base: unidadBase,
      stock_minimo: minimoNumero,
      controla_stock: controlaStock,
      activo,
      observaciones: observaciones.trim() || null,
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
      const { error } = await supabase
        .from("productos")
        .insert(payload)

      if (error) {
        console.log(error)
        alert(error.message || "No se pudo crear el producto")
        setGuardando(false)
        return
      }

      alert("Producto creado correctamente")
    }

    limpiarFormulario()
    await cargarProductos()
    setGuardando(false)
  }

  async function cambiarEstado(producto: Producto) {
    const nuevoEstado = !producto.activo

    const { error } = await supabase
      .from("productos")
      .update({ activo: nuevoEstado })
      .eq("id", producto.id)

    if (error) {
      console.log(error)
      alert("No se pudo cambiar el estado del producto")
      return
    }

    await cargarProductos()
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando productos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Productos
            </h1>
            <p className="text-white/80 mt-1">
              Gestión de productos del inventario
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
              {editandoId ? "Editar producto" : "Nuevo producto"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Gasa"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Categoría
                </label>
                <input
                  type="text"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ej: Material / Medicamento"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unidad base
                </label>
                <select
                  value={unidadBase}
                  onChange={(e) => setUnidadBase(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  {UNIDADES.map((unidad) => (
                    <option key={unidad} value={unidad}>
                      {unidad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Stock mínimo
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <label className="flex items-center gap-3 text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={controlaStock}
                  onChange={(e) => setControlaStock(e.target.checked)}
                />
                Controla stock
              </label>

              <label className="flex items-center gap-3 text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                Producto activo
              </label>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3"
                  placeholder="Observaciones opcionales"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarProducto}
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
                    : "Crear producto"}
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
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Lista de productos
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-3">Nombre</th>
                    <th className="py-3 pr-3">Categoría</th>
                    <th className="py-3 pr-3">Unidad</th>
                    <th className="py-3 pr-3">Stock mínimo</th>
                    <th className="py-3 pr-3">Activo</th>
                    <th className="py-3 pr-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto) => (
                    <tr key={producto.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {producto.nombre}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {producto.categoria || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {producto.unidad_base}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {Number(producto.stock_minimo || 0).toFixed(3)}
                      </td>
                      <td className="py-3 pr-3">
                        {producto.activo ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                            Activo
                          </span>
                        ) : (
                          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-bold">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => cargarParaEditar(producto)}
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-200 transition"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => cambiarEstado(producto)}
                            className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-orange-200 transition"
                          >
                            {producto.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {productos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No hay productos registrados
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