```tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id:number
  zona:string
  usuario:string
  senha:string
  ativa:boolean

  acepta_gatos:boolean
  acepta_perros:boolean
  acepta_machos:boolean
  acepta_hembras:boolean
  acepta_calle:boolean
  acepta_propio:boolean
}

export default function ClinicasPage(){

const [clinicas,setClinicas] = useState<Clinica[]>([])
const [selectedClinica,setSelectedClinica] = useState<Clinica|null>(null)
const [isOpen,setIsOpen] = useState(false)

async function fetchClinicas(){

const {data} = await supabase
.from("clinicas")
.select("*")
.order("zona",{ascending:true})

if(data) setClinicas(data)

}

useEffect(()=>{
fetchClinicas()
},[])

async function toggleClinica(id:number,ativa:boolean){

await supabase
.from("clinicas")
.update({ativa:!ativa})
.eq("id",id)

fetchClinicas()

}

async function handleSave(e:any){

e.preventDefault()

const form = e.target

const zona = form.zona.value
const usuario = form.usuario.value
const senha = form.senha.value

const acepta_gatos = form.acepta_gatos.checked
const acepta_perros = form.acepta_perros.checked
const acepta_machos = form.acepta_machos.checked
const acepta_hembras = form.acepta_hembras.checked
const acepta_calle = form.acepta_calle.checked
const acepta_propio = form.acepta_propio.checked

await supabase
.from("clinicas")
.update({
zona,
usuario,
senha,
acepta_gatos,
acepta_perros,
acepta_machos,
acepta_hembras,
acepta_calle,
acepta_propio
})
.eq("id",selectedClinica?.id)

setIsOpen(false)
fetchClinicas()

}

return(

<main className="min-h-screen bg-[#026A6A] p-10">

<h1 className="text-3xl text-white font-bold mb-8">
Gestión de Clínicas
</h1>

<div className="space-y-6">

{clinicas.map((clinica)=>(

<div
key={clinica.id}
className="bg-white p-6 rounded-2xl shadow-md flex justify-between items-center"
>

<div>

<p className="text-xl font-semibold text-[#026A6A]">
Zona: {clinica.zona}
</p>

<p className="text-gray-600">
Usuario: {clinica.usuario}
</p>

<div className="text-sm mt-3">

<p>Gatos: {clinica.acepta_gatos ? "✔" : "❌"}</p>
<p>Perros: {clinica.acepta_perros ? "✔" : "❌"}</p>
<p>Machos: {clinica.acepta_machos ? "✔" : "❌"}</p>
<p>Hembras: {clinica.acepta_hembras ? "✔" : "❌"}</p>
<p>Calle: {clinica.acepta_calle ? "✔" : "❌"}</p>
<p>Propio: {clinica.acepta_propio ? "✔" : "❌"}</p>

</div>

</div>

<div className="flex gap-3">

<button
onClick={()=>{
setSelectedClinica(clinica)
setIsOpen(true)
}}
className="px-4 py-2 bg-[#026A6A] text-white rounded-lg"
>
Editar
</button>

<button
onClick={()=>toggleClinica(clinica.id,clinica.ativa)}
className={`px-4 py-2 rounded-lg text-white ${
clinica.ativa ? "bg-red-500":"bg-green-500"
}`}
>
{clinica.ativa ? "Desactivar":"Activar"}
</button>

</div>

</div>

))}

</div>

{isOpen && selectedClinica && (

<div className="fixed inset-0 bg-black/40 flex items-center justify-center">

<div className="bg-white p-8 rounded-2xl w-full max-w-md">

<h2 className="text-2xl font-bold mb-6 text-[#026A6A]">
Editar Clínica
</h2>

<form onSubmit={handleSave} className="space-y-4">

<input
name="zona"
defaultValue={selectedClinica.zona}
className="w-full border p-2 rounded"
/>

<input
name="usuario"
defaultValue={selectedClinica.usuario}
className="w-full border p-2 rounded"
/>

<input
name="senha"
defaultValue={selectedClinica.senha}
className="w-full border p-2 rounded"
/>

<h3 className="font-semibold text-[#026A6A] mt-4">
Restricciones
</h3>

<div className="grid grid-cols-2 gap-2 text-sm">

<label>
<input type="checkbox" name="acepta_gatos" defaultChecked={selectedClinica.acepta_gatos}/>
Gatos
</label>

<label>
<input type="checkbox" name="acepta_perros" defaultChecked={selectedClinica.acepta_perros}/>
Perros
</label>

<label>
<input type="checkbox" name="acepta_machos" defaultChecked={selectedClinica.acepta_machos}/>
Machos
</label>

<label>
<input type="checkbox" name="acepta_hembras" defaultChecked={selectedClinica.acepta_hembras}/>
Hembras
</label>

<label>
<input type="checkbox" name="acepta_calle" defaultChecked={selectedClinica.acepta_calle}/>
Calle
</label>

<label>
<input type="checkbox" name="acepta_propio" defaultChecked={selectedClinica.acepta_propio}/>
Propio
</label>

</div>

<div className="flex justify-end gap-3 mt-6">

<button
type="button"
onClick={()=>setIsOpen(false)}
className="px-4 py-2 bg-gray-300 rounded"
>
Cancelar
</button>

<button
type="submit"
className="px-4 py-2 bg-[#F47C2A] text-white rounded"
>
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
```
