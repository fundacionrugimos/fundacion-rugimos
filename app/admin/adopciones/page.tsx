"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Adopcion = {
  id: string
  created_at: string
  updated_at: string

  responsable_nombre: string
  responsable_apellido: string | null
  responsable_ci: string | null
  responsable_telefono: string | null
  responsable_whatsapp: string | null
  responsable_zona: string | null
  responsable_direccion: string | null

  animal_nombre: string
  especie: "Perro" | "Gato"
  sexo: "Macho" | "Hembra"
  edad: string | null
  peso: number | null
  tamano: string | null
  raza: string | null
  color: string | null

  vacunado: boolean | null
  esterilizado: boolean | null
  desparasitado: boolean | null
  come_croqueta: boolean | null
  usa_arenero: boolean | null
  sabe_pasear_con_correa: boolean | null
  convive_con_perros: boolean | null
  convive_con_gatos: boolean | null
  convive_con_ninos: boolean | null

  temperamento: string | null
  historial_medico: string | null
  observaciones: string | null
  motivo_adopcion: string | null

  foto_principal_url: string | null
  fotos_extra: string[] | null
  foto_pos_x: number | null
  foto_pos_y: number | null
  foto_zoom: number | null

  estado: "pendiente" | "aprobado" | "rechazado" | "reservado" | "adoptado"
  destacado: boolean
  visible_publico: boolean

  fecha_aprobacion: string | null
  fecha_rechazo: string | null
  fecha_reserva: string | null
  fecha_adopcion: string | null

  admin_observaciones: string | null
}

type EditForm = {
  responsable_nombre: string
  responsable_apellido: string
  responsable_ci: string
  responsable_telefono: string
  responsable_whatsapp: string
  responsable_zona: string
  responsable_direccion: string

  animal_nombre: string
  especie: "Perro" | "Gato" | ""
  sexo: "Macho" | "Hembra" | ""
  edad: string
  peso: string
  tamano: string
  raza: string
  color: string

  vacunado: boolean
  esterilizado: boolean
  desparasitado: boolean
  come_croqueta: boolean
  usa_arenero: boolean
  sabe_pasear_con_correa: boolean
  convive_con_perros: boolean
  convive_con_gatos: boolean
  convive_con_ninos: boolean

  temperamento: string
  historial_medico: string
  observaciones: string
  motivo_adopcion: string

  admin_observaciones: string

  foto_pos_x: number
  foto_pos_y: number
  foto_zoom: number
}

const ESTADOS = ["todos", "pendiente", "aprobado", "rechazado", "reservado", "adoptado"] as const
const ESPECIES = ["todas", "Perro", "Gato"] as const
const SEXOS = ["todos", "Macho", "Hembra"] as const

type TabKey = "pendiente" | "aprobado" | "historial"

function formatFecha(fecha?: string | null) {
  if (!fecha) return "Sin fecha"
  try {
    return new Date(fecha).toLocaleString("es-BO")
  } catch {
    return fecha
  }
}

function boolLabel(value?: boolean | null, yes = "Sí", no = "No") {
  return value ? yes : no
}

function createEditForm(item: Adopcion): EditForm {
  return {
    responsable_nombre: item.responsable_nombre || "",
    responsable_apellido: item.responsable_apellido || "",
    responsable_ci: item.responsable_ci || "",
    responsable_telefono: item.responsable_telefono || "",
    responsable_whatsapp: item.responsable_whatsapp || "",
    responsable_zona: item.responsable_zona || "",
    responsable_direccion: item.responsable_direccion || "",

    animal_nombre: item.animal_nombre || "",
    especie: item.especie || "",
    sexo: item.sexo || "",
    edad: item.edad || "",
    peso: item.peso != null ? String(item.peso) : "",
    tamano: item.tamano || "",
    raza: item.raza || "",
    color: item.color || "",

    vacunado: !!item.vacunado,
    esterilizado: !!item.esterilizado,
    desparasitado: !!item.desparasitado,
    come_croqueta: !!item.come_croqueta,
    usa_arenero: !!item.usa_arenero,
    sabe_pasear_con_correa: !!item.sabe_pasear_con_correa,
    convive_con_perros: !!item.convive_con_perros,
    convive_con_gatos: !!item.convive_con_gatos,
    convive_con_ninos: !!item.convive_con_ninos,

    temperamento: item.temperamento || "",
    historial_medico: item.historial_medico || "",
    observaciones: item.observaciones || "",
    motivo_adopcion: item.motivo_adopcion || "",

    admin_observaciones: item.admin_observaciones || "",

    foto_pos_x: item.foto_pos_x ?? 50,
    foto_pos_y: item.foto_pos_y ?? 50,
    foto_zoom: item.foto_zoom ?? 1,
  }
}

