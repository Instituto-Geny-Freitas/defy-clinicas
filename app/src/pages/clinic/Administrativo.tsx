import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import {
  DEFAULT_FORMS, FORM_GROUPS, getForms, getClinicCodigo,
  type FormDef, type FormField,
} from '@/lib/adminForms'
import {
  createRecord, deleteRecord, listRecords, nextSeq, signedAdminUrl, updateRecord, uploadAdminFile,
  type AdminRecord, type RecordsFilter,
} from '@/lib/admin'
import { listProfessionals } from '@/lib/settings'
import { listPatients } from '@/lib/patients'
import { listActiveIngredients, type ActiveIngredient } from '@/lib/domains'
import { buildAdminFormPdf, buildCorpoTecnicoPdf } from '@/lib/adminPdf'
import { formatDateBR, localDateToday, parseLocalDate } from '@/lib/format'
import type { Patient, Professional } from '@/lib/types'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function abrirPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
function idadeDe(nascimento?: string | null): number | '' {
  const d = parseLocalDate(nascimento)
  if (!d) return ''
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)))
}

export default function Administrativo() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [forms, setForms] = useState<FormDef[]>(DEFAULT_FORMS)
  const [sel, setSel] = useState<string>('corpo_tecnico')

  // Recarrega as definições ao montar e sempre que a aba voltar ao foco — assim
  // personalizações feitas em Configurações (mesmo em outra aba) refletem aqui.
  useEffect(() => {
    const reload = () => getForms().then(setForms).catch(() => {})
    reload()
    const onVis = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!clinicId) return null
  const defAtual = forms.find((f) => f.chave === sel) ?? null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">Administrativo</h1>
      <p className="mt-1 text-sm text-texto/60">Registros operacionais e de qualidade da clínica. Cada formulário gera PDF com filtro por data, mês/ano ou faixa.</p>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row">
        {/* Subnav */}
        <nav className="shrink-0 lg:w-64">
          <button onClick={() => setSel('corpo_tecnico')}
            className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition ${sel === 'corpo_tecnico' ? 'bg-primaria text-white' : 'text-texto/70 hover:bg-black/5'}`}>
            Corpo Técnico
          </button>
          {FORM_GROUPS.map((g) => (
            <div key={g} className="mt-3">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-texto/40">{g}</div>
              {forms.filter((f) => f.grupo === g).map((f) => (
                <button key={f.chave} onClick={() => setSel(f.chave)}
                  className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition ${sel === f.chave ? 'bg-primaria text-white' : 'text-texto/70 hover:bg-black/5'}`}>
                  {f.titulo}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {sel === 'corpo_tecnico' ? <CorpoTecnico /> : defAtual ? <FormModule clinicId={clinicId} def={defAtual} /> : null}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Corpo Técnico — relação da equipe
