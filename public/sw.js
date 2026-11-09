/* Bílaleit – lágmarks service worker svo hægt sé að setja síðuna á heimaskjá.
   Engin skyndiminni: allt er alltaf sótt af netinu, svo nýjasta útgáfan birtist strax. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
