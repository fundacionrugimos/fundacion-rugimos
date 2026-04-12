import { supabase } from "@/lib/supabase"

export async function recalcularEntrada(entradaId: string) {
  const { data: entrada } = await supabase
    .from("entradas_inventario")
    .select("costo_total")
    .eq("id", entradaId)
    .single()

  const { data: pagos } = await supabase
    .from("pagos_entrada_inventario")
    .select("monto")
    .eq("entrada_id", entradaId)

  const total = Number(entrada?.costo_total || 0)

  const pagado = (pagos || []).reduce(
    (acc: number, p: { monto: number | null }) => acc + Number(p.monto || 0),
    0
  )

  const pendiente = Math.max(total - pagado, 0)

  let estado = "pendiente"
  if (pagado === 0) estado = "pendiente"
  else if (pagado < total) estado = "parcial"
  else estado = "pagado"

  await supabase
    .from("entradas_inventario")
    .update({
      monto_pagado: pagado,
      saldo_pendiente: pendiente,
      estado_pago: estado,
    })
    .eq("id", entradaId)
}