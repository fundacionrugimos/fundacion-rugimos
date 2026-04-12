import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import QRCode from "qrcode"
import { verificarBloqueioClinica } from "@/lib/agenda-clinicas"

type Solicitud = {
  id: string
  codigo: string | null
  nombre_completo: string
  celular: string
  ubicacion: string
  ci: string | null
  nombre_animal: string
  especie: string
  sexo: string
  edad: string
  peso: string
  tipo_animal: string
  foto_frente: string | null
  foto_lado: string | null
  foto_carnet: string | null
  tamano?: string | null
  vacunado?: boolean
  desparasitado?: boolean
  requiere_valoracion_prequirurgica?: boolean
}

function codigoRugimosValido(codigo?: string | null) {
  if (!codigo) return false
  return /^RG\d{1,5}$/i.test(String(codigo).trim())
}

async function obtenerProximoCodigoRugimos() {
  const { data, error } = await supabaseServer.rpc("generar_codigo_rg")

  if (error) {
    console.error(error)
    throw new Error("No se pudo generar el código Rugimos.")
  }

  if (!data) {
    throw new Error("No se recibió un código Rugimos válido.")
  }

  return String(data).trim().toUpperCase()
}

async function obtenerCodigoCorregido(solicitud: Solicitud) {
  if (codigoRugimosValido(solicitud.codigo)) {
    return String(solicitud.codigo).trim().toUpperCase()
  }

  return await obtenerProximoCodigoRugimos()
}

async function generarQR(codigo: string) {
  const url = `https://fundacion-rugimos.vercel.app/paciente/${codigo}`
  return await QRCode.toDataURL(url)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      solicitudId,
      clinicaId,
      horarioId,
      fecha,
      cupoDiarioId,
    } = body || {}

    if (!solicitudId || !clinicaId || !horarioId || !fecha || !cupoDiarioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos para confirmar la aprobación." },
        { status: 400 }
      )
    }

    const { data: solicitud, error: solicitudError } = await supabaseServer
      .from("solicitudes")
      .select("*")
      .eq("id", solicitudId)
      .single()

    if (solicitudError || !solicitud) {
      console.error(solicitudError)
      return NextResponse.json(
        { ok: false, error: "No se encontró la solicitud." },
        { status: 404 }
      )
    }

    const { data: clinica, error: clinicaError } = await supabaseServer
      .from("clinicas")
      .select("*")
      .eq("id", clinicaId)
      .single()

    if (clinicaError || !clinica) {
      console.error(clinicaError)
      return NextResponse.json(
        { ok: false, error: "No se encontró la clínica seleccionada." },
        { status: 404 }
      )
    }

    const { data: horario, error: horarioError } = await supabaseServer
      .from("horarios_clinica")
      .select("*")
      .eq("id", horarioId)
      .eq("clinica_id", clinicaId)
      .single()

    if (horarioError || !horario) {
      console.error(horarioError)
      return NextResponse.json(
        { ok: false, error: "No se encontró el horario seleccionado." },
        { status: 404 }
      )
    }

    const bloqueo = await verificarBloqueioClinica(clinicaId, fecha)

    if (bloqueo?.bloqueado) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede confirmar la aprobación porque la clínica está bloqueada en esa fecha: ${bloqueo.motivo}`,
        },
        { status: 400 }
      )
    }

    const codigoGenerado = await obtenerCodigoCorregido(solicitud as Solicitud)

    const { data: cupoActual, error: cupoActualError } = await supabaseServer
      .from("cupos_diarios")
      .select("*")
      .eq("id", cupoDiarioId)
      .eq("clinica_id", clinicaId)
      .eq("horario_id", horarioId)
      .eq("fecha", fecha)
      .maybeSingle()

    if (cupoActualError || !cupoActual) {
      console.error(cupoActualError)
      return NextResponse.json(
        { ok: false, error: "No se pudo verificar el cupo antes de confirmar." },
        { status: 400 }
      )
    }

    if (Number(cupoActual.ocupados) >= Number(cupoActual.cupos)) {
      return NextResponse.json(
        { ok: false, error: "Ese horario se quedó sin cupos. Elija otro." },
        { status: 409 }
      )
    }

    const nuevoOcupado = Number(cupoActual.ocupados) + 1

    const { data: cupoReservado, error: updateCupoError } = await supabaseServer
      .from("cupos_diarios")
      .update({ ocupados: nuevoOcupado })
      .eq("id", cupoActual.id)
      .eq("ocupados", cupoActual.ocupados)
      .select("id")
      .maybeSingle()

    if (updateCupoError || !cupoReservado) {
      console.error(updateCupoError)
      return NextResponse.json(
        { ok: false, error: "No se pudo reservar el cupo. Intente nuevamente." },
        { status: 409 }
      )
    }

    const qr = await generarQR(codigoGenerado)

    const { data: registroCreado, error: insertRegistroError } = await supabaseServer
      .from("registros")
      .insert([
        {
          codigo: codigoGenerado,
          nombre_responsable: solicitud.nombre_completo,
          telefono: solicitud.celular,
          ci: solicitud.ci,
          nombre_animal: solicitud.nombre_animal,
          especie: solicitud.especie,
          sexo: solicitud.sexo,
          edad: solicitud.edad,
          peso: solicitud.peso,
          tipo_animal: solicitud.tipo_animal,
          zona: solicitud.ubicacion,

          tamano: solicitud.tamano || null,
          vacunado: solicitud.vacunado ?? false,
          desparasitado: solicitud.desparasitado ?? false,
          requiere_valoracion_prequirurgica:
            solicitud.requiere_valoracion_prequirurgica ?? false,

          estado: "Pendiente",
          estado_cita: "Programado",
          estado_clinica: "Pendiente",
          clinica_id: clinica.id,
          horario_id: horario.id,
          hora: horario.hora,
          fecha_programada: fecha,
          foto_frente: solicitud.foto_frente,
          foto_lado: solicitud.foto_lado,
          foto_carnet: solicitud.foto_carnet,
          qr_code: qr,
        },
      ])
      .select("id")
      .single()

    if (insertRegistroError || !registroCreado) {
      console.error(insertRegistroError)

      await supabaseServer
        .from("cupos_diarios")
        .update({ ocupados: cupoActual.ocupados })
        .eq("id", cupoActual.id)

      return NextResponse.json(
        { ok: false, error: "No se pudo crear el registro del paciente." },
        { status: 500 }
      )
    }

    const { error: aprobarError } = await supabaseServer
      .from("solicitudes")
      .update({
        estado: "Aprobado",
        codigo: codigoGenerado,
      })
      .eq("id", solicitud.id)

    if (aprobarError) {
      console.error(aprobarError)

      await supabaseServer
        .from("registros")
        .delete()
        .eq("id", registroCreado.id)

      await supabaseServer
        .from("cupos_diarios")
        .update({ ocupados: cupoActual.ocupados })
        .eq("id", cupoActual.id)

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo actualizar la solicitud. Se revirtió la aprobación para evitar inconsistencias.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        registroId: registroCreado.id,
        codigoGenerado,
        clinica,
        horario,
        solicitud,
        fecha,
      },
    })
  } catch (error: any) {
    console.error("Error en /api/solicitudes/aprobar:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Ocurrió un error al aprobar la solicitud.",
      },
      { status: 500 }
    )
  }
}