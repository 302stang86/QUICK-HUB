/* Battle Royal live match: waiting room, phone-to-phone link (WebRTC) with a
   Firestore relay fallback, and host-authoritative state sync.
   The host's phone runs the match. Guests send their controls and draw the state
   the host sends back. Empty seats are bots; a player who drops becomes a bot. */
import { fs, getDb, waitUser } from "./fb.js";

const P = new URLSearchParams(location.search), MID = P.get("live");
if (MID) boot().catch(e => { console.error(e); const BR = window.BR; if (BR) BR.show("LIVE MATCH", "Something went wrong", "Could not set up the live match. Go back to the lobby and try again.", "Back to lobby →"); });

const RTC = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
const DROP_MS = 6000, RTC_WAIT_MS = 12000, RTC_SEND = 50, RELAY_SEND = 150;
const FX = ["hit", "block", "spark"];
const r1 = n => Math.round(n * 10) / 10;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function boot(){
  const BR = window.BR, $ = BR.$;
  const forceRelay = (() => { try { return localStorage.getItem("br-force-relay") === "1"; } catch (e) { return false; } })();
  const back = () => { location.href = "index.html"; };
  $("#start").onclick = back;
  BR.show("LIVE MATCH", "Connecting…", "Setting up your match room.", "Back to lobby →");

  const u = await waitUser(), db = getDb();
  const mref = fs.doc(db, "brMatches", MID);
  let snap = await fs.getDoc(mref);
  if (!snap.exists()) return BR.show("LIVE MATCH", "Match not found", "This match was cancelled or no longer exists.", "Back to lobby →");
  let match = snap.data();
  const role = match.hostUid === u.uid ? "host" : "guest";
  let mySeat = role === "host" ? 0 : -1;

  if (role === "guest"){
    try {
      await fs.runTransaction(db, async tx => {
        const s = await tx.get(mref);
        if (!s.exists()) throw new Error("gone");
        const m = s.data(), players = m.players || {};
        if (players[u.uid]){ mySeat = players[u.uid].seat; return; }
        if (m.status !== "open") throw new Error("closed");
        if (!(m.invited || []).includes(u.uid)) throw new Error("uninvited");
        const taken = new Set(Object.values(players).map(p => p.seat));
        const seat = [1, 2, 3].find(x => x < m.seats && !taken.has(x));
        if (seat === undefined) throw new Error("full");
        mySeat = seat;
        tx.update(mref, { ["players." + u.uid]: { name: u.name, seat } });
      });
    } catch (e) {
      const why = { closed: "This match already started or was cancelled.", full: "This match is full.", uninvited: "You were not invited to this match.", gone: "This match no longer exists." }[e.message] || "Could not join this match.";
      return BR.show("LIVE MATCH", "Can't join", why, "Back to lobby →");
    }
  }

  const mode = match.mode, format = match.format;
  const bySeat = i => { for (const [id, p] of Object.entries(match.players || {})) if (p.seat === i) return { uid: id, name: p.name, seat: i }; return null; };
  let started = false, ended = false, lost = false;
  const peers = {};                       // host: guestUid -> {pc, dc, state, lastRx, hc, dc2}
  const rin = {};                         // host: seat -> latest input
  const G = { pc: null, dc: null, state: "connecting", n: null, link: null, lastRx: 0 };   // guest

  /* ---------- waiting room ---------- */
  function linkLabel(uid){
    if (uid === match.hostUid) return "Host";
    const st = role === "host" ? (peers[uid] && peers[uid].state) : (uid === u.uid ? G.state : "");
    return { rtc: "Direct link ✓", relay: "Slower link (relay)", connecting: "Connecting…", dropped: "Left" }[st] || "";
  }
  function renderRoom(){
    if (started || ended) return;
    const names = (match.invitedNames) || {};
    const declined = Object.keys(match.declined || {}).map(id => names[id] || "A tech");
    const box = $("#controlSummary");
    box.textContent = "";
    for (let i = 0; i < match.seats; i++){
      const p = bySeat(i), row = document.createElement("div");
      row.className = "room-row";
      const team = document.createElement("b"); team.textContent = (i % 2 === 0 ? "BLUE" : "RED") + " " + (match.format === "team" ? (i >> 1) + 1 : "");
      const nm = document.createElement("span"); nm.textContent = p ? p.name + (p.uid === u.uid ? " (you)" : "") : "Open · a bot plays this seat";
      const st = document.createElement("small"); st.textContent = p ? linkLabel(p.uid) : "";
      row.append(team, nm, st); box.appendChild(row);
    }
    const humans = Object.keys(match.players || {}).length;
    $("#overlayLabel").textContent = "LIVE MATCH";
    $("#overlayTitle").textContent = role === "host" ? "Waiting room" : "You're in";
    $("#overlayText").textContent = (mode === "tank" ? "Tank Battle" : "Gladiator Duel") + " · " + (format === "team" ? "2v2" : "1v1") + ". " +
      (role === "host" ? (humans < 2 ? "Waiting for a tech to join." : "Start when everyone is in. Open seats become bots.") : "Waiting for the host to start.") +
      (declined.length ? " Declined: " + declined.join(", ") + "." : "");
    const go = $("#start");
    go.style.display = role === "host" ? "" : "none";
    go.disabled = role === "host" && humans < 2;
    go.textContent = "Start match →";
    go.onclick = hostStart;
  }

  /* ---------- WebRTC signalling over Firestore ---------- */
  const sig = (type, guest, host) => fs.doc(db, "brMatches", MID, "signals", `${type}_${guest}_${host}`);
  const iceDone = (pc, t) => new Promise(res => {
    if (pc.iceGatheringState === "complete") return res();
    const timer = setTimeout(res, t);
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete"){ clearTimeout(timer); res(); } });
  });

  async function makeHostPeer(guest){
    const peer = { state: "connecting", lastRx: performance.now(), hc: 0, dc2: 0, pc: null, dc: null };
    peers[guest] = peer;
    if (forceRelay){ peer.state = "relay"; renderRoom(); return; }
    const pc = new RTCPeerConnection(RTC), dc = pc.createDataChannel("g", { ordered: false, maxRetransmits: 0 });
    peer.pc = pc; peer.dc = dc;
    dc.onopen = () => { peer.state = "rtc"; peer.lastRx = performance.now(); renderRoom(); };
    dc.onmessage = e => { peer.lastRx = performance.now(); onGuestMsg(guest, e.data); };
    dc.onclose = () => { if (started && peer.state !== "dropped") dropGuest(guest); };
    const n = Date.now();
    await pc.setLocalDescription(await pc.createOffer());
    await iceDone(pc, 4000);
    await fs.setDoc(sig("offer", guest, u.uid), { from: u.uid, to: guest, sdp: pc.localDescription.sdp, n });
    fs.onSnapshot(sig("answer", guest, u.uid), s => {
      if (!s.exists() || peer.answered) return;
      const d = s.data(); if (d.n !== n) return;
      peer.answered = true;
      pc.setRemoteDescription({ type: "answer", sdp: d.sdp }).catch(() => {});
    }, () => {});
    setTimeout(() => { if (peer.state === "connecting"){ peer.state = "relay"; renderRoom(); } }, RTC_WAIT_MS);
  }

  function listenForOffer(){
    if (forceRelay){ G.state = "relay"; renderRoom(); return; }
    fs.onSnapshot(sig("offer", u.uid, match.hostUid), async s => {
      if (!s.exists()) return;
      const d = s.data(); if (d.n === G.n) return;
      G.n = d.n;
      try { if (G.pc) G.pc.close(); } catch (e) {}
      const pc = new RTCPeerConnection(RTC); G.pc = pc;
      pc.ondatachannel = ev => {
        const dc = ev.channel; G.dc = dc;
        dc.onopen = () => { G.state = "rtc"; G.lastRx = performance.now(); renderRoom(); };
        dc.onmessage = m => { try { const o = JSON.parse(m.data); if (o.k === "s") onSnap(o); } catch (e) {} };
      };
      await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await iceDone(pc, 4000);
      await fs.setDoc(sig("answer", u.uid, match.hostUid), { from: u.uid, to: match.hostUid, sdp: pc.localDescription.sdp, n: d.n });
      setTimeout(() => { if (G.state === "connecting"){ G.state = "relay"; renderRoom(); } }, RTC_WAIT_MS);
    }, () => {});
  }

  /* ---------- snapshots ---------- */
  let seq = 0;
  function makeSnap(g){
    return { k: "s", q: ++seq, t: r1(g.time), r: g.result || 0,
      f: g.fighters.map(f => [r1(f.x), r1(f.y), Math.round(f.aim * 100) / 100, Math.round(f.hp), Math.round(f.stamina), r1(f.inv), r1(f.swing), f.block ? 1 : 0, r1(f.dodgeCD), r1(f.cd), f.human ? 1 : 0]),
      s: g.shots.map(s => [r1(s.x), r1(s.y), Math.round(s.dx * 100) / 100, Math.round(s.dy * 100) / 100, Math.max(0, g.fighters.indexOf(s.owner)), r1(s.ttl)]),
      w: g.walls.map(w => w.hp), e: g.effects.map(e => [r1(e.x), r1(e.y), r1(e.t), Math.max(0, FX.indexOf(e.type))]) };
  }
  let lastQ = 0, anchor = { t: 120, at: 0 }, haveSnap = false;
  function onSnap(s){
    const g = BR.game, now = performance.now();
    if (s.q <= lastQ && !s.r) return; lastQ = Math.max(lastQ, s.q);
    G.lastRx = now; haveSnap = true;
    s.f.forEach((a, i) => {
      const f = g.fighters[i]; if (!f) return;
      if (f.tx === undefined){ f.x = a[0]; f.y = a[1]; f.aim = a[2]; }
      f.tx = a[0]; f.ty = a[1]; f.taim = a[2]; f.hp = a[3]; f.stamina = a[4]; f.inv = a[5]; f.swing = a[6]; f.block = !!a[7]; f.dodgeCD = a[8]; f.cd = a[9]; f.human = !!a[10];
    });
    g.shots = s.s.map(a => ({ x: a[0], y: a[1], dx: a[2], dy: a[3], owner: g.fighters[a[4]] || g.fighters[0], ttl: a[5] }));
    s.w.forEach((hp, i) => { if (g.walls[i]) g.walls[i].hp = hp; });
    g.effects = s.e.map(a => ({ x: a[0], y: a[1], t: a[2], type: FX[a[3]] || "hit" }));
    anchor = { t: s.t, at: now };
    if (s.r && !g.result) g.result = s.r;
  }

  /* ---------- host side ---------- */
  function sanitize(d){
    const n = (v, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : 0;
    return { dx: n(d.dx, -1, 1), dy: n(d.dy, -1, 1), aim: Number.isFinite(+d.aim) ? +d.aim : undefined, attack: !!d.a, block: !!d.b };
  }
  function onGuestMsg(uid, raw){
    let d; try { d = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (d && d.k === "bye"){ dropGuest(uid); return; }
    if (!d || d.k !== "i") return;
    const pl = (match.players || {})[uid], g = BR.game, peer = peers[uid];
    if (!pl || !peer || peer.state === "dropped" || !started) return;
    peer.lastRx = performance.now();
    const f = g.fighters[pl.seat]; if (!f || !f.human) return;
    rin[pl.seat] = sanitize(d);
    if (d.hc > peer.hc){ peer.hc = d.hc; if (f.hp > 0) g.attack(f, true); }
    if (d.dc > peer.dc2){ peer.dc2 = d.dc; g.dodge(f); }
  }
  function dropGuest(uid){
    const peer = peers[uid]; if (!peer || peer.state === "dropped") return;
    peer.state = "dropped";
    const pl = (match.players || {})[uid], g = BR.game; if (!pl) return;
    const f = g.fighters[pl.seat];
    if (f){ f.human = false; f.think = .8; f.block = false; }
    delete rin[pl.seat];
    $("#battleStatus").textContent = pl.name + " disconnected. A bot took over.";
    try { peer.dc && peer.dc.close(); peer.pc && peer.pc.close(); } catch (e) {}
  }
  let lastSend = 0, lastRelay = 0, finalSent = false;
  const relayGuests = () => Object.entries(peers).filter(([id, p]) => p.link === "relay" && p.state !== "dropped");
  function sendRtc(o){
    const text = JSON.stringify(o);
    for (const p of Object.values(peers)) if (p.link === "rtc" && p.state !== "dropped" && p.dc && p.dc.readyState === "open") { try { p.dc.send(text); } catch (e) {} }
  }
  function hostAfter(){
    const g = BR.game, now = performance.now();
    for (const [uid, p] of Object.entries(peers)) if (p.state !== "dropped" && now - p.lastRx > DROP_MS) dropGuest(uid);
    if (g.result && !finalSent){
      finalSent = true; ended = true;
      const s = makeSnap(g);
      sendRtc(s); [100, 250, 500].forEach(t => setTimeout(() => sendRtc(s), t));
      if (relayGuests().length) fs.setDoc(fs.doc(db, "brMatches", MID, "relay", "state_" + u.uid), { m: MID, d: JSON.stringify(s) }).catch(() => {});
      fs.updateDoc(mref, { status: "done", result: g.result }).catch(() => {});
      return;
    }
    if (now - lastSend >= RTC_SEND){ lastSend = now; sendRtc(makeSnap(g)); }
    if (now - lastRelay >= RELAY_SEND && relayGuests().length){
      lastRelay = now;
      fs.setDoc(fs.doc(db, "brMatches", MID, "relay", "state_" + u.uid), { m: MID, d: JSON.stringify(makeSnap(g)) }).catch(() => {});
    }
  }
  function setBars(){
    const label = team => {
      const out = [];
      for (let i = 0; i < match.seats; i++) if (i % 2 === team){ const p = bySeat(i); out.push(p ? p.name : "BOT"); }
      return out.join(" + ");
    };
    $("#blueLabel").textContent = "BLUE · " + label(0);
    $("#redLabel").textContent = "RED · " + label(1);
    $(".battle-title small").textContent = "LIVE MATCH · LEADERBOARD";
    $("#battleStatus").textContent = "Live match";
  }
  async function hostStart(){
    if (started) return;
    const humans = Object.keys(match.players || {}).length;
    if (humans < 2) return;
    started = true;
    $("#start").disabled = true;
    const links = {};
    for (const [uid, p] of Object.entries(peers)){
      if (!(match.players || {})[uid]){ p.state = "dropped"; continue; }
      p.link = (p.state === "rtc" && !forceRelay) ? "rtc" : "relay";
      links[uid] = p.link;
    }
    const g = new Arena(mode, format);
    g.fighters.forEach((f, i) => { const p = bySeat(i); f.human = !!p; f.name = p ? p.name : ""; if (!f.human && f.think === undefined) f.think = .8; });
    BR.game = g; BR.seat = 0; setBars();
    try { await fs.updateDoc(mref, { status: "playing", links, startedAt: fs.serverTimestamp() }); }
    catch (e) { started = false; $("#start").disabled = false; return; }
    for (const [uid, p] of Object.entries(peers)) if (p.link === "relay"){
      fs.onSnapshot(fs.doc(db, "brMatches", MID, "relay", "in_" + uid), s => {
        if (!s.exists()) return; const d = s.data(); if (d.m !== MID) return;
        const peer = peers[uid]; if (peer) peer.lastRx = performance.now();
        onGuestMsg(uid, d.d);
      }, () => {});
    }
    for (const p of Object.values(peers)) p.lastRx = performance.now();
    BR.begin();
  }

  /* ---------- guest side ---------- */
  const inState = { dx: 0, dy: 0, aim: 0, a: 0, b: 0, hc: 0, dc: 0 };
  let lastIn = 0, inN = 0, lastInSig = "";
  function sendInput(force){
    const now = performance.now(), relay = G.link === "relay", gap = relay ? RELAY_SEND : RTC_SEND;
    const sigStr = [inState.dx.toFixed(2), inState.dy.toFixed(2), inState.aim.toFixed(2), inState.a, inState.b, inState.hc, inState.dc].join();
    if (!force && now - lastIn < gap) return;
    if (relay && !force && sigStr === lastInSig && now - lastIn < 600) return;     // save Firestore writes when nothing changed
    lastIn = now; lastInSig = sigStr;
    const msg = { k: "i", dx: r1(inState.dx * 100) / 100, dy: r1(inState.dy * 100) / 100, aim: Math.round(inState.aim * 100) / 100, a: inState.a, b: inState.b, hc: inState.hc, dc: inState.dc };
    if (relay) fs.setDoc(fs.doc(db, "brMatches", MID, "relay", "in_" + u.uid), { m: MID, n: ++inN, d: JSON.stringify(msg) }).catch(() => {});
    else if (G.dc && G.dc.readyState === "open") { try { G.dc.send(JSON.stringify(msg)); } catch (e) {} }
  }
  function startGuest(){
    if (started) return;
    started = true;
    const g = new Arena(mode, format);
    g.fighters.forEach((f, i) => { const p = bySeat(i); f.human = !!p; f.name = p ? p.name : ""; });
    BR.game = g; BR.seat = mySeat; setBars();
    G.link = ((match.links || {})[u.uid]) || "relay";
    G.lastRx = performance.now(); anchor = { t: 120, at: performance.now() };
    if (G.link === "relay"){
      fs.onSnapshot(fs.doc(db, "brMatches", MID, "relay", "state_" + match.hostUid), s => {
        if (!s.exists()) return; const d = s.data(); if (d.m !== MID) return;
        try { onSnap(JSON.parse(d.d)); } catch (e) {}
      }, () => {});
    }
    BR.begin();
  }
  const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function guestStep(dt, inp){
    const g = BR.game, now = performance.now(), f = g.fighters[mySeat];
    if (!g.result){
      g.time = Math.max(0, anchor.t - (now - anchor.at) / 1000);
      g.elapsed += dt;
    }
    if (f && f.hp > 0 && !g.result){
      if (Number.isFinite(inp.aim)) f.aim = inp.aim;
      const blk = g.mode === "gladiator" && !!inp.block && f.stamina > 0;
      g.move(f, inp.dx || 0, inp.dy || 0, dt, g.mode === "tank" ? 145 : blk ? 85 : 195);
    }
    g.fighters.forEach((o, i) => {
      if (o.tx === undefined) return;
      const ex = o.tx - o.x, ey = o.ty - o.y, d = Math.hypot(ex, ey);
      if (i === mySeat){ if (d > 70){ o.x = o.tx; o.y = o.ty; } else { const k = Math.min(1, dt * 4); o.x += ex * k; o.y += ey * k; } }
      else { if (d > 200){ o.x = o.tx; o.y = o.ty; } else { const k = 1 - Math.exp(-dt * 14); o.x += ex * k; o.y += ey * k; } o.aim = angLerp(o.aim, o.taim, 1 - Math.exp(-dt * 18)); }
    });
    for (const s of g.shots){ s.x += s.dx * 440 * dt; s.y += s.dy * 440 * dt; s.ttl -= dt; }
    for (const e of g.effects) e.t -= dt;
    g.effects = g.effects.filter(e => e.t > 0);
    inState.dx = inp.dx || 0; inState.dy = inp.dy || 0; inState.aim = Number.isFinite(inp.aim) ? inp.aim : (f ? f.aim : 0);
    inState.a = inp.attack ? 1 : 0; inState.b = inp.block ? 1 : 0;
    sendInput(false);
    if (!g.result && !lost && now - G.lastRx > DROP_MS){
      lost = true; ended = true; g.result = 0;
      BR.show("LIVE MATCH", "Connection lost", "The host's phone stopped responding. No result was recorded.", "Back to lobby →");
      $("#start").onclick = back;
    }
  }
  const event = kind => { if (kind === "heavy") inState.hc++; else inState.dc++; sendInput(true); };

  /* ---------- hooks used by game.js ---------- */
  window.BRNet = {
    role, remote: () => rin, hostAfter, guestStep, event,
    onResult(){ ended = true; const go = $("#start"); go.style.display = ""; go.disabled = false; go.onclick = back; }
  };

  /* ---------- match document ---------- */
  fs.onSnapshot(mref, s => {
    if (!s.exists()){ if (!started && !ended) BR.show("LIVE MATCH", "Match closed", "The host cancelled this match.", "Back to lobby →"); return; }
    match = s.data();
    if (role === "host"){
      for (const uid of Object.keys(match.players || {})) if (uid !== u.uid && !peers[uid]) makeHostPeer(uid).catch(() => {});
      if (!started) for (const [uid, p] of Object.entries(peers)) if (!(match.players || {})[uid] && p.state !== "dropped"){ p.state = "dropped"; try { p.pc && p.pc.close(); } catch (e) {} }
    } else {
      if (match.status === "playing" && !started) startGuest();
      else if (match.status === "cancelled" && !started){ ended = true; BR.show("LIVE MATCH", "Match cancelled", "The host left before the match started.", "Back to lobby →"); return; }
      else if (match.status === "done" && started && match.result && !BR.game.result){ BR.game.result = match.result; }
    }
    renderRoom();
  }, () => {});
  if (role === "guest") listenForOffer();
  renderRoom();

  addEventListener("pagehide", () => {
    if (!started){
      if (role === "host") fs.updateDoc(mref, { status: "cancelled" }).catch(() => {});
      else fs.updateDoc(mref, { ["players." + u.uid]: fs.deleteField() }).catch(() => {});
    } else if (role === "host" && !finalSent) fs.updateDoc(mref, { status: "done" }).catch(() => {});
    else if (role === "guest" && !ended){          // tell the host right away so a bot can take over
      const bye = JSON.stringify({ k: "bye" });
      if (G.link === "relay") fs.setDoc(fs.doc(db, "brMatches", MID, "relay", "in_" + u.uid), { m: MID, n: ++inN, d: bye }).catch(() => {});
      else if (G.dc && G.dc.readyState === "open") { try { G.dc.send(bye); } catch (e) {} }
    }
  });
}
