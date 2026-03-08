"use client"

import { useRouter } from "next/navigation"

export default function AdminDashboard(){

const router = useRouter()

function logout(){

localStorage.removeItem("admin_id")
router.push("/admin/login")

}

return(

<div className="min-h-screen bg-[#0F6D6A] flex flex-col items-center justify-center p-8">

<button
onClick={logout}
className="absolute top-6 right-6 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
>
Cerrar sesión
</button>

<img
src="/logo.png"
className="w-40 mb-16"
/>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl">

{/* CLINICAS */}

<div
onClick={()=>router.push("/admin/clinicas")}
className="bg-white p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition"
>

<h2 className="text-xl font-bold text-[#0F6D6A] mb-2">
🏥 Clínicas
</h2>

<p className="text-gray-600">
Gestionar clínicas
</p>

</div>

{/* REGISTROS */}

<div
onClick={()=>router.push("/admin/registros")}
className="bg-white p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition"
>

<h2 className="text-xl font-bold text-[#0F6D6A] mb-2">
📋 Registros
</h2>

<p className="text-gray-600">
Animales registrados
</p>

</div>

{/* SOLICITUDES */}

<div
onClick={()=>router.push("/admin/solicitudes")}
className="bg-white p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition"
>

<h2 className="text-xl font-bold text-[#0F6D6A] mb-2">
📩 Solicitudes
</h2>

<p className="text-gray-600">
Solicitudes recibidas
</p>

</div>

{/* CUPOS */}

<div
onClick={()=>router.push("/admin/cupos")}
className="bg-white p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition"
>

<h2 className="text-xl font-bold text-[#0F6D6A] mb-2">
📊 Cupos
</h2>

<p className="text-gray-600">
Vagas por clínica
</p>

</div>

{/* PAGOS CLINICAS */}

<div
onClick={()=>router.push("/admin/pagos")}
className="bg-white p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition"
>

<h2 className="text-xl font-bold text-[#0F6D6A] mb-2">
💰 Pagos Clínicas
</h2>

<p className="text-gray-600">
Pagos semanales
</p>

</div>

</div>

</div>

)

}