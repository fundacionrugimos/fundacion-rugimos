"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

type Registro = {
  id: string
  codigo: string
  nombre_animal: string
  especie: string
  sexo: string
  tipo_animal: string
  hora: string | null
  fecha_programada: string | null
  estado_clinica: string | null
  clinica_id: string | null
}

type Clinica = {
  id: string
  nome: string
}

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function normalizarEstado(estado: string | null | undefined) {
  return (estado || "Pendiente")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
}

export default function AdminCitasPage() {
  const [fecha, setFecha] = useState(getLocalDateString())
  const [clinicaFiltro, setClinicaFiltro] = useState("todas")
  const [registros, setRegistros] = useState<Registro[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarClinicas()
  }, [])

  useEffect(() => {
    cargarCitas()
  }, [fecha])

  async function cargarClinicas() {
    const { data, error } = await supabase
      .from("clinicas")
      .select("id,nome")
      .order("nome", { ascending: true })

    if (error) {
      console.log(error)
      return
    }

    setClinicas(data || [])
  }

  async function cargarCitas() {
    setLoading(true)

    const { data, error } = await supabase
      .from("registros")
      .select("id,codigo,nombre_animal,especie,sexo,tipo_animal,hora,fecha_programada,estado_clinica,clinica_id")
      .eq("fecha_programada", fecha)
      .order("hora", { ascending: true })

    if (error) {
      console.log(error)
      setLoading(false)
      return
    }

    setRegistros(data || [])
    setLoading(false)
  }

  const clinicasMap = useMemo(() => {
    const map: Record<string, string> = {}
    clinicas.forEach((c) => {
      map[c.id] = c.nome
    })
    return map
  }, [clinicas])

  const registrosFiltrados = useMemo(() => {
    if (clinicaFiltro === "todas") return registros
    return registros.filter((r) => r.clinica_id === clinicaFiltro)
  }, [registros, clinicaFiltro])

  const resumen = useMemo(() => {
    let pendientes = 0
    let aptos = 0
    let noAptos = 0
    let reprogramados = 0

    registrosFiltrados.forEach((r) => {
      const estado = normalizarEstado(r.estado_clinica)

      if (estado === "PENDIENTE") pendientes++
      else if (estado === "APTO") aptos++
      else if (estado === "NO APTO" || estado === "RECHAZADO") noAptos++
      else if (estado === "REPROGRAMADO") reprogramados++
    })

    return {
      total: registrosFiltrados.length,
      pendientes,
      aptos,
      noAptos,
      reprogramados,
    }
  }, [registrosFiltrados])

  const agrupado = useMemo(() => {
    const grupos: Record<string, Registro[]> = {}

    registrosFiltrados.forEach((r) => {
      const clinicaNombre = r.clinica_id
        ? (clinicasMap[r.clinica_id] || "Clínica sin nombre")
        : "Sin clínica"

      const hora = r.hora || "Sin hora"
      const key = `${clinicaNombre}___${hora}`

      if (!grupos[key]) grupos[key] = []
      grupos[key].push(r)
    })

    return Object.entries(grupos).sort((a, b) => {
      const horaA = a[0].split("___")[1]
      const horaB = b[0].split("___")[1]
      return horaA.localeCompare(horaB)
    })
  }, [registrosFiltrados, clinicasMap])

  function colorEstado(estado: string | null) {
    const e = normalizarEstado(estado)

    if (e === "APTO") return "bg-green-100 text-green-700"
    if (e === "NO APTO" || e === "RECHAZADO") return "bg-red-100 text-red-700"
    if (e === "REPROGRAMADO") return "bg-yellow-100 text-yellow-800"
    return "bg-gray-100 text-gray-700"
  }

  return (
    <div className="min-h-screen bg-[#02686A] px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🗓️ Citas</h1>
            <p className="text-white/80 mt-2">Programación diaria por clínica</p>
          </div>

          <Link
            href="/admin"
            className="bg-white text-[#02686A] px-5 py-3 rounded-xl font-semibold shadow hover:opacity-90 w-fit"
          >
            ← Volver al dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#02686A]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Clínica
            </label>
            <select
              value={clinicaFiltro}
              onChange={(e) => setClinicaFiltro(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#02686A]"
            >
              <option value="todas">Todas</option>
              {clinicas.map((clinica) => (
                <option key={clinica.id} value={clinica.id}>
                  {clinica.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-3xl font-bold text-[#02686A]">{resumen.total}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Pendientes</p>
            <p className="text-3xl font-bold text-gray-700">{resumen.pendientes}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Aptos</p>
            <p className="text-3xl font-bold text-green-600">{resumen.aptos}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">No aptos</p>
            <p className="text-3xl font-bold text-red-600">{resumen.noAptos}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Reprogramados</p>
            <p className="text-3xl font-bold text-yellow-600">{resumen.reprogramados}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center text-gray-600">
            Cargando citas...
          </div>
        ) : agrupado.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center text-gray-600">
            No hay citas registradas para esta fecha.
          </div>
        ) : (
          <div className="space-y-6">
            {agrupado.map(([key, items]) => {
              const [clinicaNombre, hora] = key.split("___")

              return (
                <div key={key} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                  <div className="bg-[#F47C3C] text-white px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <h2 className="text-xl font-bold">{clinicaNombre}</h2>
                    <span className="font-semibold">Horario: {hora}</span>
                  </div>

                  <div className="p-6 overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-3">Código</th>
                          <th className="pb-3">Animal</th>
                          <th className="pb-3">Especie</th>
                          <th className="pb-3">Sexo</th>
                          <th className="pb-3">Tipo</th>
                          <th className="pb-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b last:border-b-0">
                            <td className="py-4 font-semibold text-[#02686A]">{item.codigo}</td>
                            <td className="py-4">{item.nombre_animal || "Sin nombre"}</td>
                            <td className="py-4">{item.especie || "-"}</td>
                            <td className="py-4">{item.sexo || "-"}</td>
                            <td className="py-4">{item.tipo_animal || "-"}</td>
                            <td className="py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${colorEstado(
                                  item.estado_clinica
                                )}`}
                              >
                                {item.estado_clinica || "Pendiente"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}