"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type AdopcionConfirmacion = {
  id: string
  animal_nombre: string
  especie: "Perro" | "Gato"
  sexo: "Macho" | "Hembra"
  edad: string | null
  foto_principal_url: string | null
  estado: "pendiente" | "aprobado" | "rechazado" | "reservado" | "adoptado"
  visible_publico: boolean
  responsable_telefono: string | null
  responsable_whatsapp: string | null
}

export default function ConfirmarAdopcionPage() {
  const params = useParams()
  const id = params?.id as string

  const [item, setItem] = useState<AdopcionConfirmacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [acepta, setAcepta] = useState(false)

  async function cargar() {
    if (!id) return

    setLoading(true)

    const { data, error } = await supabase
      .from("adopciones")
      .select(
        "id, animal_nombre, especie, sexo, edad, foto_principal_url, estado, visible_publico, responsable_telefono, responsable_whatsapp"
      )
      .eq("id", id)
      .eq("estado", "aprobado")
      .eq("visible_publico", true)
      .single()

    if (error) {
      console.error("Error al cargar confirmación de adopción:", error)
      setItem(null)
      setLoading(false)
      return
    }

    setItem(data as AdopcionConfirmacion)
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [id])

  const whatsappHref = useMemo(() => {
    if (!item) return "#"

    const numeroBase = item.responsable_whatsapp || item.responsable_telefono || ""
    const numeroLimpio = numeroBase.replace(/\D/g, "")

    if (!numeroLimpio) return "#"

    const texto = `Hola, me interesa adoptar a ${item.animal_nombre}. Vi su perfil en la sección de adopciones y quisiera recibir más información.`

    return `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(texto)}`
  }, [item])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 text-center text-slate-600 shadow-lg">
          Cargando confirmación...
        </div>
      </main>
    )
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-[#0d7a75] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-[#0b6665]">Perfil no disponible</h1>
          <p className="mt-3 text-slate-600">
            Este animal ya no se encuentra disponible o no está publicado.
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center text-white">
          <h1 className="text-4xl font-bold">Confirmación antes de adoptar</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85">
            Antes de continuar, lee atentamente esta información importante sobre la adopción responsable.
          </p>
        </div>

        <div className="mb-6 overflow-hidden rounded-[28px] bg-[#f4f4f4] shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
            <div className="bg-slate-200">
              {item.foto_principal_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.foto_principal_url}
                  alt={item.animal_nombre}
                  className="h-full min-h-[220px] w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center text-slate-500">
                  Sin foto
                </div>
              )}
            </div>

            <div className="p-6">
              <h2 className="text-3xl font-bold text-[#0b6665]">{item.animal_nombre}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {item.especie} · {item.sexo}
                {item.edad ? ` · ${item.edad}` : ""}
              </p>

              <div className="mt-4 rounded-2xl border border-[#d9ecea] bg-[#eef8f7] p-4 text-sm text-slate-700">
                Estás a un paso de iniciar el contacto para conocer más sobre este animal.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Aviso
            title="Compromiso real"
            text="Adoptar no es algo temporal. Implica responsabilidad, tiempo, paciencia y compromiso."
            tone="orange"
          />
          <Aviso
            title="Cuidados básicos"
            text="Debes garantizar alimentación adecuada, agua, espacio seguro, higiene y atención veterinaria."
            tone="teal"
          />
          <Aviso
            title="Seguimiento"
            text="La fundación puede realizar seguimiento posterior para verificar el bienestar del animal."
            tone="teal"
          />
          <Aviso
            title="Entorno seguro"
            text="El animal debe vivir en un ambiente seguro, sin maltrato, abandono ni riesgo."
            tone="orange"
          />
        </div>

        <div className="mt-6 rounded-[28px] bg-[#f4f4f4] p-6 shadow-xl">
          <h3 className="text-center text-2xl font-bold text-[#0b6665]">
            Confirmación antes de continuar
          </h3>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que he leído la información y entiendo la responsabilidad que implica adoptar a {item.animal_nombre}.
            </span>
          </label>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/adopciones/${item.id}`}
              className="rounded-full bg-[#d9d9d9] px-6 py-3 text-sm font-semibold text-slate-700 transition hover:scale-[1.02]"
            >
              Volver
            </Link>

            <a
              href={acepta ? whatsappHref : "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!acepta) {
                  e.preventDefault()
                  alert("Debes confirmar la lectura antes de continuar.")
                  return
                }

                if (whatsappHref === "#") {
                  e.preventDefault()
                  alert("Este caso no tiene un número de WhatsApp válido para contacto.")
                }
              }}
              className={`rounded-full px-6 py-3 text-sm font-semibold text-white transition ${
                acepta
                  ? "bg-[#f47c3c] hover:scale-[1.02]"
                  : "cursor-not-allowed bg-slate-400"
              }`}
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

function Aviso({
  title,
  text,
  tone,
}: {
  title: string
  text: string
  tone: "teal" | "orange"
}) {
  const styles =
    tone === "orange"
      ? "border-[#f2dfcf] bg-[#fff7f1]"
      : "border-[#d9ecea] bg-[#eef8f7]"

  const titleColor = tone === "orange" ? "text-[#b85d27]" : "text-[#0b6665]"

  return (
    <div className={`rounded-[24px] border p-5 shadow-md ${styles}`}>
      <h2 className={`text-lg font-bold ${titleColor}`}>{title}</h2>
      <p className="mt-2 text-sm text-slate-700">{text}</p>
    </div>
  )
}