"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type GastoOperativo = {
  id: string
  created_at: string
  fecha: string
  categoria: string
  descripcion: string | null
  monto: number
  metodo_pago: string | null
  comprobante_url: string | null
  observacion: string | null
}

type CategoriaItem = {
  value: string
  label: string
}

type GrupoGasto = {
  key: "operativo" | "administrativo" | "recaudacion"
  label: string
  description: string
  categories: CategoriaItem[]
}

const GRUPOS_GASTO: GrupoGasto[] = [
  {
    key: "operativo",
    label: "Gastos de Infraestructura y Servicios",
    description: "",
    categories: [
      { value: "infra_alquiler", label: "Alquiler de instalaciones" },
      { value: "infra_energia", label: "Energía eléctrica" },
      { value: "infra_agua", label: "Agua y alcantarillado" },
      { value: "infra_internet", label: "Internet y telecomunicaciones" },
      { value: "infra_gas", label: "Gas y combustibles" },
      { value: "infra_mantenimiento", label: "Mantenimiento y reparaciones" },
      { value: "infra_limpieza", label: "Limpieza e higiene" },
      { value: "infra_seguridad", label: "Seguridad y vigilancia" },
      { value: "operativo_otros", label: "Otros gastos operativos" },
    ],
  },
  {
    key: "recaudacion",
    label: "Gastos de Recaudación y Difusión",
    description: "",
    categories: [
      { value: "recaudacion_publicidad", label: "Publicidad y redes sociales" },
      { value: "recaudacion_diseno", label: "Diseño gráfico y material de difusión" },
      { value: "recaudacion_eventos", label: "Organización de eventos de recaudación" },
      { value: "recaudacion_comisiones", label: "Comisiones por plataformas de donación online" },
      { value: "recaudacion_otros", label: "Otros gastos de recaudación" },
    ],
  },
  {
    key: "administrativo",
    label: "Gastos administrativos",
    description: "",
    categories: [
      { value: "admin_sueldos", label: "Sueldos y salarios" },
      { value: "admin_cargas_sociales", label: "Cargas sociales y aportes patronales" },
      { value: "admin_oficina", label: "Material de escritorio y oficina" },
      { value: "admin_transporte", label: "Gastos de transporte y movilidad" },
      { value: "admin_seguros", label: "Seguros" },
      { value: "admin_honorarios", label: "Honorarios profesionales" },
      { value: "admin_depreciacion", label: "Depreciación de activos fijos" },
      { value: "admin_comisiones", label: "Comisiones bancarias y financieras" },
      { value: "admin_impuestos", label: "Impuestos y tasas administrativas" },
      { value: "admin_otros", label: "Otros gastos administrativos" },
    ],
  },
]

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "qr", label: "QR" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "credito", label: "Crédito" },
]

