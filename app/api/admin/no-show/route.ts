import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function normalizar(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Faltan variables de entorno del Supabase." },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const hoy = new Date().toISOString().slice(0, 10)

    const { data: registros, error: selectError } = await supabaseAdmin
      .from("registros")
      .select("id, fecha_programada, estado_clinica, estado_cita")
      .lt("fecha_programada", hoy)

    if (selectError) {
      return NextResponse.json(
        { error: selectError.message },
        { status: 500 }
      )
    }

    const idsParaNoShow =
      (registros || [])
        .filter((r) => {
          const estadoClinica = normalizar(r.estado_clinica)
          const estadoCita = normalizar(r.estado_cita)

          if (!r.fecha_programada) return false

          if (estadoClinica === "apto") return false
          if (estadoClinica === "reprogramado") return false
          if (estadoClinica === "rechazado") return false
          if (estadoClinica === "fallecido") return false
          if (estadoClinica === "no show") return false

          if (estadoCita === "realizado") return false
          if (estadoCita === "atendido") return false
          if (estadoCita === "reprogramado") return false
          if (estadoCita === "rechazado") return false
          if (estadoCita === "falleció") return false
          if (estadoCita === "fallecio") return false
          if (estadoCita === "no show") return false

          return true
        })
        .map((r) => r.id) || []

    if (!idsParaNoShow.length) {
      return NextResponse.json({
        ok: true,
        actualizados: 0,
        message: "No había registros para marcar como No Show",
      })
    }

    const { error: updateError } = await supabaseAdmin
      .from("registros")
      .update({
        estado_clinica: "No Show",
        estado_cita: "No Show",
      })
      .in("id", idsParaNoShow)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      actualizados: idsParaNoShow.length,
      ids: idsParaNoShow,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}