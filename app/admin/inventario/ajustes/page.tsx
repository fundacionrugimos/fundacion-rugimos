import { Suspense } from "react"
import AjustesClient from "./AjustesClient"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F6D6A] flex items-center justify-center text-white text-xl">
          Cargando ajustes...
        </div>
      }
    >
      <AjustesClient />
    </Suspense>
  )
}