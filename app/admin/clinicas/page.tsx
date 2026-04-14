"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import ModalHorariosVoluntariado from "@/components/admin/ModalHorariosVoluntariado"

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

interface CupoHorarioDiaSemana {
  id: string
  clinica_id: string
  horario_id: string
  dia_semana: number
  cupos: number
  activo: boolean
}

interface CupoHorarioFechaEspecifica {
  id: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  activo: boolean
}

interface CupoHorarioFechaEspecifica {
  id: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  activo: boolean
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

const DIAS_SEMANA_CONFIG = [
  { numero: 1, label: "Lun" },
  { numero: 2, label: "Mar" },
  { numero: 3, label: "Mié" },
  { numero: 4, label: "Jue" },
  { numero: 5, label: "Vie" },
  { numero: 6, label: "Sáb" },
  { numero: 0, label: "Dom" },
]

function normalizarHoraParaGuardar(hora: string) {
  if (!hora) return ""
  return hora.length === 5 ? `${hora}:00` : hora
}

function normalizarHoraParaInput(hora: string) {
  if (!hora) return ""
  return hora.slice(0, 5)
}

function getHoyLocal() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().split("T")[0]
}

function getDiaSemanaDesdeFecha(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number)
  return new Date(year, month - 1, day).getDay()
}

function normalizarFechaLocal(fecha: string) {
  if (!fecha) return ""
  return fecha
}

