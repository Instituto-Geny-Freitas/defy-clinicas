import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import {
  createTemplate,
  listTemplates,
  setTemplateActive,
  slugify,
  updateTemplate,
  type DocumentTemplate,
  type ReminderItem,
  type TemplateField,
  type TemplateInput,
} from '@/lib/templates'
import type { AutoFonte, FieldType, PreenchidoPor } from '@/forms/types'
import { listDocumentTypes, type DocumentType } from '@/lib/documentTypes'

const field = 'w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria'
const TIPOS_CAMPO: { v: FieldType; l: string }[] = [
  { v: 'text', l: 'Texto' },
  { v: 'textarea', l: 'Texto longo' },
  { v: 'number', l: 'Número' },
  { v: 'date', l: 'Data' },
  { v: 'boolean', l: 'Sim/Não' },
]
const PREENCHIDO_POR = [
  { v: 'profissional', l: 'Profissional' },
  { v: 'paciente', l: 'Paciente (portal)' },
  { v: 'sistema', l: 'Sistema (automático)' },
] as const
const AUTO_FONTES = [
  { v: 'data_emissao', l: 'Data da emissão' },
  { v: 'data_ciencia', l: 'Data da ciência (paciente)' },
  { v: 'paciente_nome', l: 'Nome do paciente' },
  { v: 'paciente_cpf', l: 'CPF do paciente' },
  { v: 'profissional_nome', l: 'Nome do profissional' },
  { v: 'profissional_conselho', l: 'Conselho (tipo)' },
  { v: 'profissional_conselho_numero', l: 'Número do conselho' },
  { v: 'profissional_conselho_uf', l: 'UF do conselho' },
] as const

