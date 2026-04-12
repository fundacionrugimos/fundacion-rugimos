"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { BloqueioClinica } from "@/bloqueios"

type HorarioClinica = {
  id: string
  hora: string
}

const DIAS_SEMANA_LABEL: Record<string, string> = {
  "0": "Domingo",
  "1": "Segunda",
  "2": "Terça",
  "3": "Quarta",
  "4": "Quinta",
  "5": "Sexta",
  "6": "Sábado",
}

const MESES_LABEL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

function formatarData(fecha?: string | null) {
  if (!fecha) return "-"
  const [year, month, day] = fecha.split("-")
  return `${day}/${month}/${year}`
}

function gerarCalendarioMes(dataBase: Date) {
  const ano = dataBase.getFullYear()
  const mes = dataBase.getMonth()

  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0)

  const primeiroDiaSemana = primeiroDia.getDay()
  const totalDias = ultimoDia.getDate()

  const celulas: Array<{ fecha: string | null; dia: number | null }> = []

  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push({ fecha: null, dia: null })
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = new Date(ano, mes, dia)
    const yyyy = data.getFullYear()
    const mm = String(data.getMonth() + 1).padStart(2, "0")
    const dd = String(data.getDate()).padStart(2, "0")
    const fecha = `${yyyy}-${mm}-${dd}`

    celulas.push({ fecha, dia })
  }

  return celulas
}

function ehHoje(fecha: string) {
  const hoje = new Date()
  const yyyy = hoje.getFullYear()
  const mm = String(hoje.getMonth() + 1).padStart(2, "0")
  const dd = String(hoje.getDate()).padStart(2, "0")
  return fecha === `${yyyy}-${mm}-${dd}`
}

