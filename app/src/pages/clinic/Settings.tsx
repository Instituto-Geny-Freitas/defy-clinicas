import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useThemeReload } from '@/theme/ThemeProvider'
import {
  createProfessional,
  getClinic,
  getIntegration,
  listProfessionals,
  updateClinic,
  uploadLogo,
  upsertIntegration,
  type ClinicFull,
  type IntegrationSetting,
  type ProfessionalInput,
} from '@/lib/settings'
import type { Professional, UserRole } from '@/lib/types'

type Sec = 'visual' | 'equipe' | 'integracoes'
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

  function recarregar() {
    listProfessionals().then(setProfs).catch(() => {})
  }
  useEffect(recarregar, [])

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-texto">Profissionais</h3>
        <button onClick={() => setModal(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          + Novo profissional
        </button>
      </div>
      {modal && <ProfModal clinicId={clinicId} onClose={() => setModal(false)} onSaved={() => { setModal(false); recarregar() }} />}
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-texto/60">
            <tr><th className="px-4 py-2 font-medium">Nome</th><th className="px-4 py-2 font-medium">Papel</th><th className="px-4 py-2 font-medium">Conselho</th><th className="px-4 py-2 font-medium">Vínculo</th></tr>
          </thead>
          <tbody>
            {profs.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-2 text-texto">{p.nome}</td>
                <td className="px-4 py-2 capitalize text-texto/70">{p.role}</td>
                <td className="px-4 py-2 text-texto/70">{p.conselho_tipo ? `${p.conselho_tipo} ${p.conselho_numero ?? ''}` : '—'}</td>
                <td className="px-4 py-2">{p.auth_user_id ? <span className="text-emerald-600">ativo</span> : <span className="text-texto/40">aguarda 1º login</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
