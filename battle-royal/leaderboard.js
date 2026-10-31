/* Fire Defense Battle Royal — Quick Hub leaderboard.
   Saves each finished round to Firestore (battleRoyalStats/{uid}) for the signed-in
   Quick Hub user and shows the standings. Uses the Firebase app that fdec-auth.js
   already started, so there is one sign-in for the whole hub. */
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLL = "battleRoyalStats";
const $ = s => document.querySelector(s);
let db = null;

function getDb(){
  if (db) return db;
  const apps = getApps();
  const app = apps.find(a => a.name === "fdec") || apps[0];
  if (!app) return null;
  db = getFirestore(app);
  return db;
}
function me(){
  const a = window.FDECAuth;
  if (!a || !a.user) return null;
  const ok = a.isAdmin || (a.profile && a.profile.status === "approved");
  if (!ok) return null;
  const name = String((a.profile && a.profile.name) || a.user.displayName || (a.user.email || "").split("@")[0] || "Player").trim().slice(0, 60);
  return { uid: a.user.uid, name: name || "Player" };
}
function withTimeout(p, ms){
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

/* ---------- record a finished round ---------- */
async function record(d){
  const u = me(), fs = getDb();
  if (!u || !fs) return "notsaved";
  const win = d.result === "win", loss = d.result === "loss", draw = d.result === "draw";
  if (!win && !loss && !draw) return "notsaved";
  const write = setDoc(doc(fs, COLL, u.uid), {
    uid: u.uid, name: u.name,
    played: increment(1),
    wins: increment(win ? 1 : 0),
    losses: increment(loss ? 1 : 0),
    draws: increment(draw ? 1 : 0),
    tankWins: increment(win && d.mode === "tank" ? 1 : 0),
    gladiatorWins: increment(win && d.mode === "gladiator" ? 1 : 0),
    updatedAt: serverTimestamp()
  }, { merge: true });
  try { await withTimeout(write, 6000); return "saved"; }
  catch (e) {
    // No signal: Firestore keeps the write on the device and syncs it later.
    return e && e.message === "timeout" ? "queued" : "error";
  }
}
window.addEventListener("br-result", async e => {
  const out = await record(e.detail || {});
  const t = $("#overlayText");
  if (!t) return;
  const msg = {
    saved: "Result saved to the Quick Hub leaderboard.",
    queued: "Result stored on this device. It will post to the leaderboard when you are back online.",
    error: "Could not save this result to the leaderboard.",
    notsaved: "Sign in to Quick Hub to record results."
  }[out];
  t.textContent = (t.textContent + " " + msg).trim();
});

/* ---------- leaderboard dialog ---------- */
function ensureDialog(){
  let d = $("#board");
  if (d) return d;
  d = document.createElement("dialog");
  d.id = "board";
  d.innerHTML = '<button class="dialog-close" id="boardClose" aria-label="Close dialog">✕</button>' +
    '<span class="eyebrow">QUICK HUB</span><h2>Leaderboard</h2>' +
    '<p class="mine" id="boardMine"></p><div id="boardBody"></div>' +
    '<p class="board-note">Ranked by wins. Rounds against bots count.</p>' +
    '<button class="primary" id="boardOk">Got it</button>';
  document.body.appendChild(d);
  $("#boardClose").onclick = $("#boardOk").onclick = () => d.close();
  return d;
}
function cell(tr, text){ const td = document.createElement("td"); td.textContent = text; tr.appendChild(td); return td; }
function row(rank, r, mine){
  const tr = document.createElement("tr");
  if (mine) tr.className = "me";
  cell(tr, rank); cell(tr, r.name || "Player"); cell(tr, r.wins || 0); cell(tr, r.losses || 0); cell(tr, r.draws || 0);
  return tr;
}
async function openBoard(){
  const dlg = ensureDialog(), body = $("#boardBody"), mineEl = $("#boardMine");
  body.textContent = "Loading…"; mineEl.textContent = "";
  if (!dlg.open) dlg.showModal();
  const u = me(), fs = getDb();
  if (!u || !fs){ body.textContent = "Sign in to Quick Hub to see the leaderboard."; return; }
  try {
    const [top, mine] = await withTimeout(Promise.all([
      getDocs(query(collection(fs, COLL), orderBy("wins", "desc"), limit(15))),
      getDoc(doc(fs, COLL, u.uid))
    ]), 10000);
    const m = mine.exists() ? mine.data() : null;
    mineEl.textContent = m
      ? `Your record: ${m.wins || 0} W · ${m.losses || 0} L · ${m.draws || 0} D`
      : "No rounds recorded yet. Finish a match to get on the board.";
    if (top.empty){ body.textContent = "No results yet. Be the first."; return; }
    const table = document.createElement("table"); table.className = "board-table";
    table.innerHTML = "<thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>D</th></tr></thead>";
    const tb = document.createElement("tbody");
    top.docs.forEach((s, i) => tb.appendChild(row(i + 1, s.data(), s.id === u.uid)));
    table.appendChild(tb);
    body.textContent = ""; body.appendChild(table);
  } catch (e) {
    body.textContent = "Could not load the leaderboard. Check your signal and try again.";
  }
}
["#ranks", "#account", "#profile"].forEach(id => { const b = $(id); if (b) b.onclick = openBoard; });
