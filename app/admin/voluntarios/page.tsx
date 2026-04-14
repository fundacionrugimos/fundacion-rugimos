"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type Voluntario = {
  id: string
  codigo: string
  nombre_completo: string
  celular: string | null
  email: string | null
  ciudad: string | null
  zona: string | null

  universidad: string | null
  carrera: string | null
  semestre_ano: string | null
  ultimo_ano: boolean | null
  internado_actual: boolean | null

  experiencia_previa: string | null
  areas_interes: string[] | null
  aptitudes: string | null
  motivacion: string | null
  disponibilidad_texto: string | null

  documento_identidad_url: string | null
  comprobante_estudio_url: string | null
  hoja_vida_url: string | null

  estado: "pendiente" | "aprobado" | "rechazado" | "activo" | "inactivo"
  nivel: "observador" | "asistente" | "avanzado"

  observaciones_admin: string | null
  motivo_rechazo: string | null

  dias_programados: number
  dias_asistidos: number
  dias_falta: number
  porcentaje_asistencia: number

  certificado_elegible: boolean
  certificado_emitido: boolean

  portal_password: string | null
  acepta_vacunas: boolean | null

  fecha_aprobacion: string | null
  created_at: string
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function getEstadoLabel(estado?: Voluntario["estado"]) {
  switch (estado) {
    case "pendiente":
      return "Pendiente"
    case "aprobado":
      return "Aprobado"
    case "activo":
      return "Activo"
    case "rechazado":
      return "Rechazado"
    case "inactivo":
      return "Inactivo"
    default:
      return "-"
  }
}

function getEstadoClasses(estado?: Voluntario["estado"]) {
  switch (estado) {
    case "pendiente":
      return "bg-[#fff3e9] text-[#8f4f24] border-[#f0d6c2]"
    case "aprobado":
      return "bg-[#eef8f7] text-[#0b6665] border-[#b9e2dd]"
    case "activo":
      return "bg-[#e8f5e9] text-[#2e7d32] border-[#cfe8d3]"
    case "rechazado":
      return "bg-[#fff1f1] text-[#b53a3a] border-[#f3c6c6]"
    case "inactivo":
      return "bg-slate-100 text-slate-600 border-slate-200"
    default:
      return "bg-slate-100 text-slate-600 border-slate-200"
  }
}

function getNivelLabel(nivel?: Voluntario["nivel"]) {
  switch (nivel) {
    case "observador":
      return "Observador"
    case "asistente":
      return "Asistente"
    case "avanzado":
      return "Avanzado"
    default:
      return "-"
  }
}

