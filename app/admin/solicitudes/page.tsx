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

const [busqueda,setBusqueda] = useState("")
const [zonaFiltro,setZonaFiltro] = useState("Todos")

const [pagina,setPagina] = useState(1)
const porPagina = 50

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

const enviarWhatsapp = (telefono:string,mensaje:string)=>{

const tel = telefono.replace(/\D/g,"")
const msg = encodeURIComponent(mensaje)

const url = "https://wa.me/591"+tel+"?text="+msg

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

const linkQR = "https://fundacion-rugimos.vercel.app/paciente/"+codigoGenerado
const linkMapa = "https://www.google.com/maps?q="+clinicaData.lat+","+clinicaData.lng

const mensaje =
"🐾 FUNDACIÓN RUGIMOS 🐾\n\n"+
"Tu solicitud fue APROBADA ✅\n\n"+
"Código Rugimos:\n"+codigoGenerado+"\n\n"+
"Mascota:\n"+solicitud.nombre_animal+" ("+solicitud.especie+")\n\n"+
"Clínica:\n"+clinicaData.nome+"\n"+
"Ubicación:\n"+clinicaData.endereco+"\n\n"+
"📍 Ver en Google Maps:\n"+linkMapa+"\n\n"+
"Hora de llegada:\n"+horaAsignada+"\n\n"+
"INSTRUCCIONES\n\n"+
"• Ayuno comida: 8 horas\n"+
"• Ayuno agua: 4 horas\n"+
"• Llevar manta\n"+
"• Llegar 15 min antes\n"+
"• En caso de perra hembra se solicita Hemograma + Urea + Creatinina\n\n"+
"📲 Presenta tu QR en la clínica:\n"+
linkQR+"\n\n"+
"Gracias por apoyar la esterilización responsable 💚"

enviarWhatsapp(solicitud.celular,mensaje)

}

await fetchSolicitudes()
setLoadingId(null)

}

/* FILTROS */

const filtradas = solicitudes.filter(s=>{

const nombre = s.nombre_completo.toLowerCase()
const buscar = busqueda.toLowerCase()

const coincideNombre = nombre.includes(buscar)

const coincideZona =
zonaFiltro==="Todos" ||
s.ubicacion===zonaFiltro

return coincideNombre && coincideZona

})

/* PAGINACIÓN */

const inicio = (pagina-1)*porPagina
const fin = inicio+porPagina

const visibles = filtradas.slice(inicio,fin)

const totalPaginas = Math.ceil(filtradas.length/porPagina)

return(

<div className="min-h-screen bg-gray-100 p-6">

<h1 className="text-3xl font-bold mb-6 text-gray-900">
Solicitudes Recibidas
</h1>

{/* FILTROS */}

<div className="flex gap-4 mb-6 flex-wrap">

<input
placeholder="Buscar por nombre..."
value={busqueda}
onChange={e=>setBusqueda(e.target.value)}
className="border p-2 rounded-lg"
/>

<select
value={zonaFiltro}
onChange={e=>setZonaFiltro(e.target.value)}
className="border p-2 rounded-lg">

<option value="Todos">Todas las zonas</option>
<option>Norte</option>
<option>Sur</option>
<option>Este</option>
<option>Oeste</option>
<option>Centro</option>
<option>Plan 3000</option>
<option>Pampa de la Isla</option>

</select>

</div>

{/* GRID */}

<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">

{visibles.map((s)=>(

<div key={s.id}
className="bg-white rounded-xl shadow-md p-4 border border-gray-200">

<p className="text-xs text-gray-500 mb-1 font-mono">{s.codigo}</p>

<h2 className="text-sm font-semibold text-gray-900 mb-2">
{s.nombre_completo}
</h2>

<div className="text-xs text-gray-700 space-y-1">

<p><strong>Zona:</strong> {s.ubicacion}</p>
<p><strong>Animal:</strong> {s.nombre_animal}</p>
<p><strong>Sexo:</strong> {s.sexo}</p>

</div>

<div className="flex gap-2 mt-3">

{s.foto_frente &&(
<img src={s.foto_frente}
className="w-16 h-16 object-cover rounded cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_frente)}
/>
)}

{s.foto_lado &&(
<img src={s.foto_lado}
className="w-16 h-16 object-cover rounded cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_lado)}
/>
)}

{s.foto_carnet &&(
<img src={s.foto_carnet}
className="w-16 h-16 object-cover rounded cursor-pointer"
onClick={()=>setFotoSeleccionada(s.foto_carnet)}
/>
)}

</div>

<div className="flex gap-2 mt-4">

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Aprobado")}
className="flex-1 bg-green-600 text-white py-2 rounded text-xs">

Aprobar

</button>

<button
disabled={loadingId===s.id}
onClick={()=>cambiarEstado(s,"Rechazado")}
className="flex-1 bg-red-600 text-white py-2 rounded text-xs">

Rechazar

</button>

</div>

</div>

))}

</div>

{/* PAGINACIÓN */}

<div className="flex justify-center gap-4 mt-10">

<button
disabled={pagina===1}
onClick={()=>setPagina(p=>p-1)}
className="px-4 py-2 bg-gray-300 rounded">

Anterior

</button>

<p className="font-semibold">
Página {pagina} de {totalPaginas}
</p>

<button
disabled={pagina===totalPaginas}
onClick={()=>setPagina(p=>p+1)}
className="px-4 py-2 bg-gray-300 rounded">

Siguiente

</button>

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