// =============================================================================
function CorpoTecnico() {
  const clinic = useClinic()
  const [profs, setProfs] = useState<Professional[]>([])
  const [filtroServico, setFiltroServico] = useState('')

  useEffect(() => { listProfessionals().then((ps) => setProfs(ps.filter((p) => p.ativo))).catch(() => {}) }, [])

  const servicosUnicos = useMemo(() => {
    const s = new Set<string>()
    profs.forEach((p) => (p.servicos_prestados ?? []).forEach((x) => s.add(x)))
    return [...s].sort()
  }, [profs])

  const visiveis = filtroServico ? profs.filter((p) => (p.servicos_prestados ?? []).includes(filtroServico)) : profs

  function gerarPdf() {
    const { blob } = buildCorpoTecnicoPdf({ clinic, profs: visiveis })
    abrirPdf(blob)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-texto">Corpo Técnico — Relação da Equipe</h2>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-black/10 px-3 py-2 text-sm" value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}>
            <option value="">Todos os serviços</option>
            {servicosUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={gerarPdf} className="rounded-lg border border-primaria px-3 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5">Gerar PDF</button>
        </div>
      </div>
      <p className="text-xs text-texto/50">Os campos abaixo são editados no cadastro do profissional (Configurações → Equipe).</p>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60">
            <tr>
              <th className="px-3 py-2 font-medium">Profissional</th>
              <th className="px-3 py-2 font-medium">Formação</th>
              <th className="px-3 py-2 font-medium">Resp. Téc.</th>
              <th className="px-3 py-2 font-medium">Conselho</th>
              <th className="px-3 py-2 font-medium">CPF</th>
              <th className="px-3 py-2 font-medium">Serviços</th>
              <th className="px-3 py-2 font-medium">Vacinas</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((p) => {
              const v = p.vacinas ?? {}
              const vac = Object.keys(v).filter((k) => v[k])
              return (
                <tr key={p.id} className="border-t border-black/5 align-top">
                  <td className="px-3 py-2 text-texto">{p.nome}</td>
                  <td className="px-3 py-2 text-texto/70">{p.formacao ?? '—'}</td>
                  <td className="px-3 py-2">{p.responsavel_tecnico ? <span className="font-medium text-emerald-600">Sim</span> : <span className="text-texto/40">Não</span>}</td>
                  <td className="px-3 py-2 text-texto/70">{[p.conselho_tipo, p.conselho_numero].filter(Boolean).join(' ')}{p.conselho_uf ? `-${p.conselho_uf}` : ''}{!p.conselho_tipo && '—'}</td>
                  <td className="px-3 py-2 text-texto/70">{p.cpf ?? '—'}</td>
                  <td className="px-3 py-2 text-texto/60">{(p.servicos_prestados ?? []).join('; ') || '—'}</td>
                  <td className="px-3 py-2 text-texto/60">{vac.length ? vac.join(', ') : '—'}</td>
                </tr>
              )
            })}
            {visiveis.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-sm text-texto/50">Nenhum profissional.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// Módulo de formulário genérico (lista + filtro + CRUD + PDF)
// =============================================================================
function FormModule({ clinicId, def }: { clinicId: string; def: FormDef }) {
  const clinic = useClinic()
  const [registros, setRegistros] = useState<AdminRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<AdminRecord | 'novo' | null>(null)
  const [filtro, setFiltro] = useState<RecordsFilter>({ modo: 'tudo' })

  function recarregar() {
    setCarregando(true)
    listRecords(def.chave, filtro).then(setRegistros).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [def.chave, filtro]) // eslint-disable-line react-hooks/exhaustive-deps

  async function excluir(r: AdminRecord) {
    if (!confirm('Excluir este registro?')) return
    await deleteRecord(r.id)
    recarregar()
  }

  function periodoLabel(): string {
    if (filtro.modo === 'mes' && filtro.ano != null && filtro.mes != null) return `${MESES[filtro.mes]}/${filtro.ano}`
    if (filtro.modo === 'faixa' && filtro.de && filtro.ate) return `${formatDateBR(filtro.de)} a ${formatDateBR(filtro.ate)}`
    return 'Todos os registros'
  }
  function gerarPdf() {
    const { blob } = buildAdminFormPdf({ clinic, def, records: registros, periodoLabel: periodoLabel() })
    abrirPdf(blob)
  }

  // Colunas da lista: todos os campos simples (a tabela rola na horizontal).
  // Textareas e uploads ficam fora das colunas para não estourar a largura.
  const colsLista = def.campos.filter((c) => c.tipo !== 'textarea' && c.tipo !== 'upload')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-texto">{def.titulo}</h2>
          {def.descricao && <p className="text-xs text-texto/50">{def.descricao}</p>}
        </div>
        <button onClick={() => setEditando('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">+ Novo</button>
      </div>

      <FilterBar filtro={filtro} setFiltro={setFiltro} onPdf={gerarPdf} />

      {editando && (
        <RecordModal
          clinicId={clinicId} def={def}
          record={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar() }}
        />
      )}

      {carregando ? <p className="text-sm text-texto/50">Carregando…</p> : registros.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhum registro {filtro.modo !== 'tudo' ? 'no período' : ''}.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                {def.numerado && <th className="px-3 py-2 font-medium">Nº</th>}
                {def.vinculo === 'paciente' && <th className="px-3 py-2 font-medium">Paciente</th>}
                {colsLista.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>)}
                <th className="px-3 py-2 font-medium">Registrado por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  {def.numerado && <td className="px-3 py-2 font-medium text-texto">{r.seq ?? '—'}</td>}
                  {def.vinculo === 'paciente' && <td className="px-3 py-2 text-texto/80">{r.patients?.nome ?? '—'}</td>}
                  {colsLista.map((c) => <td key={c.key} className="px-3 py-2 text-texto/70"><Cell field={c} value={r.dados[c.key]} /></td>)}
                  <td className="px-3 py-2 text-texto/50">{r.created_by_nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(r)} className="mr-3 text-xs font-medium text-primaria hover:underline">Editar</button>
                    <button onClick={() => excluir(r)} className="text-xs text-secundaria hover:underline">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Cell({ field: f, value }: { field: FormField; value: unknown }) {
  if (f.tipo === 'boolean') {
    return value
      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Sim</span>
      : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Não</span>
  }
  if (value == null || value === '') return <span className="text-texto/30">—</span>
  if (f.tipo === 'date') return <>{formatDateBR(String(value))}</>
  if (f.tipo === 'number') {
    const n = typeof value === 'number' ? value : Number(value)
    if (isNaN(n)) return <span className="text-texto/30">—</span>
    return <>{n}{f.suffix ? ` ${f.suffix}` : ''}</>
  }
  if (f.tipo === 'multiselect' && Array.isArray(value)) return <>{value.join(', ')}</>
  return <>{String(value)}{f.suffix ? ` ${f.suffix}` : ''}</>
}

// --- Barra de filtro de período + PDF ---------------------------------------
function FilterBar({ filtro, setFiltro, onPdf }: { filtro: RecordsFilter; setFiltro: (f: RecordsFilter) => void; onPdf: () => void }) {
  const anoAtual = new Date().getFullYear()
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - i)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white p-3">
      <span className="text-xs font-medium text-texto/50">Filtro:</span>
      <select className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={filtro.modo}
        onChange={(e) => {
          const modo = e.target.value as RecordsFilter['modo']
          setFiltro(modo === 'mes' ? { modo, mes: new Date().getMonth(), ano: anoAtual } : { modo })
        }}>
        <option value="tudo">Tudo</option>
        <option value="mes">Mês/Ano</option>
        <option value="faixa">Faixa de datas</option>
      </select>

      {filtro.modo === 'mes' && (
        <>
          <select className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={filtro.mes ?? 0} onChange={(e) => setFiltro({ ...filtro, mes: Number(e.target.value) })}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={filtro.ano ?? anoAtual} onChange={(e) => setFiltro({ ...filtro, ano: Number(e.target.value) })}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </>
      )}
      {filtro.modo === 'faixa' && (
        <>
          <input type="date" className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={filtro.de ?? ''} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} />
          <span className="text-xs text-texto/40">até</span>
          <input type="date" className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={filtro.ate ?? ''} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} />
        </>
      )}

      <div className="ml-auto">
        <button onClick={onPdf} className="rounded-lg border border-primaria px-3 py-1.5 text-sm font-semibold text-primaria hover:bg-primaria/5">Gerar PDF</button>
      </div>
    </div>
  )
}

