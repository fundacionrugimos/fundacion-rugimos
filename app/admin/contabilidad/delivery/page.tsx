"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id: string
  nome: string | null
  zona?: string | null
}

type TarifaDelivery = {
  id: string
  clinica_id: string
  valor: number | string | null
  activo: boolean | null
  observacion?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type DeliveryMovimiento = {
  id: string
  clinica_id: string | null
  pedido_id: string | null
  tipo: string
  fecha_movimiento: string
  cantidad: number
  valor_unitario: number | string | null
  monto_total: number | string | null
  descripcion?: string | null
  observacion?: string | null
  pagado: boolean | null
  fecha_pago?: string | null
  activo: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

type PedidoDelivery = {
  id: string
  clinica_id: string | null
  fecha_solicitada: string | null
  estado: string | null
  delivery_estado: string | null
  delivery_fecha: string | null
  fecha_entregado?: string | null
  created_at: string
  observaciones?: string | null
  transferencia_id?: string | null
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatMoney(value: unknown) {
  return `Bs ${toNumber(value).toFixed(2)}`
}

function formatDate(date?: string | null) {
  if (!date) return "-"
  const [y, m, d] = date.slice(0, 10).split("-")
  if (!y || !m || !d) return date
  return `${d}/${m}/${y}`
}

function formatDateTime(date?: string | null) {
  if (!date) return "-"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleString("es-BO")
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

function fechaRealPedido(pedido: PedidoDelivery) {
  return pedido.fecha_entregado || pedido.delivery_fecha || pedido.fecha_solicitada || ""
}

export default function AdminContabilidadDeliveryPage() {
  const [loading, setLoading] = useState(true)
  const [savingTarifaId, setSavingTarifaId] = useState<string | null>(null)
  const [savingManual, setSavingManual] = useState(false)
  const [updatingPagoId, setUpdatingPagoId] = useState<string | null>(null)

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [tarifas, setTarifas] = useState<TarifaDelivery[]>([])
  const [movimientos, setMovimientos] = useState<DeliveryMovimiento[]>([])
  const [pedidos, setPedidos] = useState<PedidoDelivery[]>([])

  const [fechaInicio, setFechaInicio] = useState(monthStartISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [clinicaFiltro, setClinicaFiltro] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [estadoPagoFiltro, setEstadoPagoFiltro] = useState("")

  const [manualClinicaId, setManualClinicaId] = useState("")
  const [manualFecha, setManualFecha] = useState(todayISO())
  const [manualCantidad, setManualCantidad] = useState("1")
  const [manualValorUnitario, setManualValorUnitario] = useState("")
  const [manualTipo, setManualTipo] = useState("manual")
  const [manualDescripcion, setManualDescripcion] = useState("Carga manual delivery")
  const [manualObservacion, setManualObservacion] = useState("")

  const [tarifasForm, setTarifasForm] = useState<
    Record<string, { valor: string; activo: boolean; observacion: string }>
  >({})

  async function cargarDatos() {
    setLoading(true)

    const [clinicasRes, tarifasRes, movimientosRes, pedidosRes] = await Promise.all([
      supabase.from("clinicas").select("id,nome,zona").order("nome", { ascending: true }),

      supabase
        .from("tarifas_delivery")
        .select("id,clinica_id,valor,activo,observacion,created_at,updated_at")
        .order("updated_at", { ascending: false }),

      supabase
        .from("delivery_movimientos")
        .select(`
          id,
          clinica_id,
          pedido_id,
          tipo,
          fecha_movimiento,
          cantidad,
          valor_unitario,
          monto_total,
          descripcion,
          observacion,
          pagado,
          fecha_pago,
          activo,
          created_at,
          updated_at
        `)
        .order("fecha_movimiento", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("pedidos_clinicas")
        .select(`
          id,
          clinica_id,
          fecha_solicitada,
          estado,
          delivery_estado,
          delivery_fecha,
          fecha_entregado,
          created_at,
          observaciones,
          transferencia_id
        `)
        .in("estado", ["aprobado", "convertido", "entregado"])
        .order("fecha_solicitada", { ascending: false })
        .order("created_at", { ascending: false }),
    ])

    if (clinicasRes.error) {
      console.log("Error cargando clínicas:", clinicasRes.error)
      alert("No se pudieron cargar las clínicas.")
    }

    if (tarifasRes.error) {
      console.log("Error cargando tarifas delivery:", tarifasRes.error)
      alert("No se pudieron cargar las tarifas de delivery.")
    }

    if (movimientosRes.error) {
      console.log("Error cargando movimientos delivery:", movimientosRes.error)
      alert("No se pudieron cargar los movimientos de delivery.")
    }

    if (pedidosRes.error) {
      console.log("Error cargando pedidos delivery:", pedidosRes.error)
      alert("No se pudieron cargar los pedidos del delivery.")
    }

    const clinicasData = (clinicasRes.data as Clinica[]) || []
    const tarifasData = (tarifasRes.data as TarifaDelivery[]) || []
    const movimientosData = (movimientosRes.data as DeliveryMovimiento[]) || []
    const pedidosData = (pedidosRes.data as PedidoDelivery[]) || []

    setClinicas(clinicasData)
    setTarifas(tarifasData)
    setMovimientos(movimientosData)
    setPedidos(pedidosData)

    const tarifasMap: Record<
      string,
      { valor: string; activo: boolean; observacion: string }
    > = {}

    clinicasData.forEach((clinica) => {
      const tarifa = tarifasData.find((t) => t.clinica_id === clinica.id)
      tarifasMap[clinica.id] = {
        valor: tarifa ? String(toNumber(tarifa.valor)) : "",
        activo: tarifa ? Boolean(tarifa.activo) : true,
        observacion: tarifa?.observacion || "",
      }
    })

    setTarifasForm(tarifasMap)
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const mapaClinicas = useMemo(() => {
    const map = new Map<string, Clinica>()
    clinicas.forEach((c) => map.set(c.id, c))
    return map
  }, [clinicas])

  const mapaTarifas = useMemo(() => {
    const map = new Map<string, TarifaDelivery>()
    tarifas.forEach((t) => map.set(t.clinica_id, t))
    return map
  }, [tarifas])

  const movimientosActivos = useMemo(() => {
    return movimientos.filter((mov) => mov.activo !== false)
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    return movimientosActivos.filter((m) => {
      const fecha = m.fecha_movimiento?.slice(0, 10) || ""

      if (fechaInicio && fecha < fechaInicio) return false
      if (fechaFin && fecha > fechaFin) return false
      if (clinicaFiltro && m.clinica_id !== clinicaFiltro) return false
      if (tipoFiltro && normalize(m.tipo) !== normalize(tipoFiltro)) return false

      if (estadoPagoFiltro === "pagado" && !m.pagado) return false
      if (estadoPagoFiltro === "pendiente" && m.pagado) return false

      return true
    })
  }, [movimientosActivos, fechaInicio, fechaFin, clinicaFiltro, tipoFiltro, estadoPagoFiltro])

  const pedidosEntregadosFiltrados = useMemo(() => {
    return pedidos.filter((pedido) => {
      if (normalize(pedido.delivery_estado) !== "entregado") return false

      const fecha = fechaRealPedido(pedido).slice(0, 10)
      if (!fecha) return false

      if (fechaInicio && fecha < fechaInicio) return false
      if (fechaFin && fecha > fechaFin) return false
      if (clinicaFiltro && pedido.clinica_id !== clinicaFiltro) return false

      return true
    })
  }, [pedidos, fechaInicio, fechaFin, clinicaFiltro])

  const pedidosConValor = useMemo(() => {
    return pedidosEntregadosFiltrados.map((pedido) => {
      const tarifa = pedido.clinica_id ? mapaTarifas.get(pedido.clinica_id) : null
      const valor = tarifa?.activo === false ? 0 : toNumber(tarifa?.valor)

      return {
        ...pedido,
        valor_delivery: valor,
      }
    })
  }, [pedidosEntregadosFiltrados, mapaTarifas])

  const movimientosManualAjustesFiltrados = useMemo(() => {
    return movimientosFiltrados.filter((mov) =>
      ["manual", "ajuste_positivo", "ajuste_negativo"].includes(normalize(mov.tipo))
    )
  }, [movimientosFiltrados])

  const resumenGeneral = useMemo(() => {
    const totalPedidos = pedidosConValor.reduce(
      (acc, pedido) => acc + toNumber(pedido.valor_delivery),
      0
    )

    const totalMovimientosAdmin = movimientosManualAjustesFiltrados.reduce(
      (acc, mov) => acc + toNumber(mov.monto_total),
      0
    )

    const pagadoMovimientos = movimientosManualAjustesFiltrados.reduce((acc, mov) => {
      return acc + (mov.pagado ? toNumber(mov.monto_total) : 0)
    }, 0)

    const pendienteMovimientos = movimientosManualAjustesFiltrados.reduce((acc, mov) => {
      return acc + (!mov.pagado ? toNumber(mov.monto_total) : 0)
    }, 0)

    return {
      total: totalPedidos + totalMovimientosAdmin,
      total_delivery_real: totalPedidos,
      total_admin_manual: totalMovimientosAdmin,
      pagado: pagadoMovimientos,
      pendiente: totalPedidos + pendienteMovimientos,
      movimientos: movimientosManualAjustesFiltrados.length,
      carreras:
        pedidosConValor.length +
        movimientosManualAjustesFiltrados.reduce((acc, mov) => acc + toNumber(mov.cantidad), 0),
      carreras_real: pedidosConValor.length,
      carreras_admin: movimientosManualAjustesFiltrados.reduce(
        (acc, mov) => acc + toNumber(mov.cantidad),
        0
      ),
    }
  }, [pedidosConValor, movimientosManualAjustesFiltrados])

  const resumenPorClinica = useMemo(() => {
    const acc: Record<
      string,
      {
        clinica_id: string
        clinica: string
        movimientos: number
        carreras: number
        total: number
        pagado: number
        pendiente: number
        total_delivery_real: number
        total_admin_manual: number
      }
    > = {}

    pedidosConValor.forEach((pedido) => {
      const clinicaId = pedido.clinica_id || "sin_clinica"
      const clinicaNombre =
        (pedido.clinica_id ? mapaClinicas.get(pedido.clinica_id)?.nome : null) || "Sin clínica"

      if (!acc[clinicaId]) {
        acc[clinicaId] = {
          clinica_id: clinicaId,
          clinica: clinicaNombre,
          movimientos: 0,
          carreras: 0,
          total: 0,
          pagado: 0,
          pendiente: 0,
          total_delivery_real: 0,
          total_admin_manual: 0,
        }
      }

      const monto = toNumber(pedido.valor_delivery)
      acc[clinicaId].carreras += 1
      acc[clinicaId].total += monto
      acc[clinicaId].pendiente += monto
      acc[clinicaId].total_delivery_real += monto
    })

    movimientosManualAjustesFiltrados.forEach((mov) => {
      const clinicaId = mov.clinica_id || "sin_clinica"
      const clinicaNombre =
        (mov.clinica_id ? mapaClinicas.get(mov.clinica_id)?.nome : null) || "Sin clínica"

      if (!acc[clinicaId]) {
        acc[clinicaId] = {
          clinica_id: clinicaId,
          clinica: clinicaNombre,
          movimientos: 0,
          carreras: 0,
          total: 0,
          pagado: 0,
          pendiente: 0,
          total_delivery_real: 0,
          total_admin_manual: 0,
        }
      }

      const monto = toNumber(mov.monto_total)
      acc[clinicaId].movimientos += 1
      acc[clinicaId].carreras += toNumber(mov.cantidad)
      acc[clinicaId].total += monto
      acc[clinicaId].total_admin_manual += monto

      if (mov.pagado) {
        acc[clinicaId].pagado += monto
      } else {
        acc[clinicaId].pendiente += monto
      }
    })

    return Object.values(acc).sort((a, b) => b.pendiente - a.pendiente)
  }, [pedidosConValor, movimientosManualAjustesFiltrados, mapaClinicas])

  function onChangeTarifaForm(
    clinicaId: string,
    field: "valor" | "activo" | "observacion",
    value: string | boolean
  ) {
    setTarifasForm((prev) => ({
      ...prev,
      [clinicaId]: {
        valor: prev[clinicaId]?.valor ?? "",
        activo: prev[clinicaId]?.activo ?? true,
        observacion: prev[clinicaId]?.observacion ?? "",
        [field]: value,
      },
    }))
  }

  async function guardarTarifa(clinicaId: string) {
    const form = tarifasForm[clinicaId]

    if (!form) return

    setSavingTarifaId(clinicaId)

    const tarifaExistente = mapaTarifas.get(clinicaId)

    const payload = {
      clinica_id: clinicaId,
      valor: toNumber(form.valor),
      activo: Boolean(form.activo),
      observacion: form.observacion || null,
      updated_at: new Date().toISOString(),
    }

    let error = null as any

    if (tarifaExistente) {
      const res = await supabase
        .from("tarifas_delivery")
        .update(payload)
        .eq("id", tarifaExistente.id)

      error = res.error
    } else {
      const res = await supabase.from("tarifas_delivery").insert(payload)
      error = res.error
    }

    if (error) {
      console.log("Error guardando tarifa:", error)
      alert("No se pudo guardar la tarifa.")
      setSavingTarifaId(null)
      return
    }

    await cargarDatos()
    setSavingTarifaId(null)
  }

  async function registrarMovimientoManual() {
    if (!manualClinicaId) {
      alert("Seleccione una clínica.")
      return
    }

    const cantidad = Math.max(toNumber(manualCantidad), 1)
    const valorUnitario = toNumber(manualValorUnitario)
    const montoTotal = cantidad * valorUnitario

    if (!manualFecha) {
      alert("Seleccione la fecha.")
      return
    }

    setSavingManual(true)

    const { error } = await supabase.from("delivery_movimientos").insert({
      clinica_id: manualClinicaId,
      tipo: manualTipo,
      fecha_movimiento: manualFecha,
      cantidad,
      valor_unitario: valorUnitario,
      monto_total: montoTotal,
      descripcion: manualDescripcion || null,
      observacion: manualObservacion || null,
      pagado: false,
      activo: true,
    })

    if (error) {
      console.log("Error registrando movimiento manual:", error)
      alert("No se pudo registrar el movimiento manual.")
      setSavingManual(false)
      return
    }

    setManualCantidad("1")
    setManualValorUnitario("")
    setManualDescripcion("Carga manual delivery")
    setManualObservacion("")
    await cargarDatos()
    setSavingManual(false)
  }

  async function marcarPagado(movimientoId: string, pagadoActual: boolean | null) {
    setUpdatingPagoId(movimientoId)

    const { error } = await supabase
      .from("delivery_movimientos")
      .update({
        pagado: !pagadoActual,
        fecha_pago: !pagadoActual ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", movimientoId)

    if (error) {
      console.log("Error actualizando pago delivery:", error)
      alert("No se pudo actualizar el estado de pago.")
      setUpdatingPagoId(null)
      return
    }

    await cargarDatos()
    setUpdatingPagoId(null)
  }

  function completarValorDesdeTarifa(clinicaId: string) {
    const tarifa = mapaTarifas.get(clinicaId)
    setManualValorUnitario(String(toNumber(tarifa?.valor)))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl font-bold">
        Cargando control financiero delivery...
      </div>
    )
  }

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

          <button
            onClick={cargarDatos}
            className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:opacity-90 transition"
          >
            Actualizar
          </button>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 border border-white/60">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">
                Control financiero delivery
              </h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Administre tarifas por clínica, registre carreras manuales o retroactivas
                y controle el pago del delivery desde contabilidad.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full xl:min-w-[520px]">
              <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 px-4 py-3">
                <p className="text-xs text-gray-500">Total generado</p>
                <p className="text-lg font-bold text-[#0F6D6A]">
                  {formatMoney(resumenGeneral.total)}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs text-gray-500">Pagado</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatMoney(resumenGeneral.pagado)}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs text-gray-500">Pendiente</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatMoney(resumenGeneral.pendiente)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-xs text-gray-500">Carreras</p>
                <p className="text-lg font-bold text-sky-600">
                  {resumenGeneral.carreras}
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="rounded-2xl border border-[#DDEEEE] bg-[#F7FBFB] px-4 py-4">
              <p className="text-xs text-gray-500">Delivery real</p>
              <p className="text-xl font-bold text-[#0F6D6A] mt-1">
                {formatMoney(resumenGeneral.total_delivery_real)}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-xs text-gray-500">Admin manual / ajustes</p>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {formatMoney(resumenGeneral.total_admin_manual)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-xs text-gray-500">Total consolidado</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {formatMoney(resumenGeneral.total)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl p-5 md:p-6">
          <h2 className="text-2xl font-bold text-[#0F6D6A] mb-4">
            Filtros del período
          </h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
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
                    {clinica.nome || "Clínica"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="manual">Manual</option>
                <option value="ajuste_positivo">Ajuste positivo</option>
                <option value="ajuste_negativo">Ajuste negativo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado de pago
              </label>
              <select
                value={estadoPagoFiltro}
                onChange={(e) => setEstadoPagoFiltro(e.target.value)}
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="bg-white rounded-[2rem] shadow-xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold text-[#0F6D6A]">
                Tarifas por clínica
              </h2>
              <span className="text-sm text-gray-500">
                {clinicas.length} clínicas
              </span>
            </div>

            <div className="space-y-4">
              {clinicas.map((clinica) => {
                const form = tarifasForm[clinica.id] || {
                  valor: "",
                  activo: true,
                  observacion: "",
                }

                return (
                  <div
                    key={clinica.id}
                    className="rounded-[1.5rem] border border-gray-200 p-4 md:p-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-[#0F6D6A]">
                          {clinica.nome || "Clínica"}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Zona: {clinica.zona || "-"}
                        </p>
                      </div>

                      <div
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          form.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {form.activo ? "Tarifa activa" : "Tarifa inactiva"}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Valor por carrera
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.valor}
                          onChange={(e) =>
                            onChangeTarifaForm(clinica.id, "valor", e.target.value)
                          }
                          className="w-full border rounded-xl px-4 py-3"
                          placeholder="Ej: 20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Estado
                        </label>
                        <select
                          value={form.activo ? "true" : "false"}
                          onChange={(e) =>
                            onChangeTarifaForm(
                              clinica.id,
                              "activo",
                              e.target.value === "true"
                            )
                          }
                          className="w-full border rounded-xl px-4 py-3"
                        >
                          <option value="true">Activa</option>
                          <option value="false">Inactiva</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Observación
                        </label>
                        <input
                          type="text"
                          value={form.observacion}
                          onChange={(e) =>
                            onChangeTarifaForm(clinica.id, "observacion", e.target.value)
                          }
                          className="w-full border rounded-xl px-4 py-3"
                          placeholder="Ej: tarifa abril 2026"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => guardarTarifa(clinica.id)}
                        disabled={savingTarifaId === clinica.id}
                        className="bg-[#F47C3C] text-white px-5 py-3 rounded-xl font-bold shadow hover:opacity-90 transition disabled:opacity-50"
                      >
                        {savingTarifaId === clinica.id ? "Guardando..." : "Guardar tarifa"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-5 md:p-6">
            <h2 className="text-2xl font-bold text-[#0F6D6A] mb-4">
              Registrar carrera manual / retroactiva
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Clínica
                </label>
                <select
                  value={manualClinicaId}
                  onChange={(e) => {
                    setManualClinicaId(e.target.value)
                    if (e.target.value) completarValorDesdeTarifa(e.target.value)
                  }}
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="">Seleccione</option>
                  {clinicas.map((clinica) => (
                    <option key={clinica.id} value={clinica.id}>
                      {clinica.nome || "Clínica"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={manualFecha}
                    onChange={(e) => setManualFecha(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo
                  </label>
                  <select
                    value={manualTipo}
                    onChange={(e) => setManualTipo(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  >
                    <option value="manual">Manual</option>
                    <option value="ajuste_positivo">Ajuste positivo</option>
                    <option value="ajuste_negativo">Ajuste negativo</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cantidad de carreras
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={manualCantidad}
                    onChange={(e) => setManualCantidad(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Valor unitario
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualValorUnitario}
                    onChange={(e) => setManualValorUnitario(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={manualDescripcion}
                  onChange={(e) => setManualDescripcion(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3"
                  placeholder="Ej: carga retroactiva delivery"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observación
                </label>
                <textarea
                  value={manualObservacion}
                  onChange={(e) => setManualObservacion(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 min-h-[110px]"
                  placeholder="Ej: 2 carreras del lunes / ajuste especial / etc."
                />
              </div>

              <div className="rounded-2xl bg-[#F8FAFA] border border-[#DDEEEE] p-4">
                <p className="text-sm text-gray-500">Total calculado</p>
                <p className="text-2xl font-bold text-[#0F6D6A] mt-1">
                  {formatMoney(toNumber(manualCantidad) * toNumber(manualValorUnitario))}
                </p>
              </div>

              <button
                onClick={registrarMovimientoManual}
                disabled={savingManual}
                className="w-full bg-[#F47C3C] text-white py-3 rounded-xl font-bold shadow hover:opacity-90 transition disabled:opacity-50"
              >
                {savingManual ? "Guardando..." : "Registrar movimiento"}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-[#0F6D6A]">
              Resumen por clínica
            </h2>
            <span className="text-sm text-gray-500">
              {resumenPorClinica.length} resultados
            </span>
          </div>

          {resumenPorClinica.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 p-6 text-center text-gray-500">
              No hay movimientos en el período seleccionado.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {resumenPorClinica.map((item) => (
                <div
                  key={item.clinica_id}
                  className="rounded-[1.5rem] border border-gray-200 p-5"
                >
                  <h3 className="text-lg font-bold text-[#0F6D6A]">
                    {item.clinica}
                  </h3>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p>
                      Carreras: <span className="font-bold">{item.carreras}</span>
                    </p>
                    <p>
                      Delivery real:{" "}
                      <span className="font-bold">{formatMoney(item.total_delivery_real)}</span>
                    </p>
                    <p>
                      Admin manual:{" "}
                      <span className="font-bold">{formatMoney(item.total_admin_manual)}</span>
                    </p>
                    <p>
                      Total generado:{" "}
                      <span className="font-bold">{formatMoney(item.total)}</span>
                    </p>
                    <p className="text-emerald-600">
                      Pagado: <span className="font-bold">{formatMoney(item.pagado)}</span>
                    </p>
                    <p className="text-amber-600">
                      Pendiente: <span className="font-bold">{formatMoney(item.pendiente)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-[#0F6D6A]">
              Historial de movimientos
            </h2>
            <span className="text-sm text-gray-500">
              {movimientosManualAjustesFiltrados.length} movimientos
            </span>
          </div>

          {movimientosManualAjustesFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 p-6 text-center text-gray-500">
              No hay movimientos para mostrar.
            </div>
          ) : (
            <div className="space-y-4">
              {movimientosManualAjustesFiltrados.map((mov) => {
                const clinicaNombre =
                  (mov.clinica_id ? mapaClinicas.get(mov.clinica_id)?.nome : null) ||
                  "Sin clínica"

                return (
                  <div
                    key={mov.id}
                    className="rounded-[1.5rem] border border-gray-200 p-4 md:p-5"
                  >
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-[#0F6D6A]">
                            {clinicaNombre}
                          </h3>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              mov.pagado
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {mov.pagado ? "Pagado" : "Pendiente"}
                          </span>

                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0F6D6A]/10 text-[#0F6D6A]">
                            {mov.tipo}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-gray-500 space-y-1">
                          <p>Fecha: {formatDate(mov.fecha_movimiento)}</p>
                          <p>Creado: {formatDateTime(mov.created_at)}</p>
                          {mov.fecha_pago && <p>Fecha pago: {formatDateTime(mov.fecha_pago)}</p>}
                          {mov.pedido_id && <p>Pedido: #{mov.pedido_id.slice(0, 8).toUpperCase()}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:min-w-[520px]">
                        <div className="rounded-2xl bg-[#F7FBFB] border border-[#DDEEEE] p-4">
                          <p className="text-xs text-gray-500">Cantidad</p>
                          <p className="font-bold text-[#0F6D6A] mt-1">
                            {mov.cantidad}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                          <p className="text-xs text-blue-700">Valor unitario</p>
                          <p className="font-bold text-blue-700 mt-1">
                            {formatMoney(mov.valor_unitario)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                          <p className="text-xs text-emerald-700">Monto total</p>
                          <p className="font-bold text-emerald-700 mt-1">
                            {formatMoney(mov.monto_total)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                          <p className="text-xs text-amber-700">Pago</p>
                          <button
                            onClick={() => marcarPagado(mov.id, mov.pagado)}
                            disabled={updatingPagoId === mov.id}
                            className="mt-1 text-sm font-bold text-amber-700 hover:underline disabled:opacity-50"
                          >
                            {updatingPagoId === mov.id
                              ? "Actualizando..."
                              : mov.pagado
                              ? "Desmarcar pago"
                              : "Marcar pago"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {(mov.descripcion || mov.observacion) && (
                      <div className="mt-4 grid md:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#F8FAFA] border border-[#E7F1F1] p-4">
                          <p className="text-sm font-semibold text-[#0F6D6A]">
                            Descripción
                          </p>
                          <p className="text-sm text-gray-700 mt-2">
                            {mov.descripcion || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#F8FAFA] border border-[#E7F1F1] p-4">
                          <p className="text-sm font-semibold text-[#0F6D6A]">
                            Observación
                          </p>
                          <p className="text-sm text-gray-700 mt-2">
                            {mov.observacion || "-"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}