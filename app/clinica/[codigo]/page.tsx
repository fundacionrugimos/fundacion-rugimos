"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function PacienteClinica(){

const params = useParams()
const codigo = params.codigo

const [registro,setRegistro] = useState<any>(null)

async function cargar(){

const { data,error } = await supabase
.from("registros")
.select("*")
.eq("codigo",codigo)
.single()

if(data){
setRegistro(data)
}

}

useEffect(()=>{
cargar()
},[])

async function marcarApto(){

await supabase
.from("registros")
.update({estado:"Apto"})
.eq("codigo",codigo)

alert("Paciente marcado como APTO")

}

async function marcarNoApto(){

await supabase
.from("registros")
.update({estado:"No Apto"})
.eq("codigo",codigo)

alert("Paciente marcado como NO APTO")

}

if(!registro){

return(
<div className="min-h-screen flex items-center justify-center">
Cargando paciente...
</div>
)

}

return(

<div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">

<div className="bg-white rounded-xl shadow-lg p-8 max-w-xl w-full">

<h1 className="text-2xl font-bold mb-6">
Paciente {registro.codigo}
</h1>

<h2 className="font-semibold mt-4 mb-2">Responsable</h2>

<p><b>Nombre:</b> {registro.nombre_responsable}</p>
<p><b>Teléfono:</b> {registro.telefono}</p>
<p><b>CI:</b> {registro.ci}</p>
<p><b>Zona:</b> {registro.zona}</p>

<h2 className="font-semibold mt-6 mb-2">Mascota</h2>

<p><b>Nombre:</b> {registro.nombre_animal}</p>
<p><b>Especie:</b> {registro.especie}</p>
<p><b>Sexo:</b> {registro.sexo}</p>
<p><b>Edad:</b> {registro.edad}</p>
<p><b>Peso:</b> {registro.peso}</p>
<p><b>Tipo:</b> {registro.tipo_animal}</p>

<h2 className="font-semibold mt-6 mb-2">Cirugía</h2>

<p><b>Hora:</b> {registro.hora}</p>

<h2 className="font-semibold mt-6 mb-3">Fotos</h2>

<div className="flex gap-3">

{registro.foto_frente && (
<img src={registro.foto_frente} className="w-24 h-24 object-cover rounded"/>
)}

{registro.foto_lado && (
<img src={registro.foto_lado} className="w-24 h-24 object-cover rounded"/>
)}

{registro.foto_carnet && (
<img src={registro.foto_carnet} className="w-24 h-24 object-cover rounded"/>
)}

</div>

<div className="flex gap-4 mt-8">

<button
onClick={marcarApto}
className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold"
>
APTO
</button>

<button
onClick={marcarNoApto}
className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold"
>
NO APTO
</button>

</div>

</div>

</div>

)

}