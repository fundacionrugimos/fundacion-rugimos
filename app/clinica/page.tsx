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

<div className="min-h-screen flex flex-col items-center justify-center bg-[#026A6A]">

<img 
src="/logo-rugimos.png" 
className="w-40 mb-8"
/>

<h1 className="text-white text-3xl font-bold mb-8">
Buscar Paciente
</h1>

<div className="flex w-full max-w-xl">

<input
value={codigo}
onChange={(e)=>setCodigo(e.target.value)}
placeholder="Ingresar código RG"
className="flex-1 p-4 rounded-l-xl border-none outline-none"
/>

<button
onClick={buscar}
className="bg-[#F47C2A] text-white px-6 rounded-r-xl font-semibold"
>
Buscar
</button>

</div>

</div>

)

}