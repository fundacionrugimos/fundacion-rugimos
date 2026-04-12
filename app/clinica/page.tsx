"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Html5Qrcode } from "html5-qrcode"

type CitaHoy = {
  id: string
  codigo: string
  nombre_animal: string
  especie: string | null
  sexo: string | null
  hora: string | null
  estado_clinica: string | null
  fecha_programada: string | null
  fecha_cirugia_realizada?: string | null
  clinica_id?: string | null
}

type RegistroMes = {
  id: string
  especie: string | null
  sexo: string | null
  estado_clinica: string | null
  fecha_programada: string | null
  fecha_cirugia_realizada?: string | null
  nombre_animal?: string | null
  hora?: string | null
  codigo?: string | null
  clinica_id?: string | null
}

type ResumenMesState = {
  rechazados: number
  aptos: number
  noShow: number
  completadas: number
}

type ResumenHistorico = {
  perro_macho: number
  perra_hembra: number
  gato_macho: number
  gata_hembra: number
  total: number
}

export default function ClinicaPage() {
  const router = useRouter()

  const [codigo, setCodigo] = useState("")
  const [escaneando, setEscaneando] = useState(false)
  const [mostrarBannerPedido, setMostrarBannerPedido] = useState(false)

  const [resumenHistorico, setResumenHistorico] = useState<{
    semanal: ResumenHistorico
    mensual: ResumenHistorico
  }>({
    semanal: {
      perro_macho: 0,
      perra_hembra: 0,
      gato_macho: 0,
      gata_hembra: 0,
      total: 0,
    },
    mensual: {
      perro_macho: 0,
      perra_hembra: 0,
      gato_macho: 0,
      gata_hembra: 0,
      total: 0,
    },
  })

  const [resumenMes, setResumenMes] = useState<ResumenMesState>({
    rechazados: 0,
    aptos: 0,
    noShow: 0,
    completadas: 0,
  })

  const [historialMes, setHistorialMes] = useState<RegistroMes[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const [fechaSeleccionada, setFechaSeleccionada] = useState("")
  const [citasHoy, setCitasHoy] = useState<CitaHoy[]>([])
  const [loadingCitas, setLoadingCitas] = useState(true)
  const [horariosAbiertos, setHorariosAbiertos] = useState<Record<string, boolean>>({})
  const [menuAbierto, setMenuAbierto] = useState(false)

  function getLocalDateString(baseDate?: Date) {
    const now = baseDate || new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)
    return local.toISOString().split("T")[0]
  }

  function parseDateLocal(fecha: string) {
    const [y, m, d] = fecha.split("-").map(Number)
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0)
  }

  function getTomorrowDateString() {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    return getLocalDateString(now)
  }

  function getInicioSemanaFrom(fecha: string) {
    const d = parseDateLocal(fecha)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return getLocalDateString(d)
  }

  function getFinSemanaFrom(fecha: string) {
    const inicio = parseDateLocal(getInicioSemanaFrom(fecha))
    inicio.setDate(inicio.getDate() + 6)
    return getLocalDateString(inicio)
  }

  function getInicioMesFrom(fecha: string) {
    const d = parseDateLocal(fecha)
    d.setDate(1)
    return getLocalDateString(d)
  }

  function fechaSolo(valor?: string | null) {
    return valor ? valor.slice(0, 10) : ""
  }

  function normalizarTexto(valor: string | null | undefined) {
    return (valor || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
  }

  function normalizarEstado(estado: string | null | undefined) {
    const valor = normalizarTexto(estado)
    return valor || "PENDIENTE"
  }

  function esApto(estado: string | null | undefined) {
    return normalizarEstado(estado) === "APTO"
  }

  function esNoShow(estado: string | null | undefined) {
    return normalizarEstado(estado) === "NO SHOW"
  }

  function esRechazado(estado: string | null | undefined) {
    const e = normalizarEstado(estado)
    return e === "RECHAZADO" || e === "NO APTO"
  }

  function esCompletaMes(estado: string | null | undefined) {
    const e = normalizarEstado(estado)
    return (
      e === "APTO" ||
      e === "NO APTO" ||
      e === "REPROGRAMADO" ||
      e === "NO SHOW" ||
      e === "RECHAZADO" ||
      e === "FALLECIO" ||
      e === "FALLECIDO"
    )
  }

  function formatFechaBonita(fecha: string) {
    if (!fecha) return ""
    const [year, month, day] = fecha.split("-")
    if (!year || !month || !day) return fecha
    return `${day}/${month}/${year}`
  }

  function tituloCitas() {
    const hoy = getLocalDateString()
    const manana = getTomorrowDateString()

    if (fechaSeleccionada === hoy) return "🗓️ Citas de hoy"
    if (fechaSeleccionada === manana) return "🗓️ Citas de mañana"
    return `🗓️ Citas del ${formatFechaBonita(fechaSeleccionada)}`
  }

  function tituloResumenRapido() {
    const hoy = getLocalDateString()
    const manana = getTomorrowDateString()

    if (fechaSeleccionada === hoy) return "Resumen rápido de hoy"
    if (fechaSeleccionada === manana) return "Resumen rápido de mañana"
    return `Resumen rápido del ${formatFechaBonita(fechaSeleccionada)}`
  }

  useEffect(() => {
    setFechaSeleccionada(getLocalDateString())

    const diaSemana = new Date().getDay()
    setMostrarBannerPedido(diaSemana === 3 || diaSemana === 6)
  }, [])

  useEffect(() => {
    const clinica = localStorage.getItem("clinica_id")
    const loginTime = localStorage.getItem("clinica_login_time")

    if (!clinica || !loginTime) {
      router.push("/clinica/login")
      return
    }

    const agora = Date.now()
    const cincoMin = 5 * 60 * 1000

    if (agora - Number(loginTime) > cincoMin) {
      localStorage.removeItem("clinica_id")
      localStorage.removeItem("clinica_zona")
      localStorage.removeItem("clinica_login_time")
      router.push("/clinica/login")
    }
  }, [router])

  useEffect(() => {
    let scanner: Html5Qrcode | null = null

    async function iniciarScanner() {
      scanner = new Html5Qrcode("reader")

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decodedText: string) => {
            const codigoQR = decodedText.split("/").pop()
            if (codigoQR) {
              router.push("/clinica/" + codigoQR)
            }
          },
          () => {}
        )
      } catch (err) {
        console.log(err)
      }
    }

    if (escaneando) {
      iniciarScanner()
    }

    return () => {
      if (scanner) {
        scanner.stop().catch(() => {})
      }
    }
  }, [escaneando, router])

  function buscar() {
    if (!codigo) {
      alert("Ingrese un código")
      return
    }

    const codigoLimpo = codigo.toUpperCase().trim()
    router.push("/clinica/" + codigoLimpo)
  }

  function handleKey(e: any) {
    if (e.key === "Enter") buscar()
  }

  function logout() {
    localStorage.removeItem("clinica_id")
    localStorage.removeItem("clinica_zona")
    localStorage.removeItem("clinica_login_time")
    router.push("/clinica/login")
  }

  async function cargarResumen() {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id || !fechaSeleccionada) return

    const inicioSemana = getInicioSemanaFrom(fechaSeleccionada)
    const finSemana = getFinSemanaFrom(fechaSeleccionada)
    const inicioMes = getInicioMesFrom(fechaSeleccionada)
    const fechaBase = fechaSeleccionada

    const { data, error } = await supabase
      .from("registros")
      .select("especie, sexo, estado_clinica, fecha_cirugia_realizada, clinica_id")
      .eq("clinica_id", clinica_id)

    if (error) {
      console.log(error)
      return
    }

    const semanal: ResumenHistorico = {
      perro_macho: 0,
      perra_hembra: 0,
      gato_macho: 0,
      gata_hembra: 0,
      total: 0,
    }

    const mensual: ResumenHistorico = {
      perro_macho: 0,
      perra_hembra: 0,
      gato_macho: 0,
      gata_hembra: 0,
      total: 0,
    }

    ;(data || []).forEach((r: any) => {
      const estado = normalizarEstado(r.estado_clinica)
      const fechaCirugia = fechaSolo(r.fecha_cirugia_realizada)
      const especie = normalizarTexto(r.especie)
      const sexo = normalizarTexto(r.sexo)

      if (estado !== "APTO") return
      if (!fechaCirugia) return

      const sumar = (destino: ResumenHistorico) => {
        if (especie === "PERRO" && sexo === "MACHO") destino.perro_macho++
        if (especie === "PERRO" && sexo === "HEMBRA") destino.perra_hembra++
        if (especie === "GATO" && sexo === "MACHO") destino.gato_macho++
        if (especie === "GATO" && sexo === "HEMBRA") destino.gata_hembra++
        destino.total++
      }

      if (fechaCirugia >= inicioSemana && fechaCirugia <= finSemana) {
        sumar(semanal)
      }

      if (fechaCirugia >= inicioMes && fechaCirugia <= fechaBase) {
        sumar(mensual)
      }
    })

    setResumenHistorico({
      semanal,
      mensual,
    })
  }

  async function cargarResumenMes() {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id || !fechaSeleccionada) return

    const inicioMes = getInicioMesFrom(fechaSeleccionada)
    const fechaBase = fechaSeleccionada

    const { data, error } = await supabase
      .from("registros")
      .select("id, especie, sexo, estado_clinica, fecha_programada, fecha_cirugia_realizada, nombre_animal, hora, codigo, clinica_id")
      .eq("clinica_id", clinica_id)

    if (error) {
      console.log(error)
      return
    }

    const registrosMes = ((data || []) as RegistroMes[])
      .filter((r) => {
        const fechaCirugia = fechaSolo(r.fecha_cirugia_realizada)
        if (!fechaCirugia) return false
        if (fechaCirugia < inicioMes) return false
        if (fechaCirugia > fechaBase) return false
        return true
      })
      .sort((a, b) => {
        const fa = fechaSolo(a.fecha_cirugia_realizada || a.fecha_programada)
        const fb = fechaSolo(b.fecha_cirugia_realizada || b.fecha_programada)
        return fb.localeCompare(fa)
      })

    let rechazados = 0
    let aptos = 0
    let noShow = 0
    let completadas = 0

    registrosMes.forEach((r) => {
      const estado = r.estado_clinica

      if (esRechazado(estado)) rechazados++
      if (esApto(estado)) aptos++
      if (esNoShow(estado)) noShow++
      if (esCompletaMes(estado)) completadas++
    })

    setResumenMes({
      rechazados,
      aptos,
      noShow,
      completadas,
    })

    setHistorialMes(registrosMes)
  }

  async function cargarCitasPorFecha(fecha: string) {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id || !fecha) return

    setLoadingCitas(true)

    const { data, error } = await supabase
      .from("registros")
      .select("id, codigo, nombre_animal, especie, sexo, hora, estado_clinica, fecha_programada, fecha_cirugia_realizada, clinica_id")
      .eq("clinica_id", clinica_id)
      .eq("fecha_programada", fecha)
      .order("hora", { ascending: true })

    if (error) {
      console.log(error)
      setCitasHoy([])
      setLoadingCitas(false)
      return
    }

    setCitasHoy(data || [])
    setLoadingCitas(false)
  }

  async function abrirHistorial() {
    setMenuAbierto(true)
    setCargandoHistorial(true)
    await cargarResumenMes()
    setCargandoHistorial(false)
  }

  useEffect(() => {
    if (!fechaSeleccionada) return
    cargarResumen()
    cargarResumenMes()
    cargarCitasPorFecha(fechaSeleccionada)
  }, [fechaSeleccionada])

  useEffect(() => {
    function actualizarTodo() {
      if (!fechaSeleccionada) return
      cargarResumen()
      cargarResumenMes()
      cargarCitasPorFecha(fechaSeleccionada)
    }

    window.addEventListener("storage", actualizarTodo)
    return () => window.removeEventListener("storage", actualizarTodo)
  }, [fechaSeleccionada])

  const resumenCitas = useMemo(() => {
    let pendientes = 0
    let aptos = 0
    let noAptos = 0
    let reprogramados = 0

    let perroMacho = 0
    let perraHembra = 0
    let gatoMacho = 0
    let gataHembra = 0

    citasHoy.forEach((cita) => {
      const estado = normalizarEstado(cita.estado_clinica)
      const especie = normalizarTexto(cita.especie)
      const sexo = normalizarTexto(cita.sexo)

      if (estado === "PENDIENTE") pendientes++
      else if (estado === "APTO") aptos++
      else if (estado === "NO APTO" || estado === "RECHAZADO") noAptos++
      else if (estado === "REPROGRAMADO") reprogramados++

      if (estado === "APTO") {
        if (especie === "PERRO" && sexo === "MACHO") perroMacho++
        if (especie === "PERRO" && sexo === "HEMBRA") perraHembra++
        if (especie === "GATO" && sexo === "MACHO") gatoMacho++
        if (especie === "GATO" && sexo === "HEMBRA") gataHembra++
      }
    })

    return {
      total: citasHoy.length,
      pendientes,
      aptos,
      noAptos,
      reprogramados,
      perroMacho,
      perraHembra,
      gatoMacho,
      gataHembra,
    }
  }, [citasHoy])

  const citasPorHora = useMemo(() => {
    const grupos: Record<string, CitaHoy[]> = {}

    citasHoy.forEach((cita) => {
      const hora = cita.hora || "Sin hora"
      if (!grupos[hora]) grupos[hora] = []
      grupos[hora].push(cita)
    })

    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]))
  }, [citasHoy])

  useEffect(() => {
    const estadoInicial: Record<string, boolean> = {}
    citasPorHora.forEach(([hora], index) => {
      estadoInicial[hora] = index === 0
    })
    setHorariosAbiertos(estadoInicial)
  }, [citasPorHora])

  function toggleHorario(hora: string) {
    setHorariosAbiertos((prev) => ({
      ...prev,
      [hora]: !prev[hora],
    }))
  }

  function colorEstado(estado: string | null) {
    const e = normalizarEstado(estado)
    if (e === "APTO") return "bg-green-100 text-green-700 border border-green-200"
    if (e === "NO APTO" || e === "RECHAZADO") return "bg-red-100 text-red-700 border border-red-200"
    if (e === "REPROGRAMADO") return "bg-yellow-100 text-yellow-800 border border-yellow-200"
    if (e === "NO SHOW") return "bg-gray-200 text-gray-800 border border-gray-300"
    return "bg-gray-100 text-gray-700 border border-gray-200"
  }

  const resumenHistorial = useMemo(() => {
    let perro_macho = 0
    let perra_hembra = 0
    let gato_macho = 0
    let gata_hembra = 0

    historialMes.forEach((r) => {
      const estado = normalizarEstado(r.estado_clinica)
      const fechaCirugia = fechaSolo(r.fecha_cirugia_realizada)
      if (estado !== "APTO") return
      if (!fechaCirugia) return

      const especie = normalizarTexto(r.especie)
      const sexo = normalizarTexto(r.sexo)

      if (especie === "PERRO" && sexo === "MACHO") perro_macho++
      if (especie === "PERRO" && sexo === "HEMBRA") perra_hembra++
      if (especie === "GATO" && sexo === "MACHO") gato_macho++
      if (especie === "GATO" && sexo === "HEMBRA") gata_hembra++
    })

    const total = perro_macho + perra_hembra + gato_macho + gata_hembra

    return {
      perro_macho,
      perra_hembra,
      gato_macho,
      gata_hembra,
      total,
    }
  }, [historialMes])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f6d6a] to-[#0a5957] px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-12 h-12 md:w-14 md:h-14 object-contain" alt="Logo" />
            <div>
              <h1 className="text-white text-2xl md:text-3xl font-bold">Portal clínico</h1>
              <p className="text-white/80 text-xs md:text-sm">Gestión diaria de cirugías y pacientes</p>
            </div>
          </div>

          <button
            onClick={abrirHistorial}
            className="bg-white text-[#0f6d6a] px-4 py-2.5 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition"
          >
            ☰ Menú
          </button>
        </div>

        {mostrarBannerPedido && (
          <div className="rounded-3xl border border-[#FAD7BA] bg-gradient-to-r from-[#FFF4E8] to-[#FFF9F4] px-5 py-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-[#f47c2a] font-bold text-sm md:text-base">
                  🐾 Hoy es día de pedido de insumos
                </p>
                <p className="text-gray-600 text-xs md:text-sm mt-1">
                  Recuerde enviar el pedido de su clínica para mantener la programación organizada.
                </p>
              </div>

              <button
                onClick={() => router.push("/clinica/pedidos")}
                className="bg-[#f47c2a] text-white px-4 py-2.5 rounded-2xl font-bold shadow hover:opacity-90 transition text-sm w-fit"
              >
                Ir a pedidos
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.35fr_0.95fr] gap-5">
          <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-5">
            <div className="text-center mb-4">
              <h2 className="text-[#0f6d6a] text-lg md:text-xl font-bold">
                Ingreso de pacientes
              </h2>
              <p className="text-gray-500 text-xs md:text-sm mt-1">
                Escanee el QR o busque por código RG
              </p>
            </div>

            <div className="flex justify-center mb-4">
              {!escaneando ? (
                <button
                  onClick={() => setEscaneando(true)}
                  className="bg-[#f47c2a] text-white px-5 py-2.5 rounded-2xl font-bold shadow hover:opacity-90 transition text-sm"
                >
                  📷 Abrir cámara
                </button>
              ) : (
                <button
                  onClick={() => setEscaneando(false)}
                  className="bg-gray-100 text-[#0f6d6a] px-5 py-2.5 rounded-2xl font-bold shadow hover:bg-gray-200 transition text-sm"
                >
                  Cerrar cámara
                </button>
              )}
            </div>

            {escaneando && (
              <div className="mb-4 flex justify-center">
                <div id="reader" className="w-full max-w-[300px]" />
              </div>
            )}

            <div className="flex justify-center">
              <div className="flex w-full max-w-[520px] bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ingresar código RG"
                  className="flex-1 px-4 py-3 text-sm md:text-base text-gray-800 placeholder-gray-500 outline-none bg-transparent"
                />
                <button
                  onClick={buscar}
                  className="bg-[#f47c2a] text-white px-5 md:px-6 font-semibold hover:opacity-90 transition"
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-[#0f6d6a] text-lg md:text-xl font-bold">
                {tituloResumenRapido()}
              </h2>
              <span className="text-xs text-gray-500">
                {fechaSeleccionada ? formatFechaBonita(fechaSeleccionada) : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFF4E8] p-3 border border-[#FAD7BA]">
                <p className="text-[11px] text-gray-500">Total</p>
                <p className="text-2xl font-bold text-[#f47c2a]">{resumenCitas.total}</p>
              </div>

              <div className="rounded-2xl bg-green-50 p-3 border border-green-100">
                <p className="text-[11px] text-gray-500">Aptos</p>
                <p className="text-2xl font-bold text-green-700">{resumenCitas.aptos}</p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3 border border-gray-200">
                <p className="text-[11px] text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-gray-700">{resumenCitas.pendientes}</p>
              </div>

              <div className="rounded-2xl bg-red-50 p-3 border border-red-100">
                <p className="text-[11px] text-gray-500">No aptos / rechazados</p>
                <p className="text-2xl font-bold text-red-600">{resumenCitas.noAptos}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-5">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#0f6d6a]">
                  {tituloCitas()}
                </h2>
                <p className="text-gray-500 mt-1 text-xs md:text-sm">
                  Programación diaria de la clínica
                </p>
              </div>

              <div className="bg-[#f47c2a] text-white px-4 py-1.5 rounded-full font-semibold w-fit text-xs md:text-sm">
                Total: {resumenCitas.total}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFechaSeleccionada(getLocalDateString())}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
                    fechaSeleccionada === getLocalDateString()
                      ? "bg-[#0f6d6a] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Hoy
                </button>

                <button
                  onClick={() => setFechaSeleccionada(getTomorrowDateString())}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
                    fechaSeleccionada === getTomorrowDateString()
                      ? "bg-[#0f6d6a] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Mañana
                </button>
              </div>

              <div className="md:ml-auto">
                <label className="block text-xs text-gray-500 mb-1">
                  Seleccionar fecha
                </label>
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  className="border rounded-xl px-4 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#0f6d6a]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Pendientes</p>
              <p className="text-xl font-bold text-gray-700">{resumenCitas.pendientes}</p>
            </div>

            <div className="bg-green-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Aptos</p>
              <p className="text-xl font-bold text-green-600">{resumenCitas.aptos}</p>
            </div>

            <div className="bg-red-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">No aptos</p>
              <p className="text-xl font-bold text-red-600">{resumenCitas.noAptos}</p>
            </div>

            <div className="bg-yellow-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Reprogramados</p>
              <p className="text-xl font-bold text-yellow-600">{resumenCitas.reprogramados}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Perro macho</p>
              <p className="text-xl font-bold text-blue-700">{resumenCitas.perroMacho}</p>
            </div>

            <div className="bg-pink-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Perra hembra</p>
              <p className="text-xl font-bold text-pink-700">{resumenCitas.perraHembra}</p>
            </div>

            <div className="bg-cyan-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Gato macho</p>
              <p className="text-xl font-bold text-cyan-700">{resumenCitas.gatoMacho}</p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-3">
              <p className="text-[11px] text-gray-500">Gata hembra</p>
              <p className="text-xl font-bold text-purple-700">{resumenCitas.gataHembra}</p>
            </div>
          </div>

          {loadingCitas ? (
            <div className="text-center text-gray-500 py-8 text-sm">Cargando citas...</div>
          ) : citasPorHora.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No hay citas programadas para esta fecha.
            </div>
          ) : (
            <div className="space-y-3">
              {citasPorHora.map(([hora, items]) => {
                const abierto = !!horariosAbiertos[hora]

                return (
                  <div key={hora} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleHorario(hora)}
                      className="w-full bg-[#02686A] text-white px-4 py-3 font-bold text-sm flex items-center justify-between hover:opacity-95 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span>{abierto ? "▾" : "▸"}</span>
                        <span>Horario: {hora}</span>
                      </div>

                      <span className="text-[11px] bg-white/20 px-3 py-1 rounded-full">
                        {items.length} cita{items.length !== 1 ? "s" : ""}
                      </span>
                    </button>

                    {abierto && (
                      <div className="divide-y">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:bg-gray-50 transition"
                          >
                            <div>
                              <p className="font-bold text-[#0f6d6a] text-sm">
                                {item.nombre_animal || "Sin nombre"}
                              </p>
                              <p className="text-xs text-gray-600">
                                {item.especie || "-"} • {item.sexo || "-"}
                              </p>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorEstado(item.estado_clinica)}`}>
                              {item.estado_clinica || "Pendiente"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-3xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#0f6d6a]">Semana de la fecha seleccionada</h2>
              <span className="text-xs text-gray-500">
                {fechaSeleccionada ? formatFechaBonita(getInicioSemanaFrom(fechaSeleccionada)) : "-"} a {fechaSeleccionada ? formatFechaBonita(getFinSemanaFrom(fechaSeleccionada)) : "-"}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p>Perro macho: {resumenHistorico.semanal.perro_macho}</p>
              <p>Perra hembra: {resumenHistorico.semanal.perra_hembra}</p>
              <p>Gato macho: {resumenHistorico.semanal.gato_macho}</p>
              <p>Gata hembra: {resumenHistorico.semanal.gata_hembra}</p>
            </div>

            <div className="mt-4 text-center font-bold text-2xl text-[#f47c2a]">
              {resumenHistorico.semanal.total}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#0f6d6a]">Mes de la fecha seleccionada</h2>
              <span className="text-xs text-gray-500">
                {fechaSeleccionada ? formatFechaBonita(getInicioMesFrom(fechaSeleccionada)) : "-"} a {fechaSeleccionada ? formatFechaBonita(fechaSeleccionada) : "-"}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p>Perro macho: {resumenHistorico.mensual.perro_macho}</p>
              <p>Perra hembra: {resumenHistorico.mensual.perra_hembra}</p>
              <p>Gato macho: {resumenHistorico.mensual.gato_macho}</p>
              <p>Gata hembra: {resumenHistorico.mensual.gata_hembra}</p>
            </div>

            <div className="mt-4 text-center font-bold text-2xl text-[#f47c2a]">
              {resumenHistorico.mensual.total}
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            onClick={logout}
            className="text-white underline hover:opacity-80 text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#0f6d6a]">Menú clínico</h2>
                <p className="text-sm text-gray-500">
                  Historial y resumen clínico
                </p>
              </div>

              <button
                onClick={() => setMenuAbierto(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-semibold"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">Perro macho</p>
                <p className="text-2xl font-bold text-blue-700">{resumenHistorial.perro_macho}</p>
              </div>

              <div className="bg-pink-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">Perra hembra</p>
                <p className="text-2xl font-bold text-pink-700">{resumenHistorial.perra_hembra}</p>
              </div>

              <div className="bg-cyan-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">Gato macho</p>
                <p className="text-2xl font-bold text-cyan-700">{resumenHistorial.gato_macho}</p>
              </div>

              <div className="bg-purple-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">Gata hembra</p>
                <p className="text-2xl font-bold text-purple-700">{resumenHistorial.gata_hembra}</p>
              </div>

              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500">Total aptos</p>
                <p className="text-2xl font-bold text-green-700">{resumenHistorial.total}</p>
              </div>
            </div>

            <div className="mb-5 rounded-3xl border border-[#FAD7BA] bg-gradient-to-r from-[#FFF4E8] to-[#FFF9F4] p-5 shadow-sm">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
      <h3 className="text-lg font-bold text-[#0f6d6a] mb-1">
        Pedidos de productos
      </h3>
      <p className="text-sm text-gray-600 leading-6">
        Solicite insumos para su clínica de forma rápida y organizada.
        Puede seleccionar productos, cantidades y enviar el pedido al área administrativa.
      </p>
    </div>

    <button
      onClick={() => router.push("/clinica/pedidos")}
      className="shrink-0 bg-[#f47c2a] text-white px-5 py-3 rounded-2xl font-bold shadow-lg hover:opacity-90 hover:scale-[1.02] transition text-sm md:text-base"
    >
      🛒 Ir a pedidos
    </button>
  </div>
</div>
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-bold text-[#0f6d6a]">
                  Historial del mes
                </h3>
                <span className="text-xs text-gray-500">
                  {historialMes.length} registro(s)
                </span>
              </div>

              {cargandoHistorial ? (
                <div className="text-sm text-gray-500 py-6">Cargando historial...</div>
              ) : historialMes.length === 0 ? (
                <div className="text-sm text-gray-500 py-6">
                  No hay registros en este período.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {historialMes.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-[#0f6d6a] text-sm">
                          {item.nombre_animal || "Sin nombre"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.especie || "-"} • {item.sexo || "-"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.fecha_cirugia_realizada
                            ? formatFechaBonita(fechaSolo(item.fecha_cirugia_realizada))
                            : item.fecha_programada
                            ? formatFechaBonita(item.fecha_programada)
                            : "-"}{" "}
                          • {item.hora || "Sin hora"}
                        </p>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colorEstado(item.estado_clinica || null)}`}>
                        {item.estado_clinica || "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
