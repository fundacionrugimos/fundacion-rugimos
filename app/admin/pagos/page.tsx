"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import { exportarExcelPro } from "@/lib/exportar_excel_pro"

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
  fecha_pago?: string | null
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

type RegistroConSaldo = Registro & {
  saldo_pendiente_registro: number
  valor_unitario: number
}

type HonorarioExterno = {
  id: string
  clinica_id: string | null
  clinica_nombre: string | null
  fecha: string
  concepto: string
  especie: string | null
  nombre_animal: string | null
  monto: number
  estado_pago: string
  fecha_pago: string | null
  observacion: string | null
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

function normalizarTexto(valor?: string | null) {
  return (valor || "").trim().toLowerCase()
}

function fechaSolo(valor?: string | null) {
  return valor ? valor.slice(0, 10) : ""
}

function esRegistroPagable(registro: Registro) {
  return (
    normalizarEstado(registro.estado_clinica) === "apto" &&
    Boolean(registro.fecha_cirugia_realizada)
  )
}

function formatearMoneda(valor: number) {
  return `Bs ${toNumber(valor).toFixed(2)}`
}

function descargarCSV(nombreArchivo: string, filas: Record<string, string | number>[]) {
  if (!filas.length) {
    alert("No hay datos para exportar.")
    return
  }

  const headers = Object.keys(filas[0])

  const escapar = (valor: string | number | null | undefined) => {
    const texto = String(valor ?? "")
    if (texto.includes('"') || texto.includes(",") || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`
    }
    return texto
  }

  const contenido = [
    headers.join(","),
    ...filas.map((fila) => headers.map((h) => escapar(fila[h] as string | number)).join(",")),
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

function autoWidthFromRows(rows: Record<string, string | number>[]) {
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

function montoEhDiferente(a: number, b: number) {
  return Math.abs(a - b) >= 0.001
}

function prepararHojaConTitulo(
  titulo: string,
  subtitulo: string,
  filas: Record<string, string | number>[]
) {
  const encabezado = [[titulo], [subtitulo], []]
  const ws = XLSX.utils.aoa_to_sheet(encabezado)

  if (filas.length > 0) {
    XLSX.utils.sheet_add_json(ws, filas, { origin: "A4" })
  } else {
    XLSX.utils.sheet_add_aoa(ws, [["No hay datos para exportar."]], { origin: "A4" })
  }

  return ws
}

export default function AdminPagosPage() {
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [tarifas, setTarifas] = useState<TarifaClinica[]>([])
  const [pagos, setPagos] = useState<PagoClinica[]>([])
  const [detalles, setDetalles] = useState<PagoDetalle[]>([])
  const [honorarios, setHonorarios] = useState<HonorarioExterno[]>([])

  const [periodoTipo, setPeriodoTipo] = useState("mensual")
  const [fechaInicio, setFechaInicio] = useState(inicioMesISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [observacionGlobal, setObservacionGlobal] = useState("")

  const [mostrarModalHonorario, setMostrarModalHonorario] = useState(false)
  const [guardandoHonorario, setGuardandoHonorario] = useState(false)
  const [honClinicaId, setHonClinicaId] = useState("")
  const [honClinicaNombre, setHonClinicaNombre] = useState("")
  const [honFecha, setHonFecha] = useState(hoyISO())
  const [honConcepto, setHonConcepto] = useState("")
  const [honEspecie, setHonEspecie] = useState("")
  const [honNombreAnimal, setHonNombreAnimal] = useState("")
  const [honMonto, setHonMonto] = useState("")
  const [honEstadoPago, setHonEstadoPago] = useState("pagado")
  const [honFechaPago, setHonFechaPago] = useState(hoyISO())
  const [honObservacion, setHonObservacion] = useState("")

  async function fetchAllRows<T>(
  table: string,
  selectClause: string,
  build?: (query: any) => any,
  pageSize = 1000
): Promise<T[]> {
  let from = 0
  let allRows: T[] = []

  while (true) {
    let query = supabase.from(table).select(selectClause)

    if (build) {
      query = build(query)
    }

    const { data, error } = await query.range(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    const rows = (data || []) as T[]
    allRows = allRows.concat(rows)

    if (rows.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}

  async function cargarDatos() {
  setCargando(true)

  try {
    const [res, honorariosRes] = await Promise.all([
      fetch("/api/pagos"),
      supabase
        .from("honorarios_veterinarios_externos")
        .select("*")
        .order("fecha", { ascending: false }),
    ])

    const json = await res.json()

    if (!json.ok) {
      throw new Error("Error cargando datos")
    }

    const {
      clinicas,
      registros,
      tarifas,
      pagos,
      detalles,
    } = json.data

    setClinicas(clinicas || [])
    setRegistros(registros || [])

    setTarifas(
      (tarifas || []).map((t: any) => ({
        ...t,
        valor: toNumber(t.valor),
      }))
    )

    setPagos(
      (pagos || []).map((p: any) => ({
        ...p,
        monto_total: toNumber(p.monto_total),
      }))
    )

    setDetalles(
      (detalles || []).map((d: any) => ({
        ...d,
        monto_unitario: toNumber(d.monto_unitario),
        monto_total: toNumber(d.monto_total),
      }))
    )

    if (honorariosRes.error) {
      throw new Error(honorariosRes.error.message)
    }

    setHonorarios(
      (honorariosRes.data || []).map((h: any) => ({
        ...h,
        monto: toNumber(h.monto),
      }))
    )

  } catch (error) {
    console.log("Error cargando pagos clínicas:", error)
    alert("No se pudieron cargar los datos.")
  } finally {
    setCargando(false)
  }
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
      const key = `${t.clinica_id}__${normalizarTexto(t.especie)}__${normalizarTexto(t.sexo)}`
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

  const detallesPorRegistro = useMemo(() => {
    const mapa: Record<string, PagoDetalle[]> = {}

    detalles.forEach((d) => {
      if (!mapa[d.registro_id]) mapa[d.registro_id] = []
      mapa[d.registro_id].push(d)
    })

    return mapa
  }, [detalles])

  const registrosBase = useMemo(() => {
    return registros.filter((r) => {
      if (!r.clinica_id) return false
      if (!esRegistroPagable(r)) return false

      const fechaCirugia = fechaSolo(r.fecha_cirugia_realizada)
      if (!fechaCirugia) return false
      if (fechaInicio && fechaCirugia < fechaInicio) return false
      if (fechaFin && fechaCirugia > fechaFin) return false
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
        total_generado: number
        total_pagado_periodo: number
        total_pagar: number
        registros: RegistroConSaldo[]
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
        total_generado: 0,
        total_pagado_periodo: 0,
        total_pagar: 0,
        registros: [],
        ultimo_pago: null,
      }
    })

    registrosBase.forEach((r) => {
      if (!r.clinica_id || !mapa[r.clinica_id]) return

      const especie = normalizarTexto(r.especie)
      const sexo = normalizarTexto(r.sexo)
      const key = `${r.clinica_id}__${especie}__${sexo}`
      const valorUnitario = mapaTarifas[key] || 0

      if (especie === "perro" && sexo === "macho") mapa[r.clinica_id].perro_macho += 1
      if (especie === "perro" && sexo === "hembra") mapa[r.clinica_id].perra_hembra += 1
      if (especie === "gato" && sexo === "macho") mapa[r.clinica_id].gato_macho += 1
      if (especie === "gato" && sexo === "hembra") mapa[r.clinica_id].gata_hembra += 1

      const detallesRegistro = detallesPorRegistro[r.id] || []
      const totalPagadoRegistro = detallesRegistro.reduce((acc, d) => acc + toNumber(d.monto_total), 0)
      const saldoPendienteRegistro = Math.max(valorUnitario - totalPagadoRegistro, 0)

      mapa[r.clinica_id].total_animales += 1
      mapa[r.clinica_id].total_generado += valorUnitario
      mapa[r.clinica_id].total_pagado_periodo += totalPagadoRegistro
      mapa[r.clinica_id].total_pagar += saldoPendienteRegistro
      mapa[r.clinica_id].registros.push({
        ...r,
        saldo_pendiente_registro: saldoPendienteRegistro,
        valor_unitario: valorUnitario,
      })

      detallesRegistro.forEach((d) => {
        const pago = mapaPagoPorId[d.pago_id]
        if (!pago?.fecha_pago) return
        const fechaPago = fechaSolo(pago.fecha_pago)
        if (!mapa[r.clinica_id!].ultimo_pago || fechaPago > mapa[r.clinica_id!].ultimo_pago!) {
          mapa[r.clinica_id!].ultimo_pago = fechaPago
        }
      })
    })

    pagos.forEach((p) => {
      const clinica = mapa[p.clinica_id]
      if (!clinica) return
      const fechaPago = fechaSolo(p.fecha_pago)
      if (!clinica.ultimo_pago || fechaPago > clinica.ultimo_pago) {
        clinica.ultimo_pago = fechaPago
      }
    })

    return Object.values(mapa)
      .filter((c) => c.total_animales > 0 || (!clinicaFiltro || c.clinica_id === clinicaFiltro))
      .sort((a, b) => b.total_pagar - a.total_pagar)
  }, [clinicas, registrosBase, mapaTarifas, detallesPorRegistro, mapaPagoPorId, pagos, clinicaFiltro])

  const resumenGeneral = useMemo(() => {
    return resumenPorClinica.reduce(
      (acc, c) => {
        acc.total_animales += c.total_animales
        acc.total_generado += c.total_generado
        acc.total_pagado_periodo += c.total_pagado_periodo
        acc.total_pagar += c.total_pagar
        acc.perro_macho += c.perro_macho
        acc.perra_hembra += c.perra_hembra
        acc.gato_macho += c.gato_macho
        acc.gata_hembra += c.gata_hembra
        return acc
      },
      {
        total_animales: 0,
        total_generado: 0,
        total_pagado_periodo: 0,
        total_pagar: 0,
        perro_macho: 0,
        perra_hembra: 0,
        gato_macho: 0,
        gata_hembra: 0,
      }
    )
  }, [resumenPorClinica])

  const honorariosFiltrados = useMemo(() => {
    return honorarios.filter((h) => {
      const fecha = fechaSolo(h.fecha)
      if (!fecha) return false
      if (fechaInicio && fecha < fechaInicio) return false
      if (fechaFin && fecha > fechaFin) return false
      if (clinicaFiltro && h.clinica_id !== clinicaFiltro) return false
      return true
    })
  }, [honorarios, fechaInicio, fechaFin, clinicaFiltro])

  const resumenHonorarios = useMemo(() => {
    const total = honorariosFiltrados.reduce((acc, h) => acc + toNumber(h.monto), 0)
    const pagado = honorariosFiltrados
      .filter((h) => normalizarEstado(h.estado_pago) === "pagado")
      .reduce((acc, h) => acc + toNumber(h.monto), 0)

    return {
      cantidad: honorariosFiltrados.length,
      total,
      pagado,
      pendiente: Math.max(total - pagado, 0),
    }
  }, [honorariosFiltrados])

  async function registrarHonorario() {
    const monto = toNumber(honMonto)

    if (!honFecha) return alert("Ingrese la fecha.")
    if (!honConcepto.trim()) return alert("Ingrese el concepto.")
    if (monto <= 0) return alert("Ingrese un monto válido.")

    setGuardandoHonorario(true)

    try {
      const nombreClinica =
        honClinicaId
          ? clinicas.find((c) => c.id === honClinicaId)?.nome || null
          : honClinicaNombre.trim() || null

      const fechaPagoFinal = honEstadoPago === "pagado" ? honFechaPago || honFecha : null

      const { error } = await supabase
        .from("honorarios_veterinarios_externos")
        .insert([
          {
            clinica_id: honClinicaId || null,
            clinica_nombre: nombreClinica,
            fecha: honFecha,
            concepto: honConcepto.trim(),
            especie: honEspecie.trim() || null,
            nombre_animal: honNombreAnimal.trim() || null,
            monto,
            estado_pago: honEstadoPago,
            fecha_pago: fechaPagoFinal,
            observacion: honObservacion.trim() || null,
          },
        ])

      if (error) throw error

      setMostrarModalHonorario(false)
      setHonClinicaId("")
      setHonClinicaNombre("")
      setHonFecha(hoyISO())
      setHonConcepto("")
      setHonEspecie("")
      setHonNombreAnimal("")
      setHonMonto("")
      setHonEstadoPago("pagado")
      setHonFechaPago(hoyISO())
      setHonObservacion("")

      await cargarDatos()
      alert("Honorario externo registrado correctamente.")
    } catch (error: any) {
      console.log("Error registrando honorario externo:", error)
      alert(error?.message || "No se pudo registrar el honorario externo.")
    } finally {
      setGuardandoHonorario(false)
    }
  }

  async function pagarClinica(clinicaId: string) {
  const info = resumenPorClinica.find((c) => c.clinica_id === clinicaId)
  if (!info || !info.registros.length) return

  if (info.total_pagar <= 0) {
    alert("Esta clínica ya no tiene saldo pendiente en el período seleccionado.")
    return
  }

  const sugerido = String(info.total_pagar.toFixed(2))
  const valorInput = prompt(
    `Saldo pendiente para ${info.clinica}: ${formatearMoneda(info.total_pagar)}

Total generado: ${formatearMoneda(info.total_generado)}
Pagado acumulado de estos registros: ${formatearMoneda(info.total_pagado_periodo)}

¿Cuánto se pagará ahora?`,
    sugerido
  )

  if (valorInput === null) return

  const montoPagadoAhora = toNumber(valorInput)

  if (montoPagadoAhora <= 0) {
    alert("Debe ingresar un monto mayor que cero.")
    return
  }

  if (montoPagadoAhora > info.total_pagar + 0.001) {
    alert("El monto del pago no puede ser mayor al saldo pendiente.")
    return
  }

  const confirmar = confirm(
    `Confirmar pago a ${info.clinica}.

Total generado: ${formatearMoneda(info.total_generado)}
Pagado acumulado: ${formatearMoneda(info.total_pagado_periodo)}
Saldo pendiente: ${formatearMoneda(info.total_pagar)}
Pago ahora: ${formatearMoneda(montoPagadoAhora)}`
  )
  if (!confirmar) return

  setProcesando(true)

  try {
    const registrosConSaldo = [...info.registros]
      .filter((r) => r.saldo_pendiente_registro > 0)
      .sort((a, b) => {
        const fechaA = fechaSolo(a.fecha_cirugia_realizada)
        const fechaB = fechaSolo(b.fecha_cirugia_realizada)
        return fechaA.localeCompare(fechaB)
      })

    let restante = montoPagadoAhora

    const detalles: Array<{
      registro_id: string
      monto_unitario: number
      monto_total: number
    }> = []

    for (const r of registrosConSaldo) {
      const montoAplicado = Math.min(r.saldo_pendiente_registro, restante)
      if (montoAplicado <= 0) continue

      restante = Math.max(restante - montoAplicado, 0)

      detalles.push({
        registro_id: r.id,
        monto_unitario: r.valor_unitario,
        monto_total: montoAplicado,
      })

      if (restante <= 0) break
    }

    const res = await fetch("/api/pagos/crear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clinica_id: clinicaId,
        fecha_pago: new Date().toISOString(),
        periodo_tipo: periodoTipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cantidad_animales: info.total_animales,
        monto_total: montoPagadoAhora,
        observacion:
          observacionGlobal ||
          (montoEhDiferente(montoPagadoAhora, info.total_pagar)
            ? `Pago parcial. Total generado: ${formatearMoneda(info.total_generado)} · Pagado previo: ${formatearMoneda(info.total_pagado_periodo)}`
            : null),
        detalles,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "No se pudo registrar el pago.")
    }

    await cargarDatos()

    if (montoEhDiferente(montoPagadoAhora, info.total_pagar)) {
      alert("Pago parcial registrado correctamente.")
    } else {
      alert("Pago registrado correctamente.")
    }
  } catch (error: any) {
    console.log("Error registrando pago:", error)
    alert(error?.message || "No se pudo registrar el pago.")
  } finally {
    setProcesando(false)
  }
}

  function construirDetalleRows() {
    return registrosBase.map((r) => {
      const especie = normalizarTexto(r.especie)
      const sexo = normalizarTexto(r.sexo)
      const key = `${r.clinica_id}__${especie}__${sexo}`
      const valor = mapaTarifas[key] || 0
      const totalPagado = (detallesPorRegistro[r.id] || []).reduce((acc, d) => acc + toNumber(d.monto_total), 0)
      const saldo = Math.max(valor - totalPagado, 0)

      return {
        "Fecha cirugía real": fechaSolo(r.fecha_cirugia_realizada),
        "Fecha programada": r.fecha_programada || "",
        "Clínica": r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica",
        "Código": r.codigo || "",
        "Animal": r.nombre_animal || "",
        "Especie": r.especie || "",
        "Sexo": r.sexo || "",
        "Estado clínica": r.estado_clinica || "",
        "Valor unitario": valor.toFixed(2),
        "Pagado acumulado": totalPagado.toFixed(2),
        "Saldo pendiente": saldo.toFixed(2),
      }
    })
  }

  function exportarPendientesCSV() {
    const filas = construirDetalleRows()
    descargarCSV("pagos_clinicas_detalle.csv", filas)
  }

  function exportarPendientesExcel() {
    if (!registrosBase.length) {
      alert("No hay datos para exportar.")
      return
    }

    const wb = XLSX.utils.book_new()

    const subtitulo = `Período: ${fechaInicio} a ${fechaFin} | Tipo: ${periodoTipo} | Clínica: ${
      clinicaFiltro ? mapaClinicas[clinicaFiltro] || clinicaFiltro : "Todas las clínicas"
    }`

    const hojaResumen = [
      { Indicador: "Tipo de período", Valor: periodoTipo },
      { Indicador: "Fecha inicial", Valor: fechaInicio },
      { Indicador: "Fecha final", Valor: fechaFin },
      {
        Indicador: "Clínica filtro",
        Valor: clinicaFiltro ? mapaClinicas[clinicaFiltro] || clinicaFiltro : "Todas las clínicas",
      },
      { Indicador: "Perro macho", Valor: resumenGeneral.perro_macho },
      { Indicador: "Perra hembra", Valor: resumenGeneral.perra_hembra },
      { Indicador: "Gato macho", Valor: resumenGeneral.gato_macho },
      { Indicador: "Gata hembra", Valor: resumenGeneral.gata_hembra },
      { Indicador: "Total animales", Valor: resumenGeneral.total_animales },
      { Indicador: "Total generado", Valor: resumenGeneral.total_generado.toFixed(2) },
      { Indicador: "Total pagado", Valor: resumenGeneral.total_pagado_periodo.toFixed(2) },
      { Indicador: "Saldo pendiente", Valor: resumenGeneral.total_pagar.toFixed(2) },
      { Indicador: "Observación", Valor: observacionGlobal || "" },
    ]

    const hojaClinicas = resumenPorClinica.map((c) => ({
      "Clínica": c.clinica,
      "Perro macho": c.perro_macho,
      "Perra hembra": c.perra_hembra,
      "Gato macho": c.gato_macho,
      "Gata hembra": c.gata_hembra,
      "Total animales": c.total_animales,
      "Total generado": c.total_generado.toFixed(2),
      "Total pagado": c.total_pagado_periodo.toFixed(2),
      "Saldo pendiente": c.total_pagar.toFixed(2),
      "Último pago": c.ultimo_pago || "",
    }))

    const hojaDetalle = construirDetalleRows()

    const wsResumen = prepararHojaConTitulo("Pagos a Clínicas — Resumen", subtitulo, hojaResumen)
    const wsClinicas = prepararHojaConTitulo("Pagos a Clínicas — Por clínica", subtitulo, hojaClinicas)
    const wsDetalle = prepararHojaConTitulo("Pagos a Clínicas — Detalle", subtitulo, hojaDetalle)

    wsResumen["!cols"] = autoWidthFromRows(hojaResumen)
    wsClinicas["!cols"] = autoWidthFromRows(hojaClinicas)
    wsDetalle["!cols"] = autoWidthFromRows(hojaDetalle)

    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen")
    XLSX.utils.book_append_sheet(wb, wsClinicas, "Por clínica")
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle")

    XLSX.writeFile(wb, `pagos_clinicas_${fechaInicio}_a_${fechaFin}.xlsx`)
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
              onClick={() => setMostrarModalHonorario(true)}
              className="bg-[#0F6D6A] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#0c5a58] transition"
            >
              + Ingreso manual
            </button>

            <button
             onClick={async () => {
  await exportarExcelPro({
    resumen: resumenGeneral,
    porClinica: resumenPorClinica.map((c) => ({
      clinica: c.clinica,
      perro_macho: c.perro_macho,
      perra_hembra: c.perra_hembra,
      gato_macho: c.gato_macho,
      gata_hembra: c.gata_hembra,
      total_animales: c.total_animales,
      total_generado: c.total_generado,
      total_pagado_periodo: c.total_pagado_periodo,
      total_pagar: c.total_pagar,
    })),
    detalle: construirDetalleRows(),
    fechaInicio,
    fechaFin,
  })
}}
              className="bg-[#F47C2A] text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90 transition"
            >
              Exportar Excel
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

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Perro macho</p>
            <p className="text-[2rem] leading-none font-bold text-[#0F6D6A]">{resumenGeneral.perro_macho}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Perra hembra</p>
            <p className="text-[2rem] leading-none font-bold text-[#0F6D6A]">{resumenGeneral.perra_hembra}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Gato macho</p>
            <p className="text-[2rem] leading-none font-bold text-[#0F6D6A]">{resumenGeneral.gato_macho}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Gata hembra</p>
            <p className="text-[2rem] leading-none font-bold text-[#0F6D6A]">{resumenGeneral.gata_hembra}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Total generado</p>
            <p className="text-[2rem] leading-tight font-bold text-[#0F6D6A] break-words">
              {formatearMoneda(resumenGeneral.total_generado)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Total pagado</p>
            <p className="text-[2rem] leading-tight font-bold text-emerald-600 break-words">
              {formatearMoneda(resumenGeneral.total_pagado_periodo)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 min-h-[110px] flex flex-col justify-between">
            <p className="text-sm text-gray-500 font-semibold">Saldo pendiente</p>
            <p className="text-[2rem] leading-tight font-bold text-[#F47C2A] break-words">
              {formatearMoneda(resumenGeneral.total_pagar)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0F6D6A]">
                Honorarios veterinarios externos
              </h2>
              <p className="text-sm text-gray-500">
                Procedimientos manuales fuera del flujo normal de esterilización
              </p>
            </div>

            <button
              onClick={() => setMostrarModalHonorario(true)}
              className="bg-[#F47C2A] text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90 transition"
            >
              Registrar ingreso manual
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-gray-500 font-semibold">Registros</p>
              <p className="text-[2rem] leading-none font-bold text-[#0F6D6A]">
                {resumenHonorarios.cantidad}
              </p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm text-gray-500 font-semibold">Total</p>
              <p className="text-[2rem] leading-tight font-bold text-[#0F6D6A] break-words">
                {formatearMoneda(resumenHonorarios.total)}
              </p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm text-gray-500 font-semibold">Pagado</p>
              <p className="text-[2rem] leading-tight font-bold text-emerald-600 break-words">
                {formatearMoneda(resumenHonorarios.pagado)}
              </p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm text-gray-500 font-semibold">Pendiente</p>
              <p className="text-[2rem] leading-tight font-bold text-[#F47C2A] break-words">
                {formatearMoneda(resumenHonorarios.pendiente)}
              </p>
            </div>
          </div>

          {honorariosFiltrados.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Clínica</th>
                    <th className="py-2 pr-3">Concepto</th>
                    <th className="py-2 pr-3">Animal</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {honorariosFiltrados.slice(0, 6).map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">{fechaSolo(item.fecha)}</td>
                      <td className="py-3 pr-3">
                        {item.clinica_nombre || (item.clinica_id ? mapaClinicas[item.clinica_id] || "Sin clínica" : "Sin clínica")}
                      </td>
                      <td className="py-3 pr-3">{item.concepto}</td>
                      <td className="py-3 pr-3">{item.nombre_animal || "-"}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          normalizarEstado(item.estado_pago) === "pagado"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {item.estado_pago || "pendiente"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold">
                        {formatearMoneda(item.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
              No hay honorarios externos registrados para el período seleccionado.
            </div>
          )}
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
                  Último pago: {clinica.ultimo_pago || "Sin pagos"}
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
                <p className="text-sm text-gray-600">
                  Total generado: {formatearMoneda(clinica.total_generado)}
                </p>
                <p className="text-sm text-emerald-600 font-semibold">
                  Pagado acumulado: {formatearMoneda(clinica.total_pagado_periodo)}
                </p>
                <p className="text-lg font-bold text-[#F47C2A]">
                  Saldo pendiente: {formatearMoneda(clinica.total_pagar)}
                </p>
              </div>

              <button
                onClick={() => pagarClinica(clinica.clinica_id)}
                disabled={procesando || clinica.total_pagar <= 0}
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

        {mostrarModalHonorario && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">
                    Registrar honorario externo
                  </h2>
                  <p className="text-sm text-gray-500">
                    Procedimiento manual fuera del flujo normal de esterilización
                  </p>
                </div>

                <button
                  onClick={() => setMostrarModalHonorario(false)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-600 hover:bg-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Clínica registrada
                  </label>
                  <select
                    value={honClinicaId}
                    onChange={(e) => setHonClinicaId(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  >
                    <option value="">Seleccionar clínica</option>
                    {clinicas.map((clinica) => (
                      <option key={clinica.id} value={clinica.id}>
                        {clinica.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    O nombre manual de clínica
                  </label>
                  <input
                    type="text"
                    value={honClinicaNombre}
                    onChange={(e) => setHonClinicaNombre(e.target.value)}
                    placeholder="Ej: Clínica externa / particular"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={honFecha}
                    onChange={(e) => setHonFecha(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Monto
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={honMonto}
                    onChange={(e) => setHonMonto(e.target.value)}
                    placeholder="Ej: 300"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Concepto
                  </label>
                  <input
                    type="text"
                    value={honConcepto}
                    onChange={(e) => setHonConcepto(e.target.value)}
                    placeholder="Ej: cirugía de traumatismo"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Especie
                  </label>
                  <input
                    type="text"
                    value={honEspecie}
                    onChange={(e) => setHonEspecie(e.target.value)}
                    placeholder="Ej: gato"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre del animal
                  </label>
                  <input
                    type="text"
                    value={honNombreAnimal}
                    onChange={(e) => setHonNombreAnimal(e.target.value)}
                    placeholder="Ej: gatito de la calle"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado de pago
                  </label>
                  <select
                    value={honEstadoPago}
                    onChange={(e) => setHonEstadoPago(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  >
                    <option value="pagado">Pagado</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha de pago
                  </label>
                  <input
                    type="date"
                    value={honFechaPago}
                    onChange={(e) => setHonFechaPago(e.target.value)}
                    disabled={honEstadoPago !== "pagado"}
                    className="w-full border rounded-xl px-4 py-3 disabled:bg-gray-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observación
                  </label>
                  <textarea
                    value={honObservacion}
                    onChange={(e) => setHonObservacion(e.target.value)}
                    placeholder="Opcional"
                    rows={3}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setMostrarModalHonorario(false)}
                  className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>

                <button
                  onClick={registrarHonorario}
                  disabled={guardandoHonorario}
                  className="px-5 py-3 rounded-xl bg-[#F47C2A] text-white font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  {guardandoHonorario ? "Guardando..." : "Guardar ingreso manual"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
