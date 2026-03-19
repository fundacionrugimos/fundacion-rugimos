"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

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
  clinicas: any
}

function formatearNumero(valor: number | null | undefined) {
  const numero = Number(valor || 0)

  return numero.toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export default function AdminInventarioMovimientosPage() {
  const [cargando, setCargando] = useState(true)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  const [filtroTipo, setFiltroTipo] = useState("")
  const [busqueda, setBusqueda] = useState("")

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarMovimientos() {
    setCargando(true)

    const { data, error } = await supabase
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
        ),
        clinicas:clinica_id (
          nome
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) {
      console.log(error)
      setCargando(false)
      return
    }

    const normalizados: Movimiento[] = ((data as any[]) || []).map((item) => ({
      ...item,
      productos: normalizarRelacion(item.productos),
      almacen_origen: normalizarRelacion(item.almacen_origen),
      almacen_destino: normalizarRelacion(item.almacen_destino),
      clinicas: normalizarRelacion(item.clinicas),
    }))

    setMovimientos(normalizados)
    setCargando(false)
  }

  useEffect(() => {
    cargarMovimientos()
  }, [])

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      const coincideTipo = filtroTipo ? mov.tipo_movimiento === filtroTipo : true

      const texto = busqueda.trim().toLowerCase()
      const coincideBusqueda = texto
        ? [
            mov.productos?.nombre || "",
            mov.motivo || "",
            mov.almacen_origen?.nombre || "",
            mov.almacen_destino?.nombre || "",
            mov.clinicas?.nome || "",
            mov.usuario || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(texto)
        : true

      return coincideTipo && coincideBusqueda
    })
  }, [movimientos, filtroTipo, busqueda])

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
        Cargando movimientos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Movimientos de Inventario
            </h1>
            <p className="text-white/80 mt-1">
              Historial completo de entradas, salidas, transferencias y consumos
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

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrar por tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="transferencia">transferencia</option>
                <option value="consumo_cirugia">consumo_cirugia</option>
                <option value="ajuste">ajuste</option>
                <option value="entrada_manual">entrada_manual</option>
                <option value="salida_manual">salida_manual</option>
                <option value="devolucion">devolucion</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Producto, motivo, almacén, clínica..."
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#0F6D6A]">
              Historial
            </h2>

            <span className="bg-[#F47C3C] text-white px-3 py-1 rounded-full text-sm font-bold">
              {movimientosFiltrados.length} movimientos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-3">Fecha</th>
                  <th className="py-3 pr-3">Producto</th>
                  <th className="py-3 pr-3">Tipo</th>
                  <th className="py-3 pr-3">Origen</th>
                  <th className="py-3 pr-3">Destino</th>
                  <th className="py-3 pr-3">Cantidad</th>
                  <th className="py-3 pr-3">Clínica</th>
                  <th className="py-3 pr-3">Motivo</th>
                  <th className="py-3 pr-3">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((mov) => (
                  <tr key={mov.id} className="border-b last:border-b-0 align-top">
                    <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">
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
                      {mov.almacen_origen?.nombre || "-"}
                    </td>

                    <td className="py-3 pr-3 text-gray-700">
                      {mov.almacen_destino?.nombre || "-"}
                    </td>

                    <td className="py-3 pr-3 text-gray-700">
                      {formatearNumero(mov.cantidad)}{" "}
                      {mov.unidad_movimiento || mov.productos?.unidad_base || ""}
                    </td>

                    <td className="py-3 pr-3 text-gray-700">
                      {mov.clinicas?.nome || "-"}
                    </td>

                    <td className="py-3 pr-3 text-gray-600 max-w-[280px]">
                      {mov.motivo || "-"}
                    </td>

                    <td className="py-3 pr-3 text-gray-600">
                      {mov.usuario || "-"}
                    </td>
                  </tr>
                ))}

                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No hay movimientos para mostrar
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