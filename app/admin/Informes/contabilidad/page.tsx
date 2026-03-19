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
  codigo?: string | null
  clinica_id: string | null
  especie: string | null
  sexo: string | null
  tipo_animal?: string | null
  nombre_animal?: string | null
  pagado: boolean | null
  fecha_pago?: string | null
  fecha_programada: string | null
  estado_clinica?: string | null
  estado_cita?: string | null
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

type PagoDetalle = {
  id: string
  pago_id: string
  registro_id: string
  monto_unitario: number
  monto_total: number
  created_at: string
}

type FilaDetalle = {
  registro_id: string
  codigo: string
  fecha_cirugia: string
  fecha_pago: string
  clinica: string
  animal: string
  especie: string
  sexo: string
  tipo_animal: string
  valor_unitario: number
  valor_total: number
  estado_financiero: "PAGADO" | "PENDIENTE"
  observacion: string
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function inicioMesISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function inicioSemanaISO() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizarEstado(valor?: string | null) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function esAptoFinanciero(registro: Registro) {
  const estadoClinica = normalizarEstado(registro.estado_clinica)
  const estadoCita = normalizarEstado(registro.estado_cita)

  return (
    estadoClinica === "apto" ||
    estadoCita === "realizado" ||
    estadoCita === "atendido"
  )
}

function esNoShow(registro: Registro) {
  const estadoClinica = normalizarEstado(registro.estado_clinica)
  const estadoCita = normalizarEstado(registro.estado_cita)

  return estadoClinica === "no show" || estadoCita === "no show"
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

  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", nombreArchivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatearMoneda(valor: number) {
  return `Bs ${toNumber(valor).toFixed(2)}`
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

function prepararHojaConTitulo(
  titulo: string,
  subtitulo: string,
  filas: Record<string, any>[]
) {
  const encabezado = [
    [titulo],
    [subtitulo],
    [],
  ]

  const ws = XLSX.utils.aoa_to_sheet(encabezado)

  if (filas.length > 0) {
    XLSX.utils.sheet_add_json(ws, filas, { origin: "A4" })
  } else {
    XLSX.utils.sheet_add_aoa(ws, [["No hay datos para exportar."]], { origin: "A4" })
  }

  return ws
}

export default function InformesContabilidadPage() {
  const [cargando, setCargando] = useState(true)

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [tarifas, setTarifas] = useState<TarifaClinica[]>([])
  const [pagos, setPagos] = useState<PagoClinica[]>([])
  const [detalles, setDetalles] = useState<PagoDetalle[]>([])

  const [tipoPeriodo, setTipoPeriodo] = useState("mensual")
  const [fechaInicio, setFechaInicio] = useState(inicioMesISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [especieFiltro, setEspecieFiltro] = useState("")
  const [tipoAnimalFiltro, setTipoAnimalFiltro] = useState("")

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (tipoPeriodo === "diario") {
      setFechaInicio(hoyISO())
      setFechaFin(hoyISO())
    }
    if (tipoPeriodo === "semanal") {
      setFechaInicio(inicioSemanaISO())
      setFechaFin(hoyISO())
    }
    if (tipoPeriodo === "mensual") {
      setFechaInicio(inicioMesISO())
      setFechaFin(hoyISO())
    }
  }, [tipoPeriodo])

  async function cargarDatos() {
    setCargando(true)

    const [clinicasRes, registrosRes, tarifasRes, pagosRes, detallesRes] = await Promise.all([
      supabase
        .from("clinicas")
        .select("id,nome")
        .order("nome", { ascending: true }),

      supabase
        .from("registros")
        .select("id,codigo,clinica_id,especie,sexo,tipo_animal,nombre_animal,pagado,fecha_pago,fecha_programada,estado_clinica,estado_cita"),

      supabase
        .from("tarifas_clinica")
        .select("id,clinica_id,especie,sexo,valor,activo")
        .eq("activo", true),

      supabase
        .from("pagos_clinica")
        .select("id,clinica_id,fecha_pago,periodo_tipo,fecha_inicio,fecha_fin,cantidad_animales,monto_total,observacion,registrado_por,created_at")
        .order("fecha_pago", { ascending: false }),

      supabase
        .from("pagos_clinica_detalle")
        .select("id,pago_id,registro_id,monto_unitario,monto_total,created_at"),
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
    if (detallesRes.data) {
      setDetalles(
        (detallesRes.data as any[]).map((d) => ({
          ...d,
          monto_unitario: toNumber(d.monto_unitario),
          monto_total: toNumber(d.monto_total),
        }))
      )
    }

    setCargando(false)
  }

  const mapaClinicas = useMemo(() => {
    const mapa: Record<string, string> = {}
    clinicas.forEach((c) => {
      mapa[c.id] = c.nome
    })
    return mapa
  }, [clinicas])

  const mapaTarifas = useMemo(() => {
    const mapa: Record<string, number> = {}
    tarifas.forEach((t) => {
      const key = `${t.clinica_id}__${(t.especie || "").trim().toLowerCase()}__${(t.sexo || "").trim().toLowerCase()}`
      mapa[key] = toNumber(t.valor)
    })
    return mapa
  }, [tarifas])

  const mapaPagoPorId = useMemo(() => {
    const mapa: Record<string, PagoClinica> = {}
    pagos.forEach((p) => {
      mapa[p.id] = p
    })
    return mapa
  }, [pagos])

  const mapaDetallePorRegistro = useMemo(() => {
    const mapa: Record<string, PagoDetalle> = {}
    detalles.forEach((d: PagoDetalle) => {
      mapa[d.registro_id] = d
    })
    return mapa
  }, [detalles])

  const especiesDisponibles = useMemo(() => {
    return Array.from(
      new Set(registros.map((r) => (r.especie || "").trim()).filter(Boolean))
    ).sort()
  }, [registros])

  const tiposAnimalDisponibles = useMemo(() => {
    return Array.from(
      new Set(registros.map((r) => (r.tipo_animal || "").trim()).filter(Boolean))
    ).sort()
  }, [registros])

  const registrosBasePeriodo = useMemo(() => {
    return registros.filter((r) => {
      if (!r.fecha_programada) return false
      if (fechaInicio && r.fecha_programada < fechaInicio) return false
      if (fechaFin && r.fecha_programada > fechaFin) return false
      if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false
      if (especieFiltro && (r.especie || "") !== especieFiltro) return false
      if (tipoAnimalFiltro && (r.tipo_animal || "") !== tipoAnimalFiltro) return false
      return true
    })
  }, [registros, fechaInicio, fechaFin, clinicaFiltro, especieFiltro, tipoAnimalFiltro])

  const registrosAptos = useMemo(() => {
    return registrosBasePeriodo.filter((r) => esAptoFinanciero(r))
  }, [registrosBasePeriodo])

  const registrosNoShow = useMemo(() => {
    return registrosBasePeriodo.filter((r) => esNoShow(r))
  }, [registrosBasePeriodo])

  const filasDetalle = useMemo(() => {
    const filas: FilaDetalle[] = registrosAptos
      .filter((r) => {
        const estadoFin = r.pagado ? "PAGADO" : "PENDIENTE"
        if (estadoFiltro && estadoFin !== estadoFiltro) return false
        return true
      })
      .map((r) => {
        const especie = (r.especie || "").trim().toLowerCase()
        const sexo = (r.sexo || "").trim().toLowerCase()
        const key = `${r.clinica_id}__${especie}__${sexo}`
        const tarifa = mapaTarifas[key] || 0

        const detalle = mapaDetallePorRegistro[r.id]
        const pago = detalle ? mapaPagoPorId[detalle.pago_id] : null

        return {
          registro_id: r.id,
          codigo: r.codigo || "",
          fecha_cirugia: r.fecha_programada || "",
          fecha_pago: pago?.fecha_pago?.slice(0, 10) || (r.fecha_pago ? r.fecha_pago.slice(0, 10) : ""),
          clinica: r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica",
          animal: r.nombre_animal || "",
          especie: r.especie || "",
          sexo: r.sexo || "",
          tipo_animal: r.tipo_animal || "",
          valor_unitario: detalle ? detalle.monto_unitario : tarifa,
          valor_total: detalle ? detalle.monto_total : tarifa,
          estado_financiero: r.pagado ? "PAGADO" : "PENDIENTE",
          observacion: pago?.observacion || "",
        }
      })

    return filas
  }, [
    registrosAptos,
    estadoFiltro,
    mapaTarifas,
    mapaDetallePorRegistro,
    mapaPagoPorId,
    mapaClinicas,
  ])

  const resumen = useMemo(() => {
    const totalEsterilizaciones = filasDetalle.length
    const totalGenerado = filasDetalle.reduce((acc, f) => acc + f.valor_total, 0)
    const totalPagado = filasDetalle
      .filter((f) => f.estado_financiero === "PAGADO")
      .reduce((acc, f) => acc + f.valor_total, 0)
    const totalPendiente = filasDetalle
      .filter((f) => f.estado_financiero === "PENDIENTE")
      .reduce((acc, f) => acc + f.valor_total, 0)

    const clinicasPendientes = new Set(
      filasDetalle
        .filter((f) => f.estado_financiero === "PENDIENTE")
        .map((f) => f.clinica)
    ).size

    const promedio = totalEsterilizaciones > 0 ? totalGenerado / totalEsterilizaciones : 0

    return {
      totalEsterilizaciones,
      totalGenerado,
      totalPagado,
      totalPendiente,
      clinicasPendientes,
      promedio,
      noShow: registrosNoShow.length,
      programadosNoCerrados: registrosBasePeriodo.filter((r) => {
  const estadoClinica = normalizarEstado(r.estado_clinica)
  const estadoCita = normalizarEstado(r.estado_cita)

  return (
    !esAptoFinanciero(r) &&
    !esNoShow(r) &&
    estadoClinica !== "reprogramado" &&
    estadoClinica !== "rechazado" &&
    estadoClinica !== "no apto" &&
    estadoClinica !== "fallecido" &&
    estadoClinica !== "fallecio" &&
    estadoCita !== "cancelado" &&
    estadoCita !== "rechazado" &&
    estadoCita !== "fallecido" &&
    estadoCita !== "fallecio"
  )
    }).length,
    }
  }, [filasDetalle, registrosNoShow, registrosBasePeriodo])

  const porClinica = useMemo(() => {
    const mapa: Record<
      string,
      {
        clinica: string
        animales: number
        bruto: number
        pagado: number
        pendiente: number
        ultimoPago: string
        perros: number
        gatos: number
      }
    > = {}

    filasDetalle.forEach((f) => {
      if (!mapa[f.clinica]) {
        mapa[f.clinica] = {
          clinica: f.clinica,
          animales: 0,
          bruto: 0,
          pagado: 0,
          pendiente: 0,
          ultimoPago: "",
          perros: 0,
          gatos: 0,
        }
      }

      mapa[f.clinica].animales += 1
      mapa[f.clinica].bruto += f.valor_total
      if (f.estado_financiero === "PAGADO") mapa[f.clinica].pagado += f.valor_total
      if (f.estado_financiero === "PENDIENTE") mapa[f.clinica].pendiente += f.valor_total
      if (f.especie === "Perro") mapa[f.clinica].perros += 1
      if (f.especie === "Gato") mapa[f.clinica].gatos += 1
      if (f.fecha_pago && (!mapa[f.clinica].ultimoPago || f.fecha_pago > mapa[f.clinica].ultimoPago)) {
        mapa[f.clinica].ultimoPago = f.fecha_pago
      }
    })

    return Object.values(mapa).sort((a, b) => b.bruto - a.bruto)
  }, [filasDetalle])

  const porPeriodo = useMemo(() => {
    const mapa: Record<
      string,
      {
        periodo: string
        animales: number
        generado: number
        pagado: number
        pendiente: number
      }
    > = {}

    filasDetalle.forEach((f) => {
      let chave = f.fecha_cirugia

      if (tipoPeriodo === "semanal") {
        chave = f.fecha_cirugia.slice(0, 7) + " / semana"
      }

      if (tipoPeriodo === "mensual") {
        chave = f.fecha_cirugia.slice(0, 7)
      }

      if (!mapa[chave]) {
        mapa[chave] = {
          periodo: chave,
          animales: 0,
          generado: 0,
          pagado: 0,
          pendiente: 0,
        }
      }

      mapa[chave].animales += 1
      mapa[chave].generado += f.valor_total
      if (f.estado_financiero === "PAGADO") mapa[chave].pagado += f.valor_total
      if (f.estado_financiero === "PENDIENTE") mapa[chave].pendiente += f.valor_total
    })

    return Object.values(mapa).sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [filasDetalle, tipoPeriodo])

  const maximoGrafico = useMemo(() => {
    if (!porPeriodo.length) return 1
    return Math.max(...porPeriodo.map((p) => p.generado), 1)
  }, [porPeriodo])

  const resumenEspecies = useMemo(() => {
    let perros = 0
    let gatos = 0
    let machos = 0
    let hembras = 0

    filasDetalle.forEach((f) => {
      if (f.especie === "Perro") perros += 1
      if (f.especie === "Gato") gatos += 1
      if (f.sexo === "Macho") machos += 1
      if (f.sexo === "Hembra") hembras += 1
    })

    return { perros, gatos, machos, hembras }
  }, [filasDetalle])

  const subtituloReporte = useMemo(() => {
    const clinicaTexto = clinicaFiltro
      ? mapaClinicas[clinicaFiltro] || clinicaFiltro
      : "Todas las clínicas"

    return `Período: ${fechaInicio} a ${fechaFin} | Tipo: ${tipoPeriodo} | Clínica: ${clinicaTexto}`
  }, [fechaInicio, fechaFin, tipoPeriodo, clinicaFiltro, mapaClinicas])

  const resumenGeneralRows = useMemo(() => {
    return [
      { Indicador: "Procedimientos contabilizados", Valor: resumen.totalEsterilizaciones },
      { Indicador: "Total generado", Valor: resumen.totalGenerado.toFixed(2) },
      { Indicador: "Total pagado", Valor: resumen.totalPagado.toFixed(2) },
      { Indicador: "Total pendiente", Valor: resumen.totalPendiente.toFixed(2) },
      { Indicador: "Clínicas pendientes", Valor: resumen.clinicasPendientes },
      { Indicador: "Promedio por cirugía", Valor: resumen.promedio.toFixed(2) },
      { Indicador: "No Show", Valor: resumen.noShow },
      { Indicador: "Programados no cerrados", Valor: resumen.programadosNoCerrados },
      { Indicador: "Perros", Valor: resumenEspecies.perros },
      { Indicador: "Gatos", Valor: resumenEspecies.gatos },
      { Indicador: "Machos", Valor: resumenEspecies.machos },
      { Indicador: "Hembras", Valor: resumenEspecies.hembras },
    ]
  }, [resumen, resumenEspecies])

  const resumenClinicasRows = useMemo(() => {
    const rows = porClinica.map((item) => ({
      "Clínica": item.clinica,
      "Animales": item.animales,
      "Perros": item.perros,
      "Gatos": item.gatos,
      "Bruto (Bs)": item.bruto.toFixed(2),
      "Pagado (Bs)": item.pagado.toFixed(2),
      "Pendiente (Bs)": item.pendiente.toFixed(2),
      "Último pago": item.ultimoPago || "-",
    }))

    if (rows.length > 0) {
      rows.push({
        "Clínica": "TOTAL",
        "Animales": porClinica.reduce((acc, item) => acc + item.animales, 0),
        "Perros": porClinica.reduce((acc, item) => acc + item.perros, 0),
        "Gatos": porClinica.reduce((acc, item) => acc + item.gatos, 0),
        "Bruto (Bs)": porClinica.reduce((acc, item) => acc + item.bruto, 0).toFixed(2),
        "Pagado (Bs)": porClinica.reduce((acc, item) => acc + item.pagado, 0).toFixed(2),
        "Pendiente (Bs)": porClinica.reduce((acc, item) => acc + item.pendiente, 0).toFixed(2),
        "Último pago": "-",
      })
    }

    return rows
  }, [porClinica])

  const resumenPeriodosRows = useMemo(() => {
    const rows = porPeriodo.map((item) => ({
      "Período": item.periodo,
      "Animales": item.animales,
      "Generado (Bs)": item.generado.toFixed(2),
      "Pagado (Bs)": item.pagado.toFixed(2),
      "Pendiente (Bs)": item.pendiente.toFixed(2),
    }))

    if (rows.length > 0) {
      rows.push({
        "Período": "TOTAL",
        "Animales": porPeriodo.reduce((acc, item) => acc + item.animales, 0),
        "Generado (Bs)": porPeriodo.reduce((acc, item) => acc + item.generado, 0).toFixed(2),
        "Pagado (Bs)": porPeriodo.reduce((acc, item) => acc + item.pagado, 0).toFixed(2),
        "Pendiente (Bs)": porPeriodo.reduce((acc, item) => acc + item.pendiente, 0).toFixed(2),
      })
    }

    return rows
  }, [porPeriodo])

  const detalleRows = useMemo<Record<string, string | number>[]>(() => {
  const rows: Record<string, string | number>[] = filasDetalle.map((f) => ({
    "Fecha cirugía": f.fecha_cirugia,
    "Fecha pago": f.fecha_pago || "-",
    "Clínica": f.clinica,
    "Código": f.codigo,
    "Animal": f.animal,
    "Especie": f.especie,
    "Sexo": f.sexo,
    "Tipo animal": f.tipo_animal,
    "Valor unitario (Bs)": f.valor_unitario.toFixed(2),
    "Valor total (Bs)": f.valor_total.toFixed(2),
    "Estado financiero": f.estado_financiero,
    "Observación": f.observacion || "",
  }))

  if (rows.length > 0) {
    rows.push({
      "Fecha cirugía": "",
      "Fecha pago": "",
      "Clínica": "TOTAL",
      "Código": "",
      "Animal": "",
      "Especie": "",
      "Sexo": "",
      "Tipo animal": "",
      "Valor unitario (Bs)": "",
      "Valor total (Bs)": filasDetalle.reduce((acc, item) => acc + item.valor_total, 0).toFixed(2),
      "Estado financiero": "",
      "Observación": "",
    })
  }

  return rows
}, [filasDetalle])


  function exportarCSVContabilidad() {
    descargarCSV("informe_contabilidad_detalle.csv", detalleRows)
  }

  function exportarExcelCompleto() {
    if (!filasDetalle.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()

    const wsResumen = prepararHojaConTitulo(
      "Informe de Contabilidad — Resumen General",
      subtituloReporte,
      resumenGeneralRows
    )
    const wsClinicas = prepararHojaConTitulo(
      "Informe de Contabilidad — Resumen por Clínica",
      subtituloReporte,
      resumenClinicasRows
    )
    const wsPeriodos = prepararHojaConTitulo(
      "Informe de Contabilidad — Resumen por Período",
      subtituloReporte,
      resumenPeriodosRows
    )
    const wsDetalle = prepararHojaConTitulo(
      "Informe de Contabilidad — Detalle Financiero",
      subtituloReporte,
      detalleRows
    )

    wsResumen["!cols"] = autoWidthFromRows(resumenGeneralRows)
    wsClinicas["!cols"] = autoWidthFromRows(resumenClinicasRows)
    wsPeriodos["!cols"] = autoWidthFromRows(resumenPeriodosRows)
    wsDetalle["!cols"] = autoWidthFromRows(detalleRows)

    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen general")
    XLSX.utils.book_append_sheet(wb, wsClinicas, "Por clínica")
    XLSX.utils.book_append_sheet(wb, wsPeriodos, "Por período")
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle financiero")

    XLSX.writeFile(
      wb,
      `informe_contabilidad_completo_${fechaInicio}_a_${fechaFin}.xlsx`
    )
  }

  function exportarExcelResumenClinicas() {
    if (!resumenClinicasRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()
    const ws = prepararHojaConTitulo(
      "Resumen por Clínica",
      subtituloReporte,
      resumenClinicasRows
    )
    ws["!cols"] = autoWidthFromRows(resumenClinicasRows)
    XLSX.utils.book_append_sheet(wb, ws, "Resumen por clínica")
    XLSX.writeFile(
      wb,
      `resumen_clinicas_${fechaInicio}_a_${fechaFin}.xlsx`
    )
  }

  function exportarExcelResumenPeriodos() {
    if (!resumenPeriodosRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()
    const ws = prepararHojaConTitulo(
      "Resumen por Período",
      subtituloReporte,
      resumenPeriodosRows
    )
    ws["!cols"] = autoWidthFromRows(resumenPeriodosRows)
    XLSX.utils.book_append_sheet(wb, ws, "Resumen por período")
    XLSX.writeFile(
      wb,
      `resumen_periodos_${fechaInicio}_a_${fechaFin}.xlsx`
    )
  }

  function exportarExcelDetalleFinanciero() {
    if (!detalleRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()
    const ws = prepararHojaConTitulo(
      "Detalle Financiero",
      subtituloReporte,
      detalleRows
    )
    ws["!cols"] = autoWidthFromRows(detalleRows)
    XLSX.utils.book_append_sheet(wb, ws, "Detalle financiero")
    XLSX.writeFile(
      wb,
      `detalle_financiero_${fechaInicio}_a_${fechaFin}.xlsx`
    )
  }

  function limpiarFiltros() {
    setTipoPeriodo("mensual")
    setFechaInicio(inicioMesISO())
    setFechaFin(hoyISO())
    setClinicaFiltro("")
    setEstadoFiltro("")
    setEspecieFiltro("")
    setTipoAnimalFiltro("")
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando informe de contabilidad...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Informe de contabilidad
            </h1>
            <p className="text-white/80">
              Control financiero de esterilizaciones realizadas, pagos y pendientes por clínica
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={exportarExcelCompleto}
              className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
            >
              Exportar Excel completo
            </button>

            <button
              onClick={exportarCSVContabilidad}
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Exportar CSV
            </button>

            <Link
              href="/admin/informes"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de período
              </label>
              <select
                value={tipoPeriodo}
                onChange={(e) => setTipoPeriodo(e.target.value)}
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
                Estado financiero
              </label>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="PAGADO">Pagado</option>
                <option value="PENDIENTE">Pendiente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Especie
              </label>
              <select
                value={especieFiltro}
                onChange={(e) => setEspecieFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas</option>
                {especiesDisponibles.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo animal
              </label>
              <select
                value={tipoAnimalFiltro}
                onChange={(e) => setTipoAnimalFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                {tiposAnimalDisponibles.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={limpiarFiltros}
                className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Procedimientos contabilizados</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumen.totalEsterilizaciones}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Total generado</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{formatearMoneda(resumen.totalGenerado)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Total pagado</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatearMoneda(resumen.totalPagado)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Pendiente</p>
            <p className="text-3xl font-bold text-red-500 mt-2">{formatearMoneda(resumen.totalPendiente)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Clínicas pendientes</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumen.clinicasPendientes}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Promedio / cirugía</p>
            <p className="text-3xl font-bold text-[#F47C3C] mt-2">{formatearMoneda(resumen.promedio)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">No Show</p>
            <p className="text-3xl font-bold text-gray-700 mt-2">{resumen.noShow}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Programados no cerrados</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{resumen.programadosNoCerrados}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Perros</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.perros}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Gatos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.gatos}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Machos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.machos}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Hembras</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.hembras}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-xl font-bold text-[#0F6D6A]">
              Evolución financiera
            </h2>

            <button
              onClick={exportarExcelResumenPeriodos}
              className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:opacity-90"
            >
              Excel período
            </button>
          </div>

          <div className="space-y-3">
            {porPeriodo.length > 0 ? (
              porPeriodo.map((item, index) => {
                const largura = `${(item.generado / maximoGrafico) * 100}%`
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">{item.periodo}</span>
                      <span className="text-gray-600">
                        {formatearMoneda(item.generado)} generado / {formatearMoneda(item.pagado)} pagado
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-[#F47C3C] h-4 rounded-full"
                        style={{ width: largura }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500">No hay datos para el período seleccionado.</p>
            )}
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F6D6A]">
                Resumen por clínica
              </h2>

              <button
                onClick={exportarExcelResumenClinicas}
                className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:opacity-90"
              >
                Excel clínica
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Clínica</th>
                    <th className="py-2 pr-3">Anim.</th>
                    <th className="py-2 pr-3">Perros</th>
                    <th className="py-2 pr-3">Gatos</th>
                    <th className="py-2 pr-3">Bruto</th>
                    <th className="py-2 pr-3">Pagado</th>
                    <th className="py-2 pr-3">Pend.</th>
                    <th className="py-2 pr-3">Últ. pago</th>
                  </tr>
                </thead>
                <tbody>
                  {porClinica.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 pr-3 font-semibold">{item.clinica}</td>
                      <td className="py-2 pr-3">{item.animales}</td>
                      <td className="py-2 pr-3">{item.perros}</td>
                      <td className="py-2 pr-3">{item.gatos}</td>
                      <td className="py-2 pr-3">{formatearMoneda(item.bruto)}</td>
                      <td className="py-2 pr-3 text-green-600 font-semibold">{formatearMoneda(item.pagado)}</td>
                      <td className="py-2 pr-3 text-red-600 font-semibold">{formatearMoneda(item.pendiente)}</td>
                      <td className="py-2 pr-3">{item.ultimoPago || "-"}</td>
                    </tr>
                  ))}

                  {porClinica.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-500">
                        No hay datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F6D6A]">
                Resumen por período
              </h2>

              <button
                onClick={exportarExcelResumenPeriodos}
                className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:opacity-90"
              >
                Excel período
              </button>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Período</th>
                    <th className="py-2 pr-3">Animales</th>
                    <th className="py-2 pr-3">Generado</th>
                    <th className="py-2 pr-3">Pagado</th>
                    <th className="py-2 pr-3">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {porPeriodo.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 pr-3 font-semibold">{item.periodo}</td>
                      <td className="py-2 pr-3">{item.animales}</td>
                      <td className="py-2 pr-3">{formatearMoneda(item.generado)}</td>
                      <td className="py-2 pr-3 text-green-600 font-semibold">{formatearMoneda(item.pagado)}</td>
                      <td className="py-2 pr-3 text-red-600 font-semibold">{formatearMoneda(item.pendiente)}</td>
                    </tr>
                  ))}

                  {porPeriodo.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No hay datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-xl font-bold text-[#0F6D6A]">
              Detalle financiero
            </h2>

            <button
              onClick={exportarExcelDetalleFinanciero}
              className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:opacity-90"
            >
              Excel detalle
            </button>
          </div>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Fecha cirugía</th>
                  <th className="py-2 pr-3">Fecha pago</th>
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Animal</th>
                  <th className="py-2 pr-3">Especie</th>
                  <th className="py-2 pr-3">Sexo</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Valor unit.</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {filasDetalle.map((fila, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 pr-3">{fila.fecha_cirugia}</td>
                    <td className="py-2 pr-3">{fila.fecha_pago || "-"}</td>
                    <td className="py-2 pr-3 font-semibold">{fila.clinica}</td>
                    <td className="py-2 pr-3">{fila.codigo}</td>
                    <td className="py-2 pr-3">{fila.animal}</td>
                    <td className="py-2 pr-3">{fila.especie}</td>
                    <td className="py-2 pr-3">{fila.sexo}</td>
                    <td className="py-2 pr-3">{fila.tipo_animal}</td>
                    <td className="py-2 pr-3">{formatearMoneda(fila.valor_unitario)}</td>
                    <td className="py-2 pr-3 font-semibold">{formatearMoneda(fila.valor_total)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          fila.estado_financiero === "PAGADO"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {fila.estado_financiero}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{fila.observacion || "-"}</td>
                  </tr>
                ))}

                {filasDetalle.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-6 text-center text-gray-500">
                      No hay datos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
