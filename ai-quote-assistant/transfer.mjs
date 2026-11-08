import { draftSchema, matchesSchema, mergeVerbiage, mergeQuoteFields } from './functions/core.mjs';
const key = 'fdec_ai_quote_transfer';
const params = new URLSearchParams(location.search);
if (params.get('ai-draft') === '1') {
  const timer = setInterval(() => {
    const auth = window.FDECAuth;
    if (!auth?.user || !auth.canOpen('quoting') || !(auth.isAdmin || auth.profile?.role === 'manager')) return;
    clearInterval(timer); offer(auth).catch(() => alert('The AI draft could not be opened. Return to AI Quote Assistant and send it again.'));
  }, 400);
}
async function offer(auth) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return;
  const transfer = JSON.parse(raw);
  if (transfer.uid !== auth.user.uid || !Number.isFinite(transfer.createdAt) || Date.now() - transfer.createdAt > 30 * 60 * 1000 || !matchesSchema(transfer.draft, draftSchema)) {
    sessionStorage.removeItem(key); throw Error('invalid-transfer');
  }
  const isAlarm = location.pathname.endsWith('/fire-alarm-quoting.html');
  if (isAlarm !== (transfer.type === 'fire-alarm')) throw Error('wrong-destination');
  const panel = document.createElement('section'); panel.className = 'no-print noprint';
  panel.style.cssText = 'flex:none;position:relative;z-index:20;background:#eef6ff;border-bottom:2px solid #1764a5;padding:14px 20px;font:14px/1.5 system-ui;color:#19334e;';
  const title = document.createElement('strong'); title.textContent = `AI Quote Assistant: ${transfer.draft.deficiencies.length} reviewed scope item(s) ready`;
  const text = document.createElement('p'); text.textContent = 'Apply the supplied job details and add selected scope and clauses to this quote. Save your current quote first if it belongs to another job. Pricing and labor hours will remain unchanged.'; text.style.margin = '5px 0 10px';
  const apply = document.createElement('button'); apply.textContent = 'Apply reviewed draft';
  const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss';
  for (const b of [apply, dismiss]) b.style.cssText = 'font:600 13px system-ui;padding:9px 14px;border:1px solid #9fb8d0;border-radius:6px;margin:0 8px 0 0;cursor:pointer;background:white;color:#102b4e;min-height:40px';
  const link = document.createElement('a'); link.href = 'ai-quote-assistant/index.html'; link.textContent = 'Back to AI Quote Assistant';
  panel.append(title, text, apply, dismiss, link); document.body.prepend(panel);
  dismiss.onclick = () => { sessionStorage.removeItem(key); panel.remove(); };
  apply.onclick = async () => {
    if (window.FDECAuth?.user?.uid !== transfer.uid || !window.FDECAuth.canOpen('quoting')) return;
    apply.disabled = true; apply.textContent = 'Applying…';
    try {
      if (isAlarm) {
        if (transfer.draft.deficiencies.some(x => !Number.isInteger(x.quantity) || x.quantity < 1)) throw Error('Fire alarm repair rows require a confirmed whole-number quantity. Return to the assistant and fill in each selected quantity.');
        if (typeof window.fdecApplyAIAlarm !== 'function') throw Error('The fire alarm quote is still loading. Try again.');
        await window.fdecApplyAIAlarm(transfer.draft);
      } else {
        const map = { repair: 'proposal', annual: 'annual', install: 'install', backflow: 'backflow' };
        const page = map[transfer.type]; if (!page) throw Error('Unsupported quote type.');
        const [q, p] = await Promise.all([window.askDraft('view-quote'), window.askDraft(`view-${page}`)]);
        if (!q?.data?.fields || !p?.data?.sections) throw Error('The quote tools are still loading. Try applying the draft again in a moment.');
        // Keep a session-only recovery copy before changing either frame.
        sessionStorage.setItem(`fdec_ai_quote_backup_${transfer.uid}`, JSON.stringify({ savedAt: new Date().toISOString(), quote: q.data, page, verbiage: p.data }));
        const nextQuote = mergeQuoteFields(q.data, transfer.draft);
        const nextVerbiage = mergeVerbiage(p.data, transfer.draft);
        document.getElementById('view-quote').contentWindow.postMessage({ fdec: true, type: 'load-draft', page: 'quote', data: nextQuote }, '*');
        document.getElementById(`view-${page}`).contentWindow.postMessage({ fdec: true, type: 'load-draft', page, data: nextVerbiage }, '*');
        const [vq, vp] = await Promise.all([window.askDraft('view-quote'), window.askDraft(`view-${page}`)]);
        if (vq?.data?.fields?.jobName !== nextQuote.fields.jobName || !transfer.draft.deficiencies.every(x => vp?.data?.sections?.scope?.some(s => s.checked && s.text === x.scope))) throw Error('The quote did not confirm the imported draft. Your assistant draft remains available; check the quote before retrying.');
        window.autosaveStore('quote', nextQuote); window.autosaveStore(page, nextVerbiage); window._suiteDirty = true;
        window.showView(page);
      }
      sessionStorage.removeItem(key);
      title.textContent = 'AI draft applied — review your quote before issuing.'; text.textContent = 'Selected scope and wording have been added. Complete pricing, labor, and any outstanding details in the quote tools.';
      apply.remove(); dismiss.textContent = 'Close';
    } catch (e) { text.textContent = e.message || 'Could not apply the draft.'; apply.disabled = false; apply.textContent = 'Try applying again'; }
  };
}
