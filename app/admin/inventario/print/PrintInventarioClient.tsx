"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Props = {
  almacenId: string
}

export default function PrintInventarioClient({ almacenId }: Props) {
  const [productos, setProductos] = useState<any[]>([])
  const [almacen, setAlmacen] = useState("")

  useEffect(() => {
    async function cargar() {
      if (!almacenId) return

      const { data: almacenData } = await supabase
        .from("almacenes")
        .select("nombre")
        .eq("id", almacenId)
        .single()

      if (almacenData) {
        setAlmacen(almacenData.nombre)
      }

      const { data, error } = await supabase
        .from("stock_almacen")
        .select(`
          id,
          cantidad_actual,
          cantidad_minima,
          productos:producto_id (
            nombre,
            unidad_base,
            unidad_fraccionada
          )
        `)
        .eq("almacen_id", almacenId)

      if (error) {
        console.log(error)
        return
      }

      const normalizados = (data || []).map((item: any) => ({
        ...item,
        productos: Array.isArray(item.productos) ? item.productos[0] : item.productos,
      }))

      normalizados.sort((a: any, b: any) =>
        (a.productos?.nombre || "").localeCompare(b.productos?.nombre || "")
      )

      setProductos(normalizados)

      setTimeout(() => {
        window.print()
      }, 500)
    }

    cargar()
  }, [almacenId])

  function obtenerUnidadClinica(item: any) {
    return item.productos?.unidad_fraccionada || item.productos?.unidad_base || "-"
  }

  function obtenerUnidadCentral(item: any) {
    return item.productos?.unidad_base || "-"
  }

  function formatearNumero(valor: number | null | undefined) {
    const numero = Number(valor || 0)

    return numero.toLocaleString("es-BO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="border-b border-gray-300 pb-5 mb-6">
          <h1 className="text-2xl font-bold tracking-wide">FUNDACIÓN RUGIMOS</h1>
          <p className="text-base mt-1 font-semibold">Checklist de inventario por almacén</p>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p>
                <span className="font-semibold">Almacén:</span> {almacen || "-"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Fecha:</span> ____ / ____ / ______
              </p>
            </div>

            <div className="text-right">
              <p>
                <span className="font-semibold">Responsable:</span> ______________________
              </p>
              <p className="mt-1">
                <span className="font-semibold">Firma:</span> _____________________________
              </p>
            </div>
          </div>
        </div>

        <table className="w-full border border-gray-300 border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="p-2 text-left w-14">OK</th>
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-left w-28">Unidad clínica</th>
              <th className="p-2 text-left w-28">Unidad central</th>
              <th className="p-2 text-left w-24">Sistema</th>
              <th className="p-2 text-left w-32">Conteo real</th>
            </tr>
          </thead>

          <tbody>
            {productos.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="p-2 text-lg align-top">☐</td>
                <td className="p-2 align-top">{item.productos?.nombre || "-"}</td>
                <td className="p-2 align-top">{obtenerUnidadClinica(item)}</td>
                <td className="p-2 align-top">{obtenerUnidadCentral(item)}</td>
                <td className="p-2 align-top">{formatearNumero(item.cantidad_actual)}</td>
                <td className="p-2 align-top">____________</td>
              </tr>
            ))}

            {productos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No hay productos para este almacén.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 text-sm">
          <p className="font-semibold">Observaciones:</p>
          <div className="mt-2 space-y-4">
            <div className="border-b border-gray-400 h-6" />
            <div className="border-b border-gray-400 h-6" />
            <div className="border-b border-gray-400 h-6" />
          </div>
        </div>
      </div>
    </div>
  )
}