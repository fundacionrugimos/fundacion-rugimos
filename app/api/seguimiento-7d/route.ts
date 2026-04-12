import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

function normalizePhone(phone?: string | null) {
  if (!phone) return null

  let cleaned = String(phone).replace(/\D/g, "")
  if (!cleaned) return null

  // Bolívia
  if (!cleaned.startsWith("591")) {
    cleaned = `591${cleaned}`
  }

  return `whatsapp:+${cleaned}`
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://fundacion-rugimos.vercel.app"
  )
}

function isFallecido(value?: string | null) {
  const text = String(value || "").toLowerCase()
  return text.includes("falle")
}

async function sendWhatsAppTemplate(to: string, animal: string, link: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID_SEGUIMIENTO_7D

  if (!accountSid || !authToken || !from || !contentSid) {
    throw new Error(
      "Faltan variables de Twilio: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / TWILIO_WHATSAPP_CONTENT_SID_SEGUIMIENTO_7D"
    )
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

  const params = new URLSearchParams()
  params.append("From", from)
  params.append("To", to)
  params.append("ContentSid", contentSid)
  params.append(
    "ContentVariables",
    JSON.stringify({
      1: animal,
      2: link,
    })
  )

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.message || "Error enviando template")
  }

  return data
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret =
      req.nextUrl.searchParams.get("secret") ||
      req.headers.get("x-cron-secret")

    // Depois que validar tudo, recomendo ativar esta proteção.
    // if (cronSecret && incomingSecret !== cronSecret) {
    //   return NextResponse.json(
    //     { ok: false, error: "No autorizado" },
    //     { status: 401 }
    //   )
    // }

    const baseUrl = getBaseUrl()

    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

    const { data: registros, error } = await supabase
      .from("registros")
      .select(`
        id,
        codigo,
        nombre_completo,
        telefono,
        celular,
        nombre_animal,
        fecha_cirugia_realizada,
        estado_cita,
        estado_clinica,
        seguimiento_7d_enviado,
        seguimiento_7d_respondido
      `)
      .not("fecha_cirugia_realizada", "is", null)
      .lte("fecha_cirugia_realizada", sevenDaysAgoStr)
      .eq("seguimiento_7d_enviado", false)
      .eq("seguimiento_7d_respondido", false)

    if (error) {
      throw error
    }

    const results: Array<Record<string, any>> = []

    for (const registro of registros || []) {
      try {
        if (isFallecido(registro.estado_cita) || isFallecido(registro.estado_clinica)) {
          results.push({
            codigo: registro.codigo,
            status: "omitido",
            reason: "Caso marcado como fallecido",
          })
          continue
        }

        const rawPhone = registro.telefono || registro.celular
        const to = normalizePhone(rawPhone)

        if (!to) {
          results.push({
            codigo: registro.codigo,
            status: "omitido",
            reason: "Sin teléfono válido",
          })
          continue
        }

        const codigo = String(registro.codigo || "").trim().toUpperCase()
        const link = `${baseUrl}/seguimiento/${encodeURIComponent(codigo)}`
        const animal = registro.nombre_animal || "su mascota"

        const twilioResponse = await sendWhatsAppTemplate(to, animal, link)

        const { error: updateError } = await supabase
          .from("registros")
          .update({
            seguimiento_7d_enviado: true,
            seguimiento_7d_enviado_at: new Date().toISOString(),
          })
          .eq("id", registro.id)

        if (updateError) {
          throw updateError
        }

        results.push({
          codigo,
          status: "enviado",
          to,
          sid: twilioResponse?.sid || null,
        })
      } catch (itemError: any) {
        results.push({
          codigo: registro.codigo,
          status: "error",
          error: itemError?.message || "Error desconocido",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      baseUrl,
      cutoff_date: sevenDaysAgoStr,
      processed: results.length,
      sent: results.filter((r) => r.status === "enviado").length,
      skipped: results.filter((r) => r.status === "omitido").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    })
  } catch (err: any) {
    console.error("Error en /api/seguimiento-7d:", err)

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error interno",
      },
      { status: 500 }
    )
  }
}