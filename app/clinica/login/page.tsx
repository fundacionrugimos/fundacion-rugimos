'use client'

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginClinica(){

const [usuario,setUsuario] = useState("")
const [senha,setSenha] = useState("")
const [loading,setLoading] = useState(false)

const router = useRouter()

const login = async () => {

if(!usuario || !senha){
alert("Ingrese usuario y contraseña")
return
}

setLoading(true)

const { data,error } = await supabase
.from("clinicas")
.select("*")
.eq("usuario",usuario)
.eq("senha",senha)
.eq("ativa",true)

setLoading(false)

if(error){
console.log(error)
alert("Error al conectar con la base de datos")
return
}

if(!data || data.length === 0){
alert("Usuario o contraseña incorrectos")
return
}

const clinica = data[0]

localStorage.setItem("clinica_id",clinica.id)
localStorage.setItem("clinica_zona",clinica.zona)
localStorage.setItem("clinica_login_time",Date.now().toString())

/* REDIRECCION AUTOMÁTICA AL PACIENTE */

const paciente = sessionStorage.getItem("paciente_redirect")

if(paciente){

sessionStorage.removeItem("paciente_redirect")

router.push("/clinica/"+paciente)

}else{

router.push("/clinica")

}

}

function handleKey(e:any){

if(e.key === "Enter"){
login()
}

}

return(

<div className="min-h-screen flex flex-col items-center justify-center bg-[#0F6D6A] px-6">

{/* LOGO */}

<img 
src="/logo.png"
className="w-64 mb-10"
/>

<div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md">

<h1 className="text-2xl font-bold mb-8 text-center text-[#0F6D6A]">
Login Clínica
</h1>

{/* USUARIO */}

<input
type="text"
placeholder="Usuario"
value={usuario}
onChange={(e)=>setUsuario(e.target.value)}
onKeyDown={handleKey}
className="w-full border border-gray-300 p-3 rounded-lg mb-4 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0F6D6A]"
/>

{/* CONTRASEÑA */}

<input
type="password"
placeholder="Contraseña"
value={senha}
onChange={(e)=>setSenha(e.target.value)}
onKeyDown={handleKey}
className="w-full border border-gray-300 p-3 rounded-lg mb-6 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0F6D6A]"
/>

{/* BOTON */}

<button
onClick={login}
disabled={loading}
className="w-full bg-[#F47C2A] text-white py-3 rounded-lg hover:opacity-90 font-semibold text-lg transition"
>

{loading ? "Entrando..." : "Entrar"}

</button>

</div>

</div>

)
}