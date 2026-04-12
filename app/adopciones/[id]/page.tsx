"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type AdopcionDetalle = {
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

  estado: "pendiente" | "aprobado" | "rechazado" | "reservado" | "adoptado"
  visible_publico: boolean
}

function boolText(value?: boolean | null, yes = "Sí", no = "No") {
  return value ? yes : no
}

export default function AdopcionDetallePage() {
  const params = useParams()
  const id = params?.id as string

  const [item, setItem] = useState<AdopcionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState("")

  async function cargarDetalle() {
    if (!id) return

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
        sabe_pasear_con_correa,
        convive_con_perros,
        convive_con_gatos,
        convive_con_ninos,
        temperamento,
        historial_medico,
        observaciones,
        motivo_adopcion,
        foto_principal_url,
        fotos_extra,
        estado,
        visible_publico
      `)
      .eq("id", id)
      .eq("estado", "aprobado")
      .eq("visible_publico", true)
      .single()

    if (error) {
      console.error("Error al cargar detalle de adopción:", error)
      setItem(null)
      setLoading(false)
      return
    }

    const record = data as AdopcionDetalle
    setItem(record)
    setSelectedImage(record.foto_principal_url || record.fotos_extra?.[0] || "")
    setLoading(false)
  }

  useEffect(() => {
    cargarDetalle()
  }, [id])

  const gallery = useMemo(() => {
    if (!item) return []
    const extras = Array.isArray(item.fotos_extra) ? item.fotos_extra : []
    const all = [item.foto_principal_url, ...extras].filter(Boolean) as string[]
    return [...new Set(all)]
  }, [item])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-white p-8 text-center text-slate-600 shadow-lg">
          Cargando información del animal...
        </div>
      </main>
    )
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-[#0b6665]">Animal no encontrado</h1>
          <p className="mt-3 text-slate-600">
            Este perfil no está disponible o ya no se encuentra publicado.
          </p>

          <div className="mt-6">
            <Link
              href="/adopciones"
              className="inline-flex rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              Volver a adopciones
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/adopciones"
            className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d6b68] transition hover:scale-[1.02]"
          >
            Volver a adopciones
          </Link>

          <Link
            href={`/adopciones/${item.id}/confirmar`}
            className="inline-flex rounded-full bg-[#f47c3c] px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
          >
            Quiero adoptar
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[30px] bg-[#f4f4f4] p-5 shadow-xl">
            <div className="overflow-hidden rounded-[24px] bg-slate-200">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage}
                  alt={item.animal_nombre}
                  className="h-[420px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center text-slate-500">
                  Sin imagen disponible
                </div>
              )}
            </div>

            {gallery.length > 1 ? (
              <div className="mt-4 grid grid-cols-4 gap-3 md:grid-cols-5">
                {gallery.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`overflow-hidden rounded-2xl border-2 transition ${
                      selectedImage === img
                        ? "border-[#f47c3c]"
                        : "border-transparent hover:border-[#0d7a75]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt="Foto del animal"
                      className="h-20 w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <div className="rounded-[30px] bg-[#f4f4f4] p-6 shadow-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{item.especie}</Tag>
                <Tag>{item.sexo}</Tag>
                {item.esterilizado ? <Tag tone="orange">Esterilizado</Tag> : null}
              </div>

              <h1 className="mt-4 text-4xl font-bold text-[#0b6665]">
                {item.animal_nombre}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {item.edad || "Edad no especificada"}
                {item.tamano ? ` · ${item.tamano}` : ""}
                {item.raza ? ` · ${item.raza}` : ""}
                {item.color ? ` · ${item.color}` : ""}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Info label="Peso" value={item.peso ? `${item.peso} kg` : "No especificado"} />
                <Info label="Vacunado" value={boolText(item.vacunado)} />
                <Info label="Esterilizado" value={boolText(item.esterilizado)} />
                <Info label="Desparasitado" value={boolText(item.desparasitado)} />
                <Info label="Come croqueta" value={boolText(item.come_croqueta)} />
                <Info label="Usa arenero" value={boolText(item.usa_arenero)} />
                <Info
                  label="Pasea con correa"
                  value={boolText(item.sabe_pasear_con_correa)}
                />
                <Info label="Convive con perros" value={boolText(item.convive_con_perros)} />
                <Info label="Convive con gatos" value={boolText(item.convive_con_gatos)} />
                <Info label="Convive con niños" value={boolText(item.convive_con_ninos)} />
              </div>
            </div>

            {item.temperamento ? (
              <div className="rounded-[28px] border border-[#d9ecea] bg-[#eef8f7] p-5 shadow-md">
                <h2 className="text-lg font-bold text-[#0b6665]">Temperamento</h2>
                <p className="mt-2 text-sm text-slate-700">{item.temperamento}</p>
              </div>
            ) : null}

            {item.historial_medico ? (
              <div className="rounded-[28px] border border-[#d9ecea] bg-[#eef8f7] p-5 shadow-md">
                <h2 className="text-lg font-bold text-[#0b6665]">Historial médico</h2>
                <p className="mt-2 text-sm text-slate-700">{item.historial_medico}</p>
              </div>
            ) : null}

            {item.motivo_adopcion ? (
              <div className="rounded-[28px] border border-[#f2dfcf] bg-[#fff7f1] p-5 shadow-md">
                <h2 className="text-lg font-bold text-[#b85d27]">Motivo de adopción</h2>
                <p className="mt-2 text-sm text-slate-700">{item.motivo_adopcion}</p>
              </div>
            ) : null}

            {item.observaciones ? (
              <div className="rounded-[28px] border border-[#f2dfcf] bg-[#fff7f1] p-5 shadow-md">
                <h2 className="text-lg font-bold text-[#b85d27]">Observaciones</h2>
                <p className="mt-2 text-sm text-slate-700">{item.observaciones}</p>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-[#f0d6c2] bg-[#fff3e9] p-5 shadow-md">
              <h2 className="text-lg font-bold text-[#8f4f24]">Adopción responsable</h2>
              <p className="mt-2 text-sm text-slate-700">
                Adoptar implica compromiso, seguimiento, buena alimentación, atención
                veterinaria, cariño y un hogar seguro para toda la vida.
              </p>

              <div className="mt-4">
                <Link
                  href={`/adopciones/${item.id}/confirmar`}
                  className="inline-flex rounded-full bg-[#f47c3c] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                >
                  Quiero adoptar
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value}</div>
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
      : "bg-[#e8f7f5] text-[#0b6665]"

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  )
}