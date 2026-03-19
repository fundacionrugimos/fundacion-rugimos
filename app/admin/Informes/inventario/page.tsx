"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type StockAlmacen = {
  id: string
  almacen_id: string
  producto_id: string
  cantidad_actual: number | null
  updated_at: string | null
  cantidad_minima: number | null
}

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  unidad_base: string | null
  controla_stock: boolean | null
  activo: boolean | null
  stock_minimo: number | null
  observaciones: string | null
  created_at: string | null
}

type Almacen = {
  id: string
  nombre: string
  tipo: string | null
  clinica_id: string | null
  activo: boolean | null
  created_at: string | null
}

type Clinica = {
  id: string
  nome: string
}

type KitEstoque = {
  id: string
  clinica_id: string
  tipo_kit: string
  quantidade: number | null
  quantidade_minima: number | null
}

type RecetaConsumo = {
  id: string
  nombre_receta: string
  especie: string | null
  sexo: string | null
  activo: boolean | null
  created_at: string | null
}

type RecetaItem = {
  id: string
  receta_id: string
  producto_id: string
  cantidad: number | null
  unidad: string | null
  observacion: string | null
}

type FilaInventario = {
  id: string
  producto_id: string
  producto: string
  categoria: string
  unidad: string
  almacen_id: string
  almacen: string
  tipo_almacen: string
  clinica_id: string
  clinica: string
  cantidad_actual: number
  cantidad_minima: number
  stock_minimo_producto: number
  minimo_referencia: number
  deficit: number
  estado_stock: "CRITICO" | "BAJO" | "NORMAL"
  updated_at: string | null
}

type FilaKit = {
  id: string
  clinica_id: string
  clinica: string
  tipo_kit: string
  quantidade: number
  quantidade_minima: number
  estado: "CRITICO" | "BAJO" | "NORMAL"
}

