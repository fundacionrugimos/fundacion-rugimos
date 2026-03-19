import { NextResponse } from "next/server"
import twilio from "twilio"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

if (!accountSid || !authToken) {
  throw new Error("Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN")
}

const client = twilio(accountSid, authToken)

function normalizarTelefonoBO(telefono: string) {
  const digits = (telefono || "").replace(/\D/g, "")

  if (digits.startsWith("591")) {
    return `whatsapp:+${digits}`
  }

  return `whatsapp:+591${digits}`
}

export async function POST(req: Request) {
  try {
    const {
      telefono,
      codigo,
      mascota,
      clinica,
      direccion,
      fecha,
      hora,
      telefonoClinica,
      maps,
      qr,
    } = await req.json()

    const from = process.env.TWILIO_WHATSAPP_FROM
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID_CONFIRMACION

    if (!from) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta TWILIO_WHATSAPP_FROM",
        },
        { status: 500 }
      )
    }

    if (!contentSid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el Content SID (HX...) del template en Twilio. El sistema puede seguir con envío manual.",
        },
        { status: 500 }
      )
    }

    console.log("=== ENVIANDO WHATSAPP ===")
    console.log("from:", from)
    console.log("to:", normalizarTelefonoBO(telefono))
    console.log("contentSid:", contentSid)
    console.log("contentVariables:", {
      "1": codigo,
      "2": mascota,
      "3": clinica,
      "4": direccion,
      "5": fecha,
      "6": hora,
      "7": telefonoClinica,
      "8": maps,
      "9": qr,
    })

    const message = await client.messages.create({
      from,
      to: normalizarTelefonoBO(telefono),
      contentSid,
      contentVariables: JSON.stringify({
        "1": codigo,
        "2": mascota,
        "3": clinica,
        "4": direccion,
        "5": fecha,
        "6": hora,
        "7": telefonoClinica,
        "8": maps,
        "9": qr,
      }),
    })

    return NextResponse.json({
      ok: true,
      sid: message.sid,
    })
  } catch (error: any) {
    console.error("Error enviando WhatsApp completo:")
    console.error("message:", error?.message)
    console.error("code:", error?.code)
    console.error("moreInfo:", error?.moreInfo)
    console.error("status:", error?.status)
    console.error("details:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "No se pudo enviar el WhatsApp",
        code: error?.code || null,
        moreInfo: error?.moreInfo || null,
      },
      { status: 500 }
    )
  }
}