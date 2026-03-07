"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Clinica(){

const [codigo,setCodigo] = useState("")
const router = useRouter()

function buscar(){

if(!codigo) return

router.push("/clinica/"+codigo)

}

return(

<div className="min-h-screen flex flex-col items-center justify-center bg-[#026A6A] text-center px-6">

<img 
src="/rugimos-logo.png"
className="w-44 mb-10"
/>

<h1 className="text-white text-4xl font-bold mb-10">
Buscar Paciente
</h1>

<div className="flex w-full max-w-2xl shadow-xl">

<input
value={codigo}
onChange={(e)=>setCodigo(e.target.value)}
placeholder="Ingresar código RG"
className="flex-1 p-5 rounded-l-full text-lg outline-none"
/>

<button
onClick={buscar}
className="bg-[#F47C2A] text-white px-10 text-lg font-semibold rounded-r-full hover:opacity-90"
>
Buscar
</button>

</div>

</div>

)

}