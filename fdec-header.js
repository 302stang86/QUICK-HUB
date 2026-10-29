/* FDEC Quick Hub — universal top banner (classic script, safe on any page).
   Prepends one consistent header to every page: the FDEC banner with the page
   title in plain white wrapping text in the rightmost 20%. Each page declares its title with:
       <meta name="fdec-page-title" content="ITM Reports">
   (falls back to document.title). Existing page nav stays below this banner. */
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
