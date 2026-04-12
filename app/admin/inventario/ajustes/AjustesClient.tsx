"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Almacen = {
  id: string
  nombre: string
  tipo: string
}

type Producto = {
  id: string
  nombre: string
  unidad_base: string
}

type Movimiento = {
  id: string
  created_at: string
  tipo_movimiento: string
  cantidad: number
  motivo: string | null
  unidad_movimiento: string | null
  usuario: string | null
  productos: any
  almacen_origen: any
  almacen_destino: any
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

type FiltroAlerta = "todos" | "negativo" | "bajo"

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export default function AdminInventarioAjustesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [stock, setStock] = useState<StockRow[]>([])

  const [tipoMovimiento, setTipoMovimiento] = useState("ajuste")
  const [almacenId, setAlmacenId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("Ajuste manual de stock")

  const [filtroAlerta, setFiltroAlerta] = useState<FiltroAlerta>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [alertaSeleccionadaId, setAlertaSeleccionadaId] = useState<string | null>(null)

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [almacenesRes, productosRes, movimientosRes, stockRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("productos")
        .select("id,nombre,unidad_base")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("movimientos_stock")
        .select(`
          id,
          created_at,
          tipo_movimiento,
          cantidad,
          motivo,
          unidad_movimiento,
          usuario,
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
        .in("tipo_movimiento", ["ajuste", "entrada_manual", "salida_manual"])
        .order("created_at", { ascending: false })
        .limit(20),

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
            unidad_base
          ),
          almacenes:almacen_id (
            id,
            nombre,
            tipo
          )
        `),
    ])

    if (almacenesRes.error) console.log(almacenesRes.error)
    if (productosRes.error) console.log(productosRes.error)
    if (movimientosRes.error) console.log(movimientosRes.error)
    if (stockRes.error) console.log(stockRes.error)

    const movimientosNormalizados: Movimiento[] = ((movimientosRes.data as any[]) || []).map(
      (item) => ({
        ...item,
        productos: normalizarRelacion(item.productos),
        almacen_origen: normalizarRelacion(item.almacen_origen),
        almacen_destino: normalizarRelacion(item.almacen_destino),
      })
    )

    const stockNormalizado: StockRow[] = ((stockRes.data as any[]) || []).map((item) => ({
      ...item,
      productos: normalizarRelacion(item.productos),
      almacenes: normalizarRelacion(item.almacenes),
    }))

    const almacenesData = (almacenesRes.data as Almacen[]) || []
    const productosData = (productosRes.data as Producto[]) || []

    setAlmacenes(almacenesData)
    setProductos(productosData)
    setMovimientos(movimientosNormalizados)
    setStock(stockNormalizado)

    const almacenIdUrl = searchParams.get("almacen_id")
    const productoIdUrl = searchParams.get("producto_id")

    if (almacenIdUrl && almacenesData.some((a) => a.id === almacenIdUrl)) {
      setAlmacenId(almacenIdUrl)
    } else if (almacenesData.length > 0 && !almacenId) {
      setAlmacenId(almacenesData[0].id)
    }

    if (productoIdUrl && productosData.some((p) => p.id === productoIdUrl)) {
      setProductoId(productoIdUrl)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const texto = busqueda.trim().toLowerCase()

    if (texto) {
      base = base.filter((item) => {
        const nombreProducto = (item.productos?.nombre || "").toLowerCase()
        const nombreAlmacen = (item.almacenes?.nombre || "").toLowerCase()
        return nombreProducto.includes(texto) || nombreAlmacen.includes(texto)
      })
    }

    return base.sort((a, b) => {
      const aNeg = Number(a.cantidad_actual || 0) < 0 ? 1 : 0
      const bNeg = Number(b.cantidad_actual || 0) < 0 ? 1 : 0
      if (bNeg !== aNeg) return bNeg - aNeg
      return (a.productos?.nombre || "").localeCompare(b.productos?.nombre || "")
    })
  }, [filtroAlerta, stockNegativo, stockBajo, busqueda])

  function usarEnAjuste(item: StockRow) {
    setAlmacenId(item.almacen_id)
    setProductoId(item.producto_id)
    setTipoMovimiento("ajuste")
    setMotivo("Ajuste manual de stock")
    setAlertaSeleccionadaId(item.id)

    const inputCantidad = document.getElementById("cantidad-ajuste")
    if (inputCantidad) {
      setTimeout(() => {
        inputCantidad.scrollIntoView({ behavior: "smooth", block: "center" })
        ;(inputCantidad as HTMLInputElement).focus()
      }, 120)
    }
  }

  async function aplicarMovimiento() {
    if (!almacenId || !productoId || !cantidad) {
      alert("Complete todos los campos")
      return
    }

    const cantidadNumero = Number(cantidad)

    if (!cantidadNumero || cantidadNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    setGuardando(true)

    const producto = productos.find((p) => p.id === productoId)

    const { error: stockError } = await supabase
      .from("stock_almacen")
      .upsert(
        {
          almacen_id: almacenId,
          producto_id: productoId,
          cantidad_actual: 0,
        },
        {
          onConflict: "almacen_id,producto_id",
        }
      )

    if (stockError) {
      console.log(stockError)
      alert("No se pudo preparar la línea de stock")
      setGuardando(false)
      return
    }

    let updateError: any = null

    if (tipoMovimiento === "entrada_manual" || tipoMovimiento === "ajuste") {
      const { error } = await supabase.rpc("incrementar_stock_manual", {
        p_almacen_id: almacenId,
        p_producto_id: productoId,
        p_cantidad: cantidadNumero,
      })
      updateError = error
    }

    if (tipoMovimiento === "salida_manual") {
      const { error } = await supabase.rpc("decrementar_stock_manual", {
        p_almacen_id: almacenId,
        p_producto_id: productoId,
        p_cantidad: cantidadNumero,
      })
      updateError = error
    }

    if (updateError) {
      console.log(updateError)
      alert(updateError.message || "No se pudo actualizar el stock")
      setGuardando(false)
      return
    }

    const movimientoPayload = {
      producto_id: productoId,
      almacen_origen_id:
        tipoMovimiento === "salida_manual" || tipoMovimiento === "ajuste"
          ? almacenId
          : null,
      almacen_destino_id:
        tipoMovimiento === "entrada_manual"
          ? almacenId
          : null,
      tipo_movimiento: tipoMovimiento,
      cantidad: cantidadNumero,
      unidad_movimiento: producto?.unidad_base || null,
      motivo: motivo || "Movimiento manual",
      usuario: "admin",
    }

    const { error: movError } = await supabase
      .from("movimientos_stock")
      .insert(movimientoPayload)

    if (movError) {
      console.log(movError)
      alert("El stock cambió, pero no se pudo registrar el movimiento")
      setGuardando(false)
      return
    }

    alert("Movimiento aplicado correctamente")
    setCantidad("")
    setMotivo(
      tipoMovimiento === "entrada_manual"
        ? "Entrada manual"
        : tipoMovimiento === "salida_manual"
        ? "Salida manual"
        : "Ajuste manual de stock"
    )

    await cargarTodo()
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando ajustes...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-6 md:px-8 md:py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <p className="text-white/75 text-xs md:text-sm font-semibold uppercase tracking-[0.18em]">
                Fundación Rugimos
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mt-1">
                Centro de ajustes de inventario
              </h1>
              <p className="text-white/80 mt-3 text-sm md:text-base">
                Correcciones rápidas, alertas de stock y movimientos manuales del sistema.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/admin/inventario"
                className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
              >
                Volver a Inventario
              </Link>

              <button
                type="button"
                onClick={cargarTodo}
                className="bg-[#F47C3C] text-white px-4 py-2.5 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setFiltroAlerta("todos")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${
              filtroAlerta === "todos"
                ? "bg-teal-50 border-teal-300"
                : "bg-white border-white/60"
            }`}
          >
            <p className="text-sm text-gray-500 font-semibold">Alertas totales</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {stockNegativo.length + stockBajo.length}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("negativo")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${
              filtroAlerta === "negativo"
                ? "bg-red-50 border-red-300"
                : "bg-white border-white/60"
            }`}
          >
            <p className="text-sm text-gray-500 font-semibold">Stock negativo</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{stockNegativo.length}</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("bajo")}
            className={`rounded-[24px] border p-5 text-left transition-all shadow-xl ${
              filtroAlerta === "bajo"
                ? "bg-orange-50 border-orange-300"
                : "bg-white border-white/60"
            }`}
          >
            <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">{stockBajo.length}</p>
          </button>

          <div className="rounded-[24px] border p-5 text-left transition-all shadow-xl bg-white border-white/60">
            <p className="text-sm text-gray-500 font-semibold">Movimientos recientes</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{movimientos.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setFiltroAlerta("todos")}
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition ${
              filtroAlerta === "todos"
                ? "bg-[#F47C3C] text-white"
                : "bg-white text-[#0F6D6A] hover:bg-gray-100"
            }`}
          >
            Todos
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("negativo")}
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition ${
              filtroAlerta === "negativo"
                ? "bg-[#F47C3C] text-white"
                : "bg-white text-[#0F6D6A] hover:bg-gray-100"
            }`}
          >
            Negativos
          </button>

          <button
            type="button"
            onClick={() => setFiltroAlerta("bajo")}
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition ${
              filtroAlerta === "bajo"
                ? "bg-[#F47C3C] text-white"
                : "bg-white text-[#0F6D6A] hover:bg-gray-100"
            }`}
          >
            Bajos
          </button>
        </div>

        <div className="rounded-[24px] bg-white shadow-xl p-4 md:p-5 border border-white/60">
          <div className="grid lg:grid-cols-[1.2fr_220px] gap-3">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto o almacén..."
              className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
            />

            <button
              type="button"
              onClick={() => {
                setBusqueda("")
                setFiltroAlerta("todos")
              }}
              className="bg-[#F3F4F6] text-gray-700 px-4 py-3 rounded-2xl font-bold hover:bg-gray-200 transition"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {(almacenId || productoId) && (
          <div className="bg-teal-50 border border-teal-200 rounded-[24px] p-4">
            <p className="text-sm text-teal-700 font-semibold">
              Movimiento iniciado desde alerta de inventario
            </p>
            <p className="text-sm text-teal-800 mt-1">
              {productoId ? "Producto preseleccionado. " : ""}
              {almacenId ? "Almacén preseleccionado." : ""}
            </p>
          </div>
        )}

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0F6D6A]">
                  Alertas que requieren atención
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Haz clic en un producto para usarlo directamente en el ajuste.
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">Visibles</p>
                <p className="text-lg font-bold text-[#0F6D6A]">{alertasVisibles.length}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[680px] overflow-auto pr-1">
              {alertasVisibles.length > 0 ? (
                alertasVisibles.map((item) => {
                  const actual = Number(item.cantidad_actual || 0)
                  const minimo = Number(item.cantidad_minima || 0)
                  const esNegativo = actual < 0
                  const activo = alertaSeleccionadaId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-4 border transition ${
                        activo
                          ? "ring-2 ring-[#0F6D6A] border-teal-300 bg-teal-50"
                          : esNegativo
                          ? "border-red-200 bg-red-50"
                          : "border-orange-200 bg-orange-50"
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

                      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-white/70 px-3 py-2">
                          <p className="text-gray-500">Stock actual</p>
                          <p
                            className={`font-bold ${
                              esNegativo ? "text-red-600" : "text-orange-600"
                            }`}
                          >
                            {formatearNumero(actual)} {item.productos?.unidad_base || ""}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white/70 px-3 py-2">
                          <p className="text-gray-500">Stock mínimo</p>
                          <p className="font-bold text-gray-700">
                            {formatearNumero(minimo)} {item.productos?.unidad_base || ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => usarEnAjuste(item)}
                          className="bg-[#0F6D6A] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#0c5d5a] transition"
                        >
                          Usar en ajuste
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/admin/inventario/transferencias-nuevo?producto_id=${item.producto_id}&almacen_destino_id=${item.almacen_id}`
                            )
                          }
                          className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#db6d31] transition"
                        >
                          Ir a transferencia
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  No hay alertas para este filtro
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
              <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">
                Nuevo movimiento manual
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de movimiento
                  </label>
                  <select
                    value={tipoMovimiento}
                    onChange={(e) => {
                      const val = e.target.value
                      setTipoMovimiento(val)
                      setMotivo(
                        val === "entrada_manual"
                          ? "Entrada manual"
                          : val === "salida_manual"
                          ? "Salida manual"
                          : "Ajuste manual de stock"
                      )
                    }}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="ajuste">ajuste</option>
                    <option value="entrada_manual">entrada_manual</option>
                    <option value="salida_manual">salida_manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Almacén
                  </label>
                  <select
                    value={almacenId}
                    onChange={(e) => setAlmacenId(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  >
                    <option value="">Seleccionar almacén</option>
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
                    id="cantidad-ajuste"
                    type="number"
                    step="0.001"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="Ej: 10"
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Motivo
                  </label>
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                  />
                </div>

                <button
                  onClick={aplicarMovimiento}
                  disabled={guardando}
                  className={`w-full py-3 rounded-2xl font-bold text-white transition ${
                    guardando
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#F47C3C] hover:bg-[#db6d31]"
                  }`}
                >
                  {guardando ? "Procesando..." : "Aplicar movimiento"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[28px] shadow-xl p-6 border border-white/60">
              <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
                Últimos ajustes y movimientos manuales
              </h2>

              <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-3 pr-3">Fecha</th>
                      <th className="py-3 pr-3">Producto</th>
                      <th className="py-3 pr-3">Tipo</th>
                      <th className="py-3 pr-3">Almacén</th>
                      <th className="py-3 pr-3">Cantidad</th>
                      <th className="py-3 pr-3">Motivo</th>
                      <th className="py-3 pr-3">Usuario</th>
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
                        <td className="py-3 pr-3 text-gray-700">
                          {mov.tipo_movimiento}
                        </td>
                        <td className="py-3 pr-3 text-gray-700">
                          {mov.almacen_origen?.nombre || mov.almacen_destino?.nombre || "-"}
                        </td>
                        <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">
                          {Number(mov.cantidad).toFixed(3)}{" "}
                          {mov.unidad_movimiento || mov.productos?.unidad_base || ""}
                        </td>
                        <td className="py-3 pr-3 text-gray-600">
                          {mov.motivo || "-"}
                        </td>
                        <td className="py-3 pr-3 text-gray-600">
                          {mov.usuario || "-"}
                        </td>
                      </tr>
                    ))}

                    {movimientos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-500">
                          No hay movimientos manuales todavía
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
    </div>
  )
}