// public/sw.js
// Service Worker para notificações push do Doonly
// Coloque este arquivo em: public/sw.js (na raiz do build, acessível em /sw.js)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe a notificação push do servidor e exibe
self.addEventListener("push", (event) => {
  let data = { title: "Doonly", body: "Você tem uma nova notificação", url: "/" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || "/Sistema/icon-192.png",
    badge: data.badge || "/Sistema/badge.png",
    image: data.image,
    data: { url: data.url || "/" },
    vibrate: [120, 60, 120],
    tag: data.tag,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Ao clicar na notificação, abre/foca a janela do app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
