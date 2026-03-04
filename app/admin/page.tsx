"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function AdminDashboard() {

const router = useRouter()

const [pendentes,setPendentes] = useState(0)

useEffect(()=>{

const admin = localStorage.getItem("admin_logado")

if(!admin){
router.push("/admin/login")
return
}

carregarPendentes()

},[])

const carregarPendentes = async () => {

const { data } = await supabase
.from("solicitudes")
.select("id")
.eq("estado","Pendiente")

if(data) setPendentes(data.length)

}

const cerrarSesion = () => {

localStorage.removeItem("admin_logado")

router.push("/admin/login")

}

return(

<div className="min-h-screen bg-[#02686A] flex flex-col items-center">

<div className="w-full flex justify-end p-6">
<button
onClick={cerrarSesion}
className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90"
>
Cerrar sesión
</button>
</div>

<div className="mt-10 mb-20 flex justify-center">
<img src="/logo.png" className="h-40"/>
</div>

<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl px-8">

<Link href="/admin/clinicas">
<div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 cursor-pointer">
<h2 className="text-xl font-bold text-[#02686A]">🏥 Clínicas</h2>
<p className="text-gray-600 mt-2">Gestionar clínicas</p>
</div>
</Link>

<Link href="/admin/registros">
<div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 cursor-pointer">
<h2 className="text-xl font-bold text-[#02686A]">📋 Registros</h2>
<p className="text-gray-600 mt-2">Animales registrados</p>
</div>
</Link>

<Link href="/admin/solicitudes">
<div className="bg-white rounded-2xl shadow-xl p-8 hover:scale-105 cursor-pointer">

<h2 className="text-xl font-bold text-[#02686A]">
📨 Solicitudes
</h2>

{pendentes > 0 ? (
<span className="inline-block mt-4 bg-[#F47C3C] text-white px-4 py-2 rounded-full">
Pendientes: {pendentes}
</span>
) : (
<span className="inline-block mt-4 bg-green-600 text-white px-4 py-2 rounded-full">
Sin pendientes
</span>
)}

</div>
</Link>

</div>

</div>

)

}