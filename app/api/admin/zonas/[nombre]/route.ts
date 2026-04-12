import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(
  request: Request,
  context: { params: Promise<{ nombre: string }> }
) {
  try {
    const { nombre } = await context.params
    const nombreDecodificado = decodeURIComponent(nombre || "")

    const { data, error } = await supabaseServer
      .from("zonas")
      .select("nombre_publico")
      .eq("nombre", nombreDecodificado)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data: {
        nombre_publico: String(data?.nombre_publico || nombreDecodificado || ""),
      },
    })
  } catch (error: any) {
    console.error("Error en /api/admin/zonas/[nombre]:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error cargando zona" },
      { status: 500 }
    )
  }
}