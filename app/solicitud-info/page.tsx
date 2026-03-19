"use client"

import {
  AlertTriangle,
  X,
  Cat,
  CheckCircle2,
  Phone,
  HeartHandshake,
} from "lucide-react"
import { useState } from "react"

export default function SolicitudInfoPage() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="min-h-screen bg-[#0f6f6a] relative overflow-hidden">
      {/* DECORACIÓN DE FONDO */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-[#f47c3c]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center text-white mb-8 md:mb-10">
          <div className="inline-flex items-center justify-center bg-white/12 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-5 shadow-sm">
            <HeartHandshake className="w-5 h-5 mr-2" />
            <span className="font-semibold">Fundación Rugimos</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight max-w-4xl mx-auto">
            Datos importantes antes de solicitar tu cupo
          </h1>

          <p className="mt-4 text-base md:text-lg text-white/90 max-w-3xl mx-auto leading-relaxed">
            Por favor lee esta información antes de continuar con el formulario.
            Estas reglas ayudan a proteger la salud de tu mascota y permiten que la
            campaña funcione correctamente.
          </p>
        </div>

        <div className="bg-[#FFF4E5] border border-[#F5C27B] text-[#7A4B00] rounded-3xl p-4 md:p-5 shadow-lg mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="font-bold text-lg">Importante</h2>
              <p className="mt-1 text-sm md:text-base leading-relaxed">
                La solicitud será revisada según los requisitos de la campaña.
                Si tu mascota no cumple las condiciones mínimas, no podrá ser programada.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-[#D9EEEE] hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#FFE8E8] text-[#D64545] p-3 rounded-2xl shadow-sm">
                <X className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#02686A]">
                Mascotas gestantes o lactando
              </h3>
            </div>

            <p className="text-gray-700 leading-relaxed">
              No realizamos esterilizaciones en animales:
            </p>

            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Gestantes (embarazadas)</li>
              <li>• En periodo de lactancia</li>
            </ul>

            <div className="mt-4 bg-[#FFF1F1] border border-[#FFD2D2] rounded-2xl p-4 text-[#B94040] font-medium leading-relaxed">
              Después del parto deben pasar mínimo <span className="font-extrabold">4 semanas</span>.
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-[#D9EEEE] hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-100 text-cyan-700 p-3 rounded-2xl shadow-sm">
                <Cat className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#02686A]">
                Requisitos para gatos
              </h3>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Para realizar la esterilización, los gatos deben cumplir con lo siguiente:
            </p>

            <ul className="mt-3 space-y-2 text-gray-700">
              <li>• Más de <span className="font-bold">4 meses</span> de edad</li>
              <li>• Más de <span className="font-bold">1 kg</span> de peso</li>
            </ul>

            <div className="mt-4 bg-cyan-50 border border-cyan-200 rounded-2xl p-4 text-cyan-800 font-medium leading-relaxed">
              Esto es necesario para garantizar la seguridad durante la cirugía.
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-[#D9EEEE] hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 text-emerald-700 p-3 rounded-2xl shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#02686A]">
                Varias mascotas
              </h3>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Si deseas esterilizar más de una mascota, debes hacer una solicitud por cada animal.
            </p>

            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 font-medium leading-relaxed">
              Cada mascota necesita su propio registro y su propio cupo.
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-[#D9EEEE] hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 text-orange-700 p-3 rounded-2xl shadow-sm">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#02686A]">
                Número de celular
              </h3>
            </div>

            <p className="text-gray-700 leading-relaxed">
              Es muy importante escribir correctamente tu número de celular en el formulario.
            </p>

            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 text-orange-800 font-medium leading-relaxed">
              Ahí recibirás la confirmación de tu cupo por WhatsApp.
              Si el número está incorrecto, no podremos contactarte.
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-[2rem] shadow-2xl border border-[#D9EEEE] p-6 md:p-8">
          <h3 className="text-2xl font-bold text-[#02686A] mb-4 text-center">
            Confirmación antes de continuar
          </h3>

          <label className="flex items-start gap-3 cursor-pointer bg-gradient-to-r from-[#F7FBFB] to-[#F1F8F8] border border-[#D9EEEE] rounded-2xl p-4 hover:border-[#B9DDDD] transition">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#02686A]"
            />
            <span className="text-gray-700 leading-relaxed">
              Confirmo que he leído la información y entiendo que mi mascota
              <span className="font-semibold"> no debe estar gestante ni lactando</span>,
              y que debe cumplir con los requisitos mínimos indicados para poder solicitar un cupo.
            </span>
          </label>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/"
              }}
              className="px-6 py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold transition"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={() => {
                if (!checked) return
                window.location.href = "/solicitud"
              }}
              disabled={!checked}
              className={`px-8 py-3 rounded-2xl font-bold text-white shadow-lg transition-all ${
                checked
                  ? "bg-[#F47C3C] hover:bg-[#E56D2F] hover:scale-[1.02]"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              He leído, proseguir
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-white/85">
          Fundación Rugimos 🐾
        </div>
      </div>
    </div>
  )
}