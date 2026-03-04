'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Registro {
  id: number
  codigo: string
  nombre_responsable: string
  telefono: string
  ci: string
  nombre_animal: string
  especie: string
  raza: string
  edad: string
  sexo: string
  foto_frente: string | null
  foto_lado: string | null
  foto_carnet: string | null
}

export default function RegistrosPage() {

  const [registros, setRegistros] = useState<Registro[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  async function fetchRegistros() {

    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error(error)
    } else if (data) {
      setRegistros(data)
    }
  }

  useEffect(() => {
    fetchRegistros()
  }, [])

  async function guardarCambios(registro: Registro) {

    if (!confirm('¿Confirmar cambios en este registro?')) return

    await supabase
      .from('registros')
      .update({
        nombre_responsable: registro.nombre_responsable,
        telefono: registro.telefono,
        ci: registro.ci,
        nombre_animal: registro.nombre_animal,
        especie: registro.especie,
        raza: registro.raza,
        edad: registro.edad,
        sexo: registro.sexo
      })
      .eq('id', registro.id)

    setEditandoId(null)
    fetchRegistros()
  }

  const registrosFiltrados = registros.filter((registro) => {

    const texto = busqueda.toLowerCase()

    return (
      registro.codigo?.toLowerCase().includes(texto) ||
      registro.nombre_animal?.toLowerCase().includes(texto) ||
      registro.nombre_responsable?.toLowerCase().includes(texto)
    )
  })

  return (

    <main className="min-h-screen bg-[#026A6A] p-10">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-4">

        <h1 className="text-3xl font-bold text-white">
          Registros de Animales 📋
        </h1>

        <input
          type="text"
          placeholder="Buscar por código, animal o responsable..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="px-4 py-2 rounded-xl w-full md:w-96 border-2 border-[#F47C2A] outline-none bg-white"
        />

      </div>

      <div className="space-y-8">

        {registrosFiltrados.map((registro) => {

          const editando = editandoId === registro.id

          return (

            <div
              key={registro.id}
              className="bg-white rounded-2xl shadow-xl p-8 flex gap-10"
            >

              <div className="flex-1 space-y-3">

                <h2 className="text-xl font-bold text-[#026A6A]">
                  Código: {registro.codigo}
                </h2>

                <div className="mt-4">

                  <p className="font-semibold text-gray-700">Responsable</p>

                  {editando ? (
                    <>
                      <input className="input"
                        defaultValue={registro.nombre_responsable}
                        onChange={(e)=>registro.nombre_responsable=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.telefono}
                        onChange={(e)=>registro.telefono=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.ci}
                        onChange={(e)=>registro.ci=e.target.value}
                      />
                    </>
                  ) : (
                    <>
                      <p>Nombre: {registro.nombre_responsable}</p>
                      <p>Teléfono: {registro.telefono}</p>
                      <p>CI: {registro.ci}</p>
                    </>
                  )}

                </div>

                <div className="mt-6">

                  <p className="font-semibold text-gray-700">Animal</p>

                  {editando ? (
                    <>
                      <input className="input"
                        defaultValue={registro.nombre_animal}
                        onChange={(e)=>registro.nombre_animal=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.especie}
                        onChange={(e)=>registro.especie=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.raza}
                        onChange={(e)=>registro.raza=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.edad}
                        onChange={(e)=>registro.edad=e.target.value}
                      />

                      <input className="input"
                        defaultValue={registro.sexo}
                        onChange={(e)=>registro.sexo=e.target.value}
                      />
                    </>
                  ) : (
                    <>
                      <p>Nombre: {registro.nombre_animal}</p>
                      <p>Especie: {registro.especie}</p>
                      <p>Raza: {registro.raza}</p>
                      <p>Edad: {registro.edad}</p>
                      <p>Sexo: {registro.sexo}</p>
                    </>
                  )}

                </div>

                <div className="mt-6 flex gap-4">

                  {editando ? (
                    <>
                      <button
                        onClick={()=>guardarCambios(registro)}
                        className="bg-[#F47C2A] text-white px-4 py-2 rounded-lg"
                      >
                        Confirmar
                      </button>

                      <button
                        onClick={()=>setEditandoId(null)}
                        className="bg-gray-300 px-4 py-2 rounded-lg"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={()=>setEditandoId(registro.id)}
                      className="bg-[#026A6A] text-white px-4 py-2 rounded-lg"
                    >
                      Editar
                    </button>
                  )}

                </div>

              </div>

              <div className="w-72 flex flex-col gap-4">

                {registro.foto_frente ? (
                  <img
                    src={registro.foto_frente}
                    className="w-full h-40 object-cover rounded-xl shadow"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500">
                    Sin foto
                  </div>
                )}

                {registro.foto_lado && (
                  <img
                    src={registro.foto_lado}
                    className="w-full h-32 object-cover rounded-xl shadow"
                  />
                )}

                {registro.foto_carnet && (
                  <img
                    src={registro.foto_carnet}
                    className="w-full h-32 object-cover rounded-xl shadow"
                  />
                )}

              </div>

            </div>

          )

        })}

      </div>

      <style jsx>{`
        .input {
          display:block;
          width:100%;
          margin-top:8px;
          padding:8px;
          border-radius:8px;
          border:1px solid #ccc;
        }
      `}</style>

    </main>

  )
}