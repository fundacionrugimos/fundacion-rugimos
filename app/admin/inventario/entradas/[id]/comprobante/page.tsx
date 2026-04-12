"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Entrada = {
  id: string
  numero_comprobante: string | null
  fecha_comprobante: string | null
  created_at: string
  tipo_origen: string | null
  motivo: string | null
  observacion: string | null
  proveedor: string | null
  empresa_donante: string | null
  costo_total: number | null
  metodo_pago: string | null
  estado_pago: string | null
  monto_pagado: number | null
  saldo_pendiente: number | null
  fecha_compra: string | null
  fecha_pago: string | null
  fecha_vencimiento: string | null
  registrado_por: string | null
  registrado_por_email: string | null
  almacenes: {
    nombre: string
    tipo: string | null
  } | null
}

type EntradaItem = {
  id: string
  cantidad: number
  unidad: string | null
  costo_unitario: number | null
  costo_total: number | null
  productos: {
    nombre: string
    unidad_base: string | null
  } | null
}

function normalizarRelacion(rel: any) {
  if (Array.isArray(rel)) return rel[0] || null
  return rel || null
}

function formatMoney(value?: number | null) {
  return `Bs ${Number(value || 0).toFixed(2)}`
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("es-BO")
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("es-BO")
}

export default function ComprobanteEntradaPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? ""
  const autoPrint = searchParams.get("print") === "1"

  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [items, setItems] = useState<EntradaItem[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (id) cargarComprobante()
  }, [id])

  useEffect(() => {
    if (!autoPrint || cargando || !entrada) return

    const timeout = setTimeout(() => {
      window.print()
    }, 500)

    return () => clearTimeout(timeout)
  }, [autoPrint, cargando, entrada])

  async function cargarComprobante() {
    setCargando(true)

    const { data: entradaData, error: entradaError } = await supabase
      .from("entradas_inventario")
      .select(`
        id,
        numero_comprobante,
        fecha_comprobante,
        created_at,
        tipo_origen,
        motivo,
        observacion,
        proveedor,
        empresa_donante,
        costo_total,
        metodo_pago,
        estado_pago,
        monto_pagado,
        saldo_pendiente,
        fecha_compra,
        fecha_pago,
        fecha_vencimiento,
        registrado_por,
        registrado_por_email,
        almacenes:almacen_id (
          nombre,
          tipo
        )
      `)
      .eq("id", id)
      .single()

    if (entradaError) {
      console.error(entradaError)
      alert("No se pudo cargar el comprobante.")
      setCargando(false)
      return
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("entradas_inventario_items")
      .select(`
        id,
        cantidad,
        unidad,
        costo_unitario,
        costo_total,
        productos:producto_id (
          nombre,
          unidad_base
        )
      `)
      .eq("entrada_id", id)
      .order("created_at", { ascending: true })

    if (itemsError) {
      console.error(itemsError)
      alert("No se pudieron cargar los items del comprobante.")
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

  const proveedorFinal =
    entrada?.tipo_origen === "donacion"
      ? entrada?.empresa_donante || entrada?.proveedor || "-"
      : entrada?.proveedor || "-"

  return (
    <div className="min-h-screen bg-[#eaf7f6] p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="no-print flex flex-wrap gap-3">
          <Link
            href="/admin/inventario/entradas"
            className="px-4 py-2 rounded-xl bg-white text-[#0F6D6A] font-semibold shadow"
          >
            Volver al historial
          </Link>

          <Link
            href={`/admin/inventario/entradas/${id}`}
            className="px-4 py-2 rounded-xl bg-white text-[#0F6D6A] font-semibold shadow"
          >
            Ver detalle
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-[#0F6D6A] text-white font-semibold shadow"
          >
            Imprimir comprobante
          </button>
        </div>

        <div className="bg-white rounded-[28px] shadow-xl overflow-hidden border border-[#d9eceb]">
          <div className="bg-gradient-to-r from-[#0F6D6A] to-[#159895] text-white px-6 md:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-sm font-medium opacity-90">🐾 Fundación Rugimos</p>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Comprobante de Entrada
                </h1>
                <p className="text-white/90 mt-1">
                  Registro interno de ingreso al almacén
                </p>
              </div>

              <div className="bg-white/15 rounded-2xl px-4 py-3 min-w-[220px]">
                <p className="text-xs uppercase tracking-wide text-white/80">
                  Nº de comprobante
                </p>
                <p className="text-xl font-bold">
                  {entrada?.numero_comprobante || "Sin número"}
                </p>
                <p className="text-sm text-white/85 mt-1">
                  {formatDateTime(entrada?.fecha_comprobante || entrada?.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {cargando ? (
              <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
                Cargando comprobante...
              </div>
            ) : !entrada ? (
              <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
                No se encontró la entrada.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Tipo de origen</p>
                    <p className="font-semibold text-gray-800">{entrada.tipo_origen || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Almacén</p>
                    <p className="font-semibold text-gray-800">
                      {entrada.almacenes?.nombre || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Motivo operativo</p>
                    <p className="font-semibold text-gray-800">{entrada.motivo || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Proveedor / origen</p>
                    <p className="font-semibold text-gray-800">{proveedorFinal}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Registrado por</p>
                    <p className="font-semibold text-gray-800">
                      {entrada.registrado_por || "Administrador"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {entrada.registrado_por_email || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Fecha de compra</p>
                    <p className="font-semibold text-gray-800">
                      {formatDate(entrada.fecha_compra)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-[#f7fbfb] border-b border-gray-200">
                    <h2 className="font-bold text-[#0F6D6A]">Detalle de productos</h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3">Producto</th>
                          <th className="text-right px-4 py-3">Cantidad</th>
                          <th className="text-left px-4 py-3">Unidad</th>
                          <th className="text-right px-4 py-3">Costo unitario</th>
                          <th className="text-right px-4 py-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-t border-gray-100">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {item.productos?.nombre || "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(item.cantidad || 0)}
                            </td>
                            <td className="px-4 py-3">
                              {item.unidad || item.productos?.unidad_base || "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatMoney(item.costo_unitario)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {formatMoney(item.costo_total)}
                            </td>
                          </tr>
                        ))}

                        {items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                              Sin productos registrados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-2">Observación</p>
                    <p className="text-gray-800 whitespace-pre-line">
                      {entrada.observacion || "Sin observaciones"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Costo total</span>
                      <span className="font-semibold">{formatMoney(entrada.costo_total)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Monto pagado</span>
                      <span className="font-semibold">{formatMoney(entrada.monto_pagado)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Saldo pendiente</span>
                      <span className="font-semibold">{formatMoney(entrada.saldo_pendiente)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Método de pago</span>
                      <span className="font-semibold">{entrada.metodo_pago || "-"}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Estado de pago</span>
                      <span className="font-semibold">{entrada.estado_pago || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <div className="border-t border-gray-400 pt-2 text-sm text-gray-600">
                      Firma responsable
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-gray-400 pt-2 text-sm text-gray-600">
                      Firma de conformidad
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  )
}