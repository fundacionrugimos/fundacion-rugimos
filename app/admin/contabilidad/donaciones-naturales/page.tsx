"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"


type DonacionNatural = {
  id: string
  created_at: string
  fecha: string
  anio: number
  mes: number
  monto_total: number
  metodo: string | null
  observacion: string | null
}

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
]

function money(value: number) {
  return `Bs ${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("es-BO")
}

function getMesLabel(mes: number) {
  return MESES.find((m) => m.value === mes)?.label || `Mes ${mes}`
}

export default function DonacionesNaturalesPage() {
  const hoje = new Date()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const [registros, setRegistros] = useState<DonacionNatural[]>([])

  const [fecha, setFecha] = useState(hoje.toISOString().slice(0, 10))
  const [anio, setAnio] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [montoTotal, setMontoTotal] = useState("")
  const [metodo, setMetodo] = useState("mixto")
  const [observacion, setObservacion] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [filtroAnio, setFiltroAnio] = useState("")
  const [filtroMes, setFiltroMes] = useState("")

  useEffect(() => {
    cargar()
  }, [])

 async function cargar() {
  setCargando(true)

  try {
    const res = await fetch("/api/contabilidad/donaciones-naturales")
    const data = await res.json()

    if (!res.ok) throw new Error(data.error)

    setRegistros(data.data || [])
  } catch (error) {
    console.error(error)
    alert("No se pudieron cargar las donaciones naturales.")
  }

  setCargando(false)
}

  async function guardarRegistro() {
    const monto = Number(montoTotal)

    if (!fecha) {
      alert("Ingrese la fecha del registro.")
      return
    }

    if (!anio || anio < 2020) {
      alert("Ingrese un año válido.")
      return
    }

    if (!mes || mes < 1 || mes > 12) {
      alert("Seleccione un mes válido.")
      return
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      alert("Ingrese un monto válido.")
      return
    }

    setGuardando(true)

    try {
      const res = await fetch("/api/contabilidad/donaciones-naturales", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fecha,
    anio,
    mes,
    monto_total: monto,
    metodo: metodo || "mixto",
    observacion: observacion.trim() || null,
  }),
})

const data = await res.json()

if (!res.ok) {
  throw new Error(data.error || "Error al guardar")
}

      setMontoTotal("")
      setMetodo("mixto")
      setObservacion("")
      setFecha(new Date().toISOString().slice(0, 10))
      setAnio(new Date().getFullYear())
      setMes(new Date().getMonth() + 1)

      await cargar()
      alert("Donación natural registrada correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo guardar el registro: ${error.message || "error interno"}`)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRegistro(id: string) {
    const confirmar = window.confirm(
      "¿Seguro que deseas eliminar este registro de donación natural?"
    )

    if (!confirmar) return

    setEliminandoId(id)

    try {
      const res = await fetch("/api/contabilidad/donaciones-naturales", {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id }),
})

const data = await res.json()

if (!res.ok) {
  throw new Error(data.error || "Error al eliminar")
}

      await cargar()
      alert("Registro eliminado correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo eliminar: ${error.message || "error interno"}`)
    } finally {
      setEliminandoId(null)
    }
  }

  const registrosFiltrados = useMemo(() => {
    return registros.filter((item) => {
      const q = busqueda.trim().toLowerCase()

      if (q) {
        const texto =
          `${item.anio} ${getMesLabel(item.mes)} ${item.metodo || ""} ${item.observacion || ""}`.toLowerCase()

        if (!texto.includes(q)) return false
      }

      if (filtroAnio && String(item.anio) !== filtroAnio) return false
      if (filtroMes && String(item.mes) !== filtroMes) return false

      return true
    })
  }, [registros, busqueda, filtroAnio, filtroMes])

  const totalGeneral = useMemo(() => {
    return registros.reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registros])

  const totalFiltrado = useMemo(() => {
    return registrosFiltrados.reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registrosFiltrados])

  const aniosDisponibles = useMemo(() => {
    return Array.from(new Set(registros.map((r) => r.anio))).sort((a, b) => b - a)
  }, [registros])

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/contabilidad"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a contabilidad
          </Link>

          <Link
            href="/admin/contabilidad/resumen"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Ir al resumen
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 border border-white/60">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">
                Donaciones naturales
              </h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Registro mensual consolidado de ingresos por QR y aportes de personas naturales,
                según extracto bancario o control contable.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-full xl:min-w-[520px]">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs text-gray-500">Total general</p>
                <p className="text-xl font-bold text-emerald-600">{money(totalGeneral)}</p>
              </div>

              <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 px-4 py-3">
                <p className="text-xs text-gray-500">Total filtrado</p>
                <p className="text-xl font-bold text-[#0F6D6A]">{money(totalFiltrado)}</p>
              </div>

              <div className="rounded-2xl border border-[#F47C3C]/10 bg-[#F47C3C]/10 px-4 py-3">
                <p className="text-xs text-gray-500">Registros</p>
                <p className="text-xl font-bold text-[#F47C3C]">{registrosFiltrados.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2">
              <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">
                  Nuevo registro mensual
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fecha del registro
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Año
                      </label>
                      <input
                        type="number"
                        value={anio}
                        onChange={(e) => setAnio(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mes
                      </label>
                      <select
                        value={mes}
                        onChange={(e) => setMes(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                      >
                        {MESES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Monto total consolidado
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoTotal}
                      onChange={(e) => setMontoTotal(e.target.value)}
                      placeholder="Ej: 3850"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Método principal
                    </label>
                    <select
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value)}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      <option value="mixto">Mixto</option>
                      <option value="qr">QR</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="banco">Banco</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observación
                    </label>
                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      rows={4}
                      placeholder="Ej: Total consolidado según extracto bancario del mes."
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={guardarRegistro}
                    disabled={guardando}
                    className="w-full rounded-2xl bg-[#F47C3C] text-white font-bold px-4 py-3 shadow hover:bg-[#db6d31] transition disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : "Guardar donación natural"}
                  </button>
                </div>
              </div>
            </div>

            <div className="xl:col-span-3">
              <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold text-[#0F6D6A]">
                    Historial de registros
                  </h2>

                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por mes, año, método..."
                      className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />

                    <select
                      value={filtroAnio}
                      onChange={(e) => setFiltroAnio(e.target.value)}
                      className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      <option value="">Todos los años</option>
                      {aniosDisponibles.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                      className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      <option value="">Todos los meses</option>
                      {MESES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {cargando ? (
                  <div className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
                    Cargando registros...
                  </div>
                ) : registrosFiltrados.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
                    No hay registros de donaciones naturales.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {registrosFiltrados.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold text-[#0F6D6A]">
                              {getMesLabel(item.mes)} {item.anio}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Fecha registro: {formatDate(item.fecha)}
                            </p>
                            <p className="text-sm text-gray-500">
                              Método: {item.metodo || "mixto"}
                            </p>
                            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                              {item.observacion || "Sin observación"}
                            </p>
                          </div>

                          <div className="lg:text-right">
                            <p className="text-sm text-gray-500">Monto total</p>
                            <p className="text-2xl font-extrabold text-emerald-600">
                              {money(Number(item.monto_total || 0))}
                            </p>

                            <button
                              type="button"
                              onClick={() => eliminarRegistro(item.id)}
                              disabled={eliminandoId === item.id}
                              className="mt-4 px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition disabled:opacity-60"
                            >
                              {eliminandoId === item.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}