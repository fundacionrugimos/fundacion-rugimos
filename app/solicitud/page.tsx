"use client"

import { useState } from "react"

export default function Solicitud(){

const [enviando,setEnviando] = useState(false)

return(

<div className="min-h-screen bg-green-800 flex justify-center items-start p-4">

<div className="bg-white rounded-xl shadow-lg w-full max-w-xl p-4 md:p-8">

<h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
Solicitud de Esterilización
</h1>


{/* DATOS RESPONSABLE */}

<div className="mb-8">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
👤 Datos del Responsable
</h2>

<div className="space-y-4">

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Nombre completo
</label>
<input
type="text"
placeholder="Ingrese su nombre"
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
/>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
CI
</label>
<input
type="text"
placeholder="Número de carnet"
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
/>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Celular
</label>
<input
type="text"
placeholder="Número de WhatsApp"
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
/>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Zona
</label>
<select
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
>

<option>Centro-Norte</option>
<option>Plan 3000</option>
<option>Villa 1ro de Mayo</option>
<option>Doble vía la Guardia</option>

</select>
</div>

</div>

</div>



{/* DATOS ANIMAL */}

<div className="mb-8">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
🐾 Datos del Animal
</h2>

<div className="space-y-4">

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Nombre del animal
</label>

<input
type="text"
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-500"
/>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Especie
</label>

<select
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 bg-white"
>

<option>Perro</option>
<option>Gato</option>

</select>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Sexo
</label>

<select
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 bg-white"
>

<option>Macho</option>
<option>Hembra</option>

</select>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Edad
</label>

<select
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 bg-white"
>

<option>6 meses a 1 año</option>
<option>1 a 3 años</option>
<option>3 a 6 años</option>

</select>
</div>

<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Peso
</label>

<input
type="text"
placeholder="Ej: 10 kg"
className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 placeholder-gray-500"
/>
</div>

</div>

</div>



{/* FOTOS */}

<div className="mb-8">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
📸 Subir Fotos (Obligatorio)
</h2>

<div className="grid grid-cols-3 gap-3">

<div className="text-center">

<p className="text-xs text-gray-700 mb-1">
Frente animal
</p>

<input
type="file"
className="w-full text-sm"
/>

</div>

<div className="text-center">

<p className="text-xs text-gray-700 mb-1">
Lateral animal
</p>

<input
type="file"
className="w-full text-sm"
/>

</div>

<div className="text-center">

<p className="text-xs text-gray-700 mb-1">
Carnet responsable
</p>

<input
type="file"
className="w-full text-sm"
/>

</div>

</div>

<p className="text-xs text-gray-500 mt-2">
Formatos permitidos: JPG, PNG, WEBP — Máximo 5MB
</p>

</div>



{/* BOTON */}

<button
onClick={()=>setEnviando(true)}
className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition"
>

{enviando ? "Enviando..." : "Enviar Solicitud"}

</button>


</div>

</div>

)

}