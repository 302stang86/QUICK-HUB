import { game } from './game.js';
import { canPlay } from './access-policy.mjs';
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
let approved = false, profile = null, currentUid = null, stopProfile = null;
let launching = false, saveBusy = false, gateGeneration = 0;
let localMode = false, localAvailable = false;
function localKey() { return 'fdec-fire-defense-local-v1:' + auth.currentUser.uid; }
function allowLocalTest(error) {
  localAvailable = true;
  $('practice').hidden = false;
  message('Your employee access is recognized. Cloud saving is unavailable: ' + niceError(error) + ' You can use Local test below.');
}
function message(text) { $('message').textContent = text; }
function send(method,value) { game.receive(method,value); }
function block(text) {
  approved = false; profile = null; localAvailable = false; $('practice').hidden = true;
  $('gate').hidden = false; $('launch').disabled = true; message(text);
  send('OnCloudBlocked', text);
}
function acceptable(data) { return canPlay(auth.currentUser, data); }
function niceError(error) {
  const code = error?.code || '';
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Email and password did not match.';
  if (code.includes('permission-denied')) return 'Cloud game access was denied. Check that the game Firestore rules have been published.';
  if (code.includes('resource-exhausted')) return 'Firebase quota reached. Try again after the quota resets.';
  if (code.includes('failed-precondition')) return 'Firestore setup is incomplete. Check the composite index in the setup guide.';
  if (code.includes('unavailable')) return 'Connection unavailable. Reconnect and retry.';
  return error?.message || 'The request failed. Try again.';
}
onAuthStateChanged(auth, async user => {
  const generation = ++gateGeneration;
  stopProfile?.(); stopProfile = null;
  if (currentUid && user?.uid !== currentUid && game.loaded) { location.reload(); return; }
  currentUid = user?.uid || null; profile = null; approved = false; $('nickname').readOnly = false;
  $('login').hidden = !!user; $('logout').hidden = !user;
  if (!user || user.isAnonymous) { block('Sign in with your existing approved FDEC account.'); return; }
  message('Checking employee approval…');
  localMode = false; localAvailable = false; $('practice').hidden = true;
  const ref = doc(db, 'users', user.uid);
  try {
    const employee = await getDocFromServer(ref);
    if (generation !== gateGeneration) return;
    if (!acceptable(employee.exists() ? employee.data() : null)) { block('Signed in as ' + user.email + '. This employee profile is not approved. Use your approved FDEC account or ask your administrator to check it.'); return; }
    approved = true; message('Approved employee account. Loading your progress…');
    try {
      const snap = await getDocFromServer(doc(db, 'fdGameProfiles', user.uid));
      if (generation !== gateGeneration) return;
      profile = snap.exists() ? snap.data() : null;
    } catch (error) {
      if (generation !== gateGeneration) return;
      // Employee identity was checked on the server above; this is game-data setup, not account approval.
      allowLocalTest(error);
    }
    if (profile) { $('nickname').value = profile.nickname; $('nickname').readOnly = true; }
    $('launch').disabled = localAvailable; if (!localAvailable) message('Employee access recognized. Ready for response.');
    // A single employee-profile listener detects approval being removed during play.
    stopProfile = onSnapshot(ref, s => {
      if (!acceptable(s.exists() ? s.data() : null)) block('Employee access was removed. Contact your administrator.');
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
    game.loadProfile(profile);
    $('gate').hidden = true;
    $('canvas').focus();
  } catch (error) { if (approved) allowLocalTest(error); else message(niceError(error)); }
  finally { launching = false; $('launch').disabled = !approved || localAvailable; }
};
$('practice').onclick = () => {
  if (!approved || !auth.currentUser || !localAvailable) return;
  const nickname=$('nickname').value.trim();
  if (!validNickname(nickname)) { message('Choose a nickname of 3–16 letters, numbers, spaces, dots, underscores or dashes.'); return; }
  const initial=blankProfile(nickname);
  let local=initial;
  try {
    const stored=JSON.parse(localStorage.getItem(localKey()) || 'null');
    if (stored && validNickname(stored.nickname) && ['credits','nozzle','foam','cannon','revision'].every(k=>Number.isInteger(stored[k]))
        && stored.credits>=0 && stored.credits<=1000000 && stored.nozzle>=0 && stored.nozzle<=5
        && stored.foam>=0 && stored.foam<=3 && stored.cannon>=0 && stored.cannon<=3 && stored.revision>=0) local=stored;
  } catch (_) {}
  profile=local; localMode=true; game.loadProfile(profile);
  game.saveMessage='Local test — progress stays on this device; no online scores.'; game.updateView();
  $('mode-badge').hidden=false; $('gate').hidden=true; $('canvas').focus();
};
window.FDEC = {
  async save(json) {
    if (saveBusy) { send('OnCloudSaved',{ok:false,message:'A save is already running. Retry shortly.'}); return; }
    saveBusy = true;
    try {
      if (!approved || !auth.currentUser || !profile) throw new Error('Employee approval is required.');
      const payload = validateSave(JSON.parse(json)), uid = auth.currentUser.uid;
      if (localMode) {
        const next={credits:payload.credits,nozzle:payload.nozzle,foam:payload.foam,cannon:payload.cannon,
          nickname:profile.nickname,revision:profile.revision+1};
        localStorage.setItem(localKey(),JSON.stringify(next));profile=next;
        send('OnCloudSaved',{ok:true,revision:next.revision,message:'Local test — saved on this device only.'});return;
      }
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
  $('board').showModal(); if (localMode) { $('standings').textContent='Local test runs do not submit online scores. Publish the game Firestore rules and reload to play with cloud saving.'; return; } $('standings').textContent = 'Loading…';
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
