import { supabase } from '@/lib/supabase'

export interface AppNotification {
  id: string
  patient_id: string | null
  tipo: string
  titulo: string | null
  payload: Record<string, unknown>
  agendado_para: string
  status: string
  lido_em: string | null
  appointment_id: string | null
}

/** Notificações já "vencidas" (agendado_para <= agora) do paciente. */
export async function listDueNotifications(patientId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, patient_id, tipo, titulo, payload, agendado_para, status, lido_em, appointment_id')
    .eq('patient_id', patientId)
    .lte('agendado_para', new Date().toISOString())
    .order('agendado_para', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'lido', lido_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
