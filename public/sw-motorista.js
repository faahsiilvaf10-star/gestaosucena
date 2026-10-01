// Service Worker — App Motorista Offline First
const CACHE_VERSION = 'motorista-v1'
const CACHE_STATIC = `${CACHE_VERSION}-static`
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
]

// Instala e pré-cacheia os assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // silently ignore cache failures on install
      })
    }).then(() => self.skipWaiting())
  )
})

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('motorista-') && key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Estratégia de fetch:
// - Assets locais (JS/CSS/HTML/fontes/imagens): Cache First (funciona 100% offline)
// - Supabase API: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requests não-GET
  if (request.method !== 'GET') return

  // Supabase — Network First (tenta online, cai para cache)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Assets locais — Cache First (sempre offline-ready)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (!response || !response.ok) return response

        const clone = response.clone()
        caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone))
        return response
      }).catch(() => {
        // Para navegação SPA, retorna o index.html do cache
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html')
        }
      })
    })
  )
})
