"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Registro = {
  id?: string | number
  codigo?: string | null
  clinica_id: string | null
  fecha_programada: string | null
  fecha_cirugia_realizada?: string | null
  estado_cita?: string | null
  estado_clinica?: string | null
  especie?: string | null
  sexo?: string | null
  tipo_animal?: string | null
  nombre_animal?: string | null
  nombre_responsable?: string | null
}

type Clinica = {
  id: string
  nome: string
}

function normalizarTexto(valor?: string | null) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function normalizarEstado(estado?: string | null) {
  const valor = normalizarTexto(estado)

  if (valor === "programado") return "PROGRAMADO"
  if (valor === "atendido" || valor === "realizado") return "REALIZADO"
  if (valor === "cancelado") return "CANCELADO"
  if (valor === "reprogramado") return "REPROGRAMADO"
  if (valor === "recusado" || valor === "rechazado") return "RECHAZADO"
  if (valor === "fallecido" || valor === "fallecio") return "FALLECIO"

  return "OTRO"
}

function labelEstado(estado?: string | null) {
  const e = normalizarEstado(estado)
  if (e === "PROGRAMADO") return "Programado"
  if (e === "REALIZADO") return "Realizado"
  if (e === "CANCELADO") return "Cancelado"
  if (e === "REPROGRAMADO") return "Reprogramado"
  if (e === "RECHAZADO") return "Rechazado"
  if (e === "FALLECIO") return "Falleció"
  return estado || "Otro"
}

function esRealizadoGestion(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  const estadoClinica = normalizarTexto(registro.estado_clinica)

  return (
    estado === "realizado" ||
    estado === "atendido" ||
    estado === "fallecido" ||
    estado === "fallecio" ||
    estadoClinica === "realizado" ||
    estadoClinica === "atendido" ||
    estadoClinica === "apto" ||
    estadoClinica === "fallecido" ||
    estadoClinica === "fallecio"
  )
}

function esRechazadoONoApto(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  const estadoClinica = normalizarTexto(registro.estado_clinica)

  return (
    estado === "rechazado" ||
    estadoClinica === "rechazado" ||
    estadoClinica === "no apto"
  )
}

function esCancelado(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  return estado === "cancelado"
}

function esReprogramado(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  return estado === "reprogramado"
}

function esProgramado(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  return estado === "programado"
}

