"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginAdmin() {

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState("")

  const handleLogin = async (e:React.FormEvent) => {

    e.preventDefault()

    setLoading(true)
    setError("")

    try{

      const res = await fetch("/api/admin/login",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          email,
          password
        })
      })

      const data = await res.json()

      if(!res.ok){
        setError(data.error || "Error al iniciar sesión")
        setLoading(false)
        return
      }

      router.push("/admin")
      router.refresh()

    }catch{

      setError("Error de conexión")

    }finally{
      setLoading(false)
    }

  }

  return(

    <div className="min-h-screen bg-[#02686A] flex items-center justify-center">

      <div className="bg-white p-8 rounded-2xl shadow-xl w-[350px]">

        <h1 className="text-2xl font-bold text-center text-[#02686A] mb-6">
          Admin Rugimos
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">

          <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="border p-3 rounded-lg"
          required
          />

          <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="border p-3 rounded-lg"
          required
          />

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
          type="submit"
          disabled={loading}
          className="bg-[#02686A] text-white p-3 rounded-lg font-semibold"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

        </form>

      </div>

    </div>

  )

}