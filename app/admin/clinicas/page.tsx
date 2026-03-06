```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Clinica {
  id: number
  zona: string
  horario_inicio: string
  horario_fim: string
  se_por_dia: number
  ativa: boolean
  usuario: string
  senha: string

  acepta_gatos: boolean
  acepta_perros: boolean
  acepta_machos: boolean
  acepta_hembras: boolean
  acepta_calle: boolean
  acepta_propio: boolean
}

export default function ClinicasPage() {

  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedClinica, setSelectedClinica] = useState<Clinica | null>(null)
  const [loading,setLoading] = useState(false)

  async function fetchClinicas() {

    try{

    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .order('zona', { ascending: true })

    if (error) {
      console.error('Error al cargar clínicas:', error)
    } else if (data) {
      setClinicas(data)
    }

    }catch(err){
      console.error("Error:",err)
    }

  }

  useEffect(() => {
    fetchClinicas()
  }, [])

  async function toggleClinica(id: number, statusActual: boolean) {

    if (!confirm('¿Seguro que deseas cambiar el estado de esta clínica?')) {
      return
    }

    await supabase
      .from('clinicas')
      .update({ ativa: !statusActual })
      .eq('id', id)

    fetchClinicas()

  }

  async function handleSave(e: any) {

    e.preventDefault()

    if(loading) return

    setLoading(true)

    const form = e.target

    const zona = form.zona.value
    const horario_inicio = form.horario_inicio.value
    const horario_fim = form.horario_fim.value
    const se_por_dia = Number(form.se_por_dia.value)
    const usuario = form.usuario.value
    const senha = form.senha.value

    const acepta_gatos = form.acepta_gatos.checked
    const acepta_perros = form.acepta_perros.checked
    const acepta_machos = form.acepta_machos.checked
    const acepta_hembras = form.acepta_hembras.checked
    const acepta_calle = form.acepta_calle.checked
    const acepta_propio = form.acepta_propio.checked

    try{

    if (selectedClinica) {

      await supabase
        .from('clinicas')
        .update({
          zona,
          horario_inicio,
          horario_fim,
          se_por_dia,
          usuario,
          senha,
          acepta_gatos,
          acepta_perros,
          acepta_machos,
          acepta_hembras,
          acepta_calle,
          acepta_propio
        })
        .eq('id', selectedClinica.id)

    } else {

      await supabase
        .from('clinicas')
        .insert([
          {
            zona,
            horario_inicio,
            horario_fim,
            se_por_dia,
            usuario,
            senha,
            acepta_gatos,
            acepta_perros,
            acepta_machos,
            acepta_hembras,
            acepta_calle,
            acepta_propio,
            ativa: true
          }
        ])

    }

    }catch(err){
      console.error("Error guardando clínica:",err)
    }

    setLoading(false)
    setIsOpen(false)
    setSelectedClinica(null)

    fetchClinicas()

  }

  return (

    <main className="min-h-screen bg-[#026A6A] p-10">

      <div className="flex justify-between items-center mb-10">

        <h1 className="text-3xl font-bold text-white">
          Gestión de Clínicas 🏥
        </h1>

        <button
          onClick={() => {
            setSelectedClinica(null)
            setIsOpen(true)
          }}
          className="bg-[#F47C2A] hover:opacity-90 text-white px-6 py-2 rounded-xl font-semibold shadow-md"
        >
          + Nueva Clínica
        </button>

      </div>

      <div className="space-y-6">

        {clinicas.map((clinica) => (

          <div
            key={clinica.id}
            className="bg-white p-6 rounded-2xl shadow-md flex justify-between items-center"
          >

            <div>

              <p className="font-semibold text-xl text-[#026A6A]">
                Zona: {clinica.zona}
              </p>

              <p className="text-gray-600">
                Horario: {clinica.horario_inicio} - {clinica.horario_fim}
              </p>

              <p className="text-gray-600">
                Cupos por día: {clinica.se_por_dia}
              </p>

              <p className="text-gray-600">
                Usuario: {clinica.usuario}
              </p>

              <div className="text-sm mt-2 text-gray-500">

                <p>Gatos: {clinica.acepta_gatos ? "✔" : "❌"}</p>
                <p>Perros: {clinica.acepta_perros ? "✔" : "❌"}</p>
                <p>Machos: {clinica.acepta_machos ? "✔" : "❌"}</p>
                <p>Hembras: {clinica.acepta_hembras ? "✔" : "❌"}</p>
                <p>Calle: {clinica.acepta_calle ? "✔" : "❌"}</p>
                <p>Propio: {clinica.acepta_propio ? "✔" : "❌"}</p>

              </div>

              <span
                className={`inline-block mt-3 px-3 py-1 text-xs rounded-full font-semibold ${
                  clinica.ativa
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {clinica.ativa ? 'Activa' : 'Inactiva'}
              </span>

            </div>

            <div className="flex gap-3">

              <button
                onClick={() => {
                  setSelectedClinica(clinica)
                  setIsOpen(true)
                }}
                className="px-4 py-2 bg-[#026A6A] text-white rounded-lg"
              >
                Editar
              </button>

              <button
                onClick={() => toggleClinica(clinica.id, clinica.ativa)}
                className={`px-4 py-2 rounded-lg text-white ${
                  clinica.ativa ? 'bg-red-500' : 'bg-green-500'
                }`}
              >
                {clinica.ativa ? 'Desactivar' : 'Activar'}
              </button>

            </div>

          </div>

        ))}

      </div>

      {isOpen && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

          <div className="bg-white rounded-2xl p-8 w-full max-w-lg">

            <h2 className="text-2xl font-bold mb-6 text-[#026A6A]">
              {selectedClinica ? 'Editar Clínica' : 'Nueva Clínica'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">

              <input
                name="zona"
                placeholder="Zona"
                defaultValue={selectedClinica?.zona || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <input
                name="horario_inicio"
                type="time"
                defaultValue={selectedClinica?.horario_inicio || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <input
                name="horario_fim"
                type="time"
                defaultValue={selectedClinica?.horario_fim || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <input
                name="se_por_dia"
                type="number"
                placeholder="Cupos por día"
                defaultValue={selectedClinica?.se_por_dia || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <input
                name="usuario"
                placeholder="Usuario"
                defaultValue={selectedClinica?.usuario || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <input
                name="senha"
                placeholder="Contraseña"
                defaultValue={selectedClinica?.senha || ''}
                className="w-full border rounded-lg p-2"
                required
              />

              <div className="grid grid-cols-2 gap-3 pt-3">

                <label><input type="checkbox" name="acepta_gatos" defaultChecked={selectedClinica?.acepta_gatos ?? true}/> Gatos</label>
                <label><input type="checkbox" name="acepta_perros" defaultChecked={selectedClinica?.acepta_perros ?? true}/> Perros</label>
                <label><input type="checkbox" name="acepta_machos" defaultChecked={selectedClinica?.acepta_machos ?? true}/> Machos</label>
                <label><input type="checkbox" name="acepta_hembras" defaultChecked={selectedClinica?.acepta_hembras ?? true}/> Hembras</label>
                <label><input type="checkbox" name="acepta_calle" defaultChecked={selectedClinica?.acepta_calle ?? true}/> Calle</label>
                <label><input type="checkbox" name="acepta_propio" defaultChecked={selectedClinica?.acepta_propio ?? true}/> Propio</label>

              </div>

              <div className="flex justify-end gap-3 pt-4">

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#F47C2A] text-white rounded-lg hover:opacity-90"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>

  )

}
```
