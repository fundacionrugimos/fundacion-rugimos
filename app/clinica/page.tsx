"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ClinicaPage(){

const [codigo,setCodigo] = useState("")
const router = useRouter()

function buscar(){

if(!codigo) return

router.push("/clinica/"+codigo)

}

return(

<div className="min-h-screen flex flex-col items-center justify-center bg-[#0f6d6a] px-6">

<img 
src="/logo.png"
className="w-56 mb-10"
/>

<h1 className="text-white text-4xl font-bold mb-10">
Buscar Paciente
</h1>

<div className="flex w-full max-w-2xl bg-white rounded-full shadow-xl overflow-hidden">

<input
value={codigo}
onChange={(e)=>setCodigo(e.target.value)}
placeholder="Ingresar código RG"
className="flex-1 px-8 py-5 text-lg outline-none"
/>

<button
onClick={buscar}
className="bg-[#f47c2a] text-white px-10 text-lg font-semibold hover:opacity-90"
>
Buscar
</button>

</div>

</div>

)

}