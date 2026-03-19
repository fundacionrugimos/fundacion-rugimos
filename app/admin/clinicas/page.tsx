"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Clinica {
  id: string
  nome: string
  zona: string
  endereco: string
  telefono: string | null
  lat: number | null
  lng: number | null
  ativa: boolean
  usuario: string
  senha: string
  acepta_gatos: boolean
  acepta_perros: boolean
  acepta_machos: boolean
  acepta_hembras: boolean
  acepta_calle: boolean
  acepta_propio: boolean
  acepta_perras_calle: boolean
  dias_funcionamento: string[] | null
}

interface Horario {
  id: string
  hora: string
  cupos_maximos: number
  cupos_ocupados: number
  clinica_id: string
}

const DIAS_SEMANA = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
]

const ZONAS = [
  "Norte",
  "Sur",
  "Este",
  "Oeste",
  "Centro",
  "Centro-Norte",
  "Centro-Sur",
  "Plan 3000",
  "Pampa de la Isla",
]

function normalizarHoraParaGuardar(hora: string) {
  if (!hora) return ""
  return hora.length === 5 ? `${hora}:00` : hora
}

function normalizarHoraParaInput(hora: string) {
  if (!hora) return ""
  return hora.slice(0, 5)
}

export default function ClinicasPage() {
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedClinica, setSelectedClinica] = useState<Clinica | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filtroTexto, setFiltroTexto] = useState("")
  const [filtroZona, setFiltroZona] = useState("Todas")

  const [hora, setHora] = useState("")
  const [cupos, setCupos] = useState(10)

  async function fetchClinicas() {
    setLoading(true)

    const { data, error } = await supabase
      .from("clinicas")
      .select("*")
      .order("nome", { ascending: true })

    if (error) {
      console.error(error)
      alert("Error cargando clínicas")
      setLoading(false)
      return
    }

    setClinicas((data || []) as Clinica[])
    setLoading(false)
  }

  async function fetchHorarios(clinicaId: string) {
    const { data, error } = await supabase
      .from("horarios_clinica")
      .select("*")
      .eq("clinica_id", clinicaId)
      .order("hora", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setHorarios((data || []) as Horario[])
  }

  useEffect(() => {
    fetchClinicas()
  }, [])

  function abrirNuevaClinica() {
    setSelectedClinica(null)
    setHorarios([])
    setHora("")
    setCupos(10)
    setIsOpen(true)
  }

  async function abrirEditarClinica(clinica: Clinica) {
    setSelectedClinica(clinica)
    setHora("")
    setCupos(10)
    setIsOpen(true)
    await fetchHorarios(clinica.id)
  }

  function cerrarModal() {
    setIsOpen(false)
    setSelectedClinica(null)
    setHorarios([])
    setHora("")
    setCupos(10)
  }

  async function toggleClinica(id: string, ativa: boolean) {
    if (!confirm("¿Seguro que deseas cambiar el estado de esta clínica?")) return

    const { error } = await supabase
      .from("clinicas")
      .update({ ativa: !ativa })
      .eq("id", id)

    if (error) {
      console.error(error)
      alert("No se pudo actualizar el estado")
      return
    }

    setClinicas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ativa: !ativa } : c))
    )
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const dias = DIAS_SEMANA.filter((dia) =>
      formData.getAll("dias_funcionamento").includes(dia)
    )

    const data = {
      nome: String(formData.get("nome") || "").trim(),
      zona: String(formData.get("zona") || "").trim(),
      endereco: String(formData.get("endereco") || "").trim(),
      telefono: String(formData.get("telefono") || "").trim() || null,
      lat: String(formData.get("lat") || "").trim()
        ? Number(formData.get("lat"))
        : null,
      lng: String(formData.get("lng") || "").trim()
        ? Number(formData.get("lng"))
        : null,
      usuario: String(formData.get("usuario") || "").trim(),
      senha: String(formData.get("senha") || "").trim(),
      acepta_gatos: formData.get("acepta_gatos") === "on",
      acepta_perros: formData.get("acepta_perros") === "on",
      acepta_machos: formData.get("acepta_machos") === "on",
      acepta_hembras: formData.get("acepta_hembras") === "on",
      acepta_calle: formData.get("acepta_calle") === "on",
      acepta_propio: formData.get("acepta_propio") === "on",
      acepta_perras_calle: formData.get("acepta_perras_calle") === "on",
      dias_funcionamento: dias,
    }

    if (!data.nome || !data.zona) {
      alert("Nombre y zona son obligatorios.")
      setSaving(false)
      return
    }

    let error = null

    if (selectedClinica) {
      const res = await supabase
        .from("clinicas")
        .update(data)
        .eq("id", selectedClinica.id)

      error = res.error
    } else {
      const res = await supabase
        .from("clinicas")
        .insert([
          {
            ...data,
            ativa: true,
          },
        ])

      error = res.error
    }

    if (error) {
      console.error(error)
      alert("Error guardando clínica")
      setSaving(false)
      return
    }

    await fetchClinicas()
    setSaving(false)
    cerrarModal()
  }

  async function agregarHorario() {
    if (!selectedClinica) {
      alert("Primero guarda la clínica antes de añadir horarios.")
      return
    }

    if (!hora) {
      alert("Selecciona una hora.")
      return
    }

    if (!cupos || cupos < 1) {
      alert("Ingresa una cantidad válida de cupos.")
      return
    }

    const horaNormalizada = normalizarHoraParaGuardar(hora)

    const horaExistente = horarios.some((h) => h.hora === horaNormalizada)
    if (horaExistente) {
      alert("Ese horario ya existe para esta clínica.")
      return
    }

    const { error } = await supabase
      .from("horarios_clinica")
      .insert([
        {
          hora: horaNormalizada,
          cupos_maximos: cupos,
          cupos_ocupados: 0,
          clinica_id: selectedClinica.id,
        },
      ])

    if (error) {
      console.error(error)
      alert("No se pudo agregar el horario")
      return
    }

    await fetchHorarios(selectedClinica.id)
    setHora("")
    setCupos(10)
  }

  async function eliminarHorario(id: string) {
    if (!confirm("¿Eliminar este horario?")) return

    const { error } = await supabase
      .from("horarios_clinica")
      .delete()
      .eq("id", id)

    if (error) {
      console.error(error)
      alert("No se pudo eliminar el horario")
      return
    }

    if (selectedClinica) {
      await fetchHorarios(selectedClinica.id)
    }
  }

  async function actualizarHorario(id: string, nuevaHora: string, nuevoCupo: number) {
    if (!selectedClinica) return

    if (!nuevaHora) {
      alert("La hora es obligatoria.")
      return
    }

    if (nuevoCupo < 0) {
      alert("El cupo no puede ser negativo.")
      return
    }

    const horaNormalizada = normalizarHoraParaGuardar(nuevaHora)

    const horarioDuplicado = horarios.some(
      (h) => h.id !== id && h.hora === horaNormalizada
    )

    if (horarioDuplicado) {
      alert("Ya existe otro horario con esa misma hora en esta clínica.")
      return
    }

    const { error } = await supabase
      .from("horarios_clinica")
      .update({
        hora: horaNormalizada,
        cupos_maximos: nuevoCupo,
      })
      .eq("id", id)

    if (error) {
      console.error(error)
      alert("No se pudo actualizar el horario.")
      return
    }

    setHorarios((prev) =>
      prev
        .map((h) =>
          h.id === id
            ? { ...h, hora: horaNormalizada, cupos_maximos: nuevoCupo }
            : h
        )
        .sort((a, b) => a.hora.localeCompare(b.hora))
    )
  }

  const clinicasFiltradas = useMemo(() => {
    return clinicas.filter((clinica) => {
      const texto = filtroTexto.toLowerCase().trim()

      const coincideTexto =
        !texto ||
        clinica.nome?.toLowerCase().includes(texto) ||
        clinica.zona?.toLowerCase().includes(texto) ||
        clinica.endereco?.toLowerCase().includes(texto) ||
        clinica.usuario?.toLowerCase().includes(texto)

      const coincideZona = filtroZona === "Todas" || clinica.zona === filtroZona

      return coincideTexto && coincideZona
    })
  }, [clinicas, filtroTexto, filtroZona])

  return (
    <main className="min-h-screen bg-[#026A6A] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Gestión de Clínicas 🏥
            </h1>
            <p className="text-white/80 mt-2">
              Administra datos, restricciones, días y horarios de cada clínica.
            </p>
          </div>

          <button
            onClick={abrirNuevaClinica}
            className="bg-[#F47C2A] hover:opacity-90 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
          >
            + Nueva Clínica
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 md:p-5 mb-8 flex flex-col md:flex-row gap-4 md:items-center">
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por nombre, zona, dirección o usuario..."
            className="flex-1 border border-gray-200 p-3 rounded-2xl text-gray-800 outline-none"
          />

          <select
            value={filtroZona}
            onChange={(e) => setFiltroZona(e.target.value)}
            className="border border-gray-200 p-3 rounded-2xl text-gray-800"
          >
            <option value="Todas">Todas las zonas</option>
            {ZONAS.map((zona) => (
              <option key={zona} value={zona}>
                {zona}
              </option>
            ))}
          </select>

          <div className="text-sm font-semibold text-gray-600">
            Total: {clinicasFiltradas.length}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center text-gray-500">
            Cargando clínicas...
          </div>
        ) : clinicasFiltradas.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center text-gray-500">
            No se encontraron clínicas.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {clinicasFiltradas.map((clinica) => (
              <div
                key={clinica.id}
                className="bg-white rounded-3xl shadow-xl p-6 border border-white hover:scale-[1.01] transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#026A6A]">
                      {clinica.nome || "Sin nombre"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Zona: {clinica.zona || "No definida"}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {clinica.endereco || "Sin dirección"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Tel: {clinica.telefono || "No disponible"}
                    </p>
                  </div>

                  <span
                    className={`px-4 py-2 rounded-full text-sm font-bold w-fit ${
                      clinica.ativa
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {clinica.ativa ? "Activa" : "Inactiva"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                      Login
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Usuario:</span> {clinica.usuario || "-"}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Contraseña:</span> {clinica.senha || "-"}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                      Ubicación
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Lat:</span> {clinica.lat ?? "-"}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Lng:</span> {clinica.lng ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Días de funcionamiento
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {(clinica.dias_funcionamento || []).length > 0 ? (
                      clinica.dias_funcionamento?.map((dia) => (
                        <span
                          key={dia}
                          className="px-3 py-1 rounded-full bg-[#026A6A]/10 text-[#026A6A] text-sm font-medium"
                        >
                          {dia}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No configurado</span>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Restricciones
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {[
                      ["Gatos", clinica.acepta_gatos],
                      ["Perros", clinica.acepta_perros],
                      ["Machos", clinica.acepta_machos],
                      ["Hembras", clinica.acepta_hembras],
                      ["Calle", clinica.acepta_calle],
                      ["Propio", clinica.acepta_propio],
                      ["Perras calle", clinica.acepta_perras_calle],
                    ].map(([label, activo]) => (
                      <span
                        key={String(label)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          activo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {activo ? "✔ " : "✖ "} {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => abrirEditarClinica(clinica)}
                    className="px-5 py-3 bg-[#026A6A] text-white rounded-2xl font-semibold hover:opacity-90"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => toggleClinica(clinica.id, clinica.ativa)}
                    className={`px-5 py-3 rounded-2xl font-semibold text-white ${
                      clinica.ativa ? "bg-red-500" : "bg-green-600"
                    }`}
                  >
                    {clinica.ativa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 md:p-6"
            onClick={cerrarModal}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 rounded-t-3xl z-10 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#026A6A]">
                    {selectedClinica ? "Editar Clínica" : "Nueva Clínica"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Configura toda la información de la clínica en un solo lugar.
                  </p>
                </div>

                <button
                  onClick={cerrarModal}
                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 md:p-8 space-y-8">
                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Información general
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Nombre
                      </label>
                      <input
                        name="nome"
                        defaultValue={selectedClinica?.nome || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="Ej: Clínica Clacipet"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Zona
                      </label>
                      <select
                        name="zona"
                        defaultValue={selectedClinica?.zona || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                      >
                        <option value="">Seleccionar zona</option>
                        {ZONAS.map((zona) => (
                          <option key={zona} value={zona}>
                            {zona}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Dirección
                      </label>
                      <input
                        name="endereco"
                        defaultValue={selectedClinica?.endereco || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="Dirección completa"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Teléfono
                      </label>
                      <input
                        name="telefono"
                        defaultValue={selectedClinica?.telefono || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="Ej: 75304756"
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 w-full">
                        <p className="text-sm text-gray-500">Estado actual</p>
                        <p
                          className={`font-bold mt-1 ${
                            selectedClinica?.ativa ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {selectedClinica
                            ? selectedClinica.ativa
                              ? "Activa"
                              : "Inactiva"
                            : "Se creará como activa"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Ubicación GPS
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Latitud
                      </label>
                      <input
                        name="lat"
                        type="number"
                        step="any"
                        defaultValue={selectedClinica?.lat ?? ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="-17.78"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Longitud
                      </label>
                      <input
                        name="lng"
                        type="number"
                        step="any"
                        defaultValue={selectedClinica?.lng ?? ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="-63.18"
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Acceso de la clínica
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Usuario
                      </label>
                      <input
                        name="usuario"
                        defaultValue={selectedClinica?.usuario || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="Usuario de login"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Contraseña
                      </label>
                      <input
                        name="senha"
                        defaultValue={selectedClinica?.senha || ""}
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                        placeholder="Contraseña de login"
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Restricciones
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ["acepta_gatos", "Gatos", selectedClinica?.acepta_gatos],
                      ["acepta_perros", "Perros", selectedClinica?.acepta_perros],
                      ["acepta_machos", "Machos", selectedClinica?.acepta_machos],
                      ["acepta_hembras", "Hembras", selectedClinica?.acepta_hembras],
                      ["acepta_calle", "Calle", selectedClinica?.acepta_calle],
                      ["acepta_propio", "Propio", selectedClinica?.acepta_propio],
                      ["acepta_perras_calle", "Perras de la calle", selectedClinica?.acepta_perras_calle],
                    ].map(([name, label, checked]) => (
                      <label
                        key={String(name)}
                        className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          name={String(name)}
                          defaultChecked={Boolean(checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Días de funcionamiento
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {DIAS_SEMANA.map((dia) => (
                      <label
                        key={dia}
                        className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 cursor-pointer justify-center"
                      >
                        <input
                          type="checkbox"
                          name="dias_funcionamento"
                          value={dia}
                          defaultChecked={selectedClinica?.dias_funcionamento?.includes(dia)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {dia}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#026A6A]">
                        Horarios y cupos
                      </h3>
                      <p className="text-sm text-gray-500">
                        Agrega horarios y define cuántos cupos acepta en cada uno.
                      </p>
                    </div>
                  </div>

                  {selectedClinica ? (
                    <>
                      <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <input
                          type="time"
                          value={hora}
                          onChange={(e) => setHora(e.target.value)}
                          className="border border-gray-200 p-3 rounded-2xl"
                        />

                        <input
                          type="number"
                          min={1}
                          value={cupos}
                          onChange={(e) => setCupos(Number(e.target.value))}
                          className="border border-gray-200 p-3 rounded-2xl w-full sm:w-32"
                        />

                        <button
                          type="button"
                          onClick={agregarHorario}
                          className="bg-[#F47C2A] text-white px-5 py-3 rounded-2xl font-semibold hover:opacity-90"
                        >
                          + Añadir horario
                        </button>
                      </div>

                      <div className="space-y-3">
                        {horarios.length === 0 ? (
                          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 text-sm text-gray-400 text-center">
                            Esta clínica aún no tiene horarios configurados.
                          </div>
                        ) : (
                          horarios.map((h) => (
                            <div
                              key={h.id}
                              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Ocupados: {h.cupos_ocupados} / {h.cupos_maximos}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                                  <div className="flex flex-col">
                                    <label className="text-sm text-gray-600 font-medium mb-1">
                                      Hora
                                    </label>
                                    <input
                                      type="time"
                                      value={normalizarHoraParaInput(h.hora)}
                                      onChange={(e) =>
                                        setHorarios((prev) =>
                                          prev.map((item) =>
                                            item.id === h.id
                                              ? {
                                                  ...item,
                                                  hora: normalizarHoraParaGuardar(e.target.value),
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      className="border border-gray-200 p-2 rounded-xl"
                                    />
                                  </div>

                                  <div className="flex flex-col">
                                    <label className="text-sm text-gray-600 font-medium mb-1">
                                      Cupos
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={h.cupos_maximos}
                                      onChange={(e) =>
                                        setHorarios((prev) =>
                                          prev.map((item) =>
                                            item.id === h.id
                                              ? {
                                                  ...item,
                                                  cupos_maximos: Number(e.target.value),
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      className="border border-gray-200 p-2 rounded-xl w-full"
                                    />
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        actualizarHorario(h.id, h.hora, h.cupos_maximos)
                                      }
                                      className="px-4 py-2 bg-[#026A6A] text-white rounded-xl font-semibold"
                                    >
                                      Guardar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => eliminarHorario(h.id)}
                                      className="px-4 py-2 bg-red-500 text-white rounded-xl font-semibold"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
                      Guarda primero la nueva clínica para después añadir horarios.
                    </div>
                  )}
                </section>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="bg-gray-200 text-gray-800 px-5 py-3 rounded-2xl font-semibold"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#F47C2A] text-white px-6 py-3 rounded-2xl font-semibold disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}