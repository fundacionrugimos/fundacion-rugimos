"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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

export default function AdminInventarioTransferenciasPage() {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [almacenOrigen, setAlmacenOrigen] = useState("")
  const [almacenDestino, setAlmacenDestino] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("Transferencia de stock")

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarTodo() {
    setCargando(true)

    const [almacenesRes, productosRes, movimientosRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("tipo", { ascending: true })
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
        .eq("tipo_movimiento", "transferencia")
        .order("created_at", { ascending: false })
        .limit(12),
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

    const central = almacenesData.find((a) => a.tipo === "central")
    if (central) setAlmacenOrigen(central.id)

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  async function transferir() {
    if (!almacenOrigen || !almacenDestino || !productoId || !cantidad) {
      alert("Complete todos los campos")
      return
    }

    if (almacenOrigen === almacenDestino) {
      alert("El almacén de origen y destino no pueden ser el mismo")
      return
    }

    const cantidadNumero = Number(cantidad)

    if (!cantidadNumero || cantidadNumero <= 0) {
      alert("La cantidad debe ser mayor que cero")
      return
    }

    setGuardando(true)

    const { error } = await supabase.rpc("transferir_stock", {
      p_almacen_origen_id: almacenOrigen,
      p_almacen_destino_id: almacenDestino,
      p_producto_id: productoId,
      p_cantidad: cantidadNumero,
      p_motivo: motivo || "Transferencia de stock",
      p_usuario: "admin",
    })

    if (error) {
      console.log("Error transferencia:", error)
      alert(error.message || "No se pudo realizar la transferencia")
      setGuardando(false)
      return
    }

    alert("Transferencia realizada correctamente")

    setProductoId("")
    setCantidad("")
    setMotivo("Transferencia de stock")

    await cargarTodo()
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando transferencias...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Transferencias de Inventario
            </h1>
            <p className="text-white/80 mt-1">
              Mueva productos entre almacenes
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
              Nueva transferencia
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Almacén origen
                </label>
                <select
                  value={almacenOrigen}
                  onChange={(e) => setAlmacenOrigen(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="">Seleccionar origen</option>
                  {almacenes.map((almacen) => (
                    <option key={almacen.id} value={almacen.id}>
                      {almacen.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Almacén destino
                </label>
                <select
                  value={almacenDestino}
                  onChange={(e) => setAlmacenDestino(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="">Seleccionar destino</option>
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
                onClick={transferir}
                disabled={guardando}
                className={`w-full py-3 rounded-xl font-bold text-white transition ${
                  guardando
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#F47C3C] hover:bg-[#db6d31]"
                }`}
              >
                {guardando ? "Procesando..." : "Realizar transferencia"}
              </button>
            </div>
          </div>

          <div className="xl:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Últimas transferencias
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-3">Fecha</th>
                    <th className="py-3 pr-3">Producto</th>
                    <th className="py-3 pr-3">Origen</th>
                    <th className="py-3 pr-3">Destino</th>
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
                      <td className="py-3 pr-3 text-gray-700">
                        {mov.almacen_origen?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {mov.almacen_destino?.nombre || "-"}
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
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No hay transferencias todavía
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