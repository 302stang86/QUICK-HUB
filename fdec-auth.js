/* =============================================================================
   FDEC Quick Hub — shared sign-in + access gate
   One login across every page. Served from one GitHub Pages origin, pointed at
   one Firebase project, so a user signs in once and every page knows them.

   A page turns this on with ONE line in its <head> or before </body>:
     <script type="module" src="fdec-auth.js" data-page="quoting"></script>

   data-page is the page id checked against config/permissions. Admins always
   pass. Everyone else must be approved AND their role must be allowed the page.
   The hub reads window.FDECAuth.ready instead, to show only allowed cards.
============================================================================= */
import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, enableIndexedDbPersistence, waitForPendingWrites }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---- The one project the whole hub runs on ---- */
const firebaseConfig = {
  apiKey: "AIzaSyCS_Hw94f4b7X0IkZV9gFXkZDIYNoa8eYo",
  authDomain: "fire-defense-itm-reports.firebaseapp.com",
  projectId: "fire-defense-itm-reports",
  storageBucket: "fire-defense-itm-reports.firebasestorage.app",
  messagingSenderId: "477656152120",
  appId: "1:477656152120:web:a14b2c03bddfb2a9de8ecd"
};

/* Accounts that are always admin, even before a role is set. */
const ADMIN_EMAILS = ["mp1@firedefense.com", "302stang86@gmail.com", "wh1@firedefense.com"];
/* Who may register: work email, plus any admin address above. */
const ALLOWED_DOMAINS = ["firedefense.com"];

/* Fallback page access, used until Administration saves config/permissions.
   Admin is always allowed regardless of this map. */
const DEFAULT_PAGES = {
  // "temp" is a limited tier: only the hub home plus the Troubleshooting Guide
  // and NFPA 25 Frequencies tools. It is intentionally left off every other page.
  home:            ["new","tech","manager","admin","temp"],
  announcements:   ["new","tech","manager","admin"],
  sop:             ["new","tech","manager","admin"],
  dispatch:        ["new","tech","manager","admin"],
  troubleshooting: ["new","tech","manager","admin","temp"],
  frequencies:     ["new","tech","manager","admin","temp"],
  incident:        ["new","tech","manager","admin"],
  help:            ["new","tech","manager","admin","temp"],
  library:         ["new","tech","manager","admin","temp"],
  itm:             ["tech","manager","admin"],
  servicetrade:    ["tech","manager","admin"],
  timeoff:         ["new","tech","manager","admin"],
  oncall:          ["tech","manager","admin"],
  timesheet:       ["admin"],   // LOCKED to admin until released to technicians
  quoting:         ["manager","admin"],
  administration:  ["manager","admin"]   // managers reach the quote files here; roster/resets/permissions stay admin-only inside the page
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig, "fdec");
const auth = getAuth(app);
const db   = getFirestore(app);

/* Offline: cache reads and queue writes on the device; they sync when signal
   returns. Fails quietly if another tab already holds persistence. */
try { enableIndexedDbPersistence(db).catch(function(){}); } catch(e){}
(window.__fdecWaiters = window.__fdecWaiters || []).push(function(){ return waitForPendingWrites(db); });

const emailAllowed = e => {
  e = String(e||"").toLowerCase();
  if (ADMIN_EMAILS.map(x=>x.toLowerCase()).includes(e)) return true;
  return ALLOWED_DOMAINS.includes((e.split("@")[1]||"").toLowerCase());
};
const isAdminEmail = e => ADMIN_EMAILS.map(x=>x.toLowerCase()).includes(String(e||"").toLowerCase());

let resolveReady;
const state = {
  user: null, profile: null, isAdmin: false, permissions: null,
  ready: new Promise(r => { resolveReady = r; }),
  canOpen(page){
    if (this.isAdmin) return true;
    if (!this.profile || this.profile.status !== "approved") return false;
    const pages = (this.permissions && this.permissions.pages) || DEFAULT_PAGES;
    const roles = pages[page] || DEFAULT_PAGES[page] || [];
    return roles.includes(this.profile.role || "new");
  },
  signOut(){ return signOut(auth); }
};
window.FDECAuth = state;

