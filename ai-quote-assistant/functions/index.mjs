import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { canUseAssistant } from './core.mjs';
import { createHandler } from './handler.mjs';
initializeApp();
const db = getFirestore();
const key = defineSecret('OPENAI_API_KEY');
const model = defineString('AI_QUOTE_MODEL', { default: 'gpt-4.1' });
const origins = defineString('AI_QUOTE_ORIGINS', { default: 'https://302stang86.github.io' });
const library = JSON.parse(readFileSync(new URL('./verbiage.json', import.meta.url), 'utf8'));
async function authorize(header) {
  if (!/^Bearer \S+$/.test(header || '')) throw Error('unauthorized');
  const token = await getAuth().verifyIdToken(header.slice(7), true);
  const [user, permissions] = await Promise.all([db.doc(`users/${token.uid}`).get(), db.doc('config/permissions').get()]);
  if (!canUseAssistant(token, user.data(), permissions.data())) throw Error('forbidden');
  return token;
}
async function reserve(uid) {
  // Server-only counters: no notes, reports or quote drafts are stored here.
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  await db.runTransaction(async tx => {
    const user = db.doc(`aiQuoteUsage/${uid}`), global = db.doc('aiQuoteUsage/_daily');
    const [u, g] = await Promise.all([tx.get(user), tx.get(global)]);
    const ud = u.data() || {}, gd = g.data() || {};
    const uc = ud.day === day ? ud.count : 0, gc = gd.day === day ? gd.count : 0;
    if (now - (ud.lastAt || 0) < 30000) throw Error('Please wait 30 seconds between analyses.');
    if (uc >= 20 || gc >= 100) throw Error('The daily analysis limit has been reached. Try again tomorrow.');
    tx.set(user, { day, count: uc + 1, lastAt: now });
    tx.set(global, { day, count: gc + 1 });
  });
}
export const aiQuoteAssistant = onRequest({ region: 'us-central1', timeoutSeconds: 180, memory: '1GiB', maxInstances: 2,
  concurrency: 4, secrets: [key], invoker: 'public' }, (req, res) => createHandler({ authorize, reserve,
  apiKey: () => key.value(), model: () => model.value(), library,
  allowedOrigins: origins.value().split(',').map(x => x.trim()) })(req, res));
