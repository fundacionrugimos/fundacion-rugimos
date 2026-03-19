'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Registro {
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
  peso?: string
  tipo_animal?: string
  zona?: string
  estado?: string
  estado_cita: string
  estado_clinica?: string
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
}

interface Clinica {
  id: string
  nome: string
  zona?: string
  ativa?: boolean
}

interface HorarioClinica {
  id: string
  clinica_id: string
  hora: string
  cupos_maximos?: number | null
}

interface CupoDiario {
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
    estadoClinica === 'apto'
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
    return 'bg-green-600 text-white'
  }

  const normalizado = normalizarEstado(registro.estado_cita)

  switch (normalizado) {
    case 'PROGRAMADO':
      return 'bg-yellow-500 text-white'
    case 'REALIZADO':
      return 'bg-green-600 text-white'
    case 'CANCELADO':
      return 'bg-red-600 text-white'
    case 'REPROGRAMADO':
      return 'bg-blue-600 text-white'
    case 'RECHAZADO':
      return 'bg-gray-700 text-white'
    case 'FALLECIO':
      return 'bg-black text-white'
    case 'NO_SHOW':
      return 'bg-gray-300 text-gray-800'
    default:
      return 'bg-gray-300 text-gray-800'
  }
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
  const [saving, setSaving] = useState(false)

  const [modalFotos, setModalFotos] = useState(false)
  const [registroFotos, setRegistroFotos] = useState<Registro | null>(null)

  const [cupoInfo, setCupoInfo] = useState<{
    loading: boolean
    existe: boolean
    cupos: number
    ocupados: number
    disponibles: number
    mensaje: string
  }>({
    loading: false,
    existe: false,
    cupos: 0,
    ocupados: 0,
    disponibles: 0,
    mensaje: '',
  })

  const registrosPorPagina = 10

  async function fetchRegistros() {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setRegistros(data)
    }
  }

  async function fetchClinicas() {
    const { data, error } = await supabase
      .from('clinicas')
      .select('id,nome,zona,ativa')
      .order('nome', { ascending: true })

    if (error) {
      console.error('Error cargando clínicas:', error)
      return
    }

    if (data) {
      setClinicas(data)
    }
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

    setHorariosClinica(data || [])
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

    if (errorBuscar) {
      throw errorBuscar
    }

    if (existente) {
      return existente
    }

    const { data: horarioBase, error: errorHorario } = await supabase
      .from('horarios_clinica')
      .select('id, clinica_id, cupos_maximos')
      .eq('id', horarioId)
      .eq('clinica_id', clinicaId)
      .maybeSingle()

    if (errorHorario) {
      throw errorHorario
    }

    if (!horarioBase) {
      throw new Error('No se encontró el horario base de la clínica seleccionada.')
    }

    const cuposIniciales = horarioBase.cupos_maximos || 0

    const { data: nuevoCupo, error: errorInsert } = await supabase
      .from('cupos_diarios')
      .insert([
        {
          clinica_id: clinicaId,
          horario_id: horarioId,
          fecha,
          cupos: cuposIniciales,
          ocupados: 0,
        },
      ])
      .select('id, clinica_id, horario_id, fecha, cupos, ocupados')
      .single()

    if (errorInsert) {
      throw errorInsert
    }

    return nuevoCupo
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
    fetchRegistros()
    fetchClinicas()
  }, [])

  const registrosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase()

    return registros.filter((registro) => {
      const coincideTexto =
        registro.codigo?.toLowerCase().includes(texto) ||
        registro.nombre_animal?.toLowerCase().includes(texto) ||
        registro.nombre_responsable?.toLowerCase().includes(texto)

      if (!coincideTexto) return false

      if (filtroEstado === 'TODOS') return true

      if (filtroEstado === 'REALIZADO') {
        return esRegistroRealizadoOApto(registro)
      }

      return normalizarEstado(registro.estado_cita) === filtroEstado
    })
  }, [registros, busqueda, filtroEstado])

  const totalPaginas = Math.ceil(registrosFiltrados.length / registrosPorPagina)
  const inicio = (pagina - 1) * registrosPorPagina
  const registrosPagina = registrosFiltrados.slice(inicio, inicio + registrosPorPagina)

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

    const datosActualizar: Partial<Registro> & {
      estado_cita: string
      estado?: string
      estado_clinica?: string
      motivo_cancelacion: null
      fecha_cancelacion: null
      motivo_fallecimiento: null
      fecha_fallecimiento: null
    } = {
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
    setModalEditar(true)

    if (registro.clinica_id) {
      await fetchHorariosClinica(registro.clinica_id)
    } else {
      setHorariosClinica([])
    }

    await consultarCupoDisponible(
      registro.clinica_id,
      registro.horario_id,
      registro.fecha_programada
    )
  }

  function cerrarModalEditar() {
    setModalEditar(false)
    setRegistroEditando(null)
    setHorariosClinica([])
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
    if (
      !registroOriginal.clinica_id ||
      !registroOriginal.horario_id ||
      !registroOriginal.fecha_programada
    ) {
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

  async function ocuparNuevoCupo(
    nuevaClinicaId: string,
    nuevoHorarioId: string,
    nuevaFecha: string
  ) {
    const cupoExistente = await obtenerOCrearCupoDiario(
      nuevaClinicaId,
      nuevoHorarioId,
      nuevaFecha
    )

    if ((cupoExistente.ocupados || 0) >= (cupoExistente.cupos || 0)) {
      throw new Error('No hay cupos disponibles en la nueva clínica / horario.')
    }

    const nuevoOcupados = (cupoExistente.ocupados || 0) + 1

    const { error: errorUpdate } = await supabase
      .from('cupos_diarios')
      .update({ ocupados: nuevoOcupados })
      .eq('id', cupoExistente.id)

    if (errorUpdate) throw errorUpdate
  }

  async function guardarCambios() {
    if (!registroEditando) return

    setSaving(true)

    try {
      const registroOriginal = registros.find((r) => r.id === registroEditando.id)

      if (!registroOriginal) {
        throw new Error('No se encontró el registro original.')
      }

      const cambioProgramacion =
        registroOriginal.clinica_id !== registroEditando.clinica_id ||
        registroOriginal.horario_id !== registroEditando.horario_id ||
        registroOriginal.fecha_programada !== registroEditando.fecha_programada

      if (cambioProgramacion) {
        if (
          !registroEditando.clinica_id ||
          !registroEditando.horario_id ||
          !registroEditando.fecha_programada
        ) {
          throw new Error('Para transferir, debe seleccionar clínica, fecha y horario.')
        }

        if (!cupoInfo.existe) {
          throw new Error('No existe cupo diario para la nueva programación.')
        }

        const mismaProgramacion =
          registroOriginal.clinica_id === registroEditando.clinica_id &&
          registroOriginal.horario_id === registroEditando.horario_id &&
          registroOriginal.fecha_programada === registroEditando.fecha_programada

        if (!mismaProgramacion && cupoInfo.disponibles <= 0) {
          throw new Error('No hay cupos disponibles en la nueva clínica / horario.')
        }

        const horarioSeleccionado = horariosClinica.find(
          (h) => h.id === registroEditando.horario_id
        )

        if (!horarioSeleccionado) {
          throw new Error('Debe seleccionar un horario válido.')
        }

        await liberarCupoAnterior(registroOriginal)
        await ocuparNuevoCupo(
          registroEditando.clinica_id,
          registroEditando.horario_id,
          registroEditando.fecha_programada
        )

        registroEditando.hora = horarioSeleccionado.hora
      }

      const { id, ...datosActualizados } = registroEditando

      const { error } = await supabase
        .from('registros')
        .update(datosActualizados)
        .eq('id', id)

      if (error) throw error

      cerrarModalEditar()
      fetchRegistros()
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

  return (
    <main className="min-h-screen bg-[#026A6A] p-10">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold text-white">
              Registros de Animales 📋
            </h1>

            <div className="bg-white text-[#026A6A] px-4 py-2 rounded-xl font-semibold shadow">
              Total: {registrosFiltrados.length}
            </div>
          </div>

          <input
            type="text"
            placeholder="Buscar por código, animal o responsable..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(1)
            }}
            className="px-4 py-2 rounded-xl w-full md:w-96 border-2 border-[#F47C2A] outline-none bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filtros.map((filtro) => (
            <button
              key={filtro.key}
              onClick={() => {
                setFiltroEstado(filtro.key)
                setPagina(1)
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                filtroEstado === filtro.key
                  ? 'bg-[#F47C2A] text-white'
                  : 'bg-white text-[#026A6A]'
              }`}
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {registrosPagina.map((registro) => {
          return (
            <div
              key={registro.id}
              className="bg-white rounded-2xl shadow-xl p-5 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-lg font-bold text-[#026A6A] mb-2">
                  {registro.nombre_animal}
                </h2>

                <p className="text-sm text-gray-500 mb-3">
                  Código: {registro.codigo}
                </p>

                {registro.foto_frente ? (
                  <img
                    src={registro.foto_frente}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 mb-3">
                    Sin foto
                  </div>
                )}

                <p className="text-sm"><b>Responsable:</b> {registro.nombre_responsable}</p>
                <p className="text-sm"><b>Tel:</b> {registro.telefono}</p>

                <p className="text-sm mt-2">
                  <b>Especie:</b> {registro.especie}
                </p>

                <p className="text-sm">
                  <b>Sexo:</b> {registro.sexo}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${clasesBadgeEstadoRegistro(registro)}`}>
                    {labelEstadoRegistro(registro)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => abrirModalEditar(registro)}
                  className="bg-[#026A6A] hover:bg-[#015252] text-white px-3 py-1 rounded-lg text-sm"
                >
                  Editar
                </button>

                <button
                  onClick={() => abrirModalFotos(registro)}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Fotos
                </button>

                {normalizarEstado(registro.estado_cita) === 'PROGRAMADO' && (
                  <button
                    onClick={() => cancelarRegistro(registro.codigo)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                  >
                    Cancelar
                  </button>
                )}

                {['NO_SHOW', 'CANCELADO', 'RECHAZADO'].includes(
                  normalizarEstado(registro.estado_cita)
                ) && (
                  <button
                    onClick={() => reativarRegistro(registro)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm"
                  >
                    Reativar
                  </button>
                )}

                {normalizarEstado(registro.estado_cita) !== 'FALLECIO' && (
                  <button
                    onClick={() => marcarFallecido(registro.codigo)}
                    className="bg-black hover:bg-gray-800 text-white px-3 py-1 rounded-lg text-sm"
                  >
                    Falleció
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-3 mt-10 flex-wrap">
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            onClick={() => setPagina(num)}
            className={`px-4 py-2 rounded-lg ${
              pagina === num
                ? 'bg-[#F47C2A] text-white'
                : 'bg-white text-[#026A6A]'
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {modalEditar && registroEditando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-[#026A6A]">
                Editar registro — {registroEditando.codigo}
              </h2>

              <button
                onClick={cerrarModalEditar}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#F7F7F7] rounded-3xl p-5">
                <h3 className="font-bold text-[#026A6A] text-lg mb-4">
                  Datos del responsable
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nombre del responsable
                    </label>
                    <input
                      value={registroEditando.nombre_responsable || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          nombre_responsable: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      value={registroEditando.telefono || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          telefono: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      CI del responsable
                    </label>
                    <input
                      value={registroEditando.ci || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          ci: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#F7F7F7] rounded-3xl p-5">
                <h3 className="font-bold text-[#026A6A] text-lg mb-4">
                  Datos del animal
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nombre del animal
                    </label>
                    <input
                      value={registroEditando.nombre_animal || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          nombre_animal: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Especie
                    </label>
                    <input
                      value={registroEditando.especie || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          especie: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Raza
                    </label>
                    <input
                      value={registroEditando.raza || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          raza: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Edad
                    </label>
                    <input
                      value={registroEditando.edad || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          edad: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Sexo
                    </label>
                    <input
                      value={registroEditando.sexo || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          sexo: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Peso
                    </label>
                    <input
                      value={registroEditando.peso || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          peso: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Tipo de animal
                    </label>
                    <input
                      value={registroEditando.tipo_animal || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          tipo_animal: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#F7F7F7] rounded-3xl p-5">
                <h3 className="font-bold text-[#026A6A] text-lg mb-4">
                  Programación / clínica
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Clínica
                    </label>
                    <select
                      value={registroEditando.clinica_id || ''}
                      onChange={async (e) => {
                        const nuevaClinicaId = e.target.value

                        const nuevoRegistro = {
                          ...registroEditando,
                          clinica_id: nuevaClinicaId,
                          horario_id: '',
                          hora: '',
                        }

                        setRegistroEditando(nuevoRegistro)
                        await fetchHorariosClinica(nuevaClinicaId)
                        await consultarCupoDisponible(
                          nuevaClinicaId,
                          '',
                          nuevoRegistro.fecha_programada || ''
                        )
                      }}
                      className="w-full border p-3 rounded-xl"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Fecha programada
                    </label>
                    <input
                      type="date"
                      value={registroEditando.fecha_programada || ''}
                      onChange={async (e) => {
                        const nuevaFecha = e.target.value

                        const nuevoRegistro = {
                          ...registroEditando,
                          fecha_programada: nuevaFecha,
                        }

                        setRegistroEditando(nuevoRegistro)
                        await consultarCupoDisponible(
                          nuevoRegistro.clinica_id,
                          nuevoRegistro.horario_id,
                          nuevaFecha
                        )
                      }}
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Horario
                    </label>
                    <select
                      value={registroEditando.horario_id || ''}
                      onChange={async (e) => {
                        const horarioId = e.target.value
                        const horarioSeleccionado = horariosClinica.find((h) => h.id === horarioId)

                        const nuevoRegistro = {
                          ...registroEditando,
                          horario_id: horarioId,
                          hora: horarioSeleccionado?.hora || '',
                        }

                        setRegistroEditando(nuevoRegistro)
                        await consultarCupoDisponible(
                          nuevoRegistro.clinica_id,
                          horarioId,
                          nuevoRegistro.fecha_programada || ''
                        )
                      }}
                      className="w-full border p-3 rounded-xl"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Hora
                    </label>
                    <input
                      value={registroEditando.hora || ''}
                      readOnly
                      className="w-full border p-3 rounded-xl bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Zona
                    </label>
                    <input
                      value={registroEditando.zona || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          zona: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Estado
                    </label>
                    <select
                      value={registroEditando.estado_cita || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          estado_cita: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl"
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

                  <div className="rounded-2xl border p-4 bg-white">
                    <h4 className="font-semibold text-[#026A6A] mb-2">
                      Validación de cupo
                    </h4>

                    {cupoInfo.loading ? (
                      <p className="text-sm text-gray-600">Consultando disponibilidad...</p>
                    ) : !registroEditando.clinica_id ||
                      !registroEditando.horario_id ||
                      !registroEditando.fecha_programada ? (
                      <p className="text-sm text-gray-600">
                        Seleccione clínica, fecha y horario para validar cupos.
                      </p>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <p><b>Cupos:</b> {cupoInfo.cupos}</p>
                        <p><b>Ocupados:</b> {cupoInfo.ocupados}</p>
                        <p><b>Disponibles:</b> {cupoInfo.disponibles}</p>

                        <p
                          className={`font-semibold ${
                            cupoInfo.existe && cupoInfo.disponibles > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {cupoInfo.mensaje}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#F7F7F7] rounded-3xl p-5">
                <h3 className="font-bold text-[#026A6A] text-lg mb-4">
                  Observaciones
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Motivo de cancelación
                    </label>
                    <textarea
                      value={registroEditando.motivo_cancelacion || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          motivo_cancelacion: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl min-h-[120px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Motivo / observación del fallecimiento
                    </label>
                    <textarea
                      value={registroEditando.motivo_fallecimiento || ''}
                      onChange={(e) =>
                        setRegistroEditando({
                          ...registroEditando,
                          motivo_fallecimiento: e.target.value,
                        })
                      }
                      className="w-full border p-3 rounded-xl min-h-[120px]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                onClick={cerrarModalEditar}
                className="px-5 py-3 rounded-xl bg-gray-200 text-gray-800 font-semibold"
              >
                Cerrar
              </button>

              <button
                onClick={guardarCambios}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-[#F47C2A] hover:bg-[#d96c24] text-white font-semibold"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalFotos && registroFotos && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-3xl font-bold text-[#026A6A]">
                  Fotos del registro — {registroFotos.codigo}
                </h2>
                <p className="text-gray-600 mt-1">
                  {registroFotos.nombre_animal} — {registroFotos.nombre_responsable}
                </p>
              </div>

              <button
                onClick={cerrarModalFotos}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-[#F7F7F7] rounded-3xl p-4">
                <h3 className="font-bold text-[#026A6A] mb-3">Foto frente</h3>
                {registroFotos.foto_frente ? (
                  <img
                    src={registroFotos.foto_frente}
                    className="w-full h-[320px] object-cover rounded-2xl border"
                  />
                ) : (
                  <div className="w-full h-[320px] bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500">
                    Sin foto
                  </div>
                )}
              </div>

              <div className="bg-[#F7F7F7] rounded-3xl p-4">
                <h3 className="font-bold text-[#026A6A] mb-3">Foto lateral</h3>
                {registroFotos.foto_lado ? (
                  <img
                    src={registroFotos.foto_lado}
                    className="w-full h-[320px] object-cover rounded-2xl border"
                  />
                ) : (
                  <div className="w-full h-[320px] bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500">
                    Sin foto
                  </div>
                )}
              </div>

              <div className="bg-[#F7F7F7] rounded-3xl p-4">
                <h3 className="font-bold text-[#026A6A] mb-3">Carnet del responsable</h3>
                {registroFotos.foto_carnet ? (
                  <img
                    src={registroFotos.foto_carnet}
                    className="w-full h-[320px] object-cover rounded-2xl border"
                  />
                ) : (
                  <div className="w-full h-[320px] bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500">
                    Sin foto
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={cerrarModalFotos}
                className="px-5 py-3 rounded-xl bg-[#026A6A] text-white font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}