const TODAS_CATEGORIAS_BASE = GRUPOS_GASTO.flatMap((grupo) =>
  grupo.categories.map((categoria) => ({
    ...categoria,
    grupo_key: grupo.key,
    grupo_label: grupo.label,
    is_custom: false,
  }))
)

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function money(value: number) {
  return `Bs ${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("es-BO")
}

function inferGrupoFromCategoria(value: string): "operativo" | "administrativo" | "recaudacion" {
  if (value.startsWith("recaudacion_")) {
    return "recaudacion"
  }
  if (value.startsWith("admin_") || value.startsWith("administrativo_")) {
    return "administrativo"
  }
  return "operativo"
}

function buildCategoriaCustom(
  grupo: "operativo" | "administrativo" | "recaudacion",
  label: string
): { value: string; label: string } {
  const slug = slugify(label)
  const prefix =
    grupo === "administrativo"
      ? "admin_custom_"
      : grupo === "recaudacion"
        ? "recaudacion_custom_"
        : "operativo_custom_"
  return {
    value: `${prefix}${slug || "nueva_categoria"}`,
    label: label.trim(),
  }
}

export default function GastosPage() {
  const hoje = new Date()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const [registros, setRegistros] = useState<GastoOperativo[]>([])

  const [grupoGasto, setGrupoGasto] = useState<"operativo" | "administrativo" | "recaudacion">("operativo")
  const [fecha, setFecha] = useState(hoje.toISOString().slice(0, 10))
  const [categoria, setCategoria] = useState(GRUPOS_GASTO[0].categories[0].value)
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState("transferencia")
  const [observacion, setObservacion] = useState("")

  const [crearNuevaCategoria, setCrearNuevaCategoria] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [filtroGrupo, setFiltroGrupo] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroMetodo, setFiltroMetodo] = useState("")

  const categoriasCustomDesdeRegistros = useMemo(() => {
    const map = new Map<
      string,
      { value: string; label: string; grupo_key: "operativo" | "administrativo" | "recaudacion"; grupo_label: string }
    >()

    for (const item of registros) {
      const existeBase = TODAS_CATEGORIAS_BASE.find((c) => c.value === item.categoria)
      if (existeBase) continue

      const grupo_key = inferGrupoFromCategoria(item.categoria)
      map.set(item.categoria, {
        value: item.categoria,
        label: item.categoria
          .replace(/^admin_custom_/, "")
          .replace(/^operativo_custom_/, "")
          .replace(/^recaudacion_custom_/, "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        grupo_key,
        grupo_label:
          grupo_key === "administrativo"
            ? "Gastos administrativos"
            : grupo_key === "recaudacion"
              ? "Gastos de Recaudación y Difusión"
              : "Gastos operativos",
      })
    }

    return Array.from(map.values())
  }, [registros])

  const todasCategorias = useMemo(() => {
    return [...TODAS_CATEGORIAS_BASE, ...categoriasCustomDesdeRegistros]
  }, [categoriasCustomDesdeRegistros])

  function categoriaLabel(value: string) {
    return todasCategorias.find((c) => c.value === value)?.label || value
  }

  function grupoFromCategoria(value: string) {
    return todasCategorias.find((c) => c.value === value)?.grupo_key || inferGrupoFromCategoria(value)
  }

  function grupoLabelFromCategoria(value: string) {
    return (
      todasCategorias.find((c) => c.value === value)?.grupo_label ||
      (inferGrupoFromCategoria(value) === "administrativo"
        ? "Gastos administrativos"
        : inferGrupoFromCategoria(value) === "recaudacion"
          ? "Gastos de Recaudación y Difusión"
          : "Gastos operativos")
    )
  }

  const categoriasDisponiblesFormulario = useMemo(() => {
    const base = GRUPOS_GASTO.find((grupo) => grupo.key === grupoGasto)?.categories || []
    const custom = categoriasCustomDesdeRegistros
      .filter((categoriaItem) => categoriaItem.grupo_key === grupoGasto)
      .map((item) => ({ value: item.value, label: item.label }))

    const map = new Map<string, CategoriaItem>()
    for (const item of [...base, ...custom]) {
      map.set(item.value, item)
    }

    return Array.from(map.values())
  }, [grupoGasto, categoriasCustomDesdeRegistros])

  useEffect(() => {
    if (crearNuevaCategoria) return
    if (!categoriasDisponiblesFormulario.length) return
    const existe = categoriasDisponiblesFormulario.some((item) => item.value === categoria)
    if (!existe) {
      setCategoria(categoriasDisponiblesFormulario[0].value)
    }
  }, [grupoGasto, categoriasDisponiblesFormulario, categoria, crearNuevaCategoria])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)

    try {
      const res = await fetch("/api/contabilidad/gastos-operativos", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setRegistros(data.data || [])
    } catch (error) {
      console.error(error)
      alert("No se pudieron cargar los gastos.")
    }

    setCargando(false)
  }

  function resetFormulario() {
    setEditandoId(null)
    setGrupoGasto("operativo")
    setFecha(new Date().toISOString().slice(0, 10))
    setCategoria(GRUPOS_GASTO[0].categories[0].value)
    setDescripcion("")
    setMonto("")
    setMetodoPago("transferencia")
    setObservacion("")
    setCrearNuevaCategoria(false)
    setNuevaCategoriaNombre("")
  }

  function cargarParaEditar(item: GastoOperativo) {
    const grupo = grupoFromCategoria(item.categoria)
    setEditandoId(item.id)
    setGrupoGasto(grupo)
    setFecha(item.fecha || new Date().toISOString().slice(0, 10))
    setCategoria(item.categoria)
    setDescripcion(item.descripcion || "")
    setMonto(String(Number(item.monto || 0)))
    setMetodoPago(item.metodo_pago || "transferencia")
    setObservacion(item.observacion || "")
    setCrearNuevaCategoria(false)
    setNuevaCategoriaNombre("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function guardarRegistro() {
    const montoNum = Number(monto)

    if (!fecha) {
      alert("Ingrese la fecha del gasto.")
      return
    }

    const categoriaFinal = crearNuevaCategoria
      ? buildCategoriaCustom(grupoGasto, nuevaCategoriaNombre)
      : categoriasDisponiblesFormulario.find((item) => item.value === categoria)

    if (!categoriaFinal?.value) {
      alert("Seleccione una categoría.")
      return
    }

    if (crearNuevaCategoria && !nuevaCategoriaNombre.trim()) {
      alert("Escriba el nombre de la nueva categoría.")
      return
    }

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      alert("Ingrese un monto válido.")
      return
    }

    setGuardando(true)

    try {
      const payload = {
        id: editandoId,
        fecha,
        categoria: categoriaFinal.value,
        descripcion: descripcion.trim() || null,
        monto: montoNum,
        metodo_pago: metodoPago || null,
        observacion: observacion.trim() || null,
      }

      const res = await fetch("/api/contabilidad/gastos-operativos", {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      await cargar()
      resetFormulario()
      alert(editandoId ? "Gasto editado correctamente." : "Gasto registrado correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo guardar el gasto: ${error.message || "error interno"}`)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRegistro(id: string) {
    const confirmar = window.confirm("¿Seguro que deseas eliminar este gasto?")
    if (!confirmar) return

    setEliminandoId(id)

    try {
      const res = await fetch("/api/contabilidad/gastos-operativos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await cargar()
      alert("Gasto eliminado correctamente.")
    } catch (error: any) {
      console.error(error)
      alert(`No se pudo eliminar: ${error.message || "error interno"}`)
    } finally {
      setEliminandoId(null)
    }
  }

  const registrosFiltrados = useMemo(() => {
    return registros.filter((item) => {
      const q = busqueda.trim().toLowerCase()

      if (q) {
        const texto =
          `${item.categoria} ${categoriaLabel(item.categoria)} ${grupoLabelFromCategoria(item.categoria)} ${item.descripcion || ""} ${item.metodo_pago || ""} ${item.observacion || ""}`.toLowerCase()

        if (!texto.includes(q)) return false
      }

      if (filtroGrupo && grupoFromCategoria(item.categoria) !== filtroGrupo) return false
      if (filtroCategoria && item.categoria !== filtroCategoria) return false
      if (filtroMetodo && (item.metodo_pago || "") !== filtroMetodo) return false

      return true
    })
  }, [registros, busqueda, filtroGrupo, filtroCategoria, filtroMetodo, todasCategorias])

  const totalGeneral = useMemo(() => registros.reduce((acc, item) => acc + Number(item.monto || 0), 0), [registros])
  const totalFiltrado = useMemo(() => registrosFiltrados.reduce((acc, item) => acc + Number(item.monto || 0), 0), [registrosFiltrados])

  const totalOperativos = useMemo(() => {
    return registros
      .filter((item) => grupoFromCategoria(item.categoria) === "operativo")
      .reduce((acc, item) => acc + Number(item.monto || 0), 0)
  }, [registros, todasCategorias])

  const totalAdministrativos = useMemo(() => {
    return registros
      .filter((item) => grupoFromCategoria(item.categoria) === "administrativo")
      .reduce((acc, item) => acc + Number(item.monto || 0), 0)
  }, [registros, todasCategorias])

  const resumenSubcategorias = useMemo(() => {
    return todasCategorias
      .map((categoriaItem) => {
        const total = registrosFiltrados
          .filter((item) => item.categoria === categoriaItem.value)
          .reduce((acc, item) => acc + Number(item.monto || 0), 0)

        return { ...categoriaItem, total }
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [registrosFiltrados, todasCategorias])

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/contabilidad"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a contabilidad
          </Link>
          <Link
            href="/admin/contabilidad/resumen"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Ir al resumen
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 border border-white/60">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">Gastos</h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Registro de gastos operativos y administrativos de la fundación,
                preparado para sincronizar con el estado de resultados.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full xl:min-w-[700px]">
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-xs text-gray-500">Total general</p>
                <p className="text-xl font-bold text-red-500">{money(totalGeneral)}</p>
              </div>
              <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 px-4 py-3">
                <p className="text-xs text-gray-500">Operativos</p>
                <p className="text-xl font-bold text-[#0F6D6A]">{money(totalOperativos)}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <p className="text-xs text-gray-500">Administrativos</p>
                <p className="text-xl font-bold text-violet-700">{money(totalAdministrativos)}</p>
              </div>
              <div className="rounded-2xl border border-[#F47C3C]/10 bg-[#F47C3C]/10 px-4 py-3">
                <p className="text-xs text-gray-500">Registros filtrados</p>
                <p className="text-xl font-bold text-[#F47C3C]">{registrosFiltrados.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h2 className="text-xl font-bold text-[#0F6D6A]">
                    {editandoId ? "Editar gasto" : "Nuevo gasto"}
                  </h2>

                  {editandoId && (
                    <button
                      type="button"
                      onClick={resetFormulario}
                      className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-600 border border-gray-200 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Grupo del gasto
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {GRUPOS_GASTO.map((grupo) => (
                        <button
                          key={grupo.key}
                          type="button"
                          onClick={() => setGrupoGasto(grupo.key)}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            grupoGasto === grupo.key
                              ? grupo.key === "operativo"
                                ? "border-[#0F6D6A] bg-[#0F6D6A]/8"
                                : "border-violet-300 bg-violet-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <p className={`font-bold ${grupo.key === "operativo" ? "text-[#0F6D6A]" : "text-violet-700"}`}>
                            {grupo.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{grupo.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha del gasto</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>

                    {!crearNuevaCategoria ? (
                      <div className="space-y-2">
                        <select
                          value={categoria}
                          onChange={(e) => setCategoria(e.target.value)}
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        >
                          {categoriasDisponiblesFormulario.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setCrearNuevaCategoria(true)
                            setNuevaCategoriaNombre("")
                          }}
                          className="text-sm font-semibold text-[#0F6D6A] hover:opacity-80"
                        >
                          + Agregar nueva categoría
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={nuevaCategoriaNombre}
                          onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                          placeholder="Ej: Publicidad y redes sociales"
                          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCrearNuevaCategoria(false)
                            setNuevaCategoriaNombre("")
                          }}
                          className="text-sm font-semibold text-gray-500 hover:opacity-80"
                        >
                          Cancelar nueva categoría
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                    <input
                      type="text"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Ej: pago mensual de alquiler"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Monto</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="Ej: 1200"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Método de pago</label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    >
                      {METODOS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Observación</label>
                    <textarea
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                      rows={4}
                      placeholder="Ej: gasto correspondiente al mes de marzo"
                      className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800 resize-none"
                    />
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-800">Vinculación con Estado de Resultados</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Todo lo guardado como <strong>operativo</strong> se sumará en Gastos Operativos.
                      Todo lo guardado como <strong>administrativo</strong> se sumará en Gastos Administrativos.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={guardarRegistro}
                    disabled={guardando}
                    className="w-full rounded-2xl bg-[#F47C3C] text-white font-bold px-4 py-3 shadow hover:bg-[#db6d31] transition disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Guardar gasto"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F6D6A] mb-4">Resumen por subcategoría</h2>

                <div className="space-y-3">
                  {resumenSubcategorias.length === 0 ? (
                    <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500 text-center">
                      No hay subcategorías con movimientos para mostrar.
                    </div>
                  ) : (
                    resumenSubcategorias.map((item) => (
                      <div
                        key={item.value}
                        className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-gray-800">{categoriaLabel(item.value)}</p>
                          <p className="text-xs text-gray-500">{item.grupo_label}</p>
                        </div>
                        <p className="font-extrabold text-[#0F6D6A]">{money(item.total)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 space-y-6">
              <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold text-[#0F6D6A]">Filtros y resumen</h2>
                  <div className="text-sm text-gray-500">
                    Total filtrado: <span className="font-bold text-[#0F6D6A]">{money(totalFiltrado)}</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar categoría, grupo, observación..."
                    className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  />

                  <select
                    value={filtroGrupo}
                    onChange={(e) => setFiltroGrupo(e.target.value)}
                    className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    <option value="">Todos los grupos</option>
                    {GRUPOS_GASTO.map((grupo) => (
                      <option key={grupo.key} value={grupo.key}>{grupo.label}</option>
                    ))}
                  </select>

                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    <option value="">Todas las categorías</option>
                    {todasCategorias.map((categoriaItem) => (
                      <option key={categoriaItem.value} value={categoriaItem.value}>
                        {categoriaLabel(categoriaItem.value)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroMetodo}
                    onChange={(e) => setFiltroMetodo(e.target.value)}
                    className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    <option value="">Todos los métodos</option>
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-[#0F6D6A] mb-5">Historial de gastos</h2>

                {cargando ? (
                  <div className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">Cargando gastos...</div>
                ) : registrosFiltrados.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">No hay gastos registrados.</div>
                ) : (
                  <div className="space-y-4">
                    {registrosFiltrados.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  grupoFromCategoria(item.categoria) === "operativo"
                                    ? "bg-[#0F6D6A]/10 text-[#0F6D6A]"
                                    : "bg-violet-100 text-violet-700"
                                }`}
                              >
                                {grupoLabelFromCategoria(item.categoria)}
                              </span>

                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700">
                                {categoriaLabel(item.categoria)}
                              </span>
                            </div>

                            <p className="text-sm text-gray-500 mt-1">Fecha: {formatDate(item.fecha)}</p>
                            <p className="text-sm text-gray-500">Método: {item.metodo_pago || "-"}</p>
                            <p className="text-sm text-gray-600 mt-2">{item.descripcion || "Sin descripción"}</p>
                            <p className="text-sm text-gray-600">{item.observacion || "Sin observación"}</p>
                          </div>

                          <div className="lg:text-right">
                            <p className="text-sm text-gray-500">Monto</p>
                            <p
                              className={`text-2xl font-extrabold ${
                                grupoFromCategoria(item.categoria) === "operativo"
                                  ? "text-[#0F6D6A]"
                                  : "text-violet-700"
                              }`}
                            >
                              {money(Number(item.monto || 0))}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                              <button
                                type="button"
                                onClick={() => cargarParaEditar(item)}
                                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => eliminarRegistro(item.id)}
                                disabled={eliminandoId === item.id}
                                className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition disabled:opacity-60"
                              >
                                {eliminandoId === item.id ? "Eliminando..." : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
