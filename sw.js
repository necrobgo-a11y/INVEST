// SW v4 with cache busting
const CACHE = 'mbi-cache-v4';
const ASSETS = [
  './',
  './index.html?v=4',
  './style.css?v=4',
  './app.js?v=4',
  './manifest.webmanifest?v=4',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=> k!==CACHE).map(k=> caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith((async()=>{
    const cached = await caches.match(req);
    try{
      const fresh = await fetch(req);
      if(req.method==='GET' && fresh && fresh.ok){
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    }catch(err){
      return cached || Response.error();
    }
  })());
});
