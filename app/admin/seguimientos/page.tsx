"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Row = {
  id: string
  registro_id: string
  codigo: string
  nombre_responsable: string | null
  telefono: string | null
  nombre_animal: string | null
  especie: string | null
  sexo: string | null
  fecha_cirugia_realizada: string | null
  seguimiento_7d_enviado: boolean
  seguimiento_7d_respondido: boolean
  clinica_id: string | null
  clinica_nombre: string | null

  estado_general: string | null
  hubo_complicacion: boolean | null
  satisfaccion_general: number | null
  comentario_final: string | null
  fecha_respuesta: string | null
  respondido_por: string | null
}

type FiltroEstado = "todos" | "verde" | "amarillo" | "rojo"
type FiltroRespuesta = "todos" | "respondidos" | "pendientes"

function formatearFecha(fecha?: string | null) {
  if (!fecha) return "—"
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatearFechaHora(fecha?: string | null) {
  if (!fecha) return "—"
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatus(row: Row): "VERDE" | "AMARILLO" | "ROJO" {
  if (row.hubo_complicacion) return "ROJO"
  if ((row.estado_general || "").toLowerCase() === "malo") return "ROJO"
  if ((row.estado_general || "").toLowerCase() === "regular") return "AMARILLO"
  return "VERDE"
}

function badgeStatus(status: "VERDE" | "AMARILLO" | "ROJO") {
  if (status === "VERDE") return "bg-green-100 text-green-700 border border-green-200"
  if (status === "AMARILLO") return "bg-yellow-100 text-yellow-700 border border-yellow-200"
  return "bg-red-100 text-red-700 border border-red-200"
}

export default function SeguimientosAdminPage() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos")
  const [filtroRespuesta, setFiltroRespuesta] = useState<FiltroRespuesta>("todos")
  const [clinicaFiltro, setClinicaFiltro] = useState("todos")
  const [detalle, setDetalle] = useState<Row | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data, error } = await supabase.rpc("get_seguimientos_dashboard")

    if (error) {
      console.error("Error cargando seguimientos:", error)
      setData([])
    } else {
      setData((data as Row[]) || [])
    }

    setLoading(false)
  }

  const clinicasDisponibles = useMemo(() => {
    const uniques = Array.from(
      new Set(data.map((d) => d.clinica_nombre).filter(Boolean))
    ) as string[]
    return uniques.sort((a, b) => a.localeCompare(b))
  }, [data])

  const dataFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return data.filter((row) => {
      const status = getStatus(row)

      const matchTexto =
        !texto ||
        row.codigo?.toLowerCase().includes(texto) ||
        row.nombre_animal?.toLowerCase().includes(texto) ||
        row.nombre_responsable?.toLowerCase().includes(texto) ||
        row.clinica_nombre?.toLowerCase().includes(texto)

      const matchEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "verde" && status === "VERDE") ||
        (filtroEstado === "amarillo" && status === "AMARILLO") ||
        (filtroEstado === "rojo" && status === "ROJO")

      const matchRespuesta =
        filtroRespuesta === "todos" ||
        (filtroRespuesta === "respondidos" && row.seguimiento_7d_respondido) ||
        (filtroRespuesta === "pendientes" && !row.seguimiento_7d_respondido)

      const matchClinica =
        clinicaFiltro === "todos" || row.clinica_nombre === clinicaFiltro

      return matchTexto && matchEstado && matchRespuesta && matchClinica
    })
  }, [data, busqueda, filtroEstado, filtroRespuesta, clinicaFiltro])

  const stats = useMemo(() => {
    const total = data.length
    const enviados = data.filter((d) => d.seguimiento_7d_enviado).length
    const respondidos = data.filter((d) => d.seguimiento_7d_respondido).length

    const satisfacciones = data
      .map((d) => d.satisfaccion_general)
      .filter((v): v is number => v !== null && v !== undefined)

    const promedio =
      satisfacciones.length > 0
        ? satisfacciones.reduce((a, b) => a + b, 0) / satisfacciones.length
        : 0

    const complicaciones = data.filter((d) => d.hubo_complicacion).length
    const pendientes = total - respondidos

    return {
      total,
      enviados,
      respondidos,
      pendientes,
      promedio: promedio.toFixed(1),
      complicaciones,
    }
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando seguimientos...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0F6D6A] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Panel administrativo</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Seguimientos Post Esterilización
              </h1>
              <p className="text-white/80 mt-2 text-sm md:text-base max-w-3xl">
                Control de encuestas respondidas, satisfacción, complicaciones y calidad de atención.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={load}
                className="bg-white text-[#0F6D6A] px-4 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-100 transition"
              >
                Actualizar
              </button>

              <Link
                href="/admin"
                className="bg-[#F47C3C] text-white px-4 py-2.5 rounded-2xl font-bold hover:bg-[#db6d31] transition"
              >
                Volver al Admin
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <Card title="Total casos" value={stats.total} subtitle="Con cirugía registrada" />
          <Card title="Enviados" value={stats.enviados} subtitle="WhatsApp de seguimiento" />
          <Card title="Respondidos" value={stats.respondidos} subtitle="Encuestas recibidas" />
          <Card title="Pendientes" value={stats.pendientes} subtitle="Sin respuesta aún" />
          <Card title="Satisfacción" value={stats.promedio} subtitle="Promedio general" />
          <Card title="Complicaciones" value={stats.complicaciones} subtitle="Marcadas en encuesta" danger={stats.complicaciones > 0} />
        </div>

        <div className="rounded-[24px] bg-white shadow-xl p-4 md:p-5 border border-white/60">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F6D6A]">Filtros y búsqueda</h2>
              <p className="text-sm text-gray-500 mt-1">
                Busca por código, mascota, responsable o clínica.
              </p>
            </div>

            <div className="w-full lg:w-[360px]">
              <input
                type="text"
                placeholder="Buscar..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-2xl border-2 border-[#F47C2A] bg-white px-5 py-3 text-slate-800 shadow outline-none transition focus:ring-4 focus:ring-orange-200"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              value={filtroRespuesta}
              onChange={(e) => setFiltroRespuesta(e.target.value as FiltroRespuesta)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0F6D6A]"
            >
              <option value="todos">Todos los estados de respuesta</option>
              <option value="respondidos">Solo respondidos</option>
              <option value="pendientes">Solo pendientes</option>
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0F6D6A]"
            >
              <option value="todos">Todos los semáforos</option>
              <option value="verde">Verde</option>
              <option value="amarillo">Amarillo</option>
              <option value="rojo">Rojo</option>
            </select>

            <select
              value={clinicaFiltro}
              onChange={(e) => setClinicaFiltro(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#0F6D6A]"
            >
              <option value="todos">Todas las clínicas</option>
              {clinicasDisponibles.map((clinica) => (
                <option key={clinica} value={clinica}>
                  {clinica}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-[28px] bg-white shadow-xl border border-white/60 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0F6D6A]">Listado de seguimientos</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {dataFiltrada.length} resultado(s) visible(s)
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA]">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Mascota</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Clínica</th>
                  <th className="py-3 px-4">Fecha cirugía</th>
                  <th className="py-3 px-4">Respuesta</th>
                  <th className="py-3 px-4">Semáforo</th>
                  <th className="py-3 px-4">Satisfacción</th>
                  <th className="py-3 px-4">Complicación</th>
                  <th className="py-3 px-4">Acción</th>
                </tr>
              </thead>

              <tbody>
                {dataFiltrada.map((row) => {
                  const status = getStatus(row)

                  return (
                    <tr key={`${row.registro_id}-${row.codigo}`} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-800">{row.codigo}</td>
                      <td className="py-3 px-4 text-slate-700">{row.nombre_animal || "—"}</td>
                      <td className="py-3 px-4 text-slate-700">{row.nombre_responsable || "—"}</td>
                      <td className="py-3 px-4 text-slate-700">{row.clinica_nombre || "Sin clínica"}</td>
                      <td className="py-3 px-4 text-slate-700">{formatearFecha(row.fecha_cirugia_realizada)}</td>

                      <td className="py-3 px-4">
                        {row.seguimiento_7d_respondido ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-bold">
                            Respondido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 text-xs font-bold">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badgeStatus(status)}`}>
                          {status}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {row.satisfaccion_general ?? "—"}
                      </td>

                      <td className="py-3 px-4">
                        {row.hubo_complicacion ? (
                          <span className="inline-flex rounded-full bg-red-100 text-red-700 border border-red-200 px-3 py-1 text-xs font-bold">
                            ⚠ Sí
                          </span>
                        ) : (
                          <span className="text-slate-600">No</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => setDetalle(row)}
                          className="rounded-xl bg-[#0F6D6A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0c5d5a]"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {dataFiltrada.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-gray-500">
                      No se encontraron registros para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {detalle && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-[28px] bg-white shadow-2xl border border-white/70 overflow-hidden">
              <div className="px-6 py-5 border-b bg-gradient-to-r from-[#0F6D6A] to-[#147C78]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white/70 text-sm">Detalle de seguimiento</p>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {detalle.nombre_animal || "Mascota"}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">
                      Código: {detalle.codigo}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetalle(null)}
                    className="bg-white/15 hover:bg-white/25 transition text-white px-4 py-2 rounded-xl font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoBox title="Responsable" value={detalle.nombre_responsable || "—"} />
                  <InfoBox title="Teléfono" value={detalle.telefono || "—"} />
                  <InfoBox title="Clínica" value={detalle.clinica_nombre || "Sin clínica"} />
                  <InfoBox title="Fecha cirugía" value={formatearFecha(detalle.fecha_cirugia_realizada)} />
                  <InfoBox title="Respondido por" value={detalle.respondido_por || "—"} />
                  <InfoBox title="Fecha respuesta" value={formatearFechaHora(detalle.fecha_respuesta)} />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <InfoBox title="Estado general" value={detalle.estado_general || "—"} />
                  <InfoBox title="Satisfacción" value={detalle.satisfaccion_general?.toString() || "—"} />
                  <InfoBox title="Complicación" value={detalle.hubo_complicacion ? "Sí" : "No"} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#F7F8FA] p-4">
                  <p className="text-sm font-bold text-[#0F6D6A]">Comentario final</p>
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                    {detalle.comentario_final || "Sin comentario"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Card({
  title,
  value,
  subtitle,
  danger = false,
}: {
  title: string
  value: string | number
  subtitle?: string
  danger?: boolean
}) {
  return (
    <div className="rounded-[24px] border bg-white p-5 text-left transition-all shadow-xl border-white/60">
      <p className="text-sm text-gray-500 font-semibold">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${danger ? "text-red-600" : "text-[#0F6D6A]"}`}>
        {value}
      </p>
      {subtitle ? <p className="text-xs text-gray-400 mt-2">{subtitle}</p> : null}
    </div>
  )
}

function InfoBox({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-[#F7F8FA] p-4 border border-gray-100">
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className="text-sm font-bold text-gray-800 mt-2 break-words">{value}</p>
    </div>
  )
}