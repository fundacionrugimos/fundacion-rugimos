import { supabase } from "@/lib/supabase"

export async function obtenerNumeroComprobanteEntrada() {
  const { data, error } = await supabase.rpc("generar_numero_comprobante_entrada")

  if (error) {
    throw new Error(error.message || "No se pudo generar el número de comprobante")
  }

  return String(data)
}

export function formatearFechaHoraLaPaz(value?: string | null) {
  if (!value) return "-"

  try {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function formatearMonedaBs(valor: number | null | undefined) {
  const n = Number(valor || 0)
  return `Bs ${n.toFixed(2)}`
}