"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Almacen = {
  id: string
  nombre: string
  tipo: string | null
  clinica_id: string | null
}

type Producto = {
  id: string
  nombre: string
  stock_minimo: number | null
  unidad_base: string | null
}

type StockAlmacen = {
  id: string
  almacen_id: string
  producto_id: string
  cantidad_actual: number
  cantidad_minima: number | null
}

type ItemEntrada = {
  localId: string
  producto_id: string
  cantidad: string
}

function crearItemVacio(): ItemEntrada {
  return {
    localId: crypto.randomUUID(),
    producto_id: "",
    cantidad: "",
  }
}

export default function InventarioEntradaPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const [almacenId, setAlmacenId] = useState("")
  const [motivo, setMotivo] = useState("compra")
  const [observacion, setObservacion] = useState("")
  const [items, setItems] = useState<ItemEntrada[]>([crearItemVacio()])

  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargandoDatos(true)

    const [almacenesRes, productosRes] = await Promise.all([
      supabase
        .from("almacenes")
        .select("id,nombre,tipo,clinica_id")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("productos")
        .select("id,nombre,stock_minimo,unidad_base")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
    ])

    if (almacenesRes.error) {
      console.error(almacenesRes.error)
      alert("No se pudieron cargar los almacenes.")
    }

    if (productosRes.error) {
      console.error(productosRes.error)
      alert("No se pudieron cargar los productos.")
    }

    const almacenesData = (almacenesRes.data || []) as Almacen[]
    const productosData = (productosRes.data || []) as Producto[]

    setAlmacenes(almacenesData)
    setProductos(productosData)

    if (almacenesData.length > 0) {
      const almacenCentral =
        almacenesData.find((a) =>
          (a.nombre || "").toLowerCase().includes("central")
        ) || almacenesData[0]

      setAlmacenId(almacenCentral.id)
    }

    setCargandoDatos(false)
  }

  const almacenSeleccionado = useMemo(() => {
    return almacenes.find((a) => a.id === almacenId) || null
  }, [almacenes, almacenId])

  const motivoLabel = useMemo(() => {
    if (motivo === "compra") return "Compra"
    if (motivo === "donacion") return "Donación"
    if (motivo === "ajuste_inicial") return "Ajuste inicial"
    if (motivo === "reposicion") return "Reposición"
    if (motivo === "devolucion") return "Devolución"
    return "Entrada manual"
  }, [motivo])

  const totalItemsValidos = useMemo(() => {
    return items.filter((item) => item.producto_id && Number(item.cantidad) > 0).length
  }, [items])

  function actualizarItem(localId: string, campo: "producto_id" | "cantidad", valor: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [campo]: valor } : item
      )
    )
  }

  function agregarItem() {
    setItems((prev) => [...prev, crearItemVacio()])
  }

  function eliminarItem(localId: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((item) => item.localId !== localId)
    })
  }

  function productoDeItem(productoId: string) {
    return productos.find((p) => p.id === productoId) || null
  }

  async function registrarEntrada(e: React.FormEvent) {
    e.preventDefault()

    if (!almacenId) {
      alert("Seleccione un almacén.")
      return
    }

    const itemsValidos = items
      .map((item) => ({
        ...item,
        cantidadNumero: Number(item.cantidad),
      }))
      .filter(
        (item) =>
          item.producto_id &&
          item.cantidad &&
          !Number.isNaN(item.cantidadNumero) &&
          item.cantidadNumero > 0
      )

    if (itemsValidos.length === 0) {
      alert("Agregue al menos un producto válido.")
      return
    }

    const productosDuplicados = new Set<string>()
    const repetidos = new Set<string>()

    for (const item of itemsValidos) {
      if (productosDuplicados.has(item.producto_id)) {
        repetidos.add(item.producto_id)
      }
      productosDuplicados.add(item.producto_id)
    }

    if (repetidos.size > 0) {
      alert("Hay productos repetidos en la misma entrada. Unifique las cantidades.")
      return
    }

    setGuardando(true)

    try {
      const { data: entradaCreada, error: entradaError } = await supabase
        .from("entradas_inventario")
        .insert([
          {
            almacen_id: almacenId,
            motivo: motivoLabel,
            observacion: observacion.trim() || null,
          },
        ])
        .select("id")
        .single()

      if (entradaError || !entradaCreada) {
        console.error(entradaError)
        alert("No se pudo crear la entrada.")
        return
      }

      const entradaId = entradaCreada.id

      const itemsParaHistorico = itemsValidos.map((item) => {
        const producto = productoDeItem(item.producto_id)
        return {
          entrada_id: entradaId,
          producto_id: item.producto_id,
          cantidad: item.cantidadNumero,
          unidad: producto?.unidad_base || "unidad",
        }
      })

      const { error: itemsHistoricoError } = await supabase
        .from("entradas_inventario_items")
        .insert(itemsParaHistorico)

      if (itemsHistoricoError) {
        console.error(itemsHistoricoError)
        alert("Se creó la entrada, pero falló el historial de items.")
        return
      }

      for (const item of itemsValidos) {
        const producto = productoDeItem(item.producto_id)
        const cantidadNumero = item.cantidadNumero

        const { data: stockExistente, error: stockError } = await supabase
          .from("stock_almacen")
          .select("id,almacen_id,producto_id,cantidad_actual,cantidad_minima")
          .eq("almacen_id", almacenId)
          .eq("producto_id", item.producto_id)
          .maybeSingle()

        if (stockError) {
          console.error(stockError)
          alert(`No se pudo verificar stock de ${producto?.nombre || "un producto"}.`)
          return
        }

        let cantidadMinima = Number(producto?.stock_minimo || 0)

        if (stockExistente) {
          const row = stockExistente as StockAlmacen
          cantidadMinima = Number(row.cantidad_minima ?? producto?.stock_minimo ?? 0)

          const { error: updateError } = await supabase
            .from("stock_almacen")
            .update({
              cantidad_actual: Number(row.cantidad_actual || 0) + cantidadNumero,
            })
            .eq("id", row.id)

          if (updateError) {
            console.error(updateError)
            alert(`No se pudo actualizar stock de ${producto?.nombre || "un producto"}.`)
            return
          }
        } else {
          const { error: insertStockError } = await supabase
            .from("stock_almacen")
            .insert([
              {
                almacen_id: almacenId,
                producto_id: item.producto_id,
                cantidad_actual: cantidadNumero,
                cantidad_minima: cantidadMinima,
              },
            ])

          if (insertStockError) {
            console.error(insertStockError)
            alert(`No se pudo crear stock para ${producto?.nombre || "un producto"}.`)
            return
          }
        }

        const motivoMovimiento = observacion.trim()
          ? `${motivoLabel} - ${observacion.trim()}`
          : motivoLabel

        const { error: movimientoError } = await supabase
          .from("movimientos_stock")
          .insert([
            {
              producto_id: item.producto_id,
              almacen_destino_id: almacenId,
              tipo_movimiento: "entrada_manual",
              cantidad: cantidadNumero,
              motivo: motivoMovimiento,
            },
          ])

        if (movimientoError) {
          console.error(movimientoError)
          alert(`El stock de ${producto?.nombre || "un producto"} se actualizó, pero falló el movimiento.`)
          return
        }
      }

      alert("Entrada registrada correctamente.")

      setMotivo("compra")
      setObservacion("")
      setItems([crearItemVacio()])
    } catch (error) {
      console.error(error)
      alert("Ocurrió un error al registrar la entrada.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/inventario"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a Inventario
          </Link>

          <Link
            href="/admin/inventario/entradas"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Historial de entradas
          </Link>

          <Link
            href="/admin/inventario/stock"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Stock por almacén
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0F6D6A]">
              Registrar entrada
            </h1>
            <p className="text-gray-500 mt-2">
              Registre varios productos en un solo ingreso de inventario.
            </p>
          </div>

          {cargandoDatos ? (
            <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
              Cargando datos...
            </div>
          ) : (
            <form onSubmit={registrarEntrada} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Almacén
                  </label>
                  <select
                    value={almacenId}
                    onChange={(e) => setAlmacenId(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    <option value="">Seleccione...</option>
                    {almacenes.map((almacen) => (
                      <option key={almacen.id} value={almacen.id}>
                        {almacen.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Motivo
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  >
                    <option value="compra">Compra</option>
                    <option value="donacion">Donación</option>
                    <option value="ajuste_inicial">Ajuste inicial</option>
                    <option value="reposicion">Reposición</option>
                    <option value="devolucion">Devolución</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observación general
                </label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={3}
                  placeholder="Ej: Compra general de insumos de marzo..."
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                />
              </div>

              <div className="bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F6D6A]">
                      Productos de la entrada
                    </h2>
                    <p className="text-sm text-gray-500">
                      Agregue todos los productos que llegaron en este ingreso.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={agregarItem}
                    className="px-4 py-2 rounded-xl bg-[#F47C3C] text-white font-semibold hover:bg-[#db6d31] transition"
                  >
                    + Agregar producto
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const producto = productoDeItem(item.producto_id)
                    const unidad = producto?.unidad_base || "unidad"

                    return (
                      <div
                        key={item.localId}
                        className="bg-white border border-gray-200 rounded-2xl p-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Producto #{index + 1}
                            </label>
                            <select
                              value={item.producto_id}
                              onChange={(e) =>
                                actualizarItem(item.localId, "producto_id", e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                            >
                              <option value="">Seleccione...</option>
                              {productos.map((producto) => (
                                <option key={producto.id} value={producto.id}>
                                  {producto.nombre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Cantidad
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.cantidad}
                              onChange={(e) =>
                                actualizarItem(item.localId, "cantidad", e.target.value)
                              }
                              placeholder="Ej: 20"
                              className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Unidad
                            </label>
                            <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-700">
                              {unidad}
                            </div>
                          </div>

                          <div className="md:col-span-1">
                            <button
                              type="button"
                              onClick={() => eliminarItem(item.localId)}
                              disabled={items.length === 1}
                              className="w-full px-3 py-3 rounded-2xl bg-red-100 text-red-700 font-bold disabled:opacity-50"
                              title="Eliminar producto"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#0F6D6A] mb-3">
                  Resumen
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold">Almacén:</span>{" "}
                    {almacenSeleccionado?.nombre || "-"}
                  </p>

                  <p>
                    <span className="font-semibold">Motivo:</span>{" "}
                    {motivoLabel}
                  </p>

                  <p>
                    <span className="font-semibold">Productos válidos:</span>{" "}
                    {totalItemsValidos}
                  </p>

                  <p>
                    <span className="font-semibold">Observación:</span>{" "}
                    {observacion.trim() || "-"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Link
                  href="/admin/inventario"
                  className="px-6 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold text-center"
                >
                  Cancelar
                </Link>

                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-3 rounded-2xl bg-[#F47C3C] text-white font-semibold disabled:opacity-60"
                >
                  {guardando ? "Registrando..." : "Registrar entrada"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}