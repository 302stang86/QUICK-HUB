/* FDEC Quick Hub — fills a card group page (Field Tools, Tech Cards).
   The page sets <body data-group="fieldtools|techcards">; the cards come from
   fdec-cards.js and are filtered to what the signed-in role may open. */
(function () {
  "use strict";
  var key = document.body.getAttribute("data-group");
  var host = document.getElementById("hubLinks");
  var empty = document.getElementById("groupEmpty");

  function show(auth) {
    var list = (window.FDEC_CARDS && window.FDEC_CARDS.GROUPS[key]) || [];
    var n = window.FDEC_CARDS.render(host, list, auth);
    if (empty) { empty.hidden = n > 0; }
  }

  var tries = 0;
  (function wait() {
    if (window.FDECAuth && window.FDECAuth.ready) { window.FDECAuth.ready.then(show); }
    else if (tries++ < 150) { setTimeout(wait, 40); }
    else { show(null); }   // auth could not load — show all (degraded, same as the hub)
  })();
})();
