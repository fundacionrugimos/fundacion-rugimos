"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Solicitud(){

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

async function generarCodigoRG() {

  const { data } = await supabase
    .from("solicitudes")
    .select("codigo")

  if (!data || data.length === 0) {
    return "RG1"
  }

  const codigos = data
    .map((r: any) => r.codigo)
    .filter((c: any) => /^RG\d+$/.test(c))

  if (codigos.length === 0) {
    return "RG1"
  }

  const numeros = codigos.map((c: any) => {
    return parseInt(c.replace("RG", ""))
  })

  const mayor = Math.max(...numeros)

  return "RG" + (mayor + 1)
}

const handleSubmit = async (e:any)=>{

e.preventDefault()
setLoading(true)

const formData = new FormData(e.currentTarget)

const fotoFrente = formData.get("foto_frente") as File
const fotoLado = formData.get("foto_lado") as File
const fotoCarnet = formData.get("foto_carnet") as File

const validar = (file:File)=>{
if(!file) return false
if(!ALLOWED_TYPES.includes(file.type)) return false
if(file.size > MAX_SIZE) return false
return true
}

if(!validar(fotoFrente)||!validar(fotoLado)||!validar(fotoCarnet)){
alert("Las imágenes deben ser JPG, PNG o WEBP y menores a 5MB.")
setLoading(false)
return
}

try{

const codigoGenerado = await generarCodigoRG()

const upload = async(file:File,name:string)=>{

const ext = file.name.split(".").pop()
const path = `${codigoGenerado}_${name}_${Date.now()}.${ext}`

const {error} = await supabase.storage
.from("solicitudes")
.upload(path,file)

if(error) throw error

const {data} = supabase.storage
.from("solicitudes")
.getPublicUrl(path)

return data.publicUrl

}

const nombre = formData.get("nombre")
const apellido1 = formData.get("apellido1")
const apellido2 = formData.get("apellido2")

const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`

const urlFrente = await upload(fotoFrente,"frente")
const urlLado = await upload(fotoLado,"lado")
const urlCarnet = await upload(fotoCarnet,"carnet")

const {error} = await supabase
.from("solicitudes")
.insert([{

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

}])

if(error) throw error

e.target.reset()
setEnviado(true)

}catch(err){

console.error(err)
alert("Ocurrió un error al enviar la solicitud.")

}

setLoading(false)

}

if(enviado){

return(

<div className="min-h-screen bg-[#0f6a63] flex items-center justify-center p-6">

<div className="bg-white rounded-2xl shadow-xl p-10 max-w-xl text-center">

<h2 className="text-3xl font-bold text-green-600 mb-6">
✅ Solicitud enviada correctamente
</h2>

<p className="text-gray-800 leading-relaxed text-lg">

Gracias por solicitar su cupo para la esterilización gratuita de la Fundación Rugimos.

<br/><br/>

Nos comunicaremos con usted en un plazo máximo de 24 horas al número de WhatsApp proporcionado.

<br/><br/>

Su ayuda es muy importante. El programa es gratuito, pero con cada aporte podremos esterilizar a más animales.

</p>

<div className="flex justify-center mt-6">

<img
src="/qr.png"
className="w-56 h-56"
/>

</div>

<p className="text-sm text-gray-500 mt-4">
Banco Ganadero S.A.
</p>

</div>

</div>

)

}

return(

<div className="min-h-screen bg-[#0f6a63] flex justify-center p-6">

<form onSubmit={handleSubmit} className="w-full max-w-4xl space-y-6 text-gray-800">

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold mb-4 text-gray-900">
Datos del Responsable
</h2>

<div className="grid md:grid-cols-3 gap-4 mb-4">

<input name="nombre" placeholder="Nombre" required className="border p-3 rounded-lg text-gray-800"/>

<input name="apellido1" placeholder="Primer apellido" required className="border p-3 rounded-lg text-gray-800"/>

<input name="apellido2" placeholder="Segundo apellido" required className="border p-3 rounded-lg text-gray-800"/>

</div>

<div className="grid md:grid-cols-2 gap-4">

{/* CI SOLO NUMEROS */}

<input
name="ci"
placeholder="CI"
required
inputMode="numeric"
pattern="[0-9]*"
onInput={(e:any)=>{e.target.value = e.target.value.replace(/\D/g,"")}}
className="border p-3 rounded-lg text-gray-800"
/>

{/* CELULAR +591 */}

<div className="flex">

<span className="flex items-center px-3 bg-gray-200 border border-r-0 rounded-l-lg text-gray-700">
+591
</span>

<input
name="celular"
placeholder="Número de celular"
required
maxLength={8}
inputMode="numeric"
pattern="[0-9]{8}"
onInput={(e:any)=>{e.target.value = e.target.value.replace(/\D/g,"").slice(0,8)}}
className="border p-3 rounded-r-lg w-full text-gray-800"
/>

</div>

<select name="ubicacion" required className="border p-3 rounded-lg md:col-span-2 text-gray-800">
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

<h2 className="text-xl font-bold mb-4 text-gray-900">
Datos del Animal
</h2>

<div className="grid md:grid-cols-2 gap-4">

<input name="nombre_animal" placeholder="Nombre del animal" required className="border p-3 rounded-lg text-gray-800"/>

<select name="especie" required className="border p-3 rounded-lg text-gray-800">
<option value="">Especie</option>
<option value="Perro">Perro</option>
<option value="Gato">Gato</option>
</select>

<select name="sexo" required className="border p-3 rounded-lg text-gray-800">
<option value="">Sexo</option>
<option value="Macho">Macho</option>
<option value="Hembra">Hembra</option>
</select>

<select name="edad" required className="border p-3 rounded-lg text-gray-800">
<option value="">Edad</option>
<option value="<6 meses">Menos de 6 meses</option>
<option value="6 meses a 1 año">6 meses a 1 año</option>
<option value="1 a 3 años">1 a 3 años</option>
<option value=">3 años">Más de 3 años</option>
</select>

{/* PESO AUTOMATICO KG */}

<input
name="peso"
placeholder="Peso (kg)"
required
inputMode="numeric"
onInput={(e:any)=>{e.target.value = e.target.value.replace(/\D/g,"")}}
onBlur={(e:any)=>{
if(e.target.value){
e.target.value = e.target.value+" kg"
}
}}
className="border p-3 rounded-lg text-gray-800"
/>

<select name="tipo_animal" required className="border p-3 rounded-lg text-gray-800">
<option value="">Animal</option>
<option value="Propio">Propio</option>
<option value="Calle">De la calle</option>
</select>

</div>

</div>

{/* RESTO DO CÓDIGO PERMANECE IGUAL */}

<button
type="submit"
disabled={loading}
className="w-full bg-[#f47c3c] text-white py-4 rounded-2xl font-bold text-lg"
>

{loading ? "Enviando..." : "Enviar Solicitud"}

</button>

</form>

</div>

)

}