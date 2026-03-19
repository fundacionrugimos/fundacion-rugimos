"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Transferencia = {
  id: string
  created_at: string
  estado: string
  motivo: string | null
  entregado_por: string | null
  recibido_por: string | null
  observaciones: string | null
  fecha_transferencia: string | null
  almacen_origen_id: string
  almacen_destino_id: string
}

type Item = {
  id: string
  transferencia_id: string
  producto_id: string
  producto_nombre: string
  cantidad_base: number
  unidad_compra: string | null
  contenido_por_unidad: number
  cantidad_fraccionada: number
  unidad_fraccionada: string | null
}

type Almacen = {
  id: string
  nombre: string
  tipo: string
  clinica_id: string | null
}

function formatearNumero(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function formatearFecha(valor?: string | null) {
  if (!valor) return "-"
  return new Date(valor).toLocaleString("es-BO")
}

function formatearFechaCorta(valor?: string | null) {
  if (!valor) return "-"
  return new Date(valor).toLocaleDateString("es-BO")
}

export default function TransferenciaNuevoDetallePage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? ""

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const [transferencia, setTransferencia] = useState<Transferencia | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [almacenOrigen, setAlmacenOrigen] = useState<Almacen | null>(null)
  const [almacenDestino, setAlmacenDestino] = useState<Almacen | null>(null)

  const [recibidoPor, setRecibidoPor] = useState("")
  const [observaciones, setObservaciones] = useState("")

  const totalProductos = items.length

  const totalCantidadBase = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad_base || 0), 0)
  }, [items])

  const totalCantidadFraccionada = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.cantidad_fraccionada || 0), 0)
  }, [items])

  async function cargarDetalle() {
    if (!id) return

    setCargando(true)

    const { data: transferenciaData, error: transferenciaError } = await supabase
      .from("transferencias_inventario")
      .select(`
        id,
        created_at,
        estado,
        motivo,
        entregado_por,
        recibido_por,
        observaciones,
        fecha_transferencia,
        almacen_origen_id,
        almacen_destino_id
      `)
      .eq("id", id)
      .single()

    if (transferenciaError || !transferenciaData) {
      console.log("Error cargando transferencia:", transferenciaError)
      setTransferencia(null)
      setItems([])
      setAlmacenOrigen(null)
      setAlmacenDestino(null)
      setCargando(false)
      return
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("transferencias_inventario_items")
      .select(`
        id,
        transferencia_id,
        producto_id,
        producto_nombre,
        cantidad_base,
        unidad_compra,
        contenido_por_unidad,
        cantidad_fraccionada,
        unidad_fraccionada
      `)
      .eq("transferencia_id", id)
      .order("created_at", { ascending: true })

    if (itemsError) {
      console.log("Error cargando items:", itemsError)
    }

    const [origenRes, destinoRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("id", transferenciaData.almacen_origen_id)
        .single(),
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("id", transferenciaData.almacen_destino_id)
        .single(),
    ])

    if (origenRes.error) console.log("Error origen:", origenRes.error)
    if (destinoRes.error) console.log("Error destino:", destinoRes.error)

    setTransferencia(transferenciaData as Transferencia)
    setItems((itemsData as Item[]) || [])
    setAlmacenOrigen((origenRes.data as Almacen) || null)
    setAlmacenDestino((destinoRes.data as Almacen) || null)
    setRecibidoPor((transferenciaData as Transferencia).recibido_por || "")
    setObservaciones((transferenciaData as Transferencia).observaciones || "")

    setCargando(false)
  }

  useEffect(() => {
    cargarDetalle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function confirmarTransferencia() {
    if (!transferencia) return

    const ok = window.confirm(
      "¿Desea confirmar esta transferencia? Esto descontará del almacén origen, ingresará a la clínica y registrará los movimientos."
    )
    if (!ok) return

    setProcesando(true)

    const { error } = await supabase.rpc("confirmar_transferencia_inventario", {
      p_transferencia_id: transferencia.id,
      p_usuario: "admin",
      p_recibido_por: recibidoPor || null,
      p_observaciones: observaciones || null,
    })

    if (error) {
      console.log("Error confirmando transferencia:", error)
      alert(error.message || "No se pudo confirmar la transferencia")
      setProcesando(false)
      return
    }

    alert("Transferencia confirmada correctamente")
    await cargarDetalle()
    setProcesando(false)
  }

  async function cancelarTransferencia() {
    if (!transferencia) return

    const ok = window.confirm(
      "¿Desea cancelar esta transferencia? El estado cambiará a cancelada."
    )
    if (!ok) return

    setProcesando(true)

    const { error } = await supabase
      .from("transferencias_inventario")
      .update({
        estado: "cancelada",
        observaciones: observaciones || null,
      })
      .eq("id", transferencia.id)

    if (error) {
      console.log("Error cancelando transferencia:", error)
      alert(error.message || "No se pudo cancelar la transferencia")
      setProcesando(false)
      return
    }

    alert("Transferencia cancelada correctamente")
    await cargarDetalle()
    setProcesando(false)
  }

  function imprimirHoja() {
    window.print()
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#0F6D6A] border-t-transparent animate-spin mb-5" />
          <h2 className="text-2xl font-bold text-[#0F6D6A]">
            Cargando transferencia
          </h2>
          <p className="text-gray-600 mt-2">
            Preparando detalle, productos y hoja de entrega...
          </p>
        </div>
      </div>
    )
  }

  if (!transferencia) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 text-center max-w-lg w-full">
          <h2 className="text-2xl font-bold text-[#0F6D6A] mb-3">
            Transferencia no encontrada
          </h2>
          <p className="text-gray-600 mb-6">
            No pudimos encontrar esta transferencia en el sistema.
          </p>
          <Link
            href="/admin/inventario/transferencias-nuevo"
            className="inline-flex bg-[#F47C3C] text-white px-5 py-3 rounded-2xl font-bold hover:bg-[#db6d31] transition"
          >
            Volver a transferencias
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8 print:bg-white print:p-0">
        <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:space-y-0">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 print:hidden">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-sm font-semibold mb-3">
                <span>Inventario</span>
                <span className="opacity-70">/</span>
                <span>Transferencia</span>
                <span className="opacity-70">/</span>
                <span>Detalle</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Detalle de Transferencia
              </h1>
              <p className="text-white/80 mt-2 max-w-3xl">
                Revise los productos, imprima la hoja de entrega y confirme el
                movimiento cuando la clínica reciba el material.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link
                href="/admin/inventario/transferencias-nuevo"
                className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
              >
                Volver
              </Link>

              <button
                type="button"
                onClick={imprimirHoja}
                className="bg-[#0F6D6A] border border-white/30 text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#0a5654] transition"
              >
                Imprimir hoja
              </button>
            </div>
          </div>

          <div className="grid xl:grid-cols-3 gap-6 print:hidden">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl shadow-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">
                      ID transferencia
                    </div>
                    <div className="font-mono text-sm bg-gray-100 rounded-xl px-3 py-2 inline-block break-all">
                      {transferencia.id}
                    </div>
                  </div>

                  <div
                    className={`inline-flex px-4 py-2 rounded-full text-sm font-bold w-fit ${
                      transferencia.estado === "confirmada"
                        ? "bg-green-100 text-green-700"
                        : transferencia.estado === "cancelada"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {transferencia.estado}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Fecha creación
                    </div>
                    <div className="font-bold text-gray-800">
                      {formatearFecha(transferencia.created_at)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Origen
                    </div>
                    <div className="font-bold text-gray-800">
                      {almacenOrigen?.nombre || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Destino
                    </div>
                    <div className="font-bold text-gray-800">
                      {almacenDestino?.nombre || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Entregado por
                    </div>
                    <div className="font-bold text-gray-800">
                      {transferencia.entregado_por || "-"}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-2xl bg-[#0F6D6A]/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Productos
                    </div>
                    <div className="font-bold text-[#0F6D6A] text-xl">
                      {totalProductos}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F47C3C]/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Base total
                    </div>
                    <div className="font-bold text-[#F47C3C] text-xl">
                      {formatearNumero(totalCantidadBase)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-green-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Fraccionado total
                    </div>
                    <div className="font-bold text-green-700 text-xl">
                      {formatearNumero(totalCantidadFraccionada)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0F6D6A]">
                      Productos de la transferencia
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Resumen completo del envío preparado para la clínica.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-3xl p-5 hover:shadow-md transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div>
                            <div className="text-lg font-bold text-gray-900">
                              {item.producto_nombre}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              Conversión para uso en clínica
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Cantidad base
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.cantidad_base)}{" "}
                                {item.unidad_compra || "-"}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Contenido
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.contenido_por_unidad)}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Cantidad fraccionada
                              </div>
                              <div className="font-bold text-gray-800">
                                {formatearNumero(item.cantidad_fraccionada)}{" "}
                                {item.unidad_fraccionada || "-"}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-[#F47C3C]/10 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                Conversión
                              </div>
                              <div className="font-bold text-[#F47C3C]">
                                {formatearNumero(item.cantidad_base)}{" "}
                                {item.unidad_compra || "-"} →{" "}
                                {formatearNumero(item.cantidad_fraccionada)}{" "}
                                {item.unidad_fraccionada || "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-gray-300 p-10 text-center">
                      <div className="text-xl font-bold text-gray-700">
                        No hay productos en esta transferencia
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl shadow-2xl p-6">
                <h2 className="text-2xl font-bold text-[#0F6D6A] mb-5">
                  Gestión de entrega
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Recibido por
                    </label>
                    <input
                      type="text"
                      value={recibidoPor}
                      onChange={(e) => setRecibidoPor(e.target.value)}
                      placeholder="Nombre de quien recibe"
                      className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observaciones
                    </label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={5}
                      placeholder="Observaciones de entrega, notas o aclaraciones..."
                      className="w-full border rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A] resize-none"
                    />
                  </div>

                  <div className="grid gap-3 pt-2">
                    <button
                      type="button"
                      onClick={imprimirHoja}
                      className="w-full py-3 rounded-2xl font-bold border border-[#0F6D6A] text-[#0F6D6A] hover:bg-[#0F6D6A]/5 transition"
                    >
                      Imprimir hoja de entrega
                    </button>

                    <button
                      type="button"
                      onClick={confirmarTransferencia}
                      disabled={procesando || transferencia.estado === "confirmada"}
                      className={`w-full py-3 rounded-2xl font-bold text-white transition ${
                        procesando || transferencia.estado === "confirmada"
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {transferencia.estado === "confirmada"
                        ? "Transferencia confirmada"
                        : procesando
                        ? "Confirmando..."
                        : "Confirmar transferencia"}
                    </button>

                    <button
                      type="button"
                      onClick={cancelarTransferencia}
                      disabled={procesando || transferencia.estado === "cancelada"}
                      className={`w-full py-3 rounded-2xl font-bold transition ${
                        procesando || transferencia.estado === "cancelada"
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      {transferencia.estado === "cancelada"
                        ? "Transferencia cancelada"
                        : "Cancelar transferencia"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-6">
                <h3 className="text-xl font-bold text-[#0F6D6A] mb-4">
                  Resumen documental
                </h3>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Motivo
                    </div>
                    <div className="font-semibold text-gray-800">
                      {transferencia.motivo || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Recibido por
                    </div>
                    <div className="font-semibold text-gray-800">
                      {recibidoPor || transferencia.recibido_por || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Observaciones
                    </div>
                    <div className="font-semibold text-gray-800 whitespace-pre-wrap">
                      {observaciones || transferencia.observaciones || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Fecha confirmación
                    </div>
                    <div className="font-semibold text-gray-800">
                      {transferencia.fecha_transferencia
                        ? formatearFecha(transferencia.fecha_transferencia)
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden print:block bg-white text-black">
            <div className="max-w-4xl mx-auto px-8 py-8">
              <div className="border-2 border-gray-700">
                <div className="bg-[#DCECCB] border-b-2 border-gray-700 px-6 py-5">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      {!logoError ? (
                        <img
                          src="/logo.png"
                          alt="Fundación Rugimos"
                          className="h-16 w-auto object-contain"
                          onError={() => setLogoError(true)}
                        />
                      ) : null}

                      <div>
                        <div className="text-2xl font-bold tracking-wide">
                          FUNDACIÓN RUGIMOS
                        </div>
                        <div className="text-sm mt-1">
                          Hoja de entrega de inventario
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div>
                        <span className="font-semibold">Fecha:</span>{" "}
                        {formatearFechaCorta(
                          transferencia.fecha_transferencia || transferencia.created_at
                        )}
                      </div>
                      <div className="mt-1">
                        <span className="font-semibold">Estado:</span>{" "}
                        {transferencia.estado}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 border-b border-gray-400">
                  <div className="text-center text-2xl font-bold">
                    {almacenDestino?.nombre || "DESTINO DE ENTREGA"}
                  </div>
                </div>

                <div className="px-6 py-5 border-b border-gray-400">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="mb-2">
                        <span className="font-semibold">Origen:</span>{" "}
                        {almacenOrigen?.nombre || "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Destino:</span>{" "}
                        {almacenDestino?.nombre || "-"}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2">
                        <span className="font-semibold">Entregado por:</span>{" "}
                        {transferencia.entregado_por || "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Recibido por:</span>{" "}
                        {recibidoPor || transferencia.recibido_por || "________________"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#F3F7EC]">
                        <th className="border border-gray-700 px-3 py-3 text-left">
                          MEDICAMENTOS Y MATERIALES
                        </th>
                        <th className="border border-gray-700 px-3 py-3 text-left">
                          PRESENTACIÓN
                        </th>
                        <th className="border border-gray-700 px-3 py-3 text-left">
                          CANTIDAD
                        </th>
                        <th className="border border-gray-700 px-3 py-3 text-left">
                          USO CLÍNICA
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-gray-700 px-3 py-3">
                            {item.producto_nombre}
                          </td>
                          <td className="border border-gray-700 px-3 py-3">
                            {item.unidad_compra || "-"}
                          </td>
                          <td className="border border-gray-700 px-3 py-3">
                            {formatearNumero(item.cantidad_base)}
                          </td>
                          <td className="border border-gray-700 px-3 py-3">
                            {formatearNumero(item.cantidad_fraccionada)}{" "}
                            {item.unidad_fraccionada || "-"}
                          </td>
                        </tr>
                      ))}

                      {items.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="border border-gray-700 px-3 py-5 text-center"
                          >
                            Sin productos registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 pb-6">
                  <div className="grid grid-cols-2 gap-10 mt-12">
                    <div className="text-center">
                      <div className="border-t border-black pt-2 text-sm font-semibold">
                        ENTREGADO POR
                      </div>
                      <div className="mt-2 text-sm">
                        {transferencia.entregado_por || ""}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="border-t border-black pt-2 text-sm font-semibold">
                        RECIBIDO
                      </div>
                      <div className="mt-2 text-sm">
                        {recibidoPor || transferencia.recibido_por || ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 text-sm">
                    <span className="font-semibold">Observaciones:</span>{" "}
                    {observaciones ||
                      transferencia.observaciones ||
                      "__________________________________________"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </>
  )
}