export default function Templates() {
  const { profile } = useAuth()
  const clinicId = profile?.professional?.clinic_id
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<DocumentTemplate | 'novo' | null>(null)

  function recarregar() {
    listTemplates().then(setTemplates).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [])

  async function toggleAtivo(t: DocumentTemplate) {
    await setTemplateActive(t.id, !t.ativo)
    recarregar()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-texto">Modelos de Documentos</h1>
        <button onClick={() => setEditando('novo')} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo modelo
        </button>
      </div>
      <p className="mt-1 text-sm text-texto/60">Termos e orientações com campos dinâmicos (CRUD).</p>

      {editando && clinicId && (
        <Editor
          clinicId={clinicId}
          createdBy={profile?.professional?.id}
          template={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar() }}
        />
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/5 bg-white">
        {carregando ? (
          <p className="p-6 text-sm text-texto/50">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="p-6 text-sm text-texto/50">Nenhum modelo. Crie o primeiro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/[0.02] text-left text-texto/60">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Versão</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-black/5">
                  <td className="px-4 py-2 text-texto">{t.nome}</td>
                  <td className="px-4 py-2 text-texto/70">{t.document_types?.rotulo ?? t.tipo}</td>
                  <td className="px-4 py-2 text-texto/60">v{t.versao}</td>
                  <td className="px-4 py-2">
                    {t.ativo ? <span className="text-emerald-600">ativo</span> : <span className="text-texto/40">inativo</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditando(t)} className="mr-3 text-xs font-medium text-primaria hover:underline">Editar</button>
                    <button onClick={() => toggleAtivo(t)} className="text-xs font-medium text-texto/50 hover:underline">
                      {t.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Editor({
  clinicId,
  createdBy,
  template,
  onClose,
  onSaved,
}: {
  clinicId: string
  createdBy?: string | null
  template: DocumentTemplate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [tipos, setTipos] = useState<DocumentType[]>([])
  const [tipoId, setTipoId] = useState<string>('')
  const [nome, setNome] = useState(template?.nome ?? '')
  const [procedimento, setProcedimento] = useState(template?.procedimento_rel ?? '')
  const [requerAssinatura, setRequerAssinatura] = useState(template?.requer_assinatura ?? true)
  const [corpo, setCorpo] = useState(template?.corpo ?? '')
  const [campos, setCampos] = useState<TemplateField[]>(template?.schema ?? [])
  const [lembretes, setLembretes] = useState<ReminderItem[]>(template?.reminder_schedule ?? [])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const corpoRef = useRef<HTMLTextAreaElement>(null)

  // Tipos gerenciados (Configurações → Tipos de documento) alimentam o dropdown.
  useEffect(() => {
    listDocumentTypes().then((list) => {
      setTipos(list)
      setTipoId((prev) => {
        if (prev) return prev
        if (template?.tipo_id && list.some((t) => t.id === template.tipo_id)) return template.tipo_id
        const nat = template?.tipo === 'orientacao' ? 'orientacao' : 'termo'
        return (list.find((t) => t.natureza === nat) ?? list[0])?.id ?? ''
      })
    }).catch(() => {})
  }, [])
  const tipoSel = tipos.find((t) => t.id === tipoId) ?? null
  const natureza: 'termo' | 'orientacao' = tipoSel?.natureza ?? (template?.tipo === 'orientacao' ? 'orientacao' : 'termo')

  function addCampo() {
    setCampos((c) => [...c, { key: '', label: '', type: 'text', required: false }])
  }

  /** Insere o placeholder {{chave}} no corpo, na posição do cursor. */
  function inserirNoCorpo(chave: string) {
    if (!chave) return
    const token = `{{${chave}}}`
    const el = corpoRef.current
    if (!el) { setCorpo((c) => (c ? `${c} ${token}` : token)); return }
    const start = el.selectionStart ?? corpo.length
    const end = el.selectionEnd ?? corpo.length
    const novo = corpo.slice(0, start) + token + corpo.slice(end)
    setCorpo(novo)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }
  function setCampo(i: number, patch: Partial<TemplateField>) {
    setCampos((arr) => arr.map((f, idx) => {
      if (idx !== i) return f
      const next = { ...f, ...patch }
      // auto-gera a chave a partir do rótulo se a chave ainda não foi editada
      if (patch.label !== undefined && (!f.key || f.key === slugify(f.label))) next.key = slugify(patch.label)
      return next
    }))
  }
  function addLembrete() {
    setLembretes((l) => [...l, { mensagem: '', offset_horas: 0 }])
  }
  function setLembrete(i: number, patch: Partial<ReminderItem>) {
    setLembretes((arr) => arr.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    const camposValidos = campos.filter((c) => c.label.trim()).map((c) => ({ ...c, key: c.key || slugify(c.label) }))
    const input: TemplateInput = {
      tipo: natureza,
      tipo_id: tipoId || null,
      nome,
      procedimento_rel: procedimento || null,
      schema: camposValidos,
      corpo,
      reminder_schedule: natureza === 'orientacao' ? lembretes.filter((l) => l.mensagem.trim()) : [],
      requer_assinatura: natureza === 'termo' ? requerAssinatura : false,
    }
    setSalvando(true)
    setErro(null)
    try {
      if (template) await updateTemplate(template.id, template.versao, input)
      else await createTemplate(clinicId, input, createdBy)
      onSaved()
    } catch {
      setErro('Não foi possível salvar.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-texto">{template ? 'Editar modelo' : 'Novo modelo'}</h2>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-texto/70">Tipo</label>
              <select className={field} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                {tipos.length === 0 && <option value="">—</option>}
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Nome *</label>
              <input className={field} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-texto/70">Procedimento relacionado (opcional)</label>
              <input className={field} value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="ex.: toxina_botulinica" />
            </div>
            {natureza === 'termo' && (
              <div className="sm:col-span-2 rounded-lg bg-black/[0.02] p-2">
                <label className="flex items-center gap-2 text-sm text-texto/80">
                  <input type="checkbox" checked={requerAssinatura} onChange={(e) => setRequerAssinatura(e.target.checked)} />
                  Exige assinatura do paciente
                </label>
                <p className="mt-1 text-xs text-texto/50">
                  Em todos os casos o paciente lê e confirma no portal para fechar o ciclo. Este flag define a
                  <strong> natureza do aceite</strong>: <strong>marcado</strong> = “Assinar” → status <strong>Assinado</strong>
                  (registra <code>assinado_em</code>); <strong>desmarcado</strong> = “Confirmar leitura” → status <strong>Lido</strong>.
                  Em ambos são gravados data, hora e o hash de autenticidade. Orientações nunca exigem assinatura.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-texto/70">Corpo do documento</label>
            <textarea ref={corpoRef} rows={5} className={field} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Use {{chave}} para inserir os campos dinâmicos." />
            <p className="mt-1 text-xs text-texto/50">Placeholders: escreva <code>{'{{chave}}'}</code> ou use o botão <strong>inserir no corpo</strong> de cada campo abaixo (insere na posição do cursor).</p>
          </div>

          {/* Campos dinâmicos */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-texto/80">Campos dinâmicos</label>
              <button onClick={addCampo} className="text-xs font-medium text-primaria hover:underline">+ Adicionar campo</button>
            </div>
            {campos.length === 0 && <p className="text-xs text-texto/40">Sem campos (documento de texto fixo).</p>}
            <div className="space-y-2">
              {campos.map((c, i) => {
                const pp = c.preenchidoPor ?? 'profissional'
                const podeOrcamento = pp === 'profissional' && (c.type === 'number' || c.type === 'text')
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-black/5 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-sm" placeholder="Rótulo" value={c.label} onChange={(e) => setCampo(i, { label: e.target.value })} />
                      <input className="w-32 rounded-lg border border-black/10 px-2 py-1.5 text-xs text-texto/60" placeholder="chave" value={c.key} onChange={(e) => setCampo(i, { key: e.target.value })} />
                      <select className="rounded-lg border border-black/10 px-2 py-1.5 text-sm" value={c.type} onChange={(e) => setCampo(i, { type: e.target.value as FieldType })}>
                        {TIPOS_CAMPO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <button type="button" onClick={() => inserirNoCorpo(c.key || slugify(c.label))} disabled={!c.label.trim()}
                        className="rounded-md border border-primaria px-2 py-1 text-xs font-medium text-primaria hover:bg-primaria/5 disabled:opacity-40"
                        title="Inserir {{chave}} no corpo, na posição do cursor">
                        inserir no corpo
                      </button>
                      <button onClick={() => setCampos((a) => a.filter((_, idx) => idx !== i))} className="px-1 text-texto/40 hover:text-secundaria">✕</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-0.5 text-xs text-texto/60">
                      <label className="flex items-center gap-1">
                        Preenchido por
                        <select className="rounded-md border border-black/10 px-1.5 py-1" value={pp}
                          onChange={(e) => {
                            const v = e.target.value as PreenchidoPor
                            setCampo(i, { preenchidoPor: v, auto: v === 'sistema' ? (c.auto ?? 'data_emissao') : undefined, fonteOrcamento: v === 'profissional' ? c.fonteOrcamento : false })
                          }}>
                          {PREENCHIDO_POR.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                        </select>
                      </label>
                      {pp === 'sistema' ? (
                        <label className="flex items-center gap-1">
                          Fonte automática
                          <select className="rounded-md border border-black/10 px-1.5 py-1" value={c.auto ?? 'data_emissao'} onChange={(e) => setCampo(i, { auto: e.target.value as AutoFonte })}>
                            {AUTO_FONTES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                          </select>
                        </label>
                      ) : (
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={!!c.required} onChange={(e) => setCampo(i, { required: e.target.checked })} /> obrigatório
                        </label>
                      )}
                      {podeOrcamento && (
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={!!c.fonteOrcamento} onChange={(e) => setCampo(i, { fonteOrcamento: e.target.checked })} /> sugerir valor do orçamento
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lembretes (só orientação) */}
          {natureza === 'orientacao' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-texto/80">Lembretes automáticos</label>
                <button onClick={addLembrete} className="text-xs font-medium text-primaria hover:underline">+ Adicionar lembrete</button>
              </div>
              {lembretes.length === 0 && <p className="text-xs text-texto/40">Sem lembretes programados.</p>}
              <div className="space-y-2">
                {lembretes.map((r, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-black/5 p-2">
                    <textarea rows={2} className={field} placeholder="Mensagem do lembrete" value={r.mensagem} onChange={(e) => setLembrete(i, { mensagem: e.target.value })} />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-texto/60">
                      <span>Após (horas):</span>
                      <input type="number" className="w-20 rounded-lg border border-black/10 px-2 py-1" value={r.offset_horas ?? 0} onChange={(e) => setLembrete(i, { offset_horas: Number(e.target.value) })} />
                      <span>ou repetir por (dias):</span>
                      <input type="number" className="w-20 rounded-lg border border-black/10 px-2 py-1" value={r.por_dias ?? 0} onChange={(e) => setLembrete(i, { por_dias: Number(e.target.value) || undefined, repetir: e.target.value ? 'diario' : undefined })} />
                      <button onClick={() => setLembretes((a) => a.filter((_, idx) => idx !== i))} className="ml-auto px-1 text-texto/40 hover:text-secundaria">remover</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-secundaria">{erro}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-texto/70 hover:bg-black/5">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar modelo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
