// Ghost Pass Wallet Service Worker
// Enables PWA functionality and offline capabilities

const CACHE_NAME = 'ghost-pass-wallet-v1';
const RUNTIME_CACHE = 'ghost-pass-runtime-v1';

// Static assets to precache (production only)
const urlsToCache = [
  '/',
  '/manifest.json',
  '/vite.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🎫 Ghost Pass Service Worker: Caching resources');
        return cache.addAll(urlsToCache).catch((err) => {
          console.warn('🎫 Ghost Pass Service Worker: Some resources failed to cache', err);
        });
      })
      .then(() => {
        console.log('🎫 Ghost Pass Service Worker: Installed successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Activating...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('🎫 Ghost Pass Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('🎫 Ghost Pass Service Worker: Activated successfully');
      return self.clients.claim();
    })
  );
});

// Helper to determine if request should bypass cache
function shouldBypassCache(request) {
  const url = new URL(request.url);
  
  // DEVELOPMENT MODE: Bypass everything on localhost with dev server patterns
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    // 1. Vite dev server HMR and module requests
    if (url.pathname.startsWith('/@vite/') || 
        url.pathname.startsWith('/@react-refresh') ||
        url.pathname.startsWith('/@fs/') ||
        url.pathname.startsWith('/src/') ||
        url.pathname.includes('node_modules') ||
        url.pathname.includes('.vite') ||
        url.search.includes('?t=') ||
        url.search.includes('?v=') ||
        url.search.includes('?import')) {
      return true;
    }
    
    // 2. API requests (any port)
    if (url.pathname.startsWith('/api/') || url.port !== '3000') {
      return true;
    }
  }
  
  // 3. Cross-origin requests (fonts, external APIs, etc.)
  if (url.origin !== self.location.origin) {
    return true;
  }
  
  // 4. Non-GET requests
  if (request.method !== 'GET') {
    return true;
  }
  
  return false;
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  // Bypass cache for certain requests
  if (shouldBypassCache(event.request)) {
    return;
  }

  const url = new URL(event.request.url);
  
  // Strategy 1: Network-first for HTML documents (ensures fresh content)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            // Update cache with fresh response
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => {
            // Fallback to cache if offline
            return cache.match(event.request).then((cachedResponse) => {
              return cachedResponse || caches.match('/').then((fallback) => {
                return fallback || new Response(
                  `<!DOCTYPE html>
                  <html>
                    <head>
                      <title>Ghost Pass - Offline</title>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <style>
                        body { 
                          font-family: system-ui, -apple-system, sans-serif; 
                          background: #0f172a; 
                          color: white; 
                          display: flex; 
                          align-items: center; 
                          justify-content: center; 
                          min-height: 100vh; 
                          margin: 0; 
                          text-align: center; 
                        }
                        .container { max-width: 400px; padding: 2rem; }
                        h1 { color: #06b6d4; margin-bottom: 1rem; }
                        p { color: #94a3b8; line-height: 1.6; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <h1>🎫 Ghost Pass Wallet</h1>
                        <p>You're currently offline. Your wallet data is safely stored and will sync when you reconnect.</p>
                        <p>Try refreshing the page when you have internet connection.</p>
                      </div>
                    </body>
                  </html>`,
                  { headers: { 'Content-Type': 'text/html' } }
                );
              });
            });
          });
      })
    );
    return;
  }
  
  // Strategy 2: Cache-first for static assets (images, fonts, CSS, JS)
  if (event.request.destination === 'image' || 
      event.request.destination === 'font' ||
      event.request.destination === 'style' ||
      event.request.destination === 'script') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request).then((networkResponse) => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }
  
  // Strategy 3: Network-only for everything else
  return;
});

// Handle background sync for wallet operations
self.addEventListener('sync', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Background sync triggered');
  if (event.tag === 'wallet-sync') {
    event.waitUntil(
      // Sync wallet data when back online
      syncWalletData()
    );
  }
});

// Handle push notifications for wallet updates
self.addEventListener('push', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Push notification received');
  
  let notificationData = {
    title: 'Ghost Pass Wallet',
    body: 'Your Ghost Pass wallet has been updated',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'ghost-pass-wallet',
    requireInteraction: false,
    data: {
      url: '/?tab=wallet'
    },
    actions: []
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (error) {
      console.error('Failed to parse push data:', error);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Notification clicked');
  event.notification.close();

  // Get the URL from notification data or use default
  const urlToOpen = event.notification.data?.url || '/';

  // Handle action clicks
  if (event.action === 'view-wallet') {
    event.waitUntil(
      clients.openWindow('/?tab=wallet')
    );
  } else if (event.action === 'view-history') {
    event.waitUntil(
      clients.openWindow('/?tab=history')
    );
  } else if (event.action === 'open-wallet') {
    event.waitUntil(
      clients.openWindow('/?tab=wallet')
    );
  } else {
    // Default action - open the URL from notification data
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Sync wallet data function
async function syncWalletData() {
  try {
    console.log('🎫 Ghost Pass Service Worker: Syncing wallet data...');
    // This would sync any pending wallet operations
    // For now, just log that sync is happening
    console.log('🎫 Ghost Pass Service Worker: Wallet sync completed');
  } catch (error) {
    console.error('🎫 Ghost Pass Service Worker: Wallet sync failed:', error);
  }
}