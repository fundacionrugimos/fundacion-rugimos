"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import QRCode from "qrcode"

export default function PacienteQR(){

const params = useParams()
const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo ?? ""

const [registro,setRegistro] = useState<any>(null)
const [qr,setQr] = useState("")
const [cargando,setCargando] = useState(true)
const [noEncontrado,setNoEncontrado] = useState(false)


async function cargar(){

const { data,error } = await supabase
.from("registros")
.select("*")
.eq("codigo",codigo)
.single()

if(error || !data){
setNoEncontrado(true)
setCargando(false)
return
}

setRegistro(data)

/* GENERAR QR */

const url = `https://fundacion-rugimos.vercel.app/clinica/${codigo}`

const qrImage = await QRCode.toDataURL(url)

setQr(qrImage)

setCargando(false)

}

useEffect(()=>{

if(codigo){
cargar()
}

},[codigo])


/* CARGANDO */

if(cargando){

return(
<div className="min-h-screen flex items-center justify-center bg-[#0F6D6A] text-white text-xl">
Cargando información...
</div>
)

}


/* NO ENCONTRADO */

if(noEncontrado){

return(
<div className="min-h-screen flex flex-col items-center justify-center bg-[#0F6D6A] text-white gap-6">

<h1 className="text-3xl font-bold">
Código no encontrado
</h1>

</div>
)

}


return(

<div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center p-6">

<div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center space-y-6">

<img
src="/logo.png"
className="w-48 mx-auto"
/>

<h1 className="text-2xl font-bold text-[#0F6D6A]">
Fundación Rugimos
</h1>

<div className="text-gray-700 space-y-2">

<p>
<b>Mascota:</b> {registro.nombre_animal}
</p>

<p>
<b>Clínica:</b> {registro.zona}
</p>

<p>
<b>Hora:</b> {registro.hora || "Por confirmar"}
</p>

</div>

<p className="text-sm text-gray-500">
Presentar este QR en la clínica
</p>


{/* QR GRANDE */}

{qr && (

<img
src={qr}
className="mx-auto w-72 h-72"
/>

)}


<div className="bg-[#f47c2a] text-white py-3 rounded-xl font-bold">

Código: {registro.codigo}

</div>

</div>

</div>

)

}