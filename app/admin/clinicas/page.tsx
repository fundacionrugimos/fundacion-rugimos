'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Clinica{
id:string
zona:string
horario_inicio:string
horario_fim:string
cupos_por_dia:number
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

if(!selectedClinica) return

const form = e.target

const {error}=await supabase
.from("clinicas")
.update({
zona:form.zona.value,
horario_inicio:form.horario_inicio.value,
horario_fim:form.horario_fim.value,
cupos_por_dia:Number(form.cupos_por_dia.value),
usuario:form.usuario.value,
senha:form.senha.value,
acepta_gatos:form.acepta_gatos.checked,
acepta_perros:form.acepta_perros.checked,
acepta_machos:form.acepta_machos.checked,
acepta_hembras:form.acepta_hembras.checked,
acepta_calle:form.acepta_calle.checked,
acepta_propio:form.acepta_propio.checked,
acepta_perras_calle:form.acepta_perras_calle.checked
})
.eq("id",selectedClinica.id)

if(error){
console.error(error)
alert("Error actualizando clínica")
return
}

fetchClinicas()
setIsOpen(false)

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
<p>Cupos por día: {clinica.cupos_por_dia}</p>
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

{isOpen && selectedClinica && (

<div
className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
onClick={()=>setIsOpen(false)}
>

<div
className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
onClick={(e)=>e.stopPropagation()}
>

<h2 className="text-2xl font-bold mb-6 text-[#026A6A]">
Editar Clínica
</h2>

<form onSubmit={handleSave} className="space-y-4">

<input name="zona" defaultValue={selectedClinica.zona} className="w-full border p-2"/>

<input name="horario_inicio" type="time" defaultValue={selectedClinica.horario_inicio} className="w-full border p-2"/>

<input name="horario_fim" type="time" defaultValue={selectedClinica.horario_fim} className="w-full border p-2"/>

<input name="cupos_por_dia" type="number" defaultValue={selectedClinica.cupos_por_dia} className="w-full border p-2"/>

<input name="usuario" defaultValue={selectedClinica.usuario} className="w-full border p-2"/>

<input name="senha" defaultValue={selectedClinica.senha} className="w-full border p-2"/>

<div className="grid grid-cols-2 gap-3">

<label><input type="checkbox" name="acepta_gatos" defaultChecked={selectedClinica.acepta_gatos}/> Gatos</label>
<label><input type="checkbox" name="acepta_perros" defaultChecked={selectedClinica.acepta_perros}/> Perros</label>
<label><input type="checkbox" name="acepta_machos" defaultChecked={selectedClinica.acepta_machos}/> Machos</label>
<label><input type="checkbox" name="acepta_hembras" defaultChecked={selectedClinica.acepta_hembras}/> Hembras</label>
<label><input type="checkbox" name="acepta_calle" defaultChecked={selectedClinica.acepta_calle}/> Calle</label>
<label><input type="checkbox" name="acepta_propio" defaultChecked={selectedClinica.acepta_propio}/> Propio</label>
<label><input type="checkbox" name="acepta_perras_calle" defaultChecked={selectedClinica.acepta_perras_calle}/> Perras de la calle</label>

</div>

<div className="flex justify-end gap-3 pt-4">

<button type="button" onClick={()=>setIsOpen(false)} className="bg-gray-300 px-4 py-2 rounded">
Cancelar
</button>

<button type="submit" className="bg-[#F47C2A] text-white px-4 py-2 rounded">
Guardar
</button>

</div>

</form>

</div>

</div>

)}

</main>

)

}