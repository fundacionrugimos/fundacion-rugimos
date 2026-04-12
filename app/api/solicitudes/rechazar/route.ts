import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

function codigoRugimosValido(codigo?: string | null) {
  if (!codigo) return false
  return /^RG\d{1,5}$/i.test(String(codigo).trim())
}

async function obtenerProximoCodigoRugimos() {
  const { data, error } = await supabaseServer.rpc("generar_codigo_rg")

  if (error) {
    console.error(error)
    throw new Error("No se pudo generar el código Rugimos.")
  }

  if (!data) {
    throw new Error("No se recibió un código Rugimos válido.")
  }

  return String(data).trim().toUpperCase()
}

async function obtenerCodigoCorregido(solicitud: any) {
  if (codigoRugimosValido(solicitud.codigo)) {
    return String(solicitud.codigo).trim().toUpperCase()
  }

  return await obtenerProximoCodigoRugimos()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { solicitudId, motivo } = body || {}

    if (!solicitudId || !motivo) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos para rechazar la solicitud." },
        { status: 400 }
      )
    }

    const { data: solicitud, error } = await supabaseServer
      .from("solicitudes")
      .select("*")
      .eq("id", solicitudId)
      .single()

    if (error || !solicitud) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada." },
        { status: 404 }
      )
    }

    const codigoGenerado = await obtenerCodigoCorregido(solicitud)

    const { error: updateError } = await supabaseServer
      .from("solicitudes")
      .update({
        estado: "Rechazado",
        codigo: codigoGenerado,
        motivo_rechazo: motivo,
      })
      .eq("id", solicitud.id)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar la solicitud." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        codigoGenerado,
        solicitud,
      },
    })
  } catch (error: any) {
    console.error("Error rechazar:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Error al rechazar solicitud",
      },
      { status: 500 }
    )
  }
}