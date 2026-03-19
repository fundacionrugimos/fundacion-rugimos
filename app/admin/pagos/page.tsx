"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

type Clinica = {
  id: string
  nome: string
}

type Registro = {
  id: string
  clinica_id: string | null
  especie: string | null
  sexo: string | null
  pagado: boolean | null
  estado_clinica: string | null
  estado_cita?: string | null
  fecha_programada: string | null
  fecha_cirugia_realizada?: string | null
  nombre_animal?: string | null
  codigo?: string | null
}

type TarifaClinica = {
  id: string
  clinica_id: string
  especie: string
  sexo: string
  valor: number
  activo: boolean
}

type PagoClinica = {
  id: string
  clinica_id: string
  fecha_pago: string
  periodo_tipo: string
  fecha_inicio: string | null
  fecha_fin: string | null
  cantidad_animales: number
  monto_total: number
  observacion: string | null
  registrado_por: string | null
  created_at: string
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function inicioSemanaISO() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function inicioMesISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizarEstado(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

function esRegistroPagable(registro: Registro) {
  const estadoClinica = normalizarEstado(registro.estado_clinica)
  const estadoCita = normalizarEstado(registro.estado_cita)

  return (
    estadoClinica === "apto" ||
    estadoCita === "realizado" ||
    estadoCita === "atendido"
  )
}

function formatearMoneda(valor: number) {
  return `Bs ${toNumber(valor).toFixed(2)}`
}

function descargarCSV(nombreArchivo: string, filas: Record<string, any>[]) {
  if (!filas.length) {
    alert("No hay datos para exportar.")
    return
  }

  const headers = Object.keys(filas[0])

  const escapar = (valor: any) => {
    const texto = String(valor ?? "")
    if (texto.includes('"') || texto.includes(",") || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`
    }
    return texto
  }

  const contenido = [
    headers.join(","),
    ...filas.map((fila) => headers.map((h) => escapar(fila[h])).join(",")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", nombreArchivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function autoWidthFromRows(rows: Record<string, any>[]) {
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  return headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length)
    )
    return { wch: Math.min(Math.max(maxLength + 2, 12), 35) }
  })
}

export default function AdminPagosPage() {
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [tarifas, setTarifas] = useState<TarifaClinica[]>([])
  const [pagos, setPagos] = useState<PagoClinica[]>([])

  const [periodoTipo, setPeriodoTipo] = useState("semanal")
  const [fechaInicio, setFechaInicio] = useState(inicioSemanaISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [observacionGlobal, setObservacionGlobal] = useState("")

  async function cargarDatos() {
    setCargando(true)

    const [clinicasRes, registrosRes, tarifasRes, pagosRes] = await Promise.all([
      supabase
        .from("clinicas")
        .select("id,nome")
        .order("nome", { ascending: true }),

      supabase
        .from("registros")
        .select(
          "id,clinica_id,especie,sexo,pagado,estado_clinica,estado_cita,fecha_programada,fecha_cirugia_realizada,nombre_animal,codigo"
        ),

      supabase
        .from("tarifas_clinica")
        .select("id,clinica_id,especie,sexo,valor,activo")
        .eq("activo", true),

      supabase
        .from("pagos_clinica")
        .select(
          "id,clinica_id,fecha_pago,periodo_tipo,fecha_inicio,fecha_fin,cantidad_animales,monto_total,observacion,registrado_por,created_at"
        )
        .order("fecha_pago", { ascending: false }),
    ])

    if (clinicasRes.data) setClinicas(clinicasRes.data as Clinica[])
    if (registrosRes.data) setRegistros(registrosRes.data as Registro[])
    if (tarifasRes.data) {
      setTarifas(
        (tarifasRes.data as any[]).map((t) => ({
          ...t,
          valor: toNumber(t.valor),
        }))
      )
    }
    if (pagosRes.data) {
      setPagos(
        (pagosRes.data as any[]).map((p) => ({
          ...p,
          monto_total: toNumber(p.monto_total),
        }))
      )
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (periodoTipo === "diario") {
      setFechaInicio(hoyISO())
      setFechaFin(hoyISO())
    }
    if (periodoTipo === "semanal") {
      setFechaInicio(inicioSemanaISO())
      setFechaFin(hoyISO())
    }
    if (periodoTipo === "mensual") {
      setFechaInicio(inicioMesISO())
      setFechaFin(hoyISO())
    }
  }, [periodoTipo])

  const mapaTarifas = useMemo(() => {
    const mapa: Record<string, number> = {}

    tarifas.forEach((t) => {
      const key = `${t.clinica_id}__${(t.especie || "").trim().toLowerCase()}__${(t.sexo || "").trim().toLowerCase()}`
      mapa[key] = toNumber(t.valor)
    })

    return mapa
  }, [tarifas])

  const registrosPendientes = useMemo(() => {
    return registros.filter((r) => {
      if (!r.clinica_id) return false
      if (!esRegistroPagable(r)) return false
      if (r.pagado === true) return false
      if (!r.fecha_cirugia_realizada) return false
      if (fechaInicio && r.fecha_cirugia_realizada.slice(0, 10) < fechaInicio) return false
      if (fechaFin && r.fecha_cirugia_realizada.slice(0, 10) > fechaFin) return false
      if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false
      return true
    })
  }, [registros, fechaInicio, fechaFin, clinicaFiltro])

  const resumenPorClinica = useMemo(() => {
    const mapa: Record<
      string,
      {
        clinica_id: string
        clinica: string
        perro_macho: number
        perra_hembra: number
        gato_macho: number
        gata_hembra: number
        total_animales: number
        total_pagar: number
        registros: Registro[]
        ultimo_pago: string | null
      }
    > = {}

    clinicas.forEach((c) => {
      mapa[c.id] = {
        clinica_id: c.id,
        clinica: c.nome,
        perro_macho: 0,
        perra_hembra: 0,
        gato_macho: 0,
        gata_hembra: 0,
        total_animales: 0,
        total_pagar: 0,
        registros: [],
        ultimo_pago: null,
      }
    })

    registrosPendientes.forEach((r) => {
      if (!r.clinica_id || !mapa[r.clinica_id]) return

      const especie = (r.especie || "").trim().toLowerCase()
      const sexo = (r.sexo || "").trim().toLowerCase()

      if (especie === "perro" && sexo === "macho") mapa[r.clinica_id].perro_macho += 1
      if (especie === "perro" && sexo === "hembra") mapa[r.clinica_id].perra_hembra += 1
      if (especie === "gato" && sexo === "macho") mapa[r.clinica_id].gato_macho += 1
      if (especie === "gato" && sexo === "hembra") mapa[r.clinica_id].gata_hembra += 1

      const key = `${r.clinica_id}__${especie}__${sexo}`
      const valor = mapaTarifas[key] || 0

      mapa[r.clinica_id].total_animales += 1
      mapa[r.clinica_id].total_pagar += valor
      mapa[r.clinica_id].registros.push(r)
    })

    pagos.forEach((p) => {
      if (mapa[p.clinica_id]) {
        if (!mapa[p.clinica_id].ultimo_pago || p.fecha_pago > mapa[p.clinica_id].ultimo_pago!) {
          mapa[p.clinica_id].ultimo_pago = p.fecha_pago
        }
      }
    })

    return Object.values(mapa)
      .filter((c) => c.total_animales > 0 || (!clinicaFiltro || c.clinica_id === clinicaFiltro))
      .sort((a, b) => b.total_pagar - a.total_pagar)
  }, [clinicas, registrosPendientes, mapaTarifas, pagos, clinicaFiltro])

  const resumenGeneral = useMemo(() => {
    return resumenPorClinica.reduce(
      (acc, c) => {
        acc.total_animales += c.total_animales
        acc.total_pagar += c.total_pagar
        acc.perro_macho += c.perro_macho
        acc.perra_hembra += c.perra_hembra
        acc.gato_macho += c.gato_macho
        acc.gata_hembra += c.gata_hembra
        return acc
      },
      {
        total_animales: 0,
        total_pagar: 0,
        perro_macho: 0,
        perra_hembra: 0,
        gato_macho: 0,
        gata_hembra: 0,
      }
    )
  }, [resumenPorClinica])

  async function pagarClinica(clinicaId: string) {
    const info = resumenPorClinica.find((c) => c.clinica_id === clinicaId)
    if (!info || !info.registros.length) return

    const sugerido = String(info.total_pagar.toFixed(2))
    const valorInput = prompt(
      `Total calculado para ${info.clinica}: ${formatearMoneda(info.total_pagar)}\n\n¿Cuánto se pagará ahora?`,
      sugerido
    )

    if (valorInput === null) return

    const montoPagadoAhora = toNumber(valorInput)

    if (montoPagadoAhora <= 0) {
      alert("Debe ingresar un monto mayor que cero.")
      return
    }

    if (montoPagadoAhora > info.total_pagar) {
      alert("El monto parcial no puede ser mayor al total calculado.")
      return
    }

    const confirmar = confirm(
      `Confirmar pago a ${info.clinica}.\n\nTotal calculado: ${formatearMoneda(info.total_pagar)}\nPago ahora: ${formatearMoneda(montoPagadoAhora)}`
    )
    if (!confirmar) return

    setProcesando(true)

    const { data: pagoCreado, error: pagoError } = await supabase
      .from("pagos_clinica")
      .insert({
        clinica_id: clinicaId,
        fecha_pago: new Date().toISOString(),
        periodo_tipo: periodoTipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cantidad_animales: info.total_animales,
        monto_total: montoPagadoAhora,
        observacion:
          observacionGlobal ||
          (montoPagadoAgoraEhParcial(montoPagadoAhora, info.total_pagar)
            ? `Pago parcial. Total calculado: ${formatearMoneda(info.total_pagar)}`
            : null),
        registrado_por: "admin",
      })
      .select()
      .single()

    if (pagoError || !pagoCreado) {
      console.log("Error pagos_clinica:", pagoError)
      alert("No se pudo registrar el pago.")
      setProcesando(false)
      return
    }

    const detalles = info.registros.map((r) => {
      const especie = (r.especie || "").trim().toLowerCase()
      const sexo = (r.sexo || "").trim().toLowerCase()
      const key = `${clinicaId}__${especie}__${sexo}`
      const valor = mapaTarifas[key] || 0

      return {
        pago_id: pagoCreado.id,
        registro_id: r.id,
        monto_unitario: valor,
        monto_total: valor,
      }
    })

    const { error: detalleError } = await supabase
      .from("pagos_clinica_detalle")
      .insert(detalles)

    if (detalleError) {
      console.log("Error pagos_clinica_detalle:", detalleError)
      alert("No se pudo registrar el detalle del pago.")
      setProcesando(false)
      return
    }

    const ids = info.registros.map((r) => r.id)

    const pagoCompleto = Math.abs(montoPagadoAhora - info.total_pagar) < 0.001

    if (pagoCompleto) {
      const { error: updateError } = await supabase
        .from("registros")
        .update({
          pagado: true,
          fecha_pago: new Date().toISOString(),
        })
        .in("id", ids)

      if (updateError) {
        console.log("Error actualizando registros:", updateError)
        alert("El pago fue creado, pero no se pudieron actualizar los registros.")
        setProcesando(false)
        return
      }
    }

    await cargarDatos()
    setProcesando(false)

    if (pagoCompleto) {
      alert("Pago completo registrado correctamente")
    } else {
      alert("Pago parcial registrado correctamente. Los registros seguirán pendientes hasta completar el pago.")
    }
  }

  function montoPagadoAgoraEhParcial(montoPagado: number, montoTotal: number) {
    return Math.abs(montoPagado - montoTotal) >= 0.001
  }

  function exportarPendientesCSV() {
    const filas = registrosPendientes.map((r) => {
      const especie = (r.especie || "").trim().toLowerCase()
      const sexo = (r.sexo || "").trim().toLowerCase()
      const key = `${r.clinica_id}__${especie}__${sexo}`
      const valor = mapaTarifas[key] || 0
      const clinica = clinicas.find((c) => c.id === r.clinica_id)?.nome || "Sin clínica"

      return {
        "Fecha cirugía real": r.fecha_cirugia_realizada ? r.fecha_cirugia_realizada.slice(0, 10) : "",
        "Fecha programada": r.fecha_programada || "",
        "Clínica": clinica,
        "Código": r.codigo || "",
        "Animal": r.nombre_animal || "",
        "Especie": r.especie || "",
        "Sexo": r.sexo || "",
        "Estado clínica": r.estado_clinica || "",
        "Estado cita": r.estado_cita || "",
        "Valor": valor.toFixed(2),
      }
    })

    descargarCSV("pagos_pendientes_clinicas_detalle.csv", filas)
  }

  function exportarPendientesExcel() {
    if (!registrosPendientes.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()

    const hojaResumen = [
      { Indicador: "Tipo de período", Valor: periodoTipo },
      { Indicador: "Fecha inicial", Valor: fechaInicio },
      { Indicador: "Fecha final", Valor: fechaFin },
      {
        Indicador: "Clínica filtro",
        Valor: clinicaFiltro
          ? clinicas.find((c) => c.id === clinicaFiltro)?.nome || clinicaFiltro
          : "Todas las clínicas",
      },
      { Indicador: "Perro macho", Valor: resumenGeneral.perro_macho },
      { Indicador: "Perra hembra", Valor: resumenGeneral.perra_hembra },
      { Indicador: "Gato macho", Valor: resumenGeneral.gato_macho },
      { Indicador: "Gata hembra", Valor: resumenGeneral.gata_hembra },
      { Indicador: "Total animales", Valor: resumenGeneral.total_animales },
      { Indicador: "Total a pagar", Valor: resumenGeneral.total_pagar.toFixed(2) },
      { Indicador: "Observación", Valor: observacionGlobal || "" },
    ]

    const hojaClinicas = resumenPorClinica.map((c) => ({
      "Clínica": c.clinica,
      "Perro macho": c.perro_macho,
      "Perra hembra": c.perra_hembra,
      "Gato macho": c.gato_macho,
      "Gata hembra": c.gata_hembra,
      "Total animales": c.total_animales,
      "Total pagar": c.total_pagar.toFixed(2),
      "Último pago": c.ultimo_pago ? c.ultimo_pago.slice(0, 10) : "",
    }))

    const hojaDetalle = registrosPendientes.map((r) => {
      const especie = (r.especie || "").trim().toLowerCase()
      const sexo = (r.sexo || "").trim().toLowerCase()
      const key = `${r.clinica_id}__${especie}__${sexo}`
      const valor = mapaTarifas[key] || 0
      const clinica = clinicas.find((c) => c.id === r.clinica_id)?.nome || "Sin clínica"

      return {
        "Fecha cirugía real": r.fecha_cirugia_realizada ? r.fecha_cirugia_realizada.slice(0, 10) : "",
        "Fecha programada": r.fecha_programada || "",
        "Clínica": clinica,
        "Código": r.codigo || "",
        "Animal": r.nombre_animal || "",
        "Especie": r.especie || "",
        "Sexo": r.sexo || "",
        "Estado clínica": r.estado_clinica || "",
        "Estado cita": r.estado_cita || "",
        "Pagado": r.pagado ? "Sí" : "No",
        "Valor": valor.toFixed(2),
      }
    })

    const wsResumen = XLSX.utils.json_to_sheet(hojaResumen)
    const wsClinicas = XLSX.utils.json_to_sheet(hojaClinicas)
    const wsDetalle = XLSX.utils.json_to_sheet(hojaDetalle)

    wsResumen["!cols"] = autoWidthFromRows(hojaResumen)
    wsClinicas["!cols"] = autoWidthFromRows(hojaClinicas)
    wsDetalle["!cols"] = autoWidthFromRows(hojaDetalle)

    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen")
    XLSX.utils.book_append_sheet(wb, wsClinicas, "Por clínica")
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle")

    XLSX.writeFile(
      wb,
      `pagos_clinicas_${fechaInicio}_a_${fechaFin}.xlsx`
    )
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando pagos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Pagos a Clínicas
            </h1>
            <p className="text-white/80">
              Gestión operativa de pagos por mano de obra de esterilizaciones
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={cargarDatos}
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Actualizar
            </button>

            <button
              onClick={exportarPendientesExcel}
              className="bg-[#F47C2A] text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90 transition"
            >
              Exportar Excel
            </button>

            <button
              onClick={exportarPendientesCSV}
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Exportar CSV
            </button>

            <Link
              href="/admin"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de período
              </label>
              <select
                value={periodoTipo}
                onChange={(e) => setPeriodoTipo(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha inicial
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha final
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Clínica
              </label>
              <select
                value={clinicaFiltro}
                onChange={(e) => setClinicaFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas las clínicas</option>
                {clinicas.map((clinica) => (
                  <option key={clinica.id} value={clinica.id}>
                    {clinica.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observación del pago
              </label>
              <input
                type="text"
                value={observacionGlobal}
                onChange={(e) => setObservacionGlobal(e.target.value)}
                placeholder="Ej: pago semana 2"
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Perro macho</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenGeneral.perro_macho}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Perra hembra</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenGeneral.perra_hembra}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Gato macho</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenGeneral.gato_macho}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Gata hembra</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenGeneral.gata_hembra}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Total a pagar</p>
            <p className="text-3xl font-bold text-[#F47C2A] mt-2">
              {formatearMoneda(resumenGeneral.total_pagar)}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {resumenPorClinica.map((clinica) => (
            <div
              key={clinica.clinica_id}
              className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
            >
              <div>
                <h2 className="text-2xl font-bold text-[#0F6D6A]">
                  {clinica.clinica}
                </h2>
                <p className="text-sm text-gray-500">
                  Último pago: {clinica.ultimo_pago ? clinica.ultimo_pago.slice(0, 10) : "Sin pagos"}
                </p>
              </div>

              <div className="space-y-2 text-gray-700">
                <p>🐶 Perro macho: {clinica.perro_macho}</p>
                <p>🐶 Perra hembra: {clinica.perra_hembra}</p>
                <p>🐱 Gato macho: {clinica.gato_macho}</p>
                <p>🐱 Gata hembra: {clinica.gata_hembra}</p>
              </div>

              <div className="border-t pt-3 space-y-1">
                <p className="text-gray-700 font-semibold">
                  Total animales: {clinica.total_animales}
                </p>
                <p className="text-lg font-bold text-[#F47C2A]">
                  Total pagar: {formatearMoneda(clinica.total_pagar)}
                </p>
              </div>

              <button
                onClick={() => pagarClinica(clinica.clinica_id)}
                disabled={procesando || clinica.total_animales === 0}
                className="w-full bg-[#F47C2A] text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                Marcar como PAGADO
              </button>
            </div>
          ))}

          {resumenPorClinica.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl shadow-xl p-10 text-center text-gray-500">
              No hay pagos pendientes para el período seleccionado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}