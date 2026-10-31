/* Shared Firebase helpers for Battle Royal live play. Reuses the app that
   fdec-auth.js already started, so there is one sign-in for the whole hub. */
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as F from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const fs = {
  doc: F.doc, collection: F.collection, getDoc: F.getDoc, setDoc: F.setDoc, updateDoc: F.updateDoc,
  deleteDoc: F.deleteDoc, onSnapshot: F.onSnapshot, runTransaction: F.runTransaction,
  serverTimestamp: F.serverTimestamp, deleteField: F.deleteField
};
let db = null;
export function getDb(){
  if (db) return db;
  const apps = getApps();
  const app = apps.find(a => a.name === "fdec") || apps[0];
  if (!app) return null;
  db = F.getFirestore(app);
  return db;
}
export function me(){
  const a = window.FDECAuth;
  if (!a || !a.user) return null;
  const ok = a.isAdmin || (a.profile && a.profile.status === "approved");
  if (!ok) return null;
  const name = String((a.profile && a.profile.name) || a.user.displayName || (a.user.email || "").split("@")[0] || "Player").trim().slice(0, 60);
  return { uid: a.user.uid, name: name || "Player" };
}
/* Wait until the person is signed in AND approved (the page gate blocks the UI until then). */
export async function waitUser(){
  for (;;){
    const u = me();
    if (u && getDb()) return u;
    await new Promise(r => setTimeout(r, 250));
  }
}
export const ms = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (typeof v === "number" ? v : Date.now());
