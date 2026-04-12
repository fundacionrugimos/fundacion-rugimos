'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const REENVIO_WHATSAPP_ENDPOINT = '/api/send-whatsapp-template'

type Registro = {
  id: number
  codigo: string
  nombre_responsable: string
  telefono: string
  ci: string
  nombre_animal: string
  especie: string
  raza: string
  edad: string
  sexo: string
  peso?: string | null
  tipo_animal?: string | null
  zona?: string | null
  estado?: string | null
  estado_cita: string
  estado_clinica?: string | null
  clinica_id?: string | null
  horario_id?: string | null
  hora?: string | null
  fecha_programada?: string | null
  foto_frente?: string | null
  foto_lado?: string | null
  foto_carnet?: string | null
  motivo_cancelacion?: string | null
  fecha_cancelacion?: string | null
  motivo_fallecimiento?: string | null
  fecha_fallecimiento?: string | null
  tamano?: string | null
vacunado?: boolean
desparasitado?: boolean
requiere_valoracion_prequirurgica?: boolean
peso_bajo?: boolean
menor_4_meses?: boolean
}

type Clinica = {
  id: string
  nome: string
  zona?: string | null
  ativa?: boolean | null
  endereco?: string | null
  telefono?: string | null
  maps?: string | null
maps_url?: string | null
}

type HorarioClinica = {
  id: string
  clinica_id: string
  hora: string
  cupos_maximos?: number | null
}

type CupoDiario = {
  id: string
  clinica_id: string
  horario_id: string
  fecha: string
  cupos: number
  ocupados: number
}

type FiltroEstado =
  | 'TODOS'
  | 'PROGRAMADO'
  | 'REALIZADO'
  | 'CANCELADO'
  | 'REPROGRAMADO'
  | 'RECHAZADO'
  | 'FALLECIO'
  | 'NO_SHOW'

type HistorialItem = {
  id: string
  fecha: string
  tipo: 'sistema' | 'whatsapp' | 'programacion' | 'estado'
  texto: string
}

type CupoInfo = {
  loading: boolean
  existe: boolean
  cupos: number
  ocupados: number
  disponibles: number
  mensaje: string
}

function normalizarEstado(estado?: string | null) {
  const valor = (estado || '').trim().toLowerCase()

  if (valor === 'programado') return 'PROGRAMADO'
  if (valor === 'atendido' || valor === 'realizado') return 'REALIZADO'
  if (valor === 'cancelado') return 'CANCELADO'
  if (valor === 'reprogramado') return 'REPROGRAMADO'
  if (valor === 'recusado' || valor === 'rechazado') return 'RECHAZADO'
  if (valor === 'falleció' || valor === 'fallecio') return 'FALLECIO'
  if (valor === 'no show' || valor === 'noshow' || valor === 'no_show') return 'NO_SHOW'

  return 'OTRO'
}

function esRegistroRealizadoOApto(registro: Registro) {
  const estadoCita = (registro.estado_cita || '').trim().toLowerCase()
  const estadoClinica = (registro.estado_clinica || '').trim().toLowerCase()

  return (
    estadoCita === 'realizado' ||
    estadoCita === 'atendido' ||
    estadoCita === 'fallecido' ||
    estadoCita === 'fallecio' ||
    estadoClinica === 'realizado' ||
    estadoClinica === 'atendido' ||
    estadoClinica === 'apto' ||
    estadoClinica === 'fallecido' ||
    estadoClinica === 'fallecio'
  )
}

function labelEstadoRegistro(registro: Registro) {
  const estadoClinica = (registro.estado_clinica || '').trim().toLowerCase()

  if (estadoClinica === 'apto') return 'Apto'

  const normalizado = normalizarEstado(registro.estado_cita)

  switch (normalizado) {
    case 'PROGRAMADO':
      return 'Programado'
    case 'REALIZADO':
      return 'Realizado'
    case 'CANCELADO':
      return 'Cancelado'
    case 'REPROGRAMADO':
      return 'Reprogramado'
    case 'RECHAZADO':
      return 'Rechazado'
    case 'FALLECIO':
      return 'Falleció'
    case 'NO_SHOW':
      return 'No Show'
    default:
      return registro.estado_cita || 'Sin estado'
  }
}

