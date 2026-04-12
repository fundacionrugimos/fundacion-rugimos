export interface BloqueioGeneral {
  id: string
  titulo: string
  motivo?: string | null
  fecha_inicio: string
  fecha_fin: string
  recorrente: boolean
  dia_semana?: number | null
  ativo: boolean
  tipo_bloqueio: "dia_completo" | "horario"
  hora_inicio?: string | null
  hora_fin?: string | null
  horario_id?: string | null
  created_at?: string
}

export interface BloqueioClinica {
  id: string
  clinica_id: string
  titulo: string
  motivo?: string | null
  fecha_inicio: string
  fecha_fin: string
  recorrente: boolean
  dia_semana?: number | null
  ativo: boolean
  tipo_bloqueio: "dia_completo" | "horario"
  hora_inicio?: string | null
  hora_fin?: string | null
  horario_id?: string | null
  created_at?: string
}