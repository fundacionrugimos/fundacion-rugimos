import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const [
      { count: solicitudes, error: errSolicitudes },
      { count: registrosAprobados, error: errAprobados },
      { count: realizadas, error: errRealizadas },
      { count: noShow, error: errNoShow },
    ] = await Promise.all([
      supabaseServer
        .from("solicitudes")
        .select("id", { count: "exact", head: true }),

      supabaseServer
        .from("registros")
        .select("id", { count: "exact", head: true }),

      supabaseServer
        .from("registros")
        .select("id", { count: "exact", head: true })
        .or(
          [
            "estado_cita.eq.Realizado",
            "estado_cita.eq.Atendido",
            "estado_cita.eq.Falleció",
            "estado_cita.eq.Fallecio",
            "estado_clinica.eq.apto",
            "estado_clinica.eq.realizado",
            "estado_clinica.eq.atendido",
            "estado_clinica.eq.fallecido",
            "estado_clinica.eq.fallecio",
          ].join(",")
        ),

      supabaseServer
        .from("registros")
        .select("id", { count: "exact", head: true })
        .in("estado_cita", ["No Show", "No_Show", "NoShow"]),
    ])

    if (errSolicitudes) throw errSolicitudes
    if (errAprobados) throw errAprobados
    if (errRealizadas) throw errRealizadas
    if (errNoShow) throw errNoShow

    return NextResponse.json({
      ok: true,
      data: {
        solicitudes: solicitudes || 0,
        aprobadas: registrosAprobados || 0,
        realizadas: realizadas || 0,
        noShow: noShow || 0,
      },
    })
  } catch (error: any) {
    console.error("Error impacto público:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}