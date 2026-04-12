import { NextResponse } from "next/server"
import twilio from "twilio"
import { createClient } from "@supabase/supabase-js"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const from = process.env.TWILIO_WHATSAPP_FROM

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!accountSid || !authToken) {
  throw new Error("Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN")
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan variables de Supabase para logs")
}

const client = twilio(accountSid, authToken)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

function normalizarTelefonoBO(telefono: string) {
  const digits = (telefono || "").replace(/\D/g, "")

  if (!digits) return ""

  if (digits.startsWith("591")) {
    return `whatsapp:+${digits}`
  }

  return `whatsapp:+591${digits}`
}

function obtenerContentSid(tipo_mensaje: string) {
  if (tipo_mensaje === "confirmacion_cupo") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_CONFIRMACION || null
  }

  if (tipo_mensaje === "recordatorio_24h") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_RECORDATORIO || null
  }

  if (tipo_mensaje === "agradecimiento_postcirugia") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_AGRADECIMIENTO_QR || null
  }

  if (tipo_mensaje === "rechazo_solicitud") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_RECHAZO || null
  }

  if (tipo_mensaje === "aprobacion_adopcion") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_APROBACION_ADOPCION || null
  }

  return null
}

function sanitizeVariables(vars: Record<string, any>) {
  const clean: Record<string, string> = {}

  for (const key in vars) {
    const value = vars[key]

    if (value === null || value === undefined || value === "") {
      clean[key] = "-"
    } else {
      clean[key] = String(value)
    }
  }

  return clean
}

export async function POST(req: Request) {
  let logId: string | null = null

  try {
    const body = await req.json()

    const {
      registro_id = null,
      telefono,
      tipo_mensaje = "confirmacion_cupo",
      contentSid: contentSidBody = null,
      variables = {},
      payload_extra = null,
    } = body

    if (!from) {
      return NextResponse.json(
        { ok: false, error: "Falta TWILIO_WHATSAPP_FROM" },
        { status: 500 }
      )
    }

    if (!telefono) {
      return NextResponse.json(
        { ok: false, error: "Falta telefono" },
        { status: 400 }
      )
    }

    const contentSid = contentSidBody || obtenerContentSid(tipo_mensaje)

    if (!contentSid) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se encontró contentSid para tipo_mensaje: ${tipo_mensaje}`,
        },
        { status: 400 }
      )
    }

    const telefonoNormalizado = normalizarTelefonoBO(telefono)

    if (!telefonoNormalizado) {
      return NextResponse.json(
        { ok: false, error: "Teléfono inválido" },
        { status: 400 }
      )
    }

    const cleanVariables = sanitizeVariables(variables)

    const payload = {
      registro_id,
      telefono_original: telefono,
      telefono_normalizado: telefonoNormalizado,
      tipo_mensaje,
      contentSid,
      variables: cleanVariables,
      payload_extra,
    }

    const { data: logCreado, error: logError } = await supabaseAdmin
      .from("whatsapp_logs")
      .insert({
        registro_id,
        telefono: telefonoNormalizado,
        tipo_mensaje,
        template_sid: contentSid,
        estado: "pendiente",
        payload,
      })
      .select("id")
      .single()

    if (logError) {
      console.error("Error creando log de WhatsApp:", logError)
    } else {
      logId = logCreado?.id ?? null
    }

    console.log("=== ENVIANDO WHATSAPP ===")
    console.log("from:", from)
    console.log("to:", telefonoNormalizado)
    console.log("tipo_mensaje:", tipo_mensaje)
    console.log("contentSid:", contentSid)
    console.log("variables (RAW):", variables)
    console.log("variables (SANITIZED):", cleanVariables)
    console.log("registro_id:", registro_id)

    const message = await client.messages.create({
      from,
      to: telefonoNormalizado,
      contentSid,
      contentVariables: JSON.stringify(cleanVariables),
    })

    if (logId) {
      const { error: updateLogError } = await supabaseAdmin
        .from("whatsapp_logs")
        .update({
          estado: "enviado",
          mensaje_sid: message.sid,
          error_texto: null,
        })
        .eq("id", logId)

      if (updateLogError) {
        console.error("Error actualizando log enviado:", updateLogError)
      }
    }

    return NextResponse.json({
      ok: true,
      sid: message.sid,
      log_id: logId,
    })
  } catch (error: any) {
    console.error("Error enviando WhatsApp:")
    console.error("message:", error?.message)
    console.error("code:", error?.code)
    console.error("moreInfo:", error?.moreInfo)
    console.error("status:", error?.status)
    console.error("details:", error)

    if (logId) {
      const { error: updateLogError } = await supabaseAdmin
        .from("whatsapp_logs")
        .update({
          estado: "error",
          error_texto: error?.message || "No se pudo enviar el WhatsApp",
        })
        .eq("id", logId)

      if (updateLogError) {
        console.error("Error actualizando log con error:", updateLogError)
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "No se pudo enviar el WhatsApp",
        code: error?.code || null,
        moreInfo: error?.moreInfo || null,
        log_id: logId,
      },
      { status: 500 }
    )
  }
}