// --- Modal de criação/edição (renderiza os campos da definição) -------------
function RecordModal({ clinicId, def, record, onClose, onSaved }: {
  clinicId: string; def: FormDef; record: AdminRecord | null; onClose: () => void; onSaved: () => void
}) {
  const { profile } = useAuth()
  const editar = !!record
  const profNome = profile?.professional?.nome ?? ''

  const [dados, setDados] = useState<Record<string, unknown>>(() => {
    if (record) return { ...record.dados }
    // valores iniciais (auto)
    const init: Record<string, unknown> = {}
    const hoje = localDateToday()
    for (const c of def.campos) {
      if (c.auto === 'profissional_logado') init[c.key] = profNome
      else if (c.auto === 'hoje') init[c.key] = hoje
      else if (c.tipo === 'boolean') init[c.key] = false
    }
    return init
  })
  const [patientId, setPatientId] = useState<string | null>(record?.patient_id ?? null)
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [profs, setProfs] = useState<Professional[]>([])
  const [ativos, setAtivos] = useState<ActiveIngredient[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const precisaPacientes = def.vinculo === 'paciente'
  const precisaProfs = def.campos.some((c) => c.tipo === 'profissional')
  const precisaAtivos = def.campos.some((c) => c.tipo === 'ativo')

  useEffect(() => {
    if (precisaPacientes) listPatients().then(setPacientes).catch(() => {})
    if (precisaProfs) listProfessionals().then((p) => setProfs(p.filter((x) => x.ativo))).catch(() => {})
    if (precisaAtivos) listActiveIngredients().then(setAtivos).catch(() => {})
  }, [precisaPacientes, precisaProfs, precisaAtivos])

  const set = (k: string, v: unknown) => setDados((s) => ({ ...s, [k]: v }))

  // Paciente selecionado → preenche idade/sexo automáticos.
  function escolherPaciente(id: string) {
    setPatientId(id || null)
    const p = pacientes.find((x) => x.id === id)
    if (p) {
      for (const c of def.campos) {
        if (c.auto === 'paciente_idade') set(c.key, idadeDe(p.nascimento))
        if (c.auto === 'paciente_sexo' && p.sexo) set(c.key, p.sexo)
      }
    }
  }

  // Ativo selecionado → auto-preenche campos com fonte 'ativo.*'.
  function escolherAtivo(campoKey: string, nome: string) {
    set(campoKey, nome)
    const a = ativos.find((x) => x.nome === nome)
    if (!a) return
    for (const c of def.campos) {
      if (c.fonte === 'ativo.validade') set(c.key, a.validade ?? '')
      if (c.fonte === 'ativo.lote') set(c.key, a.lote ?? '')
    }
  }

  async function onUpload(campoKey: string, file: File) {
    try {
      const path = await uploadAdminFile(def.chave, file)
      set(campoKey, path)
    } catch { setErro('Falha no upload do arquivo.') }
  }
  async function abrirAnexo(path: string) {
    const url = await signedAdminUrl(path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function refDataDe(): string | null {
    const campo = def.campoData ?? def.campos.find((c) => c.tipo === 'date')?.key
    const v = campo ? dados[campo] : null
    return (typeof v === 'string' && v) ? v : null
  }

  async function salvar() {
    // valida obrigatórios
    for (const c of def.campos) {
      if (c.obrigatorio && !dados[c.key]) { setErro(`Preencha: ${c.label}`); return }
    }
    if (precisaPacientes && !patientId) { setErro('Selecione o paciente.'); return }
    setSalvando(true); setErro(null)
    const refData = refDataDe()
    try {
      if (editar && record) {
        await updateRecord(record.id, { patientId, refData, dados })
      } else {
        let seq: string | null = null
        if (def.numerado) {
          const ano = refData ? Number(refData.slice(0, 4)) : new Date().getFullYear()
          const codigo = await getClinicCodigo()
          seq = await nextSeq(clinicId, def.numeradoEscopo ?? def.chave, codigo, ano)
        }
        await createRecord({ clinicId, formChave: def.chave, patientId, refData, dados, createdByNome: profNome, seq })
      }
      onSaved()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{editar ? 'Editar registro' : `Novo — ${def.titulo}`}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        {def.numerado && !editar && <p className="mb-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-texto/60">O número do registro é gerado automaticamente ao salvar (formato nnnnn/ano/código da clínica).</p>}
        {def.numerado && editar && record?.seq && <p className="mb-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-texto/60">Registro Nº <strong>{record.seq}</strong></p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {precisaPacientes && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-texto/70">Paciente *</label>
              <select className={field} value={patientId ?? ''} onChange={(e) => escolherPaciente(e.target.value)}>
                <option value="">Selecione…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}

          {def.campos.map((c) => (
            <div key={c.key} className={c.full || c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-sm text-texto/70">{c.label}{c.obrigatorio && ' *'}</label>
              <FieldInput
                field={c} value={dados[c.key]} profs={profs} ativos={ativos}
                onChange={(v) => set(c.key, v)}
                onAtivo={(nome) => escolherAtivo(c.key, nome)}
                onUpload={(file) => onUpload(c.key, file)}
                onAbrirAnexo={abrirAnexo}
              />
            </div>
          ))}
        </div>

        {erro && <p className="mt-3 text-sm text-secundaria">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function FieldInput({ field: c, value, profs, ativos, onChange, onAtivo, onUpload, onAbrirAnexo }: {
  field: FormField; value: unknown; profs: Professional[]; ativos: ActiveIngredient[]
  onChange: (v: unknown) => void; onAtivo: (nome: string) => void
  onUpload: (file: File) => void; onAbrirAnexo: (path: string) => void
}) {
  const v = value
  switch (c.tipo) {
    case 'textarea':
      return <textarea rows={3} className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input type="number" step="any" className={field} value={(v as number | string) ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          {c.suffix && <span className="shrink-0 text-sm text-texto/50">{c.suffix}</span>}
        </div>
      )
    case 'date':
      return <input type="date" className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'time':
      return <input type="time" className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'boolean':
      return (
        <label className="flex items-center gap-2 py-1.5 text-sm text-texto/80">
          <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} /> {v ? 'Sim' : 'Não'}
        </label>
      )
    case 'select':
      return (
        <select className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(c.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'multiselect':
      return (
        <div className="flex flex-wrap gap-2 rounded-lg border border-black/10 p-2">
          {(c.opcoes ?? []).map((o) => {
            const arr = Array.isArray(v) ? (v as string[]) : []
            const on = arr.includes(o)
            return (
              <label key={o} className="flex items-center gap-1.5 text-xs text-texto/80">
                <input type="checkbox" checked={on} onChange={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])} /> {o}
              </label>
            )
          })}
        </div>
      )
    case 'profissional':
      return (
        <select className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {profs.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
          {/* preserva valor atual mesmo se o profissional não estiver mais na lista */}
          {!!v && !profs.some((p) => p.nome === v) && <option value={v as string}>{v as string}</option>}
        </select>
      )
    case 'ativo':
      return (
        <select className={field} value={(v as string) ?? ''} onChange={(e) => onAtivo(e.target.value)}>
          <option value="">—</option>
          {ativos.map((a) => <option key={a.id} value={a.nome}>{a.nome}</option>)}
          {!!v && !ativos.some((a) => a.nome === v) && <option value={v as string}>{v as string}</option>}
        </select>
      )
    case 'upload':
      return (
        <div className="flex items-center gap-2">
          <input type="file" className="text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }} />
          {typeof v === 'string' && v && <button type="button" onClick={() => onAbrirAnexo(v)} className="text-xs font-medium text-primaria hover:underline">Abrir anexo</button>}
        </div>
      )
    default:
      return <input className={field} value={(v as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
}
