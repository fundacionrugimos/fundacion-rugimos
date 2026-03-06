```tsx
"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function ClinicaPage(){

const [usuario,setUsuario] = useState("")
const [senha,setSenha] = useState("")
const [loading,setLoading] = useState(false)

const router = useRouter()

async function login(e:any){

e.preventDefault()

setLoading(true)

try{

const {data,error} = await supabase
.from("clinicas")
.select("*")
.eq("usuario",usuario)
.eq("senha",senha)
.single()

if(error || !data){
alert("Usuario o contraseña incorrectos")
setLoading(false)
return
}

localStorage.setItem("clinica_id",String(data.id))

router.push("/clinica/login")

}catch(err){

console.error("Error login:",err)
alert("Error al iniciar sesión")

}

setLoading(false)

}

return(

<main className="min-h-screen flex items-center justify-center bg-gray-100">

<div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">

<h1 className="text-2xl font-bold mb-6 text-center">
Login Clínica
</h1>

<form onSubmit={login} className="space-y-4">

<input
required
placeholder="Usuario"
value={usuario}
onChange={(e)=>setUsuario(e.target.value)}
className="w-full border p-2 rounded"
/>

<input
required
type="password"
placeholder="Contraseña"
value={senha}
onChange={(e)=>setSenha(e.target.value)}
className="w-full border p-2 rounded"
/>

<button
type="submit"
disabled={loading}
className="w-full bg-[#026A6A] text-white py-2 rounded hover:opacity-90 disabled:opacity-50"
>
{loading ? "Entrando..." : "Entrar"}
</button>

</form>

</div>

</main>

)

}
```