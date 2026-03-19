import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const ayerInicio = new Date()
    ayerInicio.setDate(ayerInicio.getDate() - 1)
    ayerInicio.setHours(0, 0, 0, 0)

    const ayerFin = new Date()
    ayerFin.setDate(ayerFin.getDate() - 1)
    ayerFin.setHours(23, 59, 59, 999)

    const { data: pacientes, error } = await supabase
      .from("registros")
      .select(`
        id,
        codigo,
        nombre_animal,
        telefono,
        fecha_cirugia_realizada,
        estado_cita,
        estado_clinica,
        agradecimiento_enviado
      `)
      .gte("fecha_cirugia_realizada", ayerInicio.toISOString())
      .lte("fecha_cirugia_realizada", ayerFin.toISOString())
      .eq("estado_clinica", "apto")
      .neq("estado_cita", "fallecido")
      .eq("agradecimiento_enviado", false)

    if (error) {
      console.log("Error buscando post-cirugia:", error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    let enviados = 0

    for (const paciente of pacientes || []) {
      const linkDonacion = "https://fundacion-rugimos.vercel.app/donar"

      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-whatsapp-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telefono: paciente.telefono,
            contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID_AGRADECIMIENTO,
            variables: {
              "1": paciente.nombre_animal,
              "2": paciente.codigo,
              "3": linkDonacion,
            },
          }),
        }
      )

      if (resp.ok) {
        await supabase
          .from("registros")
          .update({ agradecimiento_enviado: true })
          .eq("id", paciente.id)

        enviados++
      } else {
        const txt = await resp.text()
        console.log("Error enviando agradecimiento:", txt)
      }
    }

    return NextResponse.json({ ok: true, enviados })
  } catch (err) {
    console.log("Error interno post-cirugia:", err)
    return NextResponse.json(
      { ok: false, error: "error interno" },
      { status: 500 }
    )
  }
}