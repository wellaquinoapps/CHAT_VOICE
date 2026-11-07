self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manipulador de fetch mínimo obrigatório pelo Chrome para habilitar instalação PWA
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let title = '📞 Chamada Recebida!';
  let body = 'Alguém está chamando você no PrivateLine.';
  let tag = 'incoming-call';

  try {
    if (event.data) {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.tag) tag = data.tag;
    }
  } catch (e) {
    if (event.data) body = event.data.text();
  }

  // Notificação com vibração prolongada e som para acordar a tela do celular
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: true,
    requireInteraction: true, // Mantém a notificação na tela até o usuário interagir
    vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500], // Padrão de toque longo
    data: {
      url: '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao tocar na notificação, abre o app direto na chamada
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

