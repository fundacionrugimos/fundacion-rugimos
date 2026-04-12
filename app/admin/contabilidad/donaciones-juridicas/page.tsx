"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type DonacionJuridica = {
  id: string
  created_at: string
  fecha: string
  empresa: string
  tipo_aporte: "dinero" | "especie"
  monto_total: number
  observacion: string | null
}

const TIPOS_APORTE = [
  { value: "dinero", label: "Dinero" },
  { value: "especie", label: "Especie" },
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

export default function DonacionesJuridicasPage() {
  const hoje = new Date()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const [registros, setRegistros] = useState<DonacionJuridica[]>([])

  const [fecha, setFecha] = useState(hoje.toISOString().slice(0, 10))
  const [empresa, setEmpresa] = useState("")
  const [tipoAporte, setTipoAporte] = useState<"dinero" | "especie">("dinero")
  const [montoTotal, setMontoTotal] = useState("")
  const [observacion, setObservacion] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)

    try {
      const res = await fetch("/api/contabilidad/donaciones-juridicas", {
        cache: "no-store",
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "No se pudieron cargar las donaciones jurídicas.")
      }

      setRegistros((json.data || []) as DonacionJuridica[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "No se pudieron cargar las donaciones jurídicas.")
    } finally {
      setCargando(false)
    }
  }

  async function guardarRegistro() {
    const monto = Number(montoTotal)

    if (!fecha) {
      alert("Ingrese la fecha del registro.")
      return
    }

    if (!empresa.trim()) {
      alert("Ingrese el nombre de la empresa.")
      return
    }

    if (!tipoAporte) {
      alert("Seleccione el tipo de aporte.")
      return
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      alert("Ingrese un monto válido.")
      return
    }

    setGuardando(true)

    try {
      const res = await fetch("/api/contabilidad/donaciones-juridicas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fecha,
          empresa: empresa.trim(),
          tipo_aporte: tipoAporte,
          monto_total: monto,
          observacion: observacion.trim() || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error interno")
      }

      setFecha(new Date().toISOString().slice(0, 10))
      setEmpresa("")
      setTipoAporte("dinero")
      setMontoTotal("")
      setObservacion("")

      await cargar()
      alert("Donación jurídica registrada correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo guardar el registro: ${error.message || "error interno"}`)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRegistro(id: string) {
    const confirmar = window.confirm(
      "¿Seguro que deseas eliminar este registro de donación jurídica?"
    )

    if (!confirmar) return

    setEliminandoId(id)

    try {
      const res = await fetch(`/api/contabilidad/donaciones-juridicas?id=${id}`, {
        method: "DELETE",
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error interno")
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
          `${item.empresa} ${item.tipo_aporte} ${item.observacion || ""}`.toLowerCase()

        if (!texto.includes(q)) return false
      }

      if (filtroTipo && item.tipo_aporte !== filtroTipo) return false

      return true
    })
  }, [registros, busqueda, filtroTipo])

  const totalGeneral = useMemo(() => {
    return registros.reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registros])

  const totalDinero = useMemo(() => {
    return registros
      .filter((item) => item.tipo_aporte === "dinero")
      .reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registros])

  const totalEspecie = useMemo(() => {
    return registros
      .filter((item) => item.tipo_aporte === "especie")
      .reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registros])

  const totalFiltrado = useMemo(() => {
    return registrosFiltrados.reduce((acc, item) => acc + Number(item.monto_total || 0), 0)
  }, [registrosFiltrados])

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
                Donaciones jurídicas
              </h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Registro detallado de empresas que donan dinero o insumos,
                con control contable claro y separación entre aporte monetario y en especie.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full xl:min-w-[640px]">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-xs text-gray-500">Dinero</p>
                <p className="text-xl font-bold text-sky-600">{money(totalDinero)}</p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <p className="text-xs text-gray-500">Especie</p>
                <p className="text-xl font-bold text-violet-600">{money(totalEspecie)}</p>
              </div>

              <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 px-4 py-3">
                <p className="text-xs text-gray-500">Total filtrado</p>
                <p className="text-xl font-bold text-[#0F6D6A]">{money(totalFiltrado)}</p>
              </div>

              <div className="rounded-2xl border border-[#F47C3C]/10 bg-[#F47C3C]/10 px-4 py-3">
                <p className="text-xs text-gray-500">Total general</p>
                <p className="text-xl font-bold text-[#F47C3C]">{money(totalGeneral)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2">
              <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
                <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">
                  Nuevo registro jurídico
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      placeholder="Ej: Hipermaxi"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de aporte
                    </label>
                    <select
                      value={tipoAporte}
                      onChange={(e) => setTipoAporte(e.target.value as "dinero" | "especie")}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      {TIPOS_APORTE.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Monto total
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoTotal}
                      onChange={(e) => setMontoTotal(e.target.value)}
                      placeholder="Ej: 7100"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Observación
                    </label>
                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      rows={4}
                      placeholder="Ej: Donación mensual de insumos."
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 resize-none"
                    />
                  </div>

                  <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 p-4 text-sm text-gray-700 leading-6">
                    <span className="font-bold text-[#0F6D6A]">Importante:</span> por ahora este
                    registro es solo contable. En el siguiente paso lo vincularemos al inventario
                    cuando el aporte sea en especie, para evitar duplicidades o cruces incorrectos.
                  </div>

                  <button
                    type="button"
                    onClick={guardarRegistro}
                    disabled={guardando}
                    className="w-full rounded-2xl bg-[#F47C3C] text-white font-bold px-4 py-3 shadow hover:bg-[#db6d31] transition disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : "Guardar donación jurídica"}
                  </button>
                </div>
              </div>
            </div>

            <div className="xl:col-span-3">
              <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold text-[#0F6D6A]">
                    Historial de donaciones jurídicas
                  </h2>

                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por empresa o nota..."
                      className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />

                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      <option value="">Todos los tipos</option>
                      {TIPOS_APORTE.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.label}
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
                    No hay donaciones jurídicas registradas.
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
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-lg font-bold text-[#0F6D6A]">
                                {item.empresa}
                              </p>

                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  item.tipo_aporte === "dinero"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-violet-100 text-violet-700"
                                }`}
                              >
                                {item.tipo_aporte}
                              </span>
                            </div>

                            <p className="text-sm text-gray-500 mt-2">
                              Fecha: {formatDate(item.fecha)}
                            </p>
                            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                              {item.observacion || "Sin observación"}
                            </p>
                          </div>

                          <div className="lg:text-right">
                            <p className="text-sm text-gray-500">Monto total</p>
                            <p
                              className={`text-2xl font-extrabold ${
                                item.tipo_aporte === "dinero"
                                  ? "text-sky-600"
                                  : "text-violet-600"
                              }`}
                            >
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