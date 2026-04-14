"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id: string
  nombre?: string | null
  nome?: string | null
  zona?: string | null
  direccion?: string | null
  endereco?: string | null
}

type Horario = {
  id: string
  clinica_id: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  cupos: number
  activo: boolean
  created_at?: string
  updated_at?: string
}

type Props = {
  open: boolean
  onClose: () => void
  clinica: Clinica | null
}

const DIAS = [
  { label: "Lunes", value: "lunes" },
  { label: "Martes", value: "martes" },
  { label: "Miércoles", value: "miercoles" },
  { label: "Jueves", value: "jueves" },
  { label: "Viernes", value: "viernes" },
  { label: "Sábado", value: "sabado" },
  { label: "Domingo", value: "domingo" },
]

const diaOrden: Record<string, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
}

function formatHora(hora?: string | null) {
  if (!hora) return "--:--"
  return hora.slice(0, 5)
}

function normalizarDiaSemana(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export default function ModalHorariosVoluntariado({
  open,
  onClose,
  clinica,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Horario[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [diaSemana, setDiaSemana] = useState("lunes")
  const [horaInicio, setHoraInicio] = useState("08:00")
  const [horaFin, setHoraFin] = useState("12:00")
  const [cupos, setCupos] = useState(1)
  const [activo, setActivo] = useState(true)

  const clinicaNombre =
    clinica?.nombre || clinica?.nome || "Clínica sin nombre"

  const itemsOrdenados = useMemo(() => {
    return [...items].sort((a, b) => {
      const d = (diaOrden[a.dia_semana] || 99) - (diaOrden[b.dia_semana] || 99)
      if (d !== 0) return d
      return a.hora_inicio.localeCompare(b.hora_inicio)
    })
  }, [items])

  function resetForm() {
    setEditId(null)
    setDiaSemana("lunes")
    setHoraInicio("08:00")
    setHoraFin("12:00")
    setCupos(1)
    setActivo(true)
  }

  async function cargarHorarios() {
    if (!clinica?.id) return
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from("clinica_voluntariado_horarios")
      .select("*")
      .eq("clinica_id", clinica.id)

    if (error) {
      setError(error.message || "No se pudieron cargar los horarios.")
      setItems([])
    } else {
      setItems((data || []) as Horario[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (open && clinica?.id) {
      resetForm()
      cargarHorarios()
    }
  }, [open, clinica?.id])

  function editarItem(item: Horario) {
    setEditId(item.id)
    setDiaSemana(normalizarDiaSemana(item.dia_semana))
    setHoraInicio(formatHora(item.hora_inicio))
    setHoraFin(formatHora(item.hora_fin))
    setCupos(item.cupos || 1)
    setActivo(item.activo)
    setSuccess(null)
    setError(null)
  }

  async function guardarHorario() {
    if (!clinica?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!diaSemana || !horaInicio || !horaFin) {
      setError("Completa día, hora de inicio y hora de fin.")
      setSaving(false)
      return
    }

    if (horaFin <= horaInicio) {
      setError("La hora de fin debe ser mayor que la hora de inicio.")
      setSaving(false)
      return
    }

    const payload = {
  clinica_id: clinica.id,
  dia_semana: normalizarDiaSemana(diaSemana),
  hora_inicio: horaInicio,
  hora_fin: horaFin,
  cupos: Number(cupos) || 1,
  activo,
}

    let resultError = null

    if (editId) {
      const { error } = await supabase
        .from("clinica_voluntariado_horarios")
        .update(payload)
        .eq("id", editId)

      resultError = error
    } else {
      const { error } = await supabase
        .from("clinica_voluntariado_horarios")
        .insert(payload)

      resultError = error
    }

    if (resultError) {
      setError(resultError.message || "No se pudo guardar el horario.")
    } else {
      setSuccess(editId ? "Horario actualizado correctamente." : "Horario creado correctamente.")
      resetForm()
      await cargarHorarios()
    }

    setSaving(false)
  }

  async function eliminarHorario(id: string) {
    const ok = window.confirm("¿Deseas eliminar este horario de voluntariado?")
    if (!ok) return

    setError(null)
    setSuccess(null)

    const { error } = await supabase
      .from("clinica_voluntariado_horarios")
      .delete()
      .eq("id", id)

    if (error) {
      setError(error.message || "No se pudo eliminar el horario.")
      return
    }

    setSuccess("Horario eliminado correctamente.")
    if (editId === id) resetForm()
    await cargarHorarios()
  }

  if (!open || !clinica) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-[#F6F1EA] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#0F766E]/15 bg-gradient-to-r from-[#0A6C74] to-[#0F766E] px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/80">
              Fundación Rugimos
            </p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight">
              Horarios de voluntariado
            </h2>
            <p className="mt-1 text-sm text-white/85">
              {clinicaNombre}
              {clinica?.zona ? ` • Zona: ${clinica.zona}` : ""}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
          >
            Cerrar
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr,0.95fr]">
          <section className="rounded-[24px] border border-[#0F766E]/15 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#0B4F57]">
                  Horarios configurados
                </h3>
                <p className="text-sm text-[#5F6B73]">
                  Aquí se muestran los días y turnos habilitados para pasantía.
                </p>
              </div>

              <button
                onClick={cargarHorarios}
                className="rounded-full border border-[#0F766E]/15 bg-[#F8FAFC] px-4 py-2 text-sm font-semibold text-[#0A6C74] transition hover:bg-[#EEF7F6]"
              >
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#0F766E]/20 bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#5F6B73]">
                Cargando horarios...
              </div>
            ) : itemsOrdenados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#F59E0B]/35 bg-[#FFF7ED] px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[#9A3412]">
                  Esta clínica aún no tiene horarios de voluntariado configurados.
                </p>
                <p className="mt-1 text-sm text-[#9A3412]/80">
                  Agrega al menos un día y turno para poder asignar voluntarios.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {itemsOrdenados.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#0F766E]/15 bg-[#FCFEFE] p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-extrabold text-[#0B4F57]">
                            {item.dia_semana}
                          </span>
                          <span className="rounded-full bg-[#E6F6F4] px-3 py-1 text-xs font-bold text-[#0F766E]">
                            {formatHora(item.hora_inicio)} - {formatHora(item.hora_fin)}
                          </span>
                          <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-bold text-[#B45309]">
                            {item.cupos} cupo{item.cupos === 1 ? "" : "s"}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              item.activo
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : "bg-[#F3F4F6] text-[#6B7280]"
                            }`}
                          >
                            {item.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => editarItem(item)}
                          className="rounded-full border border-[#0F766E]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0A6C74] transition hover:bg-[#EEF7F6]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarHorario(item.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-[#0F766E]/15 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-extrabold text-[#0B4F57]">
                {editId ? "Editar horario" : "Nuevo horario"}
              </h3>
              <p className="text-sm text-[#5F6B73]">
                Configura los días y turnos en los que la clínica recibe voluntarios.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {success}
              </div>
            )}

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#0B4F57]">
                  Día de la semana
                </label>
                <select
  value={diaSemana}
  onChange={(e) => setDiaSemana(e.target.value)}
>
  {DIAS.map((dia) => (
    <option key={dia.value} value={dia.value}>
      {dia.label}
    </option>
  ))}
</select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0B4F57]">
                    Hora inicio
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full rounded-2xl border border-[#D9E3E7] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0B4F57]">
                    Hora fin
                  </label>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="w-full rounded-2xl border border-[#D9E3E7] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#0B4F57]">
                  Cupos de voluntarios
                </label>
                <input
                  type="number"
                  min={1}
                  value={cupos}
                  onChange={(e) => setCupos(Number(e.target.value))}
                  className="w-full rounded-2xl border border-[#D9E3E7] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#D9E3E7] bg-[#FAFCFC] px-4 py-3">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#0F766E] focus:ring-[#0F766E]"
                />
                <span className="text-sm font-semibold text-[#0B4F57]">
                  Horario activo para asignaciones
                </span>
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={guardarHorario}
                  disabled={saving}
                  className="rounded-full bg-[#F97316] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear horario"}
                </button>

                <button
                  onClick={resetForm}
                  type="button"
                  className="rounded-full border border-[#0F766E]/15 bg-white px-5 py-3 text-sm font-bold text-[#0A6C74] transition hover:bg-[#EEF7F6]"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}