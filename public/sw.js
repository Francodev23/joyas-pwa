// Service Worker para PWA Joyas
// Versión del cache estático
const CACHE_VERSION = 'v1'
const STATIC_CACHE = `joyas-static-${CACHE_VERSION}`

// Assets estáticos a cachear en install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

// Endpoints de auth que NO deben cachearse
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/auth/login',
  '/api/auth/register',
  '/auth/register',
]

// Install: Cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
    })
  )
  self.skipWaiting()
})

// Activate: Limpiar caches viejas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('joyas-static-') && name !== STATIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  return self.clients.claim()
})

// Fetch: Estrategia de cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests que no sean http: o https: (ej: chrome-extension://)
  if (!['http:', 'https:'].includes(url.protocol)) {
    return // Dejar pasar directo, no interceptar
  }

  // Solo manejar requests GET (otros métodos pasan directo)
  if (request.method !== 'GET') {
    return // Dejar pasar directo a network
  }

  // Requests a /api/* → Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // Assets estáticos → Cache-first
  event.respondWith(handleStaticRequest(request))
})

// Estrategia Network-First para API
async function handleApiRequest(request) {
  const url = new URL(request.url)

  // NO cachear endpoints de auth
  if (AUTH_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    // Passthrough directo, sin cache
    try {
      return await fetch(request)
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Sin conexión',
          message: 'No se pudo conectar al servidor',
          offline: true 
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  // Network-first para otros endpoints GET
  try {
    const networkResponse = await fetch(request)
    
    // Solo cachear respuestas exitosas (200-299)
    if (networkResponse.ok) {
      // No guardamos en cache, solo usamos network
      // Esto evita inconsistencias de datos
    }
    
    return networkResponse
  } catch (error) {
    // Si falla la red, devolver 503 JSON (no inventar datos viejos)
    return new Response(
      JSON.stringify({ 
        error: 'Sin conexión',
        message: 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
        offline: true 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Estrategia Cache-First para assets estáticos
async function handleStaticRequest(request) {
  try {
    // Verificar que el request sea http/https antes de cachear
    const url = new URL(request.url)
    if (!['http:', 'https:'].includes(url.protocol)) {
      // Si no es http/https, hacer fetch directo sin cache
      return await fetch(request)
    }

    // Intentar cache primero
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Si no está en cache, ir a network
    const networkResponse = await fetch(request)
    
    // Cachear respuesta exitosa para próximas veces (solo http/https)
    if (networkResponse.ok && ['http:', 'https:'].includes(url.protocol)) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Si falla network y no hay cache, devolver respuesta básica
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fallback: intentar servir index.html para rutas de la app
    if (request.mode === 'navigate') {
      const indexCache = await caches.match('/index.html')
      if (indexCache) {
        return indexCache
      }
    }
    
    // Último recurso: error
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

