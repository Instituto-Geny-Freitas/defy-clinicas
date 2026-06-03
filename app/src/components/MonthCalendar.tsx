import { useState } from 'react'

interface Props {
  /** Data selecionada no formato YYYY-MM-DD. */
  value: string | null
  onChange: (dateISO: string) => void
  /** Dias com marcação (YYYY-MM-DD) — ex.: dias com agendamento. */
  marcados?: Set<string>
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MonthCalendar({ value, onChange, marcados }: Props) {
  const base = value ? new Date(value + 'T12:00:00') : new Date()
  const [ano, setAno] = useState(base.getFullYear())
  const [mes, setMes] = useState(base.getMonth())

  const hojeStr = ymd(new Date())
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()

  const celulas: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d)

  function nav(delta: number) {
    let m = mes + delta, a = ano
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMes(m); setAno(a)
  }

  return (
    <div className="rounded-xl border border-black/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => nav(-1)} className="rounded-md px-2 py-1 text-texto/60 hover:bg-black/5">‹</button>
        <span className="text-sm font-semibold text-texto">{MESES[mes]} {ano}</span>
        <button type="button" onClick={() => nav(1)} className="rounded-md px-2 py-1 text-texto/60 hover:bg-black/5">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-texto/40">
        {DIAS.map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const selecionado = value === iso
          const ehHoje = hojeStr === iso
          const temMarca = marcados?.has(iso)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(iso)}
              className={`relative aspect-square rounded-md text-sm transition ${
                selecionado ? 'bg-primaria font-semibold text-white' : ehHoje ? 'bg-primaria/10 text-primaria' : 'text-texto hover:bg-black/5'
              }`}
            >
              {d}
              {temMarca && !selecionado && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primaria" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
