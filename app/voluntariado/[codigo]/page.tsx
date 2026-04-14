"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type VoluntarioData = {
  id: string
  codigo: string
  nombre_completo: string
  celular: string | null
  email: string | null
  universidad: string | null
  carrera: string | null
  semestre_ano: string | null
  estado: "pendiente" | "aprobado" | "rechazado" | "activo" | "inactivo"
  nivel: "observador" | "asistente" | "avanzado"
  dias_programados: number
  dias_asistidos: number
  dias_falta: number
  porcentaje_asistencia: number
  certificado_elegible: boolean
  certificado_emitido: boolean
  observaciones_admin: string | null
  portal_password: string | null
}

type AsignacionData = {
  id: string
  voluntario_id: string
  clinica_id: string
  horario_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  estado: "programado" | "asistio" | "no_asistio" | "cancelado"
  observacion: string | null
}

type ClinicaData = {
  id: string
  nome: string | null
  zona: string | null
  endereco: string | null
  telefono: string | null
  maps_url: string | null
  lat?: number | null
  lng?: number | null
}

type CheckinData = {
  id: string
  asignacion_id: string
  fecha: string
  hora_checkin: string
  estado: "presente" | "tarde" | "observado"
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-"

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-")
    return `${day}/${month}/${year}`
  }

  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr

  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function formatTime(value?: string | null) {
  if (!value) return "-"
  const [hh, mm] = value.split(":")
  if (!hh || !mm) return value
  return `${hh}:${mm}`
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getStatusLabel(status?: VoluntarioData["estado"]) {
  switch (status) {
    case "pendiente":
      return "Pendiente de revisión"
    case "aprobado":
      return "Aprobado"
    case "activo":
      return "Activo"
    case "rechazado":
      return "No aprobado"
    case "inactivo":
      return "Inactivo"
    default:
      return "-"
  }
}

function getNivelLabel(nivel?: VoluntarioData["nivel"]) {
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

function timeToMinutes(value?: string | null) {
  if (!value) return null
  const [hh, mm] = value.split(":").map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function getNowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export default function VoluntarioPortalPage() {
  const params = useParams()
  const codigo = String(params?.codigo || "").trim().toUpperCase()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [voluntario, setVoluntario] = useState<VoluntarioData | null>(null)
  const [asignacionHoy, setAsignacionHoy] = useState<AsignacionData | null>(null)
  const [clinicaHoy, setClinicaHoy] = useState<ClinicaData | null>(null)
  const [checkinHoy, setCheckinHoy] = useState<CheckinData | null>(null)

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [inputPassword, setInputPassword] = useState("")

  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  async function loadData() {
    if (!codigo) return

    setLoading(true)
    setError(null)

    try {
      const { data: voluntarioData, error: voluntarioError } = await supabase
        .from("voluntarios")
        .select(`
          id,
          codigo,
          nombre_completo,
          celular,
          email,
          universidad,
          carrera,
          semestre_ano,
          estado,
          nivel,
          dias_programados,
          dias_asistidos,
          dias_falta,
          porcentaje_asistencia,
          certificado_elegible,
          certificado_emitido,
          observaciones_admin,
          portal_password
        `)
        .eq("codigo", codigo)
        .maybeSingle()

      if (voluntarioError) {
        throw new Error(`Error al buscar el voluntario: ${voluntarioError.message}`)
      }

      if (!voluntarioData) {
        throw new Error(`No encontramos un voluntario con el código ${codigo}.`)
      }

      setVoluntario(voluntarioData as VoluntarioData)

      const today = getTodayDateString()

      const { data: asignacionData, error: asignacionError } = await supabase
        .from("voluntario_asignaciones")
        .select(`
          id,
          voluntario_id,
          clinica_id,
          horario_id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          observacion
        `)
        .eq("voluntario_id", voluntarioData.id)
        .eq("fecha", today)
        .in("estado", ["programado", "asistio"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (asignacionError) {
        throw new Error(`Error al buscar la asignación de hoy: ${asignacionError.message}`)
      }

      let asignacionFinal = (asignacionData as AsignacionData | null) || null

      if (asignacionFinal?.horario_id) {
        const { data: horarioData, error: horarioError } = await supabase
          .from("clinica_voluntariado_horarios")
          .select("id, hora_inicio, hora_fin")
          .eq("id", asignacionFinal.horario_id)
          .maybeSingle()

        if (horarioError) {
          throw new Error(`Error al buscar el horario de la asignación: ${horarioError.message}`)
        }

        if (horarioData) {
          asignacionFinal = {
            ...asignacionFinal,
            hora_inicio: asignacionFinal.hora_inicio || horarioData.hora_inicio,
            hora_fin: asignacionFinal.hora_fin || horarioData.hora_fin,
          }
        }
      }

      setAsignacionHoy(asignacionFinal)

      if (asignacionFinal?.clinica_id) {
        const { data: clinicaData, error: clinicaError } = await supabase
          .from("clinicas")
          .select("id, nome, zona, endereco, telefono, maps_url, lat, lng")
          .eq("id", asignacionFinal.clinica_id)
          .maybeSingle()

        if (clinicaError) {
          throw new Error(`Error al buscar la clínica: ${clinicaError.message}`)
        }

        setClinicaHoy((clinicaData as ClinicaData | null) || null)

        const { data: checkinData, error: checkinError } = await supabase
          .from("voluntario_checkins")
          .select("id, asignacion_id, fecha, hora_checkin, estado")
          .eq("asignacion_id", asignacionFinal.id)
          .maybeSingle()

        if (checkinError) {
          throw new Error(`Error al buscar el check-in: ${checkinError.message}`)
        }

        setCheckinHoy((checkinData as CheckinData | null) || null)
      } else {
        setClinicaHoy(null)
        setCheckinHoy(null)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Ocurrió un error al cargar el portal del voluntario.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [codigo])

  useEffect(() => {
    if (!isAuthenticated) return

    if (!navigator.geolocation) {
      setLocationError("Tu dispositivo no permite obtener ubicación.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude)
        setUserLng(position.coords.longitude)
        setLocationError(null)
      },
      (err) => {
        console.error(err)
        setLocationError("No fue posible obtener tu ubicación. Debes permitir acceso a GPS.")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [isAuthenticated])

  const progresoDias = useMemo(() => {
    const asistidos = voluntario?.dias_asistidos || 0
    const progress = Math.min((asistidos / 30) * 100, 100)
    return Math.round(progress)
  }, [voluntario])

  const certificateStatus = useMemo(() => {
    if (!voluntario) return "En progreso"
    if (voluntario.certificado_emitido) return "Certificado emitido"
    if (voluntario.certificado_elegible) return "Certificado disponible"
    if ((voluntario.dias_asistidos || 0) >= 24) return "Muy cerca del objetivo"
    return "En progreso"
  }, [voluntario])

  const clinicName = useMemo(() => {
    if (!clinicaHoy?.nome) return "Clínica asignada"
    return `${clinicaHoy.nome}${clinicaHoy.zona ? ` - ${clinicaHoy.zona}` : ""}`
  }, [clinicaHoy])

  const canCheckInByTime = useMemo(() => {
    if (!asignacionHoy?.hora_inicio || !asignacionHoy?.hora_fin) return false

    const now = getNowMinutes()
    const start = timeToMinutes(asignacionHoy.hora_inicio)
    const end = timeToMinutes(asignacionHoy.hora_fin)

    if (start === null || end === null) return false

    return now >= start && now <= end
  }, [asignacionHoy])

  async function handleCheckin() {
    if (!voluntario) return

    try {
      setSubmitting(true)
      setError(null)
      setSuccessMessage(null)

      if (userLat == null || userLng == null) {
        throw new Error("Necesitamos tu ubicación para registrar el check-in.")
      }

      const { data, error: rpcError } = await supabase.rpc("registrar_checkin_voluntario", {
        p_codigo: voluntario.codigo,
        p_lat: userLat,
        p_lng: userLng,
      })

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      if (!data?.ok) {
        throw new Error(data?.message || "No fue posible realizar el check-in.")
      }

      setSuccessMessage(data?.message || "Check-in realizado correctamente.")
      await loadData()
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Ocurrió un error al registrar el check-in.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>
            <h1 className="text-3xl font-bold text-[#0b6665] md:text-4xl">
              Cargando portal del voluntario...
            </h1>
            <p className="mt-4 text-slate-600">
              Estamos preparando tu información y la asignación del día.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !voluntario) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>
            <h1 className="text-3xl font-bold leading-tight text-[#c65b24] md:text-4xl">
              Portal no disponible
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {error}
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24]">
            Verifique que el enlace sea correcto o comuníquese con Fundación Rugimos si necesita
            ayuda.
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
            >
              Volver
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!isAuthenticated && voluntario) {
    return (
      <main className="min-h-screen bg-[#0d7a75] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>

            <h1 className="text-3xl font-bold text-[#0b6665] md:text-4xl">
              Acceso al portal
            </h1>

            <p className="mt-4 text-slate-600">
              Ingrese su contraseña para continuar.
            </p>

            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-[#0b6665]">Código de acceso:</span>{" "}
                {voluntario.codigo}
              </p>
              <p className="mt-2">
                Este código y la contraseña son su acceso al portal de voluntariado.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
              <p className="font-semibold">Revisar</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#0b6665]">
                Contraseña
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
              />
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null)

                  const { data, error: loginError } = await supabase.rpc("voluntario_login", {
                    p_codigo: voluntario.codigo,
                    p_password: inputPassword.trim(),
                  })

                  if (loginError) {
                    throw new Error(loginError.message)
                  }

                  if (!data?.ok) {
                    setError(data?.message || "Código o contraseña inválidos.")
                    return
                  }

                  setIsAuthenticated(true)
                } catch (err: any) {
                  console.error(err)
                  setError(err?.message || "No fue posible validar el acceso.")
                }
              }}
              className="w-full rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              Ingresar
            </button>

            <div className="flex justify-center">
              <Link
                href="/"
                className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
              >
                Volver
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center text-white">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/75">
            🐾 FUNDACIÓN RUGIMOS 🐾
          </p>

          <h1 className="text-4xl font-bold md:text-5xl">Portal del Voluntario</h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm text-white/85 md:text-base">
            Bienvenido al Programa de Voluntariado Clínico. Desde aquí podrá consultar su
            asignación del día, registrar su asistencia y dar seguimiento a su progreso.
          </p>

          <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-full bg-white/15">
            <div className="h-2 bg-[#f47c3c]" style={{ width: `${progresoDias}%` }} />
          </div>

          <p className="mt-3 text-sm text-white/85">
            Progreso hacia el certificado: {progresoDias}%
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-[24px] border border-[#f3c6c6] bg-[#fff1f1] p-4 text-sm text-[#b53a3a] shadow-md">
            <p className="font-semibold">Revisar</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-6 rounded-[24px] border border-[#d1e7dd] bg-[#e8f5e9] p-4 text-sm text-[#2e7d32] shadow-md">
            <p className="font-semibold">Excelente</p>
            <p className="mt-1">{successMessage}</p>
          </div>
        ) : null}

        <div className="mb-6 rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
          <h2 className="mb-5 text-xl font-bold text-[#0b6665]">Resumen del voluntario</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="Código" value={voluntario?.codigo || "-"} />
            <InfoPill label="Nombre" value={voluntario?.nombre_completo || "-"} />
            <InfoPill label="Estado" value={getStatusLabel(voluntario?.estado)} />
            <InfoPill label="Nivel" value={getNivelLabel(voluntario?.nivel)} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="Días programados" value={String(voluntario?.dias_programados || 0)} />
            <InfoPill label="Días asistidos" value={String(voluntario?.dias_asistidos || 0)} />
            <InfoPill label="Faltas" value={String(voluntario?.dias_falta || 0)} />
            <InfoPill
              label="% asistencia"
              value={`${Number(voluntario?.porcentaje_asistencia || 0).toFixed(2)}%`}
            />
          </div>

          {(voluntario?.universidad || voluntario?.carrera || voluntario?.semestre_ano) && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="grid gap-2 md:grid-cols-3">
                <p>
                  <span className="font-semibold text-[#0b6665]">Universidad:</span>{" "}
                  {voluntario?.universidad || "-"}
                </p>
                <p>
                  <span className="font-semibold text-[#0b6665]">Carrera:</span>{" "}
                  {voluntario?.carrera || "-"}
                </p>
                <p>
                  <span className="font-semibold text-[#0b6665]">Semestre / año:</span>{" "}
                  {voluntario?.semestre_ano || "-"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="mb-5 text-xl font-bold text-[#0b6665]">Asignación de hoy</h2>

            {asignacionHoy ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InfoPill label="Fecha" value={formatDate(asignacionHoy.fecha)} />
                  <InfoPill
                    label="Horario"
                    value={`${formatTime(asignacionHoy.hora_inicio)} - ${formatTime(asignacionHoy.hora_fin)}`}
                  />
                  <InfoPill label="Clínica" value={clinicName} />
                  <InfoPill
                    label="Estado de asignación"
                    value={
                      asignacionHoy.estado === "asistio"
                        ? "Asistencia registrada"
                        : asignacionHoy.estado === "programado"
                          ? "Programado para hoy"
                          : asignacionHoy.estado
                    }
                  />
                </div>

                {clinicaHoy?.endereco ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-[#0b6665]">Dirección:</span>{" "}
                    {clinicaHoy.endereco}
                  </div>
                ) : null}

                {clinicaHoy?.telefono ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-[#0b6665]">Teléfono clínica:</span>{" "}
                    {clinicaHoy.telefono}
                  </div>
                ) : null}

                {asignacionHoy.observacion ? (
                  <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] px-4 py-3 text-sm text-[#8f4f24]">
                    <span className="font-semibold">Observación:</span> {asignacionHoy.observacion}
                  </div>
                ) : null}

                <div className="mt-6 rounded-[24px] border border-[#d1e7dd] bg-[#eef8f7] p-5">
                  {checkinHoy ? (
                    <div>
                      <p className="text-lg font-bold text-[#0b6665]">
                        ✅ Check-in ya registrado hoy
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        Hora registrada: {formatDateTime(checkinHoy.hora_checkin)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-bold text-[#0b6665]">
                        Registro de asistencia del día
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        Al llegar a la clínica, registre su asistencia para que quede constancia de
                        su participación y se actualice su progreso hacia el certificado.
                      </p>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleCheckin}
                          disabled={
                            submitting ||
                            !voluntario ||
                            !["aprobado", "activo"].includes(voluntario.estado) ||
                            !canCheckInByTime ||
                            userLat == null ||
                            userLng == null
                          }
                          className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
                        >
                          {submitting ? "Registrando..." : "Hacer check-in"}
                        </button>

                        {clinicaHoy?.maps_url ? (
                          <a
                            href={clinicaHoy.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b6665] ring-1 ring-slate-200 transition hover:scale-[1.02]"
                          >
                            Ver ubicación
                          </a>
                        ) : null}
                      </div>

                      {!canCheckInByTime ? (
                        <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] px-4 py-3 text-sm text-[#8f4f24]">
                          El check-in solo está habilitado dentro del horario asignado:{" "}
                          {formatTime(asignacionHoy?.hora_inicio)} - {formatTime(asignacionHoy?.hora_fin)}.
                        </div>
                      ) : null}

                      {locationError ? (
                        <div className="mt-4 rounded-2xl border border-[#f3c6c6] bg-[#fff1f1] px-4 py-3 text-sm text-[#b53a3a]">
                          {locationError}
                        </div>
                      ) : null}

                      {voluntario && !["aprobado", "activo"].includes(voluntario.estado) ? (
                        <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] px-4 py-3 text-sm text-[#8f4f24]">
                          Tu perfil todavía no está habilitado para registrar check-in.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-5 text-sm text-[#8f4f24]">
                <p className="font-semibold">Sin asignación para hoy</p>
                <p className="mt-2">
                  Hoy no tienes una asignación registrada. Si crees que esto es un error, consulta
                  con el equipo de Fundación Rugimos.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="mb-5 text-xl font-bold text-[#0b6665]">Estado del certificado</h2>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#0b6665]/70">
                Situación actual
              </p>
              <p className="mt-2 text-lg font-bold text-slate-800">{certificateStatus}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-[#0b6665]">Meta mínima:</span> 30 días en el
                programa y 90% de presencia.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-[#0b6665]">Días asistidos:</span>{" "}
                {voluntario?.dias_asistidos || 0}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-[#0b6665]">% actual:</span>{" "}
                {Number(voluntario?.porcentaje_asistencia || 0).toFixed(2)}%
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-3 bg-[#f47c3c] transition-all"
                style={{ width: `${progresoDias}%` }}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[#d1e7dd] bg-[#eef8f7] p-4 text-sm text-slate-700">
              {voluntario?.certificado_emitido ? (
                <p className="font-semibold text-[#2e7d32]">
                  Tu certificado ya fue emitido por Fundación Rugimos.
                </p>
              ) : voluntario?.certificado_elegible ? (
                <p className="font-semibold text-[#2e7d32]">
                  ¡Felicidades! Ya cumples con los requisitos mínimos para tu certificado.
                </p>
              ) : (
                <p>
                  Sigue registrando tu asistencia y cumpliendo tu asignación para avanzar hacia el
                  certificado.
                </p>
              )}
            </div>

            {voluntario?.observaciones_admin ? (
              <div className="mt-4 rounded-2xl border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24]">
                <p className="font-semibold">Nota del equipo</p>
                <p className="mt-2">{voluntario.observaciones_admin}</p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
          <h2 className="text-center text-2xl font-bold text-[#0b6665]">
            Recomendaciones del programa
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdviceCard
              title="Puntualidad"
              text="Procure llegar con anticipación para registrarse y adaptarse al flujo de la clínica."
            />
            <AdviceCard
              title="Supervisión"
              text="Todas las actividades deben realizarse bajo el manejo y criterio del equipo clínico responsable."
            />
            <AdviceCard
              title="Compromiso"
              text="Su asistencia y conducta forman parte del seguimiento interno del programa y del criterio para certificación."
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
            >
              Volver
            </Link>

            <button
              type="button"
              onClick={loadData}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b6665] ring-1 ring-slate-200 transition hover:scale-[1.02]"
            >
              Actualizar información
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function InfoPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0b6665]/70">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}

function AdviceCard({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-base font-bold text-[#0b6665]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  )
}