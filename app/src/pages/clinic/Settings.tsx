import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useThemeReload } from '@/theme/ThemeProvider'
import {
  createProfessional,
  createSnippet,
  deleteSnippet,
  getClinic,
  getIntegration,
  listAllSnippets,
  listProfessionals,
  provisionStaffAccess,
  updateClinic,
  uploadLogo,
  upsertIntegration,
  type ClinicFull,
  type IntegrationSetting,
  type ProfessionalInput,
  type Snippet,
} from '@/lib/settings'
import { gerarSenhaProvisoria } from '@/lib/patients'
import {
  ATIVO_CATEGORIAS,
  calcVendaComMargem,
  createActiveIngredient,
  createProcedureType,
  createRoute,
  createSupplier,
  deleteActiveIngredient,
  deleteProcedureType,
  deleteRoute,
  deleteSupplier,
  listActiveIngredients,
  listProcedureTypes,
  listRoutes,
  listSuppliers,
  updateActiveIngredient,
  type ActiveIngredient,
  type AtivoCategoria,
  type AtivoInput,
  type DomainItem,
  type ProcedureType,
  type Supplier,
} from '@/lib/domains'
import { brl } from '@/lib/finance'
import type { Professional, UserRole } from '@/lib/types'

type Sec = 'visual' | 'equipe' | 'integracoes' | 'textos' | 'ativos' | 'vias' | 'fornecedores' | 'procedimentos' | 'lgpd'
const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'

