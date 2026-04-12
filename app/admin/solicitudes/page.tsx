"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { supabase } from "@/lib/supabase"
import { verificarBloqueioClinica } from "@/lib/agenda-clinicas"
import QRCode from "qrcode"

type Solicitud = {
  id: string
  codigo: string
  nombre_completo: string
  celular: string
  ubicacion: string
  lat?: number | null
  lng?: number | null
  nombre_animal: string
  especie: string
  sexo: string
  edad: string
  peso: string
  tipo_animal: string
  estado: string
  ci: string | null
  created_at: string
  foto_frente: string | null
  foto_lado: string | null
  foto_carnet: string | null

  tamano?: string | null
  vacunado?: boolean
  desparasitado?: boolean
  requiere_valoracion_prequirurgica?: boolean
}

type Clinica = {
  id: string
  nome: string
  endereco: string
  lat: number
  lng: number
  maps_url?: string | null
  zona: string | null
  telefono: string | null
  ativa: boolean
  acepta_perros: boolean
  acepta_gatos: boolean
  acepta_machos: boolean
  acepta_hembras: boolean
  acepta_calle: boolean
  acepta_propio: boolean
  dias_funcionamento?: string[] | null
}

type HorarioClinica = {
  id: string
  clinica_id: string
  hora: string
  cupos?: number
  ocupados?: number
  cupos_maximos?: number
}

type CupoDiario = {
  id: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  ocupados: number
}

type AsignacionPreview = {
  solicitud: Solicitud
  clinica: Clinica
  horario: HorarioClinica
  fecha: string
  cupoDiario: CupoDiario
  cuposRestantesDespues: number
}

type HorarioDisponible = HorarioClinica & {
  cupoDiario: CupoDiario
  disponibles: number
  agotado: boolean
}



async function obtenerCupoProgramado(
  clinicaId: string,
  horarioId: string,
  fecha: string,
  cupoBase: number
) {
  const { data: especialFecha, error: errorFecha } = await supabase
    .from("cupos_horario_fecha_especifica")
    .select("cupos")
    .eq("clinica_id", clinicaId)
    .eq("horario_id", horarioId)
    .eq("fecha", fecha)
    .eq("activo", true)
    .maybeSingle()

  if (errorFecha) {
    console.error("Error cupo fecha específica:", errorFecha)
  }

  if (especialFecha && Number.isFinite(Number(especialFecha.cupos))) {
    return Number(especialFecha.cupos)
  }

  const diaSemana = new Date(`${fecha}T12:00:00`).getDay()

  const { data: especialDia, error: errorDia } = await supabase
    .from("cupos_horario_dia_semana")
    .select("cupos")
    .eq("clinica_id", clinicaId)
    .eq("horario_id", horarioId)
    .eq("dia_semana", diaSemana)
    .eq("activo", true)
    .maybeSingle()

  if (errorDia) {
    console.error("Error cupo día semana:", errorDia)
  }

  if (especialDia && Number.isFinite(Number(especialDia.cupos))) {
    return Number(especialDia.cupos)
  }

  return cupoBase
}

export default function AdminSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loadingLista, setLoadingLista] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const [fotoSeleccionada, setFotoSeleccionada] = useState<string | null>(null)
  const [galeriaFotos, setGaleriaFotos] = useState<string[]>([])
  const [indiceFoto, setIndiceFoto] = useState(0)

  const [busqueda, setBusqueda] = useState("")
  const [busquedaAplicada, setBusquedaAplicada] = useState("")
  const [zonaFiltro, setZonaFiltro] = useState("Todos")
  const [tipoFiltro, setTipoFiltro] = useState("Todos")
  const [sexoFiltro, setSexoFiltro] = useState("Todos")
  const [zonas, setZonas] = useState<{ value: string; label: string }[]>([])
  const [especieFiltro, setEspecieFiltro] = useState("Todos")

  const [pagina, setPagina] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)

  const [asignacionPreview, setAsignacionPreview] = useState<AsignacionPreview | null>(null)

  const [clinicasDisponibles, setClinicasDisponibles] = useState<Clinica[]>([])
  const [horariosDisponibles, setHorariosDisponibles] = useState<HorarioDisponible[]>([])
  const [clinicaEditId, setClinicaEditId] = useState("")
  const [fechaEdit, setFechaEdit] = useState("")
  const [horarioEditId, setHorarioEditId] = useState("")
  const [recalculandoPreview, setRecalculandoPreview] = useState(false)

  const [mostrarPreviewWpp, setMostrarPreviewWpp] = useState(false)

  const [mostrarModalRechazo, setMostrarModalRechazo] = useState(false)
  const [solicitudARechazar, setSolicitudARechazar] = useState<Solicitud | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [detalleRechazo, setDetalleRechazo] = useState("")

  const porPagina = 10

    const MOTIVOS_RECHAZO = [
    "Animal gestante",
    "Animal en período de lactancia",
    "Foto ilegible o insuficiente",
    "Caso que requiere valoración veterinaria presencial",
    "Datos incompletos o inconsistentes",
    "No cumple criterios de campaña",
    "Otro",
  ]

  useEffect(() => {
  fetchZonas()
}, [])

