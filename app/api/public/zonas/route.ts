import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const { data: clinicasData, error: clinicasError } = await supabaseServer
      .from("clinicas")
      .select("zona")
      .eq("ativa", true)
      .not("zona", "is", null)

    if (clinicasError) throw clinicasError

    const zonasOperacionales = Array.from(
      new Set(
        (clinicasData || [])
          .map((item: any) => String(item.zona || "").trim())
          .filter(Boolean)
      )
    )

    if (zonasOperacionales.length === 0) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const { data: zonasData, error: zonasError } = await supabaseServer
      .from("zonas")
      .select("nombre, nombre_publico")
      .in("nombre", zonasOperacionales)
      .eq("activa", true)

    if (zonasError) throw zonasError

    const mapa = new Map<string, string>()

    for (const z of zonasData || []) {
      mapa.set(
        String(z.nombre || "").trim(),
        String(z.nombre_publico || z.nombre || "").trim()
      )
    }

    const resultado = zonasOperacionales
      .map((zona) => ({
        value: zona,
        label: mapa.get(zona) || zona,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json({
      ok: true,
      data: resultado,
    })
  } catch (error: any) {
    console.error("Error en /api/public/zonas:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error cargando zonas" },
      { status: 500 }
    )
  }
}