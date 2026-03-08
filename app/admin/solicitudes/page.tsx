"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import QRCode from "qrcode"

type Solicitud = {
id: string
codigo: string
nombre_completo: string
celular: string
ubicacion: string
nombre_animal: string
especie: string
sexo: string
edad: string
peso: string
tipo_animal: string
estado: string
ci: string | null
created_at: string
foto_frente: string | null
foto_lado: string | null
foto_carnet: string | null
}

export default function AdminSolicitudes(){

const [solicitudes,setSolicitudes] = useState<Solicitud[]>([])
const [loadingId,setLoadingId] = useState<string | null>(null)
const [fotoSeleccionada,setFotoSeleccionada] = useState<string | null>(null)
const [whatsappData,setWhatsappData] = useState<{telefono:string,mensaje:string}|null>(null)

useEffect(()=>{
fetchSolicitudes()
},[])

const fetchSolicitudes = async()=>{

const {data,error} = await supabase
.from("solicitudes")
.select("*")
.eq("estado","Pendiente")
.order("created_at",{ascending:false})

if(error){
console.error(error)
return
}

if(data) setSolicitudes(data)

}

const enviarWhatsapp = ()=>{

if(!whatsappData) return

const telefono = whatsappData.telefono.replace(/\D/g,"")
const mensaje = encodeURIComponent(whatsappData.mensaje)

const url = "https://wa.me/591"+telefono+"?text="+mensaje

window.open(url,"_blank")

}

async function generarQR(codigo:string){

const url = `https://fundacion-rugimos.vercel.app/paciente/${codigo}`

const qr = await QRCode.toDataURL(url)

return qr

}

function calcularDistancia(lat1:number,lon1:number,lat2:number,lon2:number){

const R = 6371

const dLat = (lat2-lat1) * Math.PI/180
const dLon = (lon2-lon1) * Math.PI/180

const a =
Math.sin(dLat/2)*Math.sin(dLat/2)+
Math.cos(lat1*Math.PI/180)*
Math.cos(lat2*Math.PI/180)*
Math.sin(dLon/2)*
Math.sin(dLon/2)

const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

return R*c

}

const generarCodigoRG = async()=>{

const {data} = await supabase
.from("registros")
.select("codigo")

if(!data || data.length === 0){
return "RG1"
}

const codigosRG = data
.map(r => r.codigo)
.filter(c => c && c.startsWith("RG"))

if(codigosRG.length === 0){
return "RG1"
}

const numeros = codigosRG.map(c=>{
const n = c.replace("RG","")
return parseInt(n)
}).filter(n=>!isNaN(n))

const mayor = Math.max(...numeros)

return "RG"+(mayor+1)

}

const cambiarEstado = async(solicitud:Solicitud,nuevoEstado:string)=>{

setLoadingId(solicitud.id)

const {error:updateError} = await supabase
.from("solicitudes")
.update({estado:nuevoEstado})
.eq("id",solicitud.id)

if(updateError){
console.error(updateError)
setLoadingId(null)
return
}

if(nuevoEstado === "Aprobado"){

const codigoGenerado = solicitud.codigo

const {data:clinicas,error:clinicaError} = await supabase
.from("clinicas")
.select("*")
.eq("ativa",true)

if(clinicaError || !clinicas){
alert("No se encontraron clínicas activas")
setLoadingId(null)
return
}

const zonas:any = {

"Norte": {lat:-17.73,lng:-63.18},
"Sur": {lat:-17.85,lng:-63.18},
"Este": {lat:-17.78,lng:-63.15},
"Oeste": {lat:-17.78,lng:-63.21},
"Centro": {lat:-17.78,lng:-63.18},
"Centro-Norte": {lat:-17.74,lng:-63.18},
"Centro-Sur": {lat:-17.82,lng:-63.18},
"Plan 3000": {lat:-17.85,lng:-63.15},
"Pampa de la Isla": {lat:-17.77,lng:-63.13}

}

const zonaCoords = zonas[solicitud.ubicacion]

if(!zonaCoords){
alert("Zona no reconocida")
setLoadingId(null)
return
}

clinicas.sort((a:any,b:any)=>{

const distA = calcularDistancia(zonaCoords.lat,zonaCoords.lng,a.lat,a.lng)
const distB = calcularDistancia(zonaCoords.lat,zonaCoords.lng,b.lat,b.lng)

return distA - distB

})

let clinicaData:any=null
let horarioId:any=null

for(const clinica of clinicas){

if(solicitud.especie==="Perro" && !clinica.acepta_perros) continue
if(solicitud.especie==="Gato" && !clinica.acepta_gatos) continue

if(solicitud.sexo==="Macho" && !clinica.acepta_machos) continue
if(solicitud.sexo==="Hembra" && !clinica.acepta_hembras) continue

if(solicitud.tipo_animal?.toLowerCase().includes("calle") && !clinica.acepta_calle) continue
if(solicitud.tipo_animal==="Propio" && !clinica.acepta_propio) continue

const {data:horarioDisponible,error:reservaError}=await supabase.rpc(
"reservar_vaga",
{p_clinica_id:clinica.id}
)

if(!reservaError && horarioDisponible){
clinicaData=clinica
horarioId=horarioDisponible
break
}

}

if(!clinicaData){
alert("Todos los cupos están ocupados.")
setLoadingId(null)
return
}

const { data: horario } = await supabase
.from("horarios_clinica")
.select("hora")
.eq("id", horarioId)
.single()

const horaAsignada = horario?.hora

const qr = await generarQR(codigoGenerado)

await supabase.from("registros").insert([{

codigo:codigoGenerado,
nombre_responsable:solicitud.nombre_completo,
telefono:solicitud.celular,
ci:solicitud.ci,
nombre_animal:solicitud.nombre_animal,
especie:solicitud.especie,
sexo:solicitud.sexo,
edad:solicitud.edad,
peso:solicitud.peso,
tipo_animal:solicitud.tipo_animal,
zona:solicitud.ubicacion,
estado:"Pendiente",
clinica_id:clinicaData.id,
horario_id:horarioId,
hora:horaAsignada,
foto_frente:solicitud.foto_frente,
foto_lado:solicitud.foto_lado,
foto_carnet:solicitud.foto_carnet,
qr_code:qr

}])

/* LINK CORRIGIDO */

const linkQR = "https://fundacion-rugimos.vercel.app/paciente/"+codigoGenerado

const mensaje =
"🐾 FUNDACIÓN RUGIMOS 🐾\n\n"+
"Tu solicitud fue APROBADA ✅\n\n"+
"Código Rugimos:\n"+codigoGenerado+"\n\n"+
"Mascota:\n"+solicitud.nombre_animal+" ("+solicitud.especie+")\n\n"+
"Clínica:\n"+clinicaData.nome+"\n\n"+
"Hora de llegada:\n"+horaAsignada+"\n\n"+
"INSTRUCCIONES\n\n"+
"• Ayuno comida: 8 horas\n"+
"• Ayuno agua: 4 horas\n"+
"• Llevar manta\n"+
"• Llegar 15 min antes\n\n"+
"📲 Presenta tu QR en la clínica:\n"+
linkQR+"\n\n"+
"Gracias por apoyar la esterilización responsable 💚"

setWhatsappData({
telefono:solicitud.celular,
mensaje:mensaje
})

}

await fetchSolicitudes()
setLoadingId(null)

}

return(

<div className="min-h-screen bg-gray-100 p-6">

<h1 className="text-3xl font-bold mb-8 text-gray-900">
Solicitudes Recibidas
</h1>

{whatsappData && (

<div className="bg-green-100 border border-green-300 p-4 rounded-lg mb-6 flex justify-between items-center">

<p className="text-green-900 font-semibold">
Registro aprobado. Enviar confirmación por WhatsApp.
</p>

<button
onClick={enviarWhatsapp}
className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
>
Enviar WhatsApp
</button>

</div>

)}

<div className="flex flex-col items-center gap-8">

{solicitudes.map((s)=>(

<div key={s.id}
className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 max-w-xl w-full">

<p className="text-xs text-gray-500 mb-2 font-mono">{s.codigo}</p>

<h2 className="text-xl font-semibold text-gray-900 mb-3">
{s.nombre_completo}
</h2>

<div className="text-sm text-gray-700 space-y-1">

<p><strong>CI:</strong> {s.ci||"No especificado"}</p>
<p><strong>Celular:</strong> {s.celular}</p>
<p><strong>Zona:</strong> {s.ubicacion}</p>
<p><strong>Animal:</strong> {s.nombre_animal} ({s.especie})</p>
<p><strong>Sexo:</strong> {s.sexo}</p>
<p><strong>Edad:</strong> {s.edad}</p>
<p><strong>Peso:</strong> {s.peso}</p>

</div>

<div className="flex gap-3 mt-4">

{s.foto_frente &&(
<img src={s.foto_frente}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_frente)}
/>
)}

{s.foto_lado &&(
<img src={s.foto_lado}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_lado)}
/>
)}

{s.foto_carnet &&(
<img src={s.foto_carnet}
className="w-24 h-24 object-cover rounded-lg border cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_carnet)}
/>
)}

</div>

<div className="flex gap-3 mt-6">

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Aprobado")}
className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">

{loadingId===s.id?"Procesando":"Aprobar"}

</button>

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Rechazado")}
className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">

Rechazar

</button>

</div>

</div>

))}

</div>

{fotoSeleccionada && (

<div
className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
onClick={()=>setFotoSeleccionada(null)}
>

<img
src={fotoSeleccionada}
className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-xl"
/>

</div>

)}

</div>

)

}