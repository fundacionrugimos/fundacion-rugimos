"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import ExcelJS from "exceljs"

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
  fecha_cirugia_realizada?: string | null
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

function fechaSolo(valor?: string | null) {
  return valor ? valor.slice(0, 10) : ""
}

function normalizarTexto(valor?: string | null) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function normalizarLabel(valor?: string | null) {
  const v = normalizarTexto(valor)
  if (v === "perro") return "Perro"
  if (v === "gato") return "Gato"
  if (v === "macho") return "Macho"
  if (v === "hembra") return "Hembra"
  return valor || ""
}

function hoyLocalISO() {
  const ahora = new Date()
  const offset = ahora.getTimezoneOffset()
  const local = new Date(ahora.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function esEstadoDescartadoParaAgenda(registro: Registro) {
  const estadoClinica = normalizarTexto(registro.estado_clinica)
  const estadoCita = normalizarTexto(registro.estado_cita)

  return (
    estadoClinica === "reprogramado" ||
    estadoClinica === "rechazado" ||
    estadoClinica === "no apto" ||
    estadoClinica === "fallecido" ||
    estadoClinica === "fallecio" ||
    estadoCita === "cancelado" ||
    estadoCita === "rechazado" ||
    estadoCita === "fallecido" ||
    estadoCita === "fallecio"
  )
}

function obtenerCorteDomingo(dataStr: string) {
  const [ano, mes, dia] = dataStr.split("-").map(Number)
  const data = new Date(ano, mes - 1, dia)
  const diaSemana = data.getDay()
  if (diaSemana !== 0) {
    data.setDate(data.getDate() + (7 - diaSemana))
  }

  const yyyy = data.getFullYear()
  const mm = String(data.getMonth() + 1).padStart(2, "0")
  const dd = String(data.getDate()).padStart(2, "0")

  return {
    orden: `${yyyy}-${mm}-${dd}`,
    label: `${dd}/${mm}`,
  }
}

function esAptoFinanciero(registro: Registro) {
  return (
    normalizarTexto(registro.estado_clinica) === "apto" &&
    Boolean(registro.fecha_cirugia_realizada)
  )
}

function esNoShow(registro: Registro) {
  const estadoClinica = normalizarTexto(registro.estado_clinica)
  const estadoCita = normalizarTexto(registro.estado_cita)

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
  const encabezado = [[titulo], [subtitulo], []]
  const ws = XLSX.utils.aoa_to_sheet(encabezado)

  if (filas.length > 0) {
    XLSX.utils.sheet_add_json(ws, filas, { origin: "A4" })
  } else {
    XLSX.utils.sheet_add_aoa(ws, [["No hay datos para exportar."]], { origin: "A4" })
  }

  return ws
}


async function agregarLogoSiExiste(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  try {
    const response = await fetch("/logo.png")
    if (!response.ok) return

    const blob = await response.blob()

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === "string") {
          resolve(result)
        } else {
          reject(new Error("No se pudo convertir el logo."))
        }
      }
      reader.onerror = () => reject(new Error("No se pudo leer el logo."))
      reader.readAsDataURL(blob)
    })

    const logoId = workbook.addImage({
      base64,
      extension: "png",
    })

    ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 70 },
    })
  } catch (error) {
    console.log("Logo no cargado:", error)
  }
}

function descargarExcelBuffer(bufferFinal: ArrayBuffer | Uint8Array, nombreArchivo: string) {
  const blob = new Blob(
    [bufferFinal instanceof ArrayBuffer ? bufferFinal : new Uint8Array(bufferFinal)],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function aplicarEstiloCabecera(row: ExcelJS.Row, color: string) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    }
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    }
  })
}

function aplicarEstiloFila(row: ExcelJS.Row, zebra = false) {
  row.eachCell((cell) => {
    if (zebra) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      }
    }
    cell.alignment = { vertical: "middle", horizontal: "left" }
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    }
  })
}

