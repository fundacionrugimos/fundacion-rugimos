"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginAdmin() {

const router = useRouter()

const [email,setEmail] = useState("")
const [senha,setSenha] = useState("")

const entrar = () => {

if(email === "admin@rugimos.com" && senha === "rugimos123"){

localStorage.setItem("admin_logged","true")

router.replace("/admin")

}else{

alert("Usuario o contraseña incorrectos")

}

}

return(

<div className="min-h-screen bg-[#0f6a63] flex items-center justify-center">

<div className="bg-white p-8 rounded-2xl shadow-lg w-[350px]">

<div className="text-center mb-6">

<img
src="/logo.png"
className="w-40 mx-auto mb-4"
/>

<h1 className="text-xl font-bold">
Login Administrador
</h1>

<p className="text-gray-500 text-sm">
Acceso al panel administrativo
</p>

</div>

<input
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
className="border p-3 rounded-lg w-full mb-4"
/>

<input
type="password"
placeholder="Contraseña"
value={senha}
onChange={(e)=>setSenha(e.target.value)}
className="border p-3 rounded-lg w-full mb-4"
/>

<button
onClick={entrar}
className="bg-[#f47c3c] text-white w-full py-3 rounded-lg font-bold hover:opacity-90"
>

Entrar

</button>

</div>

</div>

)

}