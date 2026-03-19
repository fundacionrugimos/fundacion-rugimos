"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Entrada = {
  id: string
  created_at: string
  motivo: string
  observacion: string | null
  almacenes: {
    nombre: string
    tipo: string | null
  } | null
}

type EntradaItem = {
  id: string
  cantidad: number
  unidad: string | null
  productos: {
    nombre: string
    unidad_base: string | null
  } | null
}

function normalizarRelacion(rel: any) {
  if (Array.isArray(rel)) return rel[0] || null
  return rel || null
}

export default function DetalleEntradaPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? ""

  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [items, setItems] = useState<EntradaItem[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (id) cargarDetalle()
  }, [id])

  async function cargarDetalle() {
    setCargando(true)

    const { data: entradaData, error: entradaError } = await supabase
      .from("entradas_inventario")
      .select(`
        id,
        created_at,
        motivo,
        observacion,
        almacenes:almacen_id (
          nombre,
          tipo
        )
      `)
      .eq("id", id)
      .single()

    if (entradaError) {
      console.error(entradaError)
      alert("No se pudo cargar la entrada.")
      setCargando(false)
      return
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("entradas_inventario_items")
      .select(`
        id,
        cantidad,
        unidad,
        productos:producto_id (
          nombre,
          unidad_base
        )
      `)
      .eq("entrada_id", id)
      .order("created_at", { ascending: true })

    if (itemsError) {
      console.error(itemsError)
      alert("No se pudieron cargar los items.")
      setCargando(false)
      return
    }

    setEntrada({
      ...(entradaData as any),
      almacenes: normalizarRelacion((entradaData as any).almacenes),
    })

    setItems(
      ((itemsData || []) as any[]).map((item) => ({
        ...item,
        productos: normalizarRelacion(item.productos),
      }))
    )

    setCargando(false)
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/inventario/entradas"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver al historial
          </Link>

          <Link
            href="/admin/inventario/entrada"
            className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
          >
            Nueva entrada
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {cargando ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              Cargando detalle...
            </div>
          ) : !entrada ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              No se encontró la entrada.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b pb-5">
                <h1 className="text-3xl font-bold text-[#0F6D6A]">
                  Detalle de entrada
                </h1>
                <p className="text-gray-500 mt-2">
                  Documento de ingreso de inventario
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Fecha</p>
                  <p className="font-bold text-gray-800">
                    {new Date(entrada.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Almacén</p>
                  <p className="font-bold text-gray-800">
                    {entrada.almacenes?.nombre || "-"}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Motivo</p>
                  <p className="font-bold text-gray-800">
                    {entrada.motivo}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Observación</p>
                  <p className="font-bold text-gray-800">
                    {entrada.observacion || "-"}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b bg-gray-50">
                  <h2 className="text-lg font-bold text-[#0F6D6A]">
                    Items de la entrada
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-3 px-5">Producto</th>
                        <th className="py-3 px-5">Cantidad</th>
                        <th className="py-3 px-5">Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="py-3 px-5 font-semibold text-gray-800">
                            {item.productos?.nombre || "-"}
                          </td>
                          <td className="py-3 px-5 text-gray-700">
                            {Number(item.cantidad).toFixed(3)}
                          </td>
                          <td className="py-3 px-5 text-gray-700">
                            {item.unidad || item.productos?.unidad_base || "-"}
                          </td>
                        </tr>
                      ))}

                      {items.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-gray-500">
                            No hay items registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}