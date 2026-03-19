"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type RowMinimo = {
  id: string
  almacen_id: string
  producto_id: string
  cantidad_actual: number
  cantidad_minima: number
  almacenes: any
  productos: any
}

export default function AdminInventarioMinimosPage() {
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtroAlmacen, setFiltroAlmacen] = useState("")
  const [soloBajos, setSoloBajos] = useState(false)
  const [rows, setRows] = useState<RowMinimo[]>([])
  const [editados, setEditados] = useState<Record<string, string>>({})

  function normalizarRelacion(rel: any) {
    if (Array.isArray(rel)) return rel[0] || null
    return rel || null
  }

  async function cargarDatos() {
    setCargando(true)

    const { data, error } = await supabase
      .from("stock_almacen")
      .select(`
        id,
        almacen_id,
        producto_id,
        cantidad_actual,
        cantidad_minima,
        almacenes:almacen_id (
          id,
          nombre,
          tipo
        ),
        productos:producto_id (
          id,
          nombre,
          unidad_base,
          categoria
        )
      `)
      .order("almacen_id", { ascending: true })

    if (error) {
      console.log(error)
      setRows([])
      setCargando(false)
      return
    }

    const normalizados: RowMinimo[] = ((data as any[]) || []).map((item) => ({
      ...item,
      almacenes: normalizarRelacion(item.almacenes),
      productos: normalizarRelacion(item.productos),
    }))

    setRows(normalizados)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const almacenes = useMemo(() => {
    const mapa = new Map<string, { id: string; nombre: string }>()
    rows.forEach((row) => {
      if (row.almacenes?.id) {
        mapa.set(row.almacenes.id, {
          id: row.almacenes.id,
          nombre: row.almacenes.nombre,
        })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [rows])

  const rowsFiltradas = useMemo(() => {
    return rows.filter((row) => {
      const nombreProducto = (row.productos?.nombre || "").toLowerCase()
      const nombreAlmacen = (row.almacenes?.nombre || "").toLowerCase()
      const texto = busqueda.trim().toLowerCase()

      const coincideBusqueda =
        !texto ||
        nombreProducto.includes(texto) ||
        nombreAlmacen.includes(texto)

      const coincideAlmacen =
        !filtroAlmacen || row.almacen_id === filtroAlmacen

      const minimoEditado = editados[row.id]
      const minimo =
        minimoEditado !== undefined
          ? Number(minimoEditado || 0)
          : Number(row.cantidad_minima || 0)

      const actual = Number(row.cantidad_actual || 0)

      const coincideSoloBajos = !soloBajos || (actual >= 0 && actual <= minimo)

      return coincideBusqueda && coincideAlmacen && coincideSoloBajos
    })
  }, [rows, busqueda, filtroAlmacen, soloBajos, editados])

  async function guardarMinimo(id: string) {
    const valor = editados[id]
    if (valor === undefined) return

    const numero = Number(valor)
    if (Number.isNaN(numero) || numero < 0) {
      alert("Ingrese un mínimo válido.")
      return
    }

    setGuardandoId(id)

    const { error } = await supabase
      .from("stock_almacen")
      .update({ cantidad_minima: numero })
      .eq("id", id)

    if (error) {
      console.log(error)
      alert("No se pudo guardar el mínimo.")
      setGuardandoId(null)
      return
    }

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, cantidad_minima: numero } : row
      )
    )

    setEditados((prev) => {
      const copia = { ...prev }
      delete copia[id]
      return copia
    })

    setGuardandoId(null)
  }

  function valorInput(row: RowMinimo) {
    if (editados[row.id] !== undefined) return editados[row.id]
    return String(Number(row.cantidad_minima || 0))
  }

  function estadoRow(row: RowMinimo) {
    const actual = Number(row.cantidad_actual || 0)
    const minimo =
      editados[row.id] !== undefined
        ? Number(editados[row.id] || 0)
        : Number(row.cantidad_minima || 0)

    if (actual < 0) return "negativo"
    if (actual <= minimo) return "bajo"
    return "ok"
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
        Cargando mínimos...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Editar mínimos
            </h1>
            <p className="text-white/80 mt-1">
              Configure el stock mínimo por almacén y por producto
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              href="/admin/inventario"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver a Inventario
            </Link>

            <Link
              href="/admin"
              className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
            >
              Volver al Admin
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-5">
          <div className="grid md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Buscar producto o almacén"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
            />

            <select
              value={filtroAlmacen}
              onChange={(e) => setFiltroAlmacen(e.target.value)}
              className="border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
            >
              <option value="">Todos los almacenes</option>
              {almacenes.map((almacen) => (
                <option key={almacen.id} value={almacen.id}>
                  {almacen.nombre}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border">
              <input
                type="checkbox"
                checked={soloBajos}
                onChange={(e) => setSoloBajos(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">
                Mostrar solo stock bajo/negativo
              </span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 pr-3">Almacén</th>
                  <th className="py-3 pr-3">Producto</th>
                  <th className="py-3 pr-3">Unidad</th>
                  <th className="py-3 pr-3">Actual</th>
                  <th className="py-3 pr-3">Mínimo</th>
                  <th className="py-3 pr-3">Estado</th>
                  <th className="py-3 pr-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row) => {
                  const estado = estadoRow(row)

                  return (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-800">
                        {row.almacenes?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {row.productos?.nombre || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {row.productos?.unidad_base || "-"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">
                        {Number(row.cantidad_actual || 0).toFixed(3)}
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={valorInput(row)}
                          onChange={(e) =>
                            setEditados((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          className="w-28 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0F6D6A]"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        {estado === "negativo" && (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                            Negativo
                          </span>
                        )}
                        {estado === "bajo" && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold">
                            Bajo
                          </span>
                        )}
                        {estado === "ok" && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          onClick={() => guardarMinimo(row.id)}
                          disabled={guardandoId === row.id}
                          className="bg-[#0F6D6A] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0c5a58] transition disabled:opacity-60"
                        >
                          {guardandoId === row.id ? "Guardando..." : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {rowsFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No se encontraron registros
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