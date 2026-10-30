/* FDEC Quick Hub — service worker
   Caches the whole hub so every page opens with no signal, and lets the hub
   install to a phone's home screen. Served from the repo root, so its scope
   covers all pages (e.g. https://<user>.github.io/QUICK-HUB/).

   Strategy:
     - Page loads (navigation): network-first, fall back to the cached copy
       (fresh when online, still opens underground).
     - Same-origin assets (js, css, images): stale-while-revalidate (instant,
       updates quietly in the background).
     - Firebase / library CDNs (gstatic, cdnjs, jsdelivr): cache-first, so the
       sign-in and data libraries also work with no signal after the first load.
     - Everything else (Firestore API, etc.): straight to network — Firestore's
       own offline mode handles those when there is no signal.
*/
const CACHE = 'fdec-quickhub-v101-help-update';

const CORE = [
  "troubleshooting-data.js",
  "troubleshooting-ui.js",
  "troubleshooting-assets/gem-a6.pdf",
  "troubleshooting-assets/gem-f311.pdf",
  "troubleshooting-assets/reliable-b1.pdf",
  "troubleshooting-assets/reliable-ddx.pdf",
  "troubleshooting-assets/tyco-acc1.pdf",
  "troubleshooting-assets/tyco-dpv1.pdf",
  "troubleshooting-assets/victaulic-746.pdf",
  "troubleshooting-assets/victaulic-768n.pdf",

  "field-library-resources.js",
  "library-assets/agf-1000-1.jpg",
  "library-assets/agf-1000-2.jpg",
  "library-assets/agf-5600-1.jpg",
  "library-assets/agf-5600-2.jpg",
  "library-assets/agf-7900-1.jpg",
  "library-assets/agf-7900-2.jpg",
  "library-assets/agf-inspectorstest-5600.pdf",
  "library-assets/agf-purgenvent-7900.pdf",
  "library-assets/agf-testandrain-1000.pdf",
  "library-assets/tyco-dv5a.jpg",
  "library-assets/victaulic-768n.jpg",

  'fdec-industrial-header-option1.png',
  './',
  'index.html',
  'administration.html',
  'announcements.html',
  'fdec-itm-sop.html',
  'fire-dispatch-directory.html',
  'help.html',
  'incident-report.html',
  'inventory-tracker.html',
  'itm-reports.html',
  'nfpa25-frequencies.html',
  'nfpa-field-library.html',
  'nicet-study.html',
  'nicet-study-hero.jpg',
  'nicet-cpd-guide.html',
  'nicet-level-1.html',
  'nicet-level-2.html',
  'nicet-level-3.html',
  'nicet-common.js',
  'oncall.html',
  'quoting.html',
  'fire-alarm-quoting.html',
  'timeoff.html',
  'timesheet.html',
  'expense-report.html',
  'troubleshooting-guide.html',
  'troubleshooting-tech.mp4',
  'fleet-service-request-firebase.html',
  'fleet-requests.html',
  'fdec-fleet-integration.js',
  'fleet-vehicles.js',
  'fdec-bg.css',
  'fdec-auth.js',
  'fdec-identity.js',
  'fdec-offline.js',
  'fdec-header.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Tolerant precache: one missing file never breaks the whole install.
    await Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isLibraryCDN(url) {
  const h = url.hostname;
  return h === 'www.gstatic.com' || h.endsWith('.gstatic.com') ||
         h === 'cdnjs.cloudflare.com' || h === 'cdn.jsdelivr.net' ||
         h === 'unpkg.com' || h === 'code.jquery.com';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // let writes/POST hit network
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  if (url.origin === self.location.origin) {
    // Code (pages, scripts, styles, manifest) = network-first so updates land
    // immediately when online, then fall back to cache offline. Media/images =
    // stale-while-revalidate (instant, refresh quietly).
    if (req.mode === 'navigate' || /\.(?:html|js|css|webmanifest|json)(?:$|\?)/i.test(url.pathname)) {
      e.respondWith(networkFirst(req));
    } else {
      e.respondWith(staleWhileRevalidate(req));
    }
  } else if (isLibraryCDN(url)) {
    e.respondWith(cacheFirst(req));
  }
  // otherwise: do nothing -> browser handles it (Firestore/Auth API calls)
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) ||
           (await c.match('index.html')) ||
           new Response('<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:24px;color:#1B2A4A"><h1>Offline</h1><p>This page has not been opened on this device yet. Open it once while you have signal, then it will work offline.</p>',
             { headers: { 'Content-Type': 'text/html' } });
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const cached = await c.match(req, { ignoreSearch: false });
  const net = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await net) || new Response('', { status: 504 });
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const cached = await c.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  } catch (_) {
    return cached || new Response('', { status: 504 });
  }
}
