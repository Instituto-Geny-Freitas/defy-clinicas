/// <reference lib="webworker" />
import { precache, addRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'

// Service worker customizado (injectManifest): precache + navegação rede-primeiro + Web Push.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// Assume controle imediatamente ao ser instalado, sem esperar fechar abas.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

cleanupOutdatedCaches()
// Cacheia os arquivos versionados (JS/CSS/ícones/index) — sem registrar a rota ainda.
precache(self.__WB_MANIFEST)

// Navegações (o "shell" HTML): REDE PRIMEIRO. Assim toda atualização entrega o
// index.html novo (com os hashes de JS atuais) e o aparelho nunca fica preso num
// shell antigo apontando para arquivos que já não existem (tela branca/travada).
// Offline / rede lenta (>4s): cai no index.html precacheado.
// Registrado ANTES de addRoute() para ter precedência sobre a rota de precache.
const NAV_TIMEOUT_MS = 4000
function timeout(ms: number): Promise<Response> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
}
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    Promise.race([fetch(event.request), timeout(NAV_TIMEOUT_MS)]).catch(
      async () => (await matchPrecache('index.html')) ?? Response.error(),
    ),
  )
})

// Demais requisições dos arquivos precacheados (assets versionados) → cache.
addRoute()

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
