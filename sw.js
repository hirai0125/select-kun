// セレクト君：オフラインでも開けるようにするためのキャッシュ
const CACHE = "select-kun-v3";
const TILES = "select-kun-tiles";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./leaflet/leaflet.js", "./leaflet/leaflet.css", "./leaflet/images/marker-icon.png", "./leaflet/images/layers.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // 新しい版があれば取りに行き、圏外ならキャッシュを使う
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
  } else if (url.hostname === "cyberjapandata.gsi.go.jp" || url.hostname === "tile.openstreetmap.org") {
    // 一度見た地図はキャッシュしておき、圏外でも表示（上限 約3000枚）
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) { c.put(req, res.clone()); c.keys().then(k => { if (k.length > 3000) c.delete(k[0]); }); } return res; });
      return hit || net;
    })));
  }
});
