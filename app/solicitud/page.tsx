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

<h2 className="text-2xl font-bold text-green-600 mb-4">
✅ Solicitud enviada correctamente
</h2>

<p className="text-gray-700 leading-relaxed">

Gracias por solicitar su cupo para la esterilización gratuita de la Fundación Rugimos.

<br/><br/>

Nos comunicaremos con usted en un plazo máximo de 24 horas al número de WhatsApp proporcionado.

</p>

<div className="flex justify-center mt-6">

<img
src="/qr.png"
className="w-48 h-48"
/>

</div>

</div>

</div>

)

}

return(

<div className="min-h-screen bg-[#0f6a63] flex justify-center p-6">

<form onSubmit={handleSubmit} className="w-full max-w-4xl space-y-6">

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold mb-4">
Datos del Responsable
</h2>

<div className="grid md:grid-cols-3 gap-4 mb-4">

<input name="nombre" placeholder="Nombre" required className="border p-3 rounded-lg"/>

<input name="apellido1" placeholder="Primer apellido" required className="border p-3 rounded-lg"/>

<input name="apellido2" placeholder="Segundo apellido" required className="border p-3 rounded-lg"/>

</div>

<div className="grid md:grid-cols-2 gap-4">

<input name="ci" placeholder="CI" required className="border p-3 rounded-lg"/>

<input name="celular" placeholder="Celular" required className="border p-3 rounded-lg"/>

<select name="ubicacion" required className="border p-3 rounded-lg md:col-span-2">
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

<h2 className="text-xl font-bold mb-4">
Datos del Animal
</h2>

<div className="grid md:grid-cols-2 gap-4">

<input name="nombre_animal" placeholder="Nombre del animal" required className="border p-3 rounded-lg"/>

<select name="especie" required className="border p-3 rounded-lg">
<option value="">Especie</option>
<option value="Perro">Perro</option>
<option value="Gato">Gato</option>
</select>

<select name="sexo" required className="border p-3 rounded-lg">
<option value="">Sexo</option>
<option value="Macho">Macho</option>
<option value="Hembra">Hembra</option>
</select>

<select name="edad" required className="border p-3 rounded-lg">
<option value="">Edad</option>
<option value="<6 meses">Menos de 6 meses</option>
<option value="6 meses a 1 año">6 meses a 1 año</option>
<option value="1 a 3 años">1 a 3 años</option>
<option value=">3 años">Más de 3 años</option>
</select>

<input name="peso" placeholder="Peso" required className="border p-3 rounded-lg"/>

<select name="tipo_animal" required className="border p-3 rounded-lg">
<option value="">Animal</option>
<option value="Propio">Propio</option>
<option value="Calle">De la calle</option>
</select>

</div>

</div>

<div className="bg-white rounded-2xl shadow-lg p-6">

<h2 className="text-xl font-bold mb-4">
Fotos del Registro
</h2>

<div className="grid md:grid-cols-3 gap-4">

<label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">

{previewFrente ?
<img src={previewFrente} className="h-24 object-cover rounded"/>
:
<span>Frente del animal</span>
}

<input type="file" name="foto_frente" className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewFrente)}
required
/>

</label>

<label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">

{previewLado ?
<img src={previewLado} className="h-24 object-cover rounded"/>
:
<span>Lateral del animal</span>
}

<input type="file" name="foto_lado" className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewLado)}
required
/>

</label>

<label className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer">

{previewCarnet ?
<img src={previewCarnet} className="h-24 object-cover rounded"/>
:
<span>Carnet del responsable</span>
}

<input type="file" name="foto_carnet" className="hidden"
onChange={(e:any)=>handlePreview(e.target.files[0],setPreviewCarnet)}
required
/>

</label>

</div>

</div>

<button
type="submit"
disabled={loading}
className="w-full bg-[#f47c3c] text-white py-4 rounded-2xl font-bold"
>

{loading ? "Enviando..." : "Enviar Solicitud"}

</button>

</form>

</div>

)

}