"use client"

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl bg-[#0F6D6A] text-white font-semibold shadow"
    >
      Imprimir comprobante
    </button>
  )
}