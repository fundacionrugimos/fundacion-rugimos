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
      .from("gastos_operativos")
      .select(`
        id,
        created_at,
        fecha,
        categoria,
        descripcion,
        monto,
        metodo_pago,
        comprobante_url,
        observacion
      `)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error("Error GET gastos-operativos:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al cargar gastos" },
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

    const fecha = body?.fecha
    const categoria = body?.categoria
    const descripcion = body?.descripcion ?? null
    const monto = Number(body?.monto || 0)
    const metodo_pago = body?.metodo_pago ?? null
    const observacion = body?.observacion ?? null

    if (!fecha) {
      return NextResponse.json(
        { ok: false, error: "Falta la fecha" },
        { status: 400 }
      )
    }

    if (!categoria) {
      return NextResponse.json(
        { ok: false, error: "Falta la categoría" },
        { status: 400 }
      )
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(
        { ok: false, error: "Monto inválido" },
        { status: 400 }
      )
    }

    const payload = {
      fecha,
      categoria,
      descripcion,
      monto,
      metodo_pago,
      observacion,
    }

    const { data, error } = await supabaseServer
      .from("gastos_operativos")
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error: any) {
    console.error("Error POST gastos-operativos:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al guardar" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
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

    const id = body?.id
    const fecha = body?.fecha
    const categoria = body?.categoria
    const descripcion = body?.descripcion ?? null
    const monto = Number(body?.monto || 0)
    const metodo_pago = body?.metodo_pago ?? null
    const observacion = body?.observacion ?? null

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta el id" },
        { status: 400 }
      )
    }

    if (!fecha) {
      return NextResponse.json(
        { ok: false, error: "Falta la fecha" },
        { status: 400 }
      )
    }

    if (!categoria) {
      return NextResponse.json(
        { ok: false, error: "Falta la categoría" },
        { status: 400 }
      )
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(
        { ok: false, error: "Monto inválido" },
        { status: 400 }
      )
    }

    const payload = {
      fecha,
      categoria,
      descripcion,
      monto,
      metodo_pago,
      observacion,
    }

    const { data, error } = await supabaseServer
      .from("gastos_operativos")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error: any) {
    console.error("Error PUT gastos-operativos:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al editar" },
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
    const body = await request.json()
    const id = body?.id

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta el id" },
        { status: 400 }
      )
    }

    const { error } = await supabaseServer
      .from("gastos_operativos")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({
      ok: true,
    })
  } catch (error: any) {
    console.error("Error DELETE gastos-operativos:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al eliminar" },
      { status: 500 }
    )
  }
}