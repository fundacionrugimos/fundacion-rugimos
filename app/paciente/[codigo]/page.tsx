"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import QRCode from "qrcode"

export default function PacienteQR(){

const params = useParams()

const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo ?? ""

/* NORMALIZAR CÓDIGO (CORRECCIÓN QR) */

const codigoLimpo = codigo.trim().toUpperCase()

const [registro,setRegistro] = useState<any>(null)
const [qr,setQr] = useState<string>("")
const [cargando,setCargando] = useState(true)


/* CARGAR DATOS DEL PACIENTE */

async function cargar(){

setCargando(true)

const {data,error} = await supabase
.from("registros")
.select("*")
.ilike("codigo",codigoLimpo)
.single()

if(error){
console.log(error)
setCargando(false)
return
}

if(data){

setRegistro(data)

/* GENERAR QR GRANDE PARA LA CLÍNICA */

const urlClinica = `https://fundacion-rugimos.vercel.app/clinica/${codigoLimpo}`

const qrImage = await QRCode.toDataURL(urlClinica,{
width:400,
margin:3,
color:{
dark:"#000000",
light:"#FFFFFF"
}
})

setQr(qrImage)

}

setCargando(false)

}


useEffect(()=>{
if(codigo){
cargar()
}
},[codigo])


if(cargando){

return(

<div className="min-h-screen flex items-center justify-center bg-[#0f6d6a] text-white text-xl">
Cargando información...
</div>

)

}


if(!registro){

return(

<div className="min-h-screen flex items-center justify-center bg-[#0f6d6a] text-white text-xl">
Paciente no encontrado
</div>

)

}


return(

<div className="min-h-screen bg-[#0f6d6a] flex flex-col items-center justify-center px-6 py-10 space-y-8">

<img
src="/logo.png"
className="w-64"
/>

<h1 className="text-white text-3xl font-bold text-center">
Presenta este código al llegar a la clínica
</h1>


<div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">

<h2 className="text-2xl font-bold text-[#0f6d6a] mb-4">
Código {registro.codigo}
</h2>

<p className="text-gray-700 mb-2">
<b>Animal:</b> {registro.nombre_animal}
</p>

<p className="text-gray-700 mb-2">
<b>Especie:</b> {registro.especie}
</p>

<p className="text-gray-700 mb-2">
<b>Sexo:</b> {registro.sexo}
</p>

<p className="text-gray-700 mb-6">
<b>Hora:</b> {registro.hora || "Asignación pendiente"}
</p>


{/* QR GRANDE */}

<div className="flex justify-center">

<img
src={qr}
className="w-72 h-72"
/>

</div>

<p className="text-gray-600 mt-4 text-sm">
Muestra este QR al llegar a la clínica
</p>

</div>


<div className="text-white text-center max-w-md">

<p>
💧 Ayuno de agua: 4 horas
</p>

<p>
🛏 Llevar manta
</p>

<p>
⏰ Llegar 15 minutos antes
</p>

</div>

</div>

)

}