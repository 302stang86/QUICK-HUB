/* Battle Royal lobby: who is online, challenges, and incoming invitations. */
import { fs, getDb, waitUser, ms } from "./fb.js";
const $ = s => document.querySelector(s);
const PRESENCE_TTL = 5 * 60 * 1000, INVITE_TTL = 4 * 60 * 1000;

(async () => {
  const u = await waitUser(), db = getDb();
  let online = {}, selected = new Set(), busy = false;
  const presRef = fs.doc(db, "brPresence", u.uid);
  const touch = () => fs.setDoc(presRef, { uid: u.uid, name: u.name, state: "lobby", at: fs.serverTimestamp() }).catch(() => {});
  touch();
  setInterval(() => { if (!document.hidden) touch(); }, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) touch(); });
  addEventListener("pagehide", () => { fs.deleteDoc(presRef).catch(() => {}); });

  const others = () => Object.entries(online).filter(([id, d]) => id !== u.uid && Date.now() - ms(d.at) < PRESENCE_TTL && d.state === "lobby")
    .sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)));
  const choice = () => {
    let mode = "tank", format = "duel";
    try { mode = localStorage.getItem("iv-mode") === "gladiator" ? "gladiator" : "tank"; format = localStorage.getItem("iv-format") === "team" ? "team" : "duel"; } catch (e) {}
    return { mode, format, seats: format === "team" ? 4 : 2, label: (mode === "tank" ? "Tank Battle" : "Gladiator Duel") + " · " + (format === "team" ? "2v2" : "1v1") };
  };

  /* ---------- status line ---------- */
  function paintStatus(){
    const n = others().length;
    const t = document.querySelector(".connection span:nth-of-type(2)"), dot = document.querySelector(".status-dot");
    if (t) t.textContent = n ? `Live play ready · ${n} tech${n === 1 ? "" : "s"} online` : "Live play ready · nobody else online yet";
    if (dot) dot.classList.add("on");
    const cta = document.querySelector("#find span");
    if (cta){ cta.textContent = n + " ONLINE"; cta.classList.add("ready"); }
  }

  /* ---------- dialog ---------- */
  const dlg = document.createElement("dialog");
  dlg.id = "live";
  dlg.innerHTML = '<button class="dialog-close" id="liveClose" aria-label="Close dialog">✕</button>' +
    '<span class="eyebrow">LIVE MATCH</span><h2>Challenge a tech</h2>' +
    '<p class="mine" id="liveChoice"></p><div id="liveList" class="live-list"></div>' +
    '<p class="board-note" id="liveNote"></p>' +
    '<button class="primary" id="liveGo">Send challenge</button>';
  document.body.appendChild(dlg);
  $("#liveClose").onclick = () => dlg.close();
  function renderList(){
    const c = choice(), list = $("#liveList"), rows = others();
    $("#liveChoice").textContent = c.label + (c.format === "team" ? " · pick up to three (3) techs. Empty seats become bots." : " · pick one (1) tech.");
    list.textContent = "";
    if (!rows.length){ list.textContent = "Nobody else is in the lobby right now. Ask a coworker to open Bathroom brake."; }
    rows.forEach(([id, d]) => {
      const b = document.createElement("button");
      b.className = "live-row" + (selected.has(id) ? " picked" : "");
      b.setAttribute("aria-pressed", selected.has(id));
      const nm = document.createElement("span"); nm.textContent = d.name || "Player";
      const mk = document.createElement("span"); mk.textContent = selected.has(id) ? "✓" : "＋";
      b.append(nm, mk);
      b.onclick = () => {
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < c.seats - 1) selected.add(id);
        else { $("#liveNote").textContent = c.format === "team" ? "Three (3) techs is the most for a 2v2." : "A 1v1 needs one (1) opponent."; return; }
        $("#liveNote").textContent = ""; renderList();
      };
      list.appendChild(b);
    });
    for (const id of [...selected]) if (!rows.some(r => r[0] === id)) selected.delete(id);
    $("#liveGo").disabled = busy || selected.size < 1;
    $("#liveGo").textContent = selected.size ? `Challenge ${selected.size} tech${selected.size === 1 ? "" : "s"} →` : "Pick a tech";
  }
  function openLive(){ renderList(); if (!dlg.open) dlg.showModal(); }
  ["#find", "#friends"].forEach(id => { const b = $(id); if (b) b.onclick = openLive; });

  /* ---------- presence listener ---------- */
  fs.onSnapshot(fs.collection(db, "brPresence"), snap => {
    online = {};
    snap.docs.forEach(d => { online[d.id] = d.data(); });
    paintStatus(); if (dlg.open) renderList();
  }, () => {});
  setInterval(() => { paintStatus(); if (dlg.open) renderList(); }, 30000);

  /* ---------- send a challenge ---------- */
  $("#liveGo").onclick = async () => {
    const c = choice(), ids = [...selected];
    if (!ids.length || ids.length > c.seats - 1 || busy) return;
    busy = true; $("#liveGo").disabled = true; $("#liveNote").textContent = "Creating match…";
    try {
      const mref = fs.doc(fs.collection(db, "brMatches"));
      const names = {}; ids.forEach(id => { names[id] = (online[id] && online[id].name) || "Player"; });
      await fs.setDoc(mref, {
        hostUid: u.uid, hostName: u.name, mode: c.mode, format: c.format, seats: c.seats, status: "open",
        invited: ids, invitedNames: names, players: { [u.uid]: { name: u.name, seat: 0 } }, declined: {},
        createdAt: fs.serverTimestamp()
      });
      await Promise.all(ids.map(id => fs.setDoc(fs.doc(db, "brInvites", id), {
        from: u.uid, fromName: u.name, matchId: mref.id, mode: c.mode, format: c.format, status: "pending", at: fs.serverTimestamp()
      })));
      location.href = `arena.html?live=${mref.id}&mode=${c.mode}&format=${c.format}`;
    } catch (e) {
      busy = false; $("#liveNote").textContent = "Could not create the match. Check your signal and try again."; renderList();
    }
  };

  /* ---------- incoming invitation ---------- */
  const bar = document.createElement("div");
  bar.id = "inviteBar"; bar.hidden = true; bar.setAttribute("role", "alert");
  bar.innerHTML = '<div><strong id="invWho"></strong><small id="invWhat"></small></div><div class="inv-actions"><button id="invNo" class="secondary">Decline</button><button id="invYes" class="primary">Join</button></div>';
  document.body.appendChild(bar);
  let invite = null;
  const dropInvite = () => { fs.deleteDoc(fs.doc(db, "brInvites", u.uid)).catch(() => {}); bar.hidden = true; invite = null; };
  fs.onSnapshot(fs.doc(db, "brInvites", u.uid), s => {
    const d = s.exists() ? s.data() : null;
    if (!d || d.status !== "pending" || Date.now() - ms(d.at) > INVITE_TTL){ bar.hidden = true; invite = null; return; }
    invite = d;
    $("#invWho").textContent = (d.fromName || "A tech") + " challenged you";
    $("#invWhat").textContent = (d.mode === "gladiator" ? "Gladiator Duel" : "Tank Battle") + " · " + (d.format === "team" ? "2v2" : "1v1");
    bar.hidden = false;
  }, () => {});
  $("#invNo").onclick = async () => {
    if (!invite) return;
    fs.updateDoc(fs.doc(db, "brMatches", invite.matchId), { ["declined." + u.uid]: true }).catch(() => {});
    dropInvite();
  };
  $("#invYes").onclick = async () => {
    if (!invite) return;
    const d = invite;
    try {
      const m = await fs.getDoc(fs.doc(db, "brMatches", d.matchId));
      if (!m.exists() || m.data().status !== "open"){ $("#invWhat").textContent = "That match is no longer open."; setTimeout(dropInvite, 2000); return; }
      dropInvite();
      location.href = `arena.html?live=${d.matchId}&mode=${d.mode}&format=${d.format}`;
    } catch (e) { $("#invWhat").textContent = "Could not join. Try again."; }
  };
  paintStatus();
})();
