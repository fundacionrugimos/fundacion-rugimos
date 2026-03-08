"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function AdminLayout({
children,
}:{
children: React.ReactNode
}){

const router = useRouter()
const pathname = usePathname()

useEffect(()=>{

// permitir página de login
if(pathname === "/admin/login") return

const logado =
localStorage.getItem("admin_logged") ||
localStorage.getItem("admin_logado")

if(!logado){

router.replace("/admin/login")

}

},[])

return <>{children}</>

}