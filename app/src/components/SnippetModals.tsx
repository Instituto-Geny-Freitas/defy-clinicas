import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { listSnippetVersions, updateSnippet, type Snippet, type SnippetVersion } from '@/lib/settings'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

const CATEGORIAS: [string, string][] = [
  ['plano', 'Plano de tratamento'],
  ['orientacao', 'Orientação'],
  ['exames_lab', 'Exames'],
  ['outro', 'Outro'],
]

function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-texto">{titulo}</h3>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Edição de um texto-padrão. A versão atual é arquivada no histórico e a nova
 * passa a ser a vigente. Os textos JÁ inseridos em planos/observações/documentos
 * são cópias no registro do paciente — não mudam com a edição.
 */
export function SnippetEditModal({ clinicId, snippet, onClose, onSaved }: {
  clinicId: string
  snippet: Snippet
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const [categoria, setCategoria] = useState(snippet.categoria ?? 'plano')
  const [titulo, setTitulo] = useState(snippet.titulo)
  const [conteudo, setConteudo] = useState(snippet.conteudo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!titulo.trim() || !conteudo.trim()) { setErro('Informe o título e o conteúdo.'); return }
    setSalvando(true); setErro(null)
    try {
      await updateSnippet(snippet.id, { categoria, titulo, conteudo }, {
        clinicId,
        createdBy: profile?.professional?.id ?? null,
        createdByNome: profile?.professional?.nome ?? null,
      })
      onSaved()
    } catch (e) { setErro((e as Error)?.message || 'Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <Shell titulo="Editar texto-padrão" onClose={onClose}>
      <p className="mb-3 text-xs text-texto/50">
        A versão atual (<strong>v{snippet.versao ?? 1}</strong>) vai para o <strong>histórico</strong> e esta passa a
        ser a vigente. Os textos <strong>já inseridos</strong> em planos, observações e documentos são cópias no
        registro do paciente — <strong>não mudam</strong> com esta edição.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Categoria</label>
            <select className={field} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Título</label>
            <input className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Conteúdo</label>
          <textarea rows={8} className={field} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
        </div>
        {erro && <p className="text-sm text-secundaria">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? 'Salvando…' : 'Salvar nova versão'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

/** Histórico das versões anteriores do texto-padrão (auditoria). */
export function SnippetHistoricoModal({ snippet, onClose }: { snippet: Snippet; onClose: () => void }) {
  const [rows, setRows] = useState<SnippetVersion[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    listSnippetVersions(snippet.id).then(setRows).catch(() => {}).finally(() => setCarregando(false))
  }, [snippet.id])

  return (
    <Shell titulo={`Histórico · ${snippet.titulo}`} onClose={onClose}>
      <p className="mb-3 text-xs text-texto/50">
        Versão vigente: <strong>v{snippet.versao ?? 1}</strong>. Abaixo, as versões anteriores — preservadas para
        auditoria (o que foi inserido nos registros dos pacientes continua como estava).
      </p>
      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-texto/50">Nenhuma versão anterior.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((v) => (
            <div key={v.id} className="rounded-lg border border-black/5 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-texto/50">
                <span className="rounded-full bg-black/5 px-2 py-0.5 font-medium">v{v.versao}</span>
                <span className="text-texto/70">{v.titulo}</span>
                <span>· {new Date(v.created_at).toLocaleString('pt-BR')}</span>
                {v.created_by_nome && <span>· {v.created_by_nome}</span>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-texto/70">{v.conteudo}</p>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
