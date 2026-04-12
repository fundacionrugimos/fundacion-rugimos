"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Proveedor = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  nit: string | null
  observaciones: string | null
  activo: boolean
  created_at: string
}

type FormProveedor = {
  nombre: string
  telefono: string
  email: string
  nit: string
  observaciones: string
  activo: boolean
}

const formInicial: FormProveedor = {
  nombre: "",
  telefono: "",
  email: "",
  nit: "",
  observaciones: "",
  activo: true,
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [busqueda, setBusqueda] = useState("")
  const [soloActivos, setSoloActivos] = useState(false)

  const [form, setForm] = useState<FormProveedor>(formInicial)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  useEffect(() => {
    cargarProveedores()
  }, [])

  async function cargarProveedores() {
    setCargando(true)

    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) {
      console.error(error)
      alert("No se pudieron cargar los proveedores.")
    }

    setProveedores((data || []) as Proveedor[])
    setCargando(false)
  }

  const proveedoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return proveedores.filter((p) => {
      if (soloActivos && !p.activo) return false

      if (!q) return true

      return (
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.telefono || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.nit || "").toLowerCase().includes(q) ||
        (p.observaciones || "").toLowerCase().includes(q)
      )
    })
  }, [proveedores, busqueda, soloActivos])

  function actualizarCampo<K extends keyof FormProveedor>(campo: K, valor: FormProveedor[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  function limpiarFormulario() {
    setForm(formInicial)
    setEditandoId(null)
  }

  function cargarParaEditar(proveedor: Proveedor) {
    setForm({
      nombre: proveedor.nombre || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      nit: proveedor.nit || "",
      observaciones: proveedor.observaciones || "",
      activo: proveedor.activo,
    })
    setEditandoId(proveedor.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function guardarProveedor(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nombre.trim()) {
      alert("Ingrese el nombre del proveedor.")
      return
    }

    setGuardando(true)

    try {
      if (editandoId) {
        const { error } = await supabase
          .from("proveedores")
          .update({
            nombre: form.nombre.trim(),
            telefono: form.telefono.trim() || null,
            email: form.email.trim() || null,
            nit: form.nit.trim() || null,
            observaciones: form.observaciones.trim() || null,
            activo: form.activo,
          })
          .eq("id", editandoId)

        if (error) {
          console.error(error)
          alert("No se pudo actualizar el proveedor.")
          return
        }

        alert("Proveedor actualizado correctamente.")
      } else {
        const { error } = await supabase
          .from("proveedores")
          .insert([
            {
              nombre: form.nombre.trim(),
              telefono: form.telefono.trim() || null,
              email: form.email.trim() || null,
              nit: form.nit.trim() || null,
              observaciones: form.observaciones.trim() || null,
              activo: form.activo,
            },
          ])

        if (error) {
          console.error(error)
          alert("No se pudo crear el proveedor.")
          return
        }

        alert("Proveedor creado correctamente.")
      }

      limpiarFormulario()
      await cargarProveedores()
    } catch (error) {
      console.error(error)
      alert("Ocurrió un error al guardar el proveedor.")
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(proveedor: Proveedor) {
    const accion = proveedor.activo ? "desactivar" : "activar"
    const ok = window.confirm(`¿Desea ${accion} este proveedor?`)
    if (!ok) return

    const { error } = await supabase
      .from("proveedores")
      .update({ activo: !proveedor.activo })
      .eq("id", proveedor.id)

    if (error) {
      console.error(error)
      alert("No se pudo actualizar el estado del proveedor.")
      return
    }

    await cargarProveedores()
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/inventario"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a inventario
          </Link>

          <Link
            href="/admin/inventario/entrada"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Nueva entrada
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <h1 className="text-3xl font-bold text-[#0F6D6A]">
                {editandoId ? "Editar proveedor" : "Nuevo proveedor"}
              </h1>
              <p className="text-gray-500 mt-2">
                Registre y administre proveedores de compras e insumos.
              </p>

              <form onSubmit={guardarProveedor} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre
                  </label>
                  <input
                    value={form.nombre}
                    onChange={(e) => actualizarCampo("nombre", e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    placeholder="Ej: Importadora San Marcos"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    value={form.telefono}
                    onChange={(e) => actualizarCampo("telefono", e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    placeholder="Ej: 7XXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => actualizarCampo("email", e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    placeholder="Ej: compras@proveedor.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NIT
                  </label>
                  <input
                    value={form.nit}
                    onChange={(e) => actualizarCampo("nit", e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    placeholder="Ej: 123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    rows={4}
                    value={form.observaciones}
                    onChange={(e) => actualizarCampo("observaciones", e.target.value)}
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                    placeholder="Ej: Maneja mejores precios por volumen..."
                  />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => actualizarCampo("activo", e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-gray-700">Proveedor activo</span>
                </label>

                <div className="flex gap-3 pt-2">
                  {editandoId && (
                    <button
                      type="button"
                      onClick={limpiarFormulario}
                      className="px-5 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold"
                    >
                      Cancelar edición
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-5 py-3 rounded-2xl bg-[#F47C3C] text-white font-semibold disabled:opacity-60"
                  >
                    {guardando
                      ? "Guardando..."
                      : editandoId
                      ? "Actualizar proveedor"
                      : "Guardar proveedor"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="xl:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F6D6A]">
                    Lista de proveedores
                  </h2>
                  <p className="text-gray-500 mt-1">
                    Controle proveedores activos, datos de contacto y observaciones.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:w-auto">
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar proveedor..."
                    className="border border-gray-300 rounded-2xl px-4 py-3 text-gray-800"
                  />

                  <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={soloActivos}
                      onChange={(e) => setSoloActivos(e.target.checked)}
                    />
                    Solo activos
                  </label>

                  <div className="rounded-2xl bg-[#0F6D6A]/5 border border-[#0F6D6A]/10 px-4 py-3">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-xl font-bold text-[#0F6D6A]">
                      {proveedoresFiltrados.length}
                    </p>
                  </div>
                </div>
              </div>

              {cargando ? (
                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
                  Cargando proveedores...
                </div>
              ) : proveedoresFiltrados.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">
                  No hay proveedores para mostrar.
                </div>
              ) : (
                <div className="space-y-4">
                  {proveedoresFiltrados.map((proveedor) => (
                    <div
                      key={proveedor.id}
                      className="border border-gray-200 rounded-3xl p-5 shadow-sm"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-bold text-[#0F6D6A]">
                              {proveedor.nombre}
                            </h3>

                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                proveedor.activo
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {proveedor.activo ? "activo" : "inactivo"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <p>
                              <span className="font-semibold">Teléfono:</span>{" "}
                              {proveedor.telefono || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">Email:</span>{" "}
                              {proveedor.email || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">NIT:</span>{" "}
                              {proveedor.nit || "-"}
                            </p>
                            <p>
                              <span className="font-semibold">Creado:</span>{" "}
                              {new Date(proveedor.created_at).toLocaleDateString("es-BO")}
                            </p>
                          </div>

                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">Observaciones:</span>{" "}
                            {proveedor.observaciones || "-"}
                          </p>
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => cargarParaEditar(proveedor)}
                            className="px-4 py-2 rounded-xl bg-[#0F6D6A] text-white font-semibold"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => cambiarEstado(proveedor)}
                            className={`px-4 py-2 rounded-xl font-semibold ${
                              proveedor.activo
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {proveedor.activo ? "Desactivar" : "Activar"}
                          </button>
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
  )
}