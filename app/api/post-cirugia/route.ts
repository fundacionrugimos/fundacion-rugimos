import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getLocalDateString(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function normalizarTexto(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

function telefoneValido(telefono?: string | null) {
  const digits = String(telefono || "").replace(/\D/g, "")
  return digits.length >= 8
}

function estadoExcluido(estado?: string | null) {
  const valor = normalizarTexto(estado)

  return [
    "cancelado",
    "rechazado",
    "rejeitado",
    "fallecio",
    "falleció",
    "no show",
    "noshow",
    "no_show",
  ].includes(valor)
}

export async function GET() {
  try {
    const hoy = new Date()
    const fechaHoy = getLocalDateString(hoy)
    const inicioMes = `${fechaHoy.slice(0, 7)}-01`

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "BASE_URL no configurada" },
        { status: 500 }
      )
    }

    const { data: pacientes, error } = await supabase
      .from("registros")
      .select(`
        id,
        codigo,
        nombre_animal,
        telefono,
        fecha_cirugia_realizada,
        estado_cita,
        estado_clinica,
        agradecimiento_enviado
      `)
      .not("fecha_cirugia_realizada", "is", null)
      .eq("agradecimiento_enviado", false)

    if (error) {
      console.log("Error buscando post-cirugia:", error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    const descartados = {
      sin_fecha: 0,
      fuera_del_mes: 0,
      futura: 0,
      sin_telefono: 0,
      estado_excluido: 0,
    }

    const elegibles = (pacientes || []).filter((paciente) => {
      if (!paciente.fecha_cirugia_realizada) {
        descartados.sin_fecha++
        return false
      }

      const fechaCirugia = String(paciente.fecha_cirugia_realizada).slice(0, 10)

      if (fechaCirugia < inicioMes) {
        descartados.fuera_del_mes++
        return false
      }

      if (fechaCirugia > fechaHoy) {
        descartados.futura++
        return false
      }

      if (!telefoneValido(paciente.telefono)) {
        descartados.sin_telefono++
        return false
      }

      if (estadoExcluido(paciente.estado_cita)) {
        descartados.estado_excluido++
        return false
      }

      return true
    })

    let enviados = 0
    let errores = 0

    for (const paciente of elegibles) {
      try {
        const resp = await fetch(`${baseUrl}/api/send-whatsapp-template`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registro_id: paciente.id,
            telefono: paciente.telefono,
            tipo_mensaje: "agradecimiento_postcirugia",
            variables: {
              "1": paciente.nombre_animal || "paciente",
              "2": paciente.codigo || "-",
            },
            payload_extra: {
              fecha_cirugia_realizada: paciente.fecha_cirugia_realizada,
              estado_cita: paciente.estado_cita,
              estado_clinica: paciente.estado_clinica,
              modo_envio: "pendientes_del_mes",
            },
          }),
        })

        const data = await resp.json()

        if (resp.ok && data?.ok) {
          const { error: updateError } = await supabase
            .from("registros")
            .update({ agradecimiento_enviado: true })
            .eq("id", paciente.id)

          if (updateError) {
            console.log(
              "Error marcando agradecimiento_enviado:",
              paciente.id,
              updateError.message
            )
            errores++
            continue
          }

          enviados++
        } else {
          console.log(
            "Error enviando agradecimiento:",
            paciente.id,
            data?.error || data?.moreInfo || "error desconocido"
          )
          errores++
        }
      } catch (err) {
        console.log("Error interno enviando agradecimiento:", paciente.id, err)
        errores++
      }
    }

    return NextResponse.json({
      ok: true,
      modo: "pendientes_del_mes",
      fecha_hoy: fechaHoy,
      inicio_mes: inicioMes,
      encontrados: elegibles.length,
      enviados,
      errores,
      descartados,
    })
  } catch (err) {
    console.log("Error interno post-cirugia:", err)

    return NextResponse.json(
      { ok: false, error: "error interno" },
      { status: 500 }
    )
  }
}