export default function Settings() {
  const { profile } = useAuth()
  const [sec, setSec] = useState<Sec>('visual')

  if (profile?.professional?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-black/5 bg-white p-6 text-sm text-texto/60">
        Apenas administradores acessam as Configurações.
      </div>
    )
  }
  const clinicId = profile.professional.clinic_id

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Configurações</h1>
      <div className="mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-black/5">
        {[
          { k: 'visual', l: 'Identidade visual' },
          { k: 'equipe', l: 'Equipe' },
          { k: 'integracoes', l: 'Integrações' },
          { k: 'textos', l: 'Textos-padrão' },
          { k: 'ativos', l: 'Ativos' },
          { k: 'vias', l: 'Vias' },
          { k: 'fornecedores', l: 'Fornecedores' },
          { k: 'procedimentos', l: 'Procedimentos' },
          { k: 'lgpd', l: 'LGPD' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setSec(t.k as Sec)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
              sec === t.k ? 'border-primaria font-semibold text-primaria' : 'border-transparent text-texto/60 hover:text-texto'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {sec === 'visual' && <VisualSection />}
      {sec === 'equipe' && <EquipeSection clinicId={clinicId} />}
      {sec === 'integracoes' && <IntegracoesSection clinicId={clinicId} />}
      {sec === 'textos' && <TextosSection clinicId={clinicId} />}
      {sec === 'ativos' && <AtivosSection clinicId={clinicId} />}
      {sec === 'vias' && <ViasSection clinicId={clinicId} />}
      {sec === 'fornecedores' && <FornecedoresSection clinicId={clinicId} />}
      {sec === 'procedimentos' && <ProcedimentosSection clinicId={clinicId} />}
      {sec === 'lgpd' && <LgpdSection />}
    </div>
  )
}

// --- Ativos de composição ---------------------------------------------------
function AtivosSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<ActiveIngredient[]>([])
  const [filtro, setFiltro] = useState<AtivoCategoria | ''>('')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<ActiveIngredient | 'novo' | null>(null)

  function recarregar() { listActiveIngredients().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])

  const visiveis = itens.filter((a) => (!filtro || a.categoria === filtro) && a.nome.toLowerCase().includes(busca.toLowerCase()))
  async function remover(id: string) { if (confirm('Excluir este ativo?')) { await deleteActiveIngredient(id); recarregar() } }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={filtro} onChange={(e) => setFiltro(e.target.value as AtivoCategoria | '')}>
          <option value="">Todas as categorias</option>
          {ATIVO_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <input className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="Buscar ativo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-xs text-texto/40">{visiveis.length}</span>
        <button onClick={() => setEditando('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo</button>
      </div>

      {editando && (
        <AtivoModal clinicId={clinicId} ativo={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />
      )}

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60"><tr>
            <th className="px-3 py-2 font-medium">Nome</th><th className="px-3 py-2 font-medium">Categoria</th>
            <th className="px-3 py-2 font-medium">Via</th><th className="px-3 py-2 font-medium">Fornecedor</th>
            <th className="px-3 py-2 font-medium">Aquisição</th><th className="px-3 py-2 font-medium">Margem</th><th className="px-3 py-2 font-medium">Venda</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {visiveis.slice(0, 200).map((a) => (
              <tr key={a.id} className="border-t border-black/5">
                <td className="px-3 py-1.5 text-texto">{a.nome}</td>
                <td className="px-3 py-1.5 text-texto/60">{ATIVO_CATEGORIAS.find((c) => c.v === a.categoria)?.l}</td>
                <td className="px-3 py-1.5 text-texto/60">{a.via ?? '—'}</td>
                <td className="px-3 py-1.5 text-texto/60">{a.fornecedor ?? '—'}</td>
                <td className="px-3 py-1.5 text-texto/60">{brl(a.preco_aquisicao)}</td>
                <td className="px-3 py-1.5 text-texto/60">{a.margem_pct}%</td>
                <td className="px-3 py-1.5 font-medium text-texto">{brl(a.preco_venda)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <button onClick={() => setEditando(a)} className="mr-3 text-xs font-medium text-primaria hover:underline">Editar</button>
                  <button onClick={() => remover(a.id)} className="text-xs text-secundaria hover:underline">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AtivoModal({ clinicId, ativo, onClose, onSaved }: { clinicId: string; ativo: ActiveIngredient | null; onClose: () => void; onSaved: () => void }) {
  const editando = !!ativo
  const [f, setF] = useState<AtivoInput>({
    codigo: ativo?.codigo ?? '', nome: ativo?.nome ?? '', categoria: ativo?.categoria ?? 'gerais',
    apresentacao: ativo?.apresentacao ?? '', via: ativo?.via ?? '', fornecedor: ativo?.fornecedor ?? '',
    preco_aquisicao: ativo?.preco_aquisicao ?? 0, margem_pct: ativo?.margem_pct ?? 0,
  })
  const [vias, setVias] = useState<DomainItem[]>([])
  const [forns, setForns] = useState<Supplier[]>([])
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { listRoutes().then(setVias).catch(() => {}); listSuppliers().then(setForns).catch(() => {}) }, [])

  const venda = calcVendaComMargem(f.preco_aquisicao ?? 0, f.margem_pct ?? 0)
  const set = <K extends keyof AtivoInput>(k: K, v: AtivoInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function salvar() {
    if (!f.nome?.trim()) return
    setSalvando(true)
    const payload = { ...f, preco_venda: venda }
    try {
      if (editando && ativo) await updateActiveIngredient(ativo.id, payload)
      else await createActiveIngredient(clinicId, payload)
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editando ? 'Editar ativo' : 'Novo ativo'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-texto/70">Código</label><input className={field} value={f.codigo ?? ''} onChange={(e) => set('codigo', e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Categoria</label>
            <select className={field} value={f.categoria} onChange={(e) => set('categoria', e.target.value as AtivoCategoria)}>
              {ATIVO_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Nome / composição *</label><input className={field} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Apresentação</label><input className={field} value={f.apresentacao ?? ''} onChange={(e) => set('apresentacao', e.target.value)} placeholder="Ex.: AMP 2ml" /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Via de aplicação</label>
            <select className={field} value={f.via ?? ''} onChange={(e) => set('via', e.target.value)}>
              <option value="">—</option>
              {vias.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Fornecedor</label>
            <select className={field} value={f.fornecedor ?? ''} onChange={(e) => set('fornecedor', e.target.value)}>
              <option value="">—</option>
              {forns.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Preço de aquisição (R$)</label><input type="number" step="0.01" className={field} value={f.preco_aquisicao ?? 0} onChange={(e) => set('preco_aquisicao', Number(e.target.value))} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Margem (%)</label><input type="number" step="0.01" className={field} value={f.margem_pct ?? 0} onChange={(e) => set('margem_pct', Number(e.target.value))} /></div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-texto/70">Venda com margem (calculado)</label>
            <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm font-medium text-texto">{brl(venda)}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// --- Vias de administração ---------------------------------------------------
function ViasSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<DomainItem[]>([])
  const [nome, setNome] = useState('')
  function recarregar() { listRoutes().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  async function salvar() { if (!nome.trim()) return; await createRoute(clinicId, nome); setNome(''); recarregar() }
  async function remover(id: string) { if (confirm('Excluir esta via?')) { await deleteRoute(id); recarregar() } }
  return (
    <div className="max-w-md space-y-4">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Nova via de administração</h3>
        <p className="mb-3 text-xs text-texto/50">Usada no campo "Via" dos ativos (ex.: Oral, Endovenosa).</p>
        <div className="flex gap-2">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Intramuscular" />
          <button onClick={salvar} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Adicionar</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm"><tbody>
          {itens.map((v) => (
            <tr key={v.id} className="border-t border-black/5 first:border-t-0">
              <td className="px-4 py-2 text-texto">{v.nome}</td>
              <td className="px-4 py-2 text-right"><button onClick={() => remover(v.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhuma via.</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

// --- Fornecedores ------------------------------------------------------------
function FornecedoresSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<Supplier[]>([])
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  function recarregar() { listSuppliers().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  async function salvar() { if (!nome.trim()) return; await createSupplier(clinicId, { nome, contato }); setNome(''); setContato(''); recarregar() }
  async function remover(id: string) { if (confirm('Excluir este fornecedor?')) { await deleteSupplier(id); recarregar() } }
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo fornecedor</h3>
        <p className="mb-3 text-xs text-texto/50">Usado no campo "Fornecedor" dos ativos.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do fornecedor" />
          <input className={field} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Contato (opcional)" />
        </div>
        <div className="mt-2 flex justify-end"><button onClick={salvar} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Adicionar</button></div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm"><tbody>
          {itens.map((s) => (
            <tr key={s.id} className="border-t border-black/5 first:border-t-0">
              <td className="px-4 py-2 text-texto">{s.nome}</td>
              <td className="px-4 py-2 text-texto/60">{s.contato ?? '—'}</td>
              <td className="px-4 py-2 text-right"><button onClick={() => remover(s.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhum fornecedor.</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

// --- Tipos de procedimento --------------------------------------------------
function ProcedimentosSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<ProcedureType[]>([])
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listProcedureTypes().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    try { await createProcedureType(clinicId, nome); setNome(''); recarregar() } finally { setSalvando(false) }
  }
  async function remover(id: string) { if (confirm('Excluir este tipo de procedimento?')) { await deleteProcedureType(id); recarregar() } }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo tipo de procedimento</h3>
        <p className="mb-3 text-xs text-texto/50">Usados no campo Procedimento ao registrar um atendimento.</p>
        <div className="flex gap-2">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Skinbooster PDRN" />
          <button onClick={salvar} disabled={salvando} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Adicionar'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {itens.map((p) => (
              <tr key={p.id} className="border-t border-black/5 first:border-t-0">
                <td className="px-4 py-2 text-texto">{p.nome}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remover(p.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhum tipo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Textos-padrão ----------------------------------------------------------
function TextosSection({ clinicId }: { clinicId: string }) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [categoria, setCategoria] = useState('plano')
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listAllSnippets().then(setSnippets).catch(() => {}) }
  useEffect(recarregar, [])

  async function salvar() {
    if (!titulo.trim() || !conteudo.trim()) return
    setSalvando(true)
    try { await createSnippet(clinicId, { categoria, titulo, conteudo }); setTitulo(''); setConteudo(''); recarregar() }
    finally { setSalvando(false) }
  }
  async function remover(id: string) { if (confirm('Excluir este texto-padrão?')) { await deleteSnippet(id); recarregar() } }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo texto-padrão</h3>
        <p className="mb-3 text-xs text-texto/50">Usados como base no Plano de Tratamento e em outras telas (por categoria).</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Categoria</label>
            <select className={field} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="plano">Plano de tratamento</option>
              <option value="orientacao">Orientação</option>
              <option value="exames_lab">Exames</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Título</label><input className={field} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        </div>
        <div className="mt-3"><label className="mb-1 block text-sm text-texto/70">Conteúdo</label><textarea rows={4} className={field} value={conteudo} onChange={(e) => setConteudo(e.target.value)} /></div>
        <div className="mt-3 flex justify-end"><button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Adicionar'}</button></div>
      </div>

      <div className="space-y-2">
        {snippets.map((s) => (
          <div key={s.id} className="rounded-xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-texto">{s.titulo} <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs text-texto/50">{s.categoria}</span></div>
              <button onClick={() => remover(s.id)} className="text-xs text-secundaria hover:underline">Excluir</button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-texto/60">{s.conteudo}</p>
          </div>
        ))}
        {snippets.length === 0 && <p className="text-sm text-texto/50">Nenhum texto-padrão cadastrado.</p>}
      </div>
    </div>
  )
}

// --- LGPD -------------------------------------------------------------------
function LgpdSection() {
  const [clinic, setClinic] = useState<ClinicFull | null>(null)
  const [texto, setTexto] = useState('')
  const [versao, setVersao] = useState('1')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    getClinic().then((c) => {
      setClinic(c)
      const l = (c?.dados_empresa as { lgpd?: { texto?: string; versao?: string } })?.lgpd
      setTexto(l?.texto || 'Autorizo o tratamento dos meus dados pessoais e de saúde para fins do meu atendimento, nos termos da Lei 13.709/2018 (LGPD).')
      setVersao(l?.versao || '1')
    }).catch(() => {})
  }, [])

  async function salvar() {
    if (!clinic) return
    setSalvando(true); setMsg(null)
    try {
      const dados = { ...(clinic.dados_empresa ?? {}), lgpd: { texto, versao, atualizado_em: new Date().toISOString() } }
      await updateClinic(clinic.id, { dados_empresa: dados })
      setMsg('Termo LGPD salvo.')
    } catch { setMsg('Não foi possível salvar.') } finally { setSalvando(false) }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Termo de Consentimento (LGPD)</h3>
        <p className="mb-4 text-xs text-texto/50">
          Texto apresentado ao registrar o consentimento do paciente (Lei 13.709/2018). Ao alterar a versão,
          consentimentos antigos continuam registrados com a versão em que foram aceitos.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm text-texto/70">Versão</label>
            <input className={field} value={versao} onChange={(e) => setVersao(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm text-texto/70">Texto do consentimento</label>
          <textarea rows={5} className={field} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}

// --- Identidade visual ------------------------------------------------------
function VisualSection() {
  const reloadTheme = useThemeReload()
  const [clinic, setClinic] = useState<ClinicFull | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getClinic().then(setClinic).catch(() => {})
  }, [])

  if (!clinic) return <p className="text-sm text-texto/50">Carregando…</p>

  const cor = (k: string) => (clinic.tema_cores?.[k] as string) || '#000000'
  const setCor = (k: string, v: string) =>
    setClinic({ ...clinic, tema_cores: { ...clinic.tema_cores, [k]: v } })

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !clinic) return
    const url = await uploadLogo(file)
    setClinic({ ...clinic, logo_url: url })
  }

  async function salvar() {
    if (!clinic) return
    setSalvando(true)
    setMsg(null)
    try {
      await updateClinic(clinic.id, {
        nome: clinic.nome,
        razao_social: clinic.razao_social,
        cnpj: clinic.cnpj,
        responsavel_tecnico: clinic.responsavel_tecnico,
        telefone: clinic.telefone,
        whatsapp: clinic.whatsapp,
        email: clinic.email,
        logo_url: clinic.logo_url,
        tema_cores: clinic.tema_cores,
      })
      reloadTheme()
      setMsg('Configurações salvas.')
    } catch {
      setMsg('Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-4 font-semibold text-texto">Logo e dados</h3>
        <div className="flex items-center gap-4">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt="logo" className="h-16 w-16 rounded object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-black/5 text-2xl">💚</div>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onLogo} />
          <button onClick={() => inputRef.current?.click()} className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/5">
            Enviar logo
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-texto/70">Nome</label><input className={field} value={clinic.nome ?? ''} onChange={(e) => setClinic({ ...clinic, nome: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Responsável técnico</label><input className={field} value={clinic.responsavel_tecnico ?? ''} onChange={(e) => setClinic({ ...clinic, responsavel_tecnico: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">CNPJ</label><input className={field} value={clinic.cnpj ?? ''} onChange={(e) => setClinic({ ...clinic, cnpj: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">WhatsApp</label><input className={field} value={clinic.whatsapp ?? ''} onChange={(e) => setClinic({ ...clinic, whatsapp: e.target.value })} /></div>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-4 font-semibold text-texto">Paleta de cores</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { k: 'primaria', l: 'Primária' },
            { k: 'secundaria', l: 'Secundária' },
            { k: 'fundo', l: 'Fundo' },
            { k: 'texto', l: 'Texto' },
          ].map((c) => (
            <div key={c.k}>
              <label className="mb-1 block text-sm text-texto/70">{c.l}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={cor(c.k)} onChange={(e) => setCor(c.k, e.target.value)} className="h-9 w-12 rounded border border-black/10" />
                <input className={field} value={cor(c.k)} onChange={(e) => setCor(c.k, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}

// --- Equipe -----------------------------------------------------------------
function EquipeSection({ clinicId }: { clinicId: string }) {
  const [profs, setProfs] = useState<Professional[]>([])
  const [modal, setModal] = useState(false)
  const [acessoFor, setAcessoFor] = useState<Professional | null>(null)

  function recarregar() {
    listProfessionals().then(setProfs).catch(() => {})
  }
  useEffect(recarregar, [])

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Profissionais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo profissional
        </button>
      </div>
      {modal && <ProfModal clinicId={clinicId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {acessoFor && <AcessoStaffModal prof={acessoFor} onClose={() => setAcessoFor(null)} onSaved={() => { setAcessoFor(null); recarregar() }} />}
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60">
            <tr><th className="px-4 py-2 font-medium">Nome</th><th className="px-4 py-2 font-medium">Papel</th><th className="px-4 py-2 font-medium">Conselho</th><th className="px-4 py-2 font-medium">Acesso</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {profs.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto">{p.nome}</td>
                <td className="px-4 py-2 capitalize text-texto/70">{p.role}</td>
                <td className="px-4 py-2 text-texto/70">{p.conselho_tipo ? `${p.conselho_tipo} ${p.conselho_numero ?? ''}` : '—'}</td>
                <td className="px-4 py-2">{p.auth_user_id ? <span className="text-emerald-600">ativo</span> : <span className="text-texto/40">sem login</span>}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setAcessoFor(p)} className="text-xs font-medium text-primaria hover:underline" disabled={!p.email} title={!p.email ? 'Cadastre um e-mail primeiro' : ''}>
                    {p.auth_user_id ? 'Redefinir senha' : 'Provisionar acesso'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AcessoStaffModal({ prof, onClose, onSaved }: { prof: Professional; onClose: () => void; onSaved: () => void }) {
  const [senha, setSenha] = useState(gerarSenhaProvisoria())
  const [processando, setProcessando] = useState(false)
  const [resultado, setResultado] = useState<{ login: string; senha: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function processar() {
    if (senha.length < 6) { setErro('Senha mínima de 6 caracteres.'); return }
    setProcessando(true); setErro(null)
    try {
      const { login } = await provisionStaffAccess(prof.id, senha)
      setResultado({ login, senha })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível provisionar o acesso.')
      setProcessando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Acesso de {prof.nome}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        {resultado ? (
          <div>
            <p className="text-sm text-texto/70">Credenciais para o profissional. No 1º acesso por senha, ele será obrigado a redefinir.</p>
            <div className="mt-3 space-y-2 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm">
              <div><span className="text-texto/50">Login:</span> <strong>{resultado.login}</strong></div>
              <div><span className="text-texto/50">Senha provisória:</span> <strong>{resultado.senha}</strong></div>
            </div>
            <div className="mt-5 flex justify-end"><button onClick={onSaved} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Concluir</button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-texto/60">{prof.auth_user_id ? 'Redefina a senha de acesso (login: ' + prof.email + ').' : 'Crie o acesso para ' + prof.email + '.'}</p>
            <div className="flex gap-2">
              <input className={field} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <button type="button" onClick={() => setSenha(gerarSenhaProvisoria())} className="shrink-0 rounded-lg border border-black/10 px-3 text-sm hover:bg-black/5">Gerar</button>
            </div>
            {erro && <p className="text-sm text-secundaria">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
              <button onClick={processar} disabled={processando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {processando ? 'Processando…' : prof.auth_user_id ? 'Redefinir senha' : 'Provisionar acesso'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfModal({ clinicId, onClose, onSaved }: { clinicId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<ProfessionalInput>({ nome: '', role: 'profissional' })
  const [salvando, setSalvando] = useState(false)
  const set = <K extends keyof ProfessionalInput>(k: K, v: ProfessionalInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    try {
      await createProfessional(clinicId, f)
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Novo profissional</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-texto/70">Nome *</label><input className={field} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">E-mail (usado no login)</label><input className={field} value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Papel</label>
            <select className={field} value={f.role} onChange={(e) => set('role', e.target.value as UserRole)}>
              <option value="profissional">Profissional</option>
              <option value="admin">Administrador</option>
              <option value="recepcao">Recepção</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="mb-1 block text-sm text-texto/70">Conselho</label><input className={field} placeholder="CRBM…" value={f.conselho_tipo ?? ''} onChange={(e) => set('conselho_tipo', e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Número</label><input className={field} value={f.conselho_numero ?? ''} onChange={(e) => set('conselho_numero', e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">UF</label><input className={field} value={f.conselho_uf ?? ''} onChange={(e) => set('conselho_uf', e.target.value)} /></div>
          </div>
          <p className="text-xs text-texto/50">O vínculo de login é feito automaticamente no primeiro acesso (por e-mail).</p>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Cadastrar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Integrações ------------------------------------------------------------
function IntegracoesSection({ clinicId }: { clinicId: string }) {
  const [s, setS] = useState<IntegrationSetting>({
    clinic_id: clinicId,
    categoria: 'pagamento',
    provider: '',
    modo: 'sandbox',
    config_publica: {},
    ativo: false,
  })
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    getIntegration('pagamento').then((data) => { if (data) setS(data) }).catch(() => {})
  }, [])

  const cfg = (k: string) => (s.config_publica?.[k] as string) || ''
  const setCfg = (k: string, v: string) => setS({ ...s, config_publica: { ...s.config_publica, [k]: v } })

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      await upsertIntegration(s)
      setMsg('Integração salva.')
    } catch {
      setMsg('Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Gateway de pagamento (PIX)</h3>
        <p className="mb-4 text-xs text-texto/50">
          Somente dados públicos. As chaves secretas do gateway ficam em segredos do servidor (Edge Functions), nunca aqui.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Provedor</label>
            <select className={field} value={s.provider ?? ''} onChange={(e) => setS({ ...s, provider: e.target.value })}>
              <option value="">Selecione…</option>
              <option value="asaas">Asaas</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="pagarme">Pagar.me</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Ambiente</label>
            <select className={field} value={s.modo} onChange={(e) => setS({ ...s, modo: e.target.value })}>
              <option value="sandbox">Sandbox (teste)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Chave PIX</label><input className={field} value={cfg('chave_pix')} onChange={(e) => setCfg('chave_pix', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Chave pública / Public Key</label><input className={field} value={cfg('chave_publica')} onChange={(e) => setCfg('chave_publica', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">URL de Webhook</label><input className={field} value={cfg('webhook_url')} onChange={(e) => setCfg('webhook_url', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-texto/80">
            <input type="checkbox" checked={s.ativo} onChange={(e) => setS({ ...s, ativo: e.target.checked })} /> Integração ativa
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}
