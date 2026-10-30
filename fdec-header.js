/* FDEC Quick Hub — universal top banner (classic script, safe on any page).
   Prepends one consistent header to every page: the FDEC banner with the page
   title in plain white wrapping text in the rightmost 20%. Each page declares its title with:
       <meta name="fdec-page-title" content="ITM Reports">
   (falls back to document.title). Existing page nav stays below this banner. */
/* ---------- Page icon to the left of the page title (same icons/colors as the hub cards) ---------- */
(function () {
  var ICONS = {"group":"<circle cx=\"12\" cy=\"7\" r=\"3\"/><path d=\"M6.5 20v-1.5A5.5 5.5 0 0 1 12 13a5.5 5.5 0 0 1 5.5 5.5V20\"/><circle cx=\"4.5\" cy=\"9.5\" r=\"2.2\"/><path d=\"M1.5 18.5v-1A3.5 3.5 0 0 1 5 14\"/><circle cx=\"19.5\" cy=\"9.5\" r=\"2.2\"/><path d=\"M22.5 18.5v-1A3.5 3.5 0 0 0 19 14\"/>","admin": "<circle cx=\"12\" cy=\"8\" r=\"3.2\"/><path d=\"M5.5 20a6.5 6.5 0 0 1 10-.3\"/><circle cx=\"18\" cy=\"17\" r=\"2.3\"/><path d=\"M18 14.3v-1.1M18 20.8v-1.1M20.3 15.7l-.9.5M16.6 17.8l-.9.5M20.3 18.3l-.9-.5M16.6 16.2l-.9-.5\"/>", "bell": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/>", "book": "<path d=\"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20\"/>", "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/>", "clipboard-check": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 4.5h6M9 12l2 2 4-4M9 18h6\"/>", "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><polyline points=\"12 7 12 12 15 14\"/>", "doc": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"8\" y1=\"13\" x2=\"16\" y2=\"13\"/><line x1=\"8\" y1=\"17\" x2=\"16\" y2=\"17\"/>", "gearwrench": "<g transform=\"translate(11.2 -1.2) scale(0.5)\"><path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g><g transform=\"translate(-1.5 4) scale(0.72)\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z\"/></g>", "hammer": "<path d=\"m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9\"/><path d=\"M17.64 15 22 10.64\"/><path d=\"m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91\"/>", "hourglass": "<path d=\"M6 3h12M6 21h12\"/><path d=\"M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21\"/>", "megaphone": "<path d=\"m3 11 15-5v12L3 15v-4z\"/><path d=\"M18 8a3 3 0 0 1 0 6\"/><path d=\"M7 15.5V19a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2.5\"/>", "nicet": "<circle cx=\"12\" cy=\"4.3\" r=\"1.6\"/><path d=\"M12 1.2v1.1M12 6.2v1.1M9 4.3h1.1M13.9 4.3h1.1M9.9 2.2l.8.8M13.3 5.6l.8.8M14.1 2.2l-.8.8M10.7 5.6l-.8.8\"/><rect x=\"3.5\" y=\"8.6\" width=\"17\" height=\"9.4\" rx=\"1.6\"/><path d=\"M2 21h20\"/><path d=\"M6.3 13.4l1.5 1.5 2.6-3\"/><path d=\"M14 12.3l3.2 3.2M17.2 12.3l-3.2 3.2\"/>", "phone": "<path d=\"M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.4.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.5.6 3.6a1 1 0 0 1-.2 1l-2.3 2.2z\"/>", "pin": "<path d=\"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>", "quote": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><path d=\"M12 18v-6\"/><path d=\"M13.6 13.2c0-.7-.8-1.2-1.6-1.2s-1.6.5-1.6 1.2.8 1.2 1.6 1.2 1.6.5 1.6 1.2-.8 1.2-1.6 1.2-1.6-.5-1.6-1.2\"/>", "search": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><line x1=\"16.5\" y1=\"16.5\" x2=\"21\" y2=\"21\"/>", "truck": "<path d=\"M3 7h11v11H3z\"/><path d=\"M14 11h4l3 3v4h-7z\"/><circle cx=\"7.5\" cy=\"18\" r=\"2\"/><circle cx=\"17.5\" cy=\"18\" r=\"2\"/><path d=\"M3 18h2.5M9.5 18H15.5M19.5 18H21\"/>"};
  var PAGES = {"index.html":["group","#3fa9f5"],"announcements.html": ["megaphone", "#1f7a3d"], "itm-reports.html": ["doc", "#1565c0"], "fdec-itm-sop.html": ["doc", "#1565c0"], "fire-dispatch-directory.html": ["pin", "#6d3bb5"], "troubleshooting-guide.html": ["search", "#0e8a84"], "nfpa25-frequencies.html": ["hourglass", "#d12f2f"], "nfpa-field-library.html": ["book", "#5e60a8"], "nicet-study.html": ["nicet", "#0e7490"], "nicet-level-1.html": ["nicet", "#0e7490"], "nicet-level-2.html": ["nicet", "#0e7490"], "nicet-level-3.html": ["nicet", "#0e7490"], "nicet-cpd-guide.html": ["nicet", "#0e7490"], "inventory-tracker.html": ["gearwrench", "#4a7b9d"], "fleet-service-request-firebase.html": ["truck", "#376c91"], "fleet-requests.html": ["clipboard-check", "#2c6950"], "quoting.html": ["quote", "#1565c0"], "fire-alarm-quoting.html": ["bell", "#d12f2f"], "timeoff.html": ["calendar", "#1f7a3d"], "oncall.html": ["phone", "#d12f2f"], "expense-report.html": ["clock", "#6d3bb5"], "administration.html": ["admin", "#c08a1e"], "help.html": ["hammer", "#5b6570"]};
  function pageFile() {
    var p = (location.pathname || "").split("/").pop();
    return p || "index.html";
  }
  window.__fdecPageIcon = function () {
    var e = PAGES[pageFile()];
    if (!e || !ICONS[e[0]]) return null;
    var el = document.createElement("span");
    el.className = "fdec-ubar-icon";
    el.style.setProperty("--cc", e[1]);
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[e[0]] + "</svg>";
    return el;
  };
})();

