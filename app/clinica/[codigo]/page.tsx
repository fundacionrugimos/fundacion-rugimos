"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

type HorarioDisponible = {
  horario_id: string
  hora: string
  cupos: number
  ocupados: number
  disponibles: number
}

export default function PacienteClinica() {
  const params = useParams()
  const router = useRouter()

  const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo ?? ""
  const codigoLimpo = codigo.trim().toUpperCase()

  const [registro, setRegistro] = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const [fotoModal, setFotoModal] = useState<string | null>(null)

  const [modalReprogramar, setModalReprogramar] = useState(false)
  const [motivoReprogramacion, setMotivoReprogramacion] = useState("")
  const [fechaReprogramada, setFechaReprogramada] = useState("")
  const [horarioSeleccionado, setHorarioSeleccionado] = useState("")
  const [horariosDisponibles, setHorariosDisponibles] = useState<HorarioDisponible[]>([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)

  function getLocalDateString(baseDate?: Date) {
    const now = baseDate || new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)
    return local.toISOString().split("T")[0]
  }

  useEffect(() => {
    const clinica = localStorage.getItem("clinica_id")
    const loginTime = localStorage.getItem("clinica_login_time")

    if (!clinica || !loginTime) {
      sessionStorage.setItem("paciente_redirect", codigoLimpo)
      router.push("/clinica/login")
      return
    }

    const ahora = Date.now()
    const cincoMin = 5 * 60 * 1000

    if (ahora - Number(loginTime) > cincoMin) {
      localStorage.removeItem("clinica_id")
      localStorage.removeItem("clinica_zona")
      localStorage.removeItem("clinica_login_time")

      sessionStorage.setItem("paciente_redirect", codigoLimpo)
      router.push("/clinica/login")
    }
  }, [codigoLimpo, router])

  async function cargar() {
    setCargando(true)
    setNoEncontrado(false)

    const { data, error } = await supabase
      .from("registros")
      .select("*")
      .ilike("codigo", codigoLimpo)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.log("Error cargando paciente:", error)
      setCargando(false)
      return
    }

    if (!data) {
      setNoEncontrado(true)
      setRegistro(null)
      setCargando(false)
      return
    }

    setRegistro(data)
    setCargando(false)
  }

  useEffect(() => {
    if (codigoLimpo) {
      cargar()
    }
  }, [codigoLimpo])

  function normalizarTexto(valor: string | null | undefined) {
    return (valor || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
  }

  const estadoFinal = normalizarTexto(registro?.estado_clinica)

  const finalizado =
    estadoFinal === "APTO" ||
    estadoFinal === "RECHAZADO" ||
    estadoFinal === "FALLECIDO" ||
    estadoFinal === "NO SHOW"

  function volverClinica() {
    setTimeout(() => {
      router.push("/clinica")
    }, 1200)
  }

  async function marcarApto() {
    if (finalizado || procesando || !registro?.id) return

    const clinicaId = localStorage.getItem("clinica_id")
    if (!clinicaId) {
      alert("Sesión clínica no encontrada")
      return
    }

    setProcesando(true)

    const { error } = await supabase
      .from("registros")
      .update({
        estado_clinica: "APTO",
        estado_cita: "Realizado",
        clinica_id: clinicaId,
        fecha_cirugia_realizada: new Date().toISOString(),
      })
      .eq("id", registro.id)

    if (error) {
      console.log("Error marcando APTO:", error)
      alert("Error marcando paciente como APTO")
      setProcesando(false)
      return
    }

    localStorage.setItem("rugimos_update_resumen", Date.now().toString())
    alert("Paciente marcado como APTO")
    volverClinica()
  }

  async function marcarNoApto() {
    if (finalizado || procesando) return

    const motivo = prompt("Motivo do NO APTO:")

    if (!motivo) {
      alert("Debe ingresar un motivo")
      return
    }

    setProcesando(true)

    const { error } = await supabase
      .from("registros")
      .update({
        estado_clinica: "Rechazado",
        estado_cita: "Rechazado",
        motivo_no_apto: motivo,
      })
      .eq("codigo", codigoLimpo)

    if (error) {
      console.log("Error marcando NO APTO:", error)
      alert("Error actualizando registro")
      setProcesando(false)
      return
    }

    localStorage.setItem("rugimos_update_resumen", Date.now().toString())
    alert("Paciente marcado como RECHAZADO")
    volverClinica()
  }

  function abrirModalReprogramar() {
    if (finalizado || procesando) return
    setMotivoReprogramacion("")
    setHorarioSeleccionado("")
    setHorariosDisponibles([])
    setFechaReprogramada("")
    setModalReprogramar(true)
  }

  async function cargarHorariosDisponibles(fecha: string) {
    const clinicaId = localStorage.getItem("clinica_id")
    if (!clinicaId || !fecha) return

    setCargandoHorarios(true)
    setHorarioSeleccionado("")

    const { data: horariosData, error: horariosError } = await supabase
      .from("horarios_clinica")
      .select("id, hora, cupos_maximos")
      .eq("clinica_id", clinicaId)
      .order("hora", { ascending: true })

    if (horariosError) {
      console.log("Error cargando horarios_clinica:", horariosError)
      setHorariosDisponibles([])
      setCargandoHorarios(false)
      return
    }

    const horarios = horariosData || []

    if (horarios.length === 0) {
      setHorariosDisponibles([])
      setCargandoHorarios(false)
      return
    }

    const { data: registrosFecha, error: registrosError } = await supabase
      .from("registros")
      .select("id, hora, estado_clinica, fecha_programada")
      .eq("clinica_id", clinicaId)
      .eq("fecha_programada", fecha)

    if (registrosError) {
      console.log("Error cargando registros de la fecha:", registrosError)
      setHorariosDisponibles([])
      setCargandoHorarios(false)
      return
    }

    const ocupadosPorHora: Record<string, number> = {}

    ;(registrosFecha || []).forEach((r: any) => {
      const hora = r.hora || ""
      if (!hora) return

      const estado = normalizarTexto(r.estado_clinica)

      if (
        estado === "RECHAZADO" ||
        estado === "FALLECIDO" ||
        estado === "NO SHOW"
      ) {
        return
      }

      ocupadosPorHora[hora] = (ocupadosPorHora[hora] || 0) + 1
    })

    const horariosDisponiblesFinal = horarios
      .map((h: any) => {
        const cupos = Number(h.cupos_maximos || 0)
        const ocupados = Number(ocupadosPorHora[h.hora] || 0)
        const disponibles = Math.max(0, cupos - ocupados)

        return {
          horario_id: h.id,
          hora: h.hora,
          cupos,
          ocupados,
          disponibles,
        }
      })
      .filter((h: any) => h.disponibles > 0)

    setHorariosDisponibles(horariosDisponiblesFinal)
    setCargandoHorarios(false)
  }

  useEffect(() => {
    if (modalReprogramar && fechaReprogramada) {
      cargarHorariosDisponibles(fechaReprogramada)
    }
  }, [modalReprogramar, fechaReprogramada])

  async function confirmarReprogramacion() {
    if (finalizado || procesando) return

    const clinicaId = localStorage.getItem("clinica_id")
    if (!clinicaId) {
      alert("Sesión clínica no encontrada")
      return
    }

    if (!motivoReprogramacion.trim()) {
      alert("Debe ingresar un motivo")
      return
    }

    if (!fechaReprogramada) {
      alert("Debe seleccionar una fecha")
      return
    }

    if (!horarioSeleccionado) {
      alert("Debe seleccionar un horario")
      return
    }

    const horarioElegido = horariosDisponibles.find((h) => h.horario_id === horarioSeleccionado)
    if (!horarioElegido) {
      alert("Horario inválido")
      return
    }

    setProcesando(true)

    try {
      if (registro?.fecha_programada && registro?.hora) {
        const { data: horarioAnterior } = await supabase
          .from("horarios_clinica")
          .select("id")
          .eq("clinica_id", clinicaId)
          .eq("hora", registro.hora)
          .maybeSingle()

        if (horarioAnterior?.id) {
          const { data: cupoAnterior } = await supabase
            .from("cupos_diarios")
            .select("id, ocupados")
            .eq("clinica_id", clinicaId)
            .eq("fecha", registro.fecha_programada)
            .eq("horario_id", horarioAnterior.id)
            .maybeSingle()

          if (cupoAnterior?.id) {
            const nuevoOcupados = Math.max(0, Number(cupoAnterior.ocupados || 0) - 1)

            await supabase
              .from("cupos_diarios")
              .update({ ocupados: nuevoOcupados })
              .eq("id", cupoAnterior.id)
          }
        }
      }

      let { data: nuevoCupo, error: nuevoCupoError } = await supabase
        .from("cupos_diarios")
        .select("id, cupos, ocupados")
        .eq("clinica_id", clinicaId)
        .eq("fecha", fechaReprogramada)
        .eq("horario_id", horarioSeleccionado)
        .maybeSingle()

      if (nuevoCupoError) {
        console.log("Error cargando nuevo cupo:", nuevoCupoError)
        alert("Error verificando el cupo del nuevo horario")
        setProcesando(false)
        return
      }

      if (!nuevoCupo) {
        const { data: horarioData, error: horarioError } = await supabase
          .from("horarios_clinica")
          .select("id, cupos_maximos")
          .eq("id", horarioSeleccionado)
          .maybeSingle()

        if (horarioError || !horarioData) {
          console.log("Error cargando horario para crear cupo:", horarioError)
          alert("No se pudo crear el cupo para el nuevo horario")
          setProcesando(false)
          return
        }

        const { data: cupoCreado, error: crearCupoError } = await supabase
          .from("cupos_diarios")
          .insert({
            clinica_id: clinicaId,
            horario_id: horarioSeleccionado,
            fecha: fechaReprogramada,
            cupos: Number(horarioData.cupos_maximos || 0),
            ocupados: 0,
          })
          .select("id, cupos, ocupados")
          .single()

        if (crearCupoError || !cupoCreado) {
          console.log("Error creando nuevo cupo:", crearCupoError)
          alert("No se pudo crear el cupo del nuevo horario")
          setProcesando(false)
          return
        }

        nuevoCupo = cupoCreado
      }

      const disponibles = Number(nuevoCupo.cupos || 0) - Number(nuevoCupo.ocupados || 0)

      if (disponibles <= 0) {
        alert("Ese horario ya no tiene cupo disponible")
        setProcesando(false)
        return
      }

      const { error: updateNuevoCupoError } = await supabase
        .from("cupos_diarios")
        .update({ ocupados: Number(nuevoCupo.ocupados || 0) + 1 })
        .eq("id", nuevoCupo.id)

      if (updateNuevoCupoError) {
        console.log("Error ocupando nuevo cupo:", updateNuevoCupoError)
        alert("No se pudo reservar el nuevo horario")
        setProcesando(false)
        return
      }

      const { error: errorRegistro } = await supabase
        .from("registros")
        .update({
          estado_clinica: "Reprogramado",
          estado_cita: "Reprogramado",
          motivo_no_apto: motivoReprogramacion,
          fecha_reprogramacion: new Date().toISOString(),
          fecha_programada: fechaReprogramada,
          hora: horarioElegido.hora,
          clinica_id: clinicaId,
        })
        .eq("codigo", codigoLimpo)

      if (errorRegistro) {
        console.log("Error reprogramando registro:", errorRegistro)
        alert("Error actualizando registro")
        setProcesando(false)
        return
      }

      localStorage.setItem("rugimos_update_resumen", Date.now().toString())
      alert("Cirugía reprogramada correctamente")
      setModalReprogramar(false)
      volverClinica()
    } catch (error) {
      console.log("Error general reprogramando:", error)
      alert("Error reprogramando")
      setProcesando(false)
    }
  }

  function colorEstado() {
    const estado = normalizarTexto(registro?.estado_clinica)

    if (!estado || estado === "PENDIENTE") return "bg-yellow-500"
    if (estado === "APTO") return "bg-green-600"
    if (estado === "RECHAZADO" || estado === "NO APTO") return "bg-red-600"
    if (estado === "REPROGRAMADO") return "bg-orange-500"
    if (estado === "NO SHOW") return "bg-gray-700"
    if (estado === "FALLECIDO") return "bg-black"

    return "bg-gray-400"
  }

  const fechaMinima = useMemo(() => getLocalDateString(), [])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F6D6A] text-white text-xl">
        Cargando paciente...
      </div>
    )
  }

  if (noEncontrado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F6D6A] text-white gap-6">
        <h1 className="text-3xl font-bold">Código no encontrado</h1>

        <button
          onClick={() => router.push("/clinica")}
          className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-xl font-bold"
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">Paciente {registro.codigo}</h1>
        </div>

        <div className="flex justify-center">
          <span className={`${colorEstado()} text-white px-6 py-2 rounded-full text-lg font-bold shadow-md`}>
            {registro.estado_clinica || "Pendiente"}
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">Datos del Responsable</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <p><b>Nombre:</b> {registro.nombre_responsable}</p>
            <p><b>Teléfono:</b> {registro.telefono}</p>
            <p><b>CI:</b> {registro.ci}</p>
            <p><b>Zona:</b> {registro.zona}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
  <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
    Datos del Animal
  </h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">

    <p><b>Nombre:</b> {registro.nombre_animal}</p>
    <p><b>Especie:</b> {registro.especie}</p>
    <p><b>Sexo:</b> {registro.sexo}</p>
    <p><b>Edad:</b> {registro.edad}</p>
    <p><b>Peso:</b> {registro.peso}</p>
    <p><b>Tipo:</b> {registro.tipo_animal}</p>

    {/* NUEVOS CAMPOS */}
    <p>
      <b>Tamaño:</b>{" "}
      {registro.tamano || "No registrado"}
    </p>

    <p>
      <b>Vacunado:</b>{" "}
      {registro.vacunado ? "Sí" : "No"}
    </p>

    <p>
      <b>Desparasitado:</b>{" "}
      {registro.desparasitado ? "Sí" : "No"}
    </p>
  </div>

  {/* =========================
      ALERTAS MÉDICAS
  ========================= */}

  {(registro.requiere_valoracion_prequirurgica ||
    registro.peso_bajo ||
    registro.menor_4_meses) && (

    <div className="mt-5 space-y-3">

      {/* ⚠️ VALORACIÓN */}
      {registro.requiere_valoracion_prequirurgica && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">⚠️ Requiere valoración</p>
          <p>
            Paciente con condición que requiere evaluación prequirúrgica.
          </p>
        </div>
      )}

      {/* ⛔ PESO BAJO */}
      {registro.peso_bajo && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">⛔ Peso bajo</p>
          <p>
            Paciente con peso menor a 700 g. Evaluar antes de proceder.
          </p>
        </div>
      )}

      {/* ⛔ MENOR DE EDAD */}
      {registro.menor_4_meses && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">⛔ No apto por edad</p>
          <p>
            Paciente menor de 4 meses. No puede ser intervenido.
          </p>
        </div>
      )}

    </div>
  )}
