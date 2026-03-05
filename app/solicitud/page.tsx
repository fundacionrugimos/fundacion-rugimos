"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Solicitud() {

const [loading,setLoading] = useState(false)
const [enviado,setEnviado] = useState(false)

const [previewFrente,setPreviewFrente] = useState<string | null>(null)
const [previewLado,setPreviewLado] = useState<string | null>(null)
const [previewCarnet,setPreviewCarnet] = useState<string | null>(null)

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg","image/png","image/webp"]

const handlePreview = (file:File,setPreview:any)=>{

if(!file) return

const url = URL.createObjectURL(file)
setPreview(url)

}

const handleSubmit = async (e:React.FormEvent<HTMLFormElement>)=>{

e.preventDefault()
setLoading(true)

const form = e.currentTarget
const formData = new FormData(form)

const fotoFrente = formData.get("foto_frente") as File
const fotoLado = formData.get("foto_lado") as File
const fotoCarnet = formData.get("foto_carnet") as File

const validarImagen = (file:File)=>{

if(!file) return false
if(!ALLOWED_TYPES.includes(file.type)) return false
if(file.size > MAX_SIZE) return false

return true

}

if(
!validarImagen(fotoFrente) ||
!validarImagen(fotoLado) ||
!validarImagen(fotoCarnet)
){

alert("Las imágenes deben ser JPG, PNG o WEBP y menores a 5MB.")
setLoading(false)
return

}

const ano = new Date().getFullYear()
const numero = Math.floor(100000 + Math.random()*900000)
const codigoGenerado = `RUG-${ano}-${numero}`

const upload = async(file:File,name:string)=>{

const fileExt = file.name.split(".").pop()
const filePath = `${codigoGenerado}_${name}.${fileExt}`

const { error } = await supabase.storage
.from("solicitudes")
.upload(filePath,file)

if(error) throw error

const { data } = supabase.storage
.from("solicitudes")
.getPublicUrl(filePath)

return data.publicUrl

}

try{

const nombre = formData.get("nombre")
const apellido1 = formData.get("apellido1")
const apellido2 = formData.get("apellido2")

const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`

const urlFrente = await upload(fotoFrente,"frente")
const urlLado = await upload(fotoLado,"lado")
const urlCarnet = await upload(fotoCarnet,"carnet")

const { error } = await supabase.from("solicitudes").insert([

{

codigo:codigoGenerado,
nombre_completo:nombreCompleto,
ci:formData.get("ci"),
celular:formData.get("celular"),
ubicacion:formData.get("ubicacion"),
nombre_animal:formData.get("nombre_animal"),
especie:formData.get("especie"),
sexo:formData.get("sexo"),
edad:formData.get("edad"),
peso:formData.get("peso"),
tipo_animal:formData.get("tipo_animal"),
foto_frente:urlFrente,
foto_lado:urlLado,
foto_carnet:urlCarnet,
estado:"Pendiente"

}

])

if(error) throw error

form.reset()
setEnviado(true)

}catch(error){

console.error(error)
alert("Ocurrió un error al enviar la solicitud.")

}

setLoading(false)

}

if(enviado){

return(

<div className="min-h-screen bg-[#0f6a63] flex items-center justify-center p-6">

<div className="bg-white rounded-2xl shadow-xl p-10 max-w-xl text-center">

<h2 className="text-2xl font-bold text-green-600 mb-4">
✅ Solicitud enviada correctamente
</h2>

<p className="text-gray-700 leading-relaxed">

Gracias por solicitar su cupo para la esterilización gratuita de la Fundación Rugimos.

<br/><br/>

Nos comunicaremos con usted en un plazo máximo de 24 horas al número de WhatsApp proporcionado.

</p>

<p className="text-gray-700 mt-6 font-medium">

Su ayuda es muy importante. El programa es gratuito, pero con cada aporte podremos esterilizar a más animales.

</p>

<div className="flex justify-center mt-6">

<img
src="/qr.png"
alt="QR Donación Fundación Rugimos"
className="w-48 h-48"
/>

</div>

</div>

</div>

)

}

return(

<div className="min-h-screen bg-[#0f6a63] flex justify-center p-6">

<form onSubmit={handleSubmit} className="w-full max-w-4xl space-y-6 mx-auto">

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-gray-900 mb-4">
👤 Datos del Responsable
</h2>

<div className="grid md:grid-cols-3 gap-4 mb-4">

<input name="nombre" placeholder="Nombre" required className="border border-gray-300 p-3 rounded-lg text-gray-800"/>

<input name="apellido1" placeholder="Primer apellido" required className="border border-gray-300 p-3 rounded-lg text-gray-800"/>

<input name="apellido2" placeholder="Segundo apellido" required className="border border-gray-300 p-3 rounded-lg text-gray-800"/>

</div>

<div className="grid md:grid-cols-2 gap-4">

<input
name="ci"
placeholder="CI"
required
inputMode="numeric"
onInput={(e:any)=>e.target.value=e.target.value.replace(/\D/g,'')}
className="border border-gray-300 p-3 rounded-lg text-gray-800"
/>

<div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">

<span className="bg-gray-100 px-3 text-gray-700 font-medium">
+591
</span>

<input
name="celular"
placeholder="71234567"
required
maxLength={8}
inputMode="numeric"
onInput={(e:any)=>{
e.target.value=e.target.value.replace(/\D/g,'').slice(0,8)
}}
className="flex-1 p-3 outline-none"
/>

</div>

<select name="ubicacion" required className="border border-gray-300 p-3 rounded-lg text-gray-800 md:col-span-2">

<option value="">Seleccionar zona</option>
<option value="Norte">Norte</option>
<option value="Centro-Norte">Centro-Norte</option>
<option value="Sur">Sur</option>
<option value="Oeste">Oeste</option>
<option value="Este">Este</option>

</select>

</div>

</div>

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-gray-900 mb-4">
🐾 Datos del Animal
</h2>

<div className="grid md:grid-cols-2 gap-4">

<input
name="nombre_animal"
placeholder="Nombre del animal"
required
className="border border-gray-300 p-3 rounded-lg text-gray-800"
/>

<select name="especie" required className="border border-gray-300 p-3 rounded-lg text-gray-800">
<option value="">Especie</option>
<option value="Perro">Perro</option>
<option value="Gato">Gato</option>
</select>

<select name="sexo" required className="border border-gray-300 p-3 rounded-lg text-gray-800">
<option value="">Sexo</option>
<option value="Macho">Macho</option>
<option value="Hembra">Hembra</option>
</select>

<select name="edad" required className="border border-gray-300 p-3 rounded-lg text-gray-800">
<option value="">Edad</option>
<option value="<6 meses">&lt; 6 meses</option>
<option value="6 meses a 1 año">6 meses a 1 año</option>
<option value="1 a 3 años">1 a 3 años</option>
<option value=">3 años">&gt; 3 años</option>
</select>

<input
name="peso"
placeholder="Peso"
required
inputMode="numeric"
onInput={(e:any)=>{
let v=e.target.value.replace(/\D/g,'')
e.target.value=v? v+" kg":""
}}
className="border border-gray-300 p-3 rounded-lg text-gray-800"
/>

<select name="tipo_animal" required className="border border-gray-300 p-3 rounded-lg text-gray-800">
<option value="">Animal</option>
<option value="Propio">Propio</option>
<option value="Calle">De la calle</option>
</select>

</div>

</div>

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold text-gray-900 mb-4">
📸 Subir Fotos (Obligatorio)
</h2>

<div className="grid md:grid-cols-3 gap-4">

<label htmlFor="foto_frente" className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer">

{previewFrente ?

<img src={previewFrente} className="h-24 object-cover rounded-md"/>

:

<span className="text-sm text-gray-500">Frente del animal</span>

}

<input
id="foto_frente"
type="file"
name="foto_frente"
accept="image/jpeg,image/png,image/webp"
required
className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewFrente)}
/>

</label>

<label htmlFor="foto_lado" className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer">

{previewLado ?

<img src={previewLado} className="h-24 object-cover rounded-md"/>

:

<span className="text-sm text-gray-500">Lateral del animal</span>

}

<input
id="foto_lado"
type="file"
name="foto_lado"
accept="image/jpeg,image/png,image/webp"
required
className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewLado)}
/>

</label>

<label htmlFor="foto_carnet" className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer">

{previewCarnet ?

<img src={previewCarnet} className="h-24 object-cover rounded-md"/>

:

<span className="text-sm text-gray-500">Carnet del responsable</span>

}

<input
id="foto_carnet"
type="file"
name="foto_carnet"
accept="image/jpeg,image/png,image/webp"
required
className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewCarnet)}
/>

</label>

</div>

<p className="text-sm text-gray-500 mt-2">
Formatos permitidos: JPG, PNG, WEBP — Máximo 5MB cada imagen.
</p>

</div>

<button
type="submit"
disabled={loading}
className="w-full bg-[#f47c3c] text-white py-4 rounded-2xl font-bold hover:opacity-90 transition"

>

{loading ? "Enviando..." : "Enviar Solicitud"}

</button>

</form>

</div>

)

}
