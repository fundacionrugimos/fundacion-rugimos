"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function PacienteClinica(){

const params = useParams()
const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo

const [registro,setRegistro] = useState<any>(null)

async function cargar(){

const { data,error } = await supabase
.from("registros")
.select("*")
.eq("codigo",codigo)
.single()

if(error){
console.log("Error cargando registro:",error)
return
}

if(data){
setRegistro(data)
}

}

useEffect(()=>{
if(codigo){
cargar()
}
},[codigo])


/* MARCAR APTO */

async function marcarApto(){

const { data,error } = await supabase
.from("registros")
.update({ estado:"Apto" })
.eq("codigo",codigo)
.select()

if(error){
console.log(error)
alert("Error actualizando registro")
return
}

alert("Paciente marcado como APTO")

cargar()

}


/* MARCAR NO APTO */

async function marcarNoApto(){

const { data,error } = await supabase
.from("registros")
.update({ estado:"No Apto" })
.eq("codigo",codigo)
.select()

if(error){
console.log(error)
alert("Error actualizando registro")
return
}

alert("Paciente marcado como NO APTO")

cargar()

}


/* CARGANDO */

if(!registro){

return(
<div className="min-h-screen flex items-center justify-center bg-[#0F6D6A] text-white text-xl">
Cargando paciente...
</div>
)

}


return(

<div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-8">

<div className="w-full max-w-4xl space-y-6">

{/* TITULO */}

<h1 className="text-3xl font-bold text-center text-[#0F6D6A]">
Paciente {registro.codigo}
</h1>


{/* RESPONSABLE */}

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
Datos del Responsable
</h2>

<div className="grid grid-cols-2 gap-4 text-gray-700">

<p><b>Nombre:</b> {registro.nombre_responsable}</p>
<p><b>Teléfono:</b> {registro.telefono}</p>
<p><b>CI:</b> {registro.ci}</p>
<p><b>Zona:</b> {registro.zona}</p>

</div>

</div>


{/* ANIMAL */}

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
Datos del Animal
</h2>

<div className="grid grid-cols-2 gap-4 text-gray-700">

<p><b>Nombre:</b> {registro.nombre_animal}</p>
<p><b>Especie:</b> {registro.especie}</p>
<p><b>Sexo:</b> {registro.sexo}</p>
<p><b>Edad:</b> {registro.edad}</p>
<p><b>Peso:</b> {registro.peso}</p>
<p><b>Tipo:</b> {registro.tipo_animal}</p>

</div>

</div>


{/* CIRUGIA */}

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
Datos de la Cirugía
</h2>

<p className="text-gray-700 text-lg">
<b>Hora asignada:</b> {registro.hora || "No asignada"}
</p>

</div>


{/* FOTOS */}

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
Fotos del Registro
</h2>

<div className="flex gap-4 flex-wrap">

{registro.foto_frente && (
<img src={registro.foto_frente} className="w-36 h-36 object-cover rounded-lg shadow-md"/>
)}

{registro.foto_lado && (
<img src={registro.foto_lado} className="w-36 h-36 object-cover rounded-lg shadow-md"/>
)}

{registro.foto_carnet && (
<img src={registro.foto_carnet} className="w-36 h-36 object-cover rounded-lg shadow-md"/>
)}

</div>

</div>


{/* BOTONES */}

<div className="flex justify-center gap-8 pt-6">

<button
onClick={marcarApto}
className="bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-xl font-bold text-lg shadow-md transition"
>
APTO
</button>

<button
onClick={marcarNoApto}
className="bg-red-600 hover:bg-red-700 text-white px-12 py-4 rounded-xl font-bold text-lg shadow-md transition"
>
NO APTO
</button>

</div>

</div>

</div>

)

}