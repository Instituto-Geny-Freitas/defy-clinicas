import { supabase } from '@/lib/supabase'

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID
}

/** Solicita permissão, inscreve o dispositivo e salva a inscrição. */
export async function enablePush(): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSupported()) return { ok: false, motivo: 'Notificações push não são suportadas neste dispositivo/navegador.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, motivo: 'Permissão de notificação negada.' }

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID) as unknown as BufferSource,
  })
  const json = sub.toJSON()

  const { data: u } = await supabase.auth.getUser()
  if (!u?.user) return { ok: false, motivo: 'Não autenticado.' }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { auth_user_id: u.user.id, endpoint: json.endpoint!, keys: json.keys, user_agent: navigator.userAgent },
      { onConflict: 'auth_user_id,endpoint' },
    )
  if (error) return { ok: false, motivo: error.message }
  return { ok: true }
}
