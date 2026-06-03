import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { listPhotos, type ClinicalPhoto } from '@/lib/photos'

export default function PatientEvolution() {
  const { profile } = useAuth()
  const patientId = profile?.patient?.id
  const [fotos, setFotos] = useState<ClinicalPhoto[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!patientId) return
    listPhotos(patientId)
      .then((all) => setFotos(all.filter((f) => f.visivel_paciente)))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [patientId])

  return (
    <div>
      <h1 className="text-xl font-semibold text-texto">Minha Evolução</h1>
      <p className="mt-1 mb-4 text-sm text-texto/60">Registro fotográfico do seu tratamento.</p>

      {carregando ? (
        <p className="text-sm text-texto/50">Carregando…</p>
      ) : fotos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-texto/50">
          Ainda não há fotos disponíveis.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fotos.map((f) => (
            <div key={f.id} className="overflow-hidden rounded-xl border border-black/5 bg-white">
              {f.signedUrl && <img src={f.signedUrl} alt={f.categoria} className="aspect-square w-full object-cover" />}
              <div className="p-2 text-[11px] text-texto/60">
                <span className="font-medium capitalize text-texto">{f.categoria}</span>
                {' · '}
                {new Date(f.capturada_em).toLocaleDateString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
