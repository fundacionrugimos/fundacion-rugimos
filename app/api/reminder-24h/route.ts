import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const mananaInicio = new Date()
    mananaInicio.setDate(mananaInicio.getDate() + 1)
    mananaInicio.setHours(0, 0, 0, 0)

    const mananaFin = new Date()
    mananaFin.setDate(mananaFin.getDate() + 1)
    mananaFin.setHours(23, 59, 59, 999)

    const { data: pacientes, error } = await supabase
      .from("registros")
      .select(`
        id,
        codigo,
        nombre_animal,
        telefono,
        fecha_programada,
        hora,
        estado_cita,
        recordatorio_24h_enviado,
        clinicas (
          nombre,
          endereco
        )
      `)
      .gte("fecha_programada", mananaInicio.toISOString())
      .lte("fecha_programada", mananaFin.toISOString())
      .eq("estado_cita", "programado")
      .eq("recordatorio_24h_enviado", false)

    if (error) {
      console.log("Error buscando pacientes:", error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    let enviados = 0

    for (const paciente of pacientes || []) {
      const clinica = Array.isArray(paciente.clinicas)
        ? paciente.clinicas[0]
        : paciente.clinicas

      const nombreClinica = clinica?.nombre || "Clínica asignada"
      const direccionClinica = clinica?.endereco || ""

      const mapsLink = direccionClinica
        ? `https://www.google.com/maps?q=${encodeURIComponent(direccionClinica)}`
        : ""

      const qrLink = `https://fundacion-rugimos.vercel.app/paciente/${paciente.codigo}`

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-whatsapp-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            telefono: paciente.telefono,
            contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID_RECORDATORIO,
            variables: {
              "1": paciente.codigo,
              "2": paciente.nombre_animal,
              "3": nombreClinica,
              "4": direccionClinica,
              "5": paciente.fecha_programada,
              "6": paciente.hora,
              "7": mapsLink,
              "8": qrLink
            }
          })
        }
      )

      if (resp.ok) {
        await supabase
          .from("registros")
          .update({ recordatorio_24h_enviado: true })
          .eq("id", paciente.id)

        enviados++
      } else {
        const txt = await resp.text()
        console.log("Error enviando reminder:", txt)
      }
    }

    return NextResponse.json({ ok: true, enviados })
  } catch (err) {
    console.log("Error interno reminder-24h:", err)
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 })
  }
}