function getGalleryPhotos(item: Adopcion) {
  return [item.foto_principal_url, ...(item.fotos_extra || [])].filter(
    (foto): foto is string => !!foto
  )
}

function construirMensajeWhatsappAprobacion(item: Adopcion) {
  return (
    "🐾 *FUNDACIÓN RUGIMOS* 🐾\n\n" +
    `Hola ${item.responsable_nombre || "Responsable"}.\n\n` +
    `Le comentamos que la solicitud de *${item.animal_nombre || "la mascota"}* fue aprobada y ya se encuentra publicada en la página de adopciones de Fundación Rugimos.\n\n` +
    "Al momento de adoptarlo, por favor comuníquese con el número oficial de la fundación para deshabilitar el perfil de la mascota en adopción y mantener la plataforma actualizada.\n\n" +
    "💚 Gracias por ayudar a cambiar una vida."
  )
}

export default function AdminAdopcionesPage() {
  const [adopciones, setAdopciones] = useState<Adopcion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>("todos")
  const [especie, setEspecie] = useState<(typeof ESPECIES)[number]>("todas")
  const [sexo, setSexo] = useState<(typeof SEXOS)[number]>("todos")
  const [savingId, setSavingId] = useState<string | null>(null)

  const [tab, setTab] = useState<TabKey>("pendiente")

  const [editingItem, setEditingItem] = useState<Adopcion | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const [galleryItem, setGalleryItem] = useState<Adopcion | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)

  async function cargarAdopciones() {
    setLoading(true)

    const { data, error } = await supabase
      .from("adopciones")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erro ao carregar adopciones:", error)
      setAdopciones([])
      setLoading(false)
      return
    }

    setAdopciones((data as Adopcion[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    cargarAdopciones()
  }, [])

  function abrirWhatsappManualAprobacion(item: Adopcion) {
    const telefonoBase = item.responsable_whatsapp || item.responsable_telefono || ""
    const telefono = String(telefonoBase).replace(/\D/g, "")

    if (!telefono) {
      alert("Este caso no tiene un número de WhatsApp válido.")
      return
    }

    const mensaje = construirMensajeWhatsappAprobacion(item)
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
    window.open(url, "_blank")
  }

  async function enviarWhatsappAprobacionAdopcion(item: Adopcion) {
    const telefono = item.responsable_whatsapp || item.responsable_telefono

    if (!telefono) {
      throw new Error("Este caso no tiene teléfono o WhatsApp registrado.")
    }

    const payload = {
      registro_id: null,
      telefono,
      tipo_mensaje: "aprobacion_adopcion",
      variables: {
        "1": item.responsable_nombre || "Responsable",
        "2": item.animal_nombre || "la mascota",
      },
      payload_extra: {
        adopcion_id: item.id,
        animal_nombre: item.animal_nombre || null,
        responsable_whatsapp: item.responsable_whatsapp || null,
      },
    }

    const res = await fetch("/api/send-whatsapp-template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          data?.moreInfo ||
          `No se pudo enviar el WhatsApp automático (status ${res.status})`
      )
    }

    return data
  }

  async function cambiarEstado(id: string, nuevoEstado: Adopcion["estado"]) {
    const item = adopciones.find((a) => a.id === id)
    if (!item) return

    try {
      setSavingId(id)

      const updateData: Record<string, any> = {
        estado: nuevoEstado,
      }

      if (nuevoEstado === "aprobado") {
        updateData.visible_publico = true
        updateData.fecha_aprobacion = new Date().toISOString()
      }

      if (nuevoEstado === "rechazado") {
        updateData.visible_publico = false
        updateData.fecha_rechazo = new Date().toISOString()
      }

      if (nuevoEstado === "reservado") {
        updateData.fecha_reserva = new Date().toISOString()
      }

      if (nuevoEstado === "adoptado") {
        updateData.visible_publico = false
        updateData.fecha_adopcion = new Date().toISOString()
      }

      if (nuevoEstado === "pendiente") {
        updateData.visible_publico = false
      }

      const { error } = await supabase
        .from("adopciones")
        .update(updateData)
        .eq("id", id)

      if (error) throw error

      await cargarAdopciones()

      if (nuevoEstado === "aprobado") {
        try {
          await enviarWhatsappAprobacionAdopcion(item)
        } catch (error: any) {
          console.error("Error automático WhatsApp aprobación:", error)

          const errorMsg =
            error?.message || "No se pudo enviar el WhatsApp automático."

          const seguirManual = window.confirm(
            `La aprobación fue guardada, pero falló el envío automático.\n\nError: ${errorMsg}\n\n¿Desea abrir el WhatsApp manual para enviarlo ahora?`
          )

          if (seguirManual) {
            abrirWhatsappManualAprobacion(item)
          }
        }
      }
    } catch (error) {
      console.error(error)
      alert("No se pudo actualizar el estado.")
    } finally {
      setSavingId(null)
    }
  }

  async function toggleDestacado(item: Adopcion) {
    try {
      setSavingId(item.id)

      const { error } = await supabase
        .from("adopciones")
        .update({ destacado: !item.destacado })
        .eq("id", item.id)

      if (error) throw error

      await cargarAdopciones()
    } catch (error) {
      console.error(error)
      alert("No se pudo actualizar destacado.")
    } finally {
      setSavingId(null)
    }
  }

  async function toggleVisible(item: Adopcion) {
    try {
      setSavingId(item.id)

      const nuevoValor = !item.visible_publico

      const { error } = await supabase
        .from("adopciones")
        .update({ visible_publico: nuevoValor })
        .eq("id", item.id)

      if (error) throw error

      await cargarAdopciones()
    } catch (error) {
      console.error(error)
      alert("No se pudo actualizar la visibilidad.")
    } finally {
      setSavingId(null)
    }
  }

  async function eliminarRegistro(item: Adopcion) {
    const ok = confirm(
      `¿Seguro que deseas eliminar a "${item.animal_nombre}"? Esta acción no se puede deshacer.`
    )
    if (!ok) return

    try {
      setSavingId(item.id)

      const { error } = await supabase
        .from("adopciones")
        .delete()
        .eq("id", item.id)

      if (error) throw error

      await cargarAdopciones()
    } catch (error) {
      console.error(error)
      alert("No se pudo eliminar el registro.")
    } finally {
      setSavingId(null)
    }
  }

  function abrirEdicion(item: Adopcion) {
    setEditingItem(item)
    setEditForm(createEditForm(item))
  }

  function cerrarEdicion() {
    setEditingItem(null)
    setEditForm(null)
  }

  function updateEditField<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  function abrirGaleria(item: Adopcion, startIndex = 0) {
    setGalleryItem(item)
    setGalleryIndex(startIndex)
  }

  function cerrarGaleria() {
    setGalleryItem(null)
    setGalleryIndex(0)
  }

  function nextGalleryPhoto() {
    if (!galleryItem) return
    const fotos = getGalleryPhotos(galleryItem)
    if (!fotos.length) return
    setGalleryIndex((prev) => (prev + 1) % fotos.length)
  }

  function prevGalleryPhoto() {
    if (!galleryItem) return
    const fotos = getGalleryPhotos(galleryItem)
    if (!fotos.length) return
    setGalleryIndex((prev) => (prev - 1 + fotos.length) % fotos.length)
  }

  async function guardarEdicion() {
    if (!editingItem || !editForm) return

    if (!editForm.responsable_nombre || !editForm.animal_nombre || !editForm.especie || !editForm.sexo) {
      alert("Completa al menos nombre del responsable, nombre del animal, especie y sexo.")
      return
    }

    try {
      setSavingEdit(true)

      const pesoValue = editForm.peso.trim() ? Number(editForm.peso) : null
      if (editForm.peso.trim() && Number.isNaN(pesoValue)) {
        alert("El peso no es válido.")
        setSavingEdit(false)
        return
      }

      const payload = {
        responsable_nombre: editForm.responsable_nombre,
        responsable_apellido: editForm.responsable_apellido || null,
        responsable_ci: editForm.responsable_ci || null,
        responsable_telefono: editForm.responsable_telefono || null,
        responsable_whatsapp: editForm.responsable_whatsapp || null,
        responsable_zona: editForm.responsable_zona || null,
        responsable_direccion: editForm.responsable_direccion || null,

        animal_nombre: editForm.animal_nombre,
        especie: editForm.especie,
        sexo: editForm.sexo,
        edad: editForm.edad || null,
        peso: pesoValue,
        tamano: editForm.tamano || null,
        raza: editForm.raza || null,
        color: editForm.color || null,

        vacunado: editForm.vacunado,
        esterilizado: editForm.esterilizado,
        desparasitado: editForm.desparasitado,
        come_croqueta: editForm.come_croqueta,
        usa_arenero: editForm.usa_arenero,
        sabe_pasear_con_correa: editForm.sabe_pasear_con_correa,
        convive_con_perros: editForm.convive_con_perros,
        convive_con_gatos: editForm.convive_con_gatos,
        convive_con_ninos: editForm.convive_con_ninos,

        temperamento: editForm.temperamento || null,
        historial_medico: editForm.historial_medico || null,
        observaciones: editForm.observaciones || null,
        motivo_adopcion: editForm.motivo_adopcion || null,
        admin_observaciones: editForm.admin_observaciones || null,

        foto_pos_x: editForm.foto_pos_x,
        foto_pos_y: editForm.foto_pos_y,
        foto_zoom: editForm.foto_zoom,
      }

      const { error } = await supabase
        .from("adopciones")
        .update(payload)
        .eq("id", editingItem.id)

      if (error) throw error

      await cargarAdopciones()
      cerrarEdicion()
    } catch (error) {
      console.error(error)
      alert("No se pudo guardar la edición.")
    } finally {
      setSavingEdit(false)
    }
  }

  const resumen = useMemo(() => {
    return {
      total: adopciones.length,
      pendiente: adopciones.filter((a) => a.estado === "pendiente").length,
      aprobado: adopciones.filter((a) => a.estado === "aprobado").length,
      rechazado: adopciones.filter((a) => a.estado === "rechazado").length,
      reservado: adopciones.filter((a) => a.estado === "reservado").length,
      adoptado: adopciones.filter((a) => a.estado === "adoptado").length,
    }
  }, [adopciones])

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase()

    return adopciones.filter((item) => {
      const matchSearch =
        !term ||
        item.animal_nombre?.toLowerCase().includes(term) ||
        item.responsable_nombre?.toLowerCase().includes(term) ||
        item.responsable_apellido?.toLowerCase().includes(term) ||
        item.responsable_telefono?.toLowerCase().includes(term) ||
        item.responsable_whatsapp?.toLowerCase().includes(term) ||
        item.responsable_zona?.toLowerCase().includes(term) ||
        item.raza?.toLowerCase().includes(term)

      const matchEstado = estado === "todos" || item.estado === estado
      const matchEspecie = especie === "todas" || item.especie === especie
      const matchSexo = sexo === "todos" || item.sexo === sexo

      const matchTab =
        tab === "pendiente"
          ? item.estado === "pendiente"
          : tab === "aprobado"
          ? item.estado === "aprobado"
          : ["rechazado", "reservado", "adoptado"].includes(item.estado)

      return matchSearch && matchEstado && matchEspecie && matchSexo && matchTab
    })
  }, [adopciones, search, estado, especie, sexo, tab])

  const galleryPhotos = galleryItem ? getGalleryPhotos(galleryItem) : []
  const currentGalleryPhoto = galleryPhotos[galleryIndex] || null

  return (
    <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[28px] border border-white/10 bg-[#147d79] p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Fundación Rugimos
              </p>
              <h1 className="text-3xl font-bold">Centro de control de Adopciones</h1>
              <p className="mt-1 text-sm text-white/80">
                Revisión, aprobación y seguimiento de animales publicados para adopción.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#0d6b68] transition hover:scale-[1.02]"
              >
                Volver al admin
              </Link>

              <button
                onClick={cargarAdopciones}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#f47c3c] px-5 text-sm font-semibold text-white transition hover:scale-[1.02]"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total" value={resumen.total} />
          <StatCard label="Pendientes" value={resumen.pendiente} />
          <StatCard label="Aprobados" value={resumen.aprobado} />
          <StatCard label="Rechazados" value={resumen.rechazado} />
          <StatCard label="Reservados" value={resumen.reservado} />
          <StatCard label="Adoptados" value={resumen.adoptado} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <TabButton active={tab === "pendiente"} onClick={() => setTab("pendiente")}>
            Pendientes
          </TabButton>
          <TabButton active={tab === "aprobado"} onClick={() => setTab("aprobado")}>
            Aprobados
          </TabButton>
          <TabButton active={tab === "historial"} onClick={() => setTab("historial")}>
            Historial
          </TabButton>
        </div>

        <div className="mb-6 rounded-[24px] bg-[#f2f2f2] p-4 shadow-lg">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por animal, responsable, zona, teléfono..."
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
            />

            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
            >
              {ESTADOS.map((item) => (
                <option key={item} value={item}>
                  {item === "todos" ? "Todos los estados" : item}
                </option>
              ))}
            </select>

            <select
              value={especie}
              onChange={(e) => setEspecie(e.target.value as (typeof ESPECIES)[number])}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
            >
              {ESPECIES.map((item) => (
                <option key={item} value={item}>
                  {item === "todas" ? "Todas las especies" : item}
                </option>
              ))}
            </select>

            <select
              value={sexo}
              onChange={(e) => setSexo(e.target.value as (typeof SEXOS)[number])}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
            >
              {SEXOS.map((item) => (
                <option key={item} value={item}>
                  {item === "todos" ? "Todos los sexos" : item}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("")
                setEstado("todos")
                setEspecie("todas")
                setSexo("todos")
              }}
              className="h-11 rounded-xl bg-[#d9d9d9] px-4 text-sm font-semibold text-slate-700 transition hover:bg-[#cfcfcf]"
            >
              Limpiar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[24px] bg-white p-8 text-center text-slate-600 shadow-lg">
            Cargando adopciones...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-[24px] bg-white p-8 text-center text-slate-600 shadow-lg">
            No se encontraron registros en esta sección.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtradas.map((item) => {
              const fotos = getGalleryPhotos(item)
              const extras = item.fotos_extra || []

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[26px] bg-[#f4f4f4] shadow-lg ring-1 ring-black/5"
                >
                  <div className="relative h-64 w-full overflow-hidden bg-slate-200">
                    {item.foto_principal_url ? (
                      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                        <img
                          src={item.foto_principal_url}
                          alt={item.animal_nombre}
                          className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                          style={{
                            objectPosition: `${item.foto_pos_x ?? 50}% ${item.foto_pos_y ?? 50}%`,
                            transform: `scale(${item.foto_zoom ?? 1})`,
                          }}
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Sin foto principal
                      </div>
                    )}

                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <Badge
                        text={item.estado}
                        tone={
                          item.estado === "aprobado"
                            ? "green"
                            : item.estado === "rechazado"
                            ? "red"
                            : item.estado === "reservado"
                            ? "yellow"
                            : item.estado === "adoptado"
                            ? "blue"
                            : "gray"
                        }
                      />
                      {item.destacado && <Badge text="Destacado" tone="orange" />}
                      {item.visible_publico && <Badge text="Visible" tone="green" />}
                    </div>

                    {fotos.length > 0 ? (
                      <button
                        onClick={() => abrirGaleria(item, 0)}
                        className="absolute bottom-3 right-3 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/80"
                        type="button"
                      >
                        Ver fotos ({fotos.length})
                      </button>
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="mb-3">
                      <h2 className="text-xl font-bold text-[#0b6665]">{item.animal_nombre}</h2>
                      <p className="text-sm text-slate-500">
                        {item.especie} · {item.sexo}
                        {item.edad ? ` · ${item.edad}` : ""}
                        {item.tamano ? ` · ${item.tamano}` : ""}
                      </p>
                    </div>

                    {extras.length > 0 ? (
                      <div className="mb-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Fotos adicionales
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {extras.slice(0, 4).map((foto, index) => (
                            <button
                              key={`${item.id}-extra-${index}`}
                              onClick={() => abrirGaleria(item, index + 1)}
                              className="group relative h-16 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200"
                              type="button"
                            >
                              <img
                                src={foto}
                                alt={`Foto extra ${index + 1}`}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mb-4 space-y-1 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold">Responsable:</span>{" "}
                        {item.responsable_nombre} {item.responsable_apellido || ""}
                      </p>
                      <p>
                        <span className="font-semibold">Teléfono:</span>{" "}
                        {item.responsable_telefono || "No especificado"}
                      </p>
                      <p>
                        <span className="font-semibold">WhatsApp:</span>{" "}
                        {item.responsable_whatsapp || "No especificado"}
                      </p>
                      <p>
                        <span className="font-semibold">Zona:</span>{" "}
                        {item.responsable_zona || "No especificada"}
                      </p>
                      <p>
                        <span className="font-semibold">Raza:</span>{" "}
                        {item.raza || "No especificada"}
                      </p>
                      <p>
                        <span className="font-semibold">Peso:</span>{" "}
                        {item.peso ? `${item.peso} kg` : "No especificado"}
                      </p>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                      <MiniInfo label="Vacunado" value={boolLabel(item.vacunado)} />
                      <MiniInfo label="Esterilizado" value={boolLabel(item.esterilizado)} />
                      <MiniInfo label="Croqueta" value={boolLabel(item.come_croqueta)} />
                      <MiniInfo label="Arenero" value={boolLabel(item.usa_arenero)} />
                      <MiniInfo label="Convive perros" value={boolLabel(item.convive_con_perros)} />
                      <MiniInfo label="Convive niños" value={boolLabel(item.convive_con_ninos)} />
                    </div>

                    {item.temperamento ? (
                      <div className="mb-3 rounded-2xl border border-[#d9ecea] bg-[#eef8f7] p-3 text-sm text-slate-700">
                        <span className="font-semibold text-[#0b6665]">Temperamento:</span>{" "}
                        {item.temperamento}
                      </div>
                    ) : null}

                    {item.observaciones ? (
                      <div className="mb-3 rounded-2xl border border-[#f2dfcf] bg-[#fff7f1] p-3 text-sm text-slate-700">
                        <span className="font-semibold text-[#b85d27]">Observaciones:</span>{" "}
                        {item.observaciones}
                      </div>
                    ) : null}

                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Visible al público
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {item.visible_publico ? "Sí" : "No"}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleVisible(item)}
                        disabled={savingId === item.id}
                        type="button"
                        className={`relative h-7 w-14 rounded-full transition ${
                          item.visible_publico ? "bg-[#0d7a75]" : "bg-slate-300"
                        } ${savingId === item.id ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                            item.visible_publico ? "translate-x-7" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => cambiarEstado(item.id, "aprobado")}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        Aprobar
                      </button>

                      <button
                        onClick={() => cambiarEstado(item.id, "rechazado")}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        Rechazar
                      </button>

                      <button
                        onClick={() => cambiarEstado(item.id, "reservado")}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                      >
                        Reservar
                      </button>

                      <button
                        onClick={() => cambiarEstado(item.id, "adoptado")}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        Adoptado
                      </button>

                      <button
                        onClick={() => cambiarEstado(item.id, "pendiente")}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-slate-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-60"
                      >
                        Volver a pendiente
                      </button>

                      <button
                        onClick={() => toggleDestacado(item)}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-[#f47c3c] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#e66e2f] disabled:opacity-60"
                      >
                        {item.destacado ? "Quitar destacado" : "Destacar"}
                      </button>

                      <button
                        onClick={() => abrirEdicion(item)}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-[#0d7a75] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b6665] disabled:opacity-60"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => eliminarRegistro(item)}
                        disabled={savingId === item.id}
                        className="rounded-xl bg-[#8b1e1e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#741818] disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {galleryItem && currentGalleryPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
          onClick={cerrarGaleria}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-black">
              <img
                src={currentGalleryPhoto}
                alt="Galería"
                className="max-h-[80vh] w-full object-contain"
              />

              <button
                onClick={cerrarGaleria}
                className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-2 text-sm font-semibold text-white"
                type="button"
              >
                Cerrar
              </button>

              {galleryPhotos.length > 1 ? (
                <>
                  <button
                    onClick={prevGalleryPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-sm font-semibold text-white"
                    type="button"
                  >
                    ←
                  </button>

                  <button
                    onClick={nextGalleryPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 text-sm font-semibold text-white"
                    type="button"
                  >
                    →
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between px-5 py-4 text-sm text-slate-600">
              <p>
                {galleryItem.animal_nombre} · Foto {galleryIndex + 1} de {galleryPhotos.length}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {editingItem && editForm ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-4 py-8"
          onClick={cerrarEdicion}
        >
          <div
            className="mx-auto max-w-5xl rounded-[30px] bg-[#f4f4f4] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0b6665]/70">
                  Fundación Rugimos
                </p>
                <h2 className="text-2xl font-bold text-[#0b6665]">
                  Editar adopción · {editingItem.animal_nombre}
                </h2>
              </div>

              <button
                onClick={cerrarEdicion}
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#d9d9d9] px-5 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SectionCard title="Responsable">
                <Field label="Nombre">
                  <Input
                    value={editForm.responsable_nombre}
                    onChange={(e) => updateEditField("responsable_nombre", e.target.value)}
                  />
                </Field>
                <Field label="Apellido">
                  <Input
                    value={editForm.responsable_apellido}
                    onChange={(e) => updateEditField("responsable_apellido", e.target.value)}
                  />
                </Field>
                <Field label="CI">
                  <Input
                    value={editForm.responsable_ci}
                    onChange={(e) => updateEditField("responsable_ci", e.target.value)}
                  />
                </Field>
                <Field label="Teléfono">
                  <Input
                    value={editForm.responsable_telefono}
                    onChange={(e) => updateEditField("responsable_telefono", e.target.value)}
                  />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    value={editForm.responsable_whatsapp}
                    onChange={(e) => updateEditField("responsable_whatsapp", e.target.value)}
                  />
                </Field>
                <Field label="Zona">
                  <Input
                    value={editForm.responsable_zona}
                    onChange={(e) => updateEditField("responsable_zona", e.target.value)}
                  />
                </Field>
                <Field label="Dirección">
                  <Textarea
                    value={editForm.responsable_direccion}
                    onChange={(e) => updateEditField("responsable_direccion", e.target.value)}
                  />
                </Field>
              </SectionCard>

              <SectionCard title="Animal">
                <Field label="Nombre del animal">
                  <Input
                    value={editForm.animal_nombre}
                    onChange={(e) => updateEditField("animal_nombre", e.target.value)}
                  />
                </Field>
                <Field label="Especie">
                  <Select
                    value={editForm.especie}
                    onChange={(e) => updateEditField("especie", e.target.value as EditForm["especie"])}
                  >
                    <option value="">Seleccionar</option>
                    <option value="Perro">Perro</option>
                    <option value="Gato">Gato</option>
                  </Select>
                </Field>
                <Field label="Sexo">
                  <Select
                    value={editForm.sexo}
                    onChange={(e) => updateEditField("sexo", e.target.value as EditForm["sexo"])}
                  >
                    <option value="">Seleccionar</option>
                    <option value="Macho">Macho</option>
                    <option value="Hembra">Hembra</option>
                  </Select>
                </Field>
                <Field label="Edad">
                  <Input
                    value={editForm.edad}
                    onChange={(e) => updateEditField("edad", e.target.value)}
                  />
                </Field>
                <Field label="Peso">
                  <Input
                    value={editForm.peso}
                    onChange={(e) => updateEditField("peso", e.target.value)}
                  />
                </Field>
                <Field label="Tamaño">
                  <Input
                    value={editForm.tamano}
                    onChange={(e) => updateEditField("tamano", e.target.value)}
                  />
                </Field>
                <Field label="Raza">
                  <Input
                    value={editForm.raza}
                    onChange={(e) => updateEditField("raza", e.target.value)}
                  />
                </Field>
                <Field label="Color">
                  <Input
                    value={editForm.color}
                    onChange={(e) => updateEditField("color", e.target.value)}
                  />
                </Field>
              </SectionCard>

              <SectionCard title="Salud y convivencia">
                <Check label="Vacunado" checked={editForm.vacunado} onChange={(v) => updateEditField("vacunado", v)} />
                <Check label="Esterilizado" checked={editForm.esterilizado} onChange={(v) => updateEditField("esterilizado", v)} />
                <Check label="Desparasitado" checked={editForm.desparasitado} onChange={(v) => updateEditField("desparasitado", v)} />
                <Check label="Come croqueta" checked={editForm.come_croqueta} onChange={(v) => updateEditField("come_croqueta", v)} />
                <Check label="Usa arenero" checked={editForm.usa_arenero} onChange={(v) => updateEditField("usa_arenero", v)} />
                <Check label="Sabe pasear con correa" checked={editForm.sabe_pasear_con_correa} onChange={(v) => updateEditField("sabe_pasear_con_correa", v)} />
                <Check label="Convive con perros" checked={editForm.convive_con_perros} onChange={(v) => updateEditField("convive_con_perros", v)} />
                <Check label="Convive con gatos" checked={editForm.convive_con_gatos} onChange={(v) => updateEditField("convive_con_gatos", v)} />
                <Check label="Convive con niños" checked={editForm.convive_con_ninos} onChange={(v) => updateEditField("convive_con_ninos", v)} />
              </SectionCard>

              <SectionCard title="Detalles adicionales">
                <Field label="Temperamento">
                  <Textarea
                    value={editForm.temperamento}
                    onChange={(e) => updateEditField("temperamento", e.target.value)}
                  />
                </Field>
                <Field label="Historial médico">
                  <Textarea
                    value={editForm.historial_medico}
                    onChange={(e) => updateEditField("historial_medico", e.target.value)}
                  />
                </Field>
                <Field label="Observaciones">
                  <Textarea
                    value={editForm.observaciones}
                    onChange={(e) => updateEditField("observaciones", e.target.value)}
                  />
                </Field>
                <Field label="Motivo adopción">
                  <Textarea
                    value={editForm.motivo_adopcion}
                    onChange={(e) => updateEditField("motivo_adopcion", e.target.value)}
                  />
                </Field>
                <Field label="Observaciones admin">
                  <Textarea
                    value={editForm.admin_observaciones}
                    onChange={(e) => updateEditField("admin_observaciones", e.target.value)}
                  />
                </Field>
              </SectionCard>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={cerrarEdicion}
                type="button"
                className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
              >
                Cancelar
              </button>

              <button
                onClick={guardarEdicion}
                type="button"
                disabled={savingEdit}
                className="rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
              >
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] bg-[#f4f4f4] p-4 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#0b6665]">{value}</p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[#f47c3c] text-white shadow-md"
          : "bg-white text-[#0b6665] hover:scale-[1.02]"
      }`}
    >
      {children}
    </button>
  )
}

function Badge({
  text,
  tone = "gray",
}: {
  text: string
  tone?: "green" | "red" | "yellow" | "blue" | "gray" | "orange"
}) {
  const styles =
    tone === "green"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "red"
      ? "bg-red-100 text-red-700"
      : tone === "yellow"
      ? "bg-amber-100 text-amber-700"
      : tone === "blue"
      ? "bg-sky-100 text-sky-700"
      : tone === "orange"
      ? "bg-orange-100 text-orange-700"
      : "bg-white/90 text-slate-700"

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ${styles}`}>
      {text}
    </span>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-md">
      <h3 className="mb-4 text-lg font-bold text-[#0b6665]">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#0b6665]">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={4}
      className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0d7a75]"
    />
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f8f8] px-4 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}