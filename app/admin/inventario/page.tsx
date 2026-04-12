"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

type FiltroAlerta = "todos" | "negativo" | "bajo"

export default function AdminInventarioPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [productos, setProductos] = useState<Producto[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [filtroAlerta, setFiltroAlerta] = useState<FiltroAlerta>("todos")
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<StockRow | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [almacenSeleccionadoId, setAlmacenSeleccionadoId] = useState<string | null>(null)

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
    return stock.filter((item) => Number(item.cantidad_actual || 0) < 0)
  }, [stock])

  const stockBajo = useMemo(() => {
    return stock.filter((item) => {
      const actual = Number(item.cantidad_actual || 0)
      const minimo = Number(item.cantidad_minima || 0)
      return actual >= 0 && actual <= minimo
    })
  }, [stock])

  const alertasVisibles = useMemo(() => {
    let base =
      filtroAlerta === "negativo"
        ? stockNegativo
        : filtroAlerta === "bajo"
        ? stockBajo
        : [...stockNegativo, ...stockBajo]

    if (almacenSeleccionadoId) {
      base = base.filter((item) => item.almacen_id === almacenSeleccionadoId)
    }

    return base.sort((a, b) => {
      const aNeg = Number(a.cantidad_actual || 0) < 0 ? 1 : 0
      const bNeg = Number(b.cantidad_actual || 0) < 0 ? 1 : 0
      return bNeg - aNeg
    })
  }, [filtroAlerta, stockNegativo, stockBajo, almacenSeleccionadoId])

  const resumenPorAlmacen = useMemo(() => {
    return almacenes.map((almacen) => {
      const items = stock.filter((s) => s.almacen_id === almacen.id)

      const negativos = items.filter((s) => Number(s.cantidad_actual || 0) < 0).length
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

  const detalleAlmacenSeleccionado = useMemo(() => {
    if (!almacenSeleccionadoId) return null
    return almacenes.find((a) => a.id === almacenSeleccionadoId) || null
  }, [almacenSeleccionadoId, almacenes])

  function badgeMovimiento(tipo: string) {
    if (tipo === "transferencia") return "bg-blue-100 text-blue-700"
    if (tipo === "consumo_cirugia") return "bg-green-100 text-green-700"
    if (tipo === "ajuste") return "bg-orange-100 text-orange-700"
    if (tipo === "entrada_manual") return "bg-emerald-100 text-emerald-700"
    if (tipo === "salida_manual") return "bg-red-100 text-red-700"
    if (tipo === "devolucion") return "bg-purple-100 text-purple-700"
    return "bg-gray-100 text-gray-700"
  }

  function abrirDetalle(item: StockRow) {
    setAlertaSeleccionada(item)
    setModalAbierto(true)
  }

  function limpiarFiltros() {
    setFiltroAlerta("todos")
    setAlmacenSeleccionadoId(null)
  }

  function colorCardActivo(activo: boolean, variante: "normal" | "orange" | "red" = "normal") {
    if (!activo) return "bg-white border-white/50 hover:border-white/80"

    if (variante === "orange") return "bg-orange-50 border-orange-300 shadow-lg"
    if (variante === "red") return "bg-red-50 border-red-300 shadow-lg"

    return "bg-teal-50 border-teal-300 shadow-lg"
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
        <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-6 md:px-8 md:py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Inventario
              </h1>
              <p className="text-white/80 mt-2 text-sm md:text-base">
                Control general de stock, movimientos y alertas
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/admin"
                className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
              >
                Volver al Admin
              </Link>

              <Link
                href="/admin/inventario/entrada"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Registrar entrada
              </Link>

              <Link
                href="/admin/proveedores"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Proveedores
              </Link>

              <Link
                href="/admin/inventario/stock"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Stock por almacén
              </Link>

              <Link
                href="/admin/inventario/transferencias-nuevo"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Transferencias
              </Link>

              <Link
                href="/admin/inventario/productos"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Productos
              </Link>

              <Link
                href="/admin/inventario/recetas"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Recetas
              </Link>

              <Link
                href="/admin/inventario/movimientos"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Movimientos
              </Link>

              <Link
                href="/admin/inventario/ajustes"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Ajustes
              </Link>

              <Link
                href="/admin/inventario/devoluciones-bajas"
                className="bg-[#F47C3C] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Devoluciones y bajas
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => {
              setFiltroAlerta("todos")
              setAlmacenSeleccionadoId(null)
            }}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroAlerta === "todos" && !almacenSeleccionadoId,
              "normal"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Productos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{productos.length}</p>
            <p className="text-xs text-gray-400 mt-2">Vista general</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroAlerta("todos")
            }}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroAlerta === "todos" && !almacenSeleccionadoId,
              "normal"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Almacenes</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{almacenes.length}</p>
            <p className="text-xs text-gray-400 mt-2">Clic para vista general</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("bajo")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroAlerta === "bajo",
              "orange"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">{stockBajo.length}</p>
            <p className="text-xs text-gray-400 mt-2">Clic para ver detalles</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("negativo")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${colorCardActivo(
              filtroAlerta === "negativo",
              "red"
            )}`}
          >
            <p className="text-sm text-gray-500 font-semibold">Stock negativo</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{stockNegativo.length}</p>
            <p className="text-xs text-gray-400 mt-2">Clic para ver detalles</p>
          </button>
        </div>

        <div className="rounded-[24px] bg-white shadow-xl p-4 md:p-5 border border-white/60">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0F6D6A]">Filtros rápidos</h2>
              <p className="text-sm text-gray-500">
                Puedes filtrar por tipo de alerta y por almacén
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroAlerta("todos")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  filtroAlerta === "todos"
                    ? "bg-[#0F6D6A] text-white"
                    : "bg-[#F3F4F6] text-gray-700 hover:bg-gray-200"
                }`}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() => setFiltroAlerta("negativo")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  filtroAlerta === "negativo"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                Negativos
              </button>

              <button
                type="button"
                onClick={() => setFiltroAlerta("bajo")}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  filtroAlerta === "bajo"
                    ? "bg-orange-500 text-white"
                    : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                }`}
              >
                Bajo
              </button>

              <button
                type="button"
                onClick={limpiarFiltros}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {detalleAlmacenSeleccionado && (
            <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm text-teal-700 font-semibold">
                Filtrando por almacén:{" "}
                <span className="font-bold">{detalleAlmacenSeleccionado.nombre}</span>
              </p>
            </div>
          )}
        </div>

        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0F6D6A]">Últimos movimientos</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Historial reciente del inventario
                </p>
              </div>

              <Link
                href="/admin/inventario/movimientos"
                className="text-sm font-bold text-[#0F6D6A] hover:underline"
              >
                Ver todos
              </Link>
            </div>

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
                    <tr key={mov.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                      <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {mov.productos?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeMovimiento(
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

          <div className="bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0F6D6A]">Alertas</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Haz clic en un producto para ver detalle
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">Visibles</p>
                <p className="text-lg font-bold text-[#0F6D6A]">{alertasVisibles.length}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
              {alertasVisibles.length > 0 ? (
                alertasVisibles.map((item) => {
                  const actual = Number(item.cantidad_actual || 0)
                  const minimo = Number(item.cantidad_minima || 0)
                  const esNegativo = actual < 0

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => abrirDetalle(item)}
                      className={`w-full text-left rounded-2xl p-4 border transition hover:shadow-md ${
                        esNegativo
                          ? "border-red-200 bg-red-50 hover:bg-red-100/70"
                          : "border-orange-200 bg-orange-50 hover:bg-orange-100/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 break-words">
                            {item.productos?.nombre || "-"}
                          </p>
                          <p className="text-sm text-gray-600 break-words">
                            {item.almacenes?.nombre || "-"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            esNegativo
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {esNegativo ? "Negativo" : "Bajo"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <p className="text-gray-700">
                          Actual:{" "}
                          <span
                            className={`font-bold ${
                              esNegativo ? "text-red-600" : "text-orange-600"
                            }`}
                          >
                            {actual.toFixed(3)} {item.productos?.unidad_base || ""}
                          </span>
                        </p>
                        <p className="text-gray-600">
                          Mínimo:{" "}
                          <span className="font-bold text-gray-700">
                            {minimo.toFixed(3)}
                          </span>
                        </p>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  No hay alertas para este filtro
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F6D6A]">Resumen por almacén</h2>
              <p className="text-sm text-gray-500 mt-1">
                Haz clic en una fila para filtrar las alertas de ese almacén
              </p>
            </div>

            {detalleAlmacenSeleccionado && (
              <button
                type="button"
                onClick={() => setAlmacenSeleccionadoId(null)}
                className="text-sm font-bold text-[#0F6D6A] hover:underline"
              >
                Quitar filtro
              </button>
            )}
          </div>

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
                {resumenPorAlmacen.map((almacen) => {
                  const activo = almacenSeleccionadoId === almacen.id

                  return (
                    <tr
                      key={almacen.id}
                      className={`border-b last:border-b-0 cursor-pointer transition ${
                        activo ? "bg-teal-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setAlmacenSeleccionadoId(almacen.id)}
                    >
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {almacen.nombre}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">{almacen.tipo}</td>
                      <td className="py-3 pr-3 text-gray-700">{almacen.totalItems}</td>
                      <td className="py-3 pr-3">
                        <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          {almacen.bajos}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          {almacen.negativos}
                        </span>
                      </td>
                    </tr>
                  )
                })}

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

        {modalAbierto && alertaSeleccionada && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl border border-white/70 overflow-hidden">
              <div className="px-6 py-5 border-b bg-gradient-to-r from-[#0F6D6A] to-[#147C78]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white/70 text-sm">Detalle de alerta</p>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {alertaSeleccionada.productos?.nombre || "-"}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">
                      {alertaSeleccionada.almacenes?.nombre || "-"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    className="bg-white/15 hover:bg-white/25 transition text-white px-4 py-2 rounded-xl font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-[#F7F8FA] p-4 border border-gray-100">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Stock actual
                    </p>
                    <p
                      className={`text-2xl font-bold mt-2 ${
                        Number(alertaSeleccionada.cantidad_actual || 0) < 0
                          ? "text-red-600"
                          : "text-orange-600"
                      }`}
                    >
                      {Number(alertaSeleccionada.cantidad_actual || 0).toFixed(3)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F7F8FA] p-4 border border-gray-100">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Stock mínimo
                    </p>
                    <p className="text-2xl font-bold text-gray-800 mt-2">
                      {Number(alertaSeleccionada.cantidad_minima || 0).toFixed(3)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F7F8FA] p-4 border border-gray-100">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Estado
                    </p>
                    <p
                      className={`text-2xl font-bold mt-2 ${
                        Number(alertaSeleccionada.cantidad_actual || 0) < 0
                          ? "text-red-600"
                          : "text-orange-600"
                      }`}
                    >
                      {Number(alertaSeleccionada.cantidad_actual || 0) < 0
                        ? "Negativo"
                        : "Bajo"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Producto</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {alertaSeleccionada.productos?.nombre || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Unidad</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {alertaSeleccionada.productos?.unidad_base || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Almacén</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {alertaSeleccionada.almacenes?.nombre || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Tipo de almacén</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {alertaSeleccionada.almacenes?.tipo || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroAlerta(
                        Number(alertaSeleccionada.cantidad_actual || 0) < 0
                          ? "negativo"
                          : "bajo"
                      )
                      setAlmacenSeleccionadoId(alertaSeleccionada.almacen_id)
                      setModalAbierto(false)
                    }}
                    className="bg-[#0F6D6A] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#0c5d5a] transition"
                  >
                    Filtrar similares
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      router.push(
                        `/admin/inventario/stock?almacen_id=${alertaSeleccionada.almacen_id}&producto_id=${alertaSeleccionada.producto_id}`
                      )
                    }}
                    className="bg-[#F3F4F6] text-gray-800 px-5 py-3 rounded-2xl font-bold hover:bg-gray-200 transition"
                  >
                    Ver stock
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      router.push(
                        `/admin/inventario/ajustes?producto_id=${alertaSeleccionada.producto_id}&almacen_id=${alertaSeleccionada.almacen_id}`
                      )
                    }}
                    className="border border-gray-200 bg-white text-gray-700 px-5 py-3 rounded-2xl font-bold hover:bg-gray-50 transition"
                  >
                    Ajustar stock
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      router.push(
                        `/admin/inventario/transferencias-nuevo?producto_id=${alertaSeleccionada.producto_id}&almacen_destino_id=${alertaSeleccionada.almacen_id}`
                      )
                    }}
                    className="bg-[#F47C3C] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#db6d31] transition"
                  >
                    Reponer (Transferencia)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}