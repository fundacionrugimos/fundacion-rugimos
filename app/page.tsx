"use client"
import { useState } from "react"

export default function Home() {
  const [showQR, setShowQR] = useState(false)

  return (
    <div className="min-h-screen bg-[#0f6f6a] text-white flex flex-col items-center justify-center p-6">

      {/* LOGO */}
      <img src="/logo.png" alt="Rugimos" className="w-64 mb-6" />

      {/* SLOGAN */}
      <h1 className="text-3xl md:text-4xl font-medium tracking-wide mb-10 text-center">
        Esterilizar y educar para un cambio real
      </h1>

      <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl">

        {/* SOLICITUD */}
        <div className="bg-white text-gray-800 p-6 rounded-xl shadow-lg flex flex-col justify-between h-full text-center">

          <div>
            <h2 className="text-xl font-bold mb-3">Solicita tu cupo</h2>

            <p className="mb-6">
              Complete el formulario para solicitar cupo y esterilizar su mascota de manera gratuita.
            </p>
          </div>

          <a
            href="/solicitud"
            className="bg-[#f47c3c] text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
          >
            Iniciar solicitud
          </a>

        </div>

        {/* DONACIONES */}
        <div className="bg-white text-gray-800 p-6 rounded-xl shadow-lg flex flex-col justify-between h-full text-center">

          <div>
            <h2 className="text-xl font-bold mb-3">Donaciones</h2>

            <p className="mb-6">
              Tu aporte, por pequeño que sea, nos permite esterilizar más animales y enfrentar la sobrepoblación.
            </p>
          </div>

          <button
            onClick={() => setShowQR(true)}
            className="bg-[#f47c3c] text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
          >
            Donar
          </button>

        </div>

        {/* INFORMACIÓN */}
        <div className="bg-white text-gray-800 p-6 rounded-xl shadow-lg flex flex-col justify-between h-full text-center">

          <div>
            <h2 className="text-xl font-bold mb-3">Información General</h2>

            <p className="mb-6">
              Contactarnos para tener más información sobre Rugimos.
            </p>
          </div>

          <a
            href="https://wa.me/59178556854?text=Hola,%20deseo%20obtener%20información%20sobre%20la%20Fundación%20RUGIMOS."
            target="_blank"
            className="bg-[#f47c3c] text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
          >
            Contactar
          </a>

        </div>

      </div>

      {/* MODAL QR */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center">

          <div className="bg-white p-8 rounded-xl text-center text-black max-w-sm">

            <h2 className="text-xl font-bold mb-4">
              Escanee el QR para donar
            </h2>

            <img src="/qr.png" alt="QR Donación" className="mb-4 mx-auto" />

            <p className="text-sm text-gray-600 mb-4">
              Cada aporte nos ayuda a esterilizar más animales y continuar nuestra labor.
            </p>

            <button
              onClick={() => setShowQR(false)}
              className="bg-[#f47c3c] text-white px-4 py-2 rounded-lg"
            >
              Cerrar
            </button>

          </div>

        </div>
      )}

    </div>
  )
}