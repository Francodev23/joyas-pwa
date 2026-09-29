const CACHE_VERSION = 'v2'
const STATIC_CACHE = `joyas-static-${CACHE_VERSION}`

const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/auth/login',
  '/api/auth/register',
  '/auth/register',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('joyas-static-') && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (!['http:', 'https:'].includes(url.protocol)) return
  if (request.method !== 'GET') return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  event.respondWith(handleStaticRequest(request))
})

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put('/index.html', networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match('/index.html')
    if (cachedResponse) return cachedResponse

    return new Response('Sin conexion', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function handleApiRequest(request) {
  const url = new URL(request.url)

  if (AUTH_ENDPOINTS.some((endpoint) => url.pathname.includes(endpoint))) {
    try {
      return await fetch(request)
    } catch (error) {
      return jsonOffline('No se pudo conectar al servidor')
    }
  }

  try {
    return await fetch(request)
  } catch (error) {
    return jsonOffline('No se pudo conectar al servidor. Verifica tu conexion a internet.')
  }
}

async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    return new Response('Sin conexion', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

function jsonOffline(message) {
  return new Response(
    JSON.stringify({
      error: 'Sin conexion',
      message,
      offline: true,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
