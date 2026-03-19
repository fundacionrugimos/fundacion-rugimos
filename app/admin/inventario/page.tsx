"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Producto = {
  id: string
  nombre: string
  stock_minimo: number
  unidad_base: string
}

type Almacen = {
  id: string
  nombre: string
  tipo: string
  clinica_id: string | null
}

type StockRow = {
  id: string
  cantidad_actual: number
  cantidad_minima: number
  almacen_id: string
  producto_id: string
  productos: any
  almacenes: any
}

type Movimiento = {
  id: string
  created_at: string
  tipo_movimiento: string
  cantidad: number
  motivo: string | null
  productos: any
  almacen_origen: any
  almacen_destino: any
}

export default function AdminInventarioPage() {
  const [cargando, setCargando] = useState(true)
  const [productos, setProductos] = useState<Producto[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [productosRes, almacenesRes, stockRes, movimientosRes] = await Promise.all([
      supabase
        .from("productos")
        .select("id,nombre,stock_minimo,unidad_base")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase.from("stock_almacen").select(`
        id,
        cantidad_actual,
        cantidad_minima,
        almacen_id,
        producto_id,
        productos:producto_id (
          id,
          nombre,
          stock_minimo,
          unidad_base
        ),
        almacenes:almacen_id (
          id,
          nombre,
          tipo,
          clinica_id
        )
      `),

      supabase
        .from("movimientos_stock")
        .select(`
          id,
          created_at,
          tipo_movimiento,
          cantidad,
          motivo,
          productos:producto_id (
            nombre,
            unidad_base
          ),
          almacen_origen:almacen_origen_id (
            nombre
          ),
          almacen_destino:almacen_destino_id (
            nombre
          )
        `)
        .order("created_at", { ascending: false })
        .limit(12),
    ])

    if (productosRes.error) console.log(productosRes.error)
    if (almacenesRes.error) console.log(almacenesRes.error)
    if (stockRes.error) console.log(stockRes.error)
    if (movimientosRes.error) console.log(movimientosRes.error)

    const stockNormalizado: StockRow[] = ((stockRes.data as any[]) || []).map((item) => ({
      ...item,
      productos: normalizarRelacion(item.productos),
      almacenes: normalizarRelacion(item.almacenes),
    }))

    const movimientosNormalizados: Movimiento[] = ((movimientosRes.data as any[]) || []).map(
      (item) => ({
        ...item,
        productos: normalizarRelacion(item.productos),
        almacen_origen: normalizarRelacion(item.almacen_origen),
        almacen_destino: normalizarRelacion(item.almacen_destino),
      })
    )

    setProductos((productosRes.data as Producto[]) || [])
    setAlmacenes((almacenesRes.data as Almacen[]) || [])
    setStock(stockNormalizado)
    setMovimientos(movimientosNormalizados)

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const stockNegativo = useMemo(() => {
    return stock.filter((item) => Number(item.cantidad_actual) < 0)
  }, [stock])

  const stockBajo = useMemo(() => {
    return stock.filter((item) => {
      const actual = Number(item.cantidad_actual || 0)
      const minimo = Number(item.cantidad_minima || 0)
      return actual >= 0 && actual <= minimo
    })
  }, [stock])

  const resumenPorAlmacen = useMemo(() => {
    return almacenes.map((almacen) => {
      const items = stock.filter((s) => s.almacen_id === almacen.id)

      const negativos = items.filter((s) => Number(s.cantidad_actual) < 0).length
      const bajos = items.filter((s) => {
        const actual = Number(s.cantidad_actual || 0)
        const minimo = Number(s.cantidad_minima || 0)
        return actual >= 0 && actual <= minimo
      }).length

      return {
        ...almacen,
        totalItems: items.length,
        negativos,
        bajos,
      }
    })
  }, [almacenes, stock])

  function badgeMovimiento(tipo: string) {
    if (tipo === "transferencia") return "bg-blue-100 text-blue-700"
    if (tipo === "consumo_cirugia") return "bg-green-100 text-green-700"
    if (tipo === "ajuste") return "bg-orange-100 text-orange-700"
    if (tipo === "entrada_manual") return "bg-emerald-100 text-emerald-700"
    if (tipo === "salida_manual") return "bg-red-100 text-red-700"
    if (tipo === "devolucion") return "bg-purple-100 text-purple-700"
    return "bg-gray-100 text-gray-700"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando inventario...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Inventario
            </h1>
            <p className="text-white/80 mt-1">
              Control general de stock, movimientos y alertas
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              href="/admin"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver al Admin
            </Link>

            <Link
              href="/admin/inventario/entradas"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Historial entradas
            </Link>

            <Link
              href="/admin/inventario/entrada"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
           >
             Registrar entrada
            </Link>

            <Link
              href="/admin/inventario/stock"
              className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
            >
              Stock por almacén
            </Link>

            <Link
              href="/admin/inventario/transferencias-nuevo"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Transferencias
            </Link>

            <Link
              href="/admin/inventario/productos"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Productos
            </Link>

            <Link
              href="/admin/inventario/recetas"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Recetas
            </Link>

            <Link
              href="/admin/inventario/movimientos"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Movimientos
            </Link>

            <Link
              href="/admin/inventario/ajustes"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Ajustes
            </Link>

            <Link
              href="/admin/inventario/minimos"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Mínimos
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Productos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {productos.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Almacenes</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {almacenes.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">
              {stockBajo.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock negativo</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {stockNegativo.length}
            </p>
          </div>
        </div>

        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Últimos movimientos
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-3">Fecha</th>
                    <th className="py-3 pr-3">Producto</th>
                    <th className="py-3 pr-3">Tipo</th>
                    <th className="py-3 pr-3">Cantidad</th>
                    <th className="py-3 pr-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => (
                    <tr key={mov.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 text-gray-700">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {mov.productos?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${badgeMovimiento(
                            mov.tipo_movimiento
                          )}`}
                        >
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {Number(mov.cantidad).toFixed(3)}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {mov.motivo || "-"}
                      </td>
                    </tr>
                  ))}

                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No hay movimientos todavía
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Alertas
            </h2>

            <div className="space-y-4">
              <div>
                <p className="font-bold text-red-600 mb-2">Stock negativo</p>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {stockNegativo.length > 0 ? (
                    stockNegativo.map((item) => (
                      <div
                        key={item.id}
                        className="border border-red-200 bg-red-50 rounded-xl p-3"
                      >
                        <p className="font-semibold text-gray-800">
                          {item.productos?.nombre}
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.almacenes?.nombre}
                        </p>
                        <p className="text-sm font-bold text-red-600 mt-1">
                          {Number(item.cantidad_actual).toFixed(3)}{" "}
                          {item.productos?.unidad_base}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No hay productos en negativo
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-bold text-orange-500 mb-2">Stock bajo</p>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {stockBajo.length > 0 ? (
                    stockBajo.map((item) => (
                      <div
                        key={item.id}
                        className="border border-orange-200 bg-orange-50 rounded-xl p-3"
                      >
                        <p className="font-semibold text-gray-800">
                          {item.productos?.nombre}
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.almacenes?.nombre}
                        </p>
                        <p className="text-sm font-bold text-orange-600 mt-1">
                          {Number(item.cantidad_actual).toFixed(3)} / mín.{" "}
                          {Number(item.cantidad_minima || 0).toFixed(3)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No hay productos con stock bajo
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Resumen por almacén
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-3">Almacén</th>
                  <th className="py-3 pr-3">Tipo</th>
                  <th className="py-3 pr-3">Productos</th>
                  <th className="py-3 pr-3">Stock bajo</th>
                  <th className="py-3 pr-3">Stock negativo</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorAlmacen.map((almacen) => (
                  <tr key={almacen.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 font-semibold text-gray-800">
                      {almacen.nombre}
                    </td>
                    <td className="py-3 pr-3 text-gray-700">
                      {almacen.tipo}
                    </td>
                    <td className="py-3 pr-3 text-gray-700">
                      {almacen.totalItems}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold">
                        {almacen.bajos}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                        {almacen.negativos}
                      </span>
                    </td>
                  </tr>
                ))}

                {resumenPorAlmacen.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No hay almacenes cargados
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