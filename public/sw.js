// public/sw.js
// Service Worker para notificações push do Doonly
// Coloque este arquivo em: public/sw.js (na raiz do build, acessível em /sw.js)

// (10/10) Página "sem internet" do próprio Doonly: fica guardada no aparelho e aparece
// quando o app é aberto sem conexão (antes aparecia a página de erro do navegador).
const CACHE_OFFLINE = "doonly-offline-v1";
const ARQUIVOS_OFFLINE = ["/offline.html", "/fonts/Geist-Medium.woff2", "/fonts/Geist-Bold.woff2", "/marca/leve/senha.webp", "/marca/leve/texto.webp"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_OFFLINE)
      .then((cache) => Promise.all(ARQUIVOS_OFFLINE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Só entra em ação ao ABRIR uma página sem internet. Com internet, tudo segue direto pra rede, como antes.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match("/offline.html")) || Response.error())
    );
    return;
  }
  // os arquivos da própria página sem internet (letra e mascote), quando a rede falha
  const url = new URL(req.url);
  if (req.method === "GET" && url.origin === self.location.origin && ARQUIVOS_OFFLINE.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(url.pathname)) || Response.error()));
  }
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
    silent: false,
    renotify: !!data.tag,
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
