import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("donaciones_naturales_resumen")
      .select("*")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false })
      .order("fecha", { ascending: false })

    if (error) throw error

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error: "Error al cargar" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { error } = await supabaseServer
      .from("donaciones_naturales_resumen")
      .insert([body])

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error: "Error al guardar" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    const { error } = await supabaseServer
      .from("donaciones_naturales_resumen")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error: "Error al eliminar" }, { status: 500 })
  }
}