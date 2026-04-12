import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET() {
  try {

    // DONACIONES
    const { data: donaciones } = await supabaseServer
      .from("donaciones")
      .select("monto")

    const totalDonaciones = donaciones?.reduce((acc, d) => acc + (d.monto || 0), 0) || 0

    // DONACIONES JURIDICAS
    const { data: juridicas } = await supabaseServer
      .from("donaciones_juridicas")
      .select("monto_total")

    const totalJuridicas = juridicas?.reduce((acc, d) => acc + (d.monto_total || 0), 0) || 0

    // DONACIONES ESPECIE
    const { data: especie } = await supabaseServer
      .from("donaciones_especie")
      .select("valor_estimado")

    const totalEspecie = especie?.reduce((acc, d) => acc + (d.valor_estimado || 0), 0) || 0

    // GASTOS
    const { data: gastos } = await supabaseServer
      .from("gastos_operativos")
      .select("monto")

    const totalGastos = gastos?.reduce((acc, g) => acc + (g.monto || 0), 0) || 0

    // PAGOS CLINICAS
    const { data: pagos } = await supabaseServer
      .from("pagos_clinica")
      .select("monto_total")

    const totalPagos = pagos?.reduce((acc, p) => acc + (p.monto_total || 0), 0) || 0

    const resultado = totalDonaciones + totalJuridicas + totalEspecie - totalGastos - totalPagos

    return NextResponse.json({
      ok: true,
      resumen: {
        totalDonaciones,
        totalJuridicas,
        totalEspecie,
        totalGastos,
        totalPagos,
        resultado
      }
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}