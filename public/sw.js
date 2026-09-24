/* Build script injects content-addressed version and the complete static artifact. */
const VERSION = "__BUILD_VERSION__";
const PRECACHE = ["__PRECACHE__"];
const PREFIX = "worlds-of-spice-";
const CACHE = PREFIX + VERSION;
const SCOPE = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  if (VERSION.startsWith("__")) return;
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(new URL(url, SCOPE), { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});
async function handle(request) {
  const cache = await caches.open(CACHE);
  if (request.mode === "navigate") {
    try {
      const response = await fetch(request);
      if (response.ok) return response;
    } catch { /* The fully precached page is the offline fallback. */ }
    return (await cache.match(new URL("./", SCOPE))) || Response.error();
  }
  const cached = await cache.match(request.url);
  // Safari and Chromium request MP3 byte ranges; cached whole files need a 206 reply.
  if (cached && request.headers.has("range")) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") || "");
    if (match) {
      const buffer = await cached.arrayBuffer();
      const start = Number(match[1]);
      const end = Math.min(buffer.byteLength - 1, match[2] ? Number(match[2]) : buffer.byteLength - 1);
      if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${buffer.byteLength}` } });
      return new Response(buffer.slice(start, end + 1), { status: 206, headers: {
        "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
        "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes",
      } });
    }
  }
  if (cached) return cached;
  // Never substitute HTML for missing JavaScript, images or audio.
  try { return await fetch(request); } catch { return Response.error(); }
}
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith(handle(event.request));
});
