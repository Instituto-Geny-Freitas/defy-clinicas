import { supabase } from '@/lib/supabase'

export interface Supplementation {
  id: string
  patient_id: string
  medicacao: string
  via_adm: string | null
  validade: string | null
  lote: string | null
  fornecedor: string | null
  valor_venda: number
  observacoes: string | null
  pago: boolean
  data: string
  created_at: string
  ativo_lote_id: string | null
  quantidade: number
}

export async function listSupplementations(patientId: string): Promise<Supplementation[]> {
  const { data, error } = await supabase
    .from('supplementations')
    .select('*')
    .eq('patient_id', patientId)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Suplementações ainda não pagas (para importar no orçamento). */
export async function listUnpaidSupplementations(patientId: string): Promise<Supplementation[]> {
  const { data, error } = await supabase
    .from('supplementations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('pago', false)
    .order('data', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setSupplementationPaid(id: string, pago: boolean): Promise<void> {
  const { error } = await supabase.from('supplementations').update({ pago }).eq('id', id)
  if (error) throw error
}

/** Movimenta o lote de ativo da suplementação (baixa por uso ou estorno). */
async function moverAtivo(clinicId: string, ativoLoteId: string, tipo: 'saida_uso' | 'entrada', quantidade: number, patientId?: string | null, motivo?: string): Promise<void> {
  if (!ativoLoteId || !(quantidade > 0)) return
  await supabase.from('ativo_movements').insert({
    clinic_id: clinicId, ativo_lote_id: ativoLoteId, tipo, quantidade,
    patient_id: patientId ?? null, motivo: motivo ?? null,
  })
}

export async function updateSupplementation(id: string, patch: {
  medicacao?: string
  via_adm?: string | null
  validade?: string | null
  lote?: string | null
  fornecedor?: string | null
  valor_venda?: number
  observacoes?: string | null
  ativo_lote_id?: string | null
  quantidade?: number
}): Promise<void> {
  // Reconcilia estoque do ativo se o lote/quantidade mudou.
  if (patch.ativo_lote_id !== undefined || patch.quantidade !== undefined) {
    const { data: antes } = await supabase.from('supplementations').select('clinic_id, patient_id, ativo_lote_id, quantidade').eq('id', id).maybeSingle()
    if (antes) {
      const novoLote = patch.ativo_lote_id !== undefined ? patch.ativo_lote_id : antes.ativo_lote_id
      const novaQtd = patch.quantidade !== undefined ? patch.quantidade : Number(antes.quantidade)
      const mudou = (antes.ativo_lote_id ?? null) !== (novoLote ?? null) || Number(antes.quantidade) !== Number(novaQtd)
      if (mudou) {
        if (antes.ativo_lote_id) await moverAtivo(antes.clinic_id, antes.ativo_lote_id, 'entrada', Number(antes.quantidade), antes.patient_id, 'Estorno (edição de suplementação)')
        if (novoLote) await moverAtivo(antes.clinic_id, novoLote, 'saida_uso', Number(novaQtd), antes.patient_id, 'Uso em suplementação (edição)')
      }
    }
  }
  const { error } = await supabase.from('supplementations').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSupplementation(id: string): Promise<void> {
  // Devolve ao estoque do ativo antes de excluir.
  const { data: s } = await supabase.from('supplementations').select('clinic_id, patient_id, ativo_lote_id, quantidade').eq('id', id).maybeSingle()
  if (s?.ativo_lote_id) await moverAtivo(s.clinic_id, s.ativo_lote_id, 'entrada', Number(s.quantidade), s.patient_id, 'Estorno (exclusão de suplementação)')
  const { error } = await supabase.from('supplementations').delete().eq('id', id)
  if (error) throw error
}

interface CreateArgs {
  clinicId: string
  patientId: string
  professionalId?: string | null
  medicacao: string
  via_adm?: string | null
  validade?: string | null
  lote?: string | null
  fornecedor?: string | null
  valor_venda?: number
  observacoes?: string | null
  ativoLoteId?: string | null
  quantidade?: number
}

export async function createSupplementation(args: CreateArgs): Promise<string> {
  const qtd = args.quantidade ?? 1
  const { data, error } = await supabase.from('supplementations').insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    professional_id: args.professionalId ?? null,
    medicacao: args.medicacao,
    via_adm: args.via_adm ?? null,
    validade: args.validade ?? null,
    lote: args.lote ?? null,
    fornecedor: args.fornecedor ?? null,
    valor_venda: args.valor_venda ?? 0,
    observacoes: args.observacoes ?? null,
    ativo_lote_id: args.ativoLoteId ?? null,
    quantidade: qtd,
  }).select('id').single()
  if (error) throw error
  // Baixa no estoque do ativo (lote escolhido).
  if (args.ativoLoteId && qtd > 0) await moverAtivo(args.clinicId, args.ativoLoteId, 'saida_uso', qtd, args.patientId, 'Uso em suplementação')
  return data.id as string
}
