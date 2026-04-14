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
    <div className="relative min-h-screen overflow-hidden bg-[#0f6f6a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-20 top-40 h-80 w-80 rounded-full bg-[#f47c3c]/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[250px] w-[700px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full px-6 py-10 md:py-14">
        <div className="mx-auto max-w-[1600px]">
          {/* HERO */}
          <div className="mb-12 flex flex-col items-center text-center">
            <img
              src="/logo.png"
              alt="Rugimos"
              className="mb-8 w-72 drop-shadow-2xl md:w-80"
            />

            <h1 className="mb-5 max-w-5xl text-3xl font-bold tracking-tight md:text-5xl">
              Esterilizar y educar para un cambio real
            </h1>

            <p className="max-w-3xl text-base leading-8 text-white/85 md:text-lg">
              Trabajamos por el bienestar animal a través de esterilización, educación,
              adopción responsable y una red humana comprometida con transformar la realidad.
            </p>
          </div>

          {/* CARDS PRINCIPALES */}
          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-5">
            <div className="group flex min-h-[430px] h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-7 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F6D6A]/10 text-3xl shadow-sm">
                  📝
                </div>

                <h2 className="mb-4 text-[28px] font-extrabold leading-tight text-[#0F6D6A]">
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

            <div className="group flex min-h-[430px] h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-7 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F47C3C]/10 text-3xl shadow-sm">
                  💛
                </div>

                <h2 className="mb-4 text-[28px] font-extrabold leading-tight text-[#0F6D6A]">
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

            <div className="group flex min-h-[430px] h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-7 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F6D6A]/10 text-3xl shadow-sm">
                  ℹ️
                </div>

                <h2 className="mb-4 text-[28px] font-extrabold leading-tight text-[#0F6D6A]">
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

            <div className="group flex min-h-[430px] h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-7 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F47C3C]/10 text-3xl shadow-sm">
                  🐾
                </div>

                <h2 className="mb-4 text-[28px] font-extrabold leading-tight text-[#0F6D6A]">
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

            <div className="group flex min-h-[430px] h-full flex-col justify-between rounded-[30px] border border-white/40 bg-white/95 p-7 text-center text-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(0,0,0,0.18)]">
              <div>
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E7F7F5] text-3xl shadow-sm">
                  🤝
                </div>

                <h2 className="mb-4 text-[28px] font-extrabold leading-tight text-[#0F6D6A]">
                  Voluntariado
                </h2>

                <p className="mb-8 text-[17px] leading-8 text-slate-600">
                  Súmate a nuestras jornadas clínicas y postúlate para formar parte del
                  Programa de Voluntariado Clínico de Fundación Rugimos.
                </p>
              </div>

              <a
                href="/voluntariado"
                className="rounded-2xl bg-[#0F6D6A] px-6 py-3.5 text-[17px] font-bold text-white shadow-md transition hover:scale-[1.02] hover:opacity-95"
              >
                Postularme
              </a>
            </div>
          </div>

          {/* IMPACTO */}
          <section className="mb-12">
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md md:p-8">
              <div className="mb-8 text-center">
                <div className="mb-4 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold text-[#0F6D6A] shadow-lg md:text-base">
                  NUESTRO IMPACTO
                </div>

                <h2 className="mb-3 text-2xl font-bold md:text-4xl">
                  Cifras reales que reflejan nuestro trabajo
                </h2>

                <p className="mx-auto max-w-3xl text-white/80">
                  Cada número se actualiza automáticamente con la actividad real del sistema
                  y muestra el alcance de nuestra labor en la comunidad.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
                {tarjetas.map((item) => (
                  <div
                    key={item.titulo}
                    className={`rounded-3xl border ${item.borde} bg-gradient-to-br ${item.bg} p-5 text-gray-800 shadow-xl transition duration-300 hover:-translate-y-1 md:p-6`}
                  >
                    <p className="min-h-[40px] text-sm font-medium text-gray-500 md:text-base">
                      {item.titulo}
                    </p>

                    <div className={`mt-4 text-3xl font-extrabold md:text-5xl ${item.color}`}>
                      {loadingStats ? (
                        <span className="opacity-60">...</span>
                      ) : (
                        <CountUp end={item.valor} duration={1.8} separator="." />
                      )}
                    </div>

                    <div className="mt-4 h-1.5 w-16 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full w-full bg-[#0F6D6A]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BLOQUES EXTRA */}
          <section className="mb-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md md:p-8">
              <h3 className="mb-3 text-2xl font-bold">Compromiso real con la ciudad</h3>
              <p className="leading-relaxed text-white/85">
                Nuestro trabajo une esterilización, organización comunitaria,
                educación y seguimiento. Cada solicitud recibida representa una
                oportunidad concreta de prevenir abandono, sufrimiento y
                sobrepoblación.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md md:p-8">
              <h3 className="mb-3 text-2xl font-bold">Personas que hacen posible el cambio</h3>
              <p className="leading-relaxed text-white/85">
                El voluntariado también transforma vidas. Necesitamos personas responsables,
                empáticas y con verdadero deseo de aprender y aportar dentro de jornadas
                clínicas reales.
              </p>

              <a
                href="/voluntariado"
                className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-[#0F6D6A] shadow-md transition hover:scale-[1.02] hover:opacity-95"
              >
                Quiero ser voluntario
              </a>
            </div>

            <div className="rounded-[2rem] bg-gradient-to-br from-[#f47c3c] to-[#ff9966] p-6 text-white shadow-2xl md:p-8">
              <h3 className="mb-3 text-2xl font-bold">Ayúdanos a llegar más lejos</h3>
              <p className="mb-5 leading-relaxed text-white/95">
                Tu apoyo nos ayuda a seguir ampliando cupos, mejorar la logística y
                sostener campañas que cambian vidas.
              </p>

              <button
                onClick={() => setShowQR(true)}
                className="rounded-xl bg-white px-6 py-3 font-bold text-[#f47c3c] shadow-md transition hover:opacity-90"
              >
                Ver QR de donación
              </button>
            </div>
          </section>

          {/* MODAL QR */}
          {showQR && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-white/50 bg-white p-8 text-center text-black shadow-2xl">
                <h2 className="mb-4 text-2xl font-bold text-[#0F6D6A]">
                  Escanee el QR para donar
                </h2>

                <img
                  src="/qr.png"
                  alt="QR Donación"
                  className="mx-auto mb-4 rounded-xl"
                />

                <p className="mb-5 text-sm leading-relaxed text-gray-600">
                  Cada aporte nos ayuda a esterilizar más animales, ampliar campañas y
                  continuar nuestra labor con mayor alcance.
                </p>

                <button
                  onClick={() => setShowQR(false)}
                  className="rounded-xl bg-[#f47c3c] px-5 py-3 font-semibold text-white transition hover:opacity-90"
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