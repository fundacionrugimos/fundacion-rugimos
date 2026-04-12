"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type AdopcionPublica = {
  id: string
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
  convive_con_perros: boolean | null
  convive_con_gatos: boolean | null
  convive_con_ninos: boolean | null

  temperamento: string | null
  observaciones: string | null

  foto_principal_url: string | null
  foto_pos_x: number | null
  foto_pos_y: number | null
  foto_zoom: number | null

  destacado: boolean
  estado: "pendiente" | "aprobado" | "rechazado" | "reservado" | "adoptado"
  visible_publico: boolean
}

const ESPECIES = ["todas", "Perro", "Gato"] as const
const SEXOS = ["todos", "Macho", "Hembra"] as const

function boolText(value?: boolean | null, yes = "Sí", no = "No") {
  return value ? yes : no
}

export default function AdopcionesPage() {
  const [items, setItems] = useState<AdopcionPublica[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [especie, setEspecie] = useState<(typeof ESPECIES)[number]>("todas")
  const [sexo, setSexo] = useState<(typeof SEXOS)[number]>("todos")

  async function cargar() {
    setLoading(true)

    const { data, error } = await supabase
      .from("adopciones")
      .select(`
        id,
        animal_nombre,
        especie,
        sexo,
        edad,
        peso,
        tamano,
        raza,
        color,
        vacunado,
        esterilizado,
        desparasitado,
        come_croqueta,
        usa_arenero,
        convive_con_perros,
        convive_con_gatos,
        convive_con_ninos,
        temperamento,
        observaciones,
        foto_principal_url,
        foto_pos_x,
        foto_pos_y,
        foto_zoom,
        destacado,
        estado,
        visible_publico
      `)
      .eq("estado", "aprobado")
      .eq("visible_publico", true)
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error al cargar adopciones públicas:", error)
      setItems([])
      setLoading(false)
      return
    }

    setItems((data as AdopcionPublica[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchSearch =
        !term ||
        item.animal_nombre?.toLowerCase().includes(term) ||
        item.raza?.toLowerCase().includes(term) ||
        item.color?.toLowerCase().includes(term) ||
        item.temperamento?.toLowerCase().includes(term)

      const matchEspecie = especie === "todas" || item.especie === especie
      const matchSexo = sexo === "todos" || item.sexo === sexo

      return matchSearch && matchEspecie && matchSexo
    })
  }, [items, search, especie, sexo])

  return (
    <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center text-white">
          <h1 className="text-4xl font-bold md:text-5xl">Adopciones</h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-white/85 md:text-base">
            Conoce animales que buscan un hogar responsable y lleno de amor.
          </p>
        </div>

        <div className="mb-6 rounded-[24px] border border-[#f0d6c2] bg-[#fff3e9] p-4 text-sm text-[#8f4f24] shadow-md">
          <p className="font-semibold">Adopción responsable</p>
          <p className="mt-1">
            Antes de adoptar, asegúrate de contar con tiempo, espacio, alimentación y
            cuidados adecuados para el animal.
          </p>
        </div>

        <div className="mb-6 rounded-[24px] bg-[#f2f2f2] p-4 shadow-lg">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, raza, color, temperamento..."
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0d7a75]"
            />

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
            Cargando animales...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-[24px] bg-white p-8 text-center text-slate-600 shadow-lg">
            No hay animales disponibles para adopción en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[28px] bg-[#f4f4f4] shadow-lg ring-1 ring-black/5"
              >
                <div className="relative h-64 w-full overflow-hidden bg-slate-200">
                  {item.foto_principal_url ? (
                    <div className="relative h-full w-full overflow-hidden bg-slate-200">
                      <img
                        src={item.foto_principal_url}
                        alt={item.animal_nombre}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                        style={{
                          objectPosition: `${item.foto_pos_x ?? 50}% ${item.foto_pos_y ?? 50}%`,
                          transform: `scale(${item.foto_zoom ?? 1})`,
                          transformOrigin: "center",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                      <span className="mb-2 text-5xl">🐾</span>
                      <span className="text-sm font-medium">Sin foto</span>
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Tag>{item.especie}</Tag>
                    <Tag>{item.sexo}</Tag>
                    {item.destacado ? <Tag tone="orange">Destacado</Tag> : null}
                  </div>
                </div>

                <div className="p-5">
                  <h2 className="text-2xl font-bold text-[#0b6665]">{item.animal_nombre}</h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.edad ? item.edad : "Edad no especificada"}
                    {item.tamano ? ` · ${item.tamano}` : ""}
                    {item.raza ? ` · ${item.raza}` : ""}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <MiniInfo label="Vacunado" value={boolText(item.vacunado)} />
                    <MiniInfo label="Esterilizado" value={boolText(item.esterilizado)} />
                    <MiniInfo label="Croqueta" value={boolText(item.come_croqueta)} />
                    <MiniInfo label="Arenero" value={boolText(item.usa_arenero)} />
                  </div>

                  {item.temperamento ? (
                    <div className="mt-4 rounded-2xl border border-[#d9ecea] bg-[#eef8f7] p-3 text-sm text-slate-700">
                      <span className="font-semibold text-[#0b6665]">Temperamento:</span>{" "}
                      {item.temperamento}
                    </div>
                  ) : null}

                  {item.observaciones ? (
                    <div className="mt-3 rounded-2xl border border-[#f2dfcf] bg-[#fff7f1] p-3 text-sm text-slate-700">
                      <span className="font-semibold text-[#b85d27]">Observaciones:</span>{" "}
                      {item.observaciones}
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <Link
                      href={`/adopciones/${item.id}`}
                      className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#f47c3c] px-5 text-sm font-semibold text-white transition hover:scale-[1.01]"
                    >
                      Ver detalles
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
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

function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode
  tone?: "default" | "orange"
}) {
  const styles =
    tone === "orange"
      ? "bg-orange-100 text-orange-700"
      : "bg-white/90 text-[#0b6665]"

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${styles}`}>
      {children}
    </span>
  )
}