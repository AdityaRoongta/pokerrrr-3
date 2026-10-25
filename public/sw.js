// Cache only static install assets; private game data is always network-only.
const CACHE='dunzo-club-assets-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/icon-192.png','/icon-512.png','/manifest.webmanifest'])));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin===self.location.origin&&['/icon-192.png','/icon-512.png','/manifest.webmanifest'].includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
