import ExcelJS from "exceljs"

type Resumen = {
  perro_macho: number
  perra_hembra: number
  gato_macho: number
  gata_hembra: number
  total_animales: number
  total_generado: number
  total_pagado_periodo: number
  total_pagar: number
}

type ClinicaResumen = {
  clinica: string
  perro_macho: number
  perra_hembra: number
  gato_macho: number
  gata_hembra: number
  total_animales: number
  total_generado: number
  total_pagado_periodo: number
  total_pagar: number
}

type DetalleRow = Record<string, string | number>

async function cargarLogoComoBase64(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar el logo.")
  const blob = await res.blob()

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === "string") {
        const base64 = result.split(",")[1]
        resolve(base64)
      } else {
        reject(new Error("No se pudo convertir el logo a base64."))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function estilizarCabecera(row: ExcelJS.Row, color: string) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    }
    cell.font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
    }
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    }
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    }
  })
}

function estilizarFila(row: ExcelJS.Row, zebra = false) {
  row.eachCell((cell) => {
    if (zebra) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      }
    }
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    }
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    }
  })
}

function aplicarMoneda(cell: ExcelJS.Cell) {
  cell.numFmt = '"Bs" #,##0.00'
}

export async function exportarExcelPro({
  resumen,
  porClinica,
  detalle,
  fechaInicio,
  fechaFin,
}: {
  resumen: Resumen
  porClinica: ClinicaResumen[]
  detalle: DetalleRow[]
  fechaInicio: string
  fechaFin: string
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ChatGPT"
  workbook.company = "Fundación Rugimos"
  workbook.created = new Date()

  const verde = "FF0F6D6A"
  const naranja = "FFF47C2A"

  // =========================
  // RESUMEN
  // =========================
  const ws = workbook.addWorksheet("Resumen", {
    views: [{ state: "frozen", ySplit: 5 }],
  })

  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ]

  try {
    const logoBase64 = await cargarLogoComoBase64("/logo.png")
    const imageId = workbook.addImage({
      base64: logoBase64,
      extension: "png",
    })

    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 110, height: 110 },
    })
  } catch (error) {
    console.log("Logo no cargado:", error)
  }

  ws.mergeCells("B1:F1")
  ws.getCell("B1").value = "Fundación Rugimos"
  ws.getCell("B1").font = { size: 20, bold: true, color: { argb: verde } }

  ws.mergeCells("B2:F2")
  ws.getCell("B2").value = "Informe de pagos a clínicas"
  ws.getCell("B2").font = { size: 12, italic: true }

  ws.mergeCells("B3:F3")
  ws.getCell("B3").value = `Período: ${fechaInicio} a ${fechaFin}`
  ws.getCell("B3").font = { size: 11 }

  const resumenHeader = ws.getRow(6)
  resumenHeader.values = ["Indicador", "Valor"]
  estilizarCabecera(resumenHeader, verde)

  const resumenRows = [
    ["Perro macho", resumen.perro_macho],
    ["Perra hembra", resumen.perra_hembra],
    ["Gato macho", resumen.gato_macho],
    ["Gata hembra", resumen.gata_hembra],
    ["Total animales", resumen.total_animales],
    ["Total generado", resumen.total_generado],
    ["Total pagado", resumen.total_pagado_periodo],
    ["Saldo pendiente", resumen.total_pagar],
  ]

  resumenRows.forEach((item, index) => {
    const row = ws.addRow(item)
    estilizarFila(row, index % 2 === 0)

    if (typeof item[1] === "number" && index >= 5) {
      aplicarMoneda(row.getCell(2))
    }
  })

  // =========================
  // POR CLINICA
  // =========================
  const ws2 = workbook.addWorksheet("Por clínica", {
    views: [{ state: "frozen", ySplit: 4 }],
  })

  ws2.columns = [
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 15 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ]

  ws2.mergeCells("A1:I1")
  ws2.getCell("A1").value = "Pagos a Clínicas — Por clínica"
  ws2.getCell("A1").font = { size: 16, bold: true, color: { argb: verde } }

  ws2.mergeCells("A2:I2")
  ws2.getCell("A2").value = `Período: ${fechaInicio} a ${fechaFin}`

  const header2 = ws2.getRow(4)
  header2.values = [
    "Clínica",
    "Perro macho",
    "Perra hembra",
    "Gato macho",
    "Gata hembra",
    "Total animales",
    "Total generado",
    "Total pagado",
    "Saldo pendiente",
  ]
  estilizarCabecera(header2, verde)

  porClinica.forEach((c, index) => {
    const row = ws2.addRow([
      c.clinica,
      c.perro_macho,
      c.perra_hembra,
      c.gato_macho,
      c.gata_hembra,
      c.total_animales,
      c.total_generado,
      c.total_pagado_periodo,
      c.total_pagar,
    ])

    estilizarFila(row, index % 2 === 0)
    aplicarMoneda(row.getCell(7))
    aplicarMoneda(row.getCell(8))
    aplicarMoneda(row.getCell(9))
  })

  // =========================
  // DETALLE
  // =========================
  const ws3 = workbook.addWorksheet("Detalle", {
    views: [{ state: "frozen", ySplit: 4 }],
  })

  if (detalle.length > 0) {
    const headers = Object.keys(detalle[0])

    ws3.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 14), 24),
    }))

    ws3.mergeCells(1, 1, 1, headers.length)
    ws3.getCell(1, 1).value = "Pagos a Clínicas — Detalle"
    ws3.getCell(1, 1).font = { size: 16, bold: true, color: { argb: verde } }

    ws3.mergeCells(2, 1, 2, headers.length)
    ws3.getCell(2, 1).value = `Período: ${fechaInicio} a ${fechaFin}`

    const headerRow = ws3.getRow(4)
    headerRow.values = headers
    estilizarCabecera(headerRow, naranja)

    detalle.forEach((item, index) => {
      const row = ws3.addRow(headers.map((h) => item[h]))
      estilizarFila(row, index % 2 === 0)
    })
  } else {
    ws3.getCell("A1").value = "No hay datos para exportar."
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob(
    [buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer)],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `pagos_clinicas_pro_${fechaInicio}_a_${fechaFin}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}