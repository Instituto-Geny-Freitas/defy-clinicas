/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Service worker customizado (injectManifest): precache + Web Push.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// Assume controle imediatamente ao ser instalado, sem esperar fechar abas.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event: PushEvent) => {
  let data: { titulo?: string; mensagem?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { mensagem: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.titulo ?? 'Instituto Geny Freitas', {
      body: data.mensagem ?? '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