export default function BloqueiosClinicaPage() {
  const params = useParams()
  const clinicaId = params?.id as string

  const [nomeClinica, setNomeClinica] = useState("")
  const [bloqueios, setBloqueios] = useState<BloqueioClinica[]>([])
  const [loading, setLoading] = useState(true)

  const [titulo, setTitulo] = useState("")
  const [motivo, setMotivo] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [recorrente, setRecorrente] = useState(false)
  const [diaSemana, setDiaSemana] = useState("")

  const [horarios, setHorarios] = useState<HorarioClinica[]>([])
  const [tipoBloqueio, setTipoBloqueio] = useState<"dia_completo" | "horario">("dia_completo")
  const [horarioId, setHorarioId] = useState("")

  const [dataCalendario, setDataCalendario] = useState(new Date())

  async function carregarClinica() {
    const { data, error } = await supabase
      .from("clinicas")
      .select("id, nome")
      .eq("id", clinicaId)
      .single()

    if (!error && data) {
      setNomeClinica(data.nome)
    }
  }

  async function carregarHorarios() {
    const { data, error } = await supabase
      .from("horarios_clinica")
      .select("id, hora")
      .eq("clinica_id", clinicaId)
      .order("hora", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    setHorarios((data || []) as HorarioClinica[])
  }

  async function carregarBloqueios() {
    setLoading(true)

    const { data, error } = await supabase
      .from("bloqueios_clinica")
      .select("*")
      .eq("clinica_id", clinicaId)
      .order("fecha_inicio", { ascending: true })

    if (error) {
      console.error(error)
      alert("Erro ao carregar bloqueios da clínica")
    } else {
      setBloqueios((data || []) as BloqueioClinica[])
    }

    setLoading(false)
  }

  async function criarBloqueio(e: React.FormEvent) {
    e.preventDefault()

    if (!titulo.trim()) {
      alert("Informe um título para o bloqueio.")
      return
    }

    if (!fechaInicio || !fechaFin) {
      alert("Selecione a data inicial e a data final.")
      return
    }

    if (tipoBloqueio === "horario" && !horarioId) {
      alert("Selecione um horário da clínica.")
      return
    }

    if (recorrente && diaSemana === "") {
      alert("Selecione o dia da semana para o bloqueio recorrente.")
      return
    }

    const payload = {
      clinica_id: clinicaId,
      titulo,
      motivo: motivo || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      recorrente,
      dia_semana: recorrente ? Number(diaSemana) : null,
      ativo: true,
      tipo_bloqueio: tipoBloqueio,
      horario_id: tipoBloqueio === "horario" ? horarioId || null : null,
      hora_inicio: null,
      hora_fin: null,
    }

    const { error } = await supabase
      .from("bloqueios_clinica")
      .insert([payload])

    if (error) {
      console.error(error)
      alert("Erro ao criar bloqueio")
      return
    }

    setTitulo("")
    setMotivo("")
    setFechaInicio("")
    setFechaFin("")
    setRecorrente(false)
    setDiaSemana("")
    setTipoBloqueio("dia_completo")
    setHorarioId("")

    carregarBloqueios()
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("bloqueios_clinica")
      .update({ ativo: !ativo })
      .eq("id", id)

    if (error) {
      console.error(error)
      alert("Erro ao atualizar bloqueio")
      return
    }

    carregarBloqueios()
  }

  async function excluirBloqueio(id: string) {
    const confirmar = window.confirm("Excluir este bloqueio?")
    if (!confirmar) return

    const { error } = await supabase
      .from("bloqueios_clinica")
      .delete()
      .eq("id", id)

    if (error) {
      console.error(error)
      alert("Erro ao excluir bloqueio")
      return
    }

    carregarBloqueios()
  }

  useEffect(() => {
    if (!clinicaId) return
    carregarClinica()
    carregarBloqueios()
    carregarHorarios()
  }, [clinicaId])

  const mapaHorarios = useMemo(() => {
    const mapa = new Map<string, string>()
    horarios.forEach((h) => mapa.set(h.id, h.hora))
    return mapa
  }, [horarios])

  const celulasCalendario = useMemo(() => {
    return gerarCalendarioMes(dataCalendario)
  }, [dataCalendario])

  function verificarBloqueioDia(fecha: string) {
    return bloqueios.find((b) => {
      if (!b.ativo) return false

      if (b.recorrente && b.dia_semana !== null) {
        const [year, month, day] = fecha.split("-").map(Number)
        const data = new Date(year, month - 1, day)
        return data.getDay() === b.dia_semana
      }

      return fecha >= b.fecha_inicio && fecha <= b.fecha_fin
    })
  }

  return (
    <main className="min-h-screen bg-[#026A6A] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Bloqueios da clínica 🗓️
            </h1>
            <p className="text-white/80 mt-2">
              Gerencie dias e horários indisponíveis de forma clara e segura.
            </p>
            <p className="text-white font-semibold mt-3">
              Clínica: {nomeClinica || "Carregando..."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/clinicas"
              className="bg-white text-[#026A6A] px-6 py-3 rounded-2xl font-semibold shadow-lg hover:opacity-90"
            >
              Volver a clínicas
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#026A6A]">
              Nuevo bloqueo
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure bloqueio por dia completo ou por horário específico da clínica.
            </p>
          </div>

          <form onSubmit={criarBloqueio} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Título
              </label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Feriado, manutenção, equipe reduzida..."
                className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo do bloqueio"
                className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A] min-h-[110px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha inicial
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha final
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de bloqueio
                </label>
                <select
                  value={tipoBloqueio}
                  onChange={(e) =>
                    setTipoBloqueio(e.target.value as "dia_completo" | "horario")
                  }
                  className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                >
                  <option value="dia_completo">Día completo</option>
                  <option value="horario">Horario específico</option>
                </select>
              </div>

              {tipoBloqueio === "horario" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Horario da clínica
                  </label>
                  <select
                    value={horarioId}
                    onChange={(e) => setHorarioId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                  >
                    <option value="">Selecione um horário</option>
                    {horarios.map((horario) => (
                      <option key={horario.id} value={horario.id}>
                        {horario.hora}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="bg-[#026A6A]/5 border border-[#026A6A]/10 rounded-2xl p-4">
              <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                />
                Bloqueio recorrente
              </label>

              {recorrente && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Día de la semana
                  </label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 p-4 outline-none focus:border-[#026A6A]"
                  >
                    <option value="">Selecione o dia da semana</option>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda</option>
                    <option value="2">Terça</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full md:w-auto px-8 py-4 rounded-2xl bg-[#F47C3C] text-white font-bold shadow-lg hover:opacity-90"
              >
                Guardar bloqueo
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#026A6A]">
                Vista mensual 📅
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Clique em um dia para preencher a data inicial e final do formulário.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setDataCalendario(
                    new Date(
                      dataCalendario.getFullYear(),
                      dataCalendario.getMonth() - 1,
                      1
                    )
                  )
                }
                className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 font-semibold hover:opacity-90"
              >
                ←
              </button>

              <div className="px-4 py-2 rounded-xl bg-[#026A6A]/10 text-[#026A6A] font-bold min-w-[180px] text-center">
                {MESES_LABEL[dataCalendario.getMonth()]} {dataCalendario.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() =>
                  setDataCalendario(
                    new Date(
                      dataCalendario.getFullYear(),
                      dataCalendario.getMonth() + 1,
                      1
                    )
                  )
                }
                className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 font-semibold hover:opacity-90"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-bold text-gray-500 mb-3">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {celulasCalendario.map((celula, index) => {
              if (!celula.fecha || !celula.dia) {
                return (
                  <div
                    key={`vazio-${index}`}
                    className="min-h-[72px] rounded-2xl bg-transparent"
                  />
                )
              }

              const bloqueio = verificarBloqueioDia(celula.fecha)
              const selecionado =
                celula.fecha === fechaInicio || celula.fecha === fechaFin

              return (
                <button
                  key={celula.fecha}
                  type="button"
                  onClick={() => {
                    setFechaInicio(celula.fecha!)
                    setFechaFin(celula.fecha!)
                  }}
                  className={`min-h-[72px] rounded-2xl p-3 text-left transition border ${
                    bloqueio
                      ? "bg-red-100 text-red-700 border-red-200"
                      : "bg-gray-50 text-gray-800 border-gray-200 hover:bg-[#026A6A]/10"
                  } ${selecionado ? "ring-2 ring-[#F47C3C]" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-sm">{celula.dia}</span>
                    {ehHoje(celula.fecha) && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-[#026A6A] text-white font-bold">
                        Hoy
                      </span>
                    )}
                  </div>

                  {bloqueio && (
                    <div className="mt-2 text-[11px] leading-tight">
                      <div className="font-semibold truncate">
                        {bloqueio.titulo}
                      </div>
                      <div className="opacity-80">
                        {bloqueio.tipo_bloqueio === "horario"
                          ? "Horario"
                          : "Día completo"}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-200 border border-red-300"></div>
              <span>Día con bloqueo</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
              <span>Día libre</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#F47C3C]"></div>
              <span>Día selecionado no formulário</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#026A6A]">
              Bloqueios cadastrados
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Visualize, ative, desative ou exclua os bloqueios já registrados.
            </p>
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-10">Carregando...</div>
          ) : bloqueios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Nenhum bloqueio cadastrado para esta clínica.
            </div>
          ) : (
            <div className="grid gap-4">
              {bloqueios.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-gray-100 bg-gray-50 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <h3 className="text-xl font-bold text-[#026A6A]">
                          {item.titulo}
                        </h3>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.ativo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {item.ativo ? "Activo" : "Inactivo"}
                        </span>

                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                          {item.tipo_bloqueio === "horario"
                            ? "Horario específico"
                            : "Día completo"}
                        </span>

                        {item.recorrente && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            Recorrente
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Período:</span>{" "}
                        {formatarData(item.fecha_inicio)} até {formatarData(item.fecha_fin)}
                      </p>

                      {item.recorrente && item.dia_semana !== null && (
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Dia da semana:</span>{" "}
                          {DIAS_SEMANA_LABEL[String(item.dia_semana)] || item.dia_semana}
                        </p>
                      )}

                      {item.tipo_bloqueio === "horario" && item.horario_id && (
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Horario bloqueado:</span>{" "}
                          {mapaHorarios.get(item.horario_id) || "Horario selecionado"}
                        </p>
                      )}

                      {item.motivo && (
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">Motivo:</span> {item.motivo}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => alternarAtivo(item.id, item.ativo)}
                        className="px-4 py-2 rounded-2xl border border-gray-300 bg-white text-gray-700 font-semibold hover:opacity-90"
                      >
                        {item.ativo ? "Desactivar" : "Activar"}
                      </button>

                      <button
                        onClick={() => excluirBloqueio(item.id)}
                        className="px-4 py-2 rounded-2xl bg-red-500 text-white font-semibold hover:opacity-90"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}