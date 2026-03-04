"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Clinica() {

const router = useRouter()

const [codigo,setCodigo] = useState("")
const [registro,setRegistro] = useState<any>(null)
const [motivo,setMotivo] = useState("")
const [mostrarMotivo,setMostrarMotivo] = useState(false)

useEffect(()=>{

const clinica = localStorage.getItem("clinica_id")

if(!clinica){
router.push("/clinica/login")
}

},[])

const logout = () => {

localStorage.removeItem("clinica_id")
localStorage.removeItem("clinica_zona")

router.push("/clinica/login")

}

const buscarCodigo = async () => {

if(!codigo){
alert("Ingrese un código")
return
}

const { data,error } = await supabase
.from("registros")
.select("*")
.eq("codigo",codigo)
.single()

if(error || !data){
alert("Código no encontrado")
setRegistro(null)
return
}

if(data.estado === "Esterilizado" || data.estado === "No Apto"){
alert("Este código ya fue revisado por la clínica.")
setRegistro(null)
setCodigo("")
return
}

setRegistro(data)

}

const marcarApto = async () => {

const { error } = await supabase
.from("registros")
.update({
estado:"Esterilizado"
})
.eq("codigo",codigo)

if(error){
alert("Error al actualizar")
return
}

alert("Animal registrado como esterilizado")

setRegistro(null)
setCodigo("")
setMotivo("")
setMostrarMotivo(false)

}

const marcarNoApto = async () => {

if(!motivo){
alert("Indique el motivo")
return
}

const { error } = await supabase
.from("registros")
.update({
estado:"No Apto",
motivo_no_apto:motivo
})
.eq("codigo",codigo)

if(error){
alert("Error al actualizar")
return
}

alert("Animal marcado como NO APTO")

setRegistro(null)
setCodigo("")
setMotivo("")
setMostrarMotivo(false)

}

return (

<div className="min-h-screen bg-[#0f6a63] flex justify-center pt-12 pb-20">

<div className="w-full max-w-3xl mx-auto">

{/* BOTON LOGOUT */}

<div className="flex justify-end mb-4">

<button
onClick={logout}
className="bg-white text-[#0f6a63] px-4 py-2 rounded-lg font-semibold shadow hover:opacity-90"
>
Cerrar sesión
</button>

</div>

{/* LOGO */}

<div className="text-center mb-10">

<img
src="/logo.png"
className="w-80 mx-auto mb-6"
/>

<h1 className="text-white text-2xl font-bold">
Portal Clínico
</h1>

</div>

{/* BUSCAR CODIGO */}

<div className="bg-white p-6 rounded-2xl shadow-lg">

<h2 className="text-lg font-bold mb-4 text-center">
Buscar código de registro
</h2>

<div className="flex gap-4">

<input
value={codigo}
onChange={(e)=>setCodigo(e.target.value)}
placeholder="RUG-2026-000123"
className="border p-3 rounded-lg w-full"
/>

<button
onClick={buscarCodigo}
className="bg-[#f47c3c] text-white px-6 rounded-lg font-bold hover:opacity-90"
>
Buscar
</button>

</div>

</div>

{/* RESULTADO */}

{registro && (

<div className="bg-white p-8 rounded-2xl shadow-lg mt-6 text-center">

<h2 className="font-bold text-xl mb-4">
Datos del Responsable
</h2>

<div className="grid grid-cols-2 gap-x-16 gap-y-3 max-w-xl mx-auto text-left mt-4">

<p><b>Nombre:</b> {registro.nombre_responsable}</p>
<p><b>CI:</b> {registro.ci}</p>

<p><b>Celular:</b> {registro.telefono}</p>
<p><b>Zona:</b> {registro.zona}</p>

</div>

<h2 className="font-bold text-xl mt-8 mb-4">
Datos del Animal
</h2>

<div className="grid grid-cols-2 gap-x-16 gap-y-3 max-w-xl mx-auto text-left mt-4">

<p><b>Nombre:</b> {registro.nombre_animal}</p>
<p><b>Especie:</b> {registro.especie}</p>

<p><b>Sexo:</b> {registro.sexo}</p>
<p><b>Edad:</b> {registro.edad}</p>

<p><b>Peso:</b> {registro.peso}</p>
<p><b>Tipo:</b> {registro.tipo_animal}</p>

</div>

<h2 className="font-bold text-xl mt-8 mb-4">
Fotos
</h2>

<div className="flex justify-center gap-6 flex-wrap">

{registro.foto_frente && (
<a href={registro.foto_frente} target="_blank">
<img
src={registro.foto_frente}
className="rounded-lg w-40 cursor-pointer hover:scale-105 transition"
/>
</a>
)}

{registro.foto_lado && (
<a href={registro.foto_lado} target="_blank">
<img
src={registro.foto_lado}
className="rounded-lg w-40 cursor-pointer hover:scale-105 transition"
/>
</a>
)}

{registro.foto_carnet && (
<a href={registro.foto_carnet} target="_blank">
<img
src={registro.foto_carnet}
className="rounded-lg w-40 cursor-pointer hover:scale-105 transition"
/>
</a>
)}

</div>

{/* BOTONES */}

<div className="flex justify-center gap-6 mt-10">

<button
onClick={marcarApto}
className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold shadow"
>
APTO
</button>

<button
onClick={()=>setMostrarMotivo(true)}
className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold shadow"
>
NO APTO
</button>

</div>

{/* MOTIVO */}

{mostrarMotivo && (

<div className="mt-6">

<textarea
placeholder="Motivo del rechazo"
className="border w-full p-3 rounded-lg"
onChange={(e)=>setMotivo(e.target.value)}
/>

<button
onClick={marcarNoApto}
className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg mt-3"
>
Confirmar NO APTO
</button>

</div>

)}

</div>

)}

</div>

</div>

)

}