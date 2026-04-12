import { Suspense } from "react"
import PrintInventarioClient from "./PrintInventarioClient"

type Props = {
  searchParams: Promise<{
    almacen?: string | string[]
  }>
}

export default async function PrintInventarioPage({ searchParams }: Props) {
  const params = await searchParams
  const almacenRaw = params?.almacen
  const almacenId = Array.isArray(almacenRaw) ? almacenRaw[0] : almacenRaw || ""

  return (
    <Suspense fallback={<div className="p-8">Cargando checklist...</div>}>
      <PrintInventarioClient almacenId={almacenId} />
    </Suspense>
  )
}