/* FDEC Quick Hub — shared engine for the NICET Level I / II / III study centers.
   Provides: (1) multi-deck flashcards with true/false cards and a "missed cards" deck,
             (2) the NFPA 25 (2023) ITM frequency guide (table, by-interval view, self-test mode).
   Each level page supplies its own data and calls NicetStudy.initFlash(...) / NicetStudy.initFreq(...).
   Training aid only: verify every interval against the licensed NFPA 25 (2023) text and the AHJ. */
(function(){
  "use strict";

  /* ---------- styles (use the page's own CSS variables so each level keeps its color) ---------- */
  var css = [
    ".ns-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}",
    ".ns-chip{border:1px solid var(--line);background:#fff;color:var(--navy);border-radius:99px;padding:6px 13px;font:inherit;font-size:.84rem;font-weight:700;cursor:pointer}",
    ".ns-chip:hover{border-color:var(--blue)}",
    ".ns-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}",
    ".ns-chip .n{opacity:.75;font-weight:600;margin-left:4px}",
    ".ns-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:.85rem;margin-bottom:10px}",
    ".ns-type{font-size:.72rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin-bottom:10px}",
    ".ns-card{user-select:none}",
    ".ns-card .term{font-size:1.35rem}",
    ".ns-card.tf .term{font-size:1.2rem;font-weight:750;line-height:1.4}",
    ".ns-card .answer{text-align:left}",
    ".ns-tf{display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap}",
    ".ns-tf .btn{min-width:130px;font-size:1rem}",
    ".ns-verdict{font-weight:850;margin-bottom:6px}",
    ".ns-verdict.good{color:#14724d}.ns-verdict.bad{color:#b23a2e}",
    ".ns-hidden{display:none!important}",
    ".ns-grade{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}",
    ".ns-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}",
    ".ns-tools input[type=search],.ns-tools select{width:auto;min-width:170px;flex:1 1 170px;padding:9px 10px;border:1px solid var(--line);border-radius:9px;font:inherit;background:#fff}",
    ".ns-tools label.ns-chk{display:flex;gap:6px;align-items:center;font-size:.86rem;color:var(--muted);cursor:pointer}",
    ".ns-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff}",
    ".ns-table{min-width:680px}",
    ".ns-table td.ns-sys{background:var(--bg);font-weight:800;color:var(--navy);font-size:.8rem;letter-spacing:.06em;text-transform:uppercase}",
    ".ns-act{display:inline-block;border-radius:6px;padding:2px 8px;font-size:.74rem;font-weight:800;white-space:nowrap}",
    ".ns-act.I{background:#e6f1fb;color:#1b4f82}.ns-act.T{background:#fff1d9;color:#7a4a05}.ns-act.M{background:#e7f6ec;color:#17603c}",
    ".ns-f{font-weight:800;color:var(--navy);min-width:150px}",
    ".ns-selftest .ns-f:not(.shown){cursor:pointer;position:relative}",
    ".ns-selftest .ns-f:not(.shown) .ns-fv{visibility:hidden}",
    ".ns-selftest .ns-f:not(.shown):before{content:'Tap to reveal';position:absolute;left:10px;color:var(--blue);font-weight:700;font-size:.82rem}",
    ".ns-grp{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}",
    ".ns-grp .card{margin:0}",
    ".ns-grp .card h3{display:flex;justify-content:space-between;gap:8px}",
    ".ns-grp ul{margin:6px 0 0;padding-left:18px}",
    ".ns-grp li{font-size:.9rem;margin:4px 0}",
    ".ns-grp li small{color:var(--muted)}",
    ".ns-count{color:var(--muted);font-size:.85rem;margin:2px 0 8px}",
    "@media print{.ns-tools,.ns-chips{display:none!important}.ns-selftest .ns-f .ns-fv{visibility:visible!important}.ns-selftest .ns-f:before{display:none!important}}"
  ].join("\n");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  function $(sel, root){ return (root || document).querySelector(sel); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  /* ======================================================================
     FLASHCARDS  —  decks: concepts, frequencies, true/false, missed
     opts: { host:'#flashHost', key:'itmL1', concepts:[[front,back]], freq:[[front,back]], tf:[[statement,isTrue,why]] }
     ====================================================================== */
  function initFlash(opts){
    var host = $(opts.host);
    if(!host) return;
    var missKey = opts.key + "FlashMissed";
    var missed = lsGet(missKey, []);
    var decks = {
      all: {label:"All cards"},
      c:   {label:"Concepts"},
      f:   {label:"Frequencies"},
      tf:  {label:"True / False"},
      m:   {label:"Missed"}
    };
    var src = { c: opts.concepts || [], f: opts.freq || [], tf: opts.tf || [] };
    var deck = "all", list = [], pos = 0, shuffled = false, answered = false, tfRight = 0, tfSeen = 0, graded = 0;

    function idOf(t,i){ return t + ":" + i; }
    function buildList(){
      var out = [];
      function add(t){ src[t].forEach(function(_,i){ out.push({t:t,i:i}); }); }
      if(deck === "all"){ add("c"); add("f"); add("tf"); }
      else if(deck === "m"){
        missed.forEach(function(id){ var p = id.split(":"); if(src[p[0]] && src[p[0]][+p[1]]) out.push({t:p[0], i:+p[1]}); });
      } else add(deck);
      if(shuffled) shuffle(out);
      list = out; pos = 0; answered = false;
    }
    function count(d){
      if(d === "all") return src.c.length + src.f.length + src.tf.length;
      if(d === "m") return missed.length;
      return src[d].length;
    }

    host.innerHTML =
      '<div class="ns-chips" id="nsChips"></div>' +
      '<div class="ns-meta"><span id="nsCount"></span><span id="nsScore"></span></div>' +
      '<div class="flashcard ns-card" id="nsCard" tabindex="0" role="button" aria-label="Flashcard. Press space to flip.">' +
        '<div class="ns-type" id="nsType"></div><div class="term" id="nsFront"></div>' +
        '<div class="hint" id="nsHint"></div><div class="answer" id="nsBack"></div>' +
      '</div>' +
      '<div class="ns-tf ns-hidden" id="nsTF"><button class="btn" id="nsTrue" type="button">True</button><button class="btn secondary" id="nsFalse" type="button">False</button></div>' +
      '<div class="ns-grade ns-hidden" id="nsGrade" style="justify-content:center"><button class="btn" id="nsGot" type="button">&#10003; Got it</button><button class="btn outline" id="nsMiss" type="button">&#8635; Review again</button></div>' +
      '<div class="actions" style="justify-content:center"><button class="btn secondary" id="nsPrev" type="button">&larr; Previous</button><button class="btn" id="nsFlip" type="button">Reveal / hide</button><button class="btn secondary" id="nsNext" type="button">Next &rarr;</button><button class="btn outline" id="nsShuf" type="button">Shuffle: off</button></div>';

    var el = {
      chips: $("#nsChips",host), count: $("#nsCount",host), score: $("#nsScore",host), card: $("#nsCard",host),
      type: $("#nsType",host), front: $("#nsFront",host), hint: $("#nsHint",host), back: $("#nsBack",host),
      tf: $("#nsTF",host), grade: $("#nsGrade",host), shuf: $("#nsShuf",host), flip: $("#nsFlip",host)
    };

    function renderChips(){
      el.chips.innerHTML = Object.keys(decks).map(function(k){
        return '<button type="button" class="ns-chip' + (k===deck?' on':'') + '" data-d="' + k + '">' + decks[k].label + '<span class="n">' + count(k) + '</span></button>';
      }).join("");
    }
    function current(){ return list[pos] || null; }
    function typeLabel(t){ return t==="c" ? "Concept" : t==="f" ? "Frequency" : "True or false?"; }

    function render(){
      renderChips();
      var c = current();
      el.card.classList.remove("revealed","tf");
      el.tf.classList.add("ns-hidden"); el.grade.classList.add("ns-hidden");
      answered = false;
      if(!c){
        el.count.textContent = deck === "m" ? "No missed cards" : "No cards";
        el.type.textContent = "";
        el.front.textContent = deck === "m" ? "Nothing to review" : "No cards in this deck";
        el.hint.textContent = deck === "m" ? "Cards you mark “Review again” or answer wrong collect here." : "";
        el.back.innerHTML = ""; el.flip.classList.add("ns-hidden");
        updScore(); return;
      }
      el.flip.classList.remove("ns-hidden");
      var d = src[c.t][c.i];
      el.count.textContent = "Card " + (pos+1) + " of " + list.length;
      el.type.textContent = typeLabel(c.t);
      el.front.innerHTML = d[0];
      if(c.t === "tf"){
        el.card.classList.add("tf");
        el.hint.textContent = "Decide, then choose True or False";
        el.back.innerHTML = "";
        el.tf.classList.remove("ns-hidden");
      } else {
        el.hint.textContent = "Click to reveal answer";
        el.back.innerHTML = d[1];
      }
    }
    function updScore(){
      var bits = [];
      if(tfSeen) bits.push("True/False this session: " + tfRight + " of " + tfSeen);
      if(graded) bits.push("Self-graded: " + graded);
      el.score.textContent = bits.join(" • ");
    }
    function setMissed(c, isMissed){
      var id = idOf(c.t, c.i), at = missed.indexOf(id);
      if(isMissed && at < 0) missed.push(id);
      if(!isMissed && at >= 0) missed.splice(at,1);
      lsSet(missKey, missed);
      renderChips();
    }
    function answerTF(choice){
      var c = current(); if(!c || c.t !== "tf" || answered) return;
      var d = src.tf[c.i], ok = (choice === d[1]);
      answered = true; tfSeen++; if(ok) tfRight++;
      setMissed(c, !ok);
      el.back.innerHTML = '<div class="ns-verdict ' + (ok?'good':'bad') + '">' + (ok ? "Correct — " : "Not quite — ") + 'the statement is ' + (d[1] ? "TRUE" : "FALSE") + '.</div>' + d[2];
      el.card.classList.add("revealed");
      el.tf.classList.add("ns-hidden");
      updScore();
    }
    function reveal(){
      var c = current(); if(!c) return;
      if(c.t === "tf" && !answered) return;          // true/false cards are answered with the buttons
      var on = el.card.classList.toggle("revealed");
      if(c.t !== "tf") el.grade.classList.toggle("ns-hidden", !on);
    }
    function go(step){
      if(!list.length) return;
      pos = (pos + step + list.length) % list.length; render();
    }
    function grade(ok){
      var c = current(); if(!c) return;
      graded++; setMissed(c, !ok); updScore();
      if(deck === "m" && ok){ buildList(); render(); } else go(1);
    }

    el.chips.addEventListener("click", function(e){
      var b = e.target.closest(".ns-chip"); if(!b) return;
      deck = b.dataset.d; buildList(); render();
    });
    el.card.addEventListener("click", reveal);
    el.card.addEventListener("keydown", function(e){ if(e.key === " " || e.key === "Enter"){ e.preventDefault(); reveal(); } });
    $("#nsTrue",host).addEventListener("click", function(){ answerTF(true); });
    $("#nsFalse",host).addEventListener("click", function(){ answerTF(false); });
    $("#nsPrev",host).addEventListener("click", function(){ go(-1); });
    $("#nsNext",host).addEventListener("click", function(){ go(1); });
    el.flip.addEventListener("click", reveal);
    $("#nsGot",host).addEventListener("click", function(){ grade(true); });
    $("#nsMiss",host).addEventListener("click", function(){ grade(false); });
    el.shuf.addEventListener("click", function(){
      shuffled = !shuffled; el.shuf.textContent = "Shuffle: " + (shuffled ? "on" : "off"); buildList(); render();
    });
    document.addEventListener("keydown", function(e){
      var sec = document.getElementById("flashcards");
      if(!sec || !sec.classList.contains("active")) return;
      var tag = (e.target && e.target.tagName) || "";
      if(/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if(e.key === "ArrowRight") go(1);
      else if(e.key === "ArrowLeft") go(-1);
      else if(e.key === "t" || e.key === "T") answerTF(true);
      else if(e.key === "f" || e.key === "F") answerTF(false);
    });

    buildList(); render();
  }

  /* ======================================================================
     ITM FREQUENCY GUIDE
     rows: [system, component, act(I|T|M), frequency, group(W|M|Q|S|A|Y|O), note, minLevel]
     ====================================================================== */
  var GROUPS = [
    ["W","Weekly"],["M","Monthly"],["Q","Quarterly"],["S","Semiannual"],["A","Annual"],["Y","Multi-year"],["O","Other / event-driven"]
  ];
  var ACTS = { I:"Inspect", T:"Test", M:"Maintain" };

  function initFreq(opts){
    var host = $(opts.host);
    if(!host) return;
    var rows = (opts.rows || []).filter(function(r){ return r[6] <= opts.level; });
    var systems = [];
    rows.forEach(function(r){ if(systems.indexOf(r[0]) < 0) systems.push(r[0]); });
    var grp = "all", act = "all", sys = "all", q = "", view = "table", selftest = false;

    host.innerHTML =
      '<div class="ns-chips" id="fqGroups"></div>' +
      '<div class="ns-tools">' +
        '<input type="search" id="fqSearch" placeholder="Search" aria-label="Search frequencies">' +
        '<select id="fqSys" aria-label="System"><option value="all">All systems</option>' + systems.map(function(s){ return '<option>' + esc(s) + '</option>'; }).join("") + '</select>' +
        '<select id="fqAct" aria-label="Activity"><option value="all">All activities</option><option value="I">Inspect</option><option value="T">Test</option><option value="M">Maintain / other</option></select>' +
        '<select id="fqView" aria-label="View"><option value="table">Table view</option><option value="group">Grouped by interval</option></select>' +
        '<label class="ns-chk"><input type="checkbox" id="fqSelf"> Self-test (hide frequencies)</label>' +
      '</div>' +
      '<div class="ns-count" id="fqCount"></div>' +
      '<div id="fqOut"></div>';

    var out = $("#fqOut",host), cnt = $("#fqCount",host), gEl = $("#fqGroups",host);

    function pass(r){
      if(grp !== "all" && r[4] !== grp) return false;
      if(act !== "all" && r[2] !== act) return false;
      if(sys !== "all" && r[0] !== sys) return false;
      if(q){
        var hay = (r[0]+" "+r[1]+" "+r[3]+" "+r[5]).toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    }
    function renderChips(){
      var all = rows.length;
      var h = '<button type="button" class="ns-chip' + (grp==="all"?' on':'') + '" data-g="all">All intervals<span class="n">' + all + '</span></button>';
      GROUPS.forEach(function(g){
        var n = rows.filter(function(r){ return r[4] === g[0]; }).length;
        if(n) h += '<button type="button" class="ns-chip' + (grp===g[0]?' on':'') + '" data-g="' + g[0] + '">' + g[1] + '<span class="n">' + n + '</span></button>';
      });
      gEl.innerHTML = h;
    }
    function actTag(a){ return '<span class="ns-act ' + a + '">' + (ACTS[a] || a) + '</span>'; }

    function render(){
      renderChips();
      var shown = rows.filter(pass);
      cnt.textContent = shown.length + " of " + rows.length + " items";
      out.classList.toggle("ns-selftest", selftest);
      if(!shown.length){ out.innerHTML = '<div class="card">No items match. Clear a filter or the search box.</div>'; return; }

      if(view === "group"){
        var h = '<div class="ns-grp">';
        GROUPS.forEach(function(g){
          var items = shown.filter(function(r){ return r[4] === g[0]; });
          if(!items.length) return;
          h += '<div class="card"><h3>' + g[1] + '<span class="tag">' + items.length + '</span></h3><ul>' +
            items.map(function(r){ return '<li><strong>' + esc(r[1]) + '</strong> <small>(' + (ACTS[r[2]]||r[2]) + ' • ' + esc(r[3]) + ')</small></li>'; }).join("") +
            '</ul></div>';
        });
        out.innerHTML = h + '</div>';
        return;
      }
      var t = '<div class="ns-wrap"><table class="ns-table"><thead><tr><th>Component</th><th>Activity</th><th>Frequency</th><th>What to check / know</th></tr></thead><tbody>';
      var last = null;
      shown.forEach(function(r){
        if(r[0] !== last){ t += '<tr><td class="ns-sys" colspan="4">' + esc(r[0]) + '</td></tr>'; last = r[0]; }
        t += '<tr><td><strong>' + esc(r[1]) + '</strong></td><td>' + actTag(r[2]) + '</td><td class="ns-f"><span class="ns-fv">' + esc(r[3]) + '</span></td><td>' + esc(r[5]) + '</td></tr>';
      });
      out.innerHTML = t + '</tbody></table></div>';
    }

    gEl.addEventListener("click", function(e){ var b = e.target.closest(".ns-chip"); if(!b) return; grp = b.dataset.g; render(); });
    $("#fqSearch",host).addEventListener("input", function(){ q = this.value.trim().toLowerCase(); render(); });
    $("#fqSys",host).addEventListener("change", function(){ sys = this.value; render(); });
    $("#fqAct",host).addEventListener("change", function(){ act = this.value; render(); });
    $("#fqView",host).addEventListener("change", function(){ view = this.value; render(); });
    $("#fqSelf",host).addEventListener("change", function(){ selftest = this.checked; render(); });
    out.addEventListener("click", function(e){
      if(!selftest) return;
      var td = e.target.closest("td.ns-f"); if(td) td.classList.toggle("shown");
    });
    render();
  }

  window.NicetStudy = { initFlash: initFlash, initFreq: initFreq };
})();
