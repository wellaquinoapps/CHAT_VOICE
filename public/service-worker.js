self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manipulador de fetch mínimo obrigatório pelo Chrome para habilitar instalação PWA
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request) as any)
  );
});

self.addEventListener('push', (event) => {
  let title = 'PrivateLine';
  let body = 'Nova notificação na sua família.';
  try {
    if (event.data) {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
    }
  } catch (e) {
    if (event.data) body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