function FechaEspecialEditor({
  horarioId,
  cupoBase,
  valores,
  onChange,
  onDelete,
}: {
  horarioId: string
  cupoBase: number
  valores: Record<string, string>
  onChange: (horarioId: string, fecha: string, valor: string) => void
  onDelete: (horarioId: string, fecha: string) => void
}) {
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevoCupo, setNuevoCupo] = useState("")

  const fechasOrdenadas = Object.keys(valores).sort((a, b) => a.localeCompare(b))

  function agregar() {
    if (!nuevaFecha) {
      alert("Selecciona una fecha.")
      return
    }

    if (nuevoCupo === "") {
      alert("Ingresa el cupo para esa fecha.")
      return
    }

    const numero = Number(nuevoCupo)

    if (Number.isNaN(numero) || numero < 0) {
      alert("El cupo debe ser un número válido.")
      return
    }

    onChange(horarioId, nuevaFecha, String(numero))
    setNuevaFecha("")
    setNuevoCupo("")
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
        <input
          type="date"
          value={nuevaFecha}
          onChange={(e) => setNuevaFecha(e.target.value)}
          className="border border-gray-200 p-3 rounded-2xl w-full"
        />

        <input
          type="number"
          min={0}
          value={nuevoCupo}
          onChange={(e) => setNuevoCupo(e.target.value)}
          placeholder={String(cupoBase)}
          className="border border-gray-200 p-3 rounded-2xl w-full"
        />

        <button
          type="button"
          onClick={agregar}
          className="px-4 py-3 bg-[#F28C38] text-white rounded-2xl font-semibold"
        >
          Añadir fecha
        </button>
      </div>

      {fechasOrdenadas.length > 0 && (
        <div className="space-y-2">
          {fechasOrdenadas.map((fecha) => (
            <div
              key={`${horarioId}-${fecha}`}
              className="flex flex-col md:flex-row md:items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl p-3"
            >
              <div className="font-medium text-gray-700 min-w-[160px]">{fecha}</div>

              <input
                type="number"
                min={0}
                value={valores[fecha]}
                onChange={(e) => onChange(horarioId, fecha, e.target.value)}
                className="border border-gray-200 p-2 rounded-xl w-full md:w-[140px]"
              />

              <button
                type="button"
                onClick={() => onDelete(horarioId, fecha)}
                className="px-3 py-2 bg-red-500 text-white rounded-xl font-semibold"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        La fecha específica tiene prioridad sobre el cupo por día de la semana.
      </p>
    </div>
  )
}

export default function ClinicasPage() {
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedClinica, setSelectedClinica] = useState<Clinica | null>(null)
  const [modalVoluntariadoOpen, setModalVoluntariadoOpen] = useState(false)
  const [clinicaVoluntariado, setClinicaVoluntariado] = useState<Clinica | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filtroTexto, setFiltroTexto] = useState("")
  const [filtroZona, setFiltroZona] = useState("Todas")
  const [nombrePublicoZona, setNombrePublicoZona] = useState("")
  const [zonas, setZonas] = useState<string[]>([])
  const [crearNuevaZona, setCrearNuevaZona] = useState(false)
  const [nuevaZona, setNuevaZona] = useState("")

  const [hora, setHora] = useState("")
  const [cupos, setCupos] = useState(10)

  const [cuposEspecialesPorHorario, setCuposEspecialesPorHorario] = useState<
    Record<string, Record<number, string>>
  >({})

  const [cuposEspecialesPorFecha, setCuposEspecialesPorFecha] = useState<
    Record<string, Record<string, string>>
  >({})

  async function fetchZonas() {
  try {
    const res = await fetch("/api/admin/clinicas")
    const json = await res.json()

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Error cargando zonas")
    }

    setZonas(json.data?.zonas || [])
  } catch (error) {
    console.error(error)
  }
}

  async function fetchClinicas() {
  setLoading(true)

  try {
    const res = await fetch("/api/admin/clinicas")
    const json = await res.json()

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Error cargando clínicas")
    }

    setClinicas((json.data?.clinicas || []) as Clinica[])
  } catch (error) {
    console.error(error)
    alert("Error cargando clínicas")
  } finally {
    setLoading(false)
  }
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

  async function fetchCuposEspeciales(clinicaId: string) {
    const { data, error } = await supabase
      .from("cupos_horario_dia_semana")
      .select("*")
      .eq("clinica_id", clinicaId)

    if (error) {
      console.error("Error cargando cupos especiales:", error)
      return
    }

    const mapa: Record<string, Record<number, string>> = {}

    ;((data || []) as CupoHorarioDiaSemana[]).forEach((item) => {
      if (!item.activo) return

      if (!mapa[item.horario_id]) {
        mapa[item.horario_id] = {}
      }

      mapa[item.horario_id][item.dia_semana] = String(item.cupos)
    })

    setCuposEspecialesPorHorario(mapa)
  }

  async function fetchCuposEspecialesPorFecha(clinicaId: string) {
    const { data, error } = await supabase
      .from("cupos_horario_fecha_especifica")
      .select("*")
      .eq("clinica_id", clinicaId)

    if (error) {
      console.error("Error cargando cupos especiales por fecha:", error)
      return
    }

    const mapa: Record<string, Record<string, string>> = {}

    ;((data || []) as CupoHorarioFechaEspecifica[]).forEach((item) => {
      if (!item.activo) return

      if (!mapa[item.horario_id]) {
        mapa[item.horario_id] = {}
      }

      mapa[item.horario_id][item.fecha] = String(item.cupos)
    })

    setCuposEspecialesPorFecha(mapa)
  }

  useEffect(() => {
    fetchClinicas()
    fetchZonas()
  }, [])

  function abrirNuevaClinica() {
    setSelectedClinica(null)
    setHorarios([])
    setHora("")
    setCupos(10)
    setCrearNuevaZona(false)
    setNuevaZona("")
    setNombrePublicoZona("")
    setCuposEspecialesPorHorario({})
    setCuposEspecialesPorFecha({})
    setIsOpen(true)
  }

  async function abrirEditarClinica(clinica: Clinica) {
    setSelectedClinica(clinica)
    setHora("")
    setCupos(10)
    setCrearNuevaZona(false)
    setNuevaZona("")
    setNombrePublicoZona("")
    setCuposEspecialesPorHorario({})
    setCuposEspecialesPorFecha({})

    try {
  const res = await fetch(`/api/admin/zonas/${encodeURIComponent(clinica.zona || "")}`)
  const json = await res.json()

  if (res.ok && json?.ok) {
    setNombrePublicoZona(String(json.data?.nombre_publico || clinica.zona || ""))
  } else {
    setNombrePublicoZona(String(clinica.zona || ""))
  }
} catch {
  setNombrePublicoZona(String(clinica.zona || ""))
}

    setIsOpen(true)

    await Promise.all([
      fetchHorarios(clinica.id),
      fetchCuposEspeciales(clinica.id),
      fetchCuposEspecialesPorFecha(clinica.id),
    ])
  }

  function cerrarModal() {
    setIsOpen(false)
    setSelectedClinica(null)
    setHorarios([])
    setHora("")
    setCupos(10)
    setCrearNuevaZona(false)
    setNuevaZona("")
    setNombrePublicoZona("")
    setCuposEspecialesPorHorario({})
    setCuposEspecialesPorFecha({})
  }

  function abrirModalVoluntariado(clinica: Clinica) {
  setClinicaVoluntariado(clinica)
  setModalVoluntariadoOpen(true)
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

  async function sincronizarAlmacenClinica(clinicaId: string, nomeClinica: string) {
    const nombreAlmacen = `Almacén - ${nomeClinica}`

    const { data: almacenExistente, error: errorBusca } = await supabase
      .from("almacenes")
      .select("id, nombre")
      .eq("clinica_id", clinicaId)
      .maybeSingle()

    if (errorBusca) {
      console.error("Error buscando almacén:", errorBusca)
      return
    }

    if (!almacenExistente) {
      const { error: errorCrear } = await supabase
        .from("almacenes")
        .insert({
          nombre: nombreAlmacen,
          tipo: "clinica",
          clinica_id: clinicaId,
          activo: true,
        })

      if (errorCrear) {
        console.error("Error creando almacén:", errorCrear)
      }
    } else if (almacenExistente.nombre !== nombreAlmacen) {
      const { error: errorActualizar } = await supabase
        .from("almacenes")
        .update({ nombre: nombreAlmacen })
        .eq("id", almacenExistente.id)

      if (errorActualizar) {
        console.error("Error actualizando nombre del almacén:", errorActualizar)
      }
    }
  }

  function getCupoEspecialTexto(horarioId: string, diaSemana: number) {
    return cuposEspecialesPorHorario[horarioId]?.[diaSemana] ?? ""
  }

  function setCupoEspecialTexto(
    horarioId: string,
    diaSemana: number,
    valor: string
  ) {
    setCuposEspecialesPorHorario((prev) => ({
      ...prev,
      [horarioId]: {
        ...(prev[horarioId] || {}),
        [diaSemana]: valor,
      },
    }))
  }

  function getCupoEspecialFechaTexto(horarioId: string, fecha: string) {
    return cuposEspecialesPorFecha[horarioId]?.[fecha] ?? ""
  }

  function setCupoEspecialFechaTexto(
    horarioId: string,
    fecha: string,
    valor: string
  ) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    setCuposEspecialesPorFecha((prev) => ({
      ...prev,
      [horarioId]: {
        ...(prev[horarioId] || {}),
        [fechaNormalizada]: valor,
      },
    }))
  }

  function eliminarCupoEspecialFechaTexto(horarioId: string, fecha: string) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    setCuposEspecialesPorFecha((prev) => {
      const horarioActual = { ...(prev[horarioId] || {}) }
      delete horarioActual[fechaNormalizada]

      const nuevo = { ...prev }

      if (Object.keys(horarioActual).length === 0) {
        delete nuevo[horarioId]
      } else {
        nuevo[horarioId] = horarioActual
      }

      return nuevo
    })
  }

  function obtenerCupoAplicablePorFecha(
    fecha: string,
    cupoBase: number,
    cuposEspecialesHorario: Record<number, string> | undefined,
    cuposEspecialesFechaHorario?: Record<string, string>
  ) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    const valorFecha = cuposEspecialesFechaHorario?.[fechaNormalizada]
    if (valorFecha !== undefined && valorFecha !== null && valorFecha !== "") {
      const numeroFecha = Number(valorFecha)

      if (!Number.isNaN(numeroFecha) && numeroFecha >= 0) {
        return numeroFecha
      }
    }

    const diaSemana = getDiaSemanaDesdeFecha(fechaNormalizada)
    const valorEspecial = cuposEspecialesHorario?.[diaSemana]

    if (valorEspecial === undefined || valorEspecial === null || valorEspecial === "") {
      return cupoBase
    }

    const numero = Number(valorEspecial)

    if (Number.isNaN(numero) || numero < 0) {
      return cupoBase
    }

    return numero
  }

  async function guardarCuposEspecialesHorario(
    clinicaId: string,
    horarioId: string,
    cupoBase: number
  ) {
    const configuracionHorario = cuposEspecialesPorHorario[horarioId] || {}

    const filas = Object.entries(configuracionHorario)
      .filter(([_, valor]) => valor !== "")
      .map(([diaSemana, valor]) => ({
        clinica_id: clinicaId,
        horario_id: horarioId,
        dia_semana: Number(diaSemana),
        cupos: Number(valor),
        activo: true,
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.cupos) &&
          item.cupos >= 0 &&
          item.cupos !== cupoBase
      )

    const diasMantener = filas.map((fila) => fila.dia_semana)

    let deleteQuery = supabase
      .from("cupos_horario_dia_semana")
      .delete()
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)

    if (diasMantener.length > 0) {
      deleteQuery = deleteQuery.not("dia_semana", "in", `(${diasMantener.join(",")})`)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error("Error eliminando cupos especiales viejos:", deleteError)
      throw deleteError
    }

    if (filas.length > 0) {
      const { error: upsertError } = await supabase
        .from("cupos_horario_dia_semana")
        .upsert(filas, {
          onConflict: "clinica_id,horario_id,dia_semana",
        })

      if (upsertError) {
        console.error("Error guardando cupos especiales:", upsertError)
        throw upsertError
      }
    }
  }

  async function guardarCuposEspecialesFechaHorario(
    clinicaId: string,
    horarioId: string,
    cupoBase: number
  ) {
    const configuracionHorario = cuposEspecialesPorFecha[horarioId] || {}

    const filas = Object.entries(configuracionHorario)
      .filter(([fecha, valor]) => fecha && valor !== "")
      .map(([fecha, valor]) => ({
        clinica_id: clinicaId,
        horario_id: horarioId,
        fecha: normalizarFechaLocal(fecha),
        cupos: Number(valor),
        activo: true,
      }))
      .filter(
        (item) =>
          !Number.isNaN(item.cupos) &&
          item.cupos >= 0 &&
          item.cupos !== cupoBase
      )

    const fechasMantener = filas.map((fila) => `'${fila.fecha}'`)

    let deleteQuery = supabase
      .from("cupos_horario_fecha_especifica")
      .delete()
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)

    if (fechasMantener.length > 0) {
      deleteQuery = deleteQuery.not("fecha", "in", `(${fechasMantener.join(",")})`)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error("Error eliminando fechas especiales viejas:", deleteError)
      throw deleteError
    }

    if (filas.length > 0) {
      const { error: upsertError } = await supabase
        .from("cupos_horario_fecha_especifica")
        .upsert(filas, {
          onConflict: "clinica_id,horario_id,fecha",
        })

      if (upsertError) {
        console.error("Error guardando fechas especiales:", upsertError)
        throw upsertError
      }
    }
  }

  async function sincronizarCuposDiariosFuturos(
    clinicaId: string,
    horarioId: string,
    cupoBase: number
  ) {
    const hoy = getHoyLocal()
    const cuposEspecialesHorario = cuposEspecialesPorHorario[horarioId] || {}
    const cuposEspecialesFechaHorario = cuposEspecialesPorFecha[horarioId] || {}

    const { data: cuposDiarios, error: fetchError } = await supabase
      .from("cupos_diarios")
      .select("id, fecha, cupos, ocupados")
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)
      .gte("fecha", hoy)

    if (fetchError) {
      console.error("Error buscando cupos diarios futuros:", fetchError)
      throw fetchError
    }

    for (const item of cuposDiarios || []) {
      const cupoCorrecto = obtenerCupoAplicablePorFecha(
        item.fecha,
        cupoBase,
        cuposEspecialesHorario,
        cuposEspecialesFechaHorario
      )

      const ocupadosActuales = Number(item.ocupados || 0)
      const cupoFinal = Math.max(cupoCorrecto, ocupadosActuales)

      if (Number(item.cupos) !== cupoFinal) {
        const { error: updateError } = await supabase
          .from("cupos_diarios")
          .update({ cupos: cupoFinal })
          .eq("id", item.id)

        if (updateError) {
          console.error("Error actualizando cupo diario:", updateError)
          throw updateError
        }
      }
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const dias = DIAS_SEMANA.filter((dia) =>
      formData.getAll("dias_funcionamento").includes(dia)
    )

    const zonaSeleccionada = String(formData.get("zona") || "").trim()
    const zonaNueva = nuevaZona.trim()
    const zonaFinal = crearNuevaZona ? zonaNueva : zonaSeleccionada

    const nombrePublicoFinal =
      crearNuevaZona
        ? nombrePublicoZona.trim() || zonaFinal
        : nombrePublicoZona.trim() || zonaFinal

    const data = {
      nome: String(formData.get("nome") || "").trim(),
      zona: zonaFinal,
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

    try {
      const { data: zonaExistente, error: zonaError } = await supabase
        .from("zonas")
        .select("id")
        .eq("nombre", data.zona)
        .maybeSingle()

      if (zonaError) {
        console.error(zonaError)
        alert("No se pudo verificar la zona.")
        setSaving(false)
        return
      }

      if (!zonaExistente) {
        const { error: crearZonaError } = await supabase
          .from("zonas")
          .insert([
            {
              nombre: data.zona,
              nombre_publico: nombrePublicoFinal,
              activa: true,
            },
          ])

        if (crearZonaError) {
          console.error(crearZonaError)
          alert("No se pudo crear la nueva zona.")
          setSaving(false)
          return
        }
      } else {
        const { error: actualizarZonaError } = await supabase
          .from("zonas")
          .update({
            nombre_publico: nombrePublicoFinal,
          })
          .eq("nombre", data.zona)

        if (actualizarZonaError) {
          console.error(actualizarZonaError)
          alert("No se pudo actualizar el nombre público de la zona.")
          setSaving(false)
          return
        }
      }

      let error = null
      let clinicaGuardada: Clinica | null = null

      if (selectedClinica) {
        const { data: clinicaAtualizada, error: updateError } = await supabase
          .from("clinicas")
          .update(data)
          .eq("id", selectedClinica.id)
          .select()
          .single()

        error = updateError
        clinicaGuardada = clinicaAtualizada as Clinica
      } else {
        const { data: clinicaCriada, error: insertError } = await supabase
          .from("clinicas")
          .insert([
            {
              ...data,
              ativa: true,
            },
          ])
          .select()
          .single()

        error = insertError
        clinicaGuardada = clinicaCriada as Clinica
      }

      if (error) {
        console.error(error)
        alert("Error guardando clínica")
        setSaving(false)
        return
      }

      if (clinicaGuardada) {
        await sincronizarAlmacenClinica(clinicaGuardada.id, clinicaGuardada.nome)
      }

      await fetchClinicas()
      await fetchZonas()
      setSaving(false)
      cerrarModal()
    } catch (err) {
      console.error(err)
      alert("Ocurrió un error guardando la clínica.")
      setSaving(false)
    }
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
    await fetchCuposEspeciales(selectedClinica.id)
    await fetchCuposEspecialesPorFecha(selectedClinica.id)
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

    setCuposEspecialesPorHorario((prev) => {
      const nuevo = { ...prev }
      delete nuevo[id]
      return nuevo
    })

    setCuposEspecialesPorFecha((prev) => {
      const nuevo = { ...prev }
      delete nuevo[id]
      return nuevo
    })

    if (selectedClinica) {
      await fetchHorarios(selectedClinica.id)
      await fetchCuposEspeciales(selectedClinica.id)
      await fetchCuposEspecialesPorFecha(selectedClinica.id)
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

    const horarioAnterior = horarios.find((h) => h.id === id)
    const horaAnterior = horarioAnterior?.hora || horaNormalizada

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

    try {
      await guardarCuposEspecialesHorario(selectedClinica.id, id, nuevoCupo)
      await guardarCuposEspecialesFechaHorario(selectedClinica.id, id, nuevoCupo)
      await sincronizarCuposDiariosFuturos(selectedClinica.id, id, nuevoCupo)

      if (horaAnterior !== horaNormalizada) {
        const hoy = getHoyLocal()

        const { error: registrosError } = await supabase
          .from("registros")
          .update({ hora: horaNormalizada })
          .eq("clinica_id", selectedClinica.id)
          .eq("horario_id", id)
          .gte("fecha_programada", hoy)

        if (registrosError) {
          console.error("Error actualizando hora en registros:", registrosError)
        }
      }
    } catch (syncError) {
      console.error(syncError)
      alert(
        "El horario se actualizó, pero hubo un problema sincronizando los cupos diarios futuros."
      )
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

    if (selectedClinica) {
      await fetchCuposEspeciales(selectedClinica.id)
      await fetchCuposEspecialesPorFecha(selectedClinica.id)
    }
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

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="bg-white text-[#026A6A] px-6 py-3 rounded-2xl font-semibold shadow-lg hover:opacity-90"
            >
              Volver al dashboard
            </Link>

            <button
              onClick={abrirNuevaClinica}
              className="bg-[#F47C2A] hover:opacity-90 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
            >
              + Nueva Clínica
            </button>

            <Link
              href="/admin/bloqueios-generales"
              className="bg-[#0F6D6A] text-white px-6 py-3 rounded-2xl font-semibold shadow-lg hover:opacity-90"
            >
              Bloqueios generales
            </Link>
          </div>
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
            {zonas.map((zona) => (
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
                      <span className="font-semibold">Usuario:</span>{" "}
                      {clinica.usuario || "-"}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Contraseña:</span>{" "}
                      {clinica.senha || "-"}
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
  onClick={() => abrirModalVoluntariado(clinica)}
  className="px-5 py-3 bg-[#F97316] text-white rounded-2xl font-semibold hover:opacity-90"
>
  Voluntariado
</button>

                  <button
                    onClick={() => toggleClinica(clinica.id, clinica.ativa)}
                    className={`px-5 py-3 rounded-2xl font-semibold text-white ${
                      clinica.ativa ? "bg-red-500" : "bg-green-600"
                    }`}
                  >
                    {clinica.ativa ? "Desactivar" : "Activar"}
                  </button>

                  <Link
                    href={`/admin/clinicas/${clinica.id}/bloqueios`}
                    className="px-5 py-3 bg-[#F47C3C] text-white rounded-2xl font-semibold hover:opacity-90"
                  >
                    Bloqueios
                  </Link>
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

                      {!crearNuevaZona ? (
                        <div className="space-y-2">
                          <select
                            name="zona"
                            defaultValue={selectedClinica?.zona || ""}
                            className="w-full border border-gray-200 p-3 rounded-2xl"
                          >
                            <option value="">Seleccionar zona</option>
                            {zonas.map((zona) => (
                              <option key={zona} value={zona}>
                                {zona}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setCrearNuevaZona(true)
                              setNuevaZona("")
                            }}
                            className="text-sm font-semibold text-[#026A6A] hover:opacity-80"
                          >
                            + Nueva zona
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={nuevaZona}
                            onChange={(e) => setNuevaZona(e.target.value)}
                            placeholder="Escriba la nueva zona"
                            className="w-full border border-gray-200 p-3 rounded-2xl"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setCrearNuevaZona(false)
                              setNuevaZona("")
                            }}
                            className="text-sm font-semibold text-gray-500 hover:opacity-80"
                          >
                            Cancelar nueva zona
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">
                        Nombre público de la zona
                      </label>
                      <input
                        type="text"
                        value={nombrePublicoZona}
                        onChange={(e) => setNombrePublicoZona(e.target.value)}
                        placeholder="Ej: Plan 3000 / Doble vía La Guardia"
                        className="w-full border border-gray-200 p-3 rounded-2xl"
                      />
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
                          className={`font-bold ${
                            selectedClinica?.ativa ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {selectedClinica
                            ? selectedClinica.ativa
                              ? "Activa"
                              : "Inactiva"
                            : "Nueva clínica"}
                        </p>
                      </div>
                    </div>

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
                    Acceso al portal
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
                        placeholder="Usuario de la clínica"
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
                        placeholder="Contraseña"
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Días de funcionamiento
                  </h3>

                  <div className="flex flex-wrap gap-3">
                    {DIAS_SEMANA.map((dia) => (
                      <label
                        key={dia}
                        className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          name="dias_funcionamento"
                          value={dia}
                          defaultChecked={selectedClinica?.dias_funcionamento?.includes(dia)}
                        />
                        {dia}
                      </label>
                    ))}
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-bold text-[#026A6A] mb-4">
                    Restricciones
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ["acepta_gatos", "Acepta gatos"],
                      ["acepta_perros", "Acepta perros"],
                      ["acepta_machos", "Acepta machos"],
                      ["acepta_hembras", "Acepta hembras"],
                      ["acepta_calle", "Acepta calle"],
                      ["acepta_propio", "Acepta propio"],
                      ["acepta_perras_calle", "Acepta perras calle"],
                    ].map(([name, label]) => (
                      <label
                        key={name}
                        className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          name={name}
                          defaultChecked={Boolean(
                            selectedClinica?.[name as keyof Clinica]
                          )}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </section>

                <section className="bg-gray-50 rounded-3xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#026A6A]">
                        Horarios y cupos
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Puedes dejar cupos especiales por día. Si un día queda vacío,
                        el sistema usa el cupo base.
                      </p>
                    </div>
                  </div>

                  {selectedClinica ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 mb-6">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-2">
                            Hora
                          </label>
                          <input
                            type="time"
                            value={hora}
                            onChange={(e) => setHora(e.target.value)}
                            className="w-full border border-gray-200 p-3 rounded-2xl"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-2">
                            Cupos base
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={cupos}
                            onChange={(e) => setCupos(Number(e.target.value))}
                            className="w-full border border-gray-200 p-3 rounded-2xl"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={agregarHorario}
                            className="w-full md:w-auto px-5 py-3 bg-[#F47C2A] text-white rounded-2xl font-semibold"
                          >
                            Añadir horario
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {horarios.length === 0 ? (
                          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
                            Esta clínica aún no tiene horarios configurados.
                          </div>
                        ) : (
                          horarios.map((h) => (
                            <div
                              key={h.id}
                              className="bg-white border border-gray-200 rounded-3xl p-4"
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_auto] gap-4 items-end">
                                <div>
                                  <label className="text-sm font-semibold text-gray-700 block mb-2">
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
                                    className="border border-gray-200 p-3 rounded-2xl w-full"
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                                    Cupos base
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
                                    className="border border-gray-200 p-3 rounded-2xl w-full"
                                  />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      actualizarHorario(h.id, h.hora, h.cupos_maximos)
                                    }
                                    className="px-4 py-3 bg-[#026A6A] text-white rounded-2xl font-semibold"
                                  >
                                    Guardar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => eliminarHorario(h.id)}
                                    className="px-4 py-3 bg-red-500 text-white rounded-2xl font-semibold"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 border-t border-gray-100 pt-4">
                                <p className="text-sm font-semibold text-gray-700 mb-3">
                                  Cupos especiales por día
                                </p>

                                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                                  {DIAS_SEMANA_CONFIG.map((dia) => (
                                    <div
                                      key={`${h.id}-${dia.numero}`}
                                      className="bg-gray-50 rounded-2xl p-3 border border-gray-100"
                                    >
                                      <label className="text-xs font-bold text-gray-600 block mb-2">
                                        {dia.label}
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={getCupoEspecialTexto(h.id, dia.numero)}
                                        onChange={(e) =>
                                          setCupoEspecialTexto(
                                            h.id,
                                            dia.numero,
                                            e.target.value
                                          )
                                        }
                                        placeholder={String(h.cupos_maximos)}
                                        className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                                      />
                                    </div>
                                  ))}
                                </div>

                                <p className="text-xs text-gray-500 mt-3">
                                  Deja vacío el día que no necesite un cupo diferente. Si
                                  escribes el mismo valor del cupo base, no se guardará
                                  como excepción.
                                </p>

                                <div className="mt-5 border-t border-gray-100 pt-4">
                                  <p className="text-sm font-semibold text-gray-700 mb-3">
                                    Cupos especiales por fecha
                                  </p>

                                  <FechaEspecialEditor
                                    horarioId={h.id}
                                    cupoBase={h.cupos_maximos}
                                    valores={cuposEspecialesPorFecha[h.id] || {}}
                                    onChange={setCupoEspecialFechaTexto}
                                    onDelete={eliminarCupoEspecialFechaTexto}
                                  />
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
        <ModalHorariosVoluntariado
  open={modalVoluntariadoOpen}
  onClose={() => setModalVoluntariadoOpen(false)}
  clinica={clinicaVoluntariado}
/>
      </div>
    </main>
  )
}