useEffect(() => {
  fetchSolicitudes()
}, [pagina, busquedaAplicada, zonaFiltro, tipoFiltro, sexoFiltro, especieFiltro])

  function aplicarBusqueda() {
    setPagina(1)
    setBusquedaAplicada(busqueda.trim())
  }

  function limpiarFiltros() {
    setBusqueda("")
    setBusquedaAplicada("")
    setZonaFiltro("Todos")
    setTipoFiltro("Todos")
    setSexoFiltro("Todos")
    setEspecieFiltro("Todos")
    setPagina(1)
  }

  async function fetchZonas() {
  const [
    { data: solicitudesData, error: solicitudesError },
    { data: zonasData, error: zonasError },
  ] = await Promise.all([
    supabase
      .from("solicitudes")
      .select("ubicacion")
      .eq("estado", "Pendiente")
      .not("ubicacion", "is", null),

    supabase
      .from("zonas")
      .select("nombre, nombre_publico")
      .eq("activa", true),
  ])

  if (solicitudesError) {
    console.error("Error cargando zonas desde solicitudes:", solicitudesError)
    return
  }

  if (zonasError) {
    console.error("Error cargando zonas desde tabla zonas:", zonasError)
    return
  }

  const zonasDesdeSolicitudes = Array.from(
    new Set(
      (solicitudesData || [])
        .map((item: any) => String(item.ubicacion || "").trim())
        .filter(Boolean)
    )
  )

  const mapaZonas = new Map<string, string>()

  for (const z of zonasData || []) {
    const nombre = String(z.nombre || "").trim()
    const nombrePublico = String(z.nombre_publico || z.nombre || "").trim()

    if (nombre) {
      mapaZonas.set(nombre, nombrePublico)
    }
  }

  const zonasTabla = (zonasData || [])
    .map((z: any) => String(z.nombre || "").trim())
    .filter(Boolean)

  const todasLasZonas = Array.from(
    new Set([...zonasDesdeSolicitudes, ...zonasTabla])
  ).sort((a, b) => a.localeCompare(b))

  const resultado = todasLasZonas.map((zona) => ({
    value: zona,
    label: mapaZonas.get(zona) || zona,
  }))

  setZonas(resultado)
}

  async function fetchSolicitudes() {
  setLoadingLista(true)

  try {
    const params = new URLSearchParams({
      pagina: String(pagina),
      zona: zonaFiltro,
      tipo: tipoFiltro,
      sexo: sexoFiltro,
      especie: especieFiltro,
      busqueda: busquedaAplicada,
    })

    const res = await fetch(`/api/solicitudes?${params.toString()}`)
    const json = await res.json()

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Error cargando solicitudes")
    }

    setSolicitudes(json.data || [])
    setTotalRegistros(json.total || 0)
  } catch (error) {
    console.error(error)
  } finally {
    setLoadingLista(false)
  }
}

  function getLocalDateString(offsetDays = 0) {
    const now = new Date()
    now.setDate(now.getDate() + offsetDays)

    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)

    return local.toISOString().split("T")[0]
  }

  function obtenerDiaSemana(fecha: string) {
    const diasMap: Record<number, string> = {
      0: "domingo",
      1: "lunes",
      2: "martes",
      3: "miercoles",
      4: "jueves",
      5: "viernes",
      6: "sabado",
    }

    const numero = new Date(`${fecha}T12:00:00`).getDay()
    return diasMap[numero]
  }

  function clinicaAbreEseDia(clinica: Clinica, fecha: string) {
    if (!clinica.dias_funcionamento || clinica.dias_funcionamento.length === 0) {
      return true
    }

    const dia = obtenerDiaSemana(fecha)
    return clinica.dias_funcionamento.includes(dia)
  }

  function formatFecha(fechaISO: string) {
    const [year, month, day] = fechaISO.split("-")
    return `${day}/${month}/${year}`
  }

    function abrirModalRechazo(solicitud: Solicitud) {
  console.log("ABRIENDO MODAL", solicitud)
  setSolicitudARechazar(solicitud)
  setMotivoRechazo("")
  setDetalleRechazo("")
  setMostrarModalRechazo(true)
}

  function cerrarModalRechazo() {
    setMostrarModalRechazo(false)
    setSolicitudARechazar(null)
    setMotivoRechazo("")
    setDetalleRechazo("")
  }

  function construirMotivoFinal(motivo: string, detalle?: string) {
    const detalleLimpio = (detalle || "").replace(/\s+/g, " ").trim()

    if (!detalleLimpio) return motivo

    return `${motivo}: ${detalleLimpio}`.slice(0, 180)
  }

  async function enviarWhatsappRechazoAutomatico(
    solicitud: Solicitud,
    codigoGenerado: string,
    motivoFinal: string
  ) {
    const payload = {
      registro_id: null,
      telefono: solicitud.celular,
      tipo_mensaje: "rechazo_solicitud",
      variables: {
        "1": solicitud.nombre_completo || "Responsable",
        "2": solicitud.nombre_animal || "su mascota",
        "3": motivoFinal,
      },
      payload_extra: {
        solicitud_id: solicitud.id,
        codigo: codigoGenerado,
        motivo_rechazo: motivoFinal,
      },
    }

    const res = await fetch("/api/send-whatsapp-template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          data?.moreInfo ||
          `No se pudo enviar el WhatsApp automático de rechazo (status ${res.status})`
      )
    }

    return data
  }

  function construirMensajeWhatsappRechazo(
    solicitud: Solicitud,
    codigoGenerado: string,
    motivoFinal: string
  ) {
    return (
      "🐾 *FUNDACIÓN RUGIMOS* 🐾\n\n" +
      "Hola " +
      (solicitud.nombre_completo || "") +
      ".\n\n" +
      "Revisamos la solicitud de *" +
      solicitud.nombre_animal +
      "* y por el momento no puede ser aprobada.\n\n" +
      "📌 *Código Rugimos*\n" +
      codigoGenerado +
      "\n\n" +
      "📋 *Motivo*\n" +
      motivoFinal +
      "\n\n" +
      "Si la situación cambia o puede corregirse, puede enviar una nueva solicitud.\n\n" +
      "💚 Gracias por su comprensión."
    )
  }

  const enviarWhatsapp = (telefono: string, mensaje: string) => {
    const tel = telefono.replace(/\D/g, "")
    const msg = encodeURIComponent(mensaje)
    const url = `https://api.whatsapp.com/send?phone=591${tel}&text=${msg}`

    window.open(url, "_blank")
  }

  async function enviarWhatsappAutomatico(
  solicitud: Solicitud,
  clinica: Clinica,
  fecha: string,
  hora: string,
  codigoGenerado: string,
  registroId: string
) {
  const linkQR = `https://fundacion-rugimos.vercel.app/paciente/${codigoGenerado}`
const linkMapa = String(clinica.maps_url || "").trim()

  const payload = {
    registro_id: registroId,
    telefono: solicitud.celular,
    tipo_mensaje: "confirmacion_cupo",
    variables: {
      "1": codigoGenerado,
      "2": `${solicitud.nombre_animal} (${solicitud.especie})`,
      "3": clinica.nome,
      "4": clinica.endereco,
      "5": formatFecha(fecha),
      "6": hora,
      "7": clinica.telefono || "No disponible",
      "8": String(linkMapa || ""),
      "9": String(linkQR || ""),
    },
    payload_extra: {
      clinica_id: clinica.id,
      clinica_nombre: clinica.nome,
      fecha_programada: fecha,
      hora_programada: hora,
      codigo: codigoGenerado,
      solicitud_id: solicitud.id,
    },
  }

  console.log("Payload WhatsApp automático:", payload)

  const res = await fetch("/api/send-whatsapp-template", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  console.log("Respuesta API WhatsApp:", data)

  if (!res.ok || !data?.ok) {
    throw new Error(
      data?.error ||
        data?.moreInfo ||
        `No se pudo enviar el WhatsApp automático (status ${res.status})`
    )
  }

  return data
}

  async function generarQR(codigo: string) {
    const url = `https://fundacion-rugimos.vercel.app/paciente/${codigo}`
    const qr = await QRCode.toDataURL(url)
    return qr
  }

  function codigoRugimosValido(codigo?: string | null) {
    if (!codigo) return false
    return /^RG\d{1,5}$/i.test(codigo.trim())
  }

  async function obtenerProximoCodigoRugimos() {
    const { data, error } = await supabase.rpc("generar_codigo_rg")

    if (error) {
      console.error(error)
      throw new Error("No se pudo generar el código Rugimos.")
    }

    if (!data) {
      throw new Error("No se recibió un código Rugimos válido.")
    }

    return String(data).trim().toUpperCase()
  }

  async function obtenerCodigoCorregido(solicitud: Solicitud) {
    if (codigoRugimosValido(solicitud.codigo)) {
      return solicitud.codigo.trim().toUpperCase()
    }

    return await obtenerProximoCodigoRugimos()
  }

  function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371

    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  function clinicaCompatible(solicitud: Solicitud, clinica: Clinica) {
    if (solicitud.especie === "Perro" && !clinica.acepta_perros) return false
    if (solicitud.especie === "Gato" && !clinica.acepta_gatos) return false

    if (solicitud.sexo === "Macho" && !clinica.acepta_machos) return false
    if (solicitud.sexo === "Hembra" && !clinica.acepta_hembras) return false

    if (solicitud.tipo_animal?.toLowerCase().includes("calle") && !clinica.acepta_calle) return false
    if (solicitud.tipo_animal === "Propio" && !clinica.acepta_propio) return false

    return true
  }

  function obtenerCuposHorario(horario: HorarioClinica) {
    return Number(horario?.cupos ?? horario?.cupos_maximos ?? 10)
  }

  async function obtenerOCrearCupoDiario(
  clinicaId: string,
  horario: HorarioClinica,
  fecha: string
) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from("cupos_diarios")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("horario_id", horario.id)
    .eq("fecha", fecha)
    .maybeSingle()

  if (errorBusqueda) {
    console.error(errorBusqueda)
    return null
  }

  const cupoBase = obtenerCuposHorario(horario)
  const cupoProgramado = await obtenerCupoProgramado(
    clinicaId,
    horario.id,
    fecha,
    cupoBase
  )

  if (existente) {
    const ocupadosActuales = Number(existente.ocupados || 0)
    const cupoFinal = Math.max(cupoProgramado, ocupadosActuales)

    if (Number(existente.cupos) !== cupoFinal) {
      const { data: actualizado, error: errorUpdate } = await supabase
        .from("cupos_diarios")
        .update({ cupos: cupoFinal })
        .eq("id", existente.id)
        .select("*")
        .single()

      if (errorUpdate) {
        console.error(errorUpdate)
        return existente as CupoDiario
      }

      return actualizado as CupoDiario
    }

    return existente as CupoDiario
  }

  const { data: nuevo, error: errorCreacion } = await supabase
    .from("cupos_diarios")
    .insert([
      {
        clinica_id: clinicaId,
        horario_id: horario.id,
        fecha,
        cupos: cupoProgramado,
        ocupados: 0,
      },
    ])
    .select("*")
    .single()

  if (errorCreacion) {
    console.error(errorCreacion)
    return null
  }

  return nuevo as CupoDiario
}

  async function buscarProximaCita(solicitud: Solicitud, clinicasOrdenadas: Clinica[]) {
    for (const clinica of clinicasOrdenadas) {
      if (!clinicaCompatible(solicitud, clinica)) continue

      const { data: horarios, error: horariosError } = await supabase
        .from("horarios_clinica")
        .select("*")
        .eq("clinica_id", clinica.id)
        .order("hora", { ascending: true })

      if (horariosError || !horarios || horarios.length === 0) continue

      for (let offset = 1; offset < 31; offset++) {
  const fecha = getLocalDateString(offset)

  if (!clinicaAbreEseDia(clinica, fecha)) {
    continue
  }

  const bloqueo = await verificarBloqueioClinica(clinica.id, fecha)

  if (bloqueo.bloqueado) {
    continue
  }

  for (const horario of horarios as HorarioClinica[]) {
          const cupoDiario = await obtenerOCrearCupoDiario(clinica.id, horario, fecha)

          if (!cupoDiario) continue

          if (Number(cupoDiario.ocupados) < Number(cupoDiario.cupos)) {
            return {
              clinica,
              horario,
              fecha,
              cupoDiario,
            }
          }
        }
      }
    }

    return null
  }

  function ordenarClinicasPorDistancia(solicitud: Solicitud, clinicas: Clinica[]) {
    const zonas: Record<string, { lat: number; lng: number }> = {
      Norte: { lat: -17.73, lng: -63.18 },
      Sur: { lat: -17.85, lng: -63.18 },
      Este: { lat: -17.78, lng: -63.15 },
      Oeste: { lat: -17.78, lng: -63.21 },
      Centro: { lat: -17.78, lng: -63.18 },
      "Centro-Norte": { lat: -17.74, lng: -63.18 },
      "Centro-Sur": { lat: -17.82, lng: -63.18 },
      "Plan 3000": { lat: -17.85, lng: -63.15 },
      "Pampa de la Isla": { lat: -17.77, lng: -63.13 },
    }

    let baseLat: number | null = null
    let baseLng: number | null = null

    if (solicitud.lat != null && solicitud.lng != null) {
      baseLat = Number(solicitud.lat)
      baseLng = Number(solicitud.lng)
    } else if (zonas[solicitud.ubicacion]) {
      baseLat = zonas[solicitud.ubicacion].lat
      baseLng = zonas[solicitud.ubicacion].lng
    }

    if (baseLat == null || baseLng == null) return clinicas

    return [...clinicas].sort((a, b) => {
      const distA = calcularDistancia(baseLat!, baseLng!, Number(a.lat), Number(a.lng))
      const distB = calcularDistancia(baseLat!, baseLng!, Number(b.lat), Number(b.lng))
      return distA - distB
    })
  }

  function abrirGaleria(solicitud: Solicitud, fotoInicial?: string | null) {
    const fotos = [solicitud.foto_frente, solicitud.foto_lado, solicitud.foto_carnet].filter(
      Boolean
    ) as string[]

    if (fotos.length === 0) return

    const index = fotoInicial ? Math.max(0, fotos.indexOf(fotoInicial)) : 0

    setGaleriaFotos(fotos)
    setIndiceFoto(index)
    setFotoSeleccionada(fotos[index])
  }

  function cerrarGaleria() {
    setFotoSeleccionada(null)
    setGaleriaFotos([])
    setIndiceFoto(0)
  }

  function fotoAnterior(e?: MouseEvent) {
    e?.stopPropagation()
    if (galeriaFotos.length <= 1) return

    const nuevoIndice = indiceFoto === 0 ? galeriaFotos.length - 1 : indiceFoto - 1
    setIndiceFoto(nuevoIndice)
    setFotoSeleccionada(galeriaFotos[nuevoIndice])
  }

  function fotoSiguiente(e?: MouseEvent) {
    e?.stopPropagation()
    if (galeriaFotos.length <= 1) return

    const nuevoIndice = indiceFoto === galeriaFotos.length - 1 ? 0 : indiceFoto + 1
    setIndiceFoto(nuevoIndice)
    setFotoSeleccionada(galeriaFotos[nuevoIndice])
  }

  async function cargarHorariosDeClinica(clinicaId: string) {
    const { data, error } = await supabase
      .from("horarios_clinica")
      .select("*")
      .eq("clinica_id", clinicaId)
      .order("hora", { ascending: true })

    if (error) {
      console.error(error)
      return []
    }

    return (data || []) as HorarioClinica[]
  }

  async function cargarHorariosDisponiblesParaFecha(
  clinicaId: string,
  fecha: string,
  clinicasBase?: Clinica[]
) {

  const baseClinicas = clinicasBase || clinicasDisponibles
  const clinica = baseClinicas.find((c) => c.id === clinicaId)

  if (!clinica) return []

  if (!clinicaAbreEseDia(clinica, fecha)) {
  return []
}

const bloqueo = await verificarBloqueioClinica(clinicaId, fecha)

if (bloqueo.bloqueado) {
  return []
}

  const horarios = await cargarHorariosDeClinica(clinicaId)

  const resultado: HorarioDisponible[] = []

  for (const horario of horarios) {

    const cupoDiario = await obtenerOCrearCupoDiario(clinicaId, horario, fecha)

    if (!cupoDiario) continue

    const disponibles = Number(cupoDiario.cupos) - Number(cupoDiario.ocupados)

    resultado.push({
      ...horario,
      cupoDiario,
      disponibles,
      agotado: disponibles <= 0,
    })
  }

  return resultado
}

  async function recalcularPreviewManual(
    solicitud: Solicitud,
    clinicaId: string,
    fecha: string,
    horarioId: string
  ) {
    setRecalculandoPreview(true)

    try {
      const clinica = clinicasDisponibles.find((c) => c.id === clinicaId)
      if (!clinica) return

      if (!clinicaCompatible(solicitud, clinica)) {
        alert("Esta clínica no es compatible con la solicitud.")
        return
      }

      if (!clinicaAbreEseDia(clinica, fecha)) {
  setHorariosDisponibles([])
  alert("La clínica no atiende en esa fecha.")
  return
}

const bloqueo = await verificarBloqueioClinica(clinicaId, fecha)

if (bloqueo.bloqueado) {
  setHorariosDisponibles([])
  alert(`La clínica está bloqueada en esa fecha: ${bloqueo.motivo}`)
  return
}

      const horariosFecha = await cargarHorariosDisponiblesParaFecha(clinicaId, fecha)
      setHorariosDisponibles(horariosFecha)

      const horarioElegido = horariosFecha.find((h) => h.id === horarioId)

      if (!horarioElegido) {
        const primerDisponible = horariosFecha.find((h) => !h.agotado)

        if (!primerDisponible) {
          alert("No hay horarios disponibles para esa clínica en esa fecha.")
          return
        }

        setHorarioEditId(primerDisponible.id)

        setAsignacionPreview({
          solicitud,
          clinica,
          horario: primerDisponible,
          fecha,
          cupoDiario: primerDisponible.cupoDiario,
          cuposRestantesDespues: primerDisponible.disponibles - 1,
        })

        return
      }

      if (horarioElegido.agotado) {
        alert("Ese horario ya no tiene cupos disponibles.")
        return
      }

      setAsignacionPreview({
        solicitud,
        clinica,
        horario: horarioElegido,
        fecha,
        cupoDiario: horarioElegido.cupoDiario,
        cuposRestantesDespues: horarioElegido.disponibles - 1,
      })
    } finally {
      setRecalculandoPreview(false)
    }
  }

  async function prepararAprobacion(solicitud: Solicitud) {
    setLoadingId(solicitud.id)

    try {
      const { data: clinicasActivas, error: clinicaError } = await supabase
        .from("clinicas")
        .select("*")
        .eq("ativa", true)

      if (clinicaError) {
        console.error(clinicaError)
        alert("Error buscando clínicas.")
        return
      }

      if (!clinicasActivas || clinicasActivas.length === 0) {
        alert("No se encontraron clínicas activas.")
        return
      }

      const todasClinicas = clinicasActivas as Clinica[]
      setClinicasDisponibles(todasClinicas)

      const clinicasMismaZona = todasClinicas.filter(
        (clinica) => clinica.zona === solicitud.ubicacion
      )

      const clinicasOtrasZonas = todasClinicas.filter(
        (clinica) => clinica.zona !== solicitud.ubicacion
      )

      const primeraPrioridad = ordenarClinicasPorDistancia(solicitud, clinicasMismaZona)
      const segundaPrioridad = ordenarClinicasPorDistancia(solicitud, clinicasOtrasZonas)

      let cita = await buscarProximaCita(solicitud, primeraPrioridad)

      if (!cita) {
        cita = await buscarProximaCita(solicitud, segundaPrioridad)
      }

      if (!cita) {
        alert("No hay cupos disponibles en clínicas compatibles y abiertas para los próximos días.")
        return
      }

      const horariosFecha = await cargarHorariosDisponiblesParaFecha(
         cita.clinica.id,
         cita.fecha,
        todasClinicas
     )
      setHorariosDisponibles(horariosFecha)

      setClinicaEditId(cita.clinica.id)
      setFechaEdit(cita.fecha)
      setHorarioEditId(cita.horario.id)

      const disponibles = Number(cita.cupoDiario.cupos) - Number(cita.cupoDiario.ocupados)

      setAsignacionPreview({
        solicitud,
        clinica: cita.clinica,
        horario: cita.horario,
        fecha: cita.fecha,
        cupoDiario: cita.cupoDiario,
        cuposRestantesDespues: disponibles - 1,
      })
    } finally {
      setLoadingId(null)
    }
  }

  async function cambiarClinicaEnPreview(nuevoClinicaId: string) {
    if (!asignacionPreview) return

    setClinicaEditId(nuevoClinicaId)
    setHorarioEditId("")
    setHorariosDisponibles([])

    const clinicaNueva = clinicasDisponibles.find((c) => c.id === nuevoClinicaId)
    if (!clinicaNueva) return

    if (!clinicaCompatible(asignacionPreview.solicitud, clinicaNueva)) {
      alert("Esta clínica no es compatible con la solicitud.")
      return
    }

    if (!clinicaAbreEseDia(clinicaNueva, fechaEdit)) {
  setAsignacionPreview((prev) =>
    prev
      ? {
          ...prev,
          clinica: clinicaNueva,
          fecha: fechaEdit,
        }
      : prev
  )
  alert("La clínica seleccionada no atiende en la fecha actual. Cambie la fecha.")
  return
}

const bloqueo = await verificarBloqueioClinica(clinicaNueva.id, fechaEdit)

if (bloqueo.bloqueado) {
  setAsignacionPreview((prev) =>
    prev
      ? {
          ...prev,
          clinica: clinicaNueva,
          fecha: fechaEdit,
        }
      : prev
  )
  setHorariosDisponibles([])
  alert(`La clínica está bloqueada en esa fecha: ${bloqueo.motivo}`)
  return
}

    const horariosFecha = await cargarHorariosDisponiblesParaFecha(nuevoClinicaId, fechaEdit)
    setHorariosDisponibles(horariosFecha)

    const primerDisponible = horariosFecha.find((h) => !h.agotado)

    if (!primerDisponible) {
      setAsignacionPreview((prev) =>
        prev
          ? {
              ...prev,
              clinica: clinicaNueva,
              fecha: fechaEdit,
            }
          : prev
      )
      alert("No hay horarios disponibles para esa clínica en esa fecha.")
      return
    }

    setHorarioEditId(primerDisponible.id)

    await recalcularPreviewManual(
      asignacionPreview.solicitud,
      nuevoClinicaId,
      fechaEdit,
      primerDisponible.id
    )
  }

  async function cambiarFechaEnPreview(nuevaFecha: string) {
    if (!asignacionPreview || !clinicaEditId) return

    setFechaEdit(nuevaFecha)

    const bloqueo = await verificarBloqueioClinica(clinicaEditId, nuevaFecha)

if (bloqueo.bloqueado) {
  setHorariosDisponibles([])
  setHorarioEditId("")
  alert(`La clínica está bloqueada en esa fecha: ${bloqueo.motivo}`)
  return
}

    const horariosFecha = await cargarHorariosDisponiblesParaFecha(clinicaEditId, nuevaFecha)
    setHorariosDisponibles(horariosFecha)

    const actualSigueDisponible = horariosFecha.find(
      (h) => h.id === horarioEditId && !h.agotado
    )

    const horarioUsar = actualSigueDisponible || horariosFecha.find((h) => !h.agotado)

    if (!horarioUsar) {
      setHorarioEditId("")
      alert("No hay horarios disponibles para esa fecha.")
      return
    }

    setHorarioEditId(horarioUsar.id)

    await recalcularPreviewManual(
      asignacionPreview.solicitud,
      clinicaEditId,
      nuevaFecha,
      horarioUsar.id
    )
  }

  async function cambiarHorarioEnPreview(nuevoHorarioId: string) {
    if (!asignacionPreview || !clinicaEditId || !fechaEdit) return

    setHorarioEditId(nuevoHorarioId)

    await recalcularPreviewManual(
      asignacionPreview.solicitud,
      clinicaEditId,
      fechaEdit,
      nuevoHorarioId
    )
  }

  function cerrarAsignacionPreview() {

  setAsignacionPreview(null)
  setClinicasDisponibles([])
  setHorariosDisponibles([])
  setClinicaEditId("")
  setFechaEdit("")
  setHorarioEditId("")
  setRecalculandoPreview(false)

  setMostrarPreviewWpp(false)
}

  async function crearOActualizarRegistroRechazado(
  solicitud: Solicitud,
  codigoFinal: string,
  motivo: string,
  detalle: string
) {
    const { data: existente, error: errorBusqueda } = await supabase
      .from("registros")
      .select("id,codigo")
      .eq("codigo", codigoFinal)
      .maybeSingle()

    if (errorBusqueda) {
      console.error(errorBusqueda)
      throw new Error("No se pudo verificar si el registro ya existe.")
    }

    const payload = {
      codigo: codigoFinal,
      nombre_responsable: solicitud.nombre_completo,
      telefono: solicitud.celular,
      ci: solicitud.ci,
      nombre_animal: solicitud.nombre_animal,
      especie: solicitud.especie,
      sexo: solicitud.sexo,
      edad: solicitud.edad,
      peso: solicitud.peso,
      tipo_animal: solicitud.tipo_animal,
      zona: solicitud.ubicacion,

tamano: solicitud.tamano || null,
vacunado: solicitud.vacunado ?? false,
desparasitado: solicitud.desparasitado ?? false,
requiere_valoracion_prequirurgica:
  solicitud.requiere_valoracion_prequirurgica ?? false,

      estado: "Rechazado",
      estado_cita: "Rechazado",
      estado_clinica: "Rechazado",
      foto_frente: solicitud.foto_frente,
      foto_lado: solicitud.foto_lado,
      foto_carnet: solicitud.foto_carnet,
      motivo_rechazo: motivo,
      detalle_rechazo: detalle || null,
    }

    if (existente) {
      const { error: errorUpdate } = await supabase
        .from("registros")
        .update(payload)
        .eq("id", existente.id)

      if (errorUpdate) {
        console.error(errorUpdate)
        throw new Error("No se pudo actualizar el registro rechazado.")
      }

      return
    }

    const { error: errorInsert } = await supabase
      .from("registros")
      .insert([payload])

    if (errorInsert) {
      console.error(errorInsert)
      throw new Error("No se pudo crear el registro rechazado.")
    }
  }

  function construirMensajeWhatsapp(
    solicitud: Solicitud,
    clinica: Clinica,
    fecha: string,
    hora: string,
    codigoGenerado: string
  ) {
    const linkQR = `https://fundacion-rugimos.vercel.app/paciente/${codigoGenerado}`
    const linkMapa = `https://www.google.com/maps?q=${clinica.lat},${clinica.lng}`

    return (
      "🐾 *FUNDACIÓN RUGIMOS* 🐾\n\n" +
      "Tu solicitud fue *APROBADA* ✅\n\n" +
      "📌 *Código Rugimos*\n" +
      codigoGenerado +
      "\n\n" +
      "🐶 *Mascota*\n" +
      solicitud.nombre_animal +
      " (" +
      solicitud.especie +
      ")\n\n" +
      "🏥 *Clínica asignada*\n" +
      clinica.nome +
      "\n\n" +
      "📍 *Dirección*\n" +
      clinica.endereco +
      "\n\n" +
      "📅 *Fecha de la cita*\n" +
      formatFecha(fecha) +
      "\n\n" +
      "🕒 *Hora de llegada*\n" +
      hora +
      "\n\n" +
      "📞 *Teléfono de la clínica*\n" +
      (clinica.telefono || "No disponible") +
      "\n\n" +
      "🗺️ *Ubicación en Google Maps*\n" +
      linkMapa +
      "\n\n" +
      "📲 *QR del paciente*\n" +
      linkQR +
      "\n\n" +
      "⚠️ *INSTRUCCIONES IMPORTANTES*\n\n" +
      "• Ayuno de comida: 8 horas\n" +
      "• Ayuno de agua: 4 horas\n" +
      "• Llevar una manta\n" +
      "• Llegar 15 minutos antes\n\n" +
      "🔬 *Para perras hembras*\n" +
      "Se requiere Hemograma + Urea + Creatinina\n\n" +
      "❗ Si no puede asistir, por favor avise con anticipación.\n\n" +
      "💚 Gracias por apoyar la esterilización responsable."
    )
  }

  async function confirmarAprobacion() {
  if (!asignacionPreview) return

  const { solicitud, clinica, horario, fecha, cupoDiario } = asignacionPreview
  setLoadingId(solicitud.id)

  try {
    const res = await fetch("/api/solicitudes/aprobar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        solicitudId: solicitud.id,
        clinicaId: clinica.id,
        horarioId: horario.id,
        fecha,
        cupoDiarioId: cupoDiario.id,
      }),
    })

    const json = await res.json()

    if (!res.ok || !json?.ok) {
      alert(json?.error || "No se pudo confirmar la aprobación.")
      await recalcularPreviewManual(solicitud, clinica.id, fecha, horario.id)
      return
    }

    const { registroId, codigoGenerado } = json.data

    const mensaje = construirMensajeWhatsapp(
      solicitud,
      clinica,
      fecha,
      horario.hora,
      codigoGenerado
    )

    try {
      await enviarWhatsappAutomatico(
        solicitud,
        clinica,
        fecha,
        horario.hora,
        codigoGenerado,
        registroId
      )
    } catch (error: any) {
      console.error("Error automático WhatsApp:", error)

      const errorMsg =
        error?.message || "No se pudo enviar el WhatsApp automático."

      const seguirManual = window.confirm(
        `La aprobación fue guardada, pero falló el envío automático.\n\nError: ${errorMsg}\n\n¿Desea abrir el WhatsApp manual para enviarlo ahora?`
      )

      if (seguirManual) {
        enviarWhatsapp(solicitud.celular, mensaje)
      }
    }

    cerrarAsignacionPreview()
    await fetchSolicitudes()
  } finally {
    setLoadingId(null)
  }
}

    const cambiarEstado = async (
    solicitud: Solicitud,
    nuevoEstado: string,
    motivo?: string,
    detalle?: string
  ) => {
    setLoadingId(solicitud.id)

    try {
      if (nuevoEstado === "Rechazado") {
        const motivoLimpio = (motivo || "").trim()

        if (!motivoLimpio) {
          alert("Debe seleccionar un motivo de rechazo.")
          return
        }

        const detalleLimpio = (detalle || "").trim()
        const codigoFinal = await obtenerCodigoCorregido(solicitud)
        const motivoFinal = construirMotivoFinal(motivoLimpio, detalleLimpio)

        const { error } = await supabase
          .from("solicitudes")
          .update({
            estado: "Rechazado",
            codigo: codigoFinal,
            motivo_rechazo: motivoLimpio,
            detalle_rechazo: detalleLimpio || null,
            rechazado_en: new Date().toISOString(),
            whatsapp_rechazo_enviado: false,
          })
          .eq("id", solicitud.id)

        if (error) {
          console.error(error)
          alert("No se pudo rechazar la solicitud.")
          return
        }

        await crearOActualizarRegistroRechazado(
          solicitud,
          codigoFinal,
          motivoLimpio,
          detalleLimpio
        )

        try {
          await enviarWhatsappRechazoAutomatico(
            solicitud,
            codigoFinal,
            motivoFinal
          )

          await supabase
            .from("solicitudes")
            .update({
              whatsapp_rechazo_enviado: true,
            })
            .eq("id", solicitud.id)
        } catch (error: any) {
          console.error("Error automático WhatsApp rechazo:", error)

          const mensajeManual = construirMensajeWhatsappRechazo(
            solicitud,
            codigoFinal,
            motivoFinal
          )

          const errorMsg =
            error?.message || "No se pudo enviar el WhatsApp automático."

          const seguirManual = window.confirm(
            `La solicitud fue rechazada, pero falló el envío automático.\n\nError: ${errorMsg}\n\n¿Desea abrir el WhatsApp manual para enviarlo ahora?`
          )

          if (seguirManual) {
            enviarWhatsapp(solicitud.celular, mensajeManual)
          }
        }

        cerrarModalRechazo()
        await fetchSolicitudes()
      }
    } catch (error: any) {
      console.error(error)
      alert(error.message || "Ocurrió un error al rechazar la solicitud.")
    } finally {
      setLoadingId(null)
    }
  }