function esFallecido(registro: Registro) {
  const estado = normalizarTexto(registro.estado_cita)
  const estadoClinica = normalizarTexto(registro.estado_clinica)

  return (
    estado === "fallecido" ||
    estado === "fallecio" ||
    estadoClinica === "fallecido" ||
    estadoClinica === "fallecio"
  )
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function inicioMesISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function fechaSolo(valor?: string | null) {
  return valor ? valor.slice(0, 10) : ""
}

function fechaBaseGestion(registro: Registro) {
  if (esRealizadoGestion(registro) || esFallecido(registro)) {
    return fechaSolo(registro.fecha_cirugia_realizada) || registro.fecha_programada || ""
  }

  return registro.fecha_programada || ""
}

async function fetchAllRows<T>(
  table: string,
  selectClause: string,
  build?: (query: any) => any,
  pageSize = 1000
): Promise<T[]> {
  let from = 0
  let allRows: T[] = []

  while (true) {
    let query = supabase.from(table).select(selectClause)

    if (build) query = build(query)

    const { data, error } = await query.range(from, from + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as T[]
    allRows = allRows.concat(rows)

    if (rows.length < pageSize) break
    from += pageSize
  }

  return allRows
}

function descargarCSV(nombreArchivo: string, filas: Record<string, any>[]) {
  if (!filas.length) {
    alert("No hay datos para exportar.")
    return
  }

  const headers = Object.keys(filas[0])

  const escapar = (valor: any) => {
    const texto = String(valor ?? "")
    if (texto.includes('"') || texto.includes(",") || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`
    }
    return texto
  }

  const contenido = [
    headers.join(","),
    ...filas.map((fila) => headers.map((h) => escapar(fila[h])).join(",")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", nombreArchivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function InformesGestionPage() {
  const [cargando, setCargando] = useState(true)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])

  const [fechaInicio, setFechaInicio] = useState(inicioMesISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [especieFiltro, setEspecieFiltro] = useState("")
  const [sexoFiltro, setSexoFiltro] = useState("")
  const [tipoAnimalFiltro, setTipoAnimalFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")

  async function cargarDatos() {
    setCargando(true)

    try {
      const [registrosData, clinicasData] = await Promise.all([
        fetchAllRows<Registro>(
          "registros",
          "id,codigo,clinica_id,fecha_programada,fecha_cirugia_realizada,estado_cita,estado_clinica,especie,sexo,tipo_animal,nombre_animal,nombre_responsable"
        ),
        fetchAllRows<Clinica>(
          "clinicas",
          "id,nome",
          (q) => q.order("nome", { ascending: true })
        ),
      ])

      setRegistros(registrosData)
      setClinicas(clinicasData)
    } catch (error) {
      console.log("Error cargando informe de gestión:", error)
      alert("No se pudo cargar el informe de gestión.")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const mapaClinicas = useMemo(() => {
    const mapa: Record<string, string> = {}
    clinicas.forEach((c) => {
      mapa[c.id] = c.nome
    })
    return mapa
  }, [clinicas])

  const especiesDisponibles = useMemo(() => {
    const valores = Array.from(
      new Set(registros.map((r) => (r.especie || "").trim()).filter(Boolean))
    )
    return valores.sort((a, b) => a.localeCompare(b))
  }, [registros])

  const sexosDisponibles = useMemo(() => {
    const valores = Array.from(
      new Set(registros.map((r) => (r.sexo || "").trim()).filter(Boolean))
    )
    return valores.sort((a, b) => a.localeCompare(b))
  }, [registros])

  const tiposAnimalDisponibles = useMemo(() => {
    const valores = Array.from(
      new Set(registros.map((r) => (r.tipo_animal || "").trim()).filter(Boolean))
    )
    return valores.sort((a, b) => a.localeCompare(b))
  }, [registros])

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const fecha = fechaBaseGestion(r)
      if (!fecha) return false

      if (fechaInicio && fecha < fechaInicio) return false
      if (fechaFin && fecha > fechaFin) return false
      if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false

      if (
        especieFiltro &&
        (r.especie || "").trim().toLowerCase() !== especieFiltro.toLowerCase()
      ) {
        return false
      }

      if (
        sexoFiltro &&
        (r.sexo || "").trim().toLowerCase() !== sexoFiltro.toLowerCase()
      ) {
        return false
      }

      if (
        tipoAnimalFiltro &&
        (r.tipo_animal || "").trim().toLowerCase() !== tipoAnimalFiltro.toLowerCase()
      ) {
        return false
      }

      if (estadoFiltro) {
        if (estadoFiltro === "RECHAZADO") {
          if (!esRechazadoONoApto(r)) return false
        } else if (estadoFiltro === "REALIZADO") {
          if (!esRealizadoGestion(r)) return false
        } else if (estadoFiltro === "FALLECIO") {
          if (!esFallecido(r)) return false
        } else if (estadoFiltro === "CANCELADO") {
          if (!esCancelado(r)) return false
        } else if (estadoFiltro === "REPROGRAMADO") {
          if (!esReprogramado(r)) return false
        } else if (estadoFiltro === "PROGRAMADO") {
          if (!esProgramado(r)) return false
        }
      }

      return true
    })
  }, [
    registros,
    fechaInicio,
    fechaFin,
    clinicaFiltro,
    especieFiltro,
    sexoFiltro,
    tipoAnimalFiltro,
    estadoFiltro,
  ])

  const resumen = useMemo(() => {
    const realizados = registrosFiltrados.filter((r) => esRealizadoGestion(r)).length
    const programados = registrosFiltrados.filter((r) => esProgramado(r)).length
    const cancelados = registrosFiltrados.filter((r) => esCancelado(r)).length
    const reprogramados = registrosFiltrados.filter((r) => esReprogramado(r)).length
    const rechazados = registrosFiltrados.filter((r) => esRechazadoONoApto(r)).length
    const fallecidos = registrosFiltrados.filter((r) => esFallecido(r)).length

    const clinicasActivas = new Set(
      registrosFiltrados.map((r) => r.clinica_id).filter(Boolean)
    ).size

    return {
      realizados,
      programados,
      cancelados,
      reprogramados,
      rechazados,
      fallecidos,
      clinicasActivas,
      total: registrosFiltrados.length,
    }
  }, [registrosFiltrados])

  const porClinica = useMemo(() => {
    const conteo: Record<
      string,
      {
        clinica: string
        realizados: number
        programados: number
        cancelados: number
        reprogramados: number
        rechazados: number
        fallecidos: number
        total: number
      }
    > = {}

    registrosFiltrados.forEach((r) => {
      const nombre = r.clinica_id
        ? mapaClinicas[r.clinica_id] || "Sin clínica"
        : "Sin clínica"

      if (!conteo[nombre]) {
        conteo[nombre] = {
          clinica: nombre,
          realizados: 0,
          programados: 0,
          cancelados: 0,
          reprogramados: 0,
          rechazados: 0,
          fallecidos: 0,
          total: 0,
        }
      }

      conteo[nombre].total += 1

      if (esRealizadoGestion(r)) conteo[nombre].realizados += 1
      if (esProgramado(r)) conteo[nombre].programados += 1
      if (esCancelado(r)) conteo[nombre].cancelados += 1
      if (esReprogramado(r)) conteo[nombre].reprogramados += 1
      if (esRechazadoONoApto(r)) conteo[nombre].rechazados += 1
      if (esFallecido(r)) conteo[nombre].fallecidos += 1
    })

    return Object.values(conteo).sort((a, b) => b.realizados - a.realizados)
  }, [registrosFiltrados, mapaClinicas])

  const porDia = useMemo(() => {
    const conteo: Record<
      string,
      {
        fecha: string
        realizados: number
        programados: number
        cancelados: number
        reprogramados: number
        rechazados: number
        fallecidos: number
        total: number
      }
    > = {}

    registrosFiltrados.forEach((r) => {
      const fecha = fechaBaseGestion(r)
      if (!fecha) return

      if (!conteo[fecha]) {
        conteo[fecha] = {
          fecha,
          realizados: 0,
          programados: 0,
          cancelados: 0,
          reprogramados: 0,
          rechazados: 0,
          fallecidos: 0,
          total: 0,
        }
      }

      conteo[fecha].total += 1

      if (esRealizadoGestion(r)) conteo[fecha].realizados += 1
      if (esProgramado(r)) conteo[fecha].programados += 1
      if (esCancelado(r)) conteo[fecha].cancelados += 1
      if (esReprogramado(r)) conteo[fecha].reprogramados += 1
      if (esRechazadoONoApto(r)) conteo[fecha].rechazados += 1
      if (esFallecido(r)) conteo[fecha].fallecidos += 1
    })

    return Object.values(conteo).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [registrosFiltrados])

  const maximoGraficoDia = useMemo(() => {
    if (!porDia.length) return 1
    return Math.max(...porDia.map((d) => d.total), 1)
  }, [porDia])

  function limpiarFiltros() {
    setFechaInicio(inicioMesISO())
    setFechaFin(hoyISO())
    setClinicaFiltro("")
    setEspecieFiltro("")
    setSexoFiltro("")
    setTipoAnimalFiltro("")
    setEstadoFiltro("")
  }

  function exportarRegistrosCSV() {
    const filas = registrosFiltrados.map((r) => ({
      codigo: r.codigo || "",
      fecha_base: fechaBaseGestion(r),
      fecha_programada: r.fecha_programada || "",
      fecha_cirugia_realizada: fechaSolo(r.fecha_cirugia_realizada),
      clinica: r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica",
      estado: esRechazadoONoApto(r)
        ? "Rechazado / no apto"
        : esRealizadoGestion(r)
        ? "Realizado"
        : esFallecido(r)
        ? "Falleció"
        : labelEstado(r.estado_cita),
      especie: r.especie || "",
      sexo: r.sexo || "",
      tipo_animal: r.tipo_animal || "",
      nombre_animal: r.nombre_animal || "",
      nombre_responsable: r.nombre_responsable || "",
    }))

    descargarCSV("informe_gestion_registros.csv", filas)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando informe...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Gestión de cirugías
            </h1>
            <p className="text-white/80">
              Informe operativo de esterilizaciones
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={exportarRegistrosCSV}
              className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
            >
              Exportar CSV
            </button>

            <Link
              href="/admin/informes"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha inicial
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha final
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Clínica
              </label>
              <select
                value={clinicaFiltro}
                onChange={(e) => setClinicaFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas las clínicas</option>
                {clinicas.map((clinica) => (
                  <option key={clinica.id} value={clinica.id}>
                    {clinica.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="REALIZADO">Realizado</option>
                <option value="PROGRAMADO">Programado</option>
                <option value="CANCELADO">Cancelado</option>
                <option value="REPROGRAMADO">Reprogramado</option>
                <option value="RECHAZADO">Rechazado / no apto</option>
                <option value="FALLECIO">Falleció</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Especie
              </label>
              <select
                value={especieFiltro}
                onChange={(e) => setEspecieFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas</option>
                {especiesDisponibles.map((especie) => (
                  <option key={especie} value={especie}>
                    {especie}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sexo
              </label>
              <select
                value={sexoFiltro}
                onChange={(e) => setSexoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                {sexosDisponibles.map((sexo) => (
                  <option key={sexo} value={sexo}>
                    {sexo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de animal
              </label>
              <select
                value={tipoAnimalFiltro}
                onChange={(e) => setTipoAnimalFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                {tiposAnimalDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={limpiarFiltros}
                className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Realizadas</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {resumen.realizados}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Programadas</p>
            <p className="text-3xl font-bold text-yellow-500 mt-2">
              {resumen.programados}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Rechazadas / no aptas</p>
            <p className="text-3xl font-bold text-red-500 mt-2">
              {resumen.rechazados}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Reprogramadas</p>
            <p className="text-3xl font-bold text-blue-500 mt-2">
              {resumen.reprogramados}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Canceladas</p>
            <p className="text-3xl font-bold text-gray-700 mt-2">
              {resumen.cancelados}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Fallecidas</p>
            <p className="text-3xl font-bold text-black mt-2">
              {resumen.fallecidos}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Clínicas activas</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.clinicasActivas}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Total registros</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.total}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Evolución diaria
          </h2>

          <div className="space-y-3">
            {porDia.length > 0 ? (
              porDia.map((item, index) => {
                const largura = `${(item.total / maximoGraficoDia) * 100}%`
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">
                        {item.fecha}
                      </span>
                      <span className="text-gray-600">
                        {item.total} total / {item.realizados} realizadas
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-[#0F6D6A] h-4 rounded-full"
                        style={{ width: largura }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500">No hay datos para el período seleccionado.</p>
            )}
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Resumen por clínica
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Clínica</th>
                    <th className="py-2 pr-3">Real.</th>
                    <th className="py-2 pr-3">Prog.</th>
                    <th className="py-2 pr-3">Rech.</th>
                    <th className="py-2 pr-3">Reprog.</th>
                    <th className="py-2 pr-3">Canc.</th>
                    <th className="py-2 pr-3">Fall.</th>
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porClinica.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 pr-3 font-semibold">{item.clinica}</td>
                      <td className="py-2 pr-3">{item.realizados}</td>
                      <td className="py-2 pr-3">{item.programados}</td>
                      <td className="py-2 pr-3">{item.rechazados}</td>
                      <td className="py-2 pr-3">{item.reprogramados}</td>
                      <td className="py-2 pr-3">{item.cancelados}</td>
                      <td className="py-2 pr-3">{item.fallecidos}</td>
                      <td className="py-2 pr-3 font-bold">{item.total}</td>
                    </tr>
                  ))}

                  {porClinica.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-500">
                        No hay datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Resumen por día
            </h2>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Real.</th>
                    <th className="py-2 pr-3">Prog.</th>
                    <th className="py-2 pr-3">Rech.</th>
                    <th className="py-2 pr-3">Reprog.</th>
                    <th className="py-2 pr-3">Canc.</th>
                    <th className="py-2 pr-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porDia.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 pr-3 font-semibold">{item.fecha}</td>
                      <td className="py-2 pr-3">{item.realizados}</td>
                      <td className="py-2 pr-3">{item.programados}</td>
                      <td className="py-2 pr-3">{item.rechazados}</td>
                      <td className="py-2 pr-3">{item.reprogramados}</td>
                      <td className="py-2 pr-3">{item.cancelados}</td>
                      <td className="py-2 pr-3 font-bold">{item.total}</td>
                    </tr>
                  ))}

                  {porDia.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">
                        No hay datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}