function clasesBadgeEstadoRegistro(registro: Registro) {
  const estadoClinica = (registro.estado_clinica || '').trim().toLowerCase()

  if (estadoClinica === 'apto') {
    return 'bg-green-100 text-green-700 border border-green-200'
  }

  const normalizado = normalizarEstado(registro.estado_cita)

  switch (normalizado) {
    case 'PROGRAMADO':
      return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'REALIZADO':
      return 'bg-green-100 text-green-700 border border-green-200'
    case 'CANCELADO':
      return 'bg-red-100 text-red-700 border border-red-200'
    case 'REPROGRAMADO':
      return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'RECHAZADO':
      return 'bg-slate-200 text-slate-700 border border-slate-300'
    case 'FALLECIO':
      return 'bg-black text-white border border-black'
    case 'NO_SHOW':
      return 'bg-zinc-200 text-zinc-800 border border-zinc-300'
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200'
  }
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return 'Sin fecha'
  const partes = fecha.split('-')
  if (partes.length !== 3) return fecha
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function formatearFechaHoraLocal(fechaIso?: string | null) {
  if (!fechaIso) return '—'
  const fecha = new Date(fechaIso)
  if (Number.isNaN(fecha.getTime())) return fechaIso

  return fecha.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getClinicaNombre(clinicas: Clinica[], clinicaId?: string | null) {
  if (!clinicaId) return 'Sin clínica'
  const clinica = clinicas.find((c) => c.id === clinicaId)
  if (!clinica) return 'Sin clínica'
  return `${clinica.nome}${clinica.zona ? ` - ${clinica.zona}` : ''}`
}

function getEstadoColorDot(registro: Registro) {
  const estadoClinica = (registro.estado_clinica || '').trim().toLowerCase()
  if (estadoClinica === 'apto') return 'bg-green-500'

  switch (normalizarEstado(registro.estado_cita)) {
    case 'PROGRAMADO':
      return 'bg-amber-500'
    case 'REALIZADO':
      return 'bg-green-500'
    case 'CANCELADO':
      return 'bg-red-500'
    case 'REPROGRAMADO':
      return 'bg-blue-500'
    case 'RECHAZADO':
      return 'bg-slate-500'
    case 'FALLECIO':
      return 'bg-black'
    case 'NO_SHOW':
      return 'bg-zinc-500'
    default:
      return 'bg-gray-400'
  }
}

function LabelInfo({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-[#E8ECEF] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value || '—'}
      </p>
    </div>
  )
}

function getPaginationItems(totalPaginas: number, paginaAtual: number) {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1)
  }

  const paginas = new Set<number>([1, totalPaginas, paginaAtual])

  for (let i = paginaAtual - 1; i <= paginaAtual + 1; i++) {
    if (i > 1 && i < totalPaginas) paginas.add(i)
  }

  const ordenadas = Array.from(paginas).sort((a, b) => a - b)
  const itens: Array<number | '...'> = []

  for (let i = 0; i < ordenadas.length; i++) {
    const atual = ordenadas[i]
    const anterior = ordenadas[i - 1]

    if (i > 0 && atual - anterior > 1) {
      itens.push('...')
    }

    itens.push(atual)
  }

  return itens
}

export default function RegistrosPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [horariosClinica, setHorariosClinica] = useState<HorarioClinica[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS')

  const [modalEditar, setModalEditar] = useState(false)
  const [registroEditando, setRegistroEditando] = useState<Registro | null>(null)
  const [registroOriginalModal, setRegistroOriginalModal] = useState<Registro | null>(null)
  const [saving, setSaving] = useState(false)

  const [modalFotos, setModalFotos] = useState(false)
  const [registroFotos, setRegistroFotos] = useState<Registro | null>(null)

  const [reenviandoWhatsapp, setReenviandoWhatsapp] = useState(false)
  const [ultimoWhatsappEnviado, setUltimoWhatsappEnviado] = useState<string | null>(null)
  const [contadorReenvios, setContadorReenvios] = useState(0)
  const [guardarYReenviar, setGuardarYReenviar] = useState(false)

  const [historialModal, setHistorialModal] = useState<HistorialItem[]>([])

  const [totalRegistros, setTotalRegistros] = useState(0)

  const [cupoInfo, setCupoInfo] = useState<CupoInfo>({
    loading: false,
    existe: false,
    cupos: 0,
    ocupados: 0,
    disponibles: 0,
    mensaje: '',
  })

  const registrosPorPagina = 10

  async function fetchRegistros() {
  const desde = (pagina - 1) * registrosPorPagina
  const hasta = desde + registrosPorPagina - 1

  let query = supabase
    .from('registros')
    .select('*', { count: 'exact' })
    .order('id', { ascending: false })

  const texto = busqueda.trim()

  if (texto) {
    query = query.or(
      `codigo.ilike.%${texto}%,nombre_animal.ilike.%${texto}%,nombre_responsable.ilike.%${texto}%`
    )
  }

  if (filtroEstado === 'PROGRAMADO') {
    query = query.eq('estado_cita', 'Programado')
  }

  if (filtroEstado === 'CANCELADO') {
    query = query.eq('estado_cita', 'Cancelado')
  }

  if (filtroEstado === 'REPROGRAMADO') {
    query = query.eq('estado_cita', 'Reprogramado')
  }

  if (filtroEstado === 'RECHAZADO') {
    query = query.in('estado_cita', ['Rechazado', 'Recusado'])
  }

  if (filtroEstado === 'FALLECIO') {
    query = query.in('estado_cita', ['Falleció', 'Fallecio'])
  }

  if (filtroEstado === 'NO_SHOW') {
    query = query.in('estado_cita', ['No Show', 'No_Show', 'NoShow'])
  }

  if (filtroEstado === 'REALIZADO') {
    query = query.or(
      [
        'estado_cita.eq.Realizado',
        'estado_cita.eq.Atendido',
        'estado_cita.eq.Falleció',
        'estado_cita.eq.Fallecio',
        'estado_clinica.eq.apto',
        'estado_clinica.eq.realizado',
        'estado_clinica.eq.atendido',
        'estado_clinica.eq.fallecido',
        'estado_clinica.eq.fallecio',
      ].join(',')
    )
  }

  const { data, count, error } = await query.range(desde, hasta)

  if (error) {
    console.error('Error cargando registros:', error)
    return
  }

  setRegistros((data as Registro[]) || [])
  setTotalRegistros(count || 0)
}

  async function fetchClinicas() {
    const { data, error } = await supabase
  .from('clinicas')
  .select('id,nome,zona,ativa,endereco,telefono,lat,lng,maps_url')
  .order('nome', { ascending: true })

    if (error) {
      console.error('Error cargando clínicas:', error)
      return
    }

    setClinicas((data as Clinica[]) || [])
  }

  async function fetchHorariosClinica(clinicaId: string) {
    if (!clinicaId) {
      setHorariosClinica([])
      return
    }

    const { data, error } = await supabase
      .from('horarios_clinica')
      .select('id, clinica_id, hora, cupos_maximos')
      .eq('clinica_id', clinicaId)
      .order('hora', { ascending: true })

    if (error) {
      console.error('Error cargando horarios:', error)
      setHorariosClinica([])
      return
    }

    setHorariosClinica((data as HorarioClinica[]) || [])
  }

  async function obtenerOCrearCupoDiario(
    clinicaId: string,
    horarioId: string,
    fecha: string
  ): Promise<CupoDiario> {
    const { data: existente, error: errorBuscar } = await supabase
      .from('cupos_diarios')
      .select('id, clinica_id, horario_id, fecha, cupos, ocupados')
      .eq('clinica_id', clinicaId)
      .eq('horario_id', horarioId)
      .eq('fecha', fecha)
      .maybeSingle()

    if (errorBuscar) throw errorBuscar
    if (existente) return existente as CupoDiario

    const { data: horarioBase, error: errorHorario } = await supabase
      .from('horarios_clinica')
      .select('id, clinica_id, cupos_maximos')
      .eq('id', horarioId)
      .eq('clinica_id', clinicaId)
      .maybeSingle()

    if (errorHorario) throw errorHorario
    if (!horarioBase) throw new Error('No se encontró el horario base de la clínica seleccionada.')

    const { data: nuevoCupo, error: errorInsert } = await supabase
      .from('cupos_diarios')
      .insert([
        {
          clinica_id: clinicaId,
          horario_id: horarioId,
          fecha,
          cupos: horarioBase.cupos_maximos || 0,
          ocupados: 0,
        },
      ])
      .select('id, clinica_id, horario_id, fecha, cupos, ocupados')
      .single()

    if (errorInsert) throw errorInsert

    return nuevoCupo as CupoDiario
  }

  async function consultarCupoDisponible(
    clinicaId?: string | null,
    horarioId?: string | null,
    fecha?: string | null
  ) {
    if (!clinicaId || !horarioId || !fecha) {
      setCupoInfo({
        loading: false,
        existe: false,
        cupos: 0,
        ocupados: 0,
        disponibles: 0,
        mensaje: '',
      })
      return
    }

    setCupoInfo((prev) => ({ ...prev, loading: true }))

    try {
      const data = await obtenerOCrearCupoDiario(clinicaId, horarioId, fecha)
      const disponibles = Math.max((data.cupos || 0) - (data.ocupados || 0), 0)

      setCupoInfo({
        loading: false,
        existe: true,
        cupos: data.cupos || 0,
        ocupados: data.ocupados || 0,
        disponibles,
        mensaje:
          disponibles > 0
            ? `Hay ${disponibles} cupo(s) disponible(s).`
            : 'No hay cupos disponibles en esta fecha y horario.',
      })
    } catch (error) {
      console.error('Error consultando cupo:', error)
      setCupoInfo({
        loading: false,
        existe: false,
        cupos: 0,
        ocupados: 0,
        disponibles: 0,
        mensaje: 'No se pudo validar el cupo para esta programación.',
      })
    }
  }

  useEffect(() => {
  fetchClinicas()
}, [])

useEffect(() => {
  fetchRegistros()
}, [pagina, busqueda, filtroEstado])


  useEffect(() => {
    const total = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina))
    if (pagina > total) setPagina(1)
  }, [totalRegistros, pagina])

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina))
  const paginationItems = getPaginationItems(totalPaginas, pagina)
  
  const registrosPagina = registros

  function agregarHistorialLocal(tipo: HistorialItem['tipo'], texto: string) {
    setHistorialModal((prev) => [
      {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        tipo,
        texto,
      },
      ...prev,
    ])
  }

  async function cancelarRegistro(codigo: string) {
    const motivo = prompt('Motivo de cancelación')
    if (!motivo) return

    await supabase
      .from('registros')
      .update({
        estado_cita: 'Cancelado',
        motivo_cancelacion: motivo,
        fecha_cancelacion: new Date().toISOString(),
      })
      .eq('codigo', codigo)

    fetchRegistros()
  }

  async function marcarFallecido(codigo: string) {
    const motivo = prompt('Motivo / observación del fallecimiento')
    if (!motivo) return

    const confirmar = confirm(
      '¿Está seguro de marcar este registro como FALLECIÓ? Esta acción quedará guardada en el sistema.'
    )
    if (!confirmar) return

    const { error } = await supabase
      .from('registros')
      .update({
        estado_cita: 'Falleció',
        motivo_fallecimiento: motivo,
        fecha_fallecimiento: new Date().toISOString(),
      })
      .eq('codigo', codigo)

    if (error) {
      console.error('Error marcando fallecimiento:', error)
      alert('Ocurrió un error al actualizar el registro.')
      return
    }

    fetchRegistros()
  }

  async function reativarRegistro(registro: Registro) {
    const confirmar = confirm(
      `¿Desea reactivar el registro ${registro.codigo}? Volverá a estado Programado.`
    )
    if (!confirmar) return

    const ahora = new Date()
    const offset = ahora.getTimezoneOffset()
    const local = new Date(ahora.getTime() - offset * 60 * 1000)
    const fechaHoy = local.toISOString().split('T')[0]

    const datosActualizar: Record<string, unknown> = {
      estado_cita: 'Programado',
      estado: 'Programado',
      estado_clinica: '',
      motivo_cancelacion: null,
      fecha_cancelacion: null,
      motivo_fallecimiento: null,
      fecha_fallecimiento: null,
    }

    if (normalizarEstado(registro.estado_cita) === 'NO_SHOW') {
      datosActualizar.fecha_programada = fechaHoy
    }

    const { error } = await supabase
      .from('registros')
      .update(datosActualizar)
      .eq('id', registro.id)

    if (error) {
      console.error('Error reactivando registro:', error)
      alert('Ocurrió un error al reactivar el registro.')
      return
    }

    fetchRegistros()
  }

  async function abrirModalEditar(registro: Registro) {
    setRegistroEditando({ ...registro })
    setRegistroOriginalModal({ ...registro })
    setModalEditar(true)
    setGuardarYReenviar(false)
    setUltimoWhatsappEnviado(null)
    setContadorReenvios(0)

    const historialBase: HistorialItem[] = [
      {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        tipo: 'sistema',
        texto: `Registro ${registro.codigo} abierto para edición.`,
      },
    ]

    if (registro.fecha_programada || registro.hora || registro.clinica_id) {
      historialBase.unshift({
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        tipo: 'programacion',
        texto: `Programación actual: ${getClinicaNombre(clinicas, registro.clinica_id)} · ${formatearFecha(
          registro.fecha_programada
        )} · ${registro.hora || 'Sin hora'}.`,
      })
    }

    setHistorialModal(historialBase)

    if (registro.clinica_id) {
      await fetchHorariosClinica(registro.clinica_id)
    } else {
      setHorariosClinica([])
    }

    await consultarCupoDisponible(registro.clinica_id, registro.horario_id, registro.fecha_programada)
  }

  function cerrarModalEditar() {
    setModalEditar(false)
    setRegistroEditando(null)
    setRegistroOriginalModal(null)
    setHorariosClinica([])
    setUltimoWhatsappEnviado(null)
    setContadorReenvios(0)
    setGuardarYReenviar(false)
    setHistorialModal([])
    setCupoInfo({
      loading: false,
      existe: false,
      cupos: 0,
      ocupados: 0,
      disponibles: 0,
      mensaje: '',
    })
  }

  function abrirModalFotos(registro: Registro) {
    setRegistroFotos(registro)
    setModalFotos(true)
  }

  function cerrarModalFotos() {
    setRegistroFotos(null)
    setModalFotos(false)
  }

  async function liberarCupoAnterior(registroOriginal: Registro) {
    if (!registroOriginal.clinica_id || !registroOriginal.horario_id || !registroOriginal.fecha_programada) {
      return
    }

    const { data: cupoActual, error: errorBuscar } = await supabase
      .from('cupos_diarios')
      .select('id, ocupados')
      .eq('clinica_id', registroOriginal.clinica_id)
      .eq('horario_id', registroOriginal.horario_id)
      .eq('fecha', registroOriginal.fecha_programada)
      .maybeSingle()

    if (errorBuscar) throw errorBuscar
    if (!cupoActual) return

    const nuevoOcupados = Math.max((cupoActual.ocupados || 0) - 1, 0)

    const { error: errorUpdate } = await supabase
      .from('cupos_diarios')
      .update({ ocupados: nuevoOcupados })
      .eq('id', cupoActual.id)

    if (errorUpdate) throw errorUpdate
  }

  async function ocuparNuevoCupo(nuevaClinicaId: string, nuevoHorarioId: string, nuevaFecha: string) {
    const cupoExistente = await obtenerOCrearCupoDiario(nuevaClinicaId, nuevoHorarioId, nuevaFecha)

    if ((cupoExistente.ocupados || 0) >= (cupoExistente.cupos || 0)) {
      throw new Error('No hay cupos disponibles en la nueva clínica / horario.')
    }

    const { error: errorUpdate } = await supabase
      .from('cupos_diarios')
      .update({ ocupados: (cupoExistente.ocupados || 0) + 1 })
      .eq('id', cupoExistente.id)

    if (errorUpdate) throw errorUpdate
  }

  async function reenviarWhatsappRegistro(registro: Registro) {
  try {
    setReenviandoWhatsapp(true)

    if (!registro.telefono) {
      alert('Este registro no tiene teléfono.')
      return false
    }

    if (!registro.clinica_id) {
      alert('Este registro no tiene clínica asignada.')
      return false
    }

    const clinica = clinicas.find((c) => c.id === registro.clinica_id)

    if (!clinica) {
      alert('No se encontró la clínica vinculada.')
      return false
    }

    const linkQR = `${window.location.origin}/paciente/${String(registro.codigo || '').trim().toUpperCase()}`

const linkMapa = String(clinica.maps_url || "").trim()


    const payload = {
  registro_id: String(registro.id),
  telefono: String(registro.telefono || '').trim(),
  tipo_mensaje: 'confirmacion_cupo',
  variables: {
    "1": String(registro.codigo || '').trim().toUpperCase(),
    "2": String(registro.nombre_animal || '').trim(),
    "3": String(clinica.nome || 'Clínica asignada').trim(),
    "4": String(clinica.endereco || ''),
    "5": String(formatearFecha(registro.fecha_programada) || ''),
    "6": String(registro.hora || '').trim(),
    "7": String(clinica.telefono || 'No disponible'),
    "8": String(linkMapa || ''),
    "9": String(linkQR || ''),
  },
  payload_extra: {
    clinica_id: registro.clinica_id,
    clinica_nombre: clinica.nome || 'Clínica asignada',
    fecha_programada: registro.fecha_programada,
    hora_programada: registro.hora,
    codigo: String(registro.codigo || '').trim().toUpperCase(),
  },
}

    const response = await fetch(REENVIO_WHATSAPP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || result?.moreInfo || 'No se pudo reenviar el WhatsApp.')
    }

    const ahora = new Date().toISOString()
    setUltimoWhatsappEnviado(ahora)
    setContadorReenvios((prev) => prev + 1)
    agregarHistorialLocal('whatsapp', 'WhatsApp reenviado manualmente con la programación actual.')
    alert('WhatsApp reenviado con éxito.')
    return true
  } catch (error: any) {
    console.error('Error reenviando WhatsApp:', error)
    alert(error?.message || 'Error reenviando WhatsApp')
    return false
  } finally {
    setReenviandoWhatsapp(false)
  }
}

  async function guardarCambios(reenviarDespues = false) {
    if (!registroEditando) return

    setSaving(true)

    try {
      const registroOriginal = registros.find((r) => r.id === registroEditando.id)
      if (!registroOriginal) throw new Error('No se encontró el registro original.')

      const cambioProgramacion =
        registroOriginal.clinica_id !== registroEditando.clinica_id ||
        registroOriginal.horario_id !== registroEditando.horario_id ||
        registroOriginal.fecha_programada !== registroEditando.fecha_programada

      const cambioEstado = registroOriginal.estado_cita !== registroEditando.estado_cita

      if (cambioProgramacion) {
        if (!registroEditando.clinica_id || !registroEditando.horario_id || !registroEditando.fecha_programada) {
          throw new Error('Para transferir, debe seleccionar clínica, fecha y horario.')
        }

        if (!cupoInfo.existe) throw new Error('No existe cupo diario para la nueva programación.')

        const mismaProgramacion =
          registroOriginal.clinica_id === registroEditando.clinica_id &&
          registroOriginal.horario_id === registroEditando.horario_id &&
          registroOriginal.fecha_programada === registroEditando.fecha_programada

        if (!mismaProgramacion && cupoInfo.disponibles <= 0) {
          throw new Error('No hay cupos disponibles en la nueva clínica / horario.')
        }

        const horarioSeleccionado = horariosClinica.find((h) => h.id === registroEditando.horario_id)
        if (!horarioSeleccionado) throw new Error('Debe seleccionar un horario válido.')

        await liberarCupoAnterior(registroOriginal)
        await ocuparNuevoCupo(registroEditando.clinica_id, registroEditando.horario_id, registroEditando.fecha_programada)

        registroEditando.hora = horarioSeleccionado.hora
      }

      const { id, ...datosActualizados } = registroEditando

      const { error } = await supabase.from('registros').update(datosActualizados).eq('id', id)
      if (error) throw error

      if (cambioProgramacion) {
        agregarHistorialLocal(
          'programacion',
          `Programación actualizada a ${getClinicaNombre(clinicas, registroEditando.clinica_id)} · ${formatearFecha(
            registroEditando.fecha_programada
          )} · ${registroEditando.hora || 'Sin hora'}.`
        )
      }

      if (cambioEstado) {
        agregarHistorialLocal('estado', `Estado actualizado a ${registroEditando.estado_cita}.`)
      }

      await fetchRegistros()

      if (reenviarDespues || guardarYReenviar) {
        await reenviarWhatsappRegistro({ ...registroEditando, id })
      }

      cerrarModalEditar()
    } catch (error: any) {
      console.error('Error guardando cambios:', error)
      alert(error.message || 'Ocurrió un error al guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  const filtros: { key: FiltroEstado; label: string }[] = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'PROGRAMADO', label: 'Programados' },
    { key: 'REALIZADO', label: 'Realizados / Aptos' },
    { key: 'CANCELADO', label: 'Cancelados' },
    { key: 'REPROGRAMADO', label: 'Reprogramados' },
    { key: 'RECHAZADO', label: 'Rechazados' },
    { key: 'FALLECIO', label: 'Fallecidos' },
    { key: 'NO_SHOW', label: 'No Show' },
  ]

  const resumoMudancas = useMemo(() => {
    if (!registroEditando || !registroOriginalModal) return []

    const itens: string[] = []

    if (registroOriginalModal.clinica_id !== registroEditando.clinica_id) {
      itens.push(
        `Clínica: ${getClinicaNombre(clinicas, registroOriginalModal.clinica_id)} → ${getClinicaNombre(
          clinicas,
          registroEditando.clinica_id
        )}`
      )
    }

    if (registroOriginalModal.fecha_programada !== registroEditando.fecha_programada) {
      itens.push(
        `Fecha: ${formatearFecha(registroOriginalModal.fecha_programada)} → ${formatearFecha(
          registroEditando.fecha_programada
        )}`
      )
    }

    if (registroOriginalModal.horario_id !== registroEditando.horario_id) {
      itens.push(`Horario: ${registroOriginalModal.hora || '—'} → ${registroEditando.hora || '—'}`)
    }

    if (registroOriginalModal.estado_cita !== registroEditando.estado_cita) {
      itens.push(`Estado: ${registroOriginalModal.estado_cita || '—'} → ${registroEditando.estado_cita || '—'}`)
    }

    return itens
  }, [registroEditando, registroOriginalModal, clinicas])

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#025f61] via-[#026A6A] to-[#0a7777] p-4 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-white/80">Panel administrativo</p>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                    Registros de Animales
                  </h1>
                </div>

                <div className="rounded-2xl border border-[#EAEAEA] bg-white px-4 py-3 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total registros
                  </p>
                  <p className="text-2xl font-extrabold text-[#026A6A]">{totalRegistros}</p>
                </div>
              </div>

              <div className="w-full xl:w-[430px]">
                <input
                  type="text"
                  placeholder="Buscar por código, animal o responsable..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    setPagina(1)
                  }}
                  className="w-full rounded-2xl border-2 border-[#F47C2A] bg-white px-5 py-3.5 text-slate-800 shadow-lg outline-none transition focus:ring-4 focus:ring-orange-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filtros.map((filtro) => (
                <button
                  key={filtro.key}
                  onClick={() => {
                    setFiltroEstado(filtro.key)
                    setPagina(1)
                  }}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                    filtroEstado === filtro.key
                      ? 'scale-[1.02] bg-[#F47C2A] text-white shadow-lg'
                      : 'bg-white text-[#026A6A] hover:bg-[#f8fafc]'
                  }`}
                >
                  {filtro.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {registrosPagina.map((registro) => {
            const clinicaActual = getClinicaNombre(clinicas, registro.clinica_id)

            return (
              <div
                key={registro.id}
                className="group overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
              >
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-extrabold text-[#026A6A]">{registro.nombre_animal}</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">Código: {registro.codigo}</p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${clasesBadgeEstadoRegistro(
                        registro
                      )}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${getEstadoColorDot(registro)}`} />
                      {labelEstadoRegistro(registro)}
                    </span>
                  </div>

                  {registro.foto_frente ? (
                    <img
                      src={registro.foto_frente}
                      className="mb-4 h-40 w-full rounded-2xl border border-slate-200 object-cover"
                      alt={registro.nombre_animal}
                    />
                  ) : (
                    <div className="mb-4 flex h-40 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500">
                      Sin foto
                    </div>
                  )}

                  <div className="space-y-2 text-sm text-slate-700">
                    <p><span className="font-bold text-slate-900">Responsable:</span> {registro.nombre_responsable}</p>
                    <p><span className="font-bold text-slate-900">Tel:</span> {registro.telefono}</p>
                    <p><span className="font-bold text-slate-900">Especie:</span> {registro.especie}</p>
                    <p><span className="font-bold text-slate-900">Sexo:</span> {registro.sexo}</p>
                    <p className="line-clamp-1"><span className="font-bold text-slate-900">Clínica:</span> {clinicaActual}</p>
                    <p><span className="font-bold text-slate-900">Cita:</span> {formatearFecha(registro.fecha_programada)} · {registro.hora || '—'}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => abrirModalEditar(registro)}
                      className="rounded-xl bg-[#026A6A] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#015252]"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => abrirModalFotos(registro)}
                      className="rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                    >
                      Fotos
                    </button>

                    <button
                      onClick={() => reenviarWhatsappRegistro(registro)}
                      className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Reenviar WA
                    </button>

                    {normalizarEstado(registro.estado_cita) === 'PROGRAMADO' && (
                      <button
                        onClick={() => cancelarRegistro(registro.codigo)}
                        className="rounded-xl bg-red-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                      >
                        Cancelar
                      </button>
                    )}

                    {['NO_SHOW', 'CANCELADO', 'RECHAZADO'].includes(normalizarEstado(registro.estado_cita)) && (
                      <button
                        onClick={() => reativarRegistro(registro)}
                        className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Reativar
                      </button>
                    )}

                    {normalizarEstado(registro.estado_cita) !== 'FALLECIO' && (
                      <button
                        onClick={() => marcarFallecido(registro.codigo)}
                        className="rounded-xl bg-black px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                      >
                        Falleció
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
            disabled={pagina === 1}
            className="rounded-xl bg-white px-4 py-2.5 font-semibold text-[#026A6A] shadow disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>

          {paginationItems.map((item, index) =>
            item === '...' ? (
              <span
                key={`ellipsis-${index}`}
                className="min-w-[44px] rounded-xl px-3 py-2.5 font-bold text-white/80"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => setPagina(item)}
                className={`min-w-[44px] rounded-xl px-4 py-2.5 font-semibold shadow ${
                  pagina === item
                    ? 'bg-[#F47C2A] text-white'
                    : 'bg-white text-[#026A6A] hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            onClick={() => setPagina((prev) => Math.min(prev + 1, totalPaginas))}
            disabled={pagina === totalPaginas || totalPaginas === 0}
            className="rounded-xl bg-white px-4 py-2.5 font-semibold text-[#026A6A] shadow disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {modalEditar && registroEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px] md:p-6">
          <div className="relative flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] bg-[#F6F8FA] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#026A6A] md:text-3xl">
                      {registroEditando.nombre_animal}
                    </h2>

                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${clasesBadgeEstadoRegistro(
                        registroEditando
                      )}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${getEstadoColorDot(registroEditando)}`} />
                      {labelEstadoRegistro(registroEditando)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-500">Registro {registroEditando.codigo}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <LabelInfo title="Clínica actual" value={getClinicaNombre(clinicas, registroEditando.clinica_id)} />
                    <LabelInfo title="Fecha actual" value={formatearFecha(registroEditando.fecha_programada)} />
                    <LabelInfo title="Hora actual" value={registroEditando.hora || 'Sin hora'} />
                    <LabelInfo title="Responsable" value={registroEditando.nombre_responsable} />

                    <LabelInfo title="Tamaño" value={registroEditando.tamano || '—'} />

<LabelInfo
  title="Vacunado"
  value={registroEditando.vacunado ? "Sí" : "No"}
/>

<LabelInfo
  title="Desparasitado"
  value={registroEditando.desparasitado ? "Sí" : "No"}
/>
                  </div>
                </div>
                

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => reenviarWhatsappRegistro(registroEditando)}
                    disabled={reenviandoWhatsapp}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {reenviandoWhatsapp ? 'Reenviando...' : 'Reenviar WhatsApp'}
                  </button>

                  <button
                    onClick={cerrarModalEditar}
                    className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-300"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="grid gap-6 2xl:grid-cols-[1.2fr_1fr]">
                <div className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-extrabold text-[#026A6A]">Datos del responsable</h3>
                      <p className="mt-1 text-sm text-slate-500">Información principal del tutor o responsable.</p>

                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del responsable</label>
                          <input
                            value={registroEditando.nombre_responsable || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, nombre_responsable: e.target.value })}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono</label>
                          <input
                            value={registroEditando.telefono || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, telefono: e.target.value })}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">CI del responsable</label>
                          <input
                            value={registroEditando.ci || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, ci: e.target.value })}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-extrabold text-[#026A6A]">Datos del animal</h3>
                      <p className="mt-1 text-sm text-slate-500">Datos básicos del paciente registrado.</p>

                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del animal</label>
                          <input
                            value={registroEditando.nombre_animal || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, nombre_animal: e.target.value })}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Especie</label>
                            <input
                              value={registroEditando.especie || ''}
                              onChange={(e) => setRegistroEditando({ ...registroEditando, especie: e.target.value })}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Sexo</label>
                            <input
                              value={registroEditando.sexo || ''}
                              onChange={(e) => setRegistroEditando({ ...registroEditando, sexo: e.target.value })}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Raza</label>
                          <input
                            value={registroEditando.raza || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, raza: e.target.value })}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Edad</label>
                            <input
                              value={registroEditando.edad || ''}
                              onChange={(e) => setRegistroEditando({ ...registroEditando, edad: e.target.value })}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Peso</label>
                            <input
                              value={registroEditando.peso || ''}
                              onChange={(e) => setRegistroEditando({ ...registroEditando, peso: e.target.value })}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tipo</label>
                            <input
                              value={registroEditando.tipo_animal || ''}
                              onChange={(e) => setRegistroEditando({ ...registroEditando, tipo_animal: e.target.value })}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#026A6A]">Programación / clínica</h3>
                        <p className="mt-1 text-sm text-slate-500">Aquí puedes reprogramar clínica, fecha, horario y validar el cupo.</p>
                      </div>

                      {resumoMudancas.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                          Hay cambios pendientes por guardar
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Clínica</label>
                        <select
                          value={registroEditando.clinica_id || ''}
                          onChange={async (e) => {
                            const nuevaClinicaId = e.target.value
                            const nuevoRegistro = { ...registroEditando, clinica_id: nuevaClinicaId, horario_id: '', hora: '' }
                            setRegistroEditando(nuevoRegistro)
                            await fetchHorariosClinica(nuevaClinicaId)
                            await consultarCupoDisponible(nuevaClinicaId, '', nuevoRegistro.fecha_programada || '')
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                        >
                          <option value="">Seleccionar clínica</option>
                          {clinicas
                            .filter((c) => c.ativa !== false)
                            .map((clinica) => (
                              <option key={clinica.id} value={clinica.id}>
                                {clinica.nome} {clinica.zona ? `- ${clinica.zona}` : ''}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha programada</label>
                        <input
                          type="date"
                          value={registroEditando.fecha_programada || ''}
                          onChange={async (e) => {
                            const nuevaFecha = e.target.value
                            const nuevoRegistro = { ...registroEditando, fecha_programada: nuevaFecha }
                            setRegistroEditando(nuevoRegistro)
                            await consultarCupoDisponible(nuevoRegistro.clinica_id, nuevoRegistro.horario_id, nuevaFecha)
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Horario</label>
                        <select
                          value={registroEditando.horario_id || ''}
                          onChange={async (e) => {
                            const horarioId = e.target.value
                            const horarioSeleccionado = horariosClinica.find((h) => h.id === horarioId)
                            const nuevoRegistro = { ...registroEditando, horario_id: horarioId, hora: horarioSeleccionado?.hora || '' }
                            setRegistroEditando(nuevoRegistro)
                            await consultarCupoDisponible(nuevoRegistro.clinica_id, horarioId, nuevoRegistro.fecha_programada || '')
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                        >
                          <option value="">Seleccionar horario</option>
                          {horariosClinica.map((horario) => (
                            <option key={horario.id} value={horario.id}>
                              {horario.hora}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Hora</label>
                        <input
                          value={registroEditando.hora || ''}
                          readOnly
                          className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Zona</label>
                        <input
                          value={registroEditando.zona || ''}
                          onChange={(e) => setRegistroEditando({ ...registroEditando, zona: e.target.value })}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Estado</label>
                        <select
                          value={registroEditando.estado_cita || ''}
                          onChange={(e) => setRegistroEditando({ ...registroEditando, estado_cita: e.target.value })}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                        >
                          <option value="Programado">Programado</option>
                          <option value="Realizado">Realizado</option>
                          <option value="Cancelado">Cancelado</option>
                          <option value="Reprogramado">Reprogramado</option>
                          <option value="Rechazado">Rechazado</option>
                          <option value="Falleció">Falleció</option>
                          <option value="No Show">No Show</option>
                        </select>
                      </div>
                    </div>

                    {resumoMudancas.length > 0 && (
                      <div className="mt-5 rounded-[24px] border border-dashed border-amber-300 bg-amber-50 p-4">
                        <p className="text-sm font-extrabold text-amber-800">Resumen de cambios pendientes</p>
                        <div className="mt-3 flex flex-col gap-2">
                          {resumoMudancas.map((item) => (
                            <div key={item} className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className={`mt-5 rounded-[24px] border p-5 ${
                        cupoInfo.loading
                          ? 'border-slate-200 bg-slate-50'
                          : cupoInfo.existe && cupoInfo.disponibles > 0
                            ? 'border-green-200 bg-green-50'
                            : registroEditando.clinica_id && registroEditando.horario_id && registroEditando.fecha_programada
                              ? 'border-red-200 bg-red-50'
                              : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h4 className="text-base font-extrabold text-[#026A6A]">Validación de cupo</h4>
                          <p className="mt-1 text-sm text-slate-600">Confirmación rápida para saber si la nueva programación tiene espacio.</p>
                        </div>

                        <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-bold text-slate-600">
                          {cupoInfo.loading
                            ? 'Consultando...'
                            : !registroEditando.clinica_id || !registroEditando.horario_id || !registroEditando.fecha_programada
                              ? 'Pendiente'
                              : cupoInfo.disponibles > 0
                                ? 'Disponible'
                                : 'Sin cupo'}
                        </div>
                      </div>

                      {cupoInfo.loading ? (
                        <p className="mt-4 text-sm text-slate-600">Consultando disponibilidad...</p>
                      ) : !registroEditando.clinica_id || !registroEditando.horario_id || !registroEditando.fecha_programada ? (
                        <p className="mt-4 text-sm text-slate-600">Seleccione clínica, fecha y horario para validar cupos.</p>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <LabelInfo title="Cupos" value={String(cupoInfo.cupos)} />
                          <LabelInfo title="Ocupados" value={String(cupoInfo.ocupados)} />
                          <LabelInfo title="Disponibles" value={String(cupoInfo.disponibles)} />
                        </div>
                      )}

                      {!cupoInfo.loading && registroEditando.clinica_id && registroEditando.horario_id && registroEditando.fecha_programada && (
                        <p className={`mt-4 text-sm font-extrabold ${cupoInfo.existe && cupoInfo.disponibles > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {cupoInfo.mensaje}
                        </p>
                      )}
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-extrabold text-[#026A6A]">Observaciones</h3>
                      <p className="mt-1 text-sm text-slate-500">Notas sensibles del caso, cancelación y fallecimiento.</p>

                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo de cancelación</label>
                          <textarea
                            value={registroEditando.motivo_cancelacion || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, motivo_cancelacion: e.target.value })}
                            className="min-h-[130px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo / observación del fallecimiento</label>
                          <textarea
                            value={registroEditando.motivo_fallecimiento || ''}
                            onChange={(e) => setRegistroEditando({ ...registroEditando, motivo_fallecimiento: e.target.value })}
                            className="min-h-[130px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-[#026A6A] focus:ring-4 focus:ring-teal-100"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-extrabold text-[#026A6A]">WhatsApp y seguimiento</h3>
                      <p className="mt-1 text-sm text-slate-500">Control rápido del reenvío y seguimiento de notificaciones.</p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <LabelInfo title="Último reenvío" value={formatearFechaHoraLocal(ultimoWhatsappEnviado)} />
                        <LabelInfo title="Reenvíos en esta sesión" value={String(contadorReenvios)} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <p className="text-sm font-bold text-emerald-800">La función de reenvío usa la programación actual del registro.</p>
                        <p className="mt-1 text-sm text-emerald-700">Si cambias clínica, fecha u horario, puedes guardar y reenviar la nueva confirmación.</p>
                      </div>

                      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={guardarYReenviar}
                          onChange={(e) => setGuardarYReenviar(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#026A6A] focus:ring-[#026A6A]"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-800">Guardar y reenviar WhatsApp automáticamente</p>
                          <p className="text-sm text-slate-500">Ideal para reprogramaciones o cambios importantes de la cita.</p>
                        </div>
                      </label>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => reenviarWhatsappRegistro(registroEditando)}
                          disabled={reenviandoWhatsapp}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {reenviandoWhatsapp ? 'Reenviando...' : 'Reenviar ahora'}
                        </button>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-extrabold text-[#026A6A]">Resumen del registro</h3>
                    <p className="mt-1 text-sm text-slate-500">Vista rápida para no tener que salir a revisar otra lista.</p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <LabelInfo title="Código" value={registroEditando.codigo} />
                      <LabelInfo title="Estado actual" value={labelEstadoRegistro(registroEditando)} />
                      <LabelInfo title="Clínica vinculada" value={getClinicaNombre(clinicas, registroEditando.clinica_id)} />
                      <LabelInfo title="Fecha vinculada" value={formatearFecha(registroEditando.fecha_programada)} />
                      <LabelInfo title="Hora vinculada" value={registroEditando.hora || 'Sin hora'} />
                      <LabelInfo title="Zona" value={registroEditando.zona || '—'} />
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-800">Confirmación visual de programación</p>
                      <p className="mt-1 text-sm text-slate-600">Este registro quedará guardado en:</p>
                      <p className="mt-3 text-sm font-extrabold text-[#026A6A]">
                        {getClinicaNombre(clinicas, registroEditando.clinica_id)} · {formatearFecha(registroEditando.fecha_programada)} · {registroEditando.hora || 'Sin hora'}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#026A6A]">Historial rápido</h3>
                        <p className="mt-1 text-sm text-slate-500">Compacto, sem virar uma lista gigante.</p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{historialModal.length} evento(s)</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {historialModal.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                item.tipo === 'whatsapp'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : item.tipo === 'programacion'
                                    ? 'bg-blue-100 text-blue-700'
                                    : item.tipo === 'estado'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {item.tipo}
                            </span>

                            <span className="text-xs font-medium text-slate-500">{formatearFechaHoraLocal(item.fecha)}</span>
                          </div>

                          <p className="mt-2 text-sm font-medium text-slate-700">{item.texto}</p>
                        </div>
                      ))}

                      {historialModal.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Todavía no hay movimientos registrados en esta sesión.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-extrabold text-[#026A6A]">Acciones rápidas</h3>
                    <p className="mt-1 text-sm text-slate-500">Acciones frecuentes sin salir del registro.</p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => reenviarWhatsappRegistro(registroEditando)}
                        disabled={reenviandoWhatsapp}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Reenviar WhatsApp
                      </button>

                      <button
                        onClick={() => setRegistroEditando({ ...registroEditando, estado_cita: 'Reprogramado' })}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        Marcar reprogramado
                      </button>

                      <button
                        onClick={() => setRegistroEditando({ ...registroEditando, estado_cita: 'Programado' })}
                        className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600"
                      >
                        Marcar programado
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-500">
                  {resumoMudancas.length > 0
                    ? `${resumoMudancas.length} cambio(s) pendiente(s) por guardar.`
                    : 'Sin cambios pendientes en este momento.'}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={cerrarModalEditar}
                    className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-300"
                  >
                    Cerrar
                  </button>

                  <button
                    onClick={() => guardarCambios(false)}
                    disabled={saving}
                    className="rounded-2xl bg-[#F47C2A] px-5 py-3 text-sm font-bold text-white shadow hover:bg-[#d96c24] disabled:opacity-60"
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>

                  <button
                    onClick={() => guardarCambios(true)}
                    disabled={saving}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {saving ? 'Procesando...' : 'Guardar y reenviar WhatsApp'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalFotos && registroFotos && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#026A6A]">Fotos del registro — {registroFotos.codigo}</h2>
                <p className="mt-1 text-slate-500">{registroFotos.nombre_animal} — {registroFotos.nombre_responsable}</p>
              </div>

              <button
                onClick={cerrarModalFotos}
                className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-[28px] border border-slate-200 bg-[#F7F7F7] p-4">
                <h3 className="mb-3 text-lg font-extrabold text-[#026A6A]">Foto frente</h3>
                {registroFotos.foto_frente ? (
                  <img src={registroFotos.foto_frente} className="h-[320px] w-full rounded-2xl border border-slate-200 object-cover" alt="Foto frente" />
                ) : (
                  <div className="flex h-[320px] w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-500">Sin foto</div>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[#F7F7F7] p-4">
                <h3 className="mb-3 text-lg font-extrabold text-[#026A6A]">Foto lateral</h3>
                {registroFotos.foto_lado ? (
                  <img src={registroFotos.foto_lado} className="h-[320px] w-full rounded-2xl border border-slate-200 object-cover" alt="Foto lateral" />
                ) : (
                  <div className="flex h-[320px] w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-500">Sin foto</div>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-[#F7F7F7] p-4">
                <h3 className="mb-3 text-lg font-extrabold text-[#026A6A]">Carnet del responsable</h3>
                {registroFotos.foto_carnet ? (
                  <img src={registroFotos.foto_carnet} className="h-[320px] w-full rounded-2xl border border-slate-200 object-cover" alt="Carnet del responsable" />
                ) : (
                  <div className="flex h-[320px] w-full items-center justify-center rounded-2xl bg-slate-200 text-slate-500">Sin foto</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
