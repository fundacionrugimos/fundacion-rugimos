"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Solicitud = {
id: string
codigo: string
nombre_completo: string
celular: string
ubicacion: string
nombre_animal: string
especie: string
sexo: string
edad: string
peso: string
tipo_animal: string
estado: string
ci: string | null
created_at: string
foto_frente: string | null
foto_lado: string | null
foto_carnet: string | null
}

export default function AdminSolicitudes(){

const [solicitudes,setSolicitudes] = useState<Solicitud[]>([])
const [loadingId,setLoadingId] = useState<string | null>(null)
const [fotoSeleccionada,setFotoSeleccionada] = useState<string | null>(null)
const [whatsappData,setWhatsappData] = useState<{telefono:string,mensaje:string}|null>(null)

useEffect(()=>{
fetchSolicitudes()
},[])

const fetchSolicitudes = async()=>{

const {data,error} = await supabase
.from("solicitudes")
.select("*")
.eq("estado","Pendiente")
.order("created_at",{ascending:false})

if(error){
console.error(error)
return
}

if(data) setSolicitudes(data)

}

const enviarWhatsapp = ()=>{

if(!whatsappData) return

const telefono = whatsappData.telefono.replace(/\D/g,"")

const url = `https://wa.me/591${telefono}?text=${encodeURIComponent(whatsappData.mensaje)}`

window.open(url,"_blank")

}

const cambiarEstado = async(solicitud:Solicitud,nuevoEstado:string)=>{

setLoadingId(solicitud.id)

const {error:updateError} = await supabase
.from("solicitudes")
.update({estado:nuevoEstado})
.eq("id",solicitud.id)

if(updateError){
console.error(updateError)
setLoadingId(null)
return
}

if(nuevoEstado === "Aprobado"){

const {data:clinicaData,error:clinicaError} = await supabase
.from("clinicas")
.select("*")
.eq("zona",solicitud.ubicacion)
.eq("ativa",true)
.limit(1)
.single()

if(clinicaError || !clinicaData){
alert("No se encontró clínica activa")
setLoadingId(null)
return
}

const clinicaId = clinicaData.id

const {data:horarioId,error:reservaError} =
await supabase.rpc("reservar_vaga",{p_clinica_id:clinicaId})

if(reservaError || !horarioId){
alert("No hay cupos disponibles")
setLoadingId(null)
return
}

const {data:horario,error:horarioError} = await supabase
.from("horarios_clinica")
.select("hora")
.eq("id",horarioId)
.single()

if(horarioError || !horario){
alert("Error obteniendo horario")
setLoadingId(null)
return
}

const horaAsignada = horario.hora

const codigoGenerado =
`RUG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random()*900000)}`

await supabase
.from("solicitudes")
.update({codigo:codigoGenerado})
.eq("id",solicitud.id)

await supabase
.from("registros")
.insert([
{
codigo:codigoGenerado,
nombre_responsable:solicitud.nombre_completo,
telefono:solicitud.celular,
ci:solicitud.ci,
nombre_animal:solicitud.nombre_animal,
especie:solicitud.especie,
sexo:solicitud.sexo,
edad:solicitud.edad,
peso:solicitud.peso,
tipo_animal:solicitud.tipo_animal,
zona:solicitud.ubicacion,
estado:"Pendiente",
clinica_id:clinicaId,
horario_id:horarioId,
hora:horaAsignada,
foto_frente:solicitud.foto_frente,
foto_lado:solicitud.foto_lado,
foto_carnet:solicitud.foto_carnet
}
])

const mensaje = `
🐾 FUNDACIÓN RUGIMOS 🐾

Tu solicitud fue APROBADA ✅

Código Rugimos:
${codigoGenerado}

Mascota:
${solicitud.nombre_animal} (${solicitud.especie})

Clínica:
${clinicaData.nombre}

Dirección:
${clinicaData.direccion}

Hora de llegada:
${horaAsignada}

INSTRUCCIONES

• Ayuno comida: 8 horas
• Ayuno agua: 4 horas
• Llevar manta
• Llegar 15 min antes

Gracias por apoyar la esterilización responsable 💚
`

setWhatsappData({
telefono:solicitud.celular,
mensaje:mensaje
})

}

await fetchSolicitudes()
setLoadingId(null)

}

return(

<div className="min-h-screen bg-gray-100 p-6">

<h1 className="text-3xl font-bold mb-8 text-gray-900">
Solicitudes Recibidas
</h1>

{whatsappData &&(

<div className="bg-green-100 border border-green-300 p-4 rounded-lg mb-6 flex justify-between items-center">

<p className="text-green-900 font-semibold">
Registro aprobado. Enviar confirmación por WhatsApp.
</p>

<button
onClick={enviarWhatsapp}
className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"

>

Enviar WhatsApp </button>

</div>

)}

<div className="flex flex-col items-center gap-8">

{solicitudes.map((s)=>(

<div
key={s.id}
className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 max-w-xl w-full"
>

<p className="text-xs text-gray-500 mb-2 font-mono">
{s.codigo}
</p>

<h2 className="text-xl font-semibold text-gray-900 mb-3">
{s.nombre_completo}
</h2>

<div className="text-sm text-gray-700 space-y-1">

<p><strong>CI:</strong> {s.ci || "No especificado"}</p>
<p><strong>Celular:</strong> {s.celular}</p>
<p><strong>Zona:</strong> {s.ubicacion}</p>
<p><strong>Animal:</strong> {s.nombre_animal} ({s.especie})</p>
<p><strong>Sexo:</strong> {s.sexo}</p>
<p><strong>Edad:</strong> {s.edad}</p>
<p><strong>Peso:</strong> {s.peso}</p>

</div>

<div className="flex gap-3 mt-4">

{s.foto_frente &&(
<img
src={s.foto_frente}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_frente)}
/>
)}

{s.foto_lado &&(
<img
src={s.foto_lado}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_lado)}
/>
)}

{s.foto_carnet &&(
<img
src={s.foto_carnet}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_carnet)}
/>
)}

</div>

<div className="flex gap-3 mt-6">

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Aprobado")}
className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"

>

{loadingId===s.id?"Procesando":"Aprobar"} </button>

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Rechazado")}
className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"

>

Rechazar </button>

</div>

</div>

))}

</div>

{fotoSeleccionada &&(

<div
className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
onClick={()=>setFotoSeleccionada(null)}
>

<img
src={fotoSeleccionada}
className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-xl"
/>

</div>

)}

</div>

)

}
