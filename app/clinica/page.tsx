"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function ClinicaPage(){

const [codigo,setCodigo] = useState("")
const router = useRouter()

/* PROTEÇÃO LOGIN */

useEffect(()=>{

const clinica = localStorage.getItem("clinica_id")
const loginTime = localStorage.getItem("clinica_login_time")

if(!clinica || !loginTime){
router.push("/clinica/login")
return
}

const agora = Date.now()
const cincoMin = 5 * 60 * 1000

if(agora - Number(loginTime) > cincoMin){

localStorage.removeItem("clinica_id")
localStorage.removeItem("clinica_zona")
localStorage.removeItem("clinica_login_time")

router.push("/clinica/login")

}

},[])


/* BUSCAR PACIENTE */

function buscar(){

if(!codigo){

alert("Ingrese un código")

return
}

const codigoLimpo = codigo.toUpperCase().trim()

router.push("/clinica/"+codigoLimpo)

}


/* ENTER PARA BUSCAR */

function handleKey(e:any){

if(e.key === "Enter"){
buscar()
}

}


/* LOGOUT */

function logout(){

localStorage.removeItem("clinica_id")
localStorage.removeItem("clinica_zona")
localStorage.removeItem("clinica_login_time")

router.push("/clinica/login")

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
onKeyDown={handleKey}
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

<button
onClick={logout}
className="mt-10 text-white underline"
>
Cerrar sesión
</button>

</div>

)

}