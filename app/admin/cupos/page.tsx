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

    <div style={{
      minHeight: "100vh",
      background: "#f4f6f8",
      padding: "40px"
    }}>

      <div style={{
        maxWidth: "900px",
        margin: "0 auto",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        overflow: "hidden"
      }}>

        {/* HEADER */}
        <div style={{
          background: "#0f6b6b",
          padding: "20px",
          color: "white",
          fontSize: "22px",
          fontWeight: "bold"
        }}>
          🐾 Panel de Cupos — Fundación Rugimos
        </div>

        {/* TABLE */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>

          <thead>
            <tr style={{
              background: "#f1f1f1",
              textAlign: "left"
            }}>
              <th style={{padding:"14px"}}>Clínica</th>
              <th style={{padding:"14px"}}>08:00</th>
              <th style={{padding:"14px"}}>10:00</th>
            </tr>
          </thead>

          <tbody>

            {clinicas.map((c:any) => {

              const h8 = obterHorario(c.id,"08:00")
              const h10 = obterHorario(c.id,"10:00")

              return (

                <tr key={c.id} style={{
                  borderTop:"1px solid #eee"
                }}>

                  <td style={{padding:"14px", fontWeight:500}}>
                    {c.nome}
                  </td>

                  <td style={{padding:"14px"}}>
                    {h8 ? `${h8.cupos_ocupados} / ${h8.cupos_maximos}` : "-"}
                  </td>

                  <td style={{padding:"14px"}}>
                    {h10 ? `${h10.cupos_ocupados} / ${h10.cupos_maximos}` : "-"}
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