'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Clinica{
id:string
zona:string
horario_inicio:string
horario_fim:string
se_por_dia:number
ativa:boolean
usuario:string
senha:string
acepta_gatos:boolean
acepta_perros:boolean
acepta_machos:boolean
acepta_hembras:boolean
acepta_calle:boolean
acepta_propio:boolean
acepta_perras_calle:boolean
}

interface Horario{
id:string
hora:string
cupos_maximos:number
cupos_ocupados:number
clinica_id:string
}

export default function ClinicasPage(){

const [clinicas,setClinicas]=useState<Clinica[]>([])
const [horarios,setHorarios]=useState<Horario[]>([])
const [isOpen,setIsOpen]=useState(false)
const [selectedClinica,setSelectedClinica]=useState<Clinica|null>(null)
const [loading,setLoading]=useState(false)

const [hora,setHora]=useState("")
const [cupos,setCupos]=useState(10)

async function fetchClinicas(){

const {data,error}=await supabase
.from("clinicas")
.select("*")
.order("zona",{ascending:true})

if(error){
console.error(error)
return
}

if(data)setClinicas(data)

}

async function fetchHorarios(clinicaId:string){

const {data,error}=await supabase
.from("horarios_clinica")
.select("*")
.eq("clinica_id",clinicaId)
.order("hora")

if(error){
console.error(error)
return
}

if(data)setHorarios(data)

}

useEffect(()=>{
fetchClinicas()
},[])

async function toggleClinica(id:string,ativa:boolean){

if(!confirm("¿Seguro que deseas cambiar el estado de esta clínica?")) return

const {error}=await supabase
.from("clinicas")
.update({ativa:!ativa})
.eq("id",id)

if(error){
console.error(error)
return
}

setClinicas(prev =>
prev.map(c =>
c.id===id ? {...c,ativa:!ativa}:c
)
)

}

return(

<main className="min-h-screen bg-[#026A6A] p-10">

<div className="flex justify-between items-center mb-10">

<h1 className="text-3xl font-bold text-white">
Gestión de Clínicas 🏥
</h1>

<button
onClick={()=>{setSelectedClinica(null);setIsOpen(true)}}
className="bg-[#F47C2A] text-white px-6 py-2 rounded-xl"
>
* Nueva Clínica
</button>

</div>

<div className="space-y-6">

{clinicas.map((clinica)=>(

<div key={clinica.id} className="bg-white p-6 rounded-2xl shadow-md flex justify-between">

<div>

<p className="font-semibold text-xl text-[#026A6A]">
Zona: {clinica.zona}
</p>

<p>Horario: {clinica.horario_inicio} - {clinica.horario_fim}</p>
<p>Cupos por día: {clinica.se_por_dia}</p>
<p>Usuario: {clinica.usuario}</p>

<div className="text-sm mt-2">

<p>Gatos: {clinica.acepta_gatos?"✔":"❌"}</p>
<p>Perros: {clinica.acepta_perros?"✔":"❌"}</p>
<p>Machos: {clinica.acepta_machos?"✔":"❌"}</p>
<p>Hembras: {clinica.acepta_hembras?"✔":"❌"}</p>
<p>Calle: {clinica.acepta_calle?"✔":"❌"}</p>
<p>Propio: {clinica.acepta_propio?"✔":"❌"}</p>
<p>Perras calle: {clinica.acepta_perras_calle?"✔":"❌"}</p>

</div>

<span className={clinica.ativa?"text-green-700":"text-red-700"}>
{clinica.ativa?"Activa":"Inactiva"}
</span>

</div>

<div className="flex gap-3">

<button
onClick={()=>{
setSelectedClinica(clinica)
fetchHorarios(clinica.id)
setIsOpen(true)
}}
className="px-4 py-2 bg-[#026A6A] text-white rounded-lg"
>
Editar
</button>

<button
onClick={()=>toggleClinica(clinica.id,clinica.ativa)}
className="px-4 py-2 bg-red-500 text-white rounded-lg"
>
{clinica.ativa?"Desactivar":"Activar"}
</button>

</div>

</div>

))}

</div>

{/* MODAL */}

{isOpen && (

<div
className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6 overflow-y-auto"
onClick={()=>setIsOpen(false)}
>

<div
className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
onClick={(e)=>e.stopPropagation()}
>

<h2 className="text-2xl font-bold mb-6 text-[#026A6A]">
Editar Clínica
</h2>

<p className="text-gray-600">
Panel de edición abierto correctamente.
</p>

<div className="flex justify-end pt-6">

<button
onClick={()=>setIsOpen(false)}
className="bg-gray-300 px-4 py-2 rounded"
>
Cerrar
</button>

</div>

</div>

</div>

)}

</main>

)

}