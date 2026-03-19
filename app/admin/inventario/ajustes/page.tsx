"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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

export default function AdminInventarioAjustesPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [tipoMovimiento, setTipoMovimiento] = useState("ajuste")
  const [almacenId, setAlmacenId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("Ajuste manual de stock")

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [almacenesRes, productosRes, movimientosRes] = await Promise.all([
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
    ])

    if (almacenesRes.error) console.log(almacenesRes.error)
    if (productosRes.error) console.log(productosRes.error)
    if (movimientosRes.error) console.log(movimientosRes.error)

    const movimientosNormalizados: Movimiento[] = ((movimientosRes.data as any[]) || []).map(
      (item) => ({
        ...item,
        productos: normalizarRelacion(item.productos),
        almacen_origen: normalizarRelacion(item.almacen_origen),
        almacen_destino: normalizarRelacion(item.almacen_destino),
      })
    )

    const almacenesData = (almacenesRes.data as Almacen[]) || []

    setAlmacenes(almacenesData)
    setProductos((productosRes.data as Producto[]) || [])
    setMovimientos(movimientosNormalizados)

    if (almacenesData.length > 0 && !almacenId) {
      setAlmacenId(almacenesData[0].id)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Ajustes de Stock
            </h1>
            <p className="text-white/80 mt-1">
              Registre entradas, salidas y correcciones manuales
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
                  className="w-full border rounded-xl px-4 py-3"
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
                  className="w-full border rounded-xl px-4 py-3"
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
                  step="0.001"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Ej: 10"
                  className="w-full border rounded-xl px-4 py-3"
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
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <button
                onClick={aplicarMovimiento}
                disabled={guardando}
                className={`w-full py-3 rounded-xl font-bold text-white transition ${
                  guardando
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#F47C3C] hover:bg-[#db6d31]"
                }`}
              >
                {guardando ? "Procesando..." : "Aplicar movimiento"}
              </button>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Últimos ajustes y movimientos manuales
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
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
                    <tr key={mov.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 text-gray-700">
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
                      <td className="py-3 pr-3 text-gray-700">
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
  )
}