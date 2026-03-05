"use client"

import { useEffect,useState } from "react"
import { supabase } from "@/lib/supabase"

type Solicitud = {
id:string
codigo:string
nombre_completo:string
celular:string
ubicacion:string
nombre_animal:string
especie:string
estado:string
}

export default function AdminSolicitudes(){

const [solicitudes,setSolicitudes] = useState<Solicitud[]>([])

useEffect(()=>{

cargarSolicitudes()

},[])

async function cargarSolicitudes(){

const { data } = await supabase
.from("solicitudes")
.select("*")
.order("created_at",{ ascending:false })

if(data) setSolicitudes(data)

}

async function aprobarSolicitud(solicitud:any){

try{

const { data:clinicaData,error:clinicaError } = await supabase
.from("clinicas")
.select("nombre,direccion")
.eq("zona",solicitud.ubicacion)
.eq("ativa",true)
.limit(1)
.single()

if(clinicaError || !clinicaData){

alert("No hay clínica disponible para esta zona")
return

}

const horarios = [
"08:00",
"09:00",
"10:00",
"11:00",
"14:00",
"15:00",
"16:00"
]

const horario = horarios[Math.floor(Math.random()*horarios.length)]

await supabase
.from("solicitudes")
.update({ estado:"Aprobado" })
.eq("id",solicitud.id)

const telefono = solicitud.celular.replace(/\D/g,"").slice(-8)

const mensaje = `🐾 FUNDACIÓN RUGIMOS 🐾

Tu solicitud fue APROBADA ✅

Código Rugimos:
${solicitud.codigo}

Mascota:
${solicitud.nombre_animal} (${solicitud.especie})

Clínica:
${clinicaData.nombre}

Dirección:
${clinicaData.direccion}

Hora de cirugía:
${horario}

INSTRUCCIONES

• Ayuno comida: 8 horas
• Ayuno agua: 4 horas
• Llevar manta
• Llegar 15 min antes

Gracias por apoyar la esterilización responsable 💚`

const url = `https://wa.me/591${telefono}?text=${encodeURIComponent(mensaje)}`

if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
window.location.href = url
}else{
window.open(url,"_blank")
}

cargarSolicitudes()

}catch(error){

console.log(error)
alert("Error al aprobar solicitud")

}

}

async function rechazarSolicitud(id:string){

await supabase
.from("solicitudes")
.update({ estado:"Rechazado" })
.eq("id",id)

cargarSolicitudes()

}

return(

<div className="min-h-screen bg-gray-100 p-8">

<h1 className="text-3xl font-bold mb-6">
Panel de Solicitudes
</h1>

<div className="grid gap-4">

{solicitudes.map((s)=> (

<div
key={s.id}
className="bg-white p-6 rounded-xl shadow-md flex justify-between items-center"
>

<div>

<p className="font-bold">{s.codigo}</p>

<p>{s.nombre_completo}</p>

<p>{s.nombre_animal} ({s.especie})</p>

<p className="text-sm text-gray-500">
Zona: {s.ubicacion}
</p>

<p className="text-sm font-semibold">
Estado: {s.estado}
</p>

</div>

<div className="flex gap-2">

{s.estado === "Pendiente" && (

<>

<button
onClick={()=>aprobarSolicitud(s)}
className="bg-green-600 text-white px-4 py-2 rounded-lg"

>

Aprobar </button>

<button
onClick={()=>rechazarSolicitud(s.id)}
className="bg-red-600 text-white px-4 py-2 rounded-lg"

>

Rechazar </button>

</>

)}

</div>

</div>

))}

</div>

</div>

)

}
