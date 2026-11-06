import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, collection, query, orderBy, limit, getDocsFromServer }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { betterRun, validateSave, validNickname, blankProfile } from './game-model.mjs';

// Match the hub's named Firebase app so same-origin browser sessions can be reused.
const app = getApps().find(a => a.name === 'fdec') || initializeApp(firebaseConfig, 'fdec');
const auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
let approved = false, profile = null, currentUid = null, stopProfile = null, instance = null;
let unityReady = false, launching = false, loading = false, saveBusy = false, gateGeneration = 0;
function message(text) { $('message').textContent = text; }
function send(method, value) { if (instance && unityReady) instance.SendMessage('FireDefenseGame', method, typeof value === 'string' ? value : JSON.stringify(value)); }
function block(text) {
  approved = false; profile = null;
  $('gate').hidden = false; $('launch').disabled = true; message(text);
  send('OnCloudBlocked', text);
}
function acceptable(data) { return data?.status === 'approved' && ['new','tech','temp','manager','admin'].includes(data.role); }
function niceError(error) {
  const code = error?.code || '';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Email and password did not match.';
  if (code.includes('permission-denied')) return 'Access denied. Check employee approval and publish the game Firestore rules.';
  if (code.includes('resource-exhausted')) return 'Firebase quota reached. Try again after the quota resets.';
  if (code.includes('failed-precondition')) return 'Firestore setup is incomplete. Check the composite index in the setup guide.';
  if (code.includes('unavailable')) return 'Connection unavailable. Reconnect and retry.';
  return error?.message || 'The request failed. Try again.';
}
onAuthStateChanged(auth, async user => {
  const generation = ++gateGeneration;
  stopProfile?.(); stopProfile = null;
  if (currentUid && user?.uid !== currentUid && instance) { location.reload(); return; }
  currentUid = user?.uid || null; profile = null; approved = false;
  $('login').hidden = !!user; $('logout').hidden = !user;
  if (!user || user.isAnonymous) { block('Sign in with your existing approved FDEC account.'); return; }
  message('Checking employee approval…');
  const ref = doc(db, 'users', user.uid);
  try {
    const employee = await getDocFromServer(ref);
    if (generation !== gateGeneration) return;
    if (!employee.exists() || !acceptable(employee.data())) { block('This account is not approved for employee game access. Contact your FDEC administrator.'); return; }
    approved = true; $('launch').disabled = false; message('Approved employee account. Choose your nickname to continue.');
    const snap = await getDocFromServer(doc(db, 'fdGameProfiles', user.uid));
    if (generation !== gateGeneration) return;
    profile = snap.exists() ? snap.data() : null;
    if (profile) $('nickname').value = profile.nickname;
    // A single employee-profile listener detects approval being removed during play.
    stopProfile = onSnapshot(ref, s => {
      if (!s.exists() || !acceptable(s.data())) block('Employee access was removed. Contact your administrator.');
    }, e => block(niceError(e)));
  } catch (e) { if (generation === gateGeneration) block(niceError(e)); }
});
$('login').addEventListener('submit', async e => {
  e.preventDefault(); const button = $('signin'); button.disabled = true;
  try { await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); $('password').value = ''; }
  catch (error) { message(niceError(error)); }
  finally { button.disabled = false; }
});
$('logout').onclick = () => signOut(auth).catch(e => message(niceError(e)));
$('launch').onclick = async () => {
  if (!approved || !auth.currentUser || launching) return;
  const nickname = $('nickname').value.trim();
  if (!validNickname(nickname)) { message('Use a nickname of 3–16 letters, numbers, spaces, dots, underscores or dashes.'); return; }
  launching = true; $('launch').disabled = true;
  try {
    const ref = doc(db, 'fdGameProfiles', auth.currentUser.uid);
    profile = await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (snap.exists()) return snap.data();
      const initial = blankProfile(nickname); tx.set(ref, {...initial, updatedAt:serverTimestamp()}); return initial;
    });
    // Existing nicknames are stable for this prototype; no accidental reset of player data.
    if (profile.nickname !== nickname) message(`Using saved nickname: ${profile.nickname}.`);
    if (!approved) throw new Error('Employee approval is required.');
    if (!instance) {
      loading = true; message('Loading Fire Defense…');
      instance = await window.loadFireDefense(progress => message(`Loading Fire Defense… ${Math.round(progress*100)}%`));
      loading = false;
    }
    if (!approved) throw new Error('Employee approval is required.');
    if (unityReady) send('OnCloudProfile', profile);
    $('gate').hidden = true;
    $('canvas').focus();
  } catch (error) { loading = false; message(niceError(error)); }
  finally { launching = false; $('launch').disabled = !approved; }
};
window.FDEC = {
  ready() { unityReady = true; if (approved && profile && instance) send('OnCloudProfile', profile); },
  async save(json) {
    if (saveBusy) { send('OnCloudSaved',{ok:false,message:'A save is already running. Retry shortly.'}); return; }
    saveBusy = true;
    try {
      if (!approved || !auth.currentUser || !profile) throw new Error('Employee approval is required.');
      const payload = validateSave(JSON.parse(json)), uid = auth.currentUser.uid;
      const playerRef = doc(db,'fdGameProfiles',uid), boardRef = doc(db,'fdGameLeaderboard',uid);
      const result = await runTransaction(db, async tx => {
        const playerSnap = await tx.get(playerRef);
        if (!playerSnap.exists()) throw new Error('Player profile missing. Reload the page.');
        const old = playerSnap.data();
        // Same ID makes retries safe if a previous commit succeeded but its acknowledgement was lost.
        if (old.lastSaveId === payload.saveId) return old;
        if (old.revision !== payload.revision) throw new Error('Another tab changed your progress. Reload this page before continuing.');
        let oldBoard = null;
        if (payload.room > 0) { const b = await tx.get(boardRef); if (b.exists()) oldBoard = b.data(); }
        const next = {credits:payload.credits,nozzle:payload.nozzle,foam:payload.foam,cannon:payload.cannon,
          nickname:old.nickname,revision:old.revision+1,lastSaveId:payload.saveId};
        tx.set(playerRef,{...next,updatedAt:serverTimestamp()});
        if (payload.room > 0 && betterRun(payload,oldBoard)) tx.set(boardRef,{
          nickname:old.nickname, room:payload.room,score:payload.score,elapsedMs:payload.elapsedMs,updatedAt:serverTimestamp()
        });
        return next;
      });
      profile = result; send('OnCloudSaved',{ok:true,revision:result.revision,message:'Saved.'});
    } catch (error) { send('OnCloudSaved',{ok:false,message:niceError(error)}); }
    finally { saveBusy = false; }
  },
  board() { showBoard(); }
};
let boardAt = 0, cachedBoard = null, boardBusy = false;
async function showBoard() {
  if (!approved || boardBusy) return;
  $('board').showModal(); $('standings').textContent = 'Loading…';
  boardBusy = true;
  try {
    if (!cachedBoard || Date.now()-boardAt > 60000) {
      const q = query(collection(db,'fdGameLeaderboard'),orderBy('room','desc'),orderBy('score','desc'),orderBy('elapsedMs','asc'),limit(20));
      const snap = await getDocsFromServer(q); cachedBoard = snap.docs.map(d=>d.data()); boardAt = Date.now();
    }
    const rows = document.createElement('ol');
    for (const p of cachedBoard) {
      const li = document.createElement('li'); li.textContent = `${p.nickname} — Room ${p.room} · ${p.score} pts · ${(p.elapsedMs/1000).toFixed(1)}s`; rows.append(li);
    }
    $('standings').replaceChildren(rows);
    if (!cachedBoard.length) $('standings').textContent = 'No completed rooms yet. Set the first score!';
  } catch (e) { $('standings').textContent = niceError(e); }
  finally { boardBusy = false; }
}
$('closeboard').onclick = () => { $('board').close(); $('canvas').focus(); };
