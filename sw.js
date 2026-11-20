const CACHE_NAME = 'truecopy-shell-v3';
const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

const BYPASS_URL_PATTERNS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'accounts.google.com',
  'firebaseapp.com',
  'firebaseio.com',
  'gstatic.com/firebasejs'
];

function shouldBypassCache(urlStr) {
  return BYPASS_URL_PATTERNS.some((pattern) => urlStr.includes(pattern));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const urlStr = req.url || '';
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) return;
  if (shouldBypassCache(urlStr)) return;

  const url = new URL(urlStr);
  const isSameOrigin = url.origin === self.location.origin;
  const isHtmlNav =
    req.mode === 'navigate' ||
    (isSameOrigin && (url.pathname === '/' || url.pathname.endsWith('/index.html')));

  if (isHtmlNav) {
    // Network-First for HTML shell so security updates arrive immediately when online
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  const isStaleWhileRevalidateTarget =
    isSameOrigin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com';

  if (isStaleWhileRevalidateTarget) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req)
            .then((res) => {
              if (res && (res.status === 200 || res.type === 'opaque')) {
                cache.put(req, res.clone()).catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});
