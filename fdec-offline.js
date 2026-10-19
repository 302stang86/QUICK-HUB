/* FDEC Quick Hub — offline support (classic script, safe to include on any page)
   1) Registers the service worker (offline caching + installable app).
   2) Shows a small status badge: Online / Offline / Syncing / Synced.
   Pages that use Firestore can register a "pending writes" waiter so the badge
   can confirm the queue has synced after signal returns:
       window.FDEC_OFFLINE.registerWait(() => waitForPendingWrites(db));   // modular
       window.FDEC_OFFLINE.registerWait(() => db.waitForPendingWrites());  // compat
   Registration is order-independent: a page may push a waiter before this
   script loads via  (window.__fdecWaiters = window.__fdecWaiters || []).push(fn). */
(function () {
  "use strict";

  /* ---- 1) service worker ---- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* ---- 2) status badge ---- */
  var waiters = (window.__fdecWaiters = window.__fdecWaiters || []);
  var badge, label, dot, hideTimer;

  function build() {
    if (badge || document.getElementById("fdec-netbadge")) return;
    badge = document.createElement("div");
    badge.id = "fdec-netbadge";
    badge.className = "no-print";
    badge.style.cssText =
      "position:fixed;z-index:2147483000;" +
      "bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
      "left:calc(12px + env(safe-area-inset-left,0px));" +
      "display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;" +
      "font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;" +
      "color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.28);pointer-events:none;" +
      "transition:background .25s ease,opacity .5s ease;opacity:1;";
    dot = document.createElement("span");
    dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#fff;flex:none";
    label = document.createElement("span");
    badge.appendChild(dot);
    badge.appendChild(label);
    (document.body || document.documentElement).appendChild(badge);
  }

  var STATES = {
    online:  { bg: "#1f7a3d", text: "Online" },
    offline: { bg: "#b4690e", text: "Offline — saved on device" },
    syncing: { bg: "#2d5c8a", text: "Syncing…" },
    synced:  { bg: "#1f7a3d", text: "Synced" }
  };

  function set(state) {
    build();
    if (!badge) return;
    var s = STATES[state] || STATES.online;
    badge.style.background = s.bg;
    label.textContent = s.text;
    badge.style.opacity = "1";
    clearTimeout(hideTimer);
    if (state === "online" || state === "synced") {
      // fade the reassuring states after a few seconds so they don't nag
      hideTimer = setTimeout(function () { badge.style.opacity = "0"; }, 3000);
    }
  }

  function goOnline() {
    // back online: if any page queued writes, show syncing until they flush
    var fns = waiters.slice();
    if (!fns.length) { set("online"); return; }
    set("syncing");
    Promise.all(fns.map(function (f) {
      try { return Promise.resolve(f()); } catch (e) { return Promise.resolve(); }
    })).then(function () { set("synced"); }).catch(function () { set("online"); });
  }

  window.addEventListener("online", goOnline);
  window.addEventListener("offline", function () { set("offline"); });

  window.FDEC_OFFLINE = {
    registerWait: function (fn) { if (typeof fn === "function") waiters.push(fn); },
    set: set
  };

  function init() { set(navigator.onLine ? "online" : "offline"); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
