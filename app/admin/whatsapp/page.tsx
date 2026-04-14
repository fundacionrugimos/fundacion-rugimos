"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type WhatsappLog = {
  id: string
  created_at: string
  registro_id: string | null
  telefono: string | null
  tipo_mensaje: string
  template_sid: string | null
  estado: string
  mensaje_sid: string | null
  error_texto: string | null
  payload: any
}

type Registro = {
  id: string
  codigo: string | null
  nombre_animal: string | null
  nombre_responsable?: string | null
  telefono: string | null
  clinica_id: string | null
  fecha_programada: string | null
  fecha_cirugia_realizada: string | null
  hora: string | null
  estado_cita: string | null
  estado_clinica: string | null
  recordatorio_24h_enviado: boolean | null
  agradecimiento_enviado: boolean | null
  seguimiento_7d_enviado?: boolean | null
  seguimiento_7d_respondido?: boolean | null
}

type Clinica = {
  id: string
  nome: string | null
  endereco: string | null
  telefono: string | null
  lat?: number | null
  lng?: number | null
  maps_url?: string | null
}

type PendingItem = {
  id: string
  registro_id: string
  tipo_mensaje:
    | "confirmacion_cupo"
    | "recordatorio_24h"
    | "agradecimiento_postcirugia"
    | "seguimiento_7d"
  telefono: string | null
  nombre_animal: string | null
  codigo: string | null
  clinica_nombre: string | null
  fecha_ref: string | null
  hora_ref: string | null
  motivo: string
  registro: Registro
  clinica?: Clinica | null
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return "-"
  const d = new Date(fecha)
  return d.toLocaleString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatearFechaSolo(fecha?: string | null) {
  if (!fecha) return "-"
  const [y, m, d] = fecha.split("-")
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

function traducirTipo(tipo: string) {
  if (tipo === "confirmacion_cupo") return "Confirmación de cupo"
  if (tipo === "recordatorio_24h") return "Recordatorio 24h"
  if (tipo === "agradecimiento_postcirugia") return "Agradecimiento"
  if (tipo === "seguimiento_7d") return "Seguimiento 7 días"
  return tipo
}

function colorEstado(estado: string) {
  if (estado === "enviado") {
    return "bg-green-100 text-green-700 border-green-200"
  }

  if (estado === "error") {
    return "bg-red-100 text-red-700 border-red-200"
  }

  return "bg-yellow-100 text-yellow-700 border-yellow-200"
}

function colorTipo(tipo: string) {
  if (tipo === "confirmacion_cupo") {
    return "bg-[#EAF8F5] text-[#0f6d6a]"
  }

  if (tipo === "recordatorio_24h") {
    return "bg-[#FFF4E8] text-[#b85722]"
  }

  if (tipo === "agradecimiento_postcirugia") {
    return "bg-[#F3F0FF] text-[#6b46c1]"
  }

  if (tipo === "seguimiento_7d") {
    return "bg-[#E8F0FF] text-[#1d4ed8]"
  }

  return "bg-gray-100 text-gray-700"
}

function getLocalDateString(offsetDays = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)

  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)

  return local.toISOString().split("T")[0]
}

function normalizarTelefonoParaBusqueda(telefono?: string | null) {
  return (telefono || "").replace(/\D/g, "")
}

