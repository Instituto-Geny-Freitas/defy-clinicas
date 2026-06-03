import { useEffect, useRef, useState } from 'react'
import {
  deletePhoto,
  listPhotos,
  uploadPhoto,
  type ClinicalPhoto,
  type PhotoCategoria,
} from '@/lib/photos'

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

  function recarregar() {
    listPhotos(patientId).then(setFotos).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(recarregar, [patientId])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      await uploadPhoto({ file, clinicId, patientId, professionalId, categoria, regiao })
      setRegiao('')
      recarregar()
    } catch {
      /* erro silencioso na UI; build de produção pode exibir toast */
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remover(p: ClinicalPhoto) {
    if (!confirm('Remover esta foto?')) return
    await deletePhoto(p)
    recarregar()
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold text-texto">Fotos clínicas</h3>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-black/5 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-texto/70">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as PhotoCategoria)}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          >
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-texto/70">Região (opcional)</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            placeholder="Ex.: abdome, face"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-primaria"
          />
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="rounded-lg bg-primaria px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : '+ Adicionar foto'}
          </button>
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : fotos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Nenhuma foto. Use “Adicionar foto” para registrar antes/depois.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f) => (
            <div key={f.id} className="overflow-hidden rounded-xl border border-black/5 bg-white">
              {f.signedUrl ? (
                <img src={f.signedUrl} alt={f.categoria} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-black/5 text-xs text-texto/40">sem prévia</div>
              )}
              <div className="flex items-center justify-between p-2">
                <div>
                  <div className="text-xs font-medium capitalize text-texto">{f.categoria}</div>
                  <div className="text-[11px] text-texto/50">
                    {f.regiao ? `${f.regiao} · ` : ''}
                    {new Date(f.capturada_em).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <button onClick={() => remover(f)} className="text-texto/30 hover:text-secundaria" title="Remover">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
