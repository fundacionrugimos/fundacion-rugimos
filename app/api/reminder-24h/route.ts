import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getLocalDateString(offsetDays = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)

  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)

  return local.toISOString().split("T")[0]
}

export async function GET() {
  try {
    const manana = getLocalDateString(1)

    const { data: pacientes, error } = await supabase
      .from("registros")
      .select(`
        id,
        codigo,
        nombre_animal,
        telefono,
        clinica_id,
        fecha_programada,
        hora,
        estado_cita,
        estado_clinica,
        recordatorio_24h_enviado
      `)
      .eq("fecha_programada", manana)
      .eq("estado_cita", "Programado")
      .eq("recordatorio_24h_enviado", false)

    if (error) {
      console.log("Error buscando pacientes reminder:", error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    let enviados = 0
    let errores = 0

    for (const paciente of pacientes || []) {
      try {
        let nombreClinica = "Clínica asignada"
        let direccionClinica = ""
        let telefonoClinica = ""
        let latClinica: number | null = null
        let lngClinica: number | null = null
        let urlMapsClinica = ""

        if (paciente.clinica_id) {
          const { data: clinica, error: clinicaError } = await supabase
            .from("clinicas")
            .select("nome,endereco,telefone,lat,lng,url_maps")
            .eq("id", paciente.clinica_id)
            .single()

          if (clinicaError) {
            console.log("Error buscando clínica:", paciente.clinica_id, clinicaError)
          }

          if (clinica) {
            nombreClinica = clinica.nome || "Clínica asignada"
            direccionClinica = clinica.endereco || ""
            telefonoClinica = clinica.telefone || ""
            latClinica = clinica.lat ?? null
            lngClinica = clinica.lng ?? null
            urlMapsClinica = clinica.url_maps || ""
          }
        }

        const ubicacion =
          urlMapsClinica.trim() ||
          (latClinica != null && lngClinica != null
            ? `https://www.google.com/maps?q=${latClinica},${lngClinica}`
            : direccionClinica.trim() || "Ubicación no disponible")

        const qrLink = `https://fundacion-rugimos.vercel.app/paciente/${paciente.codigo}`

        const telefonoClinicaFinal =
          telefonoClinica.trim() || "No disponible"

        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-whatsapp-template`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registro_id: paciente.id,
              telefono: paciente.telefono,
              tipo_mensaje: "recordatorio_24h",
              variables: {
                "1": String(paciente.codigo ?? ""),
                "2": String(paciente.nombre_animal ?? ""),
                "3": String(nombreClinica ?? "Clínica asignada"),
                "4": String(paciente.fecha_programada ?? ""),
                "5": String(paciente.hora ?? ""),
                "6": String(ubicacion),
                "7": String(qrLink),
                "8": String(telefonoClinicaFinal),
              },
              payload_extra: {
                clinica_id: paciente.clinica_id,
                clinica_nombre: nombreClinica,
                direccion_clinica: direccionClinica,
                telefono_clinica: telefonoClinicaFinal,
                clinica_lat: latClinica,
                clinica_lng: lngClinica,
                clinica_url_maps: urlMapsClinica,
                fecha_programada: paciente.fecha_programada,
                hora: paciente.hora,
                estado_cita: paciente.estado_cita,
              },
            }),
          }
        )

        const data = await resp.json()

        if (resp.ok && data?.ok) {
          await supabase
            .from("registros")
            .update({ recordatorio_24h_enviado: true })
            .eq("id", paciente.id)

          enviados++
        } else {
          console.log(
            "Error enviando reminder:",
            paciente.id,
            data?.error || data?.moreInfo || "error desconocido"
          )
          errores++
        }
      } catch (err) {
        console.log("Error interno enviando reminder:", paciente.id, err)
        errores++
      }
    }

    return NextResponse.json({
      ok: true,
      encontrados: pacientes?.length || 0,
      enviados,
      errores,
    })
  } catch (err) {
    console.log("Error interno reminder-24h:", err)
    return NextResponse.json(
      { ok: false, error: "error interno" },
      { status: 500 }
    )
  }
}