"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function AdminDashboard() {
  const router = useRouter()

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    window.location.href = "/admin/login"
  }

  const [pendentes, setPendentes] = useState(0)
  const [citasHoy, setCitasHoy] = useState(0)

  useEffect(() => {
    carregarPendentes()
    carregarCitasHoy()
  }, [])

  function getLocalDateString() {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    const local = new Date(now.getTime() - offset * 60 * 1000)
    return local.toISOString().split("T")[0]
  }

  const carregarPendentes = async () => {
    const { count, error } = await supabase
      .from("solicitudes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "Pendiente")

    if (error) {
      console.log("Error cargando pendientes:", error)
      return
    }

    setPendentes(count || 0)
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

  return (
    <div className="min-h-screen bg-[#02686A] flex flex-col items-center">
      <button
        onClick={logout}
        className="absolute top-6 right-6 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
      >
        Cerrar sesión
      </button>

      <div className="mt-10 mb-20 flex justify-center">
        <img src="/logo.png" className="h-40" alt="Logo Rugimos" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl px-8 pb-16">

        <Link href="/admin/clinicas">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">🏥 Clínicas</h2>
            <p className="text-gray-600 mt-2">Gestionar clínicas</p>
          </div>
        </Link>

        <Link href="/admin/registros">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">📋 Registros</h2>
            <p className="text-gray-600 mt-2">Animales registrados</p>
          </div>
        </Link>

        <Link href="/admin/solicitudes">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">📨 Solicitudes</h2>

            {pendentes > 0 ? (
              <span className="inline-block mt-4 bg-[#F47C3C] text-white px-4 py-2 rounded-full">
                Pendientes: {pendentes}
              </span>
            ) : (
              <span className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded-full">
                Sin pendientes
              </span>
            )}
          </div>
        </Link>

        <Link href="/admin/cupos">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">📊 Cupos</h2>
            <p className="text-gray-600 mt-2">Cupos por clínica</p>
          </div>
        </Link>

        <Link href="/admin/pagos">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">💰 Pagos clínicas</h2>
            <p className="text-gray-600 mt-2">Control de pagos semanales</p>
          </div>
        </Link>

        <Link href="/admin/citas">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer border-2 border-[#F47C3C]">
            <h2 className="text-xl font-bold text-[#02686A]">🗓️ Citas</h2>
            <p className="text-gray-600 mt-2">Programación diaria por clínica</p>

            <span className="inline-block mt-4 bg-[#F47C3C] text-white px-4 py-2 rounded-full">
              Hoy: {citasHoy}
            </span>
          </div>
        </Link>

        <Link href="/admin/inventario">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer">
            <h2 className="text-xl font-bold text-[#02686A]">📦 Inventario</h2>
            <p className="text-gray-600 mt-2">Control de stock y movimientos</p>
          </div>
        </Link>

        <Link href="/admin/informes">
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 transition cursor-pointer border-2 border-[#02686A]">
            <h2 className="text-xl font-bold text-[#02686A]">📈 Informes</h2>
            <p className="text-gray-600 mt-2">Reportes de gestión y estadísticas</p>
          </div>
        </Link>

      </div>
    </div>
  )
}