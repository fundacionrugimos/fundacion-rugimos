import { supabase } from "@/lib/supabase"

function getDayOfWeek(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.getDay()
}

export async function verificarBloqueioClinica(
  clinicaId: string,
  fecha: string
) {
  const diaSemana = getDayOfWeek(fecha)

  const { data: gerais, error: erroGerais } = await supabase
    .from("bloqueios_generales")
    .select("*")
    .eq("ativo", true)

  if (erroGerais) {
    console.error("Erro ao buscar bloqueios gerais:", erroGerais)
    throw erroGerais
  }

  const { data: clinica, error: erroClinica } = await supabase
    .from("bloqueios_clinica")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)

  if (erroClinica) {
    console.error("Erro ao buscar bloqueios da clínica:", erroClinica)
    throw erroClinica
  }

  const bloqueioGeneral = (gerais || []).find((b) => {
    if (b.recorrente && b.dia_semana !== null) {
      return b.dia_semana === diaSemana
    }

    return fecha >= b.fecha_inicio && fecha <= b.fecha_fin
  })

  if (bloqueioGeneral) {
    return {
      bloqueado: true,
      tipo: "general",
      motivo: bloqueioGeneral.titulo || bloqueioGeneral.motivo || "Bloqueio general",
    }
  }

  const bloqueioDaClinica = (clinica || []).find((b) => {
    if (b.recorrente && b.dia_semana !== null) {
      return b.dia_semana === diaSemana
    }

    return fecha >= b.fecha_inicio && fecha <= b.fecha_fin
  })

  if (bloqueioDaClinica) {
    return {
      bloqueado: true,
      tipo: "clinica",
      motivo: bloqueioDaClinica.titulo || bloqueioDaClinica.motivo || "Bloqueio da clínica",
    }
  }

  return {
    bloqueado: false,
    tipo: null,
    motivo: null,
  }
}