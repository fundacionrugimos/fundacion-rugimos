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

async function handleSave(e:any){

e.preventDefault()

if(loading)return
setLoading(true)

const formData = new FormData(e.target)

const zona = formData.get("zona")
const horario_inicio = formData.get("horario_inicio")
const horario_fim = formData.get("horario_fim")
const se_por_dia = Number(formData.get("se_por_dia"))
const usuario = formData.get("usuario")
const senha = formData.get("senha")

const acepta_gatos = formData.get("acepta_gatos") === "on"
const acepta_perros = formData.get("acepta_perros") === "on"
const acepta_machos = formData.get("acepta_machos") === "on"
const acepta_hembras = formData.get("acepta_hembras") === "on"
const acepta_calle = formData.get("acepta_calle") === "on"
const acepta_propio = formData.get("acepta_propio") === "on"
const acepta_perras_calle = formData.get("acepta_perras_calle") === "on"

if(selectedClinica){

const {error} = await supabase
.from("clinicas")
.update({
zona,
horario_inicio,
horario_fim,
se_por_dia,
usuario,
senha,
acepta_gatos,
acepta_perros,
acepta_machos,
acepta_hembras,
acepta_calle,
acepta_propio,
acepta_perras_calle
})
.eq("id",selectedClinica.id)

if(error){
console.error(error)
alert("Error actualizando clínica")
setLoading(false)
return
}

}else{

const {error} = await supabase
.from("clinicas")
.insert([{
zona,
horario_inicio,
horario_fim,
se_por_dia,
usuario,
senha,
acepta_gatos,
acepta_perros,
acepta_machos,
acepta_hembras,
acepta_calle,
acepta_propio,
acepta_perras_calle,
ativa:true
}])

if(error){
console.error(error)
alert("Error creando clínica")
setLoading(false)
return
}

}

await fetchClinicas()

setLoading(false)
setIsOpen(false)
setSelectedClinica(null)

}

async function agregarHorario(){

if(!selectedClinica){
alert("Seleccione una clínica")
return
}

if(!hora){
alert("Seleccione una hora")
return
}

const existe=horarios.find(h=>h.hora===hora)

if(existe){
alert("Este horario ya existe")
return
}

const {error}=await supabase
.from("horarios_clinica")
.insert([{
hora:hora,
cupos_maximos:Number(cupos),
cupos_ocupados:0,
clinica_id:selectedClinica.id
}])

if(error){
console.error("Error insertando horario:",error)
alert("Error creando horario")
return
}

setHora("")
setCupos(10)

await fetchHorarios(selectedClinica.id)

}

async function eliminarHorario(id:string){

if(!selectedClinica)return

const {error}=await supabase
.from("horarios_clinica")
.delete()
.eq("id",id)

if(error){
console.error(error)
return
}

await fetchHorarios(selectedClinica.id)

}

return(

<main className="min-h-screen bg-[#026A6A] p-10">

<div className="flex justify-between itemAs-center mb-10">

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