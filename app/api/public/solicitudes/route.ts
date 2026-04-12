import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

function limpiarTexto(valor: string) {
  return (valor || "").trim().toLowerCase().replace(/\s+/g, " ")
}

function limpiarTelefono(valor: string) {
  return (valor || "").replace(/\D/g, "")
}

function fechaHaceDias(dias: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fecha.toISOString()
}

async function generarCodigoRG() {
  const { data, error } = await supabaseServer.rpc("generar_codigo_rg")

  if (error) {
    console.error("Error generando código RG:", error)
    throw new Error("No se pudo generar el código RG")
  }

  if (!data) {
    throw new Error("No se pudo generar el código RG")
  }

  return String(data)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      nombre_completo,
      ci,
      celular,
      ubicacion,
      lat,
      lng,
      nombre_animal,
      especie,
      sexo,
      edad,
      peso,
      tipo_animal,
      foto_frente,
      foto_lado,
      foto_carnet,
      tamano,
      vacunado,
      desparasitado,
      requiere_valoracion_prequirurgica,
    } = body || {}

    if (
      !nombre_completo ||
      !ci ||
      !celular ||
      !ubicacion ||
      !nombre_animal ||
      !especie ||
      !sexo ||
      !edad ||
      !peso ||
      !tipo_animal ||
      !foto_frente ||
      !foto_lado ||
      !foto_carnet
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      )
    }

    const celularLimpio = limpiarTelefono(celular)
    const nombreAnimalLimpio = limpiarTexto(nombre_animal)
    const especieLimpia = limpiarTexto(especie)
    const sexoLimpio = limpiarTexto(sexo)

    const fechaLimite = fechaHaceDias(90)

    const { data: posiblesDuplicados, error: errorDuplicado } = await supabaseServer
      .from("solicitudes")
      .select("id, celular, nombre_animal, especie, sexo, estado, created_at")
      .in("estado", ["Pendiente", "Aprobado", "Reprogramado"])
      .gte("created_at", fechaLimite)

    if (errorDuplicado) {
      console.error("Error verificando duplicados:", errorDuplicado)
      return NextResponse.json(
        { ok: false, error: "Ocurrió un error verificando si la solicitud ya existe." },
        { status: 500 }
      )
    }

    const duplicado = (posiblesDuplicados || []).find((item: any) => {
      const cel = limpiarTelefono(item.celular || "")
      const animal = limpiarTexto(item.nombre_animal || "")
      const esp = limpiarTexto(item.especie || "")
      const sx = limpiarTexto(item.sexo || "")

      return (
        cel === celularLimpio &&
        animal === nombreAnimalLimpio &&
        esp === especieLimpia &&
        sx === sexoLimpio
      )
    })

    if (duplicado) {
      return NextResponse.json(
        {
          ok: false,
          duplicated: true,
          error:
            "Ya existe una solicitud reciente para esta mascota con este número de contacto. Si necesita corregir información o consultar el estado, comuníquese con Fundación Rugimos.",
        },
        { status: 409 }
      )
    }

    const codigoGenerado = await generarCodigoRG()

    const { error: insertError } = await supabaseServer.from("solicitudes").insert([
      {
        codigo: codigoGenerado,
        nombre_completo,
        ci,
        celular,
        ubicacion,
        lat,
        lng,
        nombre_animal,
        especie,
        sexo,
        edad,
        peso,
        tipo_animal,
        foto_frente,
        foto_lado,
        foto_carnet,
        estado: "Pendiente",
        tamano: tamano || null,
        vacunado: Boolean(vacunado),
        desparasitado: Boolean(desparasitado),
        requiere_valoracion_prequirurgica: Boolean(requiere_valoracion_prequirurgica),
      },
    ])

    if (insertError) {
      console.error("Error insertando solicitud:", insertError)
      return NextResponse.json(
        { ok: false, error: "Ocurrió un error al guardar la solicitud." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      codigo: codigoGenerado,
    })
  } catch (error: any) {
    console.error("Error general enviando solicitud:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Ocurrió un error al enviar la solicitud." },
      { status: 500 }
    )
  }
}