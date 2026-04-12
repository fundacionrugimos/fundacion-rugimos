"use client"

import Link from "next/link"

export default function ExportacionesPage() {
  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/contabilidad"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver a contabilidad
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 border border-white/60">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">
              Exportaciones
            </h1>
            <p className="text-gray-500 mt-2 max-w-3xl">
              Centro de exportación de reportes, Excel, resúmenes mensuales
              y documentos financieros para control interno.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-pink-100 bg-pink-50 p-5">
              <p className="text-sm text-gray-500">Formato</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">Excel</p>
            </div>

            <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 p-5">
              <p className="text-sm text-gray-500">Uso</p>
              <p className="text-2xl font-bold text-[#0F6D6A] mt-1">Mensual</p>
            </div>

            <div className="rounded-2xl border border-[#F47C3C]/10 bg-[#F47C3C]/10 p-5">
              <p className="text-sm text-gray-500">Estado</p>
              <p className="text-2xl font-bold text-[#F47C3C] mt-1">Listo para crecer</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
            <h2 className="text-xl font-bold text-[#0F6D6A] mb-3">
              Qué irá aquí
            </h2>
            <p className="text-gray-600 leading-7">
              Aquí se reunirán las exportaciones del módulo financiero:
              resumen general, estado de resultados, donaciones, gastos operativos
              y reportes mensuales en formatos listos para la contadora.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}