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

export default function AdminSolicitudes() {

const [solicitudes,setSolicitudes] = useState<Solicitud[]>([])
const [loadingId,setLoadingId] = useState<string | null>(null)
const [fotoSeleccionada,setFotoSeleccionada] = useState<string | null>(null)

useEffect(()=>{
fetchSolicitudes()
},[])

const fetchSolicitudes = async () => {

const { data,error } = await supabase
.from("solicitudes")
.select("*")
.eq("estado","Pendiente")
.order("created_at",{ascending:false})

if(error){
console.error("Error cargando solicitudes:",error)
return
}

if(data) setSolicitudes(data)

}

const cambiarEstado = async (solicitud:Solicitud,nuevoEstado:string) => {

setLoadingId(solicitud.id)

const { error:updateError } = await supabase
.from("solicitudes")
.update({ estado:nuevoEstado })
.eq("id",solicitud.id)

if(updateError){
console.error(updateError)
setLoadingId(null)
return
}

if(nuevoEstado === "Aprobado"){

const { data:clinicaData,error:clinicaError } = await supabase
.from("clinicas")
.select("id")
.eq("zona",solicitud.ubicacion)
.eq("ativa",true)
.limit(1)
.single()

if(clinicaError || !clinicaData){
alert("No se encontró clínica activa para esta zona")
setLoadingId(null)
return
}

const clinicaId = clinicaData.id

const { data:horarioId,error:reservaError } = await supabase
.rpc("reservar_vaga",{ p_clinica_id:clinicaId })

if(reservaError || !horarioId){
alert("No hay cupos disponibles en esta clínica")
setLoadingId(null)
return
}

const codigoGenerado =
`RUG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random()*900000)}`

await supabase
.from("solicitudes")
.update({ codigo:codigoGenerado })
.eq("id",solicitud.id)

const { error:insertError } = await supabase
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

foto_frente: solicitud.foto_frente,
foto_lado: solicitud.foto_lado,
foto_carnet: solicitud.foto_carnet
}
])

if(insertError){
console.error(insertError)
alert("Error al insertar en registros")
setLoadingId(null)
return
}

}

await fetchSolicitudes()
setLoadingId(null)

}

return (

<div className="min-h-screen bg-gray-100 p-8">

<h1 className="text-3xl font-bold mb-8 text-gray-800">
Solicitudes Recibidas
</h1>

{solicitudes.length === 0 && (
<p className="text-gray-500">
No hay solicitudes aún.
</p>
)}

<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

{solicitudes.map((s)=>(

<div
key={s.id}
className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
>

<p className="text-sm text-gray-500 mb-2">
{s.codigo}
</p>

<h2 className="text-lg font-semibold mb-3">
{s.nombre_completo}
</h2>

<div className="text-sm space-y-1">

<p><strong>CI:</strong> {s.ci || "No especificado"}</p>
<p><strong>Celular:</strong> {s.celular}</p>
<p><strong>Ubicación:</strong> {s.ubicacion}</p>
<p><strong>Animal:</strong> {s.nombre_animal} ({s.especie})</p>
<p><strong>Sexo:</strong> {s.sexo}</p>
<p><strong>Edad:</strong> {s.edad}</p>
<p><strong>Peso:</strong> {s.peso} kg</p>

</div>

{/* MINIATURAS */}

<div className="flex gap-2 mt-4">

{s.foto_frente && (
<img
src={s.foto_frente}
className="w-16 h-16 object-cover rounded-md border cursor-pointer hover:scale-110 transition"
onClick={()=>setFotoSeleccionada(s.foto_frente)}
/>
)}

{s.foto_lado && (
<img
src={s.foto_lado}
className="w-16 h-16 object-cover rounded-md border cursor-pointer hover:scale-110 transition"
onClick={()=>setFotoSeleccionada(s.foto_lado)}
/>
)}

{s.foto_carnet && (
<img
src={s.foto_carnet}
className="w-16 h-16 object-cover rounded-md border cursor-pointer hover:scale-110 transition"
onClick={()=>setFotoSeleccionada(s.foto_carnet)}
/>
)}

</div>

<div className="mt-3">

<span
className={`px-3 py-1 rounded-full text-xs font-semibold ${
s.estado === "Pendiente"
? "bg-yellow-100 text-yellow-800"
: s.estado === "Aprobado"
? "bg-green-100 text-green-800"
: "bg-red-100 text-red-800"
}`}
>
{s.estado}
</span>

</div>

{s.estado === "Pendiente" && (

<div className="flex gap-3 mt-6">

<button
disabled={loadingId === s.id}
onClick={()=>cambiarEstado(s,"Aprobado")}
className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
>
{loadingId === s.id ? "Procesando..." : "Aprobar"}
</button>

<button
disabled={loadingId === s.id}
onClick={()=>cambiarEstado(s,"Rechazado")}
className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
>
{loadingId === s.id ? "Procesando..." : "Rechazar"}
</button>

</div>

)}

</div>

))}

</div>


{/* MODAL FOTO GRANDE */}

{fotoSeleccionada && (

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