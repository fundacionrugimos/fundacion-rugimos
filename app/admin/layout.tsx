"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLayout({
children,
}:{
children: React.ReactNode
}){

const router = useRouter()
const [autorizado,setAutorizado] = useState(false)

useEffect(()=>{

const logado =
localStorage.getItem("admin_logged") ||
localStorage.getItem("admin_logado")

if(!logado){

router.push("/admin/login")
return

}

setAutorizado(true)

},[router])

if(!autorizado){

return(
<div className="min-h-screen flex items-center justify-center text-gray-500">
Verificando acceso...
</div>
)

}

return <>{children}</>

}