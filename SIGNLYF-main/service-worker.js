const CACHE_NAME = "signlyf-v2";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",

    // CSS
    "./css/style.css",
    "./css/modes.css",

    // JavaScript
    "./js/app.js",
    "./js/asl-to-speech.js",
    "./js/speech-to-asl.js",

    // Pages
    "./pages/asl-to-speech.html",
    "./pages/speech-to-asl.html"
];


// =========================
// INSTALL
// =========================

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                console.log("SIGNLYF: caching app files");

                return cache.addAll(FILES_TO_CACHE);

            })

    );

    self.skipWaiting();

});


// =========================
// ACTIVATE
// =========================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))

                );

            })

    );

    self.clients.claim();

});


// =========================
// FETCH
// =========================

self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request);

            })

    );

});