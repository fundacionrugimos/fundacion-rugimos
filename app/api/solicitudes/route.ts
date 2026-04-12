import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const pagina = Number(searchParams.get("pagina") || 1)
    const porPagina = 10

    const zona = searchParams.get("zona")
    const tipo = searchParams.get("tipo")
    const sexo = searchParams.get("sexo")
    const especie = searchParams.get("especie")
    const busqueda = searchParams.get("busqueda")

    const inicio = (pagina - 1) * porPagina
    const fin = inicio + porPagina - 1

    let query = supabaseServer
      .from("solicitudes")
      .select("*", { count: "exact" })
      .eq("estado", "Pendiente")

    if (zona && zona !== "Todos") {
      query = query.eq("ubicacion", zona)
    }

    if (tipo && tipo !== "Todos") {
      query = query.eq("tipo_animal", tipo)
    }

    if (sexo && sexo !== "Todos") {
      query = query.eq("sexo", sexo)
    }

    if (especie && especie !== "Todos") {
      query = query.eq("especie", especie)
    }

    if (busqueda) {
      query = query.ilike("nombre_completo", `%${busqueda}%`)
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: true })
      .range(inicio, fin)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      data,
      total: count || 0,
    })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}