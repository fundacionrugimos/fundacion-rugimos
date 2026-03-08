"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function PacienteClinica(){

const params = useParams()
const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo

const [registro,setRegistro] = useState<any>(null)

/* CARGAR PACIENTE */

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


/* ESTADO FINAL */

const finalizado =
registro?.estado_clinica === "Apto" ||
registro?.estado_clinica === "Rechazado"


/* MARCAR APTO */

async function marcarApto(){

if(finalizado) return

const { error } = await supabase
.from("registros")
.update({
estado_clinica:"Apto",
fecha_cirugia_realizada:new Date()
})
.eq("codigo",codigo)

if(error){
console.log(error)
alert("Error actualizando registro")
return
}

alert("Paciente marcado como APTO y cirugía registrada")

cargar()

}


/* MARCAR NO APTO */

async function marcarNoApto(){

if(finalizado) return

const motivo = prompt("Motivo do NO APTO:")

if(!motivo){
alert("Debe ingresar un motivo")
return
}

const { error } = await supabase
.from("registros")
.update({
estado_clinica:"Rechazado",
motivo_no_apto:motivo
})
.eq("codigo",codigo)

if(error){
console.log(error)
alert("Error actualizando registro")
return
}

alert("Paciente marcado como NO APTO")

cargar()

}


/* REPROGRAMAR */

async function reprogramar(){

if(finalizado) return

const motivo = prompt("Motivo da reprogramação:")

if(!motivo){
alert("Debe ingresar un motivo")
return
}

const { error } = await supabase
.from("registros")
.update({
estado_clinica:"Reprogramado",
motivo_no_apto:motivo,
fecha_reprogramacion:new Date()
})
.eq("codigo",codigo)

if(error){
console.log(error)
alert("Error actualizando registro")
return
}

alert("Cirugía reprogramada")

cargar()

}


/* STATUS VISUAL */

function colorEstado(){

if(!registro?.estado_clinica) return "bg-yellow-500"

if(registro.estado_clinica === "Pendiente") return "bg-yellow-500"

if(registro.estado_clinica === "Apto") return "bg-green-600"

if(registro.estado_clinica === "Rechazado") return "bg-red-600"

if(registro.estado_clinica === "Reprogramado") return "bg-orange-500"

if(registro.estado_clinica === "No Show") return "bg-gray-700"

return "bg-gray-400"

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

<div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center p-8">

<div className="w-full max-w-4xl space-y-6">


{/* TITULO */}

<div className="text-center">

<h1 className="text-4xl font-bold text-white">
Paciente {registro.codigo}
</h1>

</div>


{/* ESTADO */}

<div className="flex justify-center">

<span className={`${colorEstado()} text-white px-6 py-2 rounded-full text-lg font-bold shadow-md`}>
{registro.estado_clinica || "Pendiente"}
</span>

</div>


{/* RESPONSABLE */}

<div className="bg-white rounded-2xl shadow-xl p-6">

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

<div className="bg-white rounded-2xl shadow-xl p-6">

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

<div className="bg-white rounded-2xl shadow-xl p-6">

<h2 className="text-xl font-bold text-[#0F6D6A] mb-4">
Datos de la Cirugía
</h2>

<p className="text-gray-700 text-lg">
<b>Hora asignada:</b> {registro.hora || "No asignada"}
</p>

</div>


{/* FOTOS */}

<div className="bg-white rounded-2xl shadow-xl p-6">

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

<div className="flex justify-center gap-6 pt-6 flex-wrap">

<button
onClick={marcarApto}
disabled={finalizado}
className={`px-10 py-4 rounded-xl font-bold text-lg shadow-md transition
${finalizado ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}
>
APTO
</button>

<button
onClick={marcarNoApto}
disabled={finalizado}
className={`px-10 py-4 rounded-xl font-bold text-lg shadow-md transition
${finalizado ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white"}`}
>
NO APTO
</button>

<button
onClick={reprogramar}
disabled={finalizado}
className={`px-10 py-4 rounded-xl font-bold text-lg shadow-md transition
${finalizado ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
>
REPROGRAMAR
</button>

</div>

</div>

</div>

)

}