function construirMensajeDesdeLog(log: WhatsappLog) {
  const vars = log.payload?.variables || {}
  const extra = log.payload?.payload_extra || {}

  if (log.tipo_mensaje === "confirmacion_cupo") {
    return (
      "🐾 *FUNDACIÓN RUGIMOS* 🐾\n\n" +
      "Tu solicitud fue *APROBADA* ✅\n\n" +
      "📌 *Código Rugimos*\n" +
      (vars["1"] || extra?.codigo || "-") +
      "\n\n" +
      "🐶 *Mascota*\n" +
      (vars["2"] || "-") +
      "\n\n" +
      "🏥 *Clínica asignada*\n" +
      (vars["3"] || extra?.clinica_nombre || "-") +
      "\n\n" +
      "📍 *Dirección*\n" +
      (vars["4"] || "-") +
      "\n\n" +
      "📅 *Fecha de la cita*\n" +
      (vars["5"] || "-") +
      "\n\n" +
      "🕒 *Hora de llegada*\n" +
      (vars["6"] || extra?.hora_programada || "-") +
      "\n\n" +
      "📞 *Teléfono de la clínica*\n" +
      (vars["7"] || "-") +
      "\n\n" +
      "🗺️ *Ubicación en Google Maps*\n" +
      (vars["8"] || "-") +
      "\n\n" +
      "📲 *QR del paciente*\n" +
      (vars["9"] || "-") +
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

  if (log.tipo_mensaje === "recordatorio_24h") {
    return (
      "🐾 *RECORDATORIO FUNDACIÓN RUGIMOS* 🐾\n\n" +
      "Le recordamos la cirugía programada para mañana.\n\n" +
      "📌 *Código*\n" + (vars["1"] || "-") + "\n\n" +
      "🐶 *Mascota*\n" + (vars["2"] || "-") + "\n\n" +
      "🏥 *Clínica*\n" + (vars["3"] || "-") + "\n\n" +
      "📍 *Dirección*\n" + (vars["4"] || "-") + "\n\n" +
      "📅 *Fecha*\n" + (vars["5"] || "-") + "\n\n" +
      "🕒 *Hora*\n" + (vars["6"] || "-") + "\n\n" +
      "🗺️ *Mapa*\n" + (vars["7"] || "-") + "\n\n" +
      "📲 *QR*\n" + (vars["8"] || "-")
    )
  }

  if (log.tipo_mensaje === "agradecimiento_postcirugia") {
    return (
      "💚 *FUNDACIÓN RUGIMOS* 💚\n\n" +
      "Gracias por confiar en nuestro programa de esterilización.\n\n" +
      "🐶 *Mascota*\n" + (vars["1"] || "-") + "\n\n" +
      "📌 *Código*\n" + (vars["2"] || "-") + "\n\n" +
      "Gracias por apoyar la esterilización responsable."
    )
  }

  if (log.tipo_mensaje === "seguimiento_7d") {
    return (
      "🐾 *FUNDACIÓN RUGIMOS* 🐾\n\n" +
      "Hola 😊\n" +
      "Esperamos que *" + (vars["1"] || extra?.nombre_animal || "su mascota") + "* se encuentre muy bien luego de su esterilización.\n\n" +
      "Nos ayudaría mucho que complete esta breve encuesta de seguimiento postoperatorio.\n\n" +
      "📌 *Código*\n" + (vars["2"] || extra?.codigo || "-") + "\n\n" +
      "🔗 *Encuesta*\n" + (vars["3"] || extra?.link || "-") + "\n\n" +
      "Muchas gracias por su apoyo y confianza 💚"
    )
  }

  return JSON.stringify(log.payload || {}, null, 2)
}

export default function AdminWhatsappPage() {
  const [aba, setAba] = useState<"historial" | "pendientes">("historial")
  const [loading, setLoading] = useState(true)

  const [logs, setLogs] = useState<WhatsappLog[]>([])
  const [totalLogs, setTotalLogs] = useState(0)

  const [pendientes, setPendientes] = useState<PendingItem[]>([])
  const [totalPendientes, setTotalPendientes] = useState(0)

  const [pagina, setPagina] = useState(1)
  const porPagina = 20

  const [tipoFiltro, setTipoFiltro] = useState("Todos")
  const [estadoFiltro, setEstadoFiltro] = useState("Todos")
  const [busqueda, setBusqueda] = useState("")
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  const [logPreview, setLogPreview] = useState<WhatsappLog | null>(null)
  const [modalPreviewAbierto, setModalPreviewAbierto] = useState(false)

  function abrirPreviewMensaje(log: WhatsappLog) {
    setLogPreview(log)
    setModalPreviewAbierto(true)
  }

  function cerrarPreviewMensaje() {
    setLogPreview(null)
    setModalPreviewAbierto(false)
  }

  async function cargarLogs() {
    setLoading(true)

    const desde = (pagina - 1) * porPagina
    const hasta = desde + porPagina - 1

    let countQuery = supabase
      .from("whatsapp_logs")
      .select("*", { count: "exact", head: true })

    if (tipoFiltro !== "Todos") {
      countQuery = countQuery.eq("tipo_mensaje", tipoFiltro)
    }

    if (estadoFiltro !== "Todos") {
      countQuery = countQuery.eq("estado", estadoFiltro)
    }

    const { count } = await countQuery

    let query = supabase
      .from("whatsapp_logs")
      .select("*")
      .order("created_at", { ascending: false })

    if (tipoFiltro !== "Todos") {
      query = query.eq("tipo_mensaje", tipoFiltro)
    }

    if (estadoFiltro !== "Todos") {
      query = query.eq("estado", estadoFiltro)
    }

    const { data, error } = await query.range(desde, hasta)

    if (error) {
      console.error("Error cargando logs WhatsApp:", error)
      setLogs([])
      setTotalLogs(0)
      setLoading(false)
      return
    }

    setLogs((data || []) as WhatsappLog[])
    setTotalLogs(count || 0)
    setLoading(false)
  }

  async function cargarPendientes() {
    setLoading(true)

    const manana = getLocalDateString(1)
    const hoy = new Date()

    const [
      { data: registrosProgramados, error: errProgramados },
      { data: registrosRecordatorio, error: errRecordatorio },
      { data: registrosAgradecimiento, error: errAgradecimiento },
      { data: registrosSeguimiento, error: errSeguimiento },
      { data: clinicasData, error: errClinicas },
      { data: logsConfirmacionData, error: errLogsConfirmacion },
      { data: logsSeguimientoData, error: errLogsSeguimiento },
    ] = await Promise.all([
      supabase
        .from("registros")
        .select(`
          id,
          codigo,
          nombre_animal,
          nombre_responsable,
          telefono,
          clinica_id,
          fecha_programada,
          fecha_cirugia_realizada,
          hora,
          estado_cita,
          estado_clinica,
          recordatorio_24h_enviado,
          agradecimiento_enviado,
          seguimiento_7d_enviado,
          seguimiento_7d_respondido
        `)
        .eq("estado_cita", "Programado")
        .limit(500),

      supabase
        .from("registros")
        .select(`
          id,
          codigo,
          nombre_animal,
          nombre_responsable,
          telefono,
          clinica_id,
          fecha_programada,
          fecha_cirugia_realizada,
          hora,
          estado_cita,
          estado_clinica,
          recordatorio_24h_enviado,
          agradecimiento_enviado,
          seguimiento_7d_enviado,
          seguimiento_7d_respondido
        `)
        .eq("fecha_programada", manana)
        .eq("estado_cita", "Programado")
        .eq("recordatorio_24h_enviado", false)
        .limit(500),

      supabase
        .from("registros")
        .select(`
          id,
          codigo,
          nombre_animal,
          nombre_responsable,
          telefono,
          clinica_id,
          fecha_programada,
          fecha_cirugia_realizada,
          hora,
          estado_cita,
          estado_clinica,
          recordatorio_24h_enviado,
          agradecimiento_enviado,
          seguimiento_7d_enviado,
          seguimiento_7d_respondido
        `)
        .eq("estado_cita", "Realizado")
        .eq("agradecimiento_enviado", false)
        .limit(500),

      supabase
        .from("registros")
        .select(`
          id,
          codigo,
          nombre_animal,
          nombre_responsable,
          telefono,
          clinica_id,
          fecha_programada,
          fecha_cirugia_realizada,
          hora,
          estado_cita,
          estado_clinica,
          recordatorio_24h_enviado,
          agradecimiento_enviado,
          seguimiento_7d_enviado,
          seguimiento_7d_respondido
        `)
        .not("fecha_cirugia_realizada", "is", null)
        .eq("seguimiento_7d_enviado", false)
        .eq("seguimiento_7d_respondido", false)
        .limit(500),

      supabase
        .from("clinicas")
        .select("id,nome,endereco,telefono,lat,lng,maps_url")
        .limit(500),

      supabase
        .from("whatsapp_logs")
        .select("registro_id,tipo_mensaje,estado")
        .eq("tipo_mensaje", "confirmacion_cupo")
        .eq("estado", "enviado")
        .not("registro_id", "is", null)
        .limit(2000),

      supabase
        .from("whatsapp_logs")
        .select("registro_id,tipo_mensaje,estado")
        .eq("tipo_mensaje", "seguimiento_7d")
        .eq("estado", "enviado")
        .not("registro_id", "is", null)
        .limit(2000),
    ])

    if (
      errProgramados ||
      errRecordatorio ||
      errAgradecimiento ||
      errSeguimiento ||
      errClinicas ||
      errLogsConfirmacion ||
      errLogsSeguimiento
    ) {
      console.error("Error cargando pendientes:", {
        errProgramados,
        errRecordatorio,
        errAgradecimiento,
        errSeguimiento,
        errClinicas,
        errLogsConfirmacion,
        errLogsSeguimiento,
      })
      setPendientes([])
      setTotalPendientes(0)
      setLoading(false)
      return
    }

    const clinicasMap = new Map<string, Clinica>()
    ;(clinicasData || []).forEach((c: any) => clinicasMap.set(c.id, c as Clinica))

    const confirmadosSet = new Set(
      (logsConfirmacionData || [])
        .map((l: any) => l.registro_id)
        .filter(Boolean)
    )

    const seguimientosSet = new Set(
      (logsSeguimientoData || [])
        .map((l: any) => l.registro_id)
        .filter(Boolean)
    )

    const items: PendingItem[] = []

    for (const reg of (registrosProgramados || []) as Registro[]) {
      if (!confirmadosSet.has(reg.id)) {
        const clinica = reg.clinica_id ? clinicasMap.get(reg.clinica_id) || null : null

        items.push({
          id: `confirmacion-${reg.id}`,
          registro_id: reg.id,
          tipo_mensaje: "confirmacion_cupo",
          telefono: reg.telefono,
          nombre_animal: reg.nombre_animal,
          codigo: reg.codigo,
          clinica_nombre: clinica?.nome || "Clínica asignada",
          fecha_ref: reg.fecha_programada,
          hora_ref: reg.hora,
          motivo: "Registro programado sin confirmación enviada",
          registro: reg,
          clinica,
        })
      }
    }

    for (const reg of (registrosRecordatorio || []) as Registro[]) {
      const clinica = reg.clinica_id ? clinicasMap.get(reg.clinica_id) || null : null

      items.push({
        id: `recordatorio-${reg.id}`,
        registro_id: reg.id,
        tipo_mensaje: "recordatorio_24h",
        telefono: reg.telefono,
        nombre_animal: reg.nombre_animal,
        codigo: reg.codigo,
        clinica_nombre: clinica?.nome || "Clínica asignada",
        fecha_ref: reg.fecha_programada,
        hora_ref: reg.hora,
        motivo: "Cirugía de mañana sin recordatorio 24h",
        registro: reg,
        clinica,
      })
    }

    for (const reg of (registrosAgradecimiento || []) as Registro[]) {
      const clinica = reg.clinica_id ? clinicasMap.get(reg.clinica_id) || null : null

      items.push({
        id: `agradecimiento-${reg.id}`,
        registro_id: reg.id,
        tipo_mensaje: "agradecimiento_postcirugia",
        telefono: reg.telefono,
        nombre_animal: reg.nombre_animal,
        codigo: reg.codigo,
        clinica_nombre: clinica?.nome || "Clínica asignada",
        fecha_ref: reg.fecha_cirugia_realizada || reg.fecha_programada,
        hora_ref: reg.hora,
        motivo: "Cirugía realizada sin agradecimiento enviado",
        registro: reg,
        clinica,
      })
    }

    for (const reg of (registrosSeguimiento || []) as Registro[]) {
      if (seguimientosSet.has(reg.id)) continue
      if (!reg.fecha_cirugia_realizada) continue

      const fechaCirugia = new Date(reg.fecha_cirugia_realizada)
      if (Number.isNaN(fechaCirugia.getTime())) continue

      const diffDias =
        (hoy.getTime() - fechaCirugia.getTime()) / (1000 * 60 * 60 * 24)

      if (diffDias >= 7) {
        const clinica = reg.clinica_id ? clinicasMap.get(reg.clinica_id) || null : null

        items.push({
          id: `seguimiento-${reg.id}`,
          registro_id: reg.id,
          tipo_mensaje: "seguimiento_7d",
          telefono: reg.telefono,
          nombre_animal: reg.nombre_animal,
          codigo: reg.codigo,
          clinica_nombre: clinica?.nome || "Clínica asignada",
          fecha_ref: reg.fecha_cirugia_realizada,
          hora_ref: null,
          motivo: "Seguimiento postoperatorio 7 días",
          registro: reg,
          clinica,
        })
      }
    }

    const texto = busqueda.trim().toLowerCase()

    const filtrados = items.filter((item) => {
      const coincideTipo =
        tipoFiltro === "Todos" ? true : item.tipo_mensaje === tipoFiltro

      const coincideBusqueda = texto
        ? [
            normalizarTelefonoParaBusqueda(item.telefono),
            item.nombre_animal || "",
            item.codigo || "",
            item.clinica_nombre || "",
            item.motivo || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(texto)
        : true

      return coincideTipo && coincideBusqueda
    })

    const ordenados = [...filtrados].sort((a, b) => {
      const fa = a.fecha_ref || ""
      const fb = b.fecha_ref || ""
      return fb.localeCompare(fa)
    })

    const total = ordenados.length
    const desde = (pagina - 1) * porPagina
    const hasta = desde + porPagina
    const paginaActual = ordenados.slice(desde, hasta)

    setPendientes(paginaActual)
    setTotalPendientes(total)
    setLoading(false)
  }

  async function refrescar() {
    if (aba === "historial") {
      await cargarLogs()
    } else {
      await cargarPendientes()
    }
  }

  useEffect(() => {
    refrescar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, pagina, tipoFiltro, estadoFiltro])

  useEffect(() => {
    const t = setTimeout(() => {
      setPagina(1)
      refrescar()
    }, 250)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  const resumen = useMemo(() => {
    const enviados = logs.filter((l) => l.estado === "enviado").length
    const errores = logs.filter((l) => l.estado === "error").length
    const pendientesLogs = logs.filter((l) => l.estado === "pendiente").length
    const confirmaciones = logs.filter((l) => l.tipo_mensaje === "confirmacion_cupo").length
    const recordatorios = logs.filter((l) => l.tipo_mensaje === "recordatorio_24h").length
    const agradecimientos = logs.filter(
      (l) => l.tipo_mensaje === "agradecimiento_postcirugia"
    ).length
    const seguimientos = logs.filter((l) => l.tipo_mensaje === "seguimiento_7d").length

    return {
      enviados,
      errores,
      pendientesLogs,
      confirmaciones,
      recordatorios,
      agradecimientos,
      seguimientos,
    }
  }, [logs])

  const totalPaginas = Math.max(
    1,
    Math.ceil((aba === "historial" ? totalLogs : totalPendientes) / porPagina)
  )

  const logsFiltradosBusqueda = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const textoNormalizado = normalizarTelefonoParaBusqueda(texto)

    if (!texto) return logs

    return logs.filter((log) => {
      return [
        normalizarTelefonoParaBusqueda(log.telefono),
        log.tipo_mensaje || "",
        log.estado || "",
        log.error_texto || "",
        log.payload?.variables?.["1"] || "",
        log.payload?.variables?.["2"] || "",
        log.payload?.variables?.["3"] || "",
        log.payload?.payload_extra?.codigo || "",
        log.payload?.payload_extra?.clinica_nombre || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(textoNormalizado || texto)
    })
  }, [logs, busqueda])

  async function reenviar(log: WhatsappLog) {
    try {
      setProcesandoId(log.id)

      const resp = await fetch("/api/send-whatsapp-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registro_id: log.registro_id,
          telefono: log.telefono,
          tipo_mensaje: log.tipo_mensaje,
          variables: log.payload?.variables || {},
          payload_extra: log.payload?.payload_extra || {},
        }),
      })

      const data = await resp.json()

      if (resp.ok && data?.ok) {
        alert("Mensaje reenviado correctamente.")
        await cargarLogs()
      } else {
        alert(data?.error || data?.moreInfo || "No se pudo reenviar el mensaje.")
      }
    } catch (error) {
      console.error(error)
      alert("Ocurrió un error al reenviar.")
    } finally {
      setProcesandoId(null)
    }
  }

  async function enviarPendiente(item: PendingItem) {
    try {
      setProcesandoId(item.id)

      let body: any = {
        registro_id: item.registro_id,
        telefono: item.telefono,
        tipo_mensaje: item.tipo_mensaje,
        variables: {},
        payload_extra: {},
      }

      if (item.tipo_mensaje === "agradecimiento_postcirugia") {
        body.variables = {
          "1": item.nombre_animal || "",
          "2": item.codigo || "",
        }
        body.payload_extra = {
          fecha_cirugia_realizada: item.registro.fecha_cirugia_realizada,
          estado_cita: item.registro.estado_cita,
        }
      }

      if (item.tipo_mensaje === "recordatorio_24h") {
        const direccionClinica = item.clinica?.endereco || ""
        const mapsLink = direccionClinica
          ? `https://www.google.com/maps?q=${encodeURIComponent(direccionClinica)}`
          : ""
        const qrLink = `https://fundacion-rugimos.vercel.app/paciente/${item.codigo || ""}`

        body.variables = {
          "1": item.codigo || "",
          "2": item.nombre_animal || "",
          "3": item.clinica?.nome || "Clínica asignada",
          "4": direccionClinica,
          "5": item.registro.fecha_programada || "",
          "6": item.registro.hora || "",
          "7": mapsLink,
          "8": qrLink,
        }
        body.payload_extra = {
          clinica_id: item.registro.clinica_id,
          clinica_nombre: item.clinica?.nome || "Clínica asignada",
          direccion_clinica: direccionClinica,
          fecha_programada: item.registro.fecha_programada,
          hora: item.registro.hora,
          estado_cita: item.registro.estado_cita,
        }
      }

      if (item.tipo_mensaje === "confirmacion_cupo") {
        const linkMapa = String(item.clinica?.maps_url || "").trim()
        const linkQR = `https://fundacion-rugimos.vercel.app/paciente/${item.codigo || ""}`

        body.variables = {
          "1": String(item.codigo || ""),
          "2": String(item.nombre_animal || ""),
          "3": String(item.clinica?.nome || "Clínica asignada"),
          "4": String(item.clinica?.endereco || ""),
          "5": String(formatearFechaSolo(item.registro.fecha_programada) || ""),
          "6": String(item.registro.hora || ""),
          "7": String(item.clinica?.telefono || "No disponible"),
          "8": String(linkMapa || ""),
          "9": String(linkQR || ""),
        }

        body.payload_extra = {
          clinica_id: item.registro.clinica_id,
          clinica_nombre: item.clinica?.nome || "Clínica asignada",
          fecha_programada: item.registro.fecha_programada,
          hora_programada: item.registro.hora,
          codigo: item.codigo || "",
        }
      }

      if (item.tipo_mensaje === "seguimiento_7d") {
        const linkSeguimiento = `https://fundacion-rugimos.vercel.app/seguimiento/${item.codigo || ""}`

        body.variables = {
          "1": item.nombre_animal || "",
          "2": item.codigo || "",
          "3": linkSeguimiento,
        }

        body.payload_extra = {
          tipo: "seguimiento_7d",
          codigo: item.codigo || "",
          nombre_animal: item.nombre_animal || "",
          link: linkSeguimiento,
          fecha_cirugia_realizada: item.registro.fecha_cirugia_realizada,
        }
      }

      const resp = await fetch("/api/send-whatsapp-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await resp.json()

      if (!resp.ok || !data?.ok) {
        alert(data?.error || data?.moreInfo || "No se pudo enviar el mensaje.")
        return
      }

      if (item.tipo_mensaje === "agradecimiento_postcirugia") {
        await supabase
          .from("registros")
          .update({ agradecimiento_enviado: true })
          .eq("id", item.registro_id)
      }

      if (item.tipo_mensaje === "recordatorio_24h") {
        await supabase
          .from("registros")
          .update({ recordatorio_24h_enviado: true })
          .eq("id", item.registro_id)
      }

      if (item.tipo_mensaje === "seguimiento_7d") {
        await supabase
          .from("registros")
          .update({ seguimiento_7d_enviado: true })
          .eq("id", item.registro_id)
      }

      alert("Mensaje enviado correctamente.")
      await cargarPendientes()
      await cargarLogs()
    } catch (error) {
      console.error(error)
      alert("Ocurrió un error al enviar.")
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f6d6a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-[28px] bg-gradient-to-r from-[#0b5f5c] to-[#127a75] shadow-2xl p-6 md:p-8 mb-6 border border-white/10">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <p className="text-white/70 text-sm font-medium tracking-wide uppercase">
                Fundación Rugimos
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mt-1">
                Centro de control WhatsApp
              </h1>
              <p className="text-white/80 mt-3 max-w-2xl">
                Historial, errores, pendientes y acciones manuales de los mensajes automáticos del sistema.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="px-5 py-3 rounded-2xl bg-white text-[#0f6d6a] font-semibold shadow-lg"
              >
                Volver al admin
              </Link>

              <button
                onClick={() => {
                  setPagina(1)
                  refrescar()
                }}
                className="px-5 py-3 rounded-2xl bg-[#F47C3C] hover:bg-[#e06c2e] text-white font-semibold shadow-lg transition"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Enviados</p>
            <p className="text-3xl font-bold text-green-600">{resumen.enviados}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Errores</p>
            <p className="text-3xl font-bold text-red-600">{resumen.errores}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Pend. logs</p>
            <p className="text-3xl font-bold text-yellow-600">{resumen.pendientesLogs}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Confirmaciones</p>
            <p className="text-3xl font-bold text-[#0f6d6a]">{resumen.confirmaciones}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Recordatorios</p>
            <p className="text-3xl font-bold text-[#b85722]">{resumen.recordatorios}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Agradecimientos</p>
            <p className="text-3xl font-bold text-[#6b46c1]">{resumen.agradecimientos}</p>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl">
            <p className="text-sm text-gray-500">Seguimientos 7d</p>
            <p className="text-3xl font-bold text-[#1d4ed8]">{resumen.seguimientos}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => {
              setAba("historial")
              setPagina(1)
            }}
            className={`px-5 py-3 rounded-2xl font-semibold shadow ${
              aba === "historial"
                ? "bg-[#F47C3C] text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Historial
          </button>

          <button
            onClick={() => {
              setAba("pendientes")
              setPagina(1)
            }}
            className={`px-5 py-3 rounded-2xl font-semibold shadow ${
              aba === "pendientes"
                ? "bg-[#F47C3C] text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Pendientes
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-4 md:p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar teléfono, código, mascota, clínica..."
              className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
            />

            <select
              value={tipoFiltro}
              onChange={(e) => {
                setTipoFiltro(e.target.value)
                setPagina(1)
              }}
              className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
            >
              <option value="Todos">Todos los tipos</option>
              <option value="confirmacion_cupo">Confirmación de cupo</option>
              <option value="recordatorio_24h">Recordatorio 24h</option>
              <option value="agradecimiento_postcirugia">Agradecimiento</option>
              <option value="seguimiento_7d">Seguimiento 7 días</option>
            </select>

            <select
              value={estadoFiltro}
              onChange={(e) => {
                setEstadoFiltro(e.target.value)
                setPagina(1)
              }}
              disabled={aba === "pendientes"}
              className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 disabled:bg-gray-100"
            >
              <option value="Todos">Todos los estados</option>
              <option value="enviado">Enviado</option>
              <option value="error">Error</option>
              <option value="pendiente">Pendiente</option>
            </select>

            <button
              onClick={() => {
                setBusqueda("")
                setTipoFiltro("Todos")
                setEstadoFiltro("Todos")
                setPagina(1)
              }}
              className="rounded-2xl px-4 py-3 bg-gray-200 text-gray-800 font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Cargando información...</div>
          ) : aba === "historial" ? (
            logsFiltradosBusqueda.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No se encontraron registros con esos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#0f6d6a] text-white">
                    <tr>
                      <th className="px-4 py-4 text-left">Fecha</th>
                      <th className="px-4 py-4 text-left">Tipo</th>
                      <th className="px-4 py-4 text-left">Teléfono</th>
                      <th className="px-4 py-4 text-left">Mascota / Código</th>
                      <th className="px-4 py-4 text-left">Clínica</th>
                      <th className="px-4 py-4 text-left">Estado</th>
                      <th className="px-4 py-4 text-left">SID</th>
                      <th className="px-4 py-4 text-left">Error</th>
                      <th className="px-4 py-4 text-left">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {logsFiltradosBusqueda.map((log) => {
                      const mascota =
                        log.payload?.variables?.["2"] ||
                        log.payload?.payload_extra?.mascota ||
                        log.payload?.payload_extra?.nombre_animal ||
                        log.payload?.variables?.["1"] ||
                        "-"

                      const codigo =
                        log.payload?.payload_extra?.codigo ||
                        log.payload?.variables?.["1"] ||
                        log.payload?.variables?.["2"] ||
                        "-"

                      const clinica =
                        log.payload?.payload_extra?.clinica_nombre ||
                        log.payload?.variables?.["3"] ||
                        "-"

                      return (
                        <tr key={log.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                            {formatearFecha(log.created_at)}
                          </td>

                          <td className="px-4 py-4 text-gray-700">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${colorTipo(log.tipo_mensaje)}`}>
                              {traducirTipo(log.tipo_mensaje)}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                            {log.telefono || "-"}
                          </td>

                          <td className="px-4 py-4 text-gray-700">
                            <div className="font-semibold">{mascota}</div>
                            <div className="text-xs text-gray-500">{codigo}</div>
                          </td>

                          <td className="px-4 py-4 text-gray-700">
                            {clinica}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full border text-xs font-bold ${colorEstado(
                                log.estado
                              )}`}
                            >
                              {log.estado}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-gray-500 text-xs break-all max-w-[220px]">
                            {log.mensaje_sid || "-"}
                          </td>

                          <td className="px-4 py-4 text-red-600 text-xs max-w-[280px]">
                            {log.error_texto || "-"}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2 min-w-[130px]">
                              <button
                                onClick={() => reenviar(log)}
                                disabled={procesandoId === log.id}
                                className="px-3 py-2 rounded-xl bg-[#F47C3C] hover:bg-[#e06c2e] text-white text-xs font-semibold disabled:opacity-60"
                              >
                                {procesandoId === log.id ? "Procesando..." : "Reenviar"}
                              </button>

                              <button
                                onClick={() => abrirPreviewMensaje(log)}
                                className="px-3 py-2 rounded-xl bg-[#0f6d6a] hover:bg-[#0c5c59] text-white text-xs font-semibold transition"
                              >
                                Ver mensaje
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : pendientes.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No hay pendientes con esos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#0f6d6a] text-white">
                  <tr>
                    <th className="px-4 py-4 text-left">Tipo</th>
                    <th className="px-4 py-4 text-left">Mascota / Código</th>
                    <th className="px-4 py-4 text-left">Teléfono</th>
                    <th className="px-4 py-4 text-left">Clínica</th>
                    <th className="px-4 py-4 text-left">Fecha</th>
                    <th className="px-4 py-4 text-left">Hora</th>
                    <th className="px-4 py-4 text-left">Motivo</th>
                    <th className="px-4 py-4 text-left">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {pendientes.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${colorTipo(item.tipo_mensaje)}`}>
                          {traducirTipo(item.tipo_mensaje)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-gray-700">
                        <div className="font-semibold">{item.nombre_animal || "-"}</div>
                        <div className="text-xs text-gray-500">{item.codigo || "-"}</div>
                      </td>

                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {item.telefono || "-"}
                      </td>

                      <td className="px-4 py-4 text-gray-700">
                        {item.clinica_nombre || "-"}
                      </td>

                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {item.tipo_mensaje === "agradecimiento_postcirugia" || item.tipo_mensaje === "seguimiento_7d"
                          ? formatearFecha(item.fecha_ref)
                          : formatearFechaSolo(item.fecha_ref)}
                      </td>

                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                        {item.hora_ref || "-"}
                      </td>

                      <td className="px-4 py-4 text-gray-600 max-w-[300px]">
                        {item.motivo}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() => enviarPendiente(item)}
                          disabled={procesandoId === item.id}
                          className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-60"
                        >
                          {procesandoId === item.id ? "Procesando..." : "Enviar ahora"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-white/85 text-sm">
            {aba === "historial" ? (
              <>Mostrando página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong> — total registros: <strong>{totalLogs}</strong></>
            ) : (
              <>Mostrando página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong> — total pendientes: <strong>{totalPendientes}</strong></>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-4 py-2 rounded-xl bg-white text-gray-800 font-semibold disabled:opacity-50"
            >
              Anterior
            </button>

            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              className="px-4 py-2 rounded-xl bg-white text-gray-800 font-semibold disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>

        {modalPreviewAbierto && logPreview && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={cerrarPreviewMensaje}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 rounded-t-3xl flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-[#0f6d6a]">
                    Vista previa del mensaje
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {traducirTipo(logPreview.tipo_mensaje)} · {formatearFecha(logPreview.created_at)}
                  </p>
                </div>

                <button
                  onClick={cerrarPreviewMensaje}
                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-sm text-gray-500">Estado</p>
                    <p className="font-bold text-gray-800">{logPreview.estado}</p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="font-bold text-gray-800">{logPreview.telefono || "-"}</p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-sm text-gray-500">Registro</p>
                    <p className="font-bold text-gray-800">{logPreview.registro_id || "-"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#F47C3C]/30 bg-gradient-to-br from-[#fff6f1] to-[#ffe8dc] p-5 shadow-sm">
                  <p className="text-sm font-bold text-[#b85722] mb-3">
                    Mensaje generado
                  </p>

                  <div className="bg-white rounded-xl p-4 border text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {construirMensajeDesdeLog(logPreview)}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Payload guardado
                  </p>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words overflow-x-auto">
                    {JSON.stringify(logPreview.payload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}