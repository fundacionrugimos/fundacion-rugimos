"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Entrada = {
  id: string
  created_at: string
  motivo: string
  observacion: string | null
  almacenes: {
    nombre: string
  } | null
  items_count?: number
}

function normalizarRelacion(rel: any) {
  if (Array.isArray(rel)) return rel[0] || null
  return rel || null
}

export default function HistorialEntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarEntradas()
  }, [])

  async function cargarEntradas() {
    setCargando(true)

    const { data, error } = await supabase
      .from("entradas_inventario")
      .select(`
        id,
        created_at,
        motivo,
        observacion,
        almacenes:almacen_id (
          nombre
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      alert("No se pudo cargar el historial de entradas.")
      setCargando(false)
      return
    }

    const entradasBase = ((data || []) as any[]).map((item) => ({
      ...item,
      almacenes: normalizarRelacion(item.almacenes),
    })) as Entrada[]

    const entradasConConteo: Entrada[] = []

    for (const entrada of entradasBase) {
      const { count } = await supabase
        .from("entradas_inventario_items")
        .select("*", { count: "exact", head: true })
        .eq("entrada_id", entrada.id)

      entradasConConteo.push({
        ...entrada,
        items_count: count || 0,
      })
    }

    setEntradas(entradasConConteo)
    setCargando(false)
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/inventario"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a Inventario
          </Link>

          <Link
            href="/admin/inventario/entrada"
            className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
          >
            Nueva entrada
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0F6D6A]">
              Historial de entradas
            </h1>
            <p className="text-gray-500 mt-2">
              Revise todas las entradas registradas en inventario.
            </p>
          </div>

          {cargando ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              Cargando historial...
            </div>
          ) : entradas.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              No hay entradas registradas todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-3">Fecha</th>
                    <th className="py-3 pr-3">Almacén</th>
                    <th className="py-3 pr-3">Motivo</th>
                    <th className="py-3 pr-3">Items</th>
                    <th className="py-3 pr-3">Observación</th>
                    <th className="py-3 pr-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((entrada) => (
                    <tr key={entrada.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 text-gray-700">
                        {new Date(entrada.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {entrada.almacenes?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {entrada.motivo}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">
                          {entrada.items_count || 0}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {entrada.observacion || "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/inventario/entradas/${entrada.id}`}
                          className="px-3 py-2 rounded-xl bg-[#0F6D6A] text-white font-semibold text-xs"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}