"use client"

import Link from "next/link"

const cards = [
  {
    title: "Cuentas por pagar, inventario",
    description: "Vista general de ingresos, egresos, pagos, pendientes e impacto total.",
    href: "/admin/contabilidad/resumen",
    badge: "Principal",
    color: "from-[#0F6D6A] to-[#14919B]",
  },
  {
    title: "Donaciones naturales",
    description: "Registro mensual consolidado de ingresos por QR y donaciones de personas naturales.",
    href: "/admin/contabilidad/donaciones-naturales",
    badge: "Mensual",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Donaciones jurídicas",
    description: "Control detallado de aportes de empresas, ya sea en dinero o en especie.",
    href: "/admin/contabilidad/donaciones-juridicas",
    badge: "Empresas",
    color: "from-sky-500 to-sky-600",
  },
  {
    title: "Pagos clínicas",
    description: "Control de pagos semanales, períodos liquidados, detalle por clínica y soporte financiero.",
    href: "/admin/pagos",
    badge: "Financiero",
    color: "from-yellow-500 to-amber-500",
  },
  {
    title: "Carreras - Delivery",
    description: "Gestión financiera del delivery: tarifas por clínica, carreras retroactivas, ajustes manuales y control de pagos.",
    href: "/admin/contabilidad/delivery",
    badge: "Delivery",
    color: "from-cyan-500 to-teal-500",
  },
  {
    title: "Gastos operativos",
    description: "Alquiler, luz, agua, sueldos, envíos, limpieza y otros gastos administrativos.",
    href: "/admin/contabilidad/gastos-operativos",
    badge: "Operativo",
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Estado de resultados",
    description: "Vista más contable y profesional para análisis mensual y cierre financiero.",
    href: "/admin/contabilidad/estado-resultados",
    badge: "Contadora",
    color: "from-violet-500 to-violet-600",
  },
  {
    title: "Informes",
    description: "Excel, reportes mensuales y documentos para control interno y presentación.",
    href: "/admin/contabilidad/exportaciones",
    badge: "Reportes",
    color: "from-pink-500 to-rose-500",
  },
]

export default function ContabilidadHomePage() {
  return (
    <div className="min-h-screen bg-[#0F6D6A] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="bg-white text-[#0F6D6A] px-4 py-2 rounded-xl font-bold shadow hover:bg-gray-100 transition"
          >
            Volver al admin
          </Link>

          <Link
            href="/admin/contabilidad/resumen"
            className="bg-[#F47C3C] text-white px-4 py-2 rounded-xl font-bold shadow hover:bg-[#db6d31] transition"
          >
            Ir al resumen actual
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 border border-white/60">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F6D6A]">
                Dashboard de Contabilidad
              </h1>
              <p className="text-gray-500 mt-2 max-w-3xl">
                Área centralizada para todo lo contable de la fundación:
                ingresos, donaciones, gastos operativos, pagos a clínicas,
                delivery, estado de resultados y exportaciones.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-full lg:min-w-[420px]">
              <div className="rounded-2xl border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 px-4 py-3">
                <p className="text-xs text-gray-500">Módulo</p>
                <p className="text-lg font-bold text-[#0F6D6A]">Contabilidad</p>
              </div>

              <div className="rounded-2xl border border-[#F47C3C]/10 bg-[#F47C3C]/10 px-4 py-3">
                <p className="text-xs text-gray-500">Enfoque</p>
                <p className="text-lg font-bold text-[#F47C3C]">Financiero</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs text-gray-500">Estado</p>
                <p className="text-lg font-bold text-emerald-600">Activo</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[1.75rem] border border-gray-200 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className={`h-2 bg-gradient-to-r ${card.color}`} />

                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h2 className="text-xl font-extrabold text-[#0F6D6A] leading-tight">
                      {card.title}
                    </h2>

                    <span className="shrink-0 rounded-full bg-[#F47C3C]/10 text-[#F47C3C] text-xs font-bold px-3 py-1">
                      {card.badge}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm leading-6 min-h-[72px]">
                    {card.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F6D6A] group-hover:underline">
                      Abrir sección
                    </span>

                    <span className="w-10 h-10 rounded-full bg-[#0F6D6A]/10 flex items-center justify-center text-[#0F6D6A] font-bold group-hover:bg-[#0F6D6A] group-hover:text-white transition">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-[#0F6D6A]/10 bg-[#0F6D6A]/5 p-5">
            <h3 className="text-lg font-bold text-[#0F6D6A] mb-2">
              Organización recomendada
            </h3>
            <p className="text-sm text-gray-600 leading-6">
              Todo lo relacionado con la contadora queda dentro de este módulo.
              El inventario sigue en su propia área, pero cuando una entrada sea una donación,
              se conectará con contabilidad sin mezclar los módulos. Los pagos a clínicas y el
              control financiero del delivery también forman parte del cierre contable y del
              seguimiento administrativo mensual.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}