/* ---------- overlay UI (login / pending / no-access) ---------- */
function overlay(html){
  let el = document.getElementById("fdec-gate");
  if (!el){
    el = document.createElement("div");
    el.id = "fdec-gate";
    el.style.cssText = "position:fixed;inset:0;z-index:99999;background:#1B2A4A;color:#fff;"
      + "display:flex;align-items:center;justify-content:center;padding:20px;"
      + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;overflow:auto;";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div style="width:100%;max-width:380px;background:#fff;color:#1b1f24;border-radius:12px;
    box-shadow:0 18px 50px rgba(0,0,0,.4);overflow:hidden;">
    <div style="background:#1B2A4A;border-bottom:5px solid #C1121C;color:#fff;padding:18px 22px;">
      <div style="font-weight:800;letter-spacing:.3px;">FIRE DEFENSE EQUIPMENT CO.</div>
      <div style="font-size:12.5px;color:#aeb6bf;margin-top:2px;">Employee Hub</div>
    </div>
    <div style="padding:20px 22px;">${html}</div></div>`;
  return el;
}
function clearOverlay(){ const el=document.getElementById("fdec-gate"); if(el) el.remove(); }

const styleField = "width:100%;padding:10px 11px;border:1px solid #dfe3e8;border-radius:8px;font-size:16px;margin:0 0 12px;";
const styleBtn   = "width:100%;padding:11px;border:0;border-radius:8px;background:#C1121C;color:#fff;font-size:15px;font-weight:700;cursor:pointer;";
const styleLink  = "background:none;border:0;color:#1B2A4A;font-weight:700;cursor:pointer;font-size:13px;padding:0;";

let mode = "signin";
function loginUI(msg){
  const reg = mode === "register";
  overlay(`
    <h2 style="margin:0 0 4px;font-size:18px;">${reg ? "Create your account" : "Sign in"}</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#55606e;">Use your firedefense.com work email.</p>
    ${msg ? `<div style="background:#fdecec;color:#6b211d;border:1px solid #e3b2b4;border-radius:7px;padding:9px 11px;font-size:13px;margin-bottom:12px;">${msg}</div>` : ""}
    ${reg ? `<input id="fdec-name" type="text" placeholder="First and last name" autocomplete="name" style="${styleField}">` : ""}
    <input id="fdec-email" type="email" placeholder="name@firedefense.com" autocomplete="username" style="${styleField}">
    <input id="fdec-pw" type="password" placeholder="Password" autocomplete="${reg?"new-password":"current-password"}" style="${styleField}">
    <button id="fdec-go" style="${styleBtn}">${reg ? "Create account" : "Sign in"}</button>
    <div style="display:flex;justify-content:space-between;margin-top:14px;">
      <button id="fdec-toggle" style="${styleLink}">${reg ? "Back to sign in" : "Create your account"}</button>
      ${reg ? "" : `<button id="fdec-reset" style="${styleLink}">Reset password</button>`}
    </div>`);

  document.getElementById("fdec-go").onclick = submit;
  document.getElementById("fdec-pw").onkeydown = e => { if (e.key === "Enter") submit(); };
  document.getElementById("fdec-toggle").onclick = () => { mode = reg ? "signin" : "register"; loginUI(); };
  const rb = document.getElementById("fdec-reset");
  if (rb) rb.onclick = async () => {
    const email = (document.getElementById("fdec-email").value||"").trim().toLowerCase();
    if (!email) return loginUI("Enter your email first, then request a reset.");
    if (!emailAllowed(email)) return loginUI("Use your firedefense.com work email.");
    try {
      const id = email.replace(/[^a-z0-9]+/g, "_");
      await setDoc(doc(db, "passwordResets", id), {
        email: email, status: "pending", requestedAt: serverTimestamp()
      }, { merge: true });
      loginUI("Your password reset request was sent to an administrator. You'll get a reset email once it is approved.");
    } catch(e){ loginUI("Could not send the request. Try again, or contact your administrator."); }
  };
}
function niceErr(e){
  const c = (e && e.code) || "";
  if (c.includes("invalid-credential")||c.includes("wrong-password")||c.includes("user-not-found")) return "Email and password did not match.";
  if (c.includes("email-already-in-use")) return "That email already has an account. Switch to sign in.";
  if (c.includes("weak-password")) return "Use a password of at least eight (8) characters.";
  if (c.includes("too-many-requests")) return "Too many tries. Wait a few minutes.";
  if (c.includes("operation-not-allowed")) return "Email sign-in is off in Firebase. Turn it on under Authentication.";
  return "Sign-in failed: " + ((e && e.message) || c);
}
async function submit(){
  const email = (document.getElementById("fdec-email").value||"").trim();
  const pw = document.getElementById("fdec-pw").value;
  if (!email || !pw) return loginUI("Enter your email and password.");
  if (!emailAllowed(email)) return loginUI("Use your firedefense.com work email.");
  try {
    if (mode === "register"){
      const name = (document.getElementById("fdec-name").value||"").trim();
      if (name.split(" ").filter(Boolean).length < 2) return loginUI("Enter your first and last name.");
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pw);
    }
  } catch(e){ loginUI(niceErr(e)); }
}

function infoScreen(title, body){
  overlay(`<h2 style="margin:0 0 8px;font-size:18px;">${title}</h2>
    <p style="font-size:14px;color:#55606e;line-height:1.5;">${body}</p>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <a href="index.html" style="${styleBtn};display:inline-block;text-align:center;text-decoration:none;width:auto;flex:1;padding:10px 14px;">Back to hub</a>
      <button id="fdec-out" style="${styleLink};border:1px solid #1B2A4A;border-radius:8px;padding:10px 14px;">Sign out</button>
    </div>`);
  const o = document.getElementById("fdec-out"); if (o) o.onclick = () => signOut(auth);
}

/* ---------- load the signed-in user's profile + permissions ---------- */
async function loadProfile(user){
  const ref = doc(db, "users", user.uid);
  let snap;
  try { snap = await getDoc(ref); } catch(e){ return null; }
  if (!snap.exists()){
    // First sign-in: create a pending profile at the lowest role.
    const profile = {
      email: (user.email||"").toLowerCase(),
      name: user.displayName || (user.email||"").split("@")[0],
      role: isAdminEmail(user.email) ? "admin" : "new",
      status: isAdminEmail(user.email) ? "approved" : "pending",
      createdAt: serverTimestamp()
    };
    try { await setDoc(ref, profile, { merge: true }); } catch(e){}
    return profile;
  }
  return snap.data();
}
async function loadPermissions(){
  try {
    const snap = await getDoc(doc(db, "config", "permissions"));
    if (snap.exists()) return snap.data();
  } catch(e){}
  return { pages: DEFAULT_PAGES };
}

/* ---------- boot ---------- */
const gateTag = document.querySelector('script[data-page]');
const PAGE = (gateTag && gateTag.dataset.page) || null;
let booted = false;

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (!user){
    state.profile = null; state.isAdmin = false;
    if (PAGE) loginUI();                 // full-page gate shows login
    if (!booted){ booted = true; resolveReady(state); }  // hub resolves so it can show its own login via PAGE=home
    return;
  }
  if (!emailAllowed(user.email)){
    await signOut(auth);
    loginUI("That account is not a firedefense.com email.");
    return;
  }
  state.profile = await loadProfile(user);
  state.permissions = await loadPermissions();
  state.isAdmin = isAdminEmail(user.email) || (state.profile && state.profile.role === "admin");

  if (PAGE){
    if (!state.isAdmin && (!state.profile || state.profile.status !== "approved")){
      const denied = state.profile && state.profile.status === "denied";
      infoScreen(denied ? "Access denied" : "Waiting for approval",
        denied ? "An administrator has turned off your access. Contact your manager."
               : `Thanks, ${state.profile ? state.profile.name : ""}. Your account is set up and waiting for an administrator to approve it. You will get in once approved.`);
    } else if (!state.canOpen(PAGE)){
      infoScreen("No access to this page",
        "Your role does not have access to this tool. If you think that is wrong, ask your manager to adjust it in Administration.");
    } else {
      clearOverlay();                    // allowed — reveal the page
    }
  }
  if (!booted){ booted = true; resolveReady(state); }
});
