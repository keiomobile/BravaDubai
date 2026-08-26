/* Service worker de limpieza: borra cachés viejas y se desregistra.
   No intercepta nada y no fuerza recargas. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
      await self.registration.unregister();
    } catch(e){}
  })());
});
self.addEventListener('fetch', function(e){ /* passthrough: todo va directo a la red */ });
