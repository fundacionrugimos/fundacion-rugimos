"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Html5Qrcode } from "html5-qrcode"

type CitaHoy = {
  id: string
  codigo: string
  nombre_animal: string
  especie: string
  sexo: string
  hora: string | null
  estado_clinica: string | null
  fecha_programada: string | null
}

type RegistroMes = {
  id: string
  especie: string | null
  sexo: string | null
  estado_clinica: string | null
  fecha_programada: string | null
}

export default function ClinicaPage() {
  const [codigo, setCodigo] = useState("")
  const [escaneando, setEscaneando] = useState(false)

  const [resumen, setResumen] = useState<any>({
    perro_macho: 0,
    perra_hembra: 0,
    gato_macho: 0,
    gata_hembra: 0,
  })

  const [resumenMes, setResumenMes] = useState({
    rechazados: 0,
    aptos: 0,
    noShow: 0,
    completadas: 0,
  })

  const [fechaSeleccionada, setFechaSeleccionada] = useState("")
  const [citasHoy, setCitasHoy] = useState<CitaHoy[]>([])
  const [loadingCitas, setLoadingCitas] = useState(true)
  const [horariosAbiertos, setHorariosAbiertos] = useState<Record<string, boolean>>({})

  const router = useRouter()

  function getLocalDateString(baseDate?: Date) {
    const now = baseDate || new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)
    return local.toISOString().split("T")[0]
  }

  function getTomorrowDateString() {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    return getLocalDateString(now)
  }

  function getInicioMesString() {
    const now = new Date()
    now.setDate(1)
    return getLocalDateString(now)
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

  function esApto(estado: string | null | undefined) {
    return normalizarEstado(estado) === "APTO"
  }

  function esNoApto(estado: string | null | undefined) {
    return normalizarEstado(estado) === "NO APTO"
  }

  function esReprogramado(estado: string | null | undefined) {
    return normalizarEstado(estado) === "REPROGRAMADO"
  }

  function esNoShow(estado: string | null | undefined) {
    return normalizarEstado(estado) === "NO SHOW"
  }

  function esRechazado(estado: string | null | undefined) {
    return normalizarEstado(estado) === "RECHAZADO"
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

  useEffect(() => {
    setFechaSeleccionada(getLocalDateString())
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
          {
            fps: 10,
            qrbox: 250,
          },
          (decodedText: string) => {
            const codigoQR = decodedText.split("/").pop()
            if (codigoQR) {
              router.push("/clinica/" + codigoQR)
            }
          },
          (_errorMessage: string) => {
            // ignorar erros de leitura contínua do scanner
          }
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
    if (e.key === "Enter") {
      buscar()
    }
  }

  function logout() {
    localStorage.removeItem("clinica_id")
    localStorage.removeItem("clinica_zona")
    localStorage.removeItem("clinica_login_time")
    router.push("/clinica/login")
  }

  async function cargarResumen() {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id) return

    const { data, error } = await supabase
      .from("registros")
      .select("especie,sexo")
      .eq("clinica_id", clinica_id)
      .eq("estado_clinica", "Apto")

    if (error) {
      console.log(error)
      return
    }

    let perro_macho = 0
    let perra_hembra = 0
    let gato_macho = 0
    let gata_hembra = 0

    data?.forEach((r: any) => {
      if (r.especie === "Perro" && r.sexo === "Macho") perro_macho++
      if (r.especie === "Perro" && r.sexo === "Hembra") perra_hembra++
      if (r.especie === "Gato" && r.sexo === "Macho") gato_macho++
      if (r.especie === "Gato" && r.sexo === "Hembra") gata_hembra++
    })

    setResumen({
      perro_macho,
      perra_hembra,
      gato_macho,
      gata_hembra,
    })
  }

  async function cargarResumenMes() {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id) return

    const inicioMes = getInicioMesString()
    const hoy = getLocalDateString()

    const { data, error } = await supabase
      .from("registros")
      .select("id,especie,sexo,estado_clinica,fecha_programada")
      .eq("clinica_id", clinica_id)
      .gte("fecha_programada", inicioMes)
      .lte("fecha_programada", hoy)

    if (error) {
      console.log(error)
      return
    }

    const registrosMes = (data || []) as RegistroMes[]

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
  }

  async function cargarCitasPorFecha(fecha: string) {
    const clinica_id = localStorage.getItem("clinica_id")
    if (!clinica_id || !fecha) return

    setLoadingCitas(true)

    const { data, error } = await supabase
      .from("registros")
      .select("id,codigo,nombre_animal,especie,sexo,hora,estado_clinica,fecha_programada")
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

  useEffect(() => {
    cargarResumen()
    cargarResumenMes()
  }, [])

  useEffect(() => {
    if (!fechaSeleccionada) return
    cargarCitasPorFecha(fechaSeleccionada)
  }, [fechaSeleccionada])

  useEffect(() => {
    function actualizarTodo() {
      cargarResumen()
      cargarResumenMes()
      if (fechaSeleccionada) {
        cargarCitasPorFecha(fechaSeleccionada)
      }
    }

    window.addEventListener("storage", actualizarTodo)

    return () => {
      window.removeEventListener("storage", actualizarTodo)
    }
  }, [fechaSeleccionada])

  const total =
    resumen.perro_macho +
    resumen.perra_hembra +
    resumen.gato_macho +
    resumen.gata_hembra

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

      if (estado === "PENDIENTE") pendientes++
      else if (estado === "APTO") aptos++
      else if (estado === "NO APTO") noAptos++
      else if (estado === "REPROGRAMADO") reprogramados++

      if (cita.especie === "Perro" && cita.sexo === "Macho") perroMacho++
      if (cita.especie === "Perro" && cita.sexo === "Hembra") perraHembra++
      if (cita.especie === "Gato" && cita.sexo === "Macho") gatoMacho++
      if (cita.especie === "Gato" && cita.sexo === "Hembra") gataHembra++
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

    if (e === "APTO") return "bg-green-100 text-green-700"
    if (e === "NO APTO") return "bg-red-100 text-red-700"
    if (e === "REPROGRAMADO") return "bg-yellow-100 text-yellow-800"
    if (e === "NO SHOW") return "bg-gray-200 text-gray-800"
    if (e === "RECHAZADO") return "bg-red-100 text-red-700"
    return "bg-gray-100 text-gray-700"
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#0f6d6a] px-6 py-10 space-y-10">
      <img src="/logo.png" className="w-40 md:w-48" />

      <h1 className="text-white text-3xl md:text-4xl font-bold text-center">
        Portal clínico
      </h1>

      <div className="w-full max-w-2xl flex flex-col items-center space-y-6">
        <h2 className="text-white text-3xl font-bold text-center">
          Escanear paciente
        </h2>

        {!escaneando && (
          <button
            onClick={() => setEscaneando(true)}
            className="bg-[#f47c2a] text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:scale-105 transition"
          >
            📷 Abrir cámara
          </button>
        )}

        {escaneando && (
          <button
            onClick={() => setEscaneando(false)}
            className="bg-white text-[#0f6d6a] px-6 py-3 rounded-xl text-sm font-bold shadow hover:scale-105 transition"
          >
            Cerrar cámara
          </button>
        )}

        <div id="reader" className="w-full max-w-md" />

        <div className="flex w-full bg-white rounded-full shadow-xl overflow-hidden">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ingresar código RG"
            className="flex-1 px-8 py-5 text-lg text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#0f6d6a]"
          />

          <button
            onClick={buscar}
            className="bg-[#f47c2a] text-white px-10 text-lg font-semibold hover:opacity-90 transition"
          >
            Buscar
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-5">
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-[#0f6d6a]">
                {tituloCitas()}
              </h2>
              <p className="text-gray-500 mt-1 text-sm">
                Programación diaria de la clínica
              </p>
            </div>

            <div className="bg-[#f47c2a] text-white px-4 py-2 rounded-full font-semibold w-fit text-sm">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Pendientes</p>
            <p className="text-xl font-bold text-gray-700">{resumenCitas.pendientes}</p>
          </div>

          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Aptos</p>
            <p className="text-xl font-bold text-green-600">{resumenCitas.aptos}</p>
          </div>

          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">No aptos</p>
            <p className="text-xl font-bold text-red-600">{resumenCitas.noAptos}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Reprogramados</p>
            <p className="text-xl font-bold text-yellow-600">{resumenCitas.reprogramados}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Perro macho</p>
            <p className="text-xl font-bold text-blue-700">{resumenCitas.perroMacho}</p>
          </div>

          <div className="bg-pink-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Perra hembra</p>
            <p className="text-xl font-bold text-pink-700">{resumenCitas.perraHembra}</p>
          </div>

          <div className="bg-cyan-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Gato macho</p>
            <p className="text-xl font-bold text-cyan-700">{resumenCitas.gatoMacho}</p>
          </div>

          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Gata hembra</p>
            <p className="text-xl font-bold text-purple-700">{resumenCitas.gataHembra}</p>
          </div>
        </div>

        {loadingCitas ? (
          <div className="text-center text-gray-500 py-5 text-sm">Cargando citas...</div>
        ) : citasPorHora.length === 0 ? (
          <div className="text-center text-gray-500 py-5 text-sm">
            No hay citas programadas para esta fecha.
          </div>
        ) : (
          <div className="space-y-4">
            {citasPorHora.map(([hora, items]) => {
              const abierto = !!horariosAbiertos[hora]

              return (
                <div key={hora} className="border rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleHorario(hora)}
                    className="w-full bg-[#02686A] text-white px-4 py-3 font-bold text-sm flex items-center justify-between hover:opacity-95 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span>{abierto ? "▾" : "▸"}</span>
                      <span>Horario: {hora}</span>
                    </div>

                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                      {items.length} cita{items.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {abierto && (
                    <div className="divide-y">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-[#0f6d6a] text-sm">
                              {item.nombre_animal || "Sin nombre"}
                            </p>
                            <p className="text-xs text-gray-600">
                              {item.especie || "-"} • {item.sexo || "-"}
                            </p>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${colorEstado(
                              item.estado_clinica
                            )}`}
                          >
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

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full">
          <h2 className="text-xl font-bold text-[#0f6d6a] mb-4 text-center">
            Resumen de cirugías
          </h2>

          <div className="space-y-2 text-gray-700">
            <p>Perro macho: {resumen.perro_macho}</p>
            <p>Perra hembra: {resumen.perra_hembra}</p>
            <p>Gato macho: {resumen.gato_macho}</p>
            <p>Gata hembra: {resumen.gata_hembra}</p>
          </div>

          <div className="mt-4 text-center font-bold text-lg text-[#f47c2a]">
            Total: {total}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 w-full">
          <h2 className="text-xl font-bold text-[#0f6d6a] mb-4 text-center">
            Resumen del mes
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Rechazados</p>
              <p className="text-xl font-bold text-red-600">{resumenMes.rechazados}</p>
            </div>

            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Aptos total</p>
              <p className="text-xl font-bold text-green-600">{resumenMes.aptos}</p>
            </div>

            <div className="bg-gray-100 rounded-xl p-3">
              <p className="text-xs text-gray-500">No Show</p>
              <p className="text-xl font-bold text-gray-700">{resumenMes.noShow}</p>
            </div>

            <div className="bg-[#FFF4E8] rounded-xl p-3">
              <p className="text-xs text-gray-500">Completadas del mes</p>
              <p className="text-xl font-bold text-[#f47c2a]">{resumenMes.completadas}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        className="text-white underline hover:opacity-80"
      >
        Cerrar sesión
      </button>
    </div>
  )
}