const CACHE_NAME = 'quote-box-v13';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './season.css',
  './brush.css',
  './season.js',
  './art/spring.jpg',
  './art/summer.jpg',
  './art/autumn.jpg',
  './art/winter.jpg',
  './app.js',
  './qrcode.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 네트워크 우선: 새 버전이 배포되면 바로 보이고, 오프라인일 때만 저장된 파일을 쓴다
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
