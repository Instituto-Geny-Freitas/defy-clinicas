import { supabase } from '@/lib/supabase'

const BUCKET = 'patient-files'

export type PhotoCategoria = 'antes' | 'depois' | 'evolucao' | 'outro'

export interface ClinicalPhoto {
  id: string
  patient_id: string
  categoria: PhotoCategoria
  regiao: string | null
  grupo_id: string | null
  arquivo_url: string
  observacoes: string | null
  visivel_paciente: boolean
  capturada_em: string
  // preenchido no cliente:
  signedUrl?: string
}

export async function listPhotos(patientId: string): Promise<ClinicalPhoto[]> {
  const { data, error } = await supabase
    .from('clinical_photos')
    .select('*')
    .eq('patient_id', patientId)
    .order('capturada_em', { ascending: false })
  if (error) throw error
  const fotos = data ?? []
  // Gera URLs assinadas (bucket privado) em lote.
  const paths = fotos.map((f) => f.arquivo_url)
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const f of fotos) f.signedUrl = map.get(f.arquivo_url) ?? undefined
  }
  return fotos
}

interface UploadArgs {
  file: File
  clinicId: string
  patientId: string
  professionalId?: string | null
  categoria: PhotoCategoria
  regiao?: string | null
  visivelPaciente?: boolean
}

export async function uploadPhoto(args: UploadArgs): Promise<void> {
  const ext = args.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${args.patientId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, args.file, { contentType: args.file.type, upsert: false })
  if (upErr) throw upErr

  const { error: insErr } = await supabase.from('clinical_photos').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    categoria: args.categoria,
    regiao: args.regiao ?? null,
    arquivo_url: path,
    visivel_paciente: args.visivelPaciente ?? true,
  })
  if (insErr) throw insErr
}

export async function updatePhoto(id: string, patch: {
  categoria?: PhotoCategoria
  regiao?: string | null
  visivel_paciente?: boolean
}): Promise<void> {
  const { error } = await supabase.from('clinical_photos').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePhoto(photo: ClinicalPhoto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photo.arquivo_url])
  const { error } = await supabase.from('clinical_photos').delete().eq('id', photo.id)
  if (error) throw error
}
