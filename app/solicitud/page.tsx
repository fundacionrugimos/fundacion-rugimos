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

  const [mensajeDuplicado, setMensajeDuplicado] = useState("")

  const MAX_SIZE = 5 * 1024 * 1024
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

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

    try {
      const nombre = String(formData.get("nombre") || "").trim()
      const apellido1 = String(formData.get("apellido1") || "").trim()
      const apellido2 = String(formData.get("apellido2") || "").trim()

      const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`.trim()

      const celular = String(formData.get("celular") || "")
      const nombreAnimal = String(formData.get("nombre_animal") || "")
      const especie = String(formData.get("especie") || "")
      const sexo = String(formData.get("sexo") || "")

      const celularLimpio = limpiarTelefono(celular)
      const nombreAnimalLimpio = limpiarTexto(nombreAnimal)
      const especieLimpia = limpiarTexto(especie)
      const sexoLimpio = limpiarTexto(sexo)

      const fechaLimite = fechaHaceDias(90)

      const { data: posiblesDuplicados, error: errorDuplicado } = await supabase
        .from("solicitudes")
        .select("id, celular, nombre_animal, especie, sexo, estado, created_at")
        .in("estado", ["Pendiente", "Aprobado", "Reprogramado"])
        .gte("created_at", fechaLimite)

      if (errorDuplicado) {
        console.error("Error verificando duplicados:", errorDuplicado)
        alert("Ocurrió un error verificando si la solicitud ya existe.")
        setLoading(false)
        return
      }

      const duplicado = (posiblesDuplicados || []).find((item: any) => {
        const cel = limpiarTelefono(item.celular || "")
        const animal = limpiarTexto(item.nombre_animal || "")
        const esp = limpiarTexto(item.especie || "")
        const sx = limpiarTexto(item.sexo || "")

        return (
          cel === celularLimpio &&
          animal === nombreAnimalLimpio &&
          esp === especieLimpia &&
          sx === sexoLimpio
        )
      })

      if (duplicado) {
        setMensajeDuplicado(
          "Ya existe una solicitud reciente para esta mascota con este número de contacto. Si necesita corregir información o consultar el estado, comuníquese con Fundación Rugimos."
        )
        setLoading(false)
        return
      }

      const codigoGenerado = await generarCodigoRG()

      // Optimizamos las imágenes SOLO antes de subirlas.
      // No cambia nada del funcionamiento del sistema.
      const fotoFrenteOptimizada = await optimizarImagen(fotoFrente, 1200, 0.72)
      const fotoLadoOptimizada = await optimizarImagen(fotoLado, 1200, 0.72)
      const fotoCarnetOptimizada = await optimizarImagen(fotoCarnet, 1400, 0.78)

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

      const { error } = await supabase.from("solicitudes").insert([
        {
          codigo: codigoGenerado,
          nombre_completo: nombreCompleto,
          ci: formData.get("ci"),
          celular: celular,
          ubicacion: formData.get("ubicacion"),
          lat,
          lng,
          nombre_animal: nombreAnimal,
          especie: especie,
          sexo: sexo,
          edad: formData.get("edad"),
          peso: formData.get("peso"),
          tipo_animal: formData.get("tipo_animal"),
          foto_frente: urlFrente,
          foto_lado: urlLado,
          foto_carnet: urlCarnet,
          estado: "Pendiente",
        },
      ])

      if (error) {
        console.error("Error insertando solicitud:", JSON.stringify(error, null, 2))
        throw error
      }

      e.target.reset()
      setPreviewFrente(null)
      setPreviewLado(null)
      setPreviewCarnet(null)
      setLat(null)
      setLng(null)
      setMensajeDuplicado("")
      setEnviado(true)
    } catch (err) {
      console.error("Error general enviando solicitud:", JSON.stringify(err, null, 2))
      alert("Ocurrió un error al enviar la solicitud.")
    }

    setLoading(false)
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-[#0f6a63] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-xl text-center">
          <h2 className="text-3xl font-bold text-green-600 mb-6">
            ✅ Solicitud enviada correctamente
          </h2>

          <p className="text-gray-800 leading-relaxed text-lg">
            Gracias por solicitar su cupo para la esterilización gratuita de la Fundación Rugimos.
            <br />
            <br />
            Nos comunicaremos con usted en un plazo máximo de 24 horas al número de WhatsApp proporcionado.
            <br />
            <br />
            Su ayuda es muy importante. El programa es gratuito, pero con cada aporte podremos esterilizar a más animales.
          </p>

          <div className="flex justify-center mt-6">
            <img src="/qr.png" className="w-56 h-56" />
          </div>

          <p className="text-sm text-gray-500 mt-4">Banco Ganadero S.A.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f6a63] flex justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-4xl space-y-6 text-gray-800">
        {mensajeDuplicado && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl shadow-lg p-5 relative">
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

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Datos del Responsable
          </h2>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <input
              name="nombre"
              placeholder="Nombre"
              required
              className="border p-3 rounded-lg text-gray-800"
            />

            <input
              name="apellido1"
              placeholder="Primer apellido"
              required
              className="border p-3 rounded-lg text-gray-800"
            />

            <input
              name="apellido2"
              placeholder="Segundo apellido"
              required
              className="border p-3 rounded-lg text-gray-800"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              name="ci"
              type="text"
              placeholder="CI del responsable"
              required
              inputMode="numeric"
              onInput={(e: any) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, "")
              }}
              className="border p-3 rounded-lg text-gray-800"
            />

            <div className="flex">
              <span className="flex items-center px-3 bg-gray-200 border border-r-0 rounded-l-lg text-gray-700">
                +591
              </span>

              <input
                name="celular"
                type="text"
                placeholder="70000000"
                required
                maxLength={8}
                inputMode="numeric"
                onInput={(e: any) => {
                  e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 8)
                }}
                className="border p-3 rounded-r-lg w-full text-gray-800"
              />
            </div>

            <select
              name="ubicacion"
              required
              className="border p-3 rounded-lg md:col-span-2 text-gray-800"
            >
              <option value="">Seleccionar zona</option>
              <option value="Norte">Norte</option>
              <option value="Centro-Norte">Centro-Norte</option>
              <option value="Sur">Sur</option>
              <option value="Oeste">Oeste</option>
              <option value="Este">Este</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Ubicación de la mascota
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Marque la ubicación aproximada en el mapa. Si no desea marcarla, el sistema seguirá usando la zona seleccionada.
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              onClick={usarMiUbicacion}
              className="bg-[#02686A] text-white px-4 py-2 rounded-lg font-semibold"
            >
              {ubicacionDetectando ? "Buscando ubicación..." : "Usar mi ubicación actual"}
            </button>

            <button
              type="button"
              onClick={() => {
                setLat(null)
                setLng(null)
              }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              Limpiar ubicación
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden border">
            <MapaSolicitud lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
          </div>

          <div className="mt-4 text-sm text-gray-600">
            {lat != null && lng != null ? (
              <p>
                Ubicación seleccionada: <strong>{lat.toFixed(6)}</strong>, <strong>{lng.toFixed(6)}</strong>
              </p>
            ) : (
              <p>No se ha seleccionado ubicación exacta. Se usará la zona elegida.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Datos del Animal
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              name="nombre_animal"
              placeholder="Nombre del animal"
              required
              className="border p-3 rounded-lg text-gray-800"
            />

            <select name="especie" required className="border p-3 rounded-lg text-gray-800">
              <option value="">Especie</option>
              <option value="Perro">Perro</option>
              <option value="Gato">Gato</option>
            </select>

            <select name="sexo" required className="border p-3 rounded-lg text-gray-800">
              <option value="">Sexo</option>
              <option value="Macho">Macho</option>
              <option value="Hembra">Hembra</option>
            </select>

            <select name="edad" required className="border p-3 rounded-lg text-gray-800">
              <option value="">Edad</option>
              <option value="<6 meses">Menos de 6 meses</option>
              <option value="6 meses a 1 año">6 meses a 1 año</option>
              <option value="1 a 3 años">1 a 3 años</option>
              <option value=">3 años">Más de 3 años</option>
            </select>

            <input
              name="peso"
              type="text"
              placeholder="Peso"
              required
              inputMode="numeric"
              onInput={(e: any) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, "")
              }}
              onBlur={(e: any) => {
                if (e.target.value) {
                  e.target.value = e.target.value.replace(" kg", "") + " kg"
                }
              }}
              className="border p-3 rounded-lg text-gray-800"
            />

            <select
              name="tipo_animal"
              required
              className="border p-3 rounded-lg text-gray-800"
            >
              <option value="">Animal</option>
              <option value="Propio">Propio</option>
              <option value="Calle">De la calle</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Fotos del Registro
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">
              {previewFrente ? (
                <img src={previewFrente} className="h-24 object-cover rounded" />
              ) : (
                <span className="text-gray-600">Frente del animal</span>
              )}

              <input
                type="file"
                name="foto_frente"
                className="hidden"
                onChange={(e: any) => handlePreview(e.target.files[0], setPreviewFrente)}
                required
              />
            </label>

            <label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">
              {previewLado ? (
                <img src={previewLado} className="h-24 object-cover rounded" />
              ) : (
                <span className="text-gray-600">Lateral del animal</span>
              )}

              <input
                type="file"
                name="foto_lado"
                className="hidden"
                onChange={(e: any) => handlePreview(e.target.files[0], setPreviewLado)}
                required
              />
            </label>

            <label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">
              {previewCarnet ? (
                <img src={previewCarnet} className="h-24 object-cover rounded" />
              ) : (
                <span className="text-gray-600">Carnet del responsable</span>
              )}

              <input
                type="file"
                name="foto_carnet"
                className="hidden"
                onChange={(e: any) => handlePreview(e.target.files[0], setPreviewCarnet)}
                required
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#f47c3c] text-white py-4 rounded-2xl font-bold text-lg"
        >
          {loading ? "Enviando..." : "Enviar Solicitud"}
        </button>
      </form>
    </div>
  )
}