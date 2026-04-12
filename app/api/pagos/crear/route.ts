import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      clinica_id,
      fecha_pago,
      periodo_tipo,
      fecha_inicio,
      fecha_fin,
      cantidad_animales,
      monto_total,
      observacion,
      detalles,
    } = body

    // 1. Crear pago
    const { data: pago, error: errorPago } = await supabaseServer
      .from("pagos_clinica")
      .insert([
        {
          clinica_id,
          fecha_pago,
          periodo_tipo,
          fecha_inicio,
          fecha_fin,
          cantidad_animales,
          monto_total,
          observacion,
        },
      ])
      .select("*")
      .single()

    if (errorPago) throw errorPago

    // 2. Crear detalles
    if (detalles && detalles.length > 0) {
      const detallesInsert = detalles.map((d: any) => ({
        pago_id: pago.id,
        registro_id: d.registro_id,
        monto_unitario: d.monto_unitario,
        monto_total: d.monto_total,
      }))

      const { error: errorDetalles } = await supabaseServer
        .from("pagos_clinica_detalle")
        .insert(detallesInsert)

      if (errorDetalles) throw errorDetalles

      // 3. Marcar registros como pagados
      const ids = detalles.map((d: any) => d.registro_id)

      const { error: errorUpdate } = await supabaseServer
        .from("registros")
        .update({
          pagado: true,
          fecha_pago,
        })
        .in("id", ids)

      if (errorUpdate) throw errorUpdate
    }

    return NextResponse.json({ ok: true, pago })
  } catch (error: any) {
    console.error("Error creando pago:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}