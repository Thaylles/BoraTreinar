/* Service worker do BoraTreinar.
 * - Arquivos estáticos do Next (/_next/static) e ícones: cache primeiro (são imutáveis).
 * - Imagens dos exercícios: cache primeiro, atualizando em segundo plano.
 * - Telas de treino (execução da ficha, treino livre, registro manual): rede primeiro e,
 *   sem internet, a última versão salva — assim o treino abre mesmo com a conexão caindo.
 * - Demais páginas: só rede; sem internet, mostra /offline.html (página estática, sem JS do Next).
 * - Ao sair da conta (POST /sair), apaga as páginas salvas.
 */
const VERSION = "v1";
const STATIC = `bt-static-${VERSION}`;
const ASSETS = `bt-assets-${VERSION}`;
const PAGES = `bt-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon.svg"];
const WORKOUT_PAGES = [/^\/aluno\/treinar\//, /^\/aluno\/livre(\/|$)/, /^\/personal\/alunos\/[^/]+\/registrar\//, /^\/aluno\/fichas\//];
const MAX_ASSETS = 200;
const MAX_PAGES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bt-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName, revalidate) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const update = () =>
    fetch(request)
      .then((res) => {
        if (res.ok || res.type === "opaque") {
          cache.put(request, res.clone());
          if (cacheName === ASSETS) trim(ASSETS, MAX_ASSETS);
        }
        return res;
      })
      .catch(() => undefined);
  if (hit) {
    if (revalidate) update(); // atualiza em segundo plano
    return hit;
  }
  return (await update()) || Response.error();
}

async function workoutPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) {
      cache.put(request, res.clone());
      trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function otherPage(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Saiu da conta: apaga as telas salvas (podem ter dados pessoais).
  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/sair") {
    event.waitUntil(caches.delete(PAGES));
    return;
  }
  if (request.method !== "GET") return;

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request, STATIC, false));
      return;
    }
    if (url.pathname.startsWith("/catalogo/") || url.pathname.startsWith("/_next/image")) {
      event.respondWith(cacheFirst(request, ASSETS, true));
      return;
    }
    if (request.mode === "navigate") {
      const isWorkout = WORKOUT_PAGES.some((re) => re.test(url.pathname));
      event.respondWith(isWorkout ? workoutPage(request) : otherPage(request));
    }
    return;
  }

  // Fotos de exercícios no Supabase Storage (públicas).
  if (url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith(cacheFirst(request, ASSETS, true));
  }
});
