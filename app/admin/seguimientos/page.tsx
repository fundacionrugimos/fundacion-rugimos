"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type Row = {
  id: string
  codigo: string
  nombre_animal: string
  especie: string
  sexo: string
  fecha_cirugia_realizada: string
  seguimiento_7d_enviado: boolean
  seguimiento_7d_respondido: boolean
  clinica_nombre: string | null

  estado_general: string | null
  hubo_complicacion: boolean | null
  satisfaccion_general: number | null
  comentario_final: string | null
  fecha_respuesta: string | null
}

export default function SeguimientosAdmin() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data, error } = await supabase.rpc("get_seguimientos_dashboard")

    if (error) {
      console.error(error)
    } else {
      setData(data || [])
    }

    setLoading(false)
  }

  const stats = useMemo(() => {
    const total = data.length
    const enviados = data.filter((d) => d.seguimiento_7d_enviado).length
    const respondidos = data.filter((d) => d.seguimiento_7d_respondido).length

    const satisfacciones = data
      .map((d) => d.satisfaccion_general)
      .filter((v) => v !== null) as number[]

    const promedio =
      satisfacciones.length > 0
        ? satisfacciones.reduce((a, b) => a + b, 0) / satisfacciones.length
        : 0

    const complicaciones = data.filter((d) => d.hubo_complicacion).length

    return {
      total,
      enviados,
      respondidos,
      promedio: promedio.toFixed(1),
      complicaciones,
    }
  }, [data])

  function getStatus(row: Row) {
    if (row.hubo_complicacion) return "ROJO"
    if (row.estado_general === "Malo") return "ROJO"
    if (row.estado_general === "Regular") return "AMARILLO"
    return "VERDE"
  }

  if (loading) {
    return <div className="p-10">Cargando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">🐾 Seguimientos</h1>

      {/* CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card title="Total" value={stats.total} />
        <Card title="Enviados" value={stats.enviados} />
        <Card title="Respondidos" value={stats.respondidos} />
        <Card title="Satisfacción" value={stats.promedio} />
        <Card title="Complicaciones" value={stats.complicaciones} />
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-2xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Mascota</th>
              <th className="p-3 text-left">Clínica</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Satisfacción</th>
              <th className="p-3 text-left">Complicación</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => {
              const status = getStatus(row)

              return (
                <tr key={row.id} className="border-t">
                  <td className="p-3">{row.codigo}</td>
                  <td className="p-3">{row.nombre_animal}</td>
                  <td className="p-3">{row.clinica_nombre}</td>
                  <td className="p-3">{row.fecha_cirugia_realizada}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        status === "VERDE"
                          ? "bg-green-100 text-green-700"
                          : status === "AMARILLO"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {status}
                    </span>
                  </td>

                  <td className="p-3">{row.satisfaccion_general || "-"}</td>

                  <td className="p-3">
                    {row.hubo_complicacion ? "⚠️ Sí" : "No"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}