type FilaRecetaConsumo = {
  receta_id: string
  nombre_receta: string
  especie: string
  sexo: string
  producto_id: string
  producto: string
  categoria: string
  cantidad_receta: number
  unidad: string
  stock_total_disponible: number
  cirugias_estimadas: number
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

function toNumber(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function formatearFecha(fecha?: string | null) {
  if (!fecha) return "-"
  return fecha.slice(0, 10)
}

function normalizarEstadoStock(actual: number, minimo: number): "CRITICO" | "BAJO" | "NORMAL" {
  if (actual <= minimo) return "CRITICO"
  if (actual <= minimo * 1.5) return "BAJO"
  return "NORMAL"
}

function labelEstadoStock(estado: "CRITICO" | "BAJO" | "NORMAL") {
  if (estado === "CRITICO") return "Crítico"
  if (estado === "BAJO") return "Bajo"
  return "Normal"
}

function clasesEstadoStock(estado: "CRITICO" | "BAJO" | "NORMAL") {
  if (estado === "CRITICO") return "bg-red-100 text-red-700"
  if (estado === "BAJO") return "bg-yellow-100 text-yellow-700"
  return "bg-emerald-100 text-emerald-700"
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

  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", nombreArchivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function InformesInventarioPage() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  const [stock, setStock] = useState<StockAlmacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [kits, setKits] = useState<KitEstoque[]>([])
  const [recetas, setRecetas] = useState<RecetaConsumo[]>([])
  const [recetaItems, setRecetaItems] = useState<RecetaItem[]>([])

  const [fechaInicio, setFechaInicio] = useState(inicioMesISO())
  const [fechaFin, setFechaFin] = useState(hoyISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [almacenFiltro, setAlmacenFiltro] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [busqueda, setBusqueda] = useState("")

  async function cargarDatos() {
    setCargando(true)
    setError("")

    const [
      stockRes,
      productosRes,
      almacenesRes,
      clinicasRes,
      kitsRes,
      recetasRes,
      recetaItemsRes,
    ] = await Promise.all([
      supabase
        .from("stock_almacen")
        .select("id,almacen_id,producto_id,cantidad_actual,updated_at,cantidad_minima"),

      supabase
        .from("productos")
        .select("id,nombre,categoria,unidad_base,controla_stock,activo,stock_minimo,observaciones,created_at"),

      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id,activo,created_at")
        .eq("activo", true),

      supabase
        .from("clinicas")
        .select("id,nome")
        .order("nome", { ascending: true }),

      supabase
        .from("kits_estoque")
        .select("id,clinica_id,tipo_kit,quantidade,quantidade_minima"),

      supabase
        .from("recetas_consumo")
        .select("id,nombre_receta,especie,sexo,activo,created_at")
        .eq("activo", true),

      supabase
        .from("receta_items")
        .select("id,receta_id,producto_id,cantidad,unidad,observacion"),
    ])

    if (stockRes.error) {
      console.log("Error stock_almacen:", stockRes.error)
      setError(stockRes.error.message)
      setCargando(false)
      return
    }

    if (productosRes.error) {
      console.log("Error productos:", productosRes.error)
      setError(productosRes.error.message)
      setCargando(false)
      return
    }

    if (almacenesRes.error) {
      console.log("Error almacenes:", almacenesRes.error)
      setError(almacenesRes.error.message)
      setCargando(false)
      return
    }

    if (clinicasRes.error) {
      console.log("Error clinicas:", clinicasRes.error)
      setError(clinicasRes.error.message)
      setCargando(false)
      return
    }

    if (kitsRes.error) {
      console.log("Error kits_estoque:", kitsRes.error)
      setError(kitsRes.error.message)
      setCargando(false)
      return
    }

    if (recetasRes.error) {
      console.log("Error recetas_consumo:", recetasRes.error)
      setError(recetasRes.error.message)
      setCargando(false)
      return
    }

    if (recetaItemsRes.error) {
      console.log("Error receta_items:", recetaItemsRes.error)
      setError(recetaItemsRes.error.message)
      setCargando(false)
      return
    }

    setStock((stockRes.data as StockAlmacen[]) || [])
    setProductos((productosRes.data as Producto[]) || [])
    setAlmacenes((almacenesRes.data as Almacen[]) || [])
    setClinicas((clinicasRes.data as Clinica[]) || [])
    setKits((kitsRes.data as KitEstoque[]) || [])
    setRecetas((recetasRes.data as RecetaConsumo[]) || [])
    setRecetaItems((recetaItemsRes.data as RecetaItem[]) || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const mapaClinicas = useMemo(() => {
    const mapa: Record<string, string> = {}
    clinicas.forEach((c) => {
      mapa[c.id] = c.nome
    })
    return mapa
  }, [clinicas])

  const mapaProductos = useMemo(() => {
    const mapa: Record<string, Producto> = {}
    productos.forEach((p) => {
      mapa[p.id] = p
    })
    return mapa
  }, [productos])

  const mapaAlmacenes = useMemo(() => {
    const mapa: Record<string, Almacen> = {}
    almacenes.forEach((a) => {
      mapa[a.id] = a
    })
    return mapa
  }, [almacenes])

  const categoriasDisponibles = useMemo(() => {
    const valores = Array.from(
      new Set(
        productos
          .map((p) => (p.categoria || "").trim())
          .filter(Boolean)
      )
    )
    return valores.sort((a, b) => a.localeCompare(b))
  }, [productos])

  const almacenesFiltrables = useMemo(() => {
    if (!clinicaFiltro) return almacenes
    return almacenes.filter((a) => a.clinica_id === clinicaFiltro)
  }, [almacenes, clinicaFiltro])

  const filasInventario = useMemo(() => {
    return stock.map((item): FilaInventario => {
      const producto = mapaProductos[item.producto_id]
      const almacen = mapaAlmacenes[item.almacen_id]
      const clinicaNombre =
        almacen?.tipo === "central"
          ? "Almacén Central"
          : almacen?.clinica_id
          ? mapaClinicas[almacen.clinica_id] || "Sin clínica"
          : "Sin clínica"

      const cantidadActual = toNumber(item.cantidad_actual)
      const cantidadMinimaStock = toNumber(item.cantidad_minima)
      const stockMinimoProducto = toNumber(producto?.stock_minimo)
      const minimoReferencia = Math.max(cantidadMinimaStock, stockMinimoProducto)
      const deficit = Math.max(0, minimoReferencia - cantidadActual)
      const estado_stock = normalizarEstadoStock(cantidadActual, minimoReferencia || 1)

      return {
        id: item.id,
        producto_id: item.producto_id,
        producto: producto?.nombre || "Producto sin nombre",
        categoria: producto?.categoria || "Sin categoría",
        unidad: producto?.unidad_base || "-",
        almacen_id: item.almacen_id,
        almacen: almacen?.nombre || "Almacén sin nombre",
        tipo_almacen: almacen?.tipo || "-",
        clinica_id: almacen?.clinica_id || "",
        clinica: clinicaNombre,
        cantidad_actual: cantidadActual,
        cantidad_minima: cantidadMinimaStock,
        stock_minimo_producto: stockMinimoProducto,
        minimo_referencia: minimoReferencia,
        deficit,
        estado_stock,
        updated_at: item.updated_at,
      }
    })
  }, [stock, mapaProductos, mapaAlmacenes, mapaClinicas])

  const filasInventarioFiltradas = useMemo(() => {
    return filasInventario.filter((fila) => {
      const fecha = fila.updated_at ? fila.updated_at.slice(0, 10) : ""

      if (fechaInicio && fecha && fecha < fechaInicio) return false
      if (fechaFin && fecha && fecha > fechaFin) return false
      if (clinicaFiltro && fila.clinica_id !== clinicaFiltro) return false
      if (almacenFiltro && fila.almacen_id !== almacenFiltro) return false

      if (
        categoriaFiltro &&
        fila.categoria.trim().toLowerCase() !== categoriaFiltro.trim().toLowerCase()
      ) {
        return false
      }

      if (estadoFiltro && fila.estado_stock !== estadoFiltro) return false

      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase()
        const texto = [
          fila.producto,
          fila.categoria,
          fila.almacen,
          fila.clinica,
          fila.tipo_almacen,
        ]
          .join(" ")
          .toLowerCase()

        if (!texto.includes(q)) return false
      }

      return true
    })
  }, [
    filasInventario,
    fechaInicio,
    fechaFin,
    clinicaFiltro,
    almacenFiltro,
    categoriaFiltro,
    estadoFiltro,
    busqueda,
  ])

  const resumen = useMemo(() => {
    const stockCritico = filasInventarioFiltradas.filter((f) => f.estado_stock === "CRITICO").length
    const stockBajo = filasInventarioFiltradas.filter((f) => f.estado_stock === "BAJO").length
    const stockNormal = filasInventarioFiltradas.filter((f) => f.estado_stock === "NORMAL").length
    const stockTotal = filasInventarioFiltradas.reduce((acc, item) => acc + item.cantidad_actual, 0)
    const almacenesActivos = new Set(filasInventarioFiltradas.map((f) => f.almacen_id)).size

    return {
      totalProductos: filasInventarioFiltradas.length,
      stockTotal,
      stockCritico,
      stockBajo,
      stockNormal,
      almacenesActivos,
      recetasActivas: recetas.length,
    }
  }, [filasInventarioFiltradas, recetas])

  const stockCriticoPorClinica = useMemo(() => {
    const conteo: Record<
      string,
      { clinica: string; criticos: number; bajos: number; normales: number }
    > = {}

    filasInventarioFiltradas.forEach((item) => {
      const nombre = item.clinica || "Sin clínica"

      if (!conteo[nombre]) {
        conteo[nombre] = {
          clinica: nombre,
          criticos: 0,
          bajos: 0,
          normales: 0,
        }
      }

      if (item.estado_stock === "CRITICO") conteo[nombre].criticos += 1
      if (item.estado_stock === "BAJO") conteo[nombre].bajos += 1
      if (item.estado_stock === "NORMAL") conteo[nombre].normales += 1
    })

    return Object.values(conteo).sort((a, b) => b.criticos - a.criticos)
  }, [filasInventarioFiltradas])

  const maximoCriticos = useMemo(() => {
    if (!stockCriticoPorClinica.length) return 1
    return Math.max(...stockCriticoPorClinica.map((i) => i.criticos), 1)
  }, [stockCriticoPorClinica])

  const topProductosMenorStock = useMemo(() => {
    return [...filasInventarioFiltradas]
      .sort((a, b) => {
        const pesoA = a.estado_stock === "CRITICO" ? 0 : a.estado_stock === "BAJO" ? 1 : 2
        const pesoB = b.estado_stock === "CRITICO" ? 0 : b.estado_stock === "BAJO" ? 1 : 2

        if (pesoA !== pesoB) return pesoA - pesoB
        if (b.deficit !== a.deficit) return b.deficit - a.deficit
        return a.cantidad_actual - b.cantidad_actual
      })
      .slice(0, 10)
  }, [filasInventarioFiltradas])

  const filasKits = useMemo(() => {
    return kits
      .map((kit): FilaKit => {
        const inicial = toNumber(kit.quantidade)
        const minima = toNumber(kit.quantidade_minima)
        const estado = normalizarEstadoStock(inicial, minima || 1)

        return {
          id: kit.id,
          clinica_id: kit.clinica_id,
          clinica: mapaClinicas[kit.clinica_id] || "Sin clínica",
          tipo_kit: kit.tipo_kit || "-",
          quantidade: inicial,
          quantidade_minima: minima,
          estado,
        }
      })
      .filter((fila) => {
        if (clinicaFiltro && fila.clinica_id !== clinicaFiltro) return false
        return true
      })
  }, [kits, mapaClinicas, clinicaFiltro])

  const consumoEstimadoPorReceta = useMemo(() => {
    const stockPorProducto: Record<string, number> = {}

    filasInventarioFiltradas.forEach((fila) => {
      stockPorProducto[fila.producto_id] = (stockPorProducto[fila.producto_id] || 0) + fila.cantidad_actual
    })

    const mapaRecetas: Record<string, RecetaConsumo> = {}
    recetas.forEach((r) => {
      mapaRecetas[r.id] = r
    })

    const filas: FilaRecetaConsumo[] = recetaItems
      .map((item) => {
        const receta = mapaRecetas[item.receta_id]
        const producto = mapaProductos[item.producto_id]

        const cantidadReceta = toNumber(item.cantidad)
        const stockTotalDisponible = toNumber(stockPorProducto[item.producto_id] || 0)
        const cirugias_estimadas =
          cantidadReceta > 0 ? Math.floor(stockTotalDisponible / cantidadReceta) : 0

        return {
          receta_id: item.receta_id,
          nombre_receta: receta?.nombre_receta || "Receta sin nombre",
          especie: receta?.especie || "-",
          sexo: receta?.sexo || "-",
          producto_id: item.producto_id,
          producto: producto?.nombre || "Producto sin nombre",
          categoria: producto?.categoria || "Sin categoría",
          cantidad_receta: cantidadReceta,
          unidad: item.unidad || producto?.unidad_base || "-",
          stock_total_disponible: stockTotalDisponible,
          cirugias_estimadas: cirugias_estimadas,
          observacion: item.observacion || "",
        }
      })
      .filter((fila) => {
        if (
          categoriaFiltro &&
          fila.categoria.trim().toLowerCase() !== categoriaFiltro.trim().toLowerCase()
        ) {
          return false
        }

        if (busqueda.trim()) {
          const q = busqueda.trim().toLowerCase()
          const texto = [
            fila.nombre_receta,
            fila.producto,
            fila.categoria,
            fila.especie,
            fila.sexo,
          ]
            .join(" ")
            .toLowerCase()

          if (!texto.includes(q)) return false
        }

        return true
      })
      .sort((a, b) => a.cirugias_estimadas - b.cirugias_estimadas)

    return filas
  }, [filasInventarioFiltradas, recetaItems, recetas, mapaProductos, categoriaFiltro, busqueda])

  function limpiarFiltros() {
    setFechaInicio(inicioMesISO())
    setFechaFin(hoyISO())
    setClinicaFiltro("")
    setAlmacenFiltro("")
    setCategoriaFiltro("")
    setEstadoFiltro("")
    setBusqueda("")
  }

  function exportarInventarioCSV() {
    const filas = filasInventarioFiltradas.map((fila) => ({
      producto: fila.producto,
      categoria: fila.categoria,
      unidad: fila.unidad,
      almacen: fila.almacen,
      tipo_almacen: fila.tipo_almacen,
      clinica: fila.clinica,
      cantidad_actual: fila.cantidad_actual,
      cantidad_minima_stock: fila.cantidad_minima,
      stock_minimo_producto: fila.stock_minimo_producto,
      minimo_referencia: fila.minimo_referencia,
      deficit: fila.deficit,
      estado: labelEstadoStock(fila.estado_stock),
      actualizado: formatearFecha(fila.updated_at),
    }))

    descargarCSV("informe_inventario.csv", filas)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando informe de inventario...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Informe de inventario
            </h1>
            <p className="text-white/80">
              Stock por almacén, kits, criticidad por clínica y consumo estimado por receta
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
              onClick={exportarInventarioCSV}
              className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
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
                onChange={(e) => {
                  setClinicaFiltro(e.target.value)
                  setAlmacenFiltro("")
                }}
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
                Almacén
              </label>
              <select
                value={almacenFiltro}
                onChange={(e) => setAlmacenFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos los almacenes</option>
                {almacenesFiltrables.map((almacen) => (
                  <option key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categoría
              </label>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todas las categorías</option>
                {categoriasDisponibles.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado stock
              </label>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="CRITICO">Crítico</option>
                <option value="BAJO">Bajo</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Producto, receta, clínica..."
                className="w-full border rounded-xl px-4 py-3"
              />
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

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 shadow">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Productos en inventario</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.totalProductos}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock total</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.stockTotal}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock crítico</p>
            <p className="text-3xl font-bold text-red-500 mt-2">
              {resumen.stockCritico}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock bajo</p>
            <p className="text-3xl font-bold text-yellow-500 mt-2">
              {resumen.stockBajo}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Stock normal</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {resumen.stockNormal}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Almacenes activos</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.almacenesActivos}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Kits configurados</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {filasKits.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-sm text-gray-500 font-semibold">Recetas activas</p>
            <p className="text-3xl font-bold text-[#0F6D6A] mt-2">
              {resumen.recetasActivas}
            </p>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Stock crítico por clínica
            </h2>

            <div className="space-y-3">
              {stockCriticoPorClinica.length > 0 ? (
                stockCriticoPorClinica.map((item, index) => {
                  const largura = `${(item.criticos / maximoCriticos) * 100}%`
                  return (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">
                          {item.clinica}
                        </span>
                        <span className="text-gray-600">
                          {item.criticos} críticos / {item.bajos} bajos
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
                <p className="text-gray-500">No hay datos para mostrar.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
              Top productos con menor stock
            </h2>

            <div className="space-y-3">
              {topProductosMenorStock.length > 0 ? (
                topProductosMenorStock.map((item, index) => (
                  <div key={index} className="border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-800">{item.producto}</p>
                        <p className="text-sm text-gray-500">
                          {item.clinica} · {item.almacen}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${clasesEstadoStock(
                          item.estado_stock
                        )}`}
                      >
                        {labelEstadoStock(item.estado_stock)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Actual</p>
                        <p className="font-bold text-gray-800">{item.cantidad_actual}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Mínimo</p>
                        <p className="font-bold text-gray-800">{item.minimo_referencia}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Déficit</p>
                        <p className="font-bold text-red-600">{item.deficit}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No hay datos para mostrar.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Stock por almacén
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Almacén</th>
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2 pr-3">Actual</th>
                  <th className="py-2 pr-3">Mínimo</th>
                  <th className="py-2 pr-3">Déficit</th>
                  <th className="py-2 pr-3">Unidad</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {filasInventarioFiltradas.map((fila, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 pr-3 font-semibold">{fila.producto}</td>
                    <td className="py-2 pr-3">{fila.categoria}</td>
                    <td className="py-2 pr-3">{fila.almacen}</td>
                    <td className="py-2 pr-3">{fila.clinica}</td>
                    <td className="py-2 pr-3">{fila.cantidad_actual}</td>
                    <td className="py-2 pr-3">{fila.minimo_referencia}</td>
                    <td className="py-2 pr-3 font-bold text-red-600">{fila.deficit}</td>
                    <td className="py-2 pr-3">{fila.unidad}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${clasesEstadoStock(
                          fila.estado_stock
                        )}`}
                      >
                        {labelEstadoStock(fila.estado_stock)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{formatearFecha(fila.updated_at)}</td>
                  </tr>
                ))}

                {filasInventarioFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-gray-500">
                      No hay datos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Kits por clínica
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Clínica</th>
                  <th className="py-2 pr-3">Tipo kit</th>
                  <th className="py-2 pr-3">Cantidad inicial</th>
                  <th className="py-2 pr-3">Cantidad mínima</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasKits.map((fila, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 pr-3 font-semibold">{fila.clinica}</td>
                    <td className="py-2 pr-3">{fila.tipo_kit}</td>
                    <td className="py-2 pr-3">{fila.quantidade}</td>
                    <td className="py-2 pr-3">{fila.quantidade_minima}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${clasesEstadoStock(
                          fila.estado
                        )}`}
                      >
                        {labelEstadoStock(fila.estado)}
                      </span>
                    </td>
                  </tr>
                ))}

                {filasKits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      No hay kits configurados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
            Consumo estimado por receta
          </h2>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Receta</th>
                  <th className="py-2 pr-3">Especie</th>
                  <th className="py-2 pr-3">Sexo</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Cantidad receta</th>
                  <th className="py-2 pr-3">Stock total</th>
                  <th className="py-2 pr-3">Cirugías estimadas</th>
                  <th className="py-2 pr-3">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {consumoEstimadoPorReceta.map((fila, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 pr-3 font-semibold">{fila.nombre_receta}</td>
                    <td className="py-2 pr-3">{fila.especie}</td>
                    <td className="py-2 pr-3">{fila.sexo}</td>
                    <td className="py-2 pr-3">{fila.producto}</td>
                    <td className="py-2 pr-3">{fila.categoria}</td>
                    <td className="py-2 pr-3">
                      {fila.cantidad_receta} {fila.unidad}
                    </td>
                    <td className="py-2 pr-3">{fila.stock_total_disponible}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          fila.cirugias_estimadas <= 5
                            ? "bg-red-100 text-red-700"
                            : fila.cirugias_estimadas <= 15
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {fila.cirugias_estimadas}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{fila.observacion || "-"}</td>
                  </tr>
                ))}

                {consumoEstimadoPorReceta.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-500">
                      No hay recetas o productos para mostrar.
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