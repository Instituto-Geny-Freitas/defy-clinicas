import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useClinic } from '@/theme/ThemeProvider'
import { listPops, type Pop } from '@/lib/pops'
import { buildPopBodyHtml, POP_RODAPE_TEXTO, POP_TITULO_GERAL } from '@/lib/popHtml'
import { buildPopPdf } from '@/lib/popPdf'
import { listProfessionals } from '@/lib/settings'
import { listPatients } from '@/lib/patients'
import { createSharedDocument } from '@/lib/sharedDocs'
import type { Patient, Professional } from '@/lib/types'

export default function Pops() {
  const clinic = useClinic()
  const [pops, setPops] = useState<Pop[]>([])
  const [profs, setProfs] = useState<Professional[]>([])
  const [sel, setSel] = useState<Pop | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([listPops(), listProfessionals()])
      .then(([ps, pr]) => { setPops(ps); setProfs(pr); setSel((s) => s ?? ps[0] ?? null) })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const nomeProf = useMemo(() => {
    const m = new Map(profs.map((p) => [p.id, p.nome]))
    return (id: string | null) => (id ? m.get(id) ?? '—' : '—')
  }, [profs])

  if (carregando) return <p className="text-sm text-texto/50">Carregando…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-texto">POPs</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Procedimentos Operacionais Padrão. Crie e edite em Configurações → Negocial → POPs.</p>

      {pops.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhum POP cadastrado. Um administrador pode criá-los em Configurações → POPs.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Lista */}
          <div className="space-y-1">
            {pops.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${sel?.id === p.id ? 'bg-primaria text-white' : 'bg-white text-texto/80 hover:bg-black/5'}`}
              >
                {p.titulo}
              </button>
            ))}
          </div>

          {/* Documento */}
          <div>
            {sel && <PopViewer pop={sel} clinic={clinic} nomeProf={nomeProf} />}
          </div>
        </div>
      )}
    </div>
  )
}

function PopViewer({ pop, clinic, nomeProf }: { pop: Pop; clinic: ReturnType<typeof useClinic>; nomeProf: (id: string | null) => string }) {
  const [gerando, setGerando] = useState(false)
  const [enviar, setEnviar] = useState(false)
  const bodyHtml = useMemo(() => buildPopBodyHtml(pop, nomeProf), [pop, nomeProf])

  async function gerarPdf() {
    setGerando(true)
    try {
      const { blob, filename } = await buildPopPdf({ pop, clinic, nomeProf })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally { setGerando(false) }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={gerarPdf} disabled={gerando} className="rounded-lg border border-primaria px-4 py-2 text-sm font-semibold text-primaria hover:bg-primaria/5 disabled:opacity-50">
          {gerando ? 'Gerando…' : 'Gerar PDF'}
        </button>
        <button onClick={() => setEnviar(true)} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Enviar ao paciente
        </button>
      </div>

      {/* Papel: cabeçalho (logo + títulos) + corpo + rodapé legal */}
      <div className="mx-auto max-w-3xl rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-black/10 pb-3">
          {clinic?.logo_url && <img src={clinic.logo_url} alt="" className="h-10 w-auto object-contain" />}
          <div className="flex-1 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-primaria">{POP_TITULO_GERAL}</div>
            <div className="text-sm font-semibold text-texto">{pop.titulo.toUpperCase()}</div>
          </div>
        </div>

        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        <p className="mt-6 border-t border-black/10 pt-3 text-center text-[10px] text-texto/40">{POP_RODAPE_TEXTO}</p>
      </div>

      {enviar && <EnviarPacienteModal pop={pop} clinic={clinic} nomeProf={nomeProf} onClose={() => setEnviar(false)} />}
    </div>
  )
}

function EnviarPacienteModal({ pop, clinic, nomeProf, onClose }: { pop: Pop; clinic: ReturnType<typeof useClinic>; nomeProf: (id: string | null) => string; onClose: () => void }) {
  const { profile } = useAuth()
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { listPatients().then(setPacientes).catch(() => {}) }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? pacientes.filter((p) => p.nome.toLowerCase().includes(t)) : pacientes
  }, [pacientes, busca])

  async function enviar() {
    if (!selId) return
    setEnviando(true); setMsg(null)
    try {
      const { blob } = await buildPopPdf({ pop, clinic, nomeProf })
      await createSharedDocument({
        clinicId: profile?.professional?.clinic_id ?? '',
        patientId: selId,
        professionalId: profile?.professional?.id ?? null,
        titulo: `POP – ${pop.titulo}`,
        categoria: 'documento',
        blob,
        enviarPaciente: true,
      })
      setMsg('POP enviado. Já aparece em "Meus Documentos" do paciente.')
      setTimeout(onClose, 1400)
    } catch {
      setMsg('Não foi possível enviar. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[56] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-texto">Enviar POP ao paciente</h3>
          <button onClick={onClose} className="text-texto/40 hover:text-texto">✕</button>
        </div>
        <p className="mb-3 text-xs text-texto/50">O PDF será disponibilizado em <strong>Meus Documentos</strong> no portal do paciente.</p>

        <input
          className="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          placeholder="Buscar paciente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="flex-1 space-y-1 overflow-auto rounded-lg border border-black/5">
          {filtrados.length === 0 ? (
            <p className="p-4 text-center text-sm text-texto/40">Nenhum paciente.</p>
          ) : filtrados.slice(0, 100).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelId(p.id)}
              className={`block w-full px-3 py-2 text-left text-sm transition ${selId === p.id ? 'bg-primaria/10 font-medium text-primaria' : 'hover:bg-black/5'}`}
            >
              {p.nome}
            </button>
          ))}
        </div>

        {msg && <p className="mt-3 text-sm text-texto/70">{msg}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-texto/60 hover:bg-black/5">Cancelar</button>
          <button onClick={enviar} disabled={!selId || enviando} className="rounded-lg bg-primaria px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
