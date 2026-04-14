"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

type PedidosResumen = {
  enviados: number
  revisados: number
  aprobados: number
  pendientes: number
}

type DashboardCard = {
  href: string
  icon: string
  title: string
  description: string
  highlight?: string
  highlightVariant?: "orange" | "green" | "teal" | "whatsapp"
  borderVariant?: "orange" | "teal" | "green" | "default"
  extraLines?: string[]
}

export default function AdminDashboard() {
  const [pendentes, setPendentes] = useState(0)
  const [citasHoy, setCitasHoy] = useState(0)
  const [pedidosResumen, setPedidosResumen] = useState<PedidosResumen>({
    enviados: 0,
    revisados: 0,
    aprobados: 0,
    pendientes: 0,
  })

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    window.location.href = "/admin/login"
  }

  useEffect(() => {
    carregarPendentes()
    carregarCitasHoy()
    carregarPedidos()
  }, [])

  function getLocalDateString() {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)
    return local.toISOString().split("T")[0]
  }

  const carregarPendentes = async () => {
    try {
      const res = await fetch("/api/solicitudes?pagina=1")
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Error cargando pendientes")
      }

      setPendentes(json.total || 0)
    } catch (error) {
      console.error("Error cargando pendientes:", error)
    }
  }

  const carregarCitasHoy = async () => {
    const hoy = getLocalDateString()

    const { count, error } = await supabase
      .from("registros")
      .select("*", { count: "exact", head: true })
      .eq("fecha_programada", hoy)

    if (error) {
      console.log("Error cargando citas de hoy:", error)
      return
    }

    setCitasHoy(count || 0)
  }

  const carregarPedidos = async () => {
    const { data, error } = await supabase
      .from("pedidos_clinicas")
      .select("estado")

    if (error) {
      console.log("Error cargando pedidos clínicos:", error)
      return
    }

    let enviados = 0
    let revisados = 0
    let aprobados = 0

    ;(data || []).forEach((pedido: any) => {
      const estado = String(pedido?.estado || "").trim().toLowerCase()

      if (estado === "enviado") enviados++
      if (estado === "revisado") revisados++
      if (estado === "aprobado") aprobados++
    })

    setPedidosResumen({
      enviados,
      revisados,
      aprobados,
      pendientes: enviados + revisados + aprobados,
    })
  }

  const cards = useMemo<DashboardCard[]>(() => {
    return [
      {
        href: "/admin/inventario/pedidos-clinicas",
        icon: "📦",
        title: "Pedidos Clínicas",
        description: "Revisión, aprobación y gestión de pedidos.",
        highlight: `Pendientes: ${pedidosResumen.pendientes}`,
        highlightVariant: pedidosResumen.pendientes > 0 ? "orange" : "green",
        borderVariant: "orange",
        extraLines: [
          `Enviados: ${pedidosResumen.enviados}`,
          `Revisados: ${pedidosResumen.revisados}`,
          `Aprobados: ${pedidosResumen.aprobados}`,
        ],
      },
      {
        href: "/admin/clinicas",
        icon: "🏥",
        title: "Clínicas",
        description: "Gestionar clínicas y configuración general.",
        borderVariant: "teal",
      },
      {
        href: "/admin/registros",
        icon: "📋",
        title: "Registros",
        description: "Animales registrados y seguimiento clínico.",
      },
      {
        href: "/admin/seguimientos",
        icon: "🩺",
        title: "Seguimientos",
        description: "Encuestas postoperatorias, respuestas, satisfacción y complicaciones.",
        highlight: "Ver seguimientos",
        highlightVariant: "green",
        borderVariant: "green",
      },
      {
        href: "/admin/solicitudes",
        icon: "📨",
        title: "Solicitudes",
        description: "Revisar solicitudes pendientes del público.",
        highlight: pendentes > 0 ? `Pendientes: ${pendentes}` : "Sin pendientes",
        highlightVariant: pendentes > 0 ? "orange" : "green",
        borderVariant: pendentes > 0 ? "orange" : "green",
      },
      {
        href: "/admin/cupos",
        icon: "📊",
        title: "Cupos",
        description: "Cupos por clínica, horarios y disponibilidad.",
      },
      {
        href: "/admin/citas",
        icon: "🗓️",
        title: "Citas",
        description: "Programación diaria por clínica.",
        highlight: `Hoy: ${citasHoy}`,
        highlightVariant: "orange",
        borderVariant: "orange",
      },
      {
        href: "/admin/voluntarios",
        icon: "🩺",
        title: "Voluntariados",
        description: "Postulaciones, asignaciones, horarios y seguimiento del programa.",
        highlight: "Programa clínico",
        highlightVariant: "teal",
        borderVariant: "teal",
      },
      {
        href: "/admin/inventario",
        icon: "📦",
        title: "Inventario",
        description: "Control de stock, movimientos y almacenes.",
      },
      {
        href: "/admin/informes",
        icon: "📈",
        title: "Informes",
        description: "Reportes de gestión y estadísticas.",
        borderVariant: "teal",
      },
      {
        href: "/admin/contabilidad",
        icon: "💼",
        title: "Contabilidad",
        description: "Compras, pagos y seguimiento financiero.",
      },
      {
        href: "/admin/whatsapp",
        icon: "💬",
        title: "WhatsApp",
        description: "Historial, pendientes y mensajes automáticos.",
        borderVariant: "green",
        highlight: "Mensajes y seguimiento",
        highlightVariant: "whatsapp",
      },
      {
        href: "/admin/adopciones",
        icon: "🐾",
        title: "Adopciones",
        description: "Publicaciones y gestión de adopciones.",
        highlight: "Activas",
        highlightVariant: "orange",
      },
    ]
  }, [citasHoy, pedidosResumen, pendentes])

  return (
    <div className="min-h-screen bg-[#02686A] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-sm md:px-8 md:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,124,60,0.16),transparent_32%),radial-gradient(circle_at_left,rgba(255,255,255,0.08),transparent_25%)]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/10">
                <img src="/logo.png" className="h-12 w-12 object-contain" alt="Logo Rugimos" />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold text-white/90">
                  <span>Fundación Rugimos</span>
                  <span className="opacity-60">/</span>
                  <span>Panel administrativo</span>
                </div>

                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                  Panel principal
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
                  Sistema administrativo central para operación, gestión clínica, seguimiento y control.
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="self-start rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] hover:bg-red-600 md:self-auto"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="block h-full">
              <div
                className={`group flex h-full min-h-[232px] flex-col rounded-[28px] border bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(0,0,0,0.16)] ${
                  card.borderVariant === "orange"
                    ? "border-[#F47C3C]/70"
                    : card.borderVariant === "teal"
                    ? "border-[#02686A]/35"
                    : card.borderVariant === "green"
                    ? "border-[#25D366]/55"
                    : "border-white/70"
                }`}
              >
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6FBFB] text-xl ring-1 ring-[#02686A]/10 transition group-hover:scale-105">
                        {card.icon}
                      </div>

                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-xl font-bold leading-tight text-[#02686A]">
                          {card.title}
                        </h2>
                        <p className="mt-2 min-h-[48px] text-sm leading-6 text-gray-600">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full bg-[#F7FAFA] px-3 py-1 text-[11px] font-semibold text-[#02686A] ring-1 ring-[#02686A]/10">
                      Abrir
                    </div>
                  </div>

                  <div className="mt-5 min-h-[68px]">
                    {card.extraLines && card.extraLines.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {card.extraLines.map((line) => (
                          <div
                            key={line}
                            className="flex min-h-[54px] items-center justify-center rounded-2xl bg-[#F8FAFA] px-3 py-3 text-center text-xs font-semibold text-gray-700 ring-1 ring-[#02686A]/8"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[68px]" />
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${
                      card.highlightVariant === "orange"
                        ? "bg-[#F47C3C] text-white"
                        : card.highlightVariant === "green"
                        ? "bg-green-600 text-white"
                        : card.highlightVariant === "teal"
                        ? "bg-[#02686A] text-white"
                        : card.highlightVariant === "whatsapp"
                        ? "bg-[#25D366] text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {card.highlight || "Ir al módulo"}
                  </span>

                  <span className="text-xs font-semibold text-gray-400 transition group-hover:text-[#02686A]">
                    Ver más →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}