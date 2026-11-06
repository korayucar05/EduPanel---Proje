const CACHE_NAME="enstitu-shell-v6";
const SHELL=["/","/manifest.webmanifest","/enstitu-sidebar-logo.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).catch(()=>undefined));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/"))return;

  // Development/source resources are always network-first.
  if(url.pathname.startsWith("/src/")||url.pathname.startsWith("/@vite/")||url.pathname.startsWith("/@react-refresh")||url.pathname.startsWith("/node_modules/.vite/")){
    event.respondWith(fetch(request));
    return;
  }

  // Navigation must use the newest index.html so old splash HTML can never persist.
  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request,{cache:"no-store"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(value=>value||caches.match("/")))
    );
    return;
  }

  if(url.pathname.startsWith("/assets/")){
    event.respondWith(fetch(request).catch(()=>caches.match(request)));
    return;
  }

  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(()=>caches.match(request))
  );
});