</div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">Datos de la Cirugía</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 text-lg">
            <p><b>Fecha:</b> {registro.fecha_programada || "No asignada"}</p>
            <p><b>Hora asignada:</b> {registro.hora || "No asignada"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-6 text-center">Fotos del Registro</h2>

          <div className="flex justify-center gap-6 flex-wrap">
            {registro.foto_frente && (
              <img
                src={registro.foto_frente}
                onClick={() => setFotoModal(registro.foto_frente)}
                className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
                alt="Foto frente"
              />
            )}

            {registro.foto_lado && (
              <img
                src={registro.foto_lado}
                onClick={() => setFotoModal(registro.foto_lado)}
                className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
                alt="Foto lado"
              />
            )}

            {registro.foto_carnet && (
              <img
                src={registro.foto_carnet}
                onClick={() => setFotoModal(registro.foto_carnet)}
                className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
                alt="Foto carnet"
              />
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4 pt-4 flex-wrap">
          <button
            onClick={marcarApto}
            disabled={finalizado || procesando}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-md transition ${
              finalizado || procesando
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {procesando ? "Procesando..." : "APTO"}
          </button>

          <button
            onClick={marcarNoApto}
            disabled={finalizado || procesando}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-md transition ${
              finalizado || procesando
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {procesando ? "Procesando..." : "NO APTO"}
          </button>

          <button
            onClick={abrirModalReprogramar}
            disabled={finalizado || procesando}
            className={`px-8 py-4 rounded-xl font-bold text-lg shadow-md transition ${
              finalizado || procesando
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {procesando ? "Procesando..." : "REPROGRAMAR"}
          </button>
        </div>
      </div>

      {fotoModal && (
        <div
          onClick={() => setFotoModal(null)}
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
        >
          <img
            src={fotoModal}
            className="max-h-[90%] max-w-[90%] rounded-xl shadow-2xl"
            alt="Foto ampliada"
          />
        </div>
      )}

      {modalReprogramar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-[#0F6D6A]">
                Reprogramar cirugía
              </h2>

              <button
                onClick={() => setModalReprogramar(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nueva fecha
                </label>
                <input
                  type="date"
                  min={fechaMinima}
                  value={fechaReprogramada}
                  onChange={(e) => setFechaReprogramada(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Horario disponible
                </label>
                <select
                  value={horarioSeleccionado}
                  onChange={(e) => setHorarioSeleccionado(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                  disabled={!fechaReprogramada || cargandoHorarios}
                >
                  <option value="">
                    {cargandoHorarios ? "Cargando horarios..." : "Seleccione un horario"}
                  </option>
                  {horariosDisponibles.map((h) => (
                    <option key={h.horario_id} value={h.horario_id}>
                      {h.hora} — {h.disponibles} cupo(s)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo de la reprogramación
              </label>
              <textarea
                value={motivoReprogramacion}
                onChange={(e) => setMotivoReprogramacion(e.target.value)}
                placeholder="Explique el motivo..."
                className="w-full border rounded-xl px-4 py-3 min-h-[110px]"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p><b>Paciente:</b> {registro?.nombre_animal || "-"}</p>
              <p><b>Fecha actual:</b> {registro?.fecha_programada || "-"}</p>
              <p><b>Hora actual:</b> {registro?.hora || "-"}</p>
            </div>

            <div className="flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => setModalReprogramar(false)}
                className="bg-gray-200 text-gray-800 px-5 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarReprogramacion}
                disabled={procesando}
                className="bg-[#F47C2A] text-white px-5 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {procesando ? "Guardando..." : "Confirmar reprogramación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}