export default function AdminVoluntariosPage() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([])
  const [selected, setSelected] = useState<Voluntario | null>(null)

  const [filtroTexto, setFiltroTexto] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("Todos")

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchVoluntarios() {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("voluntarios")
        .select(`
          id,
          codigo,
          nombre_completo,
          celular,
          email,
          ciudad,
          zona,
          universidad,
          carrera,
          semestre_ano,
          ultimo_ano,
          internado_actual,
          experiencia_previa,
          areas_interes,
          aptitudes,
          motivacion,
          disponibilidad_texto,
          documento_identidad_url,
          comprobante_estudio_url,
          hoja_vida_url,
          estado,
          nivel,
          observaciones_admin,
          motivo_rechazo,
          dias_programados,
          dias_asistidos,
          dias_falta,
          porcentaje_asistencia,
          certificado_elegible,
          certificado_emitido,
          portal_password,
          acepta_vacunas,
          fecha_aprobacion,
          created_at
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      const list = (data || []) as Voluntario[]
      setVoluntarios(list)

      if (selected) {
        const updatedSelected = list.find((v) => v.id === selected.id) || null
        setSelected(updatedSelected)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No se pudieron cargar los voluntarios.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVoluntarios()
  }, [])

  const filtrados = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase()

    return voluntarios.filter((v) => {
      const coincideTexto =
        !texto ||
        v.nombre_completo?.toLowerCase().includes(texto) ||
        v.codigo?.toLowerCase().includes(texto) ||
        v.email?.toLowerCase().includes(texto) ||
        v.celular?.toLowerCase().includes(texto) ||
        v.universidad?.toLowerCase().includes(texto) ||
        v.carrera?.toLowerCase().includes(texto)

      const coincideEstado = filtroEstado === "Todos" || v.estado === filtroEstado

      return coincideTexto && coincideEstado
    })
  }, [voluntarios, filtroTexto, filtroEstado])

  const resumen = useMemo(() => {
    return {
      total: voluntarios.length,
      pendientes: voluntarios.filter((v) => v.estado === "pendiente").length,
      activos: voluntarios.filter((v) => v.estado === "activo").length,
      elegibles: voluntarios.filter((v) => v.certificado_elegible).length,
    }
  }, [voluntarios])

  async function updateVoluntario(
    id: string,
    payload: Partial<Voluntario>,
    successMessage: string
  ) {
    try {
      setSavingId(id)
      setError(null)
      setSuccess(null)

      const { error } = await supabase.from("voluntarios").update(payload).eq("id", id)

      if (error) throw error

      setSuccess(successMessage)
      await fetchVoluntarios()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "No fue posible actualizar el voluntario.")
    } finally {
      setSavingId(null)
    }
  }

  async function handleAprobar(v: Voluntario) {
    await updateVoluntario(
      v.id,
      {
        estado: "aprobado",
        fecha_aprobacion: new Date().toISOString(),
        motivo_rechazo: null,
      },
      `Voluntario ${v.nombre_completo} aprobado correctamente.`
    )
  }

  async function handleActivar(v: Voluntario) {
    await updateVoluntario(
      v.id,
      {
        estado: "activo",
        motivo_rechazo: null,
      },
      `Voluntario ${v.nombre_completo} activado correctamente.`
    )
  }

  async function handleInactivar(v: Voluntario) {
    await updateVoluntario(
      v.id,
      {
        estado: "inactivo",
      },
      `Voluntario ${v.nombre_completo} marcado como inactivo.`
    )
  }

  async function handleRechazar(v: Voluntario) {
    const motivo = window.prompt("Escriba el motivo de rechazo:")
    if (motivo === null) return

    await updateVoluntario(
      v.id,
      {
        estado: "rechazado",
        motivo_rechazo: motivo.trim() || "No especificado",
      },
      `Voluntario ${v.nombre_completo} rechazado correctamente.`
    )
  }

  async function handleCambiarNivel(v: Voluntario) {
    const actual = v.nivel || "observador"
    const nuevo = window.prompt(
      "Nuevo nivel: observador / asistente / avanzado",
      actual
    )

    if (!nuevo) return

    const normalizado = nuevo.trim().toLowerCase()

    if (!["observador", "asistente", "avanzado"].includes(normalizado)) {
      setError("Nivel inválido. Use: observador, asistente o avanzado.")
      return
    }

    await updateVoluntario(
      v.id,
      {
        nivel: normalizado as Voluntario["nivel"],
      },
      `Nivel de ${v.nombre_completo} actualizado a ${normalizado}.`
    )
  }

  async function handleSetPassword(v: Voluntario) {
    const pass = window.prompt("Definir contraseña para el portal:")

    if (!pass) return

    await updateVoluntario(
      v.id,
      {
        portal_password: pass.trim(),
      },
      `Contraseña configurada para ${v.nombre_completo}`
    )
  }

  return (
    <main className="min-h-screen bg-[#026A6A] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/75">
              🐾 FUNDACIÓN RUGIMOS 🐾
            </p>
            <h1 className="text-3xl font-bold text-white md:text-5xl">
              Gestión de Voluntarios
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/85 md:text-base">
              Administra postulaciones, estados, documentos, progreso y acceso al programa de
              voluntariado clínico.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#026A6A] shadow-lg transition hover:opacity-90"
            >
              Volver al dashboard
            </Link>

            <Link
              href="/admin/voluntarios/asignaciones"
              className="rounded-2xl bg-[#F47C3C] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Central de asignaciones
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
            <p className="font-semibold">Revisar</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-[24px] border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32] shadow-md">
            <p className="font-semibold">Excelente</p>
            <p className="mt-1">{success}</p>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Total postulaciones" value={String(resumen.total)} />
          <SummaryCard title="Pendientes" value={String(resumen.pendientes)} />
          <SummaryCard title="Activos" value={String(resumen.activos)} />
          <SummaryCard title="Elegibles certificado" value={String(resumen.elegibles)} />
        </div>

        <div className="mb-6 rounded-[28px] bg-[#f4f4f4] p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <input
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, código, email, celular, universidad..."
              className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#026A6A]"
            />

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#026A6A]"
            >
              <option value="Todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="activo">Activo</option>
              <option value="rechazado">Rechazado</option>
              <option value="inactivo">Inactivo</option>
            </select>

            <button
              type="button"
              onClick={fetchVoluntarios}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#026A6A] ring-1 ring-slate-200 transition hover:scale-[1.02]"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] bg-[#f4f4f4] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#026A6A]">Listado de voluntarios</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                {filtrados.length} resultado{filtrados.length === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                Cargando voluntarios...
              </div>
            ) : filtrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                No se encontraron voluntarios con esos filtros.
              </div>
            ) : (
              <div className="space-y-4">
                {filtrados.map((v) => {
                  const isSelected = selected?.id === v.id

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelected(v)}
                      className={`w-full rounded-[24px] border p-5 text-left transition ${
                        isSelected
                          ? "border-[#026A6A] bg-[#eef8f7] shadow-md"
                          : "border-slate-200 bg-white hover:border-[#92ccc6] hover:bg-[#f8fcfb]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-[#026A6A]">
                            {v.nombre_completo}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {v.codigo} {v.email ? `· ${v.email}` : ""}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {v.universidad || "Sin universidad"} · {v.carrera || "Sin carrera"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getEstadoClasses(
                            v.estado
                          )}`}
                        >
                          {getEstadoLabel(v.estado)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <MiniInfo label="Nivel" value={getNivelLabel(v.nivel)} />
                        <MiniInfo label="Asistidos" value={String(v.dias_asistidos || 0)} />
                        <MiniInfo
                          label="% asistencia"
                          value={`${Number(v.porcentaje_asistencia || 0).toFixed(2)}%`}
                        />
                        <MiniInfo
                          label="Certificado"
                          value={v.certificado_elegible ? "Elegible" : "En progreso"}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[28px] bg-[#f4f4f4] p-5 shadow-xl">
            <h2 className="text-xl font-bold text-[#026A6A]">Detalle del voluntario</h2>

            {!selected ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                Seleccione un voluntario para ver su detalle, documentos y acciones disponibles.
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-bold text-[#026A6A]">
                        {selected.nombre_completo}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selected.codigo} · {getNivelLabel(selected.nivel)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Acceso portal: código <b>{selected.codigo}</b> ·{" "}
                        {selected.portal_password
                          ? "🔐 contraseña configurada"
                          : "❌ sin contraseña"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getEstadoClasses(
                        selected.estado
                      )}`}
                    >
                      {getEstadoLabel(selected.estado)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <InfoRow label="Celular" value={selected.celular || "-"} />
                    <InfoRow label="Email" value={selected.email || "-"} />
                    <InfoRow label="Ciudad" value={selected.ciudad || "-"} />
                    <InfoRow label="Zona" value={selected.zona || "-"} />
                    <InfoRow label="Universidad" value={selected.universidad || "-"} />
                    <InfoRow label="Carrera" value={selected.carrera || "-"} />
                    <InfoRow label="Semestre / año" value={selected.semestre_ano || "-"} />
                    <InfoRow
                      label="Etapa"
                      value={
                        selected.internado_actual
                          ? "Internado actual"
                          : selected.ultimo_ano
                            ? "Último año / etapa avanzada"
                            : "No especificado"
                      }
                    />
                    <InfoRow
                      label="Vacunas obligatorias"
                      value={selected.acepta_vacunas ? "Sí, confirmó" : "No confirmado"}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#026A6A]/70">
                    Progreso
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniInfo label="Programados" value={String(selected.dias_programados || 0)} />
                    <MiniInfo label="Asistidos" value={String(selected.dias_asistidos || 0)} />
                    <MiniInfo label="Faltas" value={String(selected.dias_falta || 0)} />
                    <MiniInfo
                      label="% asistencia"
                      value={`${Number(selected.porcentaje_asistencia || 0).toFixed(2)}%`}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#d1e7dd] bg-[#eef8f7] p-4 text-sm text-slate-700">
                    {selected.certificado_emitido ? (
                      <p className="font-semibold text-[#2e7d32]">Certificado emitido.</p>
                    ) : selected.certificado_elegible ? (
                      <p className="font-semibold text-[#2e7d32]">
                        Ya cumple requisitos para certificado.
                      </p>
                    ) : (
                      <p>Aún en progreso para certificado.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#026A6A]/70">
                    Motivación e información académica
                  </p>

                  <DetailBlock title="Motivación" text={selected.motivacion} />
                  <DetailBlock title="Disponibilidad" text={selected.disponibilidad_texto} />
                  <DetailBlock title="Aptitudes" text={selected.aptitudes} />
                  <DetailBlock title="Experiencia previa" text={selected.experiencia_previa} />

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-[#026A6A]">Áreas de interés</p>
                    <div className="flex flex-wrap gap-2">
                      {(selected.areas_interes || []).length > 0 ? (
                        selected.areas_interes?.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-[#eef8f7] px-3 py-1 text-xs font-semibold text-[#026A6A]"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Sin áreas registradas.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#026A6A]/70">
                    Documentos
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <DocButton href={selected.documento_identidad_url} label="Documento" />
                    <DocButton href={selected.comprobante_estudio_url} label="Comprobante" />
                    <DocButton href={selected.hoja_vida_url} label="Hoja de vida" />
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    selected.acepta_vacunas
                      ? "border-[#d1e7dd] bg-[#eef8f7] text-[#2e7d32]"
                      : "border-[#f3c6c6] bg-[#fff1f1] text-[#b53a3a]"
                  }`}
                >
                  <p className="font-semibold">Control sanitario del voluntario</p>
                  <p className="mt-2">
                    {selected.acepta_vacunas
                      ? "El postulante declaró contar con vacunas obligatorias al día, especialmente antirrábica y antitetánica, y aceptó asumir la responsabilidad de su participación."
                      : "El postulante no confirmó vacunas obligatorias al día. No debería ser habilitado para participar hasta regularizar este requisito."}
                  </p>
                </div>

                {selected.motivo_rechazo ? (
                  <div className="rounded-2xl border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a]">
                    <p className="font-semibold">Motivo de rechazo</p>
                    <p className="mt-2">{selected.motivo_rechazo}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#026A6A]/70">
                    Acciones
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleSetPassword(selected)}
                      className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Definir contraseña
                    </button>

                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleAprobar(selected)}
                      className="rounded-full bg-[#026A6A] px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Aprobar
                    </button>

                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleActivar(selected)}
                      className="rounded-full bg-[#2e7d32] px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Activar
                    </button>

                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleInactivar(selected)}
                      className="rounded-full bg-slate-500 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Inactivar
                    </button>

                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleRechazar(selected)}
                      className="rounded-full bg-[#b53a3a] px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Rechazar
                    </button>

                    <button
                      type="button"
                      disabled={savingId === selected.id}
                      onClick={() => handleCambiarNivel(selected)}
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#026A6A] ring-1 ring-slate-200 transition hover:scale-[1.02] disabled:opacity-60"
                    >
                      Cambiar nivel
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/admin/voluntarios/asignaciones`}
                      className="rounded-full bg-[#F47C3C] px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                    >
                      Ir a programar asignación
                    </Link>

                    <Link
                      href={`/voluntario/${selected.codigo}`}
                      target="_blank"
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#026A6A] ring-1 ring-slate-200 transition hover:scale-[1.02]"
                    >
                      Abrir portal del voluntario
                    </Link>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    Postulación enviada: {formatDate(selected.created_at)} · Aprobación:{" "}
                    {formatDate(selected.fecha_aprobacion)}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-[24px] bg-[#f4f4f4] p-5 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#026A6A]/70">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#026A6A]">{value}</p>
    </div>
  )
}

function MiniInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{value}</p>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#026A6A]/70">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  )
}

function DetailBlock({
  title,
  text,
}: {
  title: string
  text?: string | null
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-[#026A6A]">{title}</p>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        {text?.trim() ? text : "Sin información registrada."}
      </div>
    </div>
  )
}

function DocButton({
  href,
  label,
}: {
  href?: string | null
  label: string
}) {
  if (!href) {
    return (
      <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
        {label}: no disponible
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full bg-[#eef8f7] px-4 py-2 text-sm font-semibold text-[#026A6A] transition hover:scale-[1.02]"
    >
      Ver {label}
    </a>
  )
}