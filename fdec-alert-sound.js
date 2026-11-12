/* FDEC alert sound.
   Plays one (1) short chime when a page reports a NEW alert, then stays quiet
   until the alert is cleared (read / handled) and a newer one arrives.

   Usage on any page:   FDECAlerts.signal('announce', level)
   level is a number that grows with each new alert and is 0 when nothing is
   waiting (for example the newest announcement time while unread, or the count
   of pending approvals). A sound plays only when level is higher than the last
   level that already sounded on this device for this signed-in user. level 0
   resets it, so the next alert sounds again.

   Browsers may block sound until the person has tapped or clicked the page. If
   that happens the chime waits and plays on the first tap, click or key press.
   Mute: FDECAlerts.setMuted(true)  (remembered on this device). */
(function(){
  "use strict";
  if(window.FDECAlerts) return;

  var MUTE_KEY = "fdec_alert_sound_off";
  var ctx = null, pending = {}, timer = null, gestureWired = false, userKey = null;

  function muted(){ try{ return localStorage.getItem(MUTE_KEY) === "1"; }catch(e){ return false; } }
  function setMuted(m){ try{ localStorage.setItem(MUTE_KEY, m ? "1" : "0"); }catch(e){} }

  function who(cb){
    if(userKey){ cb(userKey); return; }
    var tries = 0;
    (function wait(){
      if(window.FDECAuth && window.FDECAuth.ready){
        window.FDECAuth.ready.then(function(a){
          var id = a && ((a.user && a.user.uid) || (a.profile && (a.profile.uid || a.profile.email))) || "anon";
          userKey = String(id); cb(userKey);
        }, function(){ userKey = "anon"; cb(userKey); });
      } else if(tries++ < 100){ setTimeout(wait, 50); }
      else { userKey = "anon"; cb(userKey); }
    })();
  }

  function store(uid){
    var k = "fdec_alert_sounded_" + uid, o = {};
    try{ o = JSON.parse(localStorage.getItem(k) || "{}") || {}; }catch(e){}
    return { get:function(id){ return Number(o[id]) || 0; },
             set:function(id,v){ o[id] = v; try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){} } };
  }

  function chime(c){
    var t = c.currentTime;
    [[880, 0], [1318.5, 0.16]].forEach(function(n){
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t + n[1]);
      g.gain.exponentialRampToValueAtTime(0.22, t + n[1] + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.5);
      o.connect(g); g.connect(c.destination);
      o.start(t + n[1]); o.stop(t + n[1] + 0.55);
    });
  }

  function commit(){
    var ids = Object.keys(pending);
    if(!ids.length) return;
    who(function(uid){
      var st = store(uid);
      ids.forEach(function(id){ st.set(id, pending[id]); });
      pending = {};
    });
  }

  function tryPlay(){
    if(!Object.keys(pending).length) return;
    if(muted()){ commit(); return; }          // muted: record it so it does not sound later
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC){ commit(); return; }
      if(!ctx) ctx = new AC();
      var go = function(){ if(ctx.state === "running"){ chime(ctx); commit(); } else wireGesture(); };
      if(ctx.state === "suspended"){ ctx.resume().then(go, wireGesture); } else go();
    }catch(e){ wireGesture(); }
  }

  function wireGesture(){
    if(gestureWired) return; gestureWired = true;
    var h = function(){
      ["pointerdown","keydown","touchstart"].forEach(function(ev){ document.removeEventListener(ev, h, true); });
      gestureWired = false;
      tryPlay();
    };
    ["pointerdown","keydown","touchstart"].forEach(function(ev){ document.addEventListener(ev, h, true); });
  }

  function signal(id, level){
    level = Number(level) || 0;
    who(function(uid){
      var st = store(uid), last = st.get(id);
      if(level <= 0){ if(last !== 0) st.set(id, 0); delete pending[id]; return; }
      if(level > last){
        pending[id] = level;                       // new alert: sound once for all pending ones
        clearTimeout(timer); timer = setTimeout(tryPlay, 400);
      } else if(level < last){
        st.set(id, level);                         // count went down: no sound
      }
    });
  }

  window.FDECAlerts = { signal: signal, setMuted: setMuted, isMuted: muted };
})();
