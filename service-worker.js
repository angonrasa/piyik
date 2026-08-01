// service-worker.js
// Offline-first sederhana untuk Piyik Brain.
// Taruh file ini SEJAJAR dengan index.html (di root), bukan di dalam src/,
// supaya scope service worker mencakup seluruh aplikasi.

const CACHE_NAME = "piyik-brain-v1";

// Daftar file inti yang wajib ada supaya app tetap bisa dibuka saat offline.
// Sesuaikan path di bawah ini dengan struktur project-mu (src/index.js, dst).
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/index.js",
];

// Saat install: simpan app shell ke cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Saat activate: hapus cache versi lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategi: cache-first, fallback ke network, lalu simpan hasil network ke cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
