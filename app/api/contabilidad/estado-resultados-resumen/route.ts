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

    const fechaDesde = searchParams.get("desde")
    const fechaHasta = searchParams.get("hasta")

    if (!fechaDesde || !fechaHasta) {
      return NextResponse.json(
        { ok: false, error: "Faltan desde y hasta" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer.rpc("obtener_estado_resultados_resumen", {
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    })

    if (error) throw error

    const resumen = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      ok: true,
      data: resumen || null,
    })
  } catch (error: any) {
    console.error("Error API estado-resultados-resumen:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}