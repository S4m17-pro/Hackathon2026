const DOCUMENTS = "supervision-docs-v1";
const ASSETS = "supervision-assets-v1";
const FLIGHTS = "supervision-rsc-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  const keep = new Set([DOCUMENTS, ASSETS, FLIGHTS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack")) {
    return;
  }

  const bucket = cacheName(request, url);
  if (bucket === null) {
    return;
  }

  event.respondWith(networkFirst(request, bucket));
});

function cacheName(request, url) {
  if (request.mode === "navigate") {
    return DOCUMENTS;
  }

  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    return FLIGHTS;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image")) {
    return ASSETS;
  }

  return null;
}

async function networkFirst(request, bucket) {
  const cache = await caches.open(bucket);

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const home = await cache.match("/visitas");
      if (home) {
        return home;
      }
    }

    return new Response("Sin conexión. Abre la app una vez con red para guardarla en el teléfono.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