async function confirmarRechazo() {
  if (!solicitudARechazar || !motivoRechazo) {
    alert("Debe seleccionar un motivo.")
    return
  }

  const motivoFinal = construirMotivoFinal(
    motivoRechazo,
    motivoRechazo === "Otro" ? detalleRechazo : ""
  )

  setLoadingId(solicitudARechazar.id)

  try {
    const res = await fetch("/api/solicitudes/rechazar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        solicitudId: solicitudARechazar.id,
        motivo: motivoFinal,
      }),
    })

    const json = await res.json()

    if (!res.ok || !json?.ok) {
      alert(json?.error || "No se pudo rechazar.")
      return
    }

    const { codigoGenerado } = json.data

    try {
      await enviarWhatsappRechazoAutomatico(
        solicitudARechazar,
        codigoGenerado,
        motivoFinal
      )
    } catch (error: any) {
      console.error("Error WhatsApp rechazo:", error)

      const mensajeManual = construirMensajeWhatsappRechazo(
        solicitudARechazar,
        codigoGenerado,
        motivoFinal
      )

      const seguirManual = window.confirm(
        "Falló el envío automático. ¿Desea enviarlo manualmente?"
      )

      if (seguirManual) {
        enviarWhatsapp(solicitudARechazar.celular, mensajeManual)
      }
    }

    cerrarModalRechazo()
    await fetchSolicitudes()
  } finally {
    setLoadingId(null)
  }
}

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / porPagina))

  const clinicasCompatiblesOrdenadas = useMemo(() => {
    if (!asignacionPreview) return []

    const mismaZona = clinicasDisponibles.filter(
      (c) =>
        clinicaCompatible(asignacionPreview.solicitud, c) &&
        c.zona === asignacionPreview.solicitud.ubicacion
    )

    const otras = clinicasDisponibles.filter(
      (c) =>
        clinicaCompatible(asignacionPreview.solicitud, c) &&
        c.zona !== asignacionPreview.solicitud.ubicacion
    )

    return [
      ...ordenarClinicasPorDistancia(asignacionPreview.solicitud, mismaZona),
      ...ordenarClinicasPorDistancia(asignacionPreview.solicitud, otras),
    ]
  }, [asignacionPreview, clinicasDisponibles])

  const mensajePreview = useMemo(() => {
    if (!asignacionPreview) return ""

    return construirMensajeWhatsapp(
      asignacionPreview.solicitud,
      asignacionPreview.clinica,
      asignacionPreview.fecha,
      asignacionPreview.horario.hora,
      "RG0000"
    )
  }, [asignacionPreview])

  return (
  <div className="min-h-screen bg-[#0f6d6a] p-6">
    <div className="max-w-[1700px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        
        <div>
          <h1 className="text-4xl font-bold text-white">
            Solicitudes Recibidas
          </h1>
          <p className="text-white/80 mt-2">
            Revisa, aprueba o rechaza solicitudes pendientes del sistema.
          </p>
        </div>

        <Link
          href="/admin"
          className="bg-white text-[#0f6d6a] px-5 py-3 rounded-2xl font-semibold shadow-lg hover:opacity-90 w-fit"
        >
          Volver al dashboard
        </Link>

      </div>

      <div className="flex gap-4 mb-8 flex-wrap items-center bg-white rounded-3xl shadow-xl p-4">
        <input
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicarBusqueda()
          }}
          className="border p-3 rounded-xl text-gray-800"
        />

        <button
          onClick={aplicarBusqueda}
          className="px-5 py-3 bg-[#02686A] text-white rounded-xl font-semibold"
        >
          Buscar
        </button>

        <select
  value={zonaFiltro}
  onChange={(e) => {
    setZonaFiltro(e.target.value)
    setPagina(1)
  }}
  className="border p-3 rounded-xl text-gray-800"
