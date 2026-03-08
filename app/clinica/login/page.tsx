'use client'

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginClinica(){

const [usuario,setUsuario] = useState("")
const [senha,setSenha] = useState("")
const [loading,setLoading] = useState(false)

const router = useRouter()

/* LOGIN */

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

router.push("/clinica")

}

/* ENTER PARA LOGIN */

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
className="w-56 mb-10"
/>


{/* CARD LOGIN */}

<div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md">


<h1 className="text-2xl font-bold mb-8 text-center text-[#0F6D6A]">
Login Clínica
</h1>


<input
type="text"
placeholder="Usuario"
value={usuario}
onChange={(e)=>setUsuario(e.target.value)}
onKeyDown={handleKey}
className="w-full border p-3 rounded-lg mb-4 outline-none"
/>


<input
type="password"
placeholder="Contraseña"
value={senha}
onChange={(e)=>setSenha(e.target.value)}
onKeyDown={handleKey}
className="w-full border p-3 rounded-lg mb-6 outline-none"
/>


<button
onClick={login}
disabled={loading}
className="w-full bg-[#F47C2A] text-white py-3 rounded-lg hover:opacity-90 font-semibold"
>

{loading ? "Entrando..." : "Entrar"}

</button>


</div>

</div>

)
}