import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useThemeReload } from '@/theme/ThemeProvider'
import {
  createProfessional,
  createSnippet,
  createTeamRole,
  deleteProfessional,
  deleteSnippet,
  deleteTeamRole,
  getClinic,
  getIntegration,
  listAllSnippets,
  listProfessionals,
  listTeamRoles,
  manageStaffAccess,
  updateClinic,
  updateProfessional,
  updateTeamRole,
  uploadLogo,
  upsertIntegration,
  type ClinicFull,
  type IntegrationSetting,
  type ProfessionalInput,
  type Snippet,
  type TeamRole,
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
import {
  createFormulation,
  deleteFormulation,
  listFormulationLibrary,
  updateFormulation,
  type Ativo,
  type FormulaInput,
  type FormulationLib,
} from '@/lib/formulations'
import { createExpenseType, deleteExpenseType, listExpenseTypes, updateExpenseType, type ExpenseType } from '@/lib/cashflow'
import { FEATURES, NIVEIS_EDITAVEIS, NIVEL_LABEL as PERM_NIVEL_LABEL, defaultsMatrix, getPermissions, savePermissions, type PermMatrix } from '@/lib/permissions'
import { usePermissions } from '@/auth/PermissionsProvider'
import {
  createServico, createVacina, deleteServico, deleteVacina, listServicos, listVacinas,
  updateServico, updateVacina, type DomItem,
} from '@/lib/admin'
import {
  DEFAULT_FORMS, getForms, getClinicCodigo, resetFormDef, saveClinicCodigo, saveFormDef,
  type FieldType, type FormDef, type FormField,
} from '@/lib/adminForms'
import {
  DIAS_SEMANA, createAvailability, createBlock, deleteAvailability, deleteBlock,
  listAvailability, listBlocks, type AvailabilityWindow, type BlockRange,
} from '@/lib/availability'
import { formatDateBR } from '@/lib/format'
import { createExamType, deleteExamType, listExamTypes, updateExamType, type ExamType } from '@/lib/labs'
import type { Professional, UserRole } from '@/lib/types'

type Sec = 'visual' | 'equipe' | 'disponibilidade' | 'papeis' | 'permissoes' | 'integracoes' | 'textos' | 'ativos' | 'vias' | 'fornecedores' | 'formulas' | 'procedimentos' | 'despesas' | 'exames' | 'servicos' | 'vacinas' | 'formularios' | 'lgpd'
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
          { k: 'disponibilidade', l: 'Disponibilidade' },
          { k: 'papeis', l: 'Papéis' },
          { k: 'permissoes', l: 'Permissões' },
          { k: 'integracoes', l: 'Integrações' },
          { k: 'textos', l: 'Textos-padrão' },
          { k: 'ativos', l: 'Ativos' },
          { k: 'vias', l: 'Vias' },
          { k: 'fornecedores', l: 'Fornecedores' },
          { k: 'formulas', l: 'Fórmulas' },
          { k: 'procedimentos', l: 'Procedimentos' },
          { k: 'despesas', l: 'Tipos de Despesa' },
          { k: 'exames', l: 'Exames' },
          { k: 'servicos', l: 'Serviços Prestados' },
          { k: 'vacinas', l: 'Vacinas' },
          { k: 'formularios', l: 'Formulários (Admin)' },
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
      {sec === 'disponibilidade' && <DisponibilidadeSection clinicId={clinicId} />}
      {sec === 'papeis' && <RolesSection clinicId={clinicId} />}
      {sec === 'permissoes' && <PermissoesSection clinicId={clinicId} />}
      {sec === 'integracoes' && <IntegracoesSection clinicId={clinicId} />}
      {sec === 'textos' && <TextosSection clinicId={clinicId} />}
      {sec === 'ativos' && <AtivosSection clinicId={clinicId} />}
      {sec === 'vias' && <ViasSection clinicId={clinicId} />}
      {sec === 'fornecedores' && <FornecedoresSection clinicId={clinicId} />}
      {sec === 'formulas' && <FormulasSection clinicId={clinicId} />}
      {sec === 'procedimentos' && <ProcedimentosSection clinicId={clinicId} />}
      {sec === 'despesas' && <DespesasSection clinicId={clinicId} />}
      {sec === 'exames' && <ExamesSection clinicId={clinicId} />}
      {sec === 'servicos' && <ServicosSection clinicId={clinicId} />}
      {sec === 'vacinas' && <VacinasSection clinicId={clinicId} />}
      {sec === 'formularios' && <FormulariosSection clinicId={clinicId} />}
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
    lote: ativo?.lote ?? '', validade: ativo?.validade ?? '',
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
          <div><label className="mb-1 block text-sm text-texto/70">Lote</label><input className={field} value={f.lote ?? ''} onChange={(e) => set('lote', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm text-texto/70">Validade</label><input type="date" className={field} value={f.validade ?? ''} onChange={(e) => set('validade', e.target.value)} /></div>
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
  const [telefone, setTelefone] = useState('')
  const [contato, setContato] = useState('')
  function recarregar() { listSuppliers().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  async function salvar() { if (!nome.trim()) return; await createSupplier(clinicId, { nome, telefone, contato }); setNome(''); setTelefone(''); setContato(''); recarregar() }
  async function remover(id: string) { if (confirm('Excluir este fornecedor?')) { await deleteSupplier(id); recarregar() } }
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo fornecedor</h3>
        <p className="mb-3 text-xs text-texto/50">Usado no campo "Fornecedor" dos ativos.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do fornecedor" />
          <input className={field} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone / WhatsApp" />
          <input className={field} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Contato (opcional)" />
        </div>
        <div className="mt-2 flex justify-end"><button onClick={salvar} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Adicionar</button></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60"><tr><th className="px-4 py-2 font-medium">Nome</th><th className="px-4 py-2 font-medium">Telefone/WhatsApp</th><th className="px-4 py-2 font-medium">Contato</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {itens.map((s) => (
              <tr key={s.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto">{s.nome}</td>
                <td className="px-4 py-2 text-texto/60">{s.telefone ?? '—'}</td>
                <td className="px-4 py-2 text-texto/60">{s.contato ?? '—'}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remover(s.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhum fornecedor.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Biblioteca de fórmulas (CRUD) ------------------------------------------
function FormulasSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<FormulationLib[]>([])
  const [editando, setEditando] = useState<FormulationLib | 'novo' | null>(null)
  function recarregar() { listFormulationLibrary().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  async function remover(id: string) { if (confirm('Excluir esta fórmula?')) { await deleteFormulation(id); recarregar() } }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-texto/60">Fórmulas da biblioteca — designadas aos pacientes na aba Manipulação.</p>
        <button onClick={() => setEditando('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Nova fórmula</button>
      </div>
      {editando && <FormulaModal clinicId={clinicId} formula={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />}
      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma fórmula cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((f) => (
            <div key={f.id} className="rounded-xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-texto">{f.nome}{f.forma && <span className="ml-2 text-xs text-texto/50">({f.forma})</span>}</div>
                <div className="flex gap-3">
                  <button onClick={() => setEditando(f)} className="text-xs font-medium text-primaria hover:underline">Editar</button>
                  <button onClick={() => remover(f.id)} className="text-xs text-secundaria hover:underline">Excluir</button>
                </div>
              </div>
              <ul className="mt-1 text-sm text-texto/70">
                {(f.composicao ?? []).map((a, i) => <li key={i}>• {a.ativo} — {a.quantidade}{a.unidade}</li>)}
              </ul>
              {f.posologia && <p className="mt-1 text-sm text-texto/60">Posologia: {f.posologia}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormulaModal({ clinicId, formula, onClose, onSaved }: { clinicId: string; formula: FormulationLib | null; onClose: () => void; onSaved: () => void }) {
  const editando = !!formula
  const [nome, setNome] = useState(formula?.nome ?? '')
  const [forma, setForma] = useState(formula?.forma ?? '')
  const [posologia, setPosologia] = useState(formula?.posologia ?? '')
  const [ativos, setAtivos] = useState<Ativo[]>(formula?.composicao?.length ? formula.composicao : [{ ativo: '', quantidade: '', unidade: 'mg' }])
  const [catalogo, setCatalogo] = useState<ActiveIngredient[]>([])
  const [catFiltro, setCatFiltro] = useState<AtivoCategoria | ''>('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { listActiveIngredients().then(setCatalogo).catch(() => {}) }, [])
  const ativosFiltrados = catalogo.filter((a) => !catFiltro || a.categoria === catFiltro)
  function setAtivo(i: number, patch: Partial<Ativo>) { setAtivos((arr) => arr.map((a, idx) => idx === i ? { ...a, ...patch } : a)) }

  async function salvar() {
    const comp = ativos.filter((a) => a.ativo.trim())
    if (!nome.trim() || comp.length === 0) return
    setSalvando(true)
    const input: FormulaInput = { nome, forma: forma || null, composicao: comp, posologia: posologia || null }
    try {
      if (editando && formula) await updateFormulation(formula.id, input)
      else await createFormulation(clinicId, input)
      onSaved()
    } catch { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editando ? 'Editar fórmula' : 'Nova fórmula'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-texto/70">Nome *</label><input className={field} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Forma</label><input className={field} value={forma} onChange={(e) => setForma(e.target.value)} placeholder="cápsula, solução, bombom…" /></div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-texto/70">Composição</label>
              <button onClick={() => setAtivos((a) => [...a, { ativo: '', quantidade: '', unidade: 'mg' }])} className="text-xs font-medium text-primaria hover:underline">+ Ativo</button>
            </div>
            {catalogo.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-texto/50">Filtrar:</span>
                <select className="rounded-lg border border-black/10 px-2 py-1 text-xs" value={catFiltro} onChange={(e) => setCatFiltro(e.target.value as AtivoCategoria | '')}>
                  <option value="">Todas as categorias</option>
                  {ATIVO_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
            )}
            <datalist id="ativos-formula">{ativosFiltrados.map((a) => <option key={a.id} value={a.nome} />)}</datalist>
            <div className="space-y-2">
              {ativos.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input list="ativos-formula" className={field} placeholder="Ativo" value={a.ativo} onChange={(e) => setAtivo(i, { ativo: e.target.value })} />
                  <input className="w-24 rounded-lg border border-black/10 px-2 py-2 text-sm" placeholder="Qtd" value={a.quantidade} onChange={(e) => setAtivo(i, { quantidade: e.target.value })} />
                  <input className="w-20 rounded-lg border border-black/10 px-2 py-2 text-sm" placeholder="un." value={a.unidade} onChange={(e) => setAtivo(i, { unidade: e.target.value })} />
                  <button onClick={() => setAtivos((arr) => arr.filter((_, idx) => idx !== i))} className="px-1 text-texto/40 hover:text-secundaria">✕</button>
                </div>
              ))}
            </div>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Posologia</label><textarea rows={2} className={field} value={posologia} onChange={(e) => setPosologia(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
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

// --- Tipos de despesa -------------------------------------------------------
function DespesasSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<ExpenseType[]>([])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'produto' | 'fixo'>('fixo')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listExpenseTypes().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    try { await createExpenseType(clinicId, nome.trim(), tipo); setNome(''); recarregar() } finally { setSalvando(false) }
  }
  async function remover(id: string) { if (confirm('Excluir este tipo de despesa?')) { await deleteExpenseType(id); recarregar() } }
  async function classificar(id: string, novoTipo: 'produto' | 'fixo') { await updateExpenseType(id, { tipo: novoTipo }); recarregar() }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo tipo de despesa</h3>
        <p className="mb-3 text-xs text-texto/50">Usados ao registrar despesas no Financeiro (fluxo de caixa). A natureza define se a despesa é um Produto ou um Gasto fixo.</p>
        <div className="flex flex-wrap gap-2">
          <input className={`${field} min-w-[12rem] flex-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel, Insumos, Energia" />
          <select className={`${field} w-40 shrink-0`} value={tipo} onChange={(e) => setTipo(e.target.value as 'produto' | 'fixo')}>
            <option value="fixo">Gasto fixo</option>
            <option value="produto">Produto</option>
          </select>
          <button onClick={salvar} disabled={salvando} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Adicionar'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <div className="border-b border-black/5 px-4 py-2 text-xs text-texto/50">Classifique cada tipo já cadastrado como Gasto fixo ou Produto.</div>
        <table className="w-full text-sm">
          <tbody>
            {itens.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto">{p.nome}</td>
                <td className="px-4 py-2">
                  <select
                    className="rounded-lg border border-black/10 px-2 py-1 text-xs outline-none focus:border-primaria"
                    value={p.tipo}
                    onChange={(e) => classificar(p.id, e.target.value as 'produto' | 'fixo')}
                  >
                    <option value="fixo">Gasto fixo</option>
                    <option value="produto">Produto</option>
                  </select>
                </td>
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

// --- Exames laboratoriais (domínio ordenado) --------------------------------
function ExamesSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<ExamType[]>([])
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listExamTypes().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    const ordem = (itens[itens.length - 1]?.ordem ?? 0) + 1
    try { await createExamType(clinicId, nome.trim(), ordem); setNome(''); recarregar() } finally { setSalvando(false) }
  }
  async function renomear(it: ExamType) { const n = prompt('Novo nome do exame:', it.nome); if (n && n.trim() && n.trim() !== it.nome) { await updateExamType(it.id, { nome: n.trim() }); recarregar() } }
  async function remover(id: string) { if (confirm('Excluir este exame?')) { await deleteExamType(id); recarregar() } }
  // Troca a ordem com o vizinho (persistindo as duas ordens).
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= itens.length) return
    const a = itens[i], b = itens[j]
    await Promise.all([updateExamType(a.id, { ordem: b.ordem }), updateExamType(b.id, { ordem: a.ordem })])
    recarregar()
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Exames laboratoriais</h3>
        <p className="mb-3 text-xs text-texto/50">Painel usado em “Requisitar exames”. A ordem aqui define a ordem na tela e no PDF. Novos exames entram no fim da lista.</p>
        <div className="flex gap-2">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vitamina D" onKeyDown={(e) => { if (e.key === 'Enter') salvar() }} />
          <button onClick={salvar} disabled={salvando} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Adicionar'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <div className="border-b border-black/5 px-4 py-2 text-xs text-texto/50">{itens.length} exames</div>
        <table className="w-full text-sm"><tbody>
          {itens.map((it, i) => (
            <tr key={it.id} className="border-t border-black/5 first:border-t-0">
              <td className="w-8 px-2 py-2 text-texto/30">{i + 1}</td>
              <td className="px-2 py-2 text-texto">{it.nome}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap text-texto/50">
                <button onClick={() => mover(i, -1)} className="px-1 hover:text-texto" title="Subir">↑</button>
                <button onClick={() => mover(i, 1)} className="px-1 hover:text-texto" title="Descer">↓</button>
                <button onClick={() => renomear(it)} className="ml-2 text-xs font-medium text-primaria hover:underline">Renomear</button>
                <button onClick={() => remover(it.id)} className="ml-3 text-xs text-secundaria hover:underline">Excluir</button>
              </td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-sm text-texto/50">Nenhum exame. Aplique a migração 0040 para semear a lista padrão.</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

// --- Serviços Prestados (domínio) -------------------------------------------
function DomainCrud({ titulo, ajuda, placeholder, itens, onAdd, onRename, onDelete }: {
  titulo: string; ajuda: string; placeholder: string; itens: DomItem[]
  onAdd: (nome: string) => Promise<void>; onRename: (id: string, nome: string) => Promise<void>; onDelete: (id: string) => Promise<void>
}) {
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  async function salvar() { if (!nome.trim()) return; setSalvando(true); try { await onAdd(nome.trim()); setNome('') } finally { setSalvando(false) } }
  async function renomear(it: DomItem) { const n = prompt('Novo nome:', it.nome); if (n && n.trim() && n.trim() !== it.nome) await onRename(it.id, n.trim()) }
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">{titulo}</h3>
        <p className="mb-3 text-xs text-texto/50">{ajuda}</p>
        <div className="flex gap-2">
          <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={placeholder} />
          <button onClick={salvar} disabled={salvando} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Adicionar'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm"><tbody>
          {itens.map((it) => (
            <tr key={it.id} className="border-t border-black/5 first:border-t-0">
              <td className="px-4 py-2 text-texto">{it.nome}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <button onClick={() => renomear(it)} className="mr-3 text-xs font-medium text-primaria hover:underline">Renomear</button>
                <button onClick={() => onDelete(it.id)} className="text-xs text-secundaria hover:underline">Excluir</button>
              </td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhum item.</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}

function ServicosSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<DomItem[]>([])
  function recarregar() { listServicos().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  return (
    <DomainCrud
      titulo="Serviços Prestados" placeholder="Ex.: Microagulhamento"
      ajuda="Domínio usado no cadastro do profissional (Corpo Técnico). Cada profissional pode ter um ou mais serviços."
      itens={itens}
      onAdd={async (n) => { await createServico(clinicId, n); recarregar() }}
      onRename={async (id, n) => { await updateServico(id, n); recarregar() }}
      onDelete={async (id) => { if (confirm('Excluir este serviço?')) { await deleteServico(id); recarregar() } }}
    />
  )
}

function VacinasSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<DomItem[]>([])
  function recarregar() { listVacinas().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])
  return (
    <DomainCrud
      titulo="Vacinas obrigatórias" placeholder="Ex.: Hepatite B"
      ajuda="Domínio usado no cadastro do profissional (flags Sim/Não por vacina)."
      itens={itens}
      onAdd={async (n) => { await createVacina(clinicId, n); recarregar() }}
      onRename={async (id, n) => { await updateVacina(id, n); recarregar() }}
      onDelete={async (id) => { if (confirm('Excluir esta vacina?')) { await deleteVacina(id); recarregar() } }}
    />
  )
}

// --- Construtor de formulários administrativos ------------------------------
const TIPOS_CAMPO: { v: FieldType; l: string }[] = [
  { v: 'text', l: 'Texto' }, { v: 'textarea', l: 'Texto longo' }, { v: 'number', l: 'Número' },
  { v: 'date', l: 'Data' }, { v: 'time', l: 'Hora' }, { v: 'boolean', l: 'Sim/Não' },
  { v: 'select', l: 'Lista (uma opção)' }, { v: 'multiselect', l: 'Lista (várias)' },
  { v: 'upload', l: 'Upload de arquivo' }, { v: 'ativo', l: 'Ativo (produto)' },
  { v: 'profissional', l: 'Profissional' }, { v: 'paciente', l: 'Paciente' },
]
const slugKey = (s: string) =>
  (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'campo')

function FormulariosSection({ clinicId }: { clinicId: string }) {
  const [forms, setForms] = useState<FormDef[]>(DEFAULT_FORMS)
  const [chave, setChave] = useState<string>(DEFAULT_FORMS[0].chave)
  const [def, setDef] = useState<FormDef | null>(null)
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function recarregar() { getForms().then((fs) => { setForms(fs); setDef(fs.find((f) => f.chave === chave) ?? null) }).catch(() => {}) }
  useEffect(() => { getForms().then(setForms).catch(() => {}); getClinicCodigo().then(setCodigo).catch(() => {}) }, [])
  useEffect(() => { setDef(forms.find((f) => f.chave === chave) ?? null) }, [chave, forms])

  function setCampos(campos: FormField[]) { setDef((d) => (d ? { ...d, campos } : d)) }
  function editarCampo(i: number, patch: Partial<FormField>) { if (!def) return; setCampos(def.campos.map((c, idx) => idx === i ? { ...c, ...patch } : c)) }
  function moverCampo(i: number, dir: -1 | 1) {
    if (!def) return
    const j = i + dir
    if (j < 0 || j >= def.campos.length) return
    const arr = def.campos.slice();[arr[i], arr[j]] = [arr[j], arr[i]]; setCampos(arr)
  }
  function addCampo() {
    if (!def) return
    const label = 'Novo campo'
    let key = slugKey(label); let n = 1
    while (def.campos.some((c) => c.key === key)) key = `${slugKey(label)}_${++n}`
    setCampos([...def.campos, { key, label, tipo: 'text' }])
  }
  function removerCampo(i: number) { if (!def) return; setCampos(def.campos.filter((_, idx) => idx !== i)) }

  async function salvar() {
    if (!def) return
    setSalvando(true); setMsg(null)
    try {
      await saveFormDef(clinicId, def.chave, { titulo: def.titulo, descricao: def.descricao, campoData: def.campoData, campos: def.campos })
      setMsg('Formulário salvo.'); recarregar()
    } catch { setMsg('Não foi possível salvar.') } finally { setSalvando(false) }
  }
  async function restaurar() {
    if (!def || !confirm('Restaurar este formulário para o padrão de fábrica?')) return
    await resetFormDef(clinicId, def.chave); setMsg('Restaurado ao padrão.'); recarregar()
  }
  async function salvarCodigo() { await saveClinicCodigo(clinicId, codigo); setMsg('Código da clínica salvo.') }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Construtor de formulários (Área Administrativa)</h3>
        <p className="mb-3 text-xs text-texto/50">Personalize os campos de cada formulário. Registros já gravados são preservados; campos removidos deixam de aparecer e campos novos surgem em branco.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${field} max-w-xs`} value={chave} onChange={(e) => setChave(e.target.value)}>
            {forms.map((f) => <option key={f.chave} value={f.chave}>{f.titulo}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-texto/50">Código da clínica (numerador):</label>
            <input className="w-28 rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
            <button onClick={salvarCodigo} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5">Salvar código</button>
          </div>
        </div>
      </div>

      {def && (
        <div className="space-y-4 rounded-xl border border-black/5 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-texto/70">Título</label><input className={field} value={def.titulo} onChange={(e) => setDef({ ...def, titulo: e.target.value })} /></div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Campo de data (filtro/PDF)</label>
              <select className={field} value={def.campoData ?? ''} onChange={(e) => setDef({ ...def, campoData: e.target.value || undefined })}>
                <option value="">— automático —</option>
                {def.campos.filter((c) => c.tipo === 'date').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="mb-1 block text-sm text-texto/70">Descrição</label><input className={field} value={def.descricao ?? ''} onChange={(e) => setDef({ ...def, descricao: e.target.value })} /></div>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-texto/70">Campos</h4>
            <button onClick={addCampo} className="text-xs font-medium text-primaria hover:underline">+ Adicionar campo</button>
          </div>

          <div className="space-y-2">
            {def.campos.map((c, i) => (
              <div key={c.key} className="rounded-lg border border-black/10 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <input className="sm:col-span-4 rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={c.label} onChange={(e) => editarCampo(i, { label: e.target.value })} placeholder="Rótulo" />
                  <select className="sm:col-span-3 rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={c.tipo} onChange={(e) => editarCampo(i, { tipo: e.target.value as FieldType })}>
                    {TIPOS_CAMPO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  {(c.tipo === 'select' || c.tipo === 'multiselect') ? (
                    <input className="sm:col-span-3 rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={(c.opcoes ?? []).join(', ')} onChange={(e) => editarCampo(i, { opcoes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Opções (vírgula)" />
                  ) : <div className="sm:col-span-3" />}
                  <div className="sm:col-span-2 flex items-center justify-end gap-1 text-texto/50">
                    <button onClick={() => moverCampo(i, -1)} className="px-1 hover:text-texto" title="Subir">↑</button>
                    <button onClick={() => moverCampo(i, 1)} className="px-1 hover:text-texto" title="Descer">↓</button>
                    <button onClick={() => removerCampo(i)} className="px-1 text-secundaria hover:underline" title="Excluir">✕</button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-texto/60">
                  <span className="text-texto/30">chave: {c.key}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.obrigatorio} onChange={(e) => editarCampo(i, { obrigatorio: e.target.checked })} /> obrigatório</label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.full} onChange={(e) => editarCampo(i, { full: e.target.checked })} /> linha inteira</label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar formulário'}</button>
            <button onClick={restaurar} className="rounded-lg border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5">Restaurar padrão</button>
            {msg && <span className="text-sm text-texto/60">{msg}</span>}
          </div>
        </div>
      )}
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

// --- Disponibilidade do profissional ----------------------------------------
function DisponibilidadeSection({ clinicId }: { clinicId: string }) {
  const { profile } = useAuth()
  const [profs, setProfs] = useState<Professional[]>([])
  const [profId, setProfId] = useState('')
  const [janelas, setJanelas] = useState<AvailabilityWindow[]>([])
  const [blocks, setBlocks] = useState<BlockRange[]>([])
  // form de novo bloqueio
  const [bIni, setBIni] = useState('')
  const [bFim, setBFim] = useState('')
  const [bMotivo, setBMotivo] = useState('')

  useEffect(() => {
    listProfessionals().then((ps) => {
      const ativos = ps.filter((p) => p.ativo)
      setProfs(ativos)
      // padrão: o próprio profissional logado, senão o primeiro
      const meu = ativos.find((p) => p.id === profile?.professional?.id)
      setProfId((cur) => cur || meu?.id || ativos[0]?.id || '')
    }).catch(() => {})
  }, [profile?.professional?.id])

  function recarregar() {
    if (!profId) return
    listAvailability(profId).then(setJanelas).catch(() => {})
    listBlocks(profId).then(setBlocks).catch(() => {})
  }
  useEffect(recarregar, [profId])

  async function addJanela(diaSemana: number, ini: string, fim: string) {
    if (!profId || fim <= ini) return
    await createAvailability(clinicId, profId, diaSemana, ini, fim); recarregar()
  }
  async function addBlock() {
    if (!bIni) return
    await createBlock(clinicId, profId, bIni, bFim || bIni, bMotivo || null)
    setBIni(''); setBFim(''); setBMotivo(''); recarregar()
  }

  const porDia = (d: number) => janelas.filter((j) => j.dia_semana === d)

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Disponibilidade de atendimento</h3>
        <p className="mb-3 text-xs text-texto/50">Defina os horários de atendimento por profissional e bloqueie datas (férias/ausências). Pacientes só conseguem solicitar horários dentro da disponibilidade e que não estejam ocupados. Sem nenhuma janela cadastrada, o profissional é considerado sempre disponível.</p>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Profissional</label>
          <select className={`${field} max-w-sm`} value={profId} onChange={(e) => setProfId(e.target.value)}>
            {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Janelas semanais — várias faixas por dia */}
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h4 className="mb-1 text-sm font-semibold text-texto/70">Horários por dia da semana</h4>
        <p className="mb-3 text-xs text-texto/50">Você pode cadastrar <strong>várias faixas no mesmo dia</strong> (ex.: 08:00–12:00 e 14:00–17:00). Para intervalo de almoço, basta deixar uma lacuna entre as faixas.</p>
        <div className="space-y-2">
          {DIAS_SEMANA.map((d, i) => (
            <DiaDisponibilidade
              key={i} nome={d} faixas={porDia(i)}
              onAdd={(ini, fim) => addJanela(i, ini, fim)}
              onRemove={async (id) => { await deleteAvailability(id); recarregar() }}
            />
          ))}
        </div>
      </div>

      {/* Bloqueios de datas */}
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h4 className="mb-3 text-sm font-semibold text-texto/70">Datas indisponíveis (férias/ausências)</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="mb-1 block text-xs text-texto/50">De</label><input type="date" className="rounded-lg border border-black/10 px-2 py-2 text-sm" value={bIni} onChange={(e) => setBIni(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs text-texto/50">Até (opcional)</label><input type="date" className="rounded-lg border border-black/10 px-2 py-2 text-sm" value={bFim} onChange={(e) => setBFim(e.target.value)} /></div>
          <div className="flex-1 min-w-[10rem]"><label className="mb-1 block text-xs text-texto/50">Motivo</label><input className={field} value={bMotivo} onChange={(e) => setBMotivo(e.target.value)} placeholder="Ex.: Férias" /></div>
          <button onClick={addBlock} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Bloquear</button>
        </div>
        <div className="mt-3 space-y-1">
          {blocks.length === 0 ? <p className="text-xs text-texto/40">Nenhuma data bloqueada.</p> : blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-1.5 text-sm">
              <span className="text-texto/80">{formatDateBR(b.data_inicio)}{b.data_fim !== b.data_inicio ? ` a ${formatDateBR(b.data_fim)}` : ''}{b.motivo ? ` · ${b.motivo}` : ''}</span>
              <button onClick={async () => { await deleteBlock(b.id); recarregar() }} className="text-xs text-secundaria hover:underline">Remover</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DiaDisponibilidade({ nome, faixas, onAdd, onRemove }: {
  nome: string; faixas: AvailabilityWindow[]
  onAdd: (ini: string, fim: string) => void | Promise<void>; onRemove: (id: string) => void | Promise<void>
}) {
  const [ini, setIni] = useState('08:00')
  const [fim, setFim] = useState('12:00')
  const [erro, setErro] = useState(false)
  const ordenadas = [...faixas].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  async function adicionar() {
    if (fim <= ini) { setErro(true); return }
    setErro(false)
    await onAdd(ini, fim)
  }

  return (
    <div className="rounded-lg border border-black/5 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="w-24 shrink-0 text-sm font-semibold text-texto/70">{nome}</div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {ordenadas.length === 0 ? <span className="text-xs text-texto/30">— sem atendimento —</span> : ordenadas.map((j) => (
            <span key={j.id} className="flex items-center gap-1 rounded-full bg-primaria/10 px-2 py-0.5 text-xs text-primaria">
              {j.hora_inicio.slice(0, 5)}–{j.hora_fim.slice(0, 5)}
              <button onClick={() => onRemove(j.id)} className="text-primaria/60 hover:text-secundaria" title="Remover faixa">✕</button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input type="time" className={`rounded-lg border px-2 py-1.5 text-sm ${erro ? 'border-secundaria' : 'border-black/10'}`} value={ini} onChange={(e) => setIni(e.target.value)} />
          <span className="text-xs text-texto/40">às</span>
          <input type="time" className={`rounded-lg border px-2 py-1.5 text-sm ${erro ? 'border-secundaria' : 'border-black/10'}`} value={fim} onChange={(e) => setFim(e.target.value)} />
          <button onClick={adicionar} className="rounded-lg border border-primaria px-2.5 py-1.5 text-sm font-semibold text-primaria hover:bg-primaria/5" title="Adicionar faixa neste dia">+</button>
        </div>
      </div>
      {erro && <p className="mt-1 text-xs text-secundaria">O horário final deve ser maior que o inicial.</p>}
    </div>
  )
}

// --- Equipe -----------------------------------------------------------------
const NIVEL_LABEL: Record<UserRole, string> = { admin: 'Administrador', profissional: 'Profissional', recepcao: 'Secretaria' }

function EquipeSection({ clinicId }: { clinicId: string }) {
  const [profs, setProfs] = useState<Professional[]>([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Professional | null>(null)
  const [acessoFor, setAcessoFor] = useState<Professional | null>(null)

  function recarregar() {
    listProfessionals().then((ps) => setProfs(ps.filter((p) => p.ativo))).catch(() => {})
  }
  useEffect(recarregar, [])

  async function excluir(p: Professional) {
    if (!confirm(`Remover "${p.nome}" da equipe?`)) return
    await deleteProfessional(p.id)
    recarregar()
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Profissionais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo profissional
        </button>
      </div>
      {modal && <ProfModal clinicId={clinicId} prof={null} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      {editando && <ProfModal clinicId={clinicId} prof={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} />}
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
                <td className="px-4 py-2 text-texto/70">{NIVEL_LABEL[p.role] ?? p.role}</td>
                <td className="px-4 py-2 text-texto/70">{p.conselho_tipo ? `${p.conselho_tipo} ${p.conselho_numero ?? ''}` : '—'}</td>
                <td className="px-4 py-2">{p.auth_user_id ? <span className="text-emerald-600">ativo</span> : <span className="text-texto/40">sem login</span>}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setAcessoFor(p)} className="text-xs font-medium text-primaria hover:underline" disabled={!p.email && !p.auth_user_id} title={!p.email && !p.auth_user_id ? 'Cadastre um e-mail primeiro' : ''}>
                    {p.auth_user_id ? 'Gerenciar acesso' : 'Provisionar acesso'}
                  </button>
                  <button onClick={() => setEditando(p)} className="ml-3 text-xs font-medium text-texto/60 hover:underline">Editar</button>
                  <button onClick={() => excluir(p)} className="ml-3 text-xs font-medium text-secundaria hover:underline">Excluir</button>
                </td>
              </tr>
            ))}
            {profs.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-sm text-texto/50">Nenhum profissional cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Papéis (domínio configurável) ------------------------------------------
function RolesSection({ clinicId }: { clinicId: string }) {
  const [itens, setItens] = useState<TeamRole[]>([])
  const [nome, setNome] = useState('')
  const [nivel, setNivel] = useState<UserRole>('profissional')
  const [salvando, setSalvando] = useState(false)

  function recarregar() { listTeamRoles().then(setItens).catch(() => {}) }
  useEffect(recarregar, [])

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    try { await createTeamRole(clinicId, nome.trim(), nivel); setNome(''); recarregar() } finally { setSalvando(false) }
  }
  async function trocarNivel(id: string, novo: UserRole) { await updateTeamRole(id, { nivel: novo }); recarregar() }
  async function remover(id: string) { if (confirm('Excluir este papel?')) { await deleteTeamRole(id); recarregar() } }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Novo papel</h3>
        <p className="mb-3 text-xs text-texto/50">
          O <strong>nível de acesso</strong> define as permissões: <em>Administrador</em> acessa tudo (inclui Configurações);
          <em> Profissional</em> e <em>Secretaria</em> têm acesso operacional.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className={`${field} min-w-[12rem] flex-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Gerente, Esteticista" />
          <select className={`${field} w-48 shrink-0`} value={nivel} onChange={(e) => setNivel(e.target.value as UserRole)}>
            <option value="admin">Administrador</option>
            <option value="profissional">Profissional</option>
            <option value="recepcao">Secretaria</option>
          </select>
          <button onClick={salvar} disabled={salvando} className="shrink-0 rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? '…' : 'Adicionar'}</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {itens.map((r) => (
              <tr key={r.id} className="border-t border-black/5 first:border-t-0">
                <td className="px-4 py-2 text-texto">{r.nome}</td>
                <td className="px-4 py-2">
                  <select className="rounded-lg border border-black/10 px-2 py-1 text-xs outline-none focus:border-primaria" value={r.nivel} onChange={(e) => trocarNivel(r.id, e.target.value as UserRole)}>
                    <option value="admin">Administrador</option>
                    <option value="profissional">Profissional</option>
                    <option value="recepcao">Secretaria</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right"><button onClick={() => remover(r.id)} className="text-xs text-secundaria hover:underline">Excluir</button></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td className="px-4 py-3 text-sm text-texto/50">Nenhum papel cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Permissões por nível de acesso -----------------------------------------
function PermissoesSection({ clinicId }: { clinicId: string }) {
  const { reload } = usePermissions()
  const [matrix, setMatrix] = useState<PermMatrix | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { getPermissions().then(setMatrix).catch(() => {}) }, [])

  function toggle(nivel: 'profissional' | 'recepcao', key: string) {
    setMatrix((m) => {
      if (!m) return m
      const set = new Set(m[nivel])
      set.has(key) ? set.delete(key) : set.add(key)
      return { ...m, [nivel]: [...set] }
    })
  }
  function temAcesso(nivel: 'profissional' | 'recepcao', key: string) {
    return matrix?.[nivel].includes(key) ?? false
  }

  async function salvar() {
    if (!matrix) return
    setSalvando(true); setMsg(null)
    try { await savePermissions(clinicId, matrix); reload(); setMsg('Permissões salvas.') }
    catch { setMsg('Não foi possível salvar.') }
    finally { setSalvando(false) }
  }

  if (!matrix) return <p className="text-sm text-texto/50">Carregando…</p>

  const grupos = ['Menu lateral', 'Abas do paciente'] as const
  const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-primaria' : 'bg-black/15'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  )

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">Permissões por nível de acesso</h3>
        <p className="mb-2 text-xs text-texto/50">
          Ligue/desligue cada funcionalidade por nível. O <strong>Administrador</strong> sempre tem acesso total
          (não editável). O <strong>Paciente</strong> usa apenas o Portal do Paciente.
        </p>
        <p className="text-xs text-texto/40">Os papéis cadastrados em “Papéis” herdam as permissões do seu nível de acesso.</p>
      </div>

      {grupos.map((g) => (
        <div key={g} className="overflow-hidden rounded-xl border border-black/5 bg-white">
          <div className="border-b border-black/5 bg-black/[0.02] px-4 py-2 text-sm font-semibold text-texto/70">{g}</div>
          <table className="w-full text-sm">
            <thead className="text-left text-texto/50">
              <tr>
                <th className="px-4 py-2 font-medium">Funcionalidade</th>
                <th className="px-3 py-2 text-center font-medium">{PERM_NIVEL_LABEL.admin}</th>
                {NIVEIS_EDITAVEIS.map((n) => <th key={n} className="px-3 py-2 text-center font-medium">{PERM_NIVEL_LABEL[n]}</th>)}
              </tr>
            </thead>
            <tbody>
              {FEATURES.filter((f) => f.group === g).map((f) => (
                <tr key={f.key} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{f.label}</td>
                  <td className="px-3 py-2 text-center"><span className="text-xs font-medium text-emerald-600">sempre</span></td>
                  {NIVEIS_EDITAVEIS.map((n) => (
                    <td key={n} className="px-3 py-2">
                      <div className="flex justify-center"><Switch on={temAcesso(n, f.key)} onClick={() => toggle(n, f.key)} /></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {salvando ? 'Salvando…' : 'Salvar permissões'}
        </button>
        <button onClick={() => setMatrix(defaultsMatrix())} className="rounded-lg border border-black/10 px-4 py-2.5 text-sm hover:bg-black/5">Restaurar padrões</button>
        {msg && <span className="text-sm text-texto/60">{msg}</span>}
      </div>
    </div>
  )
}

function AcessoStaffModal({ prof, onClose, onSaved }: { prof: Professional; onClose: () => void; onSaved: () => void }) {
  const temLogin = !!prof.auth_user_id
  const [senha, setSenha] = useState(gerarSenhaProvisoria())
  const [novoEmail, setNovoEmail] = useState(prof.email ?? '')
  const [busy, setBusy] = useState<'senha' | 'email' | null>(null)
  const [resultado, setResultado] = useState<{ login: string; senha: string } | null>(null)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function aplicarSenha() {
    if (senha.length < 6) { setErro('Senha mínima de 6 caracteres.'); return }
    setBusy('senha'); setErro(null)
    try {
      const { login } = await manageStaffAccess({ professionalId: prof.id, password: senha })
      setResultado({ login, senha })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aplicar a senha.')
    } finally { setBusy(null) }
  }

  async function alterarEmail() {
    const email = novoEmail.trim()
    setErro(null); setEmailMsg(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErro('Informe um e-mail válido.'); return }
    if (email.toLowerCase() === (prof.email ?? '').toLowerCase()) { setEmailMsg('Este já é o e-mail de login atual.'); return }
    if (!confirm(`Alterar o e-mail de login de ${prof.nome} para ${email}? Os relacionamentos e o histórico são preservados.`)) return
    setBusy('email')
    try {
      await manageStaffAccess({ professionalId: prof.id, novoEmail: email })
      setEmailMsg('E-mail de login alterado com sucesso.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o e-mail.')
    } finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">Gerenciar acesso — {prof.nome}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        {resultado ? (
          <div>
            <p className="text-sm text-texto/70">Entregue as credenciais ao profissional. No 1º acesso ele será obrigado a redefinir a senha.</p>
            <div className="mt-3 space-y-2 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm">
              <div><span className="text-texto/50">Login:</span> <strong>{resultado.login}</strong></div>
              <div><span className="text-texto/50">Senha provisória:</span> <strong>{resultado.senha}</strong></div>
            </div>
            <div className="mt-5 flex justify-end"><button onClick={onSaved} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Concluir</button></div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* E-mail de login (chave de acesso) */}
            <div className="rounded-xl border border-black/5 p-4">
              <h3 className="mb-1 text-sm font-semibold text-texto">E-mail de login (chave de acesso)</h3>
              <p className="mb-2 text-xs text-texto/50">
                {temLogin
                  ? 'Login atual: ' + (prof.email ?? '—') + '. Alterar troca a chave de acesso preservando todo o histórico.'
                  : 'Defina o e-mail e provisione o acesso abaixo.'}
              </p>
              <div className="flex gap-2">
                <input className={field} type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="novo@dominio.com.br" />
                {temLogin && (
                  <button type="button" onClick={alterarEmail} disabled={busy !== null}
                    className="shrink-0 rounded-lg border border-primaria px-3 text-sm font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50">
                    {busy === 'email' ? '…' : 'Alterar'}
                  </button>
                )}
              </div>
              {emailMsg && <p className="mt-2 text-xs text-emerald-600">{emailMsg}</p>}
              {!temLogin && <p className="mt-2 text-xs text-texto/50">Para criar o acesso, o e-mail acima será usado como login.</p>}
            </div>

            {/* Senha */}
            <div className="rounded-xl border border-black/5 p-4">
              <h3 className="mb-1 text-sm font-semibold text-texto">{temLogin ? 'Forçar nova senha' : 'Senha provisória'}</h3>
              <p className="mb-2 text-xs text-texto/50">Senha provisória — o profissional troca obrigatoriamente no 1º acesso.</p>
              <div className="flex gap-2">
                <input className={field} value={senha} onChange={(e) => setSenha(e.target.value)} />
                <button type="button" onClick={() => setSenha(gerarSenhaProvisoria())} className="shrink-0 rounded-lg border border-black/10 px-3 text-sm hover:bg-black/5">Gerar</button>
              </div>
            </div>

            {erro && <p className="text-sm text-secundaria">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Fechar</button>
              <button onClick={aplicarSenha} disabled={busy !== null}
                className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {busy === 'senha' ? 'Processando…' : temLogin ? 'Forçar nova senha' : 'Provisionar acesso'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfModal({ clinicId, prof, onClose, onSaved }: { clinicId: string; prof: Professional | null; onClose: () => void; onSaved: () => void }) {
  const editar = !!prof
  const [papeis, setPapeis] = useState<TeamRole[]>([])
  const [f, setF] = useState<ProfessionalInput>(
    prof
      ? { nome: prof.nome, email: prof.email, telefone: prof.telefone, role: prof.role,
          conselho_tipo: prof.conselho_tipo, conselho_numero: prof.conselho_numero, conselho_uf: prof.conselho_uf,
          formacao: prof.formacao ?? '', responsavel_tecnico: prof.responsavel_tecnico ?? false, cpf: prof.cpf ?? '',
          servicos_prestados: prof.servicos_prestados ?? [], vacinas: prof.vacinas ?? {} }
      : { nome: '', role: 'profissional', responsavel_tecnico: false, servicos_prestados: [], vacinas: {} },
  )
  const [servicos, setServicos] = useState<DomItem[]>([])
  const [vacinas, setVacinas] = useState<DomItem[]>([])
  const [salvando, setSalvando] = useState(false)
  const set = <K extends keyof ProfessionalInput>(k: K, v: ProfessionalInput[K]) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => { listTeamRoles().then(setPapeis).catch(() => {}) }, [])
  useEffect(() => { listServicos().then(setServicos).catch(() => {}); listVacinas().then(setVacinas).catch(() => {}) }, [])

  const servicosSel = f.servicos_prestados ?? []
  function toggleServico(nome: string) {
    const arr = servicosSel.includes(nome) ? servicosSel.filter((x) => x !== nome) : [...servicosSel, nome]
    set('servicos_prestados', arr)
  }
  const vacinasSel = f.vacinas ?? {}
  function toggleVacina(nome: string) { set('vacinas', { ...vacinasSel, [nome]: !vacinasSel[nome] }) }

  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    try {
      if (prof) await updateProfessional(prof.id, f)
      else await createProfessional(clinicId, f)
      onSaved()
    } catch {
      setSalvando(false)
    }
  }

  // Opções de papel: do domínio configurável; fallback para os 3 níveis base.
  const opcoes = papeis.length > 0
    ? papeis.map((p) => ({ valor: p.nivel, rotulo: p.nome }))
    : [{ valor: 'admin' as UserRole, rotulo: 'Administrador' }, { valor: 'profissional' as UserRole, rotulo: 'Profissional' }, { valor: 'recepcao' as UserRole, rotulo: 'Secretaria' }]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar profissional' : 'Novo profissional'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-texto/70">Nome *</label><input className={field} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">E-mail (usado no login)</label>
            <input className={`${field} ${prof?.auth_user_id ? 'bg-black/[0.03] text-texto/60' : ''}`} value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} disabled={!!prof?.auth_user_id} readOnly={!!prof?.auth_user_id} />
            {prof?.auth_user_id && <p className="mt-1 text-xs text-texto/50">O acesso já está ativo. Para trocar a chave de login, use <strong>Gerenciar acesso</strong> (mantém o histórico).</p>}
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Telefone</label><input className={field} value={f.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Papel</label>
            <select className={field} value={f.role} onChange={(e) => set('role', e.target.value as UserRole)}>
              {opcoes.map((o, i) => <option key={`${o.valor}-${i}`} value={o.valor}>{o.rotulo}</option>)}
            </select>
            <p className="mt-1 text-xs text-texto/50">Gerencie os papéis em Configurações → Papéis.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="mb-1 block text-sm text-texto/70">Conselho</label><input className={field} placeholder="CRBM…" value={f.conselho_tipo ?? ''} onChange={(e) => set('conselho_tipo', e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">Número</label><input className={field} value={f.conselho_numero ?? ''} onChange={(e) => set('conselho_numero', e.target.value)} /></div>
            <div><label className="mb-1 block text-sm text-texto/70">UF</label><input className={field} value={f.conselho_uf ?? ''} onChange={(e) => set('conselho_uf', e.target.value)} /></div>
          </div>

          {/* Corpo Técnico (Área Administrativa) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm text-texto/70">Formação</label><input className={field} value={f.formacao ?? ''} onChange={(e) => set('formacao', e.target.value)} placeholder="Ex.: Enfermeira Esteta" /></div>
            <div><label className="mb-1 block text-sm text-texto/70">CPF</label><input className={field} value={f.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-texto/80">
            <input type="checkbox" checked={!!f.responsavel_tecnico} onChange={(e) => set('responsavel_tecnico', e.target.checked)} /> É o Responsável Técnico?
          </label>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Serviços prestados</label>
            {servicos.length === 0 ? (
              <p className="text-xs text-texto/40">Cadastre serviços em Configurações → Serviços Prestados.</p>
            ) : (
              <div className="flex flex-wrap gap-2 rounded-lg border border-black/10 p-2">
                {servicos.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-xs text-texto/80">
                    <input type="checkbox" checked={servicosSel.includes(s.nome)} onChange={() => toggleServico(s.nome)} /> {s.nome}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-texto/70">Vacinações obrigatórias</label>
            {vacinas.length === 0 ? (
              <p className="text-xs text-texto/40">Cadastre vacinas em Configurações → Vacinas.</p>
            ) : (
              <div className="flex flex-wrap gap-3 rounded-lg border border-black/10 p-2">
                {vacinas.map((vac) => (
                  <label key={vac.id} className="flex items-center gap-1.5 text-xs text-texto/80">
                    <input type="checkbox" checked={!!vacinasSel[vac.nome]} onChange={() => toggleVacina(vac.nome)} /> {vac.nome}
                  </label>
                ))}
              </div>
            )}
          </div>

          {!editar && <p className="text-xs text-texto/50">O vínculo de login é feito automaticamente no primeiro acesso (por e-mail).</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : editar ? 'Salvar' : 'Cadastrar'}</button>
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

  // WhatsApp (envio de receitas/documentos a fornecedores)
  const [wa, setWa] = useState<IntegrationSetting>({
    clinic_id: clinicId, categoria: 'whatsapp', provider: '', modo: 'producao', config_publica: {}, ativo: false,
  })
  const [waMsg, setWaMsg] = useState<string | null>(null)
  const [waSalvando, setWaSalvando] = useState(false)

  useEffect(() => {
    getIntegration('pagamento').then((data) => { if (data) setS(data) }).catch(() => {})
    getIntegration('whatsapp').then((data) => { if (data) setWa(data) }).catch(() => {})
  }, [])

  const cfg = (k: string) => (s.config_publica?.[k] as string) || ''
  const setCfg = (k: string, v: string) => setS({ ...s, config_publica: { ...s.config_publica, [k]: v } })
  const waCfg = (k: string) => (wa.config_publica?.[k] as string) || ''
  const setWaCfg = (k: string, v: string) => setWa({ ...wa, config_publica: { ...wa.config_publica, [k]: v } })

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

  async function salvarWa() {
    setWaSalvando(true)
    setWaMsg(null)
    try {
      await upsertIntegration(wa)
      setWaMsg('Integração WhatsApp salva.')
    } catch {
      setWaMsg('Não foi possível salvar.')
    } finally {
      setWaSalvando(false)
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

      <div className="rounded-xl border border-black/5 bg-white p-5">
        <h3 className="mb-1 font-semibold text-texto">WhatsApp (envio de receitas/documentos)</h3>
        <p className="mb-4 text-xs text-texto/50">
          Permite enviar receitas de manipulação a fornecedores por WhatsApp. Informe aqui apenas dados públicos do provedor.
          O token/segredo de API deve ser configurado como segredo do servidor (Edge Function send-whatsapp), nunca aqui.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-texto/70">Provedor</label>
            <select className={field} value={wa.provider ?? ''} onChange={(e) => setWa({ ...wa, provider: e.target.value })}>
              <option value="">Selecione…</option>
              <option value="meta">WhatsApp Cloud API (Meta)</option>
              <option value="twilio">Twilio</option>
              <option value="zapi">Z-API</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div><label className="mb-1 block text-sm text-texto/70">Número de envio (From)</label><input className={field} value={waCfg('from_number')} onChange={(e) => setWaCfg('from_number', e.target.value)} placeholder="Ex.: 5511999998888" /></div>
          <div><label className="mb-1 block text-sm text-texto/70">URL da API</label><input className={field} value={waCfg('api_url')} onChange={(e) => setWaCfg('api_url', e.target.value)} placeholder="https://…" /></div>
          <label className="flex items-center gap-2 text-sm text-texto/80">
            <input type="checkbox" checked={wa.ativo} onChange={(e) => setWa({ ...wa, ativo: e.target.checked })} /> Integração ativa
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={salvarWa} disabled={waSalvando} className="rounded-lg bg-primaria px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {waSalvando ? 'Salvando…' : 'Salvar WhatsApp'}
        </button>
        {waMsg && <span className="text-sm text-texto/60">{waMsg}</span>}
      </div>
    </div>
  )
}
