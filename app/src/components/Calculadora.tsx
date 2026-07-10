import { useState } from 'react'

const brl = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Calculadora de valor unitário: o profissional informa o valor total pago
 * (ex.: uma caixa) e a quantidade de unidades — o resultado é o valor por
 * unidade, evitando o registro errôneo do valor de um item.
 * Chame onUsar(valorUnitario) para aplicar o resultado no campo de origem.
 */
export default function Calculadora({ valorInicial, onUsar, onClose }: {
  valorInicial?: number
  onUsar: (valorUnitario: number) => void
  onClose: () => void
}) {
  const [total, setTotal] = useState(valorInicial && valorInicial > 0 ? String(valorInicial).replace('.', ',') : '')
  const [unidades, setUnidades] = useState('1')

  const totalNum = Number(total.replace(',', '.')) || 0
  const undNum = Number(unidades.replace(',', '.')) || 0
  const unitario = undNum > 0 ? Math.round((totalNum / undNum) * 100) / 100 : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-texto">🧮 Calcular valor unitário</h3>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <p className="mb-3 text-xs text-texto/60">Ex.: uma caixa custou R$ 120,00 e vem com 12 unidades → R$ 10,00 por unidade.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Valor total pago (R$)</label>
            <input inputMode="decimal" className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
              value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Quantidade de unidades</label>
            <input inputMode="decimal" className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
              value={unidades} onChange={(e) => setUnidades(e.target.value)} placeholder="1" />
          </div>
          <div className="rounded-xl bg-primaria/5 p-3 text-center">
            <div className="text-xs text-texto/60">Valor por unidade</div>
            <div className="text-2xl font-semibold text-primaria">{brl(unitario)}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={() => { onUsar(unitario); onClose() }} disabled={unitario <= 0}
            className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            Usar {brl(unitario)}
          </button>
        </div>
      </div>
    </div>
  )
}
