/* SynthLab Studio v1.7.2 — cache/offline */
const CACHE_NAME = 'synthlab-studio-v1-7-2-quick-timer-audio-cache-20260801';
const CORE_ASSETS = [
  './',
  './index.html?v=studio1_7_2',
  './style.css?v=studio1_7_2',
  './presets.js?v=studio1_7_2',
  './app.js?v=studio1_7_2',
  './manifest.json?v=studio1_7_2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './limpar_cache.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html?v=studio1_7_2')))
  );
});
