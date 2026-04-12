import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const [clinicasResp, zonasResp] = await Promise.all([
      supabaseServer
        .from("clinicas")
        .select("*")
        .order("nome", { ascending: true }),

      supabaseServer
        .from("zonas")
        .select("nombre")
        .eq("activa", true)
        .order("nombre", { ascending: true }),
    ])

    if (clinicasResp.error) throw clinicasResp.error
    if (zonasResp.error) throw zonasResp.error

    return NextResponse.json({
      ok: true,
      data: {
        clinicas: clinicasResp.data || [],
        zonas: (zonasResp.data || []).map((z: any) => z.nombre),
      },
    })
  } catch (error: any) {
    console.error("Error en /api/admin/clinicas:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error cargando clínicas" },
      { status: 500 }
    )
  }
}