import { useEffect, useState } from 'react'
import { listSnippetsByCategorias, type TextSnippet } from '@/lib/treatmentPlans'

/**
 * Dropdown "Inserir texto-padrão…" que lista os textos-padrão (Configurações →
 * Textos-padrão) das categorias informadas e, ao escolher, chama onInsert com o
 * conteúdo (para anexar ao campo). Não renderiza nada se não houver textos.
 */
export default function SnippetPicker({
  categorias,
  onInsert,
  className,
}: {
  categorias: string[]
  onInsert: (texto: string) => void
  className?: string
}) {
  const [snips, setSnips] = useState<TextSnippet[]>([])
  const key = categorias.join(',')
  useEffect(() => {
    listSnippetsByCategorias(categorias).then(setSnips).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (snips.length === 0) return null
  return (
    <select
      className={className ?? 'mt-1 w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs text-texto/70 outline-none focus:border-primaria'}
      value=""
      onChange={(e) => {
        const s = snips.find((x) => x.id === e.target.value)
        if (s) onInsert(s.conteudo)
        e.currentTarget.value = ''
      }}
    >
      <option value="">Inserir texto-padrão…</option>
      {snips.map((s) => (
        <option key={s.id} value={s.id}>{s.titulo}</option>
      ))}
    </select>
  )
}