(function () {
  "use strict";
  if (window.__fdecHeaderDone) return; window.__fdecHeaderDone = true;

  var BANNER = "fdec-industrial-header-option1.png";

  function titleText() {
    var m = document.querySelector('meta[name="fdec-page-title"]');
    if (m && m.content) return m.content;
    var t = (document.title || "").split("—")[0].split("|")[0].trim();
    return t || "Quick Hub";
  }

  function injectCSS() {
    if (document.getElementById("fdec-ubar-css")) return;
    var s = document.createElement("style");
    s.id = "fdec-ubar-css";
    s.textContent = [
      ".fdec-ubar{position:relative;width:100%;background:#071b35;line-height:0;z-index:5;aspect-ratio:1600/135;overflow:hidden;padding:0;margin:0;border:0;border-radius:0;box-sizing:border-box;}",
      ".fdec-ubar::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 70%,#071b35 81%);pointer-events:none;width:auto;height:auto;border:0;border-radius:0;}",
      ".fdec-ubar-bg{display:block;position:absolute;width:81%;height:auto;max-width:none;left:0;top:50%;transform:translateY(-50%);margin:0;}",
      ".fdec-ubar-title{position:absolute;z-index:1;left:80%;right:1%;top:5%;bottom:5%;display:flex;align-items:center;justify-content:flex-start;pointer-events:none;}",
      ".fdec-ubar-icon{--l:color-mix(in srgb,var(--cc,#5b6570) 62%,#fff);--d:color-mix(in srgb,var(--cc,#5b6570) 52%,#000);position:relative;flex:0 0 auto;width:clamp(22px,3.1vw,46px);height:clamp(22px,3.1vw,46px);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:clamp(4px,.7vw,10px);background:linear-gradient(145deg,#f5f7f9 0%,#9aa4ae 38%,#e9edf0 55%,#5f6a75 100%);box-shadow:0 4px 8px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.5);}",
      ".fdec-ubar-icon::before{content:\"\";position:absolute;inset:8%;border-radius:50%;background:var(--cc,#5b6570);background:radial-gradient(circle at 32% 24%,var(--l) 0%,var(--cc,#5b6570) 45%,var(--d) 100%);box-shadow:inset 0 -2px 4px rgba(0,0,0,.35),inset 0 1px 2px rgba(255,255,255,.35),inset 0 0 0 1px rgba(0,0,0,.25);}",
      ".fdec-ubar-icon::after{content:\"\";position:absolute;left:17%;top:8%;width:66%;height:40%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,0));}",
      ".fdec-ubar-icon svg{position:relative;z-index:1;width:50%;height:50%;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.55));}",
      ".fdec-ubar-h1{color:#fff;font-weight:400;letter-spacing:normal;font-family:Arial,Helvetica,sans-serif;font-size:clamp(8px,1.55vw,25px);line-height:1.16;white-space:normal;overflow-wrap:normal;word-break:normal;text-shadow:none;margin:0;padding:0;text-align:left;}",
      /* relocated action buttons: a slim bar directly under the banner */
      ".fdec-ubar-actions{position:relative;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px;",
        "line-height:normal;background:#0f1b2e;padding:7px 14px 8px;",
        "padding-left:max(14px,env(safe-area-inset-left));padding-right:max(14px,env(safe-area-inset-right));}",
      ".fdec-ubar-actions:empty{display:none;}",
      ".fdec-ubar-actions > *{line-height:1;position:static !important;margin:0 !important;top:auto !important;left:auto !important;right:auto !important;bottom:auto !important;float:none !important;}",
      ".fdec-ubar-actions button,.fdec-ubar-actions a,.fdec-ubar-actions input[type=button],.fdec-ubar-actions input[type=submit]{",
        "font:600 12px/1 Arial,Helvetica,sans-serif !important;color:#fff !important;",
        "background:rgba(255,255,255,.14) !important;border:1px solid rgba(255,255,255,.42) !important;",
        "border-radius:7px !important;padding:6px 11px !important;cursor:pointer;text-decoration:none !important;",
        "white-space:nowrap;display:inline-flex;align-items:center;box-shadow:none !important;min-height:0 !important;}",
      ".fdec-ubar-actions button:hover,.fdec-ubar-actions a:hover{background:rgba(255,255,255,.26) !important;}",
      ".fdec-ubar-actions #whoami,.fdec-ubar-actions .who,.fdec-ubar-actions .whoami,.fdec-ubar-actions .admin-note{",
        "background:none !important;border:0 !important;color:#dbe6f4 !important;font:700 12px/1.2 Arial,sans-serif !important;",
        "padding:4px 2px !important;box-shadow:none !important;}",
      "@media print{.fdec-ubar,.fdec-ubar-actions{display:none !important;}}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function build() {
    if (document.querySelector(".fdec-ubar")) return;
    // When this page is embedded inside another page (an iframe, e.g. the
    // Incident Reporting tab on Home), skip the banner so it does not show a
    // second time — just hide the page's own masthead so only the form shows.
    var framed = false;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (framed) { relocate(document.createElement("div")); document.documentElement.classList.remove("fdec-header-boot"); return; }
    injectCSS();
    var header = document.createElement("header");
    header.className = "fdec-ubar no-print";
    var img = document.createElement("img");
    img.className = "fdec-ubar-bg";
    img.src = BANNER;
    img.alt = "Fire Defense Equipment Co.";
    header.appendChild(img);
    var title = document.createElement("div");
    title.className = "fdec-ubar-title";
    var label = document.createElement("div");
    label.className = "fdec-ubar-h1";
    label.textContent = titleText();
    var pic = window.__fdecPageIcon && window.__fdecPageIcon();
    if (pic) title.appendChild(pic);
    title.appendChild(label);
    header.appendChild(title);
    header.setAttribute("aria-label", "Fire Defense Equipment Co. — " + titleText());
    var actions = document.createElement("div");
    actions.className = "fdec-ubar-actions no-print";
    document.body.insertBefore(header, document.body.firstChild);
    document.body.insertBefore(actions, header.nextSibling);
    relocate(actions);
    addHubButton(actions);
    document.documentElement.classList.remove("fdec-header-boot");
  }

  /* The Home page (index.html, or the site root) needs no "back to hub". */
  function isHubPage() {
    try { return /\/(index\.html)?$/i.test(location.pathname); } catch (e) { return false; }
  }

  /* Put one consistent "Back to Hub" button on every tool page. Any hub link the
     page already supplies is hidden first, so there is never a duplicate. */
  function addHubButton(actions) {
    if (isHubPage()) return;
    var hubHref;
    try { hubHref = new URL("index.html", location.href).href; } catch (e) { hubHref = "index.html"; }
    try {
      [].forEach.call(document.querySelectorAll("a[href]"), function (a) {
        var h; try { h = new URL(a.getAttribute("href"), location.href).href; } catch (e) { return; }
        if (h === hubHref) { a.style.display = "none"; }
      });
    } catch (e) {}
    var btn = document.createElement("a");
    btn.className = "fdec-hub-btn no-print";
    btn.href = "index.html";
    btn.textContent = "← Hub";
    btn.setAttribute("aria-label", "Back to Hub");
    if (actions.firstChild) actions.insertBefore(btn, actions.firstChild);
    else actions.appendChild(btn);
  }

  /* Move each page's real buttons into the banner (keeps their click handlers),
     then hide the old branding bar. Declared per page with:
       <meta name="fdec-actions" content="#whoami, #logoutBtn">
       <meta name="fdec-hide"    content=".topbar, .masthead">   */
  function relocate(slot) {
    try {
      var am = document.querySelector('meta[name="fdec-actions"]');
      if (am && am.content) {
        am.content.split(",").forEach(function (sel) {
          sel = sel.trim(); if (!sel) return;
          document.querySelectorAll(sel).forEach(function (el) {
            if (el && !el.closest(".fdec-ubar")) slot.appendChild(el);
          });
        });
      }
      var hm = document.querySelector('meta[name="fdec-hide"]');
      if (hm && hm.content) {
        hm.content.split(",").forEach(function (sel) {
          sel = sel.trim(); if (!sel) return;
          document.querySelectorAll(sel).forEach(function (el) {
            if (el && !el.closest(".fdec-ubar")) el.style.display = "none";
          });
        });
      }
    } catch (e) {}
  }

  // Deferred page scripts run after parsing; build immediately instead of waiting for
  // DOMContentLoaded (which may be delayed by unrelated page initialization).
  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build, { once: true });
})();

