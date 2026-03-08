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

const logado = localStorage.getItem("admin_logged")
const loginTime = localStorage.getItem("admin_login_time")

if(!logado || !loginTime){

router.push("/admin/login")
return

}

const agora = Date.now()
const tempoLogin = parseInt(loginTime)

const expiracao = 30 * 60 * 1000

if(agora - tempoLogin > expiracao){

localStorage.removeItem("admin_logged")
localStorage.removeItem("admin_login_time")

router.push("/admin/login")
return

}

setAutorizado(true)

},[router])

if(!autorizado){

return (
<div className="min-h-screen flex items-center justify-center">
Carregando...
</div>
)

}

return <>{children}</>

}