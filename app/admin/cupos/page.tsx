"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Clinica = {
  id: string
  nome: string
}

type Horario = {
  clinica_id: string
  hora: string
  vagas_total: number
  vagas_ocupadas: number
}

export default function Page() {

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {

    const { data: clinicasData } = await supabase
      .from("clinicas")
      .select("id,nome")

    const { data: horariosData } = await supabase
      .from("horarios_clinica")
      .select("*")

    if (clinicasData) setClinicas(clinicasData)
    if (horariosData) setHorarios(horariosData)

  }

  const obterHorario = (clinicaId: string, hora: string) => {

    return horarios.find(
      (h) => h.clinica_id === clinicaId && h.hora === hora
    )

  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <h1 className="text-3xl font-bold mb-8">
        Cupos por Clínica
      </h1>

      <div className="bg-white rounded-xl shadow p-6">

        <table className="w-full text-left">

          <thead>
            <tr className="border-b">
              <th className="p-3">Clínica</th>
              <th className="p-3">08:00</th>
              <th className="p-3">10:00</th>
            </tr>
          </thead>

          <tbody>

            {clinicas.map((c) => {

              const h8 = obterHorario(c.id, "08:00")
              const h10 = obterHorario(c.id, "10:00")

              return (
                <tr key={c.id} className="border-b">

                  <td className="p-3 font-semibold">
                    {c.nome}
                  </td>

                  <td className="p-3">
                    {h8 ? `${h8.vagas_ocupadas} / ${h8.vagas_total}` : "-"}
                  </td>

                  <td className="p-3">
                    {h10 ? `${h10.vagas_ocupadas} / ${h10.vagas_total}` : "-"}
                  </td>

                </tr>
              )

            })}

          </tbody>

        </table>

      </div>

    </div>
  )

}