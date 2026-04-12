"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [cargando, setCargando] = useState(true)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  

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

  async function eliminarEntrada(entradaId: string) {
  const confirmar = window.confirm(
    "¿Seguro que desea eliminar esta entrada?\n\nEsta acción revertirá stock, movimientos y pagos vinculados."
  )

  if (!confirmar) return

  setEliminandoId(entradaId)

  try {
    const { data: entrada, error: entradaError } = await supabase
      .from("entradas_inventario")
      .select("id, almacen_id, motivo")
      .eq("id", entradaId)
      .single()

    if (entradaError || !entrada) {
      throw new Error("No se pudo cargar la entrada.")
    }

    const { data: items, error: itemsError } = await supabase
      .from("entradas_inventario_items")
      .select("id, producto_id, cantidad")
      .eq("entrada_id", entradaId)

    if (itemsError) {
      throw new Error("No se pudieron cargar los items de la entrada.")
    }

    for (const item of items || []) {
      const { data: stockExistente, error: stockError } = await supabase
        .from("stock_almacen")
        .select("id, cantidad_actual")
        .eq("almacen_id", entrada.almacen_id)
        .eq("producto_id", item.producto_id)
        .maybeSingle()

      if (stockError) {
        throw new Error(stockError.message)
      }

      if (stockExistente) {
        const nuevaCantidad =
          Number(stockExistente.cantidad_actual || 0) - Number(item.cantidad || 0)

        const { error: updateStockError } = await supabase
          .from("stock_almacen")
          .update({
            cantidad_actual: nuevaCantidad,
          })
          .eq("id", stockExistente.id)

        if (updateStockError) {
          throw new Error(updateStockError.message)
        }
      }

      const { error: movimientoError } = await supabase
        .from("movimientos_stock")
        .insert([
          {
            producto_id: item.producto_id,
            almacen_destino_id: entrada.almacen_id,
            tipo_movimiento: "ajuste",
            cantidad: Number(item.cantidad || 0),
            motivo: `Reversión por eliminación de entrada ${entradaId}`,
          },
        ])

      if (movimientoError) {
        throw new Error(movimientoError.message)
      }
    }

    const { error: deletePagosError } = await supabase
      .from("pagos_entrada_inventario")
      .delete()
      .eq("entrada_id", entradaId)

    if (deletePagosError) {
      throw new Error(deletePagosError.message)
    }

    const { error: deleteItemsError } = await supabase
      .from("entradas_inventario_items")
      .delete()
      .eq("entrada_id", entradaId)

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message)
    }

    const { error: deleteEntradaError } = await supabase
      .from("entradas_inventario")
      .delete()
      .eq("id", entradaId)

    if (deleteEntradaError) {
      throw new Error(deleteEntradaError.message)
    }

    alert("Entrada eliminada correctamente.")
    await cargarEntradas()
    router.refresh()
  } catch (error: any) {
    console.error(error)
    alert(`No se pudo eliminar la entrada: ${error.message || "error interno"}`)
  } finally {
    setEliminandoId(null)
  }
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
                    <th className="py-3 pr-3">Acciones</th>
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
                      <td className="py-3 pr-3 flex gap-2 flex-wrap">
  <Link
    href={`/admin/inventario/entradas/${entrada.id}`}
    className="px-3 py-2 rounded-xl bg-[#0F6D6A] text-white font-semibold text-xs"
  >
    Ver
  </Link>

  <Link
    href={`/admin/inventario/entradas/${entrada.id}/comprobante`}
    target="_blank"
    className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-200 transition"
  >
    Ver comprobante
  </Link>

  <Link
  href={`/admin/inventario/entradas/${entrada.id}/comprobante?print=1`}
  target="_blank"
  className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700 font-semibold text-xs hover:bg-amber-200 transition"
>
  Reimpresión
</Link>

  <Link
    href={`/admin/inventario/entrada?edit=${entrada.id}`}
    className="px-3 py-2 rounded-xl bg-blue-100 text-blue-700 font-semibold text-xs hover:bg-blue-200 transition"
  >
    Editar
  </Link>

  <button
  type="button"
  onClick={() => eliminarEntrada(entrada.id)}
  disabled={eliminandoId === entrada.id}
  className="px-3 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-xs hover:bg-red-200 transition disabled:opacity-50"
>
  {eliminandoId === entrada.id ? "Eliminando..." : "Excluir"}
</button>
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