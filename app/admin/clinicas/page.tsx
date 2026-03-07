'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Clinica{
id:number
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
id:number
hora:string
cupos_disponibles:number
clinica_id:number
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

async function fetchHorarios(clinicaId:number){

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

async function toggleClinica(id:number,ativa:boolean){

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

const form=e.target

const zona=form.zona.value
const horario_inicio=form.horario_inicio.value
const horario_fim=form.horario_fim.value
const se_por_dia=Number(form.se_por_dia.value)
const usuario=form.usuario.value
const senha=form.senha.value

const acepta_gatos=form.acepta_gatos.checked
const acepta_perros=form.acepta_perros.checked
const acepta_machos=form.acepta_machos.checked
const acepta_hembras=form.acepta_hembras.checked
const acepta_calle=form.acepta_calle.checked
const acepta_propio=form.acepta_propio.checked
const acepta_perras_calle=form.acepta_perras_calle.checked

if(selectedClinica){

await supabase
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

}else{

await supabase
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
cupos_disponibles:Number(cupos),
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

async function eliminarHorario(id:number){

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
{clinica.ativa?"Activa":"Inactiva"} </span>

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

Editar </button>

<button
onClick={()=>toggleClinica(clinica.id,clinica.ativa)}
className="px-4 py-2 bg-red-500 text-white rounded-lg"

>

{clinica.ativa?"Desactivar":"Activar"} </button>

</div>

</div>

))}

</div>

{isOpen && (

<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 overflow-y-auto">

<div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">

<h2 className="text-2xl font-bold mb-6 text-[#026A6A]">
{selectedClinica?"Editar Clínica":"Nueva Clínica"}
</h2>

<form onSubmit={handleSave} className="space-y-4">

<input name="zona" defaultValue={selectedClinica?.zona||""} className="w-full border p-2"/>

<input name="horario_inicio" type="time" defaultValue={selectedClinica?.horario_inicio||""} className="w-full border p-2"/>

<input name="horario_fim" type="time" defaultValue={selectedClinica?.horario_fim||""} className="w-full border p-2"/>

<input name="se_por_dia" type="number" defaultValue={selectedClinica?.se_por_dia||""} className="w-full border p-2"/>

<input name="usuario" defaultValue={selectedClinica?.usuario||""} className="w-full border p-2"/>

<input name="senha" defaultValue={selectedClinica?.senha||""} className="w-full border p-2"/>

<div className="grid grid-cols-2 gap-3">

<label><input type="checkbox" name="acepta_gatos" defaultChecked={selectedClinica?.acepta_gatos}/> Gatos</label> <label><input type="checkbox" name="acepta_perros" defaultChecked={selectedClinica?.acepta_perros}/> Perros</label> <label><input type="checkbox" name="acepta_machos" defaultChecked={selectedClinica?.acepta_machos}/> Machos</label> <label><input type="checkbox" name="acepta_hembras" defaultChecked={selectedClinica?.acepta_hembras}/> Hembras</label> <label><input type="checkbox" name="acepta_calle" defaultChecked={selectedClinica?.acepta_calle}/> Calle</label> <label><input type="checkbox" name="acepta_propio" defaultChecked={selectedClinica?.acepta_propio}/> Propio</label> <label><input type="checkbox" name="acepta_perras_calle" defaultChecked={selectedClinica?.acepta_perras_calle}/> Perras de la calle</label>

</div>

<h3 className="font-bold mt-6">Horarios de cupos</h3>

<div className="flex gap-2">

<input type="time" value={hora} onChange={(e)=>setHora(e.target.value)} className="border p-2"/>

<input type="number" value={cupos} onChange={(e)=>setCupos(Number(e.target.value))} className="border p-2 w-20"/>

<button type="button" onClick={()=>agregarHorario()} className="bg-[#F47C2A] text-white px-3 py-1 rounded">

* Añadir

  </button>

</div>

<div className="mt-3">

{horarios.map(h=>(

<div key={h.id} className="flex justify-between text-sm border-b py-1">
<span>{h.hora} | {h.cupos_disponibles} cupos</span>
<button type="button" onClick={()=>eliminarHorario(h.id)} className="text-red-600">
eliminar
</button>
</div>

))}

</div>

<div className="flex justify-end gap-3 pt-4">

<button type="button" onClick={()=>setIsOpen(false)} className="bg-gray-300 px-4 py-2 rounded">
Cancelar </button>

<button type="submit" disabled={loading} className="bg-[#F47C2A] text-white px-4 py-2 rounded">
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
