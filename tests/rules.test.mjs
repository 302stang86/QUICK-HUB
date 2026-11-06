// Run via npm run test:rules. Never points at production.
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc,setDoc,getDoc,collection,query,limit,getDocs,serverTimestamp,updateDoc,writeBatch } from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fdec-game',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(process.env.FDEC_RULES_FILE || new URL('../firebase/game-only.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
    const adminDb=c.firestore();
    for(const [uid,status] of [['alice','approved'],['bob','approved'],['pending','pending'],['denied','denied']])
      await setDoc(doc(adminDb,'users',uid),{role:'tech',status});
  });
});
const db=uid=>env.authenticatedContext(uid,{email:`${uid}@firedefense.com`,firebase:{sign_in_provider:'password'}}).firestore();
const profile=()=>({credits:0,nozzle:0,foam:0,cannon:0,revision:0,nickname:'Responder',lastSaveId:'',updatedAt:serverTimestamp()});
const run=()=>({nickname:'Responder',room:2,score:500,elapsedMs:10000,updatedAt:serverTimestamp()});
test('only approved employees can create a game profile',async()=>{
  await assertSucceeds(setDoc(doc(db('alice'),'fdGameProfiles','alice'),profile()));
  for(const uid of ['pending','denied']) await assertFails(setDoc(doc(db(uid),'fdGameProfiles',uid),profile()));
  const guest=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(guest,'fdGameLeaderboard','alice')));
  const anon=env.authenticatedContext('alice',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  await assertFails(getDoc(doc(anon,'fdGameProfiles','alice')));
});
test('profiles private; leaderboard employee-only and bounded',async()=>{
  const alice=db('alice'),bob=db('bob');await setDoc(doc(alice,'fdGameProfiles','alice'),profile());
  await assertFails(getDoc(doc(bob,'fdGameProfiles','alice')));
  await assertFails(setDoc(doc(bob,'fdGameProfiles','alice'),profile()));
  await setDoc(doc(alice,'fdGameLeaderboard','alice'),run());
  await assertSucceeds(getDocs(query(collection(bob,'fdGameLeaderboard'),limit(20))));
  await assertFails(getDocs(collection(bob,'fdGameLeaderboard')));
  await assertFails(getDocs(query(collection(bob,'fdGameLeaderboard'),limit(21))));
  await assertFails(getDoc(doc(db('pending'),'fdGameLeaderboard','alice')));
});
test('profiles reject extra fields, free initial upgrades and stale revisions',async()=>{
  const a=db('alice'),ref=doc(a,'fdGameProfiles','alice');
  await assertFails(setDoc(ref,{...profile(),role:'admin'}));
  await assertFails(setDoc(ref,{...profile(),credits:100}));
  await setDoc(ref,profile());
  await assertFails(updateDoc(ref,{credits:50,updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref,{credits:50,revision:1,lastSaveId:'a'.repeat(32),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref,{credits:60,revision:1,lastSaveId:'b'.repeat(32),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref,{nozzle:6,revision:2,lastSaveId:'c'.repeat(32),updatedAt:serverTimestamp()}));
});
test('leaderboard only improves in the selected ranking order',async()=>{
  const a=db('alice'),ref=doc(a,'fdGameLeaderboard','alice');await setDoc(doc(a,'fdGameProfiles','alice'),profile());
  await setDoc(ref,run());
  await assertFails(setDoc(ref,{...run(),room:1,score:9999}));
  await assertFails(setDoc(ref,{...run(),score:499,elapsedMs:1}));
  await assertFails(setDoc(ref,{...run(),elapsedMs:10001}));
  await assertSucceeds(setDoc(ref,{...run(),elapsedMs:9999}));
  await assertSucceeds(setDoc(ref,{...run(),room:3,score:1}));
  await assertFails(setDoc(ref,{...run(),room:31}));
});
test('batch profile and best run save together',async()=>{
  const a=db('alice');await setDoc(doc(a,'fdGameProfiles','alice'),profile());
  const batch=writeBatch(a);batch.update(doc(a,'fdGameProfiles','alice'),{credits:50,revision:1,lastSaveId:'a'.repeat(32),updatedAt:serverTimestamp()});
  batch.set(doc(a,'fdGameLeaderboard','alice'),run());await assertSucceeds(batch.commit());
});

test('approval removal immediately revokes cloud access',async()=>{
  const a=db('alice');await setDoc(doc(a,'fdGameProfiles','alice'),profile());
  await env.withSecurityRulesDisabled(async c=>{const adminDb=c.firestore();await updateDoc(doc(adminDb,'users','alice'),{status:'denied'});});
  await assertFails(getDoc(doc(a,'fdGameProfiles','alice')));
  await assertFails(updateDoc(doc(a,'fdGameProfiles','alice'),{credits:10,revision:1,lastSaveId:'a'.repeat(32),updatedAt:serverTimestamp()}));
});
test('no employee can overwrite another employee leaderboard or use a forged nickname',async()=>{
  const a=db('alice'),b=db('bob');await setDoc(doc(a,'fdGameProfiles','alice'),profile());
  await setDoc(doc(b,'fdGameProfiles','bob'),profile());
  await assertFails(setDoc(doc(b,'fdGameLeaderboard','alice'),run()));
  await assertFails(setDoc(doc(a,'fdGameLeaderboard','alice'),{...run(),nickname:'ForgedName'}));
});

test('existing designated administrator email is recognized without an employee profile',async()=>{
 const a=env.authenticatedContext('existing-admin',{email:'302stang86@gmail.com',firebase:{sign_in_provider:'password'}}).firestore();
 await assertSucceeds(setDoc(doc(a,'fdGameProfiles','existing-admin'),profile()));
 const anon=env.authenticatedContext('fake-anon-admin',{email:'302stang86@gmail.com',firebase:{sign_in_provider:'anonymous'}}).firestore();
 await assertFails(setDoc(doc(anon,'fdGameProfiles','fake-anon-admin'),profile()));
});
test('approved legacy profiles without a role and existing admin roles match the hub',async()=>{
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'users','legacy'),{status:'approved'});await setDoc(doc(d,'users','roleadmin'),{role:'admin',status:'pending'});});
 await assertSucceeds(setDoc(doc(db('legacy'),'fdGameProfiles','legacy'),profile()));
 await assertSucceeds(setDoc(doc(db('roleadmin'),'fdGameProfiles','roleadmin'),profile()));
});
