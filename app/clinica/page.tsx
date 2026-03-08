"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Html5Qrcode } from "html5-qrcode"

export default function ClinicaPage(){

const [codigo,setCodigo] = useState("")
const [escaneando,setEscaneando] = useState(false)

const [resumen,setResumen] = useState<any>({
perro_macho:0,
perra_hembra:0,
gato_macho:0,
gata_hembra:0
})

const router = useRouter()

/* PROTECCIÓN LOGIN */

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


/* SCANNER QR */

useEffect(()=>{

let scanner:any

async function iniciarScanner(){

scanner = new Html5Qrcode("reader")

try{

await scanner.start(
{ facingMode:"environment" },
{
fps:10,
qrbox:250
},
(decodedText:string)=>{

const codigoQR = decodedText.split("/").pop()

router.push("/clinica/"+codigoQR)

}
)

}catch(err){
console.log(err)
}

}

if(escaneando){
iniciarScanner()
}

return ()=>{
if(scanner){
scanner.stop().catch(()=>{})
}
}

},[escaneando])


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


/* RESUMEN SEMANAL */

async function cargarResumen(){

const clinica_id = localStorage.getItem("clinica_id")

if(!clinica_id) return

const {data,error} = await supabase
.from("registros")
.select("especie,sexo")
.eq("clinica_id",clinica_id)
.eq("estado_clinica","Apto")

if(error){
console.log(error)
return
}

let perro_macho = 0
let perra_hembra = 0
let gato_macho = 0
let gata_hembra = 0

data?.forEach((r:any)=>{

if(r.especie==="Perro" && r.sexo==="Macho") perro_macho++
if(r.especie==="Perro" && r.sexo==="Hembra") perra_hembra++
if(r.especie==="Gato" && r.sexo==="Macho") gato_macho++
if(r.especie==="Gato" && r.sexo==="Hembra") gata_hembra++

})

setResumen({
perro_macho,
perra_hembra,
gato_macho,
gata_hembra
})

}

useEffect(()=>{
cargarResumen()
},[])


/* ATUALIZA AUTOMATICAMENTE O CONTADOR */

useEffect(()=>{

function actualizarResumen(){

cargarResumen()

}

window.addEventListener("storage",actualizarResumen)

return ()=>{

window.removeEventListener("storage",actualizarResumen)

}

},[])


const total =
resumen.perro_macho +
resumen.perra_hembra +
resumen.gato_macho +
resumen.gata_hembra


return(

<div className="min-h-screen flex flex-col items-center justify-center bg-[#0f6d6a] px-6 space-y-10">

<img 
src="/logo.png"
className="w-56"
/>

<h1 className="text-white text-4xl font-bold text-center">
Escanear Paciente
</h1>


{/* BOTÃO ABRIR CÂMERA */}

{!escaneando && (

<button
onClick={()=>setEscaneando(true)}
className="bg-[#f47c2a] text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg hover:scale-105 transition"
>

📷 Abrir cámara

</button>

)}


{/* SCANNER */}

<div
id="reader"
className="w-full max-w-md"
/>


{/* BUSCA MANUAL */}

<div className="flex w-full max-w-2xl bg-white rounded-full shadow-xl overflow-hidden">

<input
value={codigo}
onChange={(e)=>setCodigo(e.target.value)}
onKeyDown={handleKey}
placeholder="Ingresar código RG"
className="flex-1 px-8 py-5 text-lg text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#0f6d6a]"
/>

<button
onClick={buscar}
className="bg-[#f47c2a] text-white px-10 text-lg font-semibold hover:opacity-90 transition"
>
Buscar
</button>

</div>


{/* RESUMEN SEMANAL */}

<div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">

<h2 className="text-xl font-bold text-[#0f6d6a] mb-4 text-center">
Resumen de cirugías
</h2>

<div className="space-y-2 text-gray-700">

<p>Perro macho: {resumen.perro_macho}</p>
<p>Perra hembra: {resumen.perra_hembra}</p>
<p>Gato macho: {resumen.gato_macho}</p>
<p>Gata hembra: {resumen.gata_hembra}</p>

</div>

<div className="mt-4 text-center font-bold text-lg text-[#f47c2a]">
Total: {total}
</div>

</div>


<button
onClick={logout}
className="text-white underline hover:opacity-80"
>
Cerrar sesión
</button>

</div>

)

}