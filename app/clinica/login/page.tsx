'use client'

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginClinica(){

const [usuario,setUsuario] = useState("")
const [senha,setSenha] = useState("")
const router = useRouter()

const login = async () => {

const { data,error } = await supabase
.from("clinicas")
.select("*")
.eq("usuario",usuario)
.eq("senha",senha)
.eq("ativa",true)

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

router.push("/clinica")

}

return(

<div className="min-h-screen flex items-center justify-center bg-[#026A6A]">

<div className="bg-white p-8 rounded-xl shadow w-96">

<h1 className="text-2xl font-bold mb-6 text-center text-[#026A6A]">
Login Clínica
</h1>

<input
type="text"
placeholder="Usuario"
value={usuario}
onChange={(e)=>setUsuario(e.target.value)}
className="w-full border p-3 rounded mb-4"
/>

<input
type="password"
placeholder="Contraseña"
value={senha}
onChange={(e)=>setSenha(e.target.value)}
className="w-full border p-3 rounded mb-6"
/>

<button
onClick={login}
className="w-full bg-[#F47C2A] text-white py-3 rounded-lg hover:opacity-90"
>
Entrar
</button>

</div>

</div>

)
}