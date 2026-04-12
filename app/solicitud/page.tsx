"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import dynamic from "next/dynamic"

const MapaSolicitud = dynamic(() => import("../../components/MapaSolicitud"), {
  ssr: false,
})

function limpiarTexto(valor: string) {
  return (valor || "").trim().toLowerCase().replace(/\s+/g, " ")
}

function limpiarTelefono(valor: string) {
  return (valor || "").replace(/\D/g, "")
}

function fechaHaceDias(dias: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fecha.toISOString()
}

async function generarCodigoRG() {
  const { data, error } = await supabase.rpc("generar_codigo_rg")

  if (error) {
    console.error("Error generando código RG:", error)
    throw error
  }

  if (!data) {
    throw new Error("No se pudo generar el código RG")
  }

  return data as string
}

/**
 * Optimiza la imagen antes de subirla:
 * - redimensiona si es muy grande
 * - baja la calidad
 * - la convierte a JPG para que pese menos
 *
 * No cambia nada visual del sistema, solo el archivo que se sube.
 */
async function optimizarImagen(
  file: File,
  maxWidth = 1200,
  quality = 0.72
): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  let width = img.width
  let height = img.height

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("No se pudo crear el canvas para optimizar la imagen.")
  }

  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error("No se pudo generar la imagen optimizada."))
      },
      "image/jpeg",
      quality
    )
  })

  const nuevoNombre = file.name.replace(/\.\w+$/, "") + ".jpg"

  return new File([blob], nuevoNombre, {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
}

function buildEdad(anos: string, meses: string) {
  const partes: string[] = []

  if (anos && anos !== "0") {
    partes.push(`${anos} ${anos === "1" ? "año" : "años"}`)
  }

  if (meses && meses !== "0") {
    partes.push(`${meses} ${meses === "1" ? "mes" : "meses"}`)
  }

  if (!partes.length) return null
  return partes.join(" y ")
}

function buildPesoTexto(kg: string, g: string) {
  if (!kg && (!g || g === "0")) return null

  const partes: string[] = []

  if (kg && kg !== "0") {
    partes.push(`${kg} kg`)
  }

  if (g && g !== "0") {
    partes.push(`${g} g`)
  }

  if (!partes.length) return "0 g"
  return partes.join(" ")
}

function buildPesoNumero(kg: string, g: string) {
  if (!kg && (!g || g === "0")) return null
  const kgNum = Number(kg || "0")
  const gNum = Number(g || "0")
  return kgNum + gNum / 1000
}

export default function Solicitud() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const [previewFrente, setPreviewFrente] = useState<string | null>(null)
  const [previewLado, setPreviewLado] = useState<string | null>(null)
  const [previewCarnet, setPreviewCarnet] = useState<string | null>(null)

  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [ubicacionDetectando, setUbicacionDetectando] = useState(false)
  const [zonas, setZonas] = useState<{ value: string; label: string }[]>([])

  const [mensajeDuplicado, setMensajeDuplicado] = useState("")

  // ===== NUEVOS CAMPOS =====
  const [sinNombre, setSinNombre] = useState(false)
  const [edadAnos, setEdadAnos] = useState("")
  const [edadMeses, setEdadMeses] = useState("")
  const [pesoKg, setPesoKg] = useState("")
  const [pesoG, setPesoG] = useState("0")
  const [tamano, setTamano] = useState("")
  const [vacunado, setVacunado] = useState(false)
  const [desparasitado, setDesparasitado] = useState(false)
  const [errores, setErrores] = useState<Record<string, boolean>>({})

  const edadMayorIgual4 = Number(edadAnos || "0") >= 4
  const mesesSelecionados = edadMeses !== ""
  const anosNumero = Number(edadAnos || "0")
  const mesesNumero = Number(edadMeses || "0")

  const menorDe4Meses =
    mesesSelecionados &&
    anosNumero === 0 &&
    mesesNumero < 4

  const pesoTotalNumero = buildPesoNumero(pesoKg, pesoG)
  const pesoBajo = pesoTotalNumero !== null && pesoTotalNumero < 0.7

  const MAX_SIZE = 5 * 1024 * 1024
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

  useEffect(() => {
    fetchZonas()
  }, [])

  async function fetchZonas() {
  try {
    const res = await fetch("/api/public/zonas")
    const json = await res.json()

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Error cargando zonas")
    }

    setZonas(json.data || [])
  } catch (error) {
    console.error("Error cargando zonas:", error)
    setZonas([])
  }
}

    

  const handlePreview = (file: File, setPreview: any) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      alert("Su navegador no permite obtener ubicación.")
      return
    }

    setUbicacionDetectando(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        setUbicacionDetectando(false)
      },
      () => {
        alert("No se pudo obtener su ubicación. Puede marcarla manualmente en el mapa.")
        setUbicacionDetectando(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    )
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setMensajeDuplicado("")

    const formData = new FormData(e.currentTarget)

    const fotoFrente = formData.get("foto_frente") as File
    const fotoLado = formData.get("foto_lado") as File
    const fotoCarnet = formData.get("foto_carnet") as File

    const validar = (file: File) => {
      if (!file) return false
      if (!ALLOWED_TYPES.includes(file.type)) return false
      if (file.size > MAX_SIZE) return false
      return true
    }

    if (!validar(fotoFrente) || !validar(fotoLado) || !validar(fotoCarnet)) {
      alert("Las imágenes deben ser JPG, PNG o WEBP y menores a 5MB.")
      setLoading(false)
      return
    }

    const nombreAnimalFinal = sinNombre
      ? "SN"
      : String(formData.get("nombre_animal") || "").trim()

    const edadFinal = buildEdad(edadAnos, edadMeses)
    const pesoFinal = buildPesoTexto(pesoKg, pesoG)

    const nuevosErrores: Record<string, boolean> = {
      nombre: !String(formData.get("nombre") || "").trim(),
      apellido1: !String(formData.get("apellido1") || "").trim(),
      apellido2: !String(formData.get("apellido2") || "").trim(),
      ci: !String(formData.get("ci") || "").trim(),
      celular: !String(formData.get("celular") || "").trim(),
      ubicacion: !String(formData.get("ubicacion") || "").trim(),
      nombre_animal: !nombreAnimalFinal,
      especie: !String(formData.get("especie") || "").trim(),
      sexo: !String(formData.get("sexo") || "").trim(),
      edad: !edadFinal,
      peso: !pesoFinal,
      tipo_animal: !String(formData.get("tipo_animal") || "").trim(),
    }

    setErrores(nuevosErrores)

    if (Object.values(nuevosErrores).some(Boolean)) {
      alert("Complete los campos obligatorios marcados.")
      setLoading(false)
      return
    }

    try {
      const nombre = String(formData.get("nombre") || "").trim()
      const apellido1 = String(formData.get("apellido1") || "").trim()
      const apellido2 = String(formData.get("apellido2") || "").trim()

      const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`.trim()

      const celular = String(formData.get("celular") || "")
      const especie = String(formData.get("especie") || "")
      const sexo = String(formData.get("sexo") || "")

      const celularLimpio = limpiarTelefono(celular)
      const nombreAnimalLimpio = limpiarTexto(nombreAnimalFinal)
      const especieLimpia = limpiarTexto(especie)
      const sexoLimpio = limpiarTexto(sexo)

      const fechaLimite = fechaHaceDias(90)


      const fotoFrenteOptimizada = await optimizarImagen(fotoFrente, 1200, 0.72)
      const fotoLadoOptimizada = await optimizarImagen(fotoLado, 1200, 0.72)
      const fotoCarnetOptimizada = await optimizarImagen(fotoCarnet, 1400, 0.78)

      const codigoGenerado = `TMP_${Date.now()}`

      const upload = async (file: File, name: string) => {
        const ext = file.name.split(".").pop()
        const path = `${codigoGenerado}_${name}_${Date.now()}.${ext}`

        const { error } = await supabase.storage
          .from("solicitudes")
          .upload(path, file)

        if (error) {
          console.error("Error subiendo archivo:", error)
          throw error
        }

        const { data } = supabase.storage
          .from("solicitudes")
          .getPublicUrl(path)

        return data.publicUrl
      }

      const urlFrente = await upload(fotoFrenteOptimizada, "frente")
      const urlLado = await upload(fotoLadoOptimizada, "lado")
      const urlCarnet = await upload(fotoCarnetOptimizada, "carnet")


      const res = await fetch("/api/public/solicitudes", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    nombre_completo: nombreCompleto,
    ci: String(formData.get("ci") || "").trim(),
    celular,
    ubicacion: String(formData.get("ubicacion") || "").trim(),
    lat,
    lng,
    nombre_animal: nombreAnimalFinal,
    especie,
    sexo,
    edad: edadFinal,
    peso: pesoFinal,
    tipo_animal: String(formData.get("tipo_animal") || "").trim(),
    foto_frente: urlFrente,
    foto_lado: urlLado,
    foto_carnet: urlCarnet,
    tamano: tamano || null,
    vacunado,
    desparasitado,
    requiere_valoracion_prequirurgica:
      edadMayorIgual4 || pesoBajo || menorDe4Meses,
  }),
})

const json = await res.json()

if (!res.ok || !json.ok) {
  if (json.duplicated) {
    setMensajeDuplicado(json.error || "Solicitud duplicada.")
    setLoading(false)
    return
  }

  throw new Error(json.error || "Error enviando solicitud")
}

      e.target.reset()
      setPreviewFrente(null)
      setPreviewLado(null)
      setPreviewCarnet(null)
      setLat(null)
      setLng(null)
      setMensajeDuplicado("")
      setSinNombre(false)
      setEdadAnos("")
      setEdadMeses("")
      setPesoKg("")
      setPesoG("0")
      setTamano("")
      setVacunado(false)
      setDesparasitado(false)
      setErrores({})
      setEnviado(true)
    } catch (err) {
      console.error("Error general enviando solicitud:", JSON.stringify(err, null, 2))
      alert("Ocurrió un error al enviar la solicitud.")
    }

    setLoading(false)
  }

  if (enviado) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#0b7a75_0%,#0f8a84_45%,#0d7a75_100%)] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[34px] bg-[#f4f4f4] p-8 shadow-2xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#0b6665]/70">
              Fundación Rugimos 🐾
            </p>

            <h1 className="text-3xl font-bold leading-tight text-[#43a047] md:text-4xl">
              ✅ Solicitud enviada correctamente
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Gracias por solicitar su cupo para la esterilización gratuita de la Fundación Rugimos.
              <br />
              <br />
              Nos comunicaremos con usted a la brevedad al número de WhatsApp proporcionado.
              <br />
              <br />
              Su ayuda es muy importante. El programa es gratuito, pero con cada aporte podremos esterilizar a más animales.
            </p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-xl rounded-[28px] border border-[#f2dfcf] bg-[#fff7f1] px-5 py-6 text-center sm:p-6">
            <h2 className="mx-auto max-w-[280px] text-center text-[22px] leading-snug font-bold text-[#b85d27] sm:max-w-md sm:text-2xl">
              ¿Te gustaría colaborar con la fundación?
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              Puedes colaborar escaneando nuestro QR de donación.
              Tu ayuda es muy importante. Con cada aporte podemos seguir esterilizando a más animales.
            </p>

            <div className="mt-6 flex justify-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <img
                  src="/qr.png"
                  alt="QR de donación Fundación Rugimos"
                  className="h-64 w-64 object-contain md:h-72 md:w-72"
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">Banco Ganadero S.A.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b7a75_0%,#0f8a84_45%,#0d7a75_100%)] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center text-white">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            🐾 Fundación Rugimos 🐾
          </p>

          <h1 className="text-4xl font-bold md:text-5xl">
            Solicitud de esterilización
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-sm text-white/85 md:text-base">
            Completa este formulario para solicitar un cupo gratuito.
          </p>
        </div>

        {mensajeDuplicado && (
          <div className="mb-6 rounded-[24px] border border-red-200 bg-red-50 p-5 text-red-800 shadow-md relative">
            <button
              type="button"
              onClick={() => setMensajeDuplicado("")}
              className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xl"
            >
              ×
            </button>

            <div className="pr-8">
              <h3 className="text-lg font-bold mb-2">⚠️ Solicitud duplicada detectada</h3>
              <p className="text-sm leading-relaxed">{mensajeDuplicado}</p>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-[26px] border border-[#efcfb7] bg-[#fff2e8] px-5 py-5 text-[15px] text-[#a35624] shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <p className="font-extrabold text-[#9a4f1f]">Importante</p>
          <p className="mt-1">
            El envío de este formulario no aprueba automáticamente la solicitud. Primero será revisada por nuestro equipo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

                    {/* =========================
              DATOS DEL RESPONSABLE
          ========================= */}
          <div className="rounded-[28px] border border-white/60 bg-[#f3f4f6] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
            <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.02em] text-[#005f63]">
              Datos del responsable
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Nombre</label>
                <input
                  name="nombre"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.nombre ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Primer apellido</label>
                <input
                  name="apellido1"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.apellido1 ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Segundo apellido</label>
                <input
                  name="apellido2"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.apellido2 ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">CI</label>
                <input
                  name="ci"
                  required
                  inputMode="numeric"
                  onInput={(e: any) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, "")
                  }}
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.ci ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">WhatsApp</label>
                <div className={`flex rounded-xl ${errores.celular ? "ring-1 ring-red-500" : ""}`}>
                  <span className="flex h-[52px] items-center rounded-l-2xl border border-r-0 border-[#cfd8e3] bg-[#eef2f7] px-4 font-semibold text-[#005f63] shadow-sm">
                    +591
                  </span>

                  <input
                    name="celular"
                    required
                    maxLength={8}
                    inputMode="numeric"
                    onInput={(e: any) => {
                      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 8)
                    }}
                    className={`h-[52px] w-full rounded-r-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.celular ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-3">
                <label className="text-[15px] font-bold text-[#005f63]">Zona</label>
                <select
                  name="ubicacion"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.ubicacion ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                >
                  <option value="">Seleccionar zona</option>
                  {zonas.map((zona) => (
                    <option key={zona.value} value={zona.value}>
                      {zona.label}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* =========================
              UBICACIÓN
          ========================= */}
          <div className="rounded-[28px] border border-white/60 bg-[#f3f4f6] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
            <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.02em] text-[#005f63]">
              Ubicación de la mascota
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Puedes usar tu ubicación actual o marcar manualmente en el mapa.
            </p>

            <div className="flex flex-wrap gap-3 mb-4">
              <button
                type="button"
                onClick={usarMiUbicacion}
                className="rounded-full bg-[#0d7a75] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:scale-[1.02] hover:bg-[#0b6b67]"
              >
                {ubicacionDetectando ? "Buscando..." : "Usar mi ubicación"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLat(null)
                  setLng(null)
                }}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-md transition hover:scale-[1.02]"
              >
                Limpiar
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border">
              <MapaSolicitud lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
            </div>

            <div className="mt-4 text-sm text-gray-600">
              {lat != null && lng != null ? (
                <p>
                  Ubicación: <strong>{lat.toFixed(6)}</strong>, <strong>{lng.toFixed(6)}</strong>
                </p>
              ) : (
                <p>No se seleccionó ubicación exacta.</p>
              )}
            </div>
          </div>

                    {/* =========================
              DATOS DEL ANIMAL
          ========================= */}
          <div className="rounded-[28px] border border-white/60 bg-[#f3f4f6] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
            <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.02em] text-[#005f63]">
              Datos del animal
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

              <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-4">
                <label className="text-[15px] font-bold text-[#005f63]">Nombre del animal</label>
                <input
                  name="nombre_animal"
                  required={!sinNombre}
                  disabled={sinNombre}
                  value={sinNombre ? "SN" : undefined}
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.nombre_animal ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                />

                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={sinNombre}
                    onChange={(e) => setSinNombre(e.target.checked)}
                    className="h-4 w-4 rounded border border-black accent-black"
                  />
                  <span>Sin nombre (SN)</span>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Especie</label>
                <select
                  name="especie"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.especie ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                >
                  <option value="">Seleccionar</option>
                  <option value="Perro">Perro</option>
                  <option value="Gato">Gato</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Sexo</label>
                <select
                  name="sexo"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.sexo ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                >
                  <option value="">Seleccionar</option>
                  <option value="Macho">Macho</option>
                  <option value="Hembra">Hembra</option>
                </select>
              </div>

              <div className={`flex flex-col gap-1 ${errores.edad ? "rounded-xl ring-1 ring-red-500 p-2" : ""}`}>
                <label className="text-[15px] font-bold text-[#005f63]">Edad</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={edadAnos}
                    onChange={(e) => setEdadAnos(e.target.value)}
                    
                    className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.edad ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                  >
                    <option value="">Años</option>
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i} años
                      </option>
                    ))}
                  </select>

                  <select
                    value={edadMeses}
                    onChange={(e) => setEdadMeses(e.target.value)}
                    
                    className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.edad ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                  >
                    <option value="">Meses</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i} meses
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`flex flex-col gap-1 ${errores.peso ? "rounded-xl ring-1 ring-red-500 p-2" : ""}`}>
                <label className="text-[15px] font-bold text-[#005f63]">Peso</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={pesoKg}
                    onChange={(e) => setPesoKg(e.target.value)}
                    
                    className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.peso ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                  >
                    <option value="">Kg</option>
                    {Array.from({ length: 41 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i} kg
                      </option>
                    ))}
                  </select>

                  <select
                    value={pesoG}
                    onChange={(e) => setPesoG(e.target.value)}
                    
                    className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.peso ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                  >
                    {["0", "100", "200", "300", "400", "500", "600", "700", "800", "900"].map((value) => (
                      <option key={value} value={value}>
                        {value} g
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
  <label className="text-[15px] font-bold text-[#005f63]">Tamaño</label>
  <select
    value={tamano}
    onChange={(e) => setTamano(e.target.value)}
    className="h-[52px] w-full rounded-2xl border border-[#cfd8e3] bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10"
  >
    <option value="">Seleccionar</option>
    <option value="Pequeño">Pequeño</option>
    <option value="Mediano">Mediano</option>
    <option value="Grande">Grande</option>
  </select>
</div>

              <div className="flex flex-col gap-1">
                <label className="text-[15px] font-bold text-[#005f63]">Tipo de animal</label>
                <select
                  name="tipo_animal"
                  required
                  
                  className={`h-[52px] w-full rounded-2xl border bg-white px-4 text-[15px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0d7a75] focus:ring-4 focus:ring-[#0d7a75]/10 ${
  errores.tipo_animal ? "border-red-500 bg-red-50" : "border-[#cfd8e3]"
}`}
                >
                  <option value="">Seleccionar</option>
                  <option value="Propio">Propio</option>
                  <option value="Calle">De la calle</option>
                </select>
              </div>

            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm transition ${
  vacunado
    ? "border-[#0d7a75] bg-[#e7f6f4]"
    : "border-[#cfd8e3] bg-white"
}`}
              >
                <input
                  type="checkbox"
                  checked={vacunado}
                  onChange={(e) => setVacunado(e.target.checked)}
                  className="h-4 w-4 rounded-full border border-black accent-black"
                />
                <span className="text-[#005f63] font-bold">Vacunado</span>
              </label>

              <label
                
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm transition ${
  desparasitado
    ? "border-[#0d7a75] bg-[#e7f6f4]"
    : "border-[#cfd8e3] bg-white"
}`}
              >
                <input
                  type="checkbox"
                  checked={desparasitado}
                  onChange={(e) => setDesparasitado(e.target.checked)}
                  className="h-4 w-4 rounded-full border border-black accent-black"
                />
                
                <span className="text-[#005f63] font-bold">Desparasitado</span>
              </label>
            </div>

            {edadMayorIgual4 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-semibold">⚠️ Aviso importante</p>
                <p className="mt-1">
                  Paciente con edad mayor o igual a 4 años. Se recomienda valoración veterinaria previa y, según criterio médico, evaluación prequirúrgica.
                </p>
              </div>
            )}

            {pesoBajo && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">⛔ Peso bajo</p>
                <p className="mt-1">
                  El paciente pesa menos de 700 g. Requiere valoración veterinaria previa y no debe programarse automáticamente sin revisión.
                </p>
              </div>
            )}

            {menorDe4Meses && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">⛔ No apto por edad</p>
                <p className="mt-1">
                  El paciente tiene menos de 4 meses de edad. No puede esterilizarse en este momento y requiere esperar la edad mínima indicada.
                </p>
              </div>
            )}
          </div>

                    {/* =========================
              FOTOS DEL ANIMAL
          ========================= */}
          <div className="rounded-[28px] border border-white/60 bg-[#f3f4f6] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.12)]">
            <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.02em] text-[#005f63]">
              Fotos del animal
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* FOTO FRENTE */}
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
                <p className="mb-2 text-sm font-bold text-[#0b6665]">Foto de frente</p>
                <p className="mb-4 text-xs text-slate-500">
                  Sube una foto clara donde se vea bien al animal de frente.
                </p>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-3">
                  <p className="font-semibold mb-1">📸 Consejo para la foto</p>
                  <p>
                    Usa una imagen bien iluminada, sin desenfoque y donde el animal se vea completo.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#f47c3c] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]">
                  Seleccionar foto
                  <input
                    type="file"
                    name="foto_frente"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e: any) => {
                      const file = e.target.files?.[0]
                      if (file) handlePreview(file, setPreviewFrente)
                    }}
                  />
                </label>

                {previewFrente ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <img
                      src={previewFrente}
                      alt="Preview frente"
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    Vista previa foto de frente
                  </div>
                )}
              </div>

              {/* FOTO LADO */}
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
                <p className="mb-2 text-sm font-bold text-[#0b6665]">Foto de lado</p>
                <p className="mb-4 text-xs text-slate-500">
                  Sube una foto lateral del animal para ayudar en la evaluación.
                </p>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-3">
                  <p className="font-semibold mb-1">📸 Consejo para la foto</p>
                  <p>
                    Procura que el cuerpo del animal se vea completo y sin objetos tapándolo.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#0d7a75] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]">
                  Seleccionar foto
                  <input
                    type="file"
                    name="foto_lado"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e: any) => {
                      const file = e.target.files?.[0]
                      if (file) handlePreview(file, setPreviewLado)
                    }}
                  />
                </label>

                {previewLado ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <img
                      src={previewLado}
                      alt="Preview lado"
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    Vista previa foto de lado
                  </div>
                )}
              </div>

              {/* FOTO CARNET */}
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
                <p className="mb-2 text-sm font-bold text-[#0b6665]">Foto del carnet</p>
                <p className="mb-4 text-xs text-slate-500">
                  Sube una foto clara del carnet o documento solicitado.
                </p>

                <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 mb-3">
                  <p className="font-semibold mb-1">🪪 Importante</p>
                  <p>
                    Verifica que los datos se lean bien y que la imagen no esté cortada ni borrosa.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#f47c3c] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]">
                  Seleccionar foto
                  <input
                    type="file"
                    name="foto_carnet"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e: any) => {
                      const file = e.target.files?.[0]
                      if (file) handlePreview(file, setPreviewCarnet)
                    }}
                  />
                </label>

                {previewCarnet ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <img
                      src={previewCarnet}
                      alt="Preview carnet"
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    Vista previa foto del carnet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =========================
              CONFIRMACIÓN FINAL
          ========================= */}
          <div className="rounded-[28px] bg-[#f4f4f4] p-6 shadow-lg">
            <h2 className="text-center text-2xl font-bold text-[#0b6665]">
              Revisión antes de enviar
            </h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-medium">
                Verifica que toda la información esté correcta antes de enviar la solicitud.
              </p>
              <p className="mt-2 text-slate-500">
                Nuestro equipo revisará los datos, las fotos y la información del animal.
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-[#f47c3c] px-8 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Enviando solicitud..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}