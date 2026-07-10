import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePhoto, listPhotos, updatePhoto, uploadPhoto,
  type ClinicalPhoto, type PhotoCategoria,
} from '@/lib/photos'
import { getImageConsentConfig, recordImageConsent } from '@/lib/imageConsent'
import { getPatient } from '@/lib/patients'
import { formatDateBR } from '@/lib/format'

interface Props {
  patientId: string
  clinicId: string
  professionalId?: string | null
}

const CATS: { v: PhotoCategoria; l: string }[] = [
  { v: 'antes', l: 'Antes' },
  { v: 'depois', l: 'Depois' },
  { v: 'evolucao', l: 'Evolução' },
  { v: 'outro', l: 'Outro' },
]

export default function PhotosPanel({ patientId, clinicId, professionalId }: Props) {
  const [fotos, setFotos] = useState<ClinicalPhoto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [categoria, setCategoria] = useState<PhotoCategoria>('antes')
  const [regiao, setRegiao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Filtro + comparação
  const [filtroRegiao, setFiltroRegiao] = useState('')
  const [comparar, setComparar] = useState<string[]>([]) // ids selecionados (até 2)
  // Termo de imagem
  const [consentVersao, setConsentVersao] = useState('1')
  const [consentEm, setConsentEm] = useState<string | null>(null)
  const [consentVersaoAceita, setConsentVersaoAceita] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState(false)

  function recarregar() {
    listPhotos(patientId).then(setFotos).catch(() => {}).finally(() => setCarregando(false))
  }
  function recarregarConsent() {
    getImageConsentConfig().then((c) => setConsentVersao(c.versao)).catch(() => {})
    getPatient(patientId).then((p) => { setConsentEm(p?.consentimento_imagem_em ?? null); setConsentVersaoAceita(p?.consentimento_imagem_versao ?? null) }).catch(() => {})
  }
  useEffect(() => { recarregar(); recarregarConsent() }, [patientId])

  const consentiu = !!consentEm && consentVersaoAceita === consentVersao

  const regioes = useMemo(() => {
    const s = new Set<string>()
    fotos.forEach((f) => { if (f.regiao) s.add(f.regiao) })
    return [...s].sort()
  }, [fotos])
  const visiveis = filtroRegiao ? fotos.filter((f) => f.regiao === filtroRegiao) : fotos
  const paraComparar = comparar.map((id) => fotos.find((f) => f.id === id)).filter(Boolean) as ClinicalPhoto[]

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      await uploadPhoto({ file, clinicId, patientId, professionalId, categoria, regiao })
      setRegiao('')
      recarregar()
    } catch { /* toast em produção */ } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remover(p: ClinicalPhoto) {
    if (!confirm('Remover esta foto?')) return
    await deletePhoto(p)
    setComparar((c) => c.filter((id) => id !== p.id))
    recarregar()
  }
  async function toggleVisivel(p: ClinicalPhoto) {
    await updatePhoto(p.id, { visivel_paciente: !p.visivel_paciente })
    recarregar()
  }
  function toggleComparar(id: string) {
    setComparar((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? [c[1], id] : [...c, id])
  }
  async function registrarConsentimento() {
    setRegistrando(true)
    try { await recordImageConsent({ patientId, clinicId, versao: consentVersao, origem: 'profissional' }); recarregarConsent() }
    catch { /* ignore */ } finally { setRegistrando(false) }
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold text-texto">Fotos clínicas</h3>

      {/* Termo de uso de imagem */}
      <div className={`mb-4 rounded-xl border p-3 text-sm ${consentiu ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {consentiu ? (
          <span>✓ Termo de uso de imagem assinado (versão {consentVersaoAceita}{consentEm ? ` · ${formatDateBR(consentEm)}` : ''}).</span>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{consentEm ? 'O termo de imagem mudou de versão — recolha o novo consentimento.' : 'Sem termo de uso de imagem deste paciente. Recolha o consentimento antes de usar as fotos.'}</span>
            <button onClick={registrarConsentimento} disabled={registrando} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {registrando ? 'Registrando…' : 'Registrar consentimento (presencial)'}
            </button>
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-black/5 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as PhotoCategoria)} className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria">
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Região (opcional)</label>
          <input value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Ex.: abdome, face" className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria" />
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          <button onClick={() => inputRef.current?.click()} disabled={enviando} className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {enviando ? 'Enviando…' : '+ Adicionar foto'}
          </button>
        </div>
      </div>

      {/* Filtro por região + comparação */}
      {fotos.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <select value={filtroRegiao} onChange={(e) => setFiltroRegiao(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-primaria">
            <option value="">Todas as regiões</option>
            {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="text-xs text-texto/50">Selecione 2 fotos para comparar antes/depois lado a lado.</span>
          {comparar.length > 0 && <button onClick={() => setComparar([])} className="text-xs font-medium text-primaria hover:underline">Limpar seleção ({comparar.length})</button>}
        </div>
      )}

      {/* Comparação lado a lado */}
      {paraComparar.length === 2 && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-primaria/20 bg-primaria/5 p-3">
          {paraComparar.map((f) => (
            <figure key={f.id} className="overflow-hidden rounded-lg border border-black/5 bg-white">
              {f.signedUrl && <img src={f.signedUrl} alt={f.categoria} className="aspect-square w-full object-cover" />}
              <figcaption className="p-2 text-center text-xs">
                <span className="font-medium capitalize text-texto">{f.categoria}</span>
                <span className="block text-texto/50">{f.regiao ? `${f.regiao} · ` : ''}{formatDateBR(f.capturada_em)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">Nenhuma foto. Use "Adicionar foto" para registrar antes/depois.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visiveis.map((f) => {
            const sel = comparar.includes(f.id)
            return (
              <div key={f.id} className={`overflow-hidden rounded-xl border bg-white ${sel ? 'border-primaria ring-2 ring-primaria/30' : 'border-black/5'}`}>
                <button type="button" onClick={() => toggleComparar(f.id)} className="block w-full" title="Selecionar para comparar">
                  {f.signedUrl ? (
                    <img src={f.signedUrl} alt={f.categoria} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-black/5 text-xs text-texto/40">sem prévia</div>
                  )}
                </button>
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium capitalize text-texto">{f.categoria}</div>
                      <div className="text-[11px] text-texto/50">{f.regiao ? `${f.regiao} · ` : ''}{formatDateBR(f.capturada_em)}</div>
                    </div>
                    <button onClick={() => remover(f)} className="text-texto/30 hover:text-secundaria" title="Remover">✕</button>
                  </div>
                  <button onClick={() => toggleVisivel(f)} className={`mt-1 w-full rounded-md px-2 py-0.5 text-[11px] font-medium ${f.visivel_paciente ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-texto/50'}`}>
                    {f.visivel_paciente ? '👁 Visível ao paciente' : 'Oculta do paciente'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
