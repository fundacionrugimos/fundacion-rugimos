"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import QRCode from "qrcode"

export default function PacienteQR() {
  const params = useParams()

  const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo ?? ""

  /* NORMALIZAR CÓDIGO (CORRECCIÓN QR) */
  const codigoLimpo = codigo.trim().toUpperCase()

  const [registro, setRegistro] = useState<any>(null)
  const [qr, setQr] = useState<string>("")
  const [cargando, setCargando] = useState(true)

  function formatearHora(hora?: string | null) {
    if (!hora) return "Asignación pendiente"
    return hora
  }

  /* CARGAR DATOS DEL PACIENTE */
  async function cargar() {
    setCargando(true)

    const { data, error } = await supabase
      .from("registros")
      .select("*")
      .ilike("codigo", codigoLimpo)
      .single()

    if (error) {
      console.log(error)
      setCargando(false)
      return
    }

    if (data) {
      setRegistro(data)

      /* GENERAR QR GRANDE PARA LA CLÍNICA */
      const urlClinica = `https://fundacion-rugimos.vercel.app/clinica/${codigoLimpo}`

      const qrImage = await QRCode.toDataURL(urlClinica, {
        width: 400,
        margin: 3,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })

      setQr(qrImage)
    }

    setCargando(false)
  }

  useEffect(() => {
    if (codigo) {
      cargar()
    }
  }, [codigo])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f6d6a] text-white text-xl">
        Cargando información...
      </div>
    )
  }

  if (!registro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f6d6a] text-white text-xl">
        Paciente no encontrado
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f6d6a] relative overflow-hidden">
      {/* DECORACIÓN DE FONDO */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-36 -right-16 w-80 h-80 bg-[#f47c3c]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[220px] bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center justify-center px-6 py-10 md:py-14">
        <img src="/logo.png" className="w-56 md:w-64 mb-6 drop-shadow-2xl" alt="Rugimos" />

        <div className="inline-flex items-center justify-center bg-white/12 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-5 shadow-sm text-white font-semibold">
          Cita confirmada
        </div>

        <h1 className="text-white text-3xl md:text-5xl font-extrabold text-center max-w-4xl leading-tight mb-3">
          Presenta este código al llegar a la clínica
        </h1>

        <p className="text-white/85 text-center max-w-2xl text-base md:text-lg mb-8">
          Muestre esta pantalla al personal de la clínica para registrar rápidamente el ingreso de su mascota.
        </p>

        <div className="bg-white rounded-[2rem] shadow-2xl border border-white/60 p-6 md:p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <p className="text-sm uppercase tracking-[0.2em] text-gray-400 font-semibold mb-2">
              Código de atención
            </p>

            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f6d6a]">
              {registro.codigo}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#F5FAFA] border border-[#D9EEEE] rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Animal</p>
              <p className="text-[#0f6d6a] font-bold text-lg break-words">
                {registro.nombre_animal || "-"}
              </p>
            </div>

            <div className="bg-[#FDF7F2] border border-[#F6D3BE] rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Hora</p>
              <p className="text-[#F47C3C] font-bold text-lg">
                {formatearHora(registro.hora)}
              </p>
            </div>

            <div className="bg-[#F7FBFB] border border-[#D9EEEE] rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Especie</p>
              <p className="text-gray-800 font-semibold">
                {registro.especie || "-"}
              </p>
            </div>

            <div className="bg-[#F7FBFB] border border-[#D9EEEE] rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Sexo</p>
              <p className="text-gray-800 font-semibold">
                {registro.sexo || "-"}
              </p>
            </div>
          </div>

          {/* QR */}
          <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-[2rem] p-5 md:p-6 shadow-inner">
            <div className="flex justify-center">
              <img
                src={qr}
                className="w-64 h-64 md:w-72 md:h-72 rounded-xl"
                alt="QR del paciente"
              />
            </div>

            <p className="text-gray-600 mt-4 text-sm text-center leading-relaxed">
              Muestra este QR al llegar a la clínica
            </p>
          </div>
        </div>

        {/* INSTRUCCIONES */}
        <div className="mt-8 grid gap-3 w-full max-w-lg">
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-4 text-white flex items-center gap-3">
            <span className="text-xl">💧</span>
            <span className="font-medium">Ayuno de agua: 4 horas</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-4 text-white flex items-center gap-3">
            <span className="text-xl">🛏</span>
            <span className="font-medium">Llevar manta</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-4 text-white flex items-center gap-3">
            <span className="text-xl">⏰</span>
            <span className="font-medium">Llegar 15 minutos antes</span>
          </div>
        </div>
      </div>
    </div>
  )
}