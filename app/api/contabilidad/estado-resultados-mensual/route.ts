import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")?.value

  if (session !== "ok") {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    const anio = Number(searchParams.get("anio"))

    if (!anio) {
      return NextResponse.json(
        { ok: false, error: "Falta anio" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer.rpc("obtener_estado_resultados_mensual", {
      p_anio: anio,
    })

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error("Error API estado-resultados-mensual:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}