>
  <option value="Todos">Seleccionar zona</option>
  {zonas.map((zona) => (
    <option key={zona.value} value={zona.value}>
      {zona.label}
    </option>
  ))}
</select>

<select
  value={especieFiltro}
  onChange={(e) => {
    setEspecieFiltro(e.target.value)
    setPagina(1)
  }}
  className="border p-3 rounded-xl text-gray-800"
>
  <option value="Todos">Todos los animales</option>
  <option value="Perro">Perro</option>
  <option value="Gato">Gato</option>
</select>

        <select
          value={sexoFiltro}
          onChange={(e) => {
            setSexoFiltro(e.target.value)
            setPagina(1)
          }}
          className="border p-3 rounded-xl text-gray-800"
        >
          <option value="Todos">Todos los sexos</option>
          <option value="Macho">Macho</option>
          <option value="Hembra">Hembra</option>
        </select>

        <select
          value={tipoFiltro}
          onChange={(e) => {
            setTipoFiltro(e.target.value)
            setPagina(1)
          }}
          className="border p-3 rounded-xl text-gray-800"
        >
          <option value="Todos">Todos los tipos</option>
          <option value="Propio">Propio</option>
          <option value="Calle">De la calle</option>
        </select>

        <button
          onClick={limpiarFiltros}
          className="px-5 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold"
        >
          Limpiar
        </button>

        <div className="ml-auto text-sm text-gray-600 font-semibold">
          Total pendientes: <strong>{totalRegistros}</strong>
        </div>
      </div>

      {loadingLista ? (
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center text-gray-600">
          Cargando solicitudes...
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center text-gray-600">
          No hay solicitudes pendientes con esos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-8">
          {solicitudes.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-3xl shadow-xl p-5 border border-white hover:scale-[1.02] transition"
            >
              <p className="text-xs text-gray-400 mb-2 font-mono">{s.codigo}</p>

              <h2 className="text-lg font-bold text-[#0f6d6a] mb-3 leading-snug">
                {s.nombre_completo}
              </h2>

              <div className="text-sm text-gray-700 space-y-1 mb-3">
                <p><span className="font-semibold">Zona:</span> {s.ubicacion}</p>
                <p><span className="font-semibold">Animal:</span> {s.nombre_animal}</p>
                <p><span className="font-semibold">Especie:</span> {s.especie}</p>
                <p><span className="font-semibold">Sexo:</span> {s.sexo}</p>
                <p><span className="font-semibold">Tipo:</span> {s.tipo_animal}</p>
              </div>

              <div className="mt-3">
                {s.foto_frente ? (
                  <img
                    src={s.foto_frente}
                    loading="lazy"
                    className="w-full h-40 object-cover rounded-2xl cursor-pointer shadow-md"
                    onClick={() => abrirGaleria(s, s.foto_frente)}
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 rounded-2xl flex items-center justify-center text-sm text-gray-500">
                    Sin foto
                  </div>
                )}

                {(s.foto_lado || s.foto_carnet) && (
                  <button
                    onClick={() =>
                      abrirGaleria(s, s.foto_frente || s.foto_lado || s.foto_carnet)
                    }
                    className="mt-3 text-sm text-[#0f6d6a] font-medium underline hover:opacity-80"
                  >
                    Ver todas las fotos
                  </button>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  disabled={loadingId === s.id}
                  onClick={() => prepararAprobacion(s)}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition"
                >
                  {loadingId === s.id ? "Procesando..." : "Aprobar"}
                </button>

                <button
  disabled={loadingId === s.id}
  onClick={() => abrirModalRechazo(s)}
  className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition"
>
  Rechazar
</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-4 mt-10 items-center flex-wrap bg-white rounded-3xl shadow-xl p-4 max-w-fit mx-auto">
        <button
          disabled={pagina === 1 || loadingLista}
          onClick={() => setPagina((p) => p - 1)}
          className="px-4 py-2 bg-gray-200 rounded-xl disabled:opacity-50 font-semibold"
        >
          Anterior
        </button>

        <p className="font-semibold text-gray-800">
          Página {pagina} de {totalPaginas}
        </p>

        <button
          disabled={pagina === totalPaginas || loadingLista}
          onClick={() => setPagina((p) => p + 1)}
          className="px-4 py-2 bg-gray-200 rounded-xl disabled:opacity-50 font-semibold"
        >
          Siguiente
        </button>
      </div>

      {fotoSeleccionada && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4"
          onClick={cerrarGaleria}
        >
          <div className="relative flex items-center justify-center w-full max-w-5xl">
            {galeriaFotos.length > 1 && (
              <button
                onClick={fotoAnterior}
                className="absolute left-2 md:left-6 bg-white/90 hover:bg-white text-black rounded-full w-10 h-10 text-xl font-bold z-10"
              >
                ‹
              </button>
            )}

            <img
              src={fotoSeleccionada}
              loading="lazy"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-xl"
            />

            {galeriaFotos.length > 1 && (
              <button
                onClick={fotoSiguiente}
                className="absolute right-2 md:right-6 bg-white/90 hover:bg-white text-black rounded-full w-10 h-10 text-xl font-bold z-10"
              >
                ›
              </button>
            )}

            <button
              onClick={cerrarGaleria}
              className="absolute top-2 right-2 md:top-4 md:right-4 bg-black/70 text-white rounded-full w-10 h-10 text-xl"
            >
              ×
            </button>
          </div>
        </div>
      )}

           {asignacionPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={cerrarAsignacionPreview}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 md:p-8 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-[#0f6d6a] mb-2">
              Asignación automática
            </h2>

            <p className="text-gray-500 mb-6">
              Revise y, si desea, edite la clínica, fecha y horario antes de confirmar.
            </p>

            <div className="space-y-5">
              <div className="bg-[#0f6d6a]/5 border border-[#0f6d6a]/10 rounded-2xl p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Solicitud:</span>{" "}
                  {asignacionPreview.solicitud.nombre_completo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Mascota:</span>{" "}
                  {asignacionPreview.solicitud.nombre_animal} ({asignacionPreview.solicitud.especie})
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Sexo:</span>{" "}
                  {asignacionPreview.solicitud.sexo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Tipo:</span>{" "}
                  {asignacionPreview.solicitud.tipo_animal}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Zona:</span>{" "}
                  {asignacionPreview.solicitud.ubicacion}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Clínica
                  </label>
                  <select
                    value={clinicaEditId}
                    onChange={(e) => cambiarClinicaEnPreview(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    {clinicasCompatiblesOrdenadas.map((clinica) => (
                      <option key={clinica.id} value={clinica.id}>
                        {clinica.nome}
                        {clinica.zona ? ` — ${clinica.zona}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={fechaEdit}
                    min={getLocalDateString(1)}
                    onChange={(e) => cambiarFechaEnPreview(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Horario
                </label>
                {horariosDisponibles.length === 0 ? (
                  <div className="w-full border border-red-200 bg-red-50 rounded-2xl px-4 py-3 text-red-700 text-sm">
                    No hay horarios disponibles para esta clínica en esa fecha.
                  </div>
                ) : (
                  <select
                    value={horarioEditId}
                    onChange={(e) => cambiarHorarioEnPreview(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    {horariosDisponibles.map((horario) => (
                      <option
                        key={horario.id}
                        value={horario.id}
                        disabled={horario.agotado}
                      >
                        {horario.hora} —{" "}
                        {horario.agotado
                          ? "Sin cupos"
                          : `${horario.disponibles} cupo${horario.disponibles === 1 ? "" : "s"} disponible${horario.disponibles === 1 ? "" : "s"}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Fecha final</p>
                  <p className="font-bold text-gray-800">
                    {formatFecha(asignacionPreview.fecha)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Hora final</p>
                  <p className="font-bold text-gray-800">
                    {asignacionPreview.horario.hora}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-500">Cupos restantes después</p>
                  <p className="font-bold text-green-700">
                    {asignacionPreview.cuposRestantesDespues}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-sm text-gray-500">Clínica final</p>
                <p className="text-lg font-bold text-[#0f6d6a]">
                  {asignacionPreview.clinica.nome}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {asignacionPreview.clinica.endereco}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Teléfono: {asignacionPreview.clinica.telefono || "No disponible"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#F47C3C]/30 bg-gradient-to-br from-[#fff6f1] to-[#ffe8dc] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#b85722]">
                      Confirmación WhatsApp
                    </p>

                    <p className="text-xs text-gray-500">
                      Revise el mensaje antes de enviarlo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMostrarPreviewWpp(!mostrarPreviewWpp)}
                    className="px-4 py-2 rounded-xl bg-[#F47C3C] hover:bg-[#e06c2e] text-white text-sm font-semibold transition"
                  >
                    {mostrarPreviewWpp ? "Ocultar WhatsApp" : "Ver WhatsApp"}
                  </button>
                </div>

                {mostrarPreviewWpp && (
                  <div className="mt-4">
                    <div className="bg-white rounded-xl p-4 border text-xs text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {mensajePreview}
                    </div>
                  </div>
                )}
              </div>

              {recalculandoPreview && (
                <div className="text-sm text-amber-600 font-medium">
                  Recalculando disponibilidad...
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={cerrarAsignacionPreview}
                className="px-5 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarAprobacion}
                disabled={
                  loadingId === asignacionPreview.solicitud.id ||
                  recalculandoPreview ||
                  !horarioEditId ||
                  horariosDisponibles.length === 0
                }
                className="px-6 py-3 rounded-2xl bg-[#F47C3C] text-white font-semibold disabled:opacity-60"
              >
                {loadingId === asignacionPreview.solicitud.id
                  ? "Confirmando..."
                  : "Confirmar aprobación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalRechazo && solicitudARechazar && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={cerrarModalRechazo}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Rechazar solicitud
            </h2>

            <p className="text-gray-500 mb-6">
              Seleccione el motivo y, si desea, agregue un detalle corto.
            </p>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Responsable:</span>{" "}
                {solicitudARechazar.nombre_completo}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Mascota:</span>{" "}
                {solicitudARechazar.nombre_animal} ({solicitudARechazar.especie})
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Motivo
                </label>

                <select
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                >
                  <option value="">Seleccione un motivo</option>
                  {MOTIVOS_RECHAZO.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Detalle corto opcional
                </label>

                <textarea
                  value={detalleRechazo}
                  onChange={(e) => setDetalleRechazo(e.target.value.slice(0, 120))}
                  rows={3}
                  placeholder="Ej.: no se visualiza correctamente el abdomen"
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 resize-none"
                />

                <p className="text-xs text-gray-400 mt-2">
                  {detalleRechazo.length}/120 caracteres
                </p>
              </div>

              <div className="rounded-2xl border border-[#F47C3C]/30 bg-gradient-to-br from-[#fff6f1] to-[#ffe8dc] p-4">
                <p className="text-sm font-bold text-[#b85722] mb-2">
                  Vista previa del motivo
                </p>
                <div className="bg-white rounded-xl p-3 border text-sm text-gray-700">
                  {motivoRechazo
                    ? construirMotivoFinal(motivoRechazo, detalleRechazo)
                    : "Aquí verá el motivo final que se enviará por WhatsApp"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={cerrarModalRechazo}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={loadingId === solicitudARechazar.id}
                onClick={confirmarRechazo}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-60 hover:opacity-90 transition"
              >
                {loadingId === solicitudARechazar.id ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  )
}