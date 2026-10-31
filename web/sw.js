// Zakupy - praca bez internetu na iPhonie / w przegladarce.
// Strona zawsze z pamieci telefonu (szybko, takze w sklepie bez zasiegu).
// Nowa wersje strona pobiera sama: index.html?sprawdz=... idzie z sieci i podmienia kopie w pamieci.
const CACHE = 'zakupy';
const PLIKI = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PLIKI.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/version.json')) return;                     // zawsze z sieci
  const strona = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html');
  const klucz = strona ? new URL('index.html', self.registration.scope).href : u.origin + u.pathname;

  if (u.searchParams.has('sprawdz')) {
    e.respondWith(fetch(u.origin + u.pathname, { cache: 'no-store' }).then(async (res) => {
      if (res.ok) { const c = await caches.open(CACHE); await c.put(klucz, res.clone()); }
      return res;
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then((c) => c.match(klucz).then((hit) => hit || fetch(r).then((res) => {
    if (res.ok) c.put(klucz, res.clone());
    return res;
  }))));
});
