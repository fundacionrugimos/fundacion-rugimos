"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function AdminLayout({
children,
}:{
children: React.ReactNode
}){

const router = useRouter()
const pathname = usePathname()

const [loading,setLoading] = useState(true)

useEffect(()=>{

// não proteger página de login
if(pathname === "/admin/login"){
setLoading(false)
return
}

const logado =
localStorage.getItem("admin_logged") ||
localStorage.getItem("admin_logado")

if(!logado){
router.replace("/admin/login")
return
}

setLoading(false)

},[pathname,router])

if(loading){

return(
<div className="min-h-screen flex items-center justify-center text-gray-500">
Verificando acceso...
</div>
)

}

return <>{children}</>

}