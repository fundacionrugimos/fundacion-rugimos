"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  unidad_base: string
  unidad_fraccionada?: string | null
  stock_minimo: number
}

type StockRow = {
  id: string
  almacen_id: string
  producto_id: string
  cantidad_actual: number
  cantidad_minima: number
  productos: any
  almacenes: any
}

function formatearNumero(valor: number | null | undefined) {
  const numero = Number(valor || 0)

  return numero.toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export default function AdminInventarioStockPage() {
  const searchParams = useSearchParams()

  const [cargando, setCargando] = useState(true)
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState("")
  const [busqueda, setBusqueda] = useState("")

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [almacenesRes, stockRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("tipo", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("stock_almacen")
        .select(`
          id,
          almacen_id,
          producto_id,
          cantidad_actual,
          cantidad_minima,
          productos:producto_id (
            id,
            nombre,
            unidad_base,
            unidad_fraccionada,
            stock_minimo
          ),
          almacenes:almacen_id (
            id,
            nombre,
            tipo,
            clinica_id
          )
        `),
    ])

    if (almacenesRes.error) console.log(almacenesRes.error)
    if (stockRes.error) console.log(stockRes.error)

    const almacenesData = (almacenesRes.data as Almacen[]) || []

    const stockNormalizado: StockRow[] = ((stockRes.data as any[]) || []).map((item) => ({
      ...item,
      productos: normalizarRelacion(item.productos),
      almacenes: normalizarRelacion(item.almacenes),
    }))

    setAlmacenes(almacenesData)
    setStock(stockNormalizado)

    const almacenIdUrl = searchParams.get("almacen_id")
    const productoIdUrl = searchParams.get("producto_id")

    if (almacenIdUrl && almacenesData.some((a) => a.id === almacenIdUrl)) {
      setAlmacenSeleccionado(almacenIdUrl)
    } else if (!almacenSeleccionado && almacenesData.length > 0) {
      setAlmacenSeleccionado(almacenesData[0].id)
    }

    if (productoIdUrl) {
      const itemProducto = stockNormalizado.find((item) => item.producto_id === productoIdUrl)
      if (itemProducto?.productos?.nombre) {
        setBusqueda(itemProducto.productos.nombre)
      }
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stockFiltrado = useMemo(() => {
    return stock
      .filter((item) => item.almacen_id === almacenSeleccionado)
      .filter((item) => {
        const texto = busqueda.trim().toLowerCase()
        if (!texto) return true
        return (item.productos?.nombre || "").toLowerCase().includes(texto)
      })
      .sort((a, b) => (a.productos?.nombre || "").localeCompare(b.productos?.nombre || ""))
  }, [stock, almacenSeleccionado, busqueda])

  const resumen = useMemo(() => {
    const items = stock.filter((item) => item.almacen_id === almacenSeleccionado)

    const totalProductos = items.length
    const negativos = items.filter((item) => Number(item.cantidad_actual) < 0).length
    const bajos = items.filter((item) => {
      const actual = Number(item.cantidad_actual || 0)
      const minimo = Number(item.cantidad_minima || 0)
      return actual >= 0 && actual <= minimo
    }).length

    return {
      totalProductos,
      negativos,
      bajos,
    }
  }, [stock, almacenSeleccionado])

  const almacenActual = almacenes.find((a) => a.id === almacenSeleccionado)

  function estadoStock(item: StockRow) {
    const actual = Number(item.cantidad_actual || 0)
    const minimo = Number(item.cantidad_minima || 0)

    if (actual < 0) {
      return {
        texto: "Negativo",
        clase: "bg-red-100 text-red-700",
      }
    }

    if (actual <= minimo) {
      return {
        texto: "Bajo",
        clase: "bg-orange-100 text-orange-700",
      }
    }

    return {
      texto: "OK",
      clase: "bg-green-100 text-green-700",
    }
  }

  function obtenerUnidad(item: StockRow) {
    return item.productos?.unidad_fraccionada || item.productos?.unidad_base || "-"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando stock...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Stock por Almacén
            </h1>
            <p className="text-white/80 mt-1">
              Visualice el stock completo del almacén central y de cada clínica
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              href="/admin/inventario"
              className="bg-white text-[#0F6D6A] px-3 py-2 rounded-lg font-semibold shadow hover:bg-gray-100 transition text-sm"
            >
              Volver a Inventario
            </Link>

            <button
              type="button"
              onClick={() => {
                if (!almacenSeleccionado) {
                  alert("Seleccione un almacén primero")
                  return
                }

                window.open(`/admin/inventario/print?almacen=${almacenSeleccionado}`, "_blank")
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-semibold shadow transition text-sm"
            >
              🖨 Imprimir checklist
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Seleccionar almacén
              </label>
              <select
                value={almacenSeleccionado}
                onChange={(e) => setAlmacenSeleccionado(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Seleccionar</option>
                {almacenes.map((almacen) => (
                  <option key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar producto
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: gasa, hilo, vitamina..."
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Almacén</p>
            <p className="text-lg font-bold text-[#0F6D6A] mt-2">
              {almacenActual?.nombre || "-"}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Productos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.totalProductos}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">
              {resumen.bajos}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock negativo</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {resumen.negativos}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Stock del almacén
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-3">Producto</th>
                  <th className="py-3 pr-3">Cantidad actual</th>
                  <th className="py-3 pr-3">Unidad</th>
                  <th className="py-3 pr-3">Stock mínimo</th>
                  <th className="py-3 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockFiltrado.map((item) => {
                  const estado = estadoStock(item)

                  return (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {item.productos?.nombre || "-"}
                      </td>

                      <td className="py-3 pr-3 text-gray-700">
                        {formatearNumero(item.cantidad_actual)}
                      </td>

                      <td className="py-3 pr-3 text-gray-700">
                        {obtenerUnidad(item)}
                      </td>

                      <td className="py-3 pr-3 text-gray-700">
                        {formatearNumero(item.cantidad_minima || 0)}
                      </td>

                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {stockFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No hay stock cargado para este almacén
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}