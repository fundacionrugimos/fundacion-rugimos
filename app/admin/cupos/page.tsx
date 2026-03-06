"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Page() {

  const [clinicas, setClinicas] = useState<any[]>([])
  const [horarios, setHorarios] = useState<any[]>([])

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {

    const { data: clinicasData } = await supabase
      .from("clinicas")
      .select("*")

    const { data: horariosData } = await supabase
      .from("horarios_clinica")
      .select("*")

    if (clinicasData) setClinicas(clinicasData)
    if (horariosData) setHorarios(horariosData)

  }

  function obterHorario(clinicaId: string, hora: string) {

    return horarios.find((h: any) => {

      const horaFormatada = h.hora.slice(0,5)

      return h.clinica_id === clinicaId && horaFormatada === hora

    })

  }

  return (
    <div style={{ padding: 40 }}>

      <h1>Cupos por Clínica</h1>

      <table border={1} cellPadding={10}>

        <thead>
          <tr>
            <th>Clínica</th>
            <th>08:00</th>
            <th>10:00</th>
          </tr>
        </thead>

        <tbody>

          {clinicas.map((c:any) => {

            const h8 = obterHorario(c.id,"08:00")
            const h10 = obterHorario(c.id,"10:00")

            return (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{h8 ? h8.cupos_ocupados + " / " + h8.cupos_maximos : "-"}</td>
                <td>{h10 ? h10.cupos_ocupados + " / " + h10.cupos_maximos : "-"}</td>
              </tr>
            )

          })}

        </tbody>

      </table>

    </div>
  )

}