function GraficoLineaFinanciera({
  data,
}: {
  data: Array<{
    periodo: string
    generado: number
    pagado: number
    pendiente: number
  }>
}) {
  if (!data.length) {
    return <p className="text-gray-500">No hay datos para el período seleccionado.</p>
  }

  const width = 1000
  const height = 260
  const paddingTop = 20
  const paddingRight = 24
  const paddingBottom = 44
  const paddingLeft = 56

  const innerWidth = width - paddingLeft - paddingRight
  const innerHeight = height - paddingTop - paddingBottom

  const maxY = Math.max(
    1,
    ...data.flatMap((item) => [item.generado, item.pagado, item.pendiente])
  )

  const yTicks = 5
  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft + (index * innerWidth) / (data.length - 1)

    const yGenerado = paddingTop + innerHeight - (item.generado / maxY) * innerHeight
    const yPagado = paddingTop + innerHeight - (item.pagado / maxY) * innerHeight
    const yPendiente = paddingTop + innerHeight - (item.pendiente / maxY) * innerHeight

    return { ...item, x, yGenerado, yPagado, yPendiente }
  })

  const polyline = (key: "yGenerado" | "yPagado" | "yPendiente") =>
    points.map((p) => `${p.x},${p[key]}`).join(" ")

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[720px] h-[260px]"
        role="img"
        aria-label="Gráfico de evolución financiera"
      >
        {Array.from({ length: yTicks + 1 }).map((_, index) => {
          const value = (maxY / yTicks) * (yTicks - index)
          const y = paddingTop + (innerHeight * index) / yTicks

          return (
            <g key={index}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#6B7280"
              >
                {`Bs ${value.toFixed(0)}`}
              </text>
            </g>
          )
        })}

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + innerHeight}
          stroke="#9CA3AF"
          strokeWidth="1.2"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + innerHeight}
          x2={width - paddingRight}
          y2={paddingTop + innerHeight}
          stroke="#9CA3AF"
          strokeWidth="1.2"
        />

        <polyline
          fill="none"
          stroke="#F47C3C"
          strokeWidth="3"
          points={polyline("yGenerado")}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          fill="none"
          stroke="#16A34A"
          strokeWidth="3"
          points={polyline("yPagado")}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          fill="none"
          stroke="#DC2626"
          strokeWidth="3"
          points={polyline("yPendiente")}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, index) => (
          <g key={index}>
            <circle cx={p.x} cy={p.yGenerado} r="4.5" fill="#F47C3C" />
            <circle cx={p.x} cy={p.yPagado} r="4.5" fill="#16A34A" />
            <circle cx={p.x} cy={p.yPendiente} r="4.5" fill="#DC2626" />
            <text
              x={p.x}
              y={height - 16}
              textAnchor="middle"
              fontSize="11"
              fill="#374151"
            >
              {p.periodo}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-[3px] bg-[#F47C3C] rounded-full" />
          Generado
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-[3px] bg-green-600 rounded-full" />
          Pagado
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-[3px] bg-red-600 rounded-full" />
          Pendiente
        </div>
      </div>
    </div>
  )
}

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

  try {
    const [
      clinicasData,
      registrosData,
      tarifasData,
      pagosData,
      detallesData,
    ] = await Promise.all([
      fetchAllRows<Clinica>(
        "clinicas",
        "id,nome",
        (q) => q.order("nome", { ascending: true })
      ),

      fetchAllRows<Registro>(
        "registros",
        "id,codigo,clinica_id,especie,sexo,tipo_animal,nombre_animal,pagado,fecha_pago,fecha_programada,fecha_cirugia_realizada,estado_clinica,estado_cita"
      ),

      fetchAllRows<TarifaClinica>(
        "tarifas_clinica",
        "id,clinica_id,especie,sexo,valor,activo",
        (q) => q.eq("activo", true)
      ),

      fetchAllRows<PagoClinica>(
        "pagos_clinica",
        "id,clinica_id,fecha_pago,periodo_tipo,fecha_inicio,fecha_fin,cantidad_animales,monto_total,observacion,registrado_por,created_at",
        (q) => q.order("fecha_pago", { ascending: false })
      ),

      fetchAllRows<PagoDetalle>(
        "pagos_clinica_detalle",
        "id,pago_id,registro_id,monto_unitario,monto_total,created_at"
      ),
    ])

    setClinicas(clinicasData)
    setRegistros(registrosData)

    setTarifas(
      tarifasData.map((t) => ({
        ...t,
        valor: toNumber(t.valor),
      }))
    )

    setPagos(
      pagosData.map((p) => ({
        ...p,
        monto_total: toNumber(p.monto_total),
      }))
    )

    setDetalles(
      detalhesOrdenados(
        detallesData.map((d) => ({
          ...d,
          monto_unitario: toNumber(d.monto_unitario),
          monto_total: toNumber(d.monto_total),
        }))
      )
    )
  } catch (error) {
    console.log("Error cargando informe de contabilidad:", error)
    alert("No se pudo cargar el informe de contabilidad.")
  } finally {
    setCargando(false)
  }
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

  const mapaDetallePorRegistro = useMemo(() => {
    const mapa: Record<string, PagoDetalle> = {}
    detalhesOrdenados(detalles).forEach((d) => {
      mapa[d.registro_id] = d
    })
    return mapa
  }, [detalles])

  const especiesDisponibles = useMemo(() => {
    return Array.from(
      new Set(registros.map((r) => normalizarLabel(r.especie)).filter(Boolean))
    ).sort()
  }, [registros])

  const tiposAnimalDisponibles = useMemo(() => {
    return Array.from(
      new Set(registros.map((r) => (r.tipo_animal || "").trim()).filter(Boolean))
    ).sort()
  }, [registros])

  const registrosBasePeriodo = useMemo(() => {
    return registros.filter((r) => {
      const fechaCirugia = fechaSolo(r.fecha_cirugia_realizada)
      if (!fechaCirugia) return false
      if (fechaInicio && fechaCirugia < fechaInicio) return false
      if (fechaFin && fechaCirugia > fechaFin) return false
      if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false
      if (especieFiltro && normalizarLabel(r.especie) !== especieFiltro) return false
      if (tipoAnimalFiltro && (r.tipo_animal || "") !== tipoAnimalFiltro) return false
      return true
    })
  }, [registros, fechaInicio, fechaFin, clinicaFiltro, especieFiltro, tipoAnimalFiltro])

  const registrosAgendaPeriodo = useMemo(() => {
    return registros.filter((r) => {
      const fechaProgramada = fechaSolo(r.fecha_programada)
      if (!fechaProgramada) return false
      if (fechaInicio && fechaProgramada < fechaInicio) return false
      if (fechaFin && fechaProgramada > fechaFin) return false
      if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false
      if (especieFiltro && normalizarLabel(r.especie) !== especieFiltro) return false
      if (tipoAnimalFiltro && (r.tipo_animal || "") !== tipoAnimalFiltro) return false
      return true
    })
  }, [registros, fechaInicio, fechaFin, clinicaFiltro, especieFiltro, tipoAnimalFiltro])

  const registrosAptos = useMemo(() => {
    return registrosBasePeriodo.filter((r) => esAptoFinanciero(r))
  }, [registrosBasePeriodo])

  const registrosNoShow = useMemo(() => {
    const hoy = hoyLocalISO()

    return registrosAgendaPeriodo.filter((r) => {
      const fechaProgramada = fechaSolo(r.fecha_programada)
      if (!fechaProgramada) return false
      if (esAptoFinanciero(r)) return false
      if (esEstadoDescartadoParaAgenda(r)) return false

      return esNoShow(r) || fechaProgramada < hoy
    })
  }, [registrosAgendaPeriodo])

  const registrosProgramadosPendientes = useMemo(() => {
    const hoy = hoyLocalISO()

    return registrosAgendaPeriodo.filter((r) => {
      const fechaProgramada = fechaSolo(r.fecha_programada)
      if (!fechaProgramada) return false
      if (esAptoFinanciero(r)) return false
      if (esNoShow(r)) return false
      if (esEstadoDescartadoParaAgenda(r)) return false

      return fechaProgramada >= hoy
    })
  }, [registrosAgendaPeriodo])

  const filasDetalle = useMemo(() => {
    return registrosAptos
      .map((r) => {
        const especieKey = normalizarTexto(r.especie)
        const sexoKey = normalizarTexto(r.sexo)
        const key = `${r.clinica_id}__${especieKey}__${sexoKey}`
        const tarifa = mapaTarifas[key] || 0

        const detalle = mapaDetallePorRegistro[r.id]
        const pago = detalle ? mapaPagoPorId[detalle.pago_id] : null
        const estadoFinanciero: "PAGADO" | "PENDIENTE" = detalle && pago ? "PAGADO" : "PENDIENTE"

        return {
          registro_id: r.id,
          codigo: r.codigo || "",
          fecha_cirugia: fechaSolo(r.fecha_cirugia_realizada),
          fecha_pago: pago?.fecha_pago?.slice(0, 10) || (r.fecha_pago ? r.fecha_pago.slice(0, 10) : ""),
          clinica: r.clinica_id ? mapaClinicas[r.clinica_id] || "Sin clínica" : "Sin clínica",
          animal: r.nombre_animal || "",
          especie: normalizarLabel(r.especie),
          sexo: normalizarLabel(r.sexo),
          tipo_animal: r.tipo_animal || "",
          valor_unitario: detalle ? detalle.monto_unitario : tarifa,
          valor_total: detalle ? detalle.monto_total : tarifa,
          estado_financiero: estadoFinanciero,
          observacion: pago?.observacion || "",
        }
      })
      .filter((f) => {
        if (estadoFiltro && f.estado_financiero !== estadoFiltro) return false
        return true
      })
  }, [registrosAptos, estadoFiltro, mapaTarifas, mapaDetallePorRegistro, mapaPagoPorId, mapaClinicas])

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
      filasDetalle.filter((f) => f.estado_financiero === "PENDIENTE").map((f) => f.clinica)
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
     programadosNoCerrados: registros.filter((r) => {
  const fechaProgramada = fechaSolo(r.fecha_programada)
  if (!fechaProgramada) return false

  if (fechaInicio && fechaProgramada < fechaInicio) return false
  if (fechaFin && fechaProgramada > fechaFin) return false
  if (clinicaFiltro && r.clinica_id !== clinicaFiltro) return false
  if (especieFiltro && normalizarLabel(r.especie) !== especieFiltro) return false
  if (tipoAnimalFiltro && (r.tipo_animal || "") !== tipoAnimalFiltro) return false

  const estadoClinica = normalizarTexto(r.estado_clinica)
  const estadoCita = normalizarTexto(r.estado_cita)

  return (
    estadoClinica !== "apto" &&
    estadoClinica !== "no show" &&
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
  }, [
  filasDetalle,
  registrosNoShow,
  registrosProgramadosPendientes,
  registros,
  fechaInicio,
  fechaFin,
  clinicaFiltro,
  especieFiltro,
  tipoAnimalFiltro,
])

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
        perro_macho: number
        perra_hembra: number
        gato_macho: number
        gata_hembra: number
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
          perro_macho: 0,
          perra_hembra: 0,
          gato_macho: 0,
          gata_hembra: 0,
        }
      }

      mapa[f.clinica].animales += 1
      mapa[f.clinica].bruto += f.valor_total
      if (f.estado_financiero === "PAGADO") mapa[f.clinica].pagado += f.valor_total
      if (f.estado_financiero === "PENDIENTE") mapa[f.clinica].pendiente += f.valor_total

      const especie = normalizarTexto(f.especie)
      const sexo = normalizarTexto(f.sexo)
      if (especie === "perro" && sexo === "macho") mapa[f.clinica].perro_macho += 1
      if (especie === "perro" && sexo === "hembra") mapa[f.clinica].perra_hembra += 1
      if (especie === "gato" && sexo === "macho") mapa[f.clinica].gato_macho += 1
      if (especie === "gato" && sexo === "hembra") mapa[f.clinica].gata_hembra += 1

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
        orden: string
      }
    > = {}

    filasDetalle.forEach((f) => {
      let chave = f.fecha_cirugia
      let orden = f.fecha_cirugia

      if (tipoPeriodo === "diario") {
        const [yyyy, mm, dd] = f.fecha_cirugia.split("-")
        chave = `${dd}/${mm}`
        orden = `${yyyy}-${mm}-${dd}`
      } else if (tipoPeriodo === "mensual" || tipoPeriodo === "semanal" || tipoPeriodo === "personalizado") {
        const corte = obtenerCorteDomingo(f.fecha_cirugia)
        chave = corte.label
        orden = corte.orden
      }

      if (!mapa[chave]) {
        mapa[chave] = {
          periodo: chave,
          animales: 0,
          generado: 0,
          pagado: 0,
          pendiente: 0,
          orden,
        }
      }

      mapa[chave].animales += 1
      mapa[chave].generado += f.valor_total
      if (f.estado_financiero === "PAGADO") mapa[chave].pagado += f.valor_total
      if (f.estado_financiero === "PENDIENTE") mapa[chave].pendiente += f.valor_total
    })

    return Object.values(mapa).sort((a, b) => a.orden.localeCompare(b.orden))
  }, [filasDetalle, tipoPeriodo])



  const resumenEspecies = useMemo(() => {
    let perro_macho = 0
    let perro_hembra = 0
    let gato_macho = 0
    let gato_hembra = 0

    filasDetalle.forEach((f) => {
      const especie = normalizarTexto(f.especie)
      const sexo = normalizarTexto(f.sexo)

      if (especie === "perro" && sexo === "macho") perro_macho += 1
      if (especie === "perro" && sexo === "hembra") perro_hembra += 1
      if (especie === "gato" && sexo === "macho") gato_macho += 1
      if (especie === "gato" && sexo === "hembra") gato_hembra += 1
    })

    return { perro_macho, perro_hembra, gato_macho, gato_hembra }
  }, [filasDetalle])

  const subtituloReporte = useMemo(() => {
    const clinicaTexto = clinicaFiltro ? mapaClinicas[clinicaFiltro] || clinicaFiltro : "Todas las clínicas"
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
      { Indicador: "Perro macho", Valor: resumenEspecies.perro_macho },
      { Indicador: "Perra hembra", Valor: resumenEspecies.perro_hembra },
      { Indicador: "Gato macho", Valor: resumenEspecies.gato_macho },
      { Indicador: "Gata hembra", Valor: resumenEspecies.gato_hembra },
    ]
  }, [resumen, resumenEspecies])

  const resumenClinicasRows = useMemo(() => {
    const rows = porClinica.map((item) => ({
      "Clínica": item.clinica,
      "Animales": item.animales,
      "Perro macho": item.perro_macho,
      "Perra hembra": item.perra_hembra,
      "Gato macho": item.gato_macho,
      "Gata hembra": item.gata_hembra,
      "Bruto (Bs)": item.bruto.toFixed(2),
      "Pagado (Bs)": item.pagado.toFixed(2),
      "Pendiente (Bs)": item.pendiente.toFixed(2),
      "Último pago": item.ultimoPago || "-",
    }))

    if (rows.length > 0) {
      rows.push({
        "Clínica": "TOTAL",
        "Animales": porClinica.reduce((acc, item) => acc + item.animales, 0),
        "Perro macho": porClinica.reduce((acc, item) => acc + item.perro_macho, 0),
        "Perra hembra": porClinica.reduce((acc, item) => acc + item.perra_hembra, 0),
        "Gato macho": porClinica.reduce((acc, item) => acc + item.gato_macho, 0),
        "Gata hembra": porClinica.reduce((acc, item) => acc + item.gata_hembra, 0),
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
      "Fecha cirugía real": f.fecha_cirugia,
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
        "Fecha cirugía real": "",
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

  async function exportarExcelCompleto() {
    if (!filasDetalle.length) {
      alert("No hay datos para exportar.")
      return
    }

    const workbook = new ExcelJS.Workbook()
    const verde = "FF0F6D6A"
    const naranja = "FFF47C3C"

    const wsResumen = workbook.addWorksheet("Resumen general", {
      views: [{ state: "frozen", ySplit: 6 }],
    })

    await agregarLogoSiExiste(workbook, wsResumen)

    wsResumen.mergeCells("B1:F1")
    wsResumen.getCell("B1").value = "Informe de Contabilidad"
    wsResumen.getCell("B1").font = { size: 18, bold: true, color: { argb: verde } }

    wsResumen.mergeCells("B2:F2")
    wsResumen.getCell("B2").value = subtituloReporte

    const headerResumen = wsResumen.getRow(6)
    headerResumen.values = ["Indicador", "Valor"]
    aplicarEstiloCabecera(headerResumen, verde)

    resumenGeneralRows.forEach((row, index) => {
      const nueva = wsResumen.addRow([row.Indicador, row.Valor])
      aplicarEstiloFila(nueva, index % 2 === 0)
    })

    wsResumen.columns = [
      { width: 30 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ]

    const wsClinicas = workbook.addWorksheet("Por clínica", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    await agregarLogoSiExiste(workbook, wsClinicas)

    const headersClinicas = Object.keys(resumenClinicasRows[0] || {})
    wsClinicas.mergeCells(1, 2, 1, Math.max(headersClinicas.length, 2))
    wsClinicas.getCell(1, 2).value = "Resumen por Clínica"
    wsClinicas.getCell(1, 2).font = { size: 18, bold: true, color: { argb: verde } }
    wsClinicas.mergeCells(2, 2, 2, Math.max(headersClinicas.length, 2))
    wsClinicas.getCell(2, 2).value = subtituloReporte

    const cabClinicas = wsClinicas.getRow(4)
    cabClinicas.values = headersClinicas
    aplicarEstiloCabecera(cabClinicas, verde)

    resumenClinicasRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = wsClinicas.addRow(headersClinicas.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    wsClinicas.columns = headersClinicas.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 22),
    }))

    const wsPeriodos = workbook.addWorksheet("Por período", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    await agregarLogoSiExiste(workbook, wsPeriodos)

    const headersPeriodos = Object.keys(resumenPeriodosRows[0] || {})
    wsPeriodos.mergeCells(1, 2, 1, Math.max(headersPeriodos.length, 2))
    wsPeriodos.getCell(1, 2).value = "Resumen por Período"
    wsPeriodos.getCell(1, 2).font = { size: 18, bold: true, color: { argb: verde } }
    wsPeriodos.mergeCells(2, 2, 2, Math.max(headersPeriodos.length, 2))
    wsPeriodos.getCell(2, 2).value = subtituloReporte

    const cabPeriodos = wsPeriodos.getRow(4)
    cabPeriodos.values = headersPeriodos
    aplicarEstiloCabecera(cabPeriodos, verde)

    resumenPeriodosRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = wsPeriodos.addRow(headersPeriodos.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    wsPeriodos.columns = headersPeriodos.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 22),
    }))

    const wsDetalle = workbook.addWorksheet("Detalle financiero", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    await agregarLogoSiExiste(workbook, wsDetalle)

    const headersDetalle = Object.keys(detalleRows[0] || {})
    wsDetalle.mergeCells(1, 2, 1, Math.max(headersDetalle.length, 2))
    wsDetalle.getCell(1, 2).value = "Detalle Financiero"
    wsDetalle.getCell(1, 2).font = { size: 18, bold: true, color: { argb: verde } }
    wsDetalle.mergeCells(2, 2, 2, Math.max(headersDetalle.length, 2))
    wsDetalle.getCell(2, 2).value = subtituloReporte

    const cabDetalle = wsDetalle.getRow(4)
    cabDetalle.values = headersDetalle
    aplicarEstiloCabecera(cabDetalle, naranja)

    detalleRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = wsDetalle.addRow(headersDetalle.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    wsDetalle.columns = headersDetalle.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 24),
    }))

    const bufferFinal = await workbook.xlsx.writeBuffer()
    descargarExcelBuffer(bufferFinal, `informe_contabilidad_completo_${fechaInicio}_a_${fechaFin}.xlsx`)
  }

  async function exportarExcelResumenClinicas() {
    if (!resumenClinicasRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet("Resumen por clínica", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    const verde = "FF0F6D6A"

    await agregarLogoSiExiste(workbook, ws)

    ws.mergeCells("B1:J1")
    ws.getCell("B1").value = "Resumen por Clínica"
    ws.getCell("B1").font = { size: 18, bold: true, color: { argb: verde } }

    ws.mergeCells("B2:J2")
    ws.getCell("B2").value = subtituloReporte

    const headers = Object.keys(resumenClinicasRows[0])
    const headerRow = ws.getRow(4)
    headerRow.values = headers
    aplicarEstiloCabecera(headerRow, verde)

    resumenClinicasRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = ws.addRow(headers.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 22),
    }))

    const bufferFinal = await workbook.xlsx.writeBuffer()
    descargarExcelBuffer(bufferFinal, `resumen_clinicas_${fechaInicio}_a_${fechaFin}.xlsx`)
  }

  async function exportarExcelResumenPeriodos() {
    if (!resumenPeriodosRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet("Resumen por período", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    const verde = "FF0F6D6A"

    await agregarLogoSiExiste(workbook, ws)

    ws.mergeCells("B1:F1")
    ws.getCell("B1").value = "Resumen por Período"
    ws.getCell("B1").font = { size: 18, bold: true, color: { argb: verde } }

    ws.mergeCells("B2:F2")
    ws.getCell("B2").value = subtituloReporte

    const headers = Object.keys(resumenPeriodosRows[0])
    const headerRow = ws.getRow(4)
    headerRow.values = headers
    aplicarEstiloCabecera(headerRow, verde)

    resumenPeriodosRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = ws.addRow(headers.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 22),
    }))

    const bufferFinal = await workbook.xlsx.writeBuffer()
    descargarExcelBuffer(bufferFinal, `resumen_periodos_${fechaInicio}_a_${fechaFin}.xlsx`)
  }

  async function exportarExcelDetalleFinanciero() {
    if (!detalleRows.length) {
      alert("No hay datos para exportar.")
      return
    }

    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet("Detalle financiero", {
      views: [{ state: "frozen", ySplit: 4 }],
    })

    const verde = "FF0F6D6A"
    const naranja = "FFF47C3C"

    await agregarLogoSiExiste(workbook, ws)

    const headers = Object.keys(detalleRows[0])

    ws.mergeCells(1, 2, 1, headers.length)
    ws.getCell(1, 2).value = "Detalle Financiero"
    ws.getCell(1, 2).font = { size: 18, bold: true, color: { argb: verde } }

    ws.mergeCells(2, 2, 2, headers.length)
    ws.getCell(2, 2).value = subtituloReporte

    const headerRow = ws.getRow(4)
    headerRow.values = headers
    aplicarEstiloCabecera(headerRow, naranja)

    detalleRows.forEach((item, index) => {
      const rowData = item as Record<string, string | number>
      const row = ws.addRow(headers.map((h) => rowData[h] ?? ""))
      aplicarEstiloFila(row, index % 2 === 0)
    })

    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.min(Math.max(h.length + 4, 14), 24),
    }))

    const bufferFinal = await workbook.xlsx.writeBuffer()
    descargarExcelBuffer(bufferFinal, `detalle_financiero_${fechaInicio}_a_${fechaFin}.xlsx`)
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
            <h1 className="text-3xl md:text-4xl font-bold text-white">Informe de contabilidad</h1>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de período</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha inicial</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha final</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Clínica</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado financiero</label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Especie</label>
              <select
                value={especieFiltro}
                onChange={(e) => setEspecieFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas</option>
                {especiesDisponibles.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo animal</label>
              <select
                value={tipoAnimalFiltro}
                onChange={(e) => setTipoAnimalFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                {tiposAnimalDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
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
            <p className="text-sm text-gray-500 font-semibold">Perro macho</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.perro_macho}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Perra hembra</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.perro_hembra}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Gato macho</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.gato_macho}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Gata hembra</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">{resumenEspecies.gato_hembra}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-xl font-bold text-[#0F6D6A]">Evolución financiera</h2>

            <button
              onClick={exportarExcelResumenPeriodos}
              className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:opacity-90"
            >
              Excel período
            </button>
          </div>

          <GraficoLineaFinanciera
            data={porPeriodo.map((item) => ({
              periodo: item.periodo,
              generado: item.generado,
              pagado: item.pagado,
              pendiente: item.pendiente,
            }))}
          />
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F6D6A]">Resumen por clínica</h2>

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
                    <th className="py-2 pr-3">P. macho</th>
                    <th className="py-2 pr-3">P. hembra</th>
                    <th className="py-2 pr-3">G. macho</th>
                    <th className="py-2 pr-3">G. hembra</th>
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
                      <td className="py-2 pr-3">{item.perro_macho}</td>
                      <td className="py-2 pr-3">{item.perra_hembra}</td>
                      <td className="py-2 pr-3">{item.gato_macho}</td>
                      <td className="py-2 pr-3">{item.gata_hembra}</td>
                      <td className="py-2 pr-3">{formatearMoneda(item.bruto)}</td>
                      <td className="py-2 pr-3 text-green-600 font-semibold">{formatearMoneda(item.pagado)}</td>
                      <td className="py-2 pr-3 text-red-600 font-semibold">{formatearMoneda(item.pendiente)}</td>
                      <td className="py-2 pr-3">{item.ultimoPago || "-"}</td>
                    </tr>
                  ))}

                  {porClinica.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-gray-500">
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
              <h2 className="text-xl font-bold text-[#0F6D6A]">Resumen por período</h2>

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
            <h2 className="text-xl font-bold text-[#0F6D6A]">Detalle financiero</h2>

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

function detalhesOrdenados(detalles: PagoDetalle[]) {
  return [...detalles].sort((a, b) => {
    const dataA = new Date(a.created_at || 0).getTime()
    const dataB = new Date(b.created_at || 0).getTime()
    return dataB - dataA
  })
}
