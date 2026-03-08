"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

export default function PacienteClinica(){

const params = useParams()
const router = useRouter()

const codigo = Array.isArray(params.codigo) ? params.codigo[0] : params.codigo

const [registro,setRegistro] = useState<any>(null)
const [cargando,setCargando] = useState(true)
const [noEncontrado,setNoEncontrado] = useState(false)

const [fotoModal,setFotoModal] = useState<string | null>(null)


/* PROTECCIÓN LOGIN + TIEMPO DE SESIÓN */

useEffect(()=>{

const clinica = localStorage.getItem("clinica_id")
const loginTime = localStorage.getItem("clinica_login_time")

if(!clinica || !loginTime){

router.push("/clinica/login")
return

}

const ahora = Date.now()
const cincoMin = 5 * 60 * 1000

if(ahora - Number(loginTime) > cincoMin){

localStorage.removeItem("clinica_id")
localStorage.removeItem("clinica_zona")
localStorage.removeItem("clinica_login_time")

router.push("/clinica/login")

}

},[])


/* CARGAR PACIENTE */

async function cargar(){

setCargando(true)

const { data,error } = await supabase
.from("registros")
.select("*")
.eq("codigo",codigo)
.single()

if(error){

if(error.code === "PGRST116"){
setNoEncontrado(true)
}

console.log(error)
setCargando(false)
return
}

if(!data){
setNoEncontrado(true)
setCargando(false)
return
}

setRegistro(data)
setCargando(false)

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


/* VOLVER AUTOMÁTICO */

function volverClinica(){

setTimeout(()=>{
router.push("/clinica")
},1200)

}


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
alert("Error actualizando registro")
return
}

alert("Paciente marcado como APTO")

volverClinica()

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
alert("Error actualizando registro")
return
}

alert("Paciente marcado como NO APTO")

volverClinica()

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
alert("Error actualizando registro")
return
}

alert("Cirugía reprogramada")

volverClinica()

}


/* CORES DO ESTADO */

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

if(cargando){

return(
<div className="min-h-screen flex items-center justify-center bg-[#0F6D6A] text-white text-xl">
Cargando paciente...
</div>
)

}


/* CODIGO NO ENCONTRADO */

if(noEncontrado){

return(
<div className="min-h-screen flex flex-col items-center justify-center bg-[#0F6D6A] text-white gap-6">

<h1 className="text-3xl font-bold">
Código no encontrado
</h1>

<button
onClick={()=>router.push("/clinica")}
className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-xl font-bold"
>
Volver
</button>

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

<h2 className="text-xl font-bold text-[#0F6D6A] mb-6 text-center">
Fotos del Registro
</h2>

<div className="flex justify-center gap-6 flex-wrap">

{registro.foto_frente && (
<img
src={registro.foto_frente}
onClick={()=>setFotoModal(registro.foto_frente)}
className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
/>
)}

{registro.foto_lado && (
<img
src={registro.foto_lado}
onClick={()=>setFotoModal(registro.foto_lado)}
className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
/>
)}

{registro.foto_carnet && (
<img
src={registro.foto_carnet}
onClick={()=>setFotoModal(registro.foto_carnet)}
className="w-40 h-40 object-cover rounded-xl shadow-md cursor-pointer hover:scale-105 transition"
/>
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


{/* MODAL FOTO */}

{fotoModal && (

<div
onClick={()=>setFotoModal(null)}
className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
>

<img
src={fotoModal}
className="max-h-[90%] max-w-[90%] rounded-xl shadow-2xl"
/>

</div>

)}

</div>

)
}