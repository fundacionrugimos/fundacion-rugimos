import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")?.value

  if (session !== "ok") {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  try {
    const { data, error } = await supabaseServer
      .from("donaciones_juridicas")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error("Error GET donaciones_juridicas:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")?.value

  if (session !== "ok") {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    const fecha = String(body.fecha || "").trim()
    const empresa = String(body.empresa || "").trim()
    const tipo_aporte = String(body.tipo_aporte || "").trim() as "dinero" | "especie"
    const monto_total = Number(body.monto_total || 0)
    const observacion = body.observacion ? String(body.observacion).trim() : null

    if (!fecha) {
      return NextResponse.json(
        { ok: false, error: "Ingrese la fecha del registro." },
        { status: 400 }
      )
    }

    if (!empresa) {
      return NextResponse.json(
        { ok: false, error: "Ingrese el nombre de la empresa." },
        { status: 400 }
      )
    }

    if (tipo_aporte !== "dinero" && tipo_aporte !== "especie") {
      return NextResponse.json(
        { ok: false, error: "Seleccione un tipo de aporte válido." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(monto_total) || monto_total <= 0) {
      return NextResponse.json(
        { ok: false, error: "Ingrese un monto válido." },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from("donaciones_juridicas")
      .insert([
        {
          fecha,
          empresa,
          tipo_aporte,
          monto_total,
          observacion,
        },
      ])
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error: any) {
    console.error("Error POST donaciones_juridicas:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
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
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta el id." },
        { status: 400 }
      )
    }

    const { error } = await supabaseServer
      .from("donaciones_juridicas")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("Error DELETE donaciones_juridicas:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}