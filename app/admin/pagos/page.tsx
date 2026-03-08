"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Clinica = {
id:string
nome:string
}

type Registro = {
clinica_id:string
especie:string
sexo:string
pagado:boolean
estado_clinica:string
}

export default function AdminPagos(){

const [clinicas,setClinicas] = useState<Clinica[]>([])
const [registros,setRegistros] = useState<Registro[]>([])
const [loading,setLoading] = useState(false)

useEffect(()=>{
cargarDatos()
},[])

async function cargarDatos(){

const {data:clinicasData} = await supabase
.from("clinicas")
.select("*")

const {data:registrosData} = await supabase
.from("registros")
.select("*")
.eq("estado_clinica","Apto")
.eq("pagado",false)

if(clinicasData) setClinicas(clinicasData)
if(registrosData) setRegistros(registrosData)

}

function calcular(clinicaId:string){

const filtrados = registros.filter(r=>r.clinica_id===clinicaId)

let perro_macho=0
let perra_hembra=0
let gato_macho=0
let gata_hembra=0

filtrados.forEach(r=>{

if(r.especie==="Perro" && r.sexo==="Macho") perro_macho++
if(r.especie==="Perro" && r.sexo==="Hembra") perra_hembra++
if(r.especie==="Gato" && r.sexo==="Macho") gato_macho++
if(r.especie==="Gato" && r.sexo==="Hembra") gata_hembra++

})

const total =
(perro_macho*40)+
(perra_hembra*80)+
(gato_macho*10)+
(gata_hembra*20)

return{
perro_macho,
perra_hembra,
gato_macho,
gata_hembra,
total
}

}

async function pagarClinica(clinicaId:string){

const confirmar = confirm("Confirmar pago a la clínica?")

if(!confirmar) return

setLoading(true)

await supabase
.from("registros")
.update({
pagado:true,
fecha_pago:new Date()
})
.eq("clinica_id",clinicaId)
.eq("pagado",false)

await cargarDatos()

setLoading(false)

alert("Pago registrado correctamente")

}

return(

<div className="min-h-screen bg-[#0F6D6A] p-10">

<h1 className="text-4xl font-bold text-white mb-10 text-center">
Pagos a Clínicas
</h1>

<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

{clinicas.map((clinica)=>{

const data = calcular(clinica.id)

return(

<div
key={clinica.id}
className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
>

<h2 className="text-2xl font-bold text-[#0F6D6A]">
{clinica.nome}
</h2>

<div className="space-y-2 text-gray-700">

<p>🐶 Perro macho: {data.perro_macho} → Bs {data.perro_macho*40}</p>

<p>🐶 Perra hembra: {data.perra_hembra} → Bs {data.perra_hembra*80}</p>

<p>🐱 Gato macho: {data.gato_macho} → Bs {data.gato_macho*10}</p>

<p>🐱 Gata hembra: {data.gata_hembra} → Bs {data.gata_hembra*20}</p>

</div>

<div className="border-t pt-3 text-lg font-bold text-[#F47C2A]">

Total pagar: Bs {data.total}

</div>

<button
onClick={()=>pagarClinica(clinica.id)}
disabled={loading}
className="w-full bg-[#F47C2A] text-white py-3 rounded-xl font-bold hover:opacity-90 transition"
>

Marcar como PAGADO

</button>

</div>

)

})}

</div>

</div>

)

}