/* ---------- Back-to-top button on every page (same look as the ITM Reports one) ----------
   ITM Reports has its own #backToTop (raised to clear its action bar); this skips it. */
(function () {
  function init() {
    try {
      if (document.getElementById("backToTop") || document.getElementById("fdec-btt")) return;
      var st = document.createElement("style");
      st.textContent =
        "#fdec-btt{position:fixed;right:20px;bottom:20px;width:46px;height:46px;border-radius:50%;" +
        "background:#1F3864;color:#fff;border:none;font-size:22px;line-height:1;cursor:pointer;" +
        "box-shadow:0 3px 10px rgba(0,0,0,.28);z-index:60;display:flex;align-items:center;justify-content:center;" +
        "opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .2s,transform .2s,visibility .2s}" +
        "#fdec-btt.show{opacity:1;visibility:visible;transform:translateY(0)}" +
        "#fdec-btt:hover{background:#2b4a80}#fdec-btt:active{transform:translateY(1px)}" +
        "@media print{#fdec-btt{display:none!important}}";
      document.head.appendChild(st);
      var b = document.createElement("button");
      b.id = "fdec-btt"; b.type = "button";
      b.setAttribute("aria-label", "Back to top"); b.title = "Back to top";
      b.textContent = "↑";
      document.body.appendChild(b);
      var top = function () { return window.pageYOffset || document.documentElement.scrollTop || 0; };
      var onScroll = function () { b.classList.toggle("show", top() > 300); };
      window.addEventListener("scroll", onScroll, { passive: true });
      b.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
      onScroll();
    } catch (e) {}
  }
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init, { once: true });
})();
