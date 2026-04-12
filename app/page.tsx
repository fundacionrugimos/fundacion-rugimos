"use client"

import { useEffect, useMemo, useState } from "react"
import CountUp from "react-countup"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [showQR, setShowQR] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)

  const [stats, setStats] = useState({
    solicitudes: 0,
    aprobadas: 0,
    realizadas: 0,
    noShow: 0,
  })

  async function cargarImpacto() {
  setLoadingStats(true)

  try {
    const res = await fetch("/api/public/impacto")
    const json = await res.json()

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "No se pudo cargar el impacto")
    }

    setStats({
      solicitudes: json.data?.solicitudes || 0,
      aprobadas: json.data?.aprobadas || 0,
      realizadas: json.data?.realizadas || 0,
      noShow: json.data?.noShow || 0,
    })
  } catch (error) {
    console.error("Error cargando impacto:", error)
    setStats({
      solicitudes: 0,
      aprobadas: 0,
      realizadas: 0,
      noShow: 0,
    })
  } finally {
    setLoadingStats(false)
  }
}

  useEffect(() => {
    cargarImpacto()
  }, [])

  const tarjetas = useMemo(
    () => [
      {
        titulo: "Solicitudes recibidas",
        valor: stats.solicitudes,
        color: "text-[#0F6D6A]",
        bg: "from-white to-[#F4FBFA]",
        borde: "border-[#BFE7E3]",
      },
      {
        titulo: "Solicitudes aprobadas",
        valor: stats.aprobadas,
        color: "text-green-600",
        bg: "from-white to-[#F2FBF3]",
        borde: "border-[#CBEFD1]",
      },
      {
        titulo: "Cirugías realizadas",
        valor: stats.realizadas,
        color: "text-[#F47C3C]",
        bg: "from-white to-[#FFF6F0]",
        borde: "border-[#FFD9C2]",
      },
      {
        titulo: "Casos no show",
        valor: stats.noShow,
        color: "text-red-500",
        bg: "from-white to-[#FFF4F4]",
        borde: "border-[#FFD2D2]",
      },
    ],
    [stats]
  )

  return (
    <div className="min-h-screen bg-[#0f6f6a] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-[#f47c3c]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full px-6 py-10 md:py-14">
        <div className="max-w-6xl mx-auto">
          {/* HERO */}
          <div className="flex flex-col items-center text-center mb-12">
            <img
              src="/logo.png"
              alt="Rugimos"
              className="w-72 md:w-80 drop-shadow-2xl mb-8"
            />

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-8 max-w-4xl">
              Esterilizar y educar para un cambio real
            </h1>
          </div>

          {/* CARDS PRINCIPALES */}
          <div className="grid w-full gap-7 mb-16 md:grid-cols-2 xl:grid-cols-4">
            <div className="group flex h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-8 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F6D6A]/10 text-3xl shadow-sm">
                  📝
                </div>

                <h2 className="mb-4 text-[30px] font-extrabold leading-tight text-[#0F6D6A]">
                  Solicita tu cupo
                </h2>

                <p className="mb-8 text-[17px] leading-8 text-slate-600">
                  Complete el formulario para solicitar cupo y esterilizar su mascota
                  de manera gratuita.
                </p>
              </div>

              <a
                href="/solicitud-info"
                className="rounded-2xl bg-[#F47C3C] px-6 py-3.5 text-[17px] font-bold text-white shadow-md transition hover:scale-[1.02] hover:opacity-95"
              >
                Iniciar solicitud
              </a>
            </div>

            <div className="group flex h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-8 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F47C3C]/10 text-3xl shadow-sm">
                  💛
                </div>

                <h2 className="mb-4 text-[30px] font-extrabold leading-tight text-[#0F6D6A]">
                  Donaciones
                </h2>

                <p className="mb-8 text-[17px] leading-8 text-slate-600">
                  Tu aporte, por pequeño que sea, nos permite esterilizar más animales
                  y enfrentar la sobrepoblación.
                </p>
              </div>

              <button
                onClick={() => setShowQR(true)}
                className="rounded-2xl bg-[#F47C3C] px-6 py-3.5 text-[17px] font-bold text-white shadow-md transition hover:scale-[1.02] hover:opacity-95"
              >
                Donar
              </button>
            </div>

            <div className="group flex h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-8 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F6D6A]/10 text-3xl shadow-sm">
                  ℹ️
                </div>

                <h2 className="mb-4 text-[30px] font-extrabold leading-tight text-[#0F6D6A]">
                  Información General
                </h2>

                <p className="mb-8 text-[17px] leading-8 text-slate-600">
                  Contáctanos para recibir más información sobre la Fundación Rugimos
                  y nuestro trabajo.
                </p>
              </div>

              <a
                href="https://wa.me/59178556854?text=Hola,%20deseo%20obtener%20información%20sobre%20la%20Fundación%20RUGIMOS."
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#F47C3C] px-6 py-3.5 text-[17px] font-bold text-white shadow-md transition hover:scale-[1.02] hover:opacity-95"
              >
                Contactar
              </a>
            </div>

            <div className="group flex h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-8 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F47C3C]/10 text-3xl shadow-sm">
                  🐾
                </div>

                <h2 className="mb-4 text-[30px] font-extrabold leading-tight text-[#0F6D6A]">
                  Adopciones
                </h2>

                <p className="mb-8 text-[17px] leading-8 text-slate-600">
                  Encuentra un nuevo compañero o publica un animal para adopción responsable.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href="/adopciones"
                  className="rounded-2xl bg-[#F47C3C] px-6 py-3.5 text-[17px] font-bold text-white shadow-md transition hover:scale-[1.02] hover:opacity-95"
                >
                  Adoptar
                </a>

                <a
                  href="/adopciones/publicar"
                  className="rounded-2xl border border-[#0F6D6A]/25 bg-white px-6 py-3.5 text-[17px] font-bold text-[#0F6D6A] shadow-sm transition hover:scale-[1.02] hover:bg-[#f7fbfb]"
                >
                  Dar en adopción
                </a>
              </div>
            </div>
          </div>

          {/* IMPACTO */}
          <section className="mb-12">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[2rem] p-6 md:p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-block bg-white text-[#0F6D6A] px-6 py-2 rounded-full text-sm md:text-base font-bold shadow-lg mb-4">
                  NUESTRO IMPACTO
                </div>

                <h2 className="text-2xl md:text-4xl font-bold mb-3">
                  Cifras reales que reflejan nuestro trabajo
                </h2>

                <p className="text-white/80 max-w-3xl mx-auto">
                  Cada número se actualiza automáticamente con la actividad real del sistema
                  y muestra el alcance de nuestra labor en la comunidad.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {tarjetas.map((item) => (
                  <div
                    key={item.titulo}
                    className={`rounded-3xl border ${item.borde} bg-gradient-to-br ${item.bg} text-gray-800 p-5 md:p-6 shadow-xl hover:-translate-y-1 transition duration-300`}
                  >
                    <p className="text-sm md:text-base text-gray-500 font-medium min-h-[40px]">
                      {item.titulo}
                    </p>

                    <div className={`mt-4 text-3xl md:text-5xl font-extrabold ${item.color}`}>
                      {loadingStats ? (
                        <span className="opacity-60">...</span>
                      ) : (
                        <CountUp end={item.valor} duration={1.8} separator="." />
                      )}
                    </div>

                    <div className="mt-4 h-1.5 w-16 rounded-full bg-black/10 overflow-hidden">
                      <div className="h-full w-full bg-[#0F6D6A]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BLOQUES EXTRA */}
          <section className="grid md:grid-cols-2 gap-6 mb-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[2rem] p-6 md:p-8 shadow-2xl">
              <h3 className="text-2xl font-bold mb-3">Compromiso real con la ciudad</h3>
              <p className="text-white/85 leading-relaxed">
                Nuestro trabajo une esterilización, organización comunitaria,
                educación y seguimiento. Cada solicitud recibida representa una
                oportunidad concreta de prevenir abandono, sufrimiento y
                sobrepoblación.
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#f47c3c] to-[#ff9966] rounded-[2rem] p-6 md:p-8 shadow-2xl text-white">
              <h3 className="text-2xl font-bold mb-3">Ayúdanos a llegar más lejos</h3>
              <p className="text-white/95 leading-relaxed mb-5">
                Tu apoyo nos ayuda a seguir ampliando cupos, mejorar la logística y
                sostener campañas que cambian vidas.
              </p>

              <button
                onClick={() => setShowQR(true)}
                className="bg-white text-[#f47c3c] px-6 py-3 rounded-xl font-bold hover:opacity-90 transition shadow-md"
              >
                Ver QR de donación
              </button>
            </div>
          </section>

          {/* MODAL QR */}
          {showQR && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white p-8 rounded-3xl text-center text-black max-w-sm w-full shadow-2xl border border-white/50">
                <h2 className="text-2xl font-bold mb-4 text-[#0F6D6A]">
                  Escanee el QR para donar
                </h2>

                <img
                  src="/qr.png"
                  alt="QR Donación"
                  className="mb-4 mx-auto rounded-xl"
                />

                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                  Cada aporte nos ayuda a esterilizar más animales, ampliar campañas y
                  continuar nuestra labor con mayor alcance.
                </p>

                <button
                  onClick={() => setShowQR(false)}
                  className="bg-[#f47c3c] text-white px-5 py-3 rounded-xl font-semibold hover:opacity-90 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}