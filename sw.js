const CACHE='quotes-pwa-v5';
const ASSETS=['./','./index.html','./app.js','./manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(cached=>{
    const net=fetch(e.request).then(res=>{
      if(res&&res.status===200&&res.type!=='opaque'){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
      return res;
    }).catch(()=>cached||new Response('Offline',{status:503}));
    return cached||net;
  }));
});
