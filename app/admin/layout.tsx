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

const [checked,setChecked] = useState(false)

useEffect(()=>{

// se estiver na página de login não verificar
if(pathname === "/admin/login"){
setChecked(true)
return
}

const logado =
localStorage.getItem("admin_logged") ||
localStorage.getItem("admin_logado")

if(!logado){

router.push("/admin/login")
return

}

setChecked(true)

},[pathname,router])

if(!checked){

return(
<div className="min-h-screen flex items-center justify-center text-gray-500">
Verificando acceso...
</div>
)

}

return <>{children}</>

}