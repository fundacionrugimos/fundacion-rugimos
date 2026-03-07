"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function PacienteClinica() {

const params = useParams()
const codigo = params.codigo

const [registro, setRegistro] = useState<any>(null)

async function cargar() {

const { data } = await supabase
.from("registros")
.select("*")
.eq("codigo", codigo)
.single()

if (data) {
setRegistro(data)
}

}

useEffect(() => {
cargar()
}, [])

async function marcarApto() {

await supabase
.from("registros")
.update({ estado: "Apto" })
.eq("codigo", codigo)

alert("Paciente marcado como APTO")

}

async function marcarNoApto() {

await supabase
.from("registros")
.update({ estado: "No Apto" })
.eq("codigo", codigo)

alert("Paciente marcado como NO APTO")

}

if (!registro) {

return (
<div className="min-h-screen flex items-center justify-center">
Cargando paciente...
</div>
)

}

return (

<div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">

<div className="w-full max-w-3xl space-y-6">

<h1 className="text-3xl font-bold text-center text-gray-800">
Paciente {registro.codigo}
</h1>

{/* RESPONSABLE */}

<div className="bg-white rounded-xl shadow-md p-6">

<h2 className="text-xl font-semibold text-[#026A6A] mb-4">
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

<div className="bg-white rounded-xl shadow-md p-6">

<h2 className="text-xl font-semibold text-[#026A6A] mb-4">
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

<div className="bg-white rounded-xl shadow-md p-6">

<h2 className="text-xl font-semibold text-[#026A6A] mb-4">
Datos de la Cirugía
</h2>

<p className="text-gray-700">
<b>Hora asignada:</b> {registro.hora || "No asignada"}
</p>

</div>

{/* FOTOS */}

<div className="bg-white rounded-xl shadow-md p-6">

<h2 className="text-xl font-semibold text-[#026A6A] mb-4">
Fotos del Registro
</h2>

<div className="flex gap-4">

{registro.foto_frente && (
<img src={registro.foto_frente} className="w-32 h-32 object-cover rounded-lg shadow"/>
)}

{registro.foto_lado && (
<img src={registro.foto_lado} className="w-32 h-32 object-cover rounded-lg shadow"/>
)}

{registro.foto_carnet && (
<img src={registro.foto_carnet} className="w-32 h-32 object-cover rounded-lg shadow"/>
)}

</div>

</div>

{/* BOTONES */}

<div className="flex justify-center gap-6 pt-4">

<button
onClick={marcarApto}
className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 rounded-xl font-semibold text-lg shadow"
>
APTO
</button>

<button
onClick={marcarNoApto}
className="bg-red-600 hover:bg-red-700 text-white px-10 py-3 rounded-xl font-semibold text-lg shadow"
>
NO APTO
</button>

</div>

</div>

</div>

)

}