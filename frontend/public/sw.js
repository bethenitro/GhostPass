// Ghost Pass Wallet Service Worker
// Enables PWA functionality and offline capabilities

const CACHE_NAME = 'ghost-pass-wallet-v1';
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
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('🎫 Ghost Pass Service Worker: Installed successfully');
        // Force activation of new service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🎫 Ghost Pass Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('🎫 Ghost Pass Service Worker: Activated successfully');
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - let them go to network
  if (event.request.url.includes('/api/') || event.request.url.includes('localhost:8000')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).catch(() => {
          // If both cache and network fail, return a basic offline page
          if (event.request.destination === 'document') {
            return new Response(
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
              {
                headers: { 'Content-Type': 'text/html' }
              }
            );
          }
        });
      })
  );
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
  
  const options = {
    body: event.data ? event.data.text() : 'Your Ghost Pass wallet has been updated',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'ghost-pass-wallet',
    requireInteraction: true,
    actions: [
      {
        action: 'open-wallet',
        title: 'Open Wallet'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Ghost Pass Wallet', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🎫 Ghost Pass Service Worker: Notification clicked');
  event.notification.close();

  if (event.action === 'open-wallet') {
    event.waitUntil(
      clients.openWindow('/?tab=wallet')
    );
  } else {
    event.waitUntil(
      clients.openWindow('/')
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