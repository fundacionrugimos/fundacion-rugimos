import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

async function fetchAllRows<T>(
  table: string,
  selectClause: string,
  build?: (query: any) => any,
  pageSize = 1000
): Promise<T[]> {
  let from = 0
  let allRows: T[] = []

  while (true) {
    let query = supabaseServer.from(table).select(selectClause)

    if (build) {
      query = build(query)
    }

    const { data, error } = await query.range(from, from + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as T[]
    allRows = allRows.concat(rows)

    if (rows.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}

export async function GET() {
  try {
    const [
      clinicas,
      registros,
      tarifas,
      pagos,
      detalles,
    ] = await Promise.all([
      fetchAllRows("clinicas", "id,nome", (q) =>
        q.order("nome", { ascending: true })
      ),
      fetchAllRows(
        "registros",
        "id,clinica_id,especie,sexo,pagado,estado_clinica,estado_cita,fecha_programada,fecha_cirugia_realizada,nombre_animal,codigo,fecha_pago"
      ),
      fetchAllRows(
        "tarifas_clinica",
        "id,clinica_id,especie,sexo,valor,activo",
        (q) => q.eq("activo", true)
      ),
      fetchAllRows(
        "pagos_clinica",
        "id,clinica_id,fecha_pago,periodo_tipo,fecha_inicio,fecha_fin,cantidad_animales,monto_total,observacion,registrado_por,created_at",
        (q) => q.order("fecha_pago", { ascending: false })
      ),
      fetchAllRows(
        "pagos_clinica_detalle",
        "id,pago_id,registro_id,monto_unitario,monto_total,created_at"
      ),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        clinicas,
        registros,
        tarifas,
        pagos,
        detalles,
      },
    })
  } catch (error: any) {
    console.error("Error cargando pagos:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Error cargando pagos" },
      { status: 500 }
    )
  }
}