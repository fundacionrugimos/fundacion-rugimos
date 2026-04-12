"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function DeliveryLoginPage() {
  const router = useRouter()

  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!usuario || !password) {
      alert("Ingrese usuario y contraseña")
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from("usuarios_delivery")
      .select("*")
      .eq("usuario", usuario)
      .eq("password", password)
      .eq("activo", true)
      .maybeSingle()

    if (error || !data) {
      alert("Credenciales incorrectas")
      setLoading(false)
      return
    }

    localStorage.setItem("delivery_user", data.id)
    localStorage.setItem("delivery_login_time", Date.now().toString())

    router.push("/delivery")
  }

  return (
    <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-2xl font-bold text-[#0F6D6A] text-center">
          Login Delivery
        </h1>

        <div className="mt-6 space-y-4">
          <input
            placeholder="Usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full border rounded-2xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-2xl px-4 py-3"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-[#F47C3C] text-white py-3 rounded-2xl font-bold"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  )
}