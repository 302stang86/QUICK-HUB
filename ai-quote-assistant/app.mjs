import { LIMITS, JOB_FIELDS, blankDraft, normalizeDraft, rawDraft, selectedDraft, proposalText } from './functions/core.mjs';
const $ = id => document.getElementById(id);
const labels = { customer: 'Customer', site: 'Site / facility', address: 'Site address', contact: 'Contact name', email: 'Contact email', phone: 'Contact phone', jobNumber: 'Job number', quoteNumber: 'Quote number', reportDate: 'Report date', system: 'System / equipment' };
let uid = null, draft = null, files = [], controller = null, ready = false, busy = false, dirty = false, mode = 'Manual draft', lastUid = null;
const endpoint = () => window.FDEC_AI_QUOTE_CONFIG?.endpoint;
const el = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
function tell(message, kind = '') { $('notice').textContent = message; $('notice').className = `notice no-print ${kind}`; }
function changed() { dirty = true; $('reviewed').checked = false; updatePreview(); }
function field(label, value, callback, { area = false, type = 'text', max = 5000, rows = 2 } = {}) {
  const wrap = el('label', label), input = el(area ? 'textarea' : 'input');
  if (!area) input.type = type; else input.rows = rows;
  input.value = value ?? ''; input.maxLength = max;
  if (type === 'number') { input.min = '0.000001'; input.step = 'any'; }
  input.addEventListener('input', () => { callback(input.value); changed(); });
  wrap.append(input); return wrap;
}
function selectField(label, value, options, callback) {
  const wrap = el('label', label), input = el('select');
  for (const [v, text] of options) { const option = el('option', text); option.value = v; input.append(option); }
  input.value = value; input.addEventListener('change', () => { callback(input.value); changed(); }); wrap.append(input); return wrap;
}
for (const key of JOB_FIELDS) {
  const wrap = el('label', labels[key]), input = el('input'); input.id = `input-${key}`; input.maxLength = 500; wrap.append(input); $('input-job').append(wrap);
}
function inputJob() { return Object.fromEntries(JOB_FIELDS.map(k => [k, $(`input-${k}`).value.trim()])); }
function setBusy(value) {
  busy = value; $('source-fields').disabled = value; $('busy').hidden = !value;
  ['manual', 'clear', 'load-local', 'load-file', 'quote-type'].forEach(k => $(k).disabled = value);
  $('analyze').disabled = value || !ready; $('analyze').textContent = value ? 'Analyzing…' : '✦ Analyze & draft scope';
}
function clearFiles() { files.forEach(f => URL.revokeObjectURL(f.url)); files = []; renderFiles(); }
function renderFiles() {
  $('files').replaceChildren();
  files.forEach((f, i) => {
    const row = el('li'), name = el('span', `${f.file.name} · ${(f.file.size / 1024 / 1024).toFixed(2)} MB`, 'file-name');
    const view = el('button', 'View'); view.addEventListener('click', () => window.open(f.url, '_blank', 'noopener'));
    const remove = el('button', 'Remove'); remove.disabled = busy; remove.setAttribute('aria-label', `Remove ${f.file.name}`);
    remove.addEventListener('click', () => { URL.revokeObjectURL(f.url); files.splice(i, 1); renderFiles(); dirty = true; });
    row.append(name, view, remove); $('files').append(row);
  });
}
async function addFiles(incoming) {
  if (busy) return;
  const errors = [];
  for (const file of incoming) {
    if (files.some(x => x.file.name === file.name)) { errors.push(`${file.name}: already attached (use unique filenames).`); continue; }
    if (!/\.pdf$/i.test(file.name) || file.name.length > 240 || file.size > LIMITS.fileBytes || file.size < 8) { errors.push(`${file.name}: choose a valid PDF up to 8 MB.`); continue; }
    if (files.length >= LIMITS.files || files.reduce((s, f) => s + f.file.size, file.size) > LIMITS.totalBytes) { errors.push('The upload limit is five PDFs and 12 MB combined.'); continue; }
    if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') { errors.push(`${file.name}: this file is not a PDF.`); continue; }
    files.push({ file, url: URL.createObjectURL(file) }); dirty = true;
  }
  renderFiles(); if (errors.length) tell(errors.join(' '), 'error');
}
$('pdfs').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
for (const name of ['dragenter', 'dragover']) $('drop-zone').addEventListener(name, e => { e.preventDefault(); $('drop-zone').classList.add('drag'); });
for (const name of ['dragleave', 'drop']) $('drop-zone').addEventListener(name, e => { e.preventDefault(); $('drop-zone').classList.remove('drag'); });
$('drop-zone').addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
function sourcesNode(sources) {
  const box = el('div', null, 'sources-ref');
  if (!sources.length) box.append(el('p', 'Manual item — verify the details.'));
  for (const source of sources) {
    const row = el('p'), f = files.find(x => x.file.name === source.file);
    const title = `${source.file}${source.page ? ` · page ${source.page}` : ''}`;
    if (f) { const button = el('button', title, 'source-link'); button.addEventListener('click', () => window.open(`${f.url}${source.page ? `#page=${source.page}` : ''}`, '_blank', 'noopener')); row.append(button); }
    else row.append(el('b', title));
    box.append(row, el('p', source.excerpt));
  }
  return box;
}
function renderDraft() {
  $('empty').hidden = !!draft; $('draft-editor').hidden = !draft; $('draft-mode').textContent = draft ? mode.toUpperCase() : 'NO DRAFT YET';
  if (!draft) return;
  $('review-job').replaceChildren(...JOB_FIELDS.map(k => field(labels[k], draft.job[k], v => draft.job[k] = v, { max: 500 })));
  $('job-sources').replaceChildren(...draft.jobSources.map(j => { const d = el('details'); d.append(el('summary', `${labels[j.field]} — source`), sourcesNode(j.sources)); return d; }));
  $('summary').value = draft.summary; $('introduction').value = draft.introduction;
  $('questions').replaceChildren(...draft.questions.map(q => el('div', q, 'question')));
  if (!draft.questions.length) $('questions').append(el('p', 'No additional questions were listed. Verify pricing and quantities before issuing.', 'helper'));
  $('conflicts').replaceChildren(...draft.conflicts.map(q => el('div', `Conflicting information: ${q}`, 'question conflict')));
  $('question-count').textContent = draft.questions.length + draft.conflicts.length;
  renderItems(); renderClauses(); updatePreview();
}
function checkRow(label, item, onChange) {
  const wrap = el('label', null, 'check'), input = el('input'); input.type = 'checkbox'; input.checked = item.selected;
  input.addEventListener('change', () => { item.selected = input.checked; changed(); onChange(); }); wrap.append(input, el('span', label)); return wrap;
}
function renderItems() {
  $('items').replaceChildren();
  draft.deficiencies.forEach((item, index) => {
    const card = el('article', null, `finding ${item.selected ? '' : 'unselected'}`); card.dataset.priority = item.priority;
    const head = el('div', null, 'item-header'), remove = el('button', 'Remove');
    remove.addEventListener('click', () => { draft.deficiencies.splice(index, 1); changed(); renderItems(); });
    head.append(checkRow(`Include item ${index + 1}`, item, renderItems), remove);
    const grid = el('div', null, 'item-grid');
    grid.append(field('Device / component', item.component, v => item.component = v, { max: 500 }), field('Location / system', item.location, v => item.location = v, { max: 500 }),
      field('Quantity (blank if unknown)', item.quantity, v => item.quantity = v.trim() ? Number(v) : null, { type: 'number' }),
      selectField('Reported priority', item.priority, [['unclassified', 'Not classified'], ['non-critical', 'Non-critical'], ['critical', 'Critical'], ['impaired', 'Impaired']], v => { item.priority = v; card.dataset.priority = v; }));
    const condition = field('Reported condition', item.condition, v => item.condition = v, { area: true, max: 2000 }); condition.className = 'full';
    const scope = field('Proposed scope of work', item.scope, v => item.scope = v, { area: true, max: 3000, rows: 3 }); scope.className = 'full';
    grid.append(condition, scope); card.append(head, grid, el('p', 'If you change the quantity or component, update the scope sentence to match.', 'helper'), sourcesNode(item.sources)); $('items').append(card);
  });
  if (!draft.deficiencies.length) $('items').append(el('p', 'No scope items yet. Add an item or analyze the source material.', 'helper'));
  $('scope-count').textContent = draft.deficiencies.filter(x => x.selected).length;
}
function renderClauses() {
  $('clauses').replaceChildren();
  draft.clauses.forEach((item, index) => {
    const card = el('article', null, `clause ${item.selected ? '' : 'unselected'}`), head = el('div', null, 'item-header'), remove = el('button', 'Remove');
    remove.addEventListener('click', () => { draft.clauses.splice(index, 1); changed(); renderClauses(); });
    head.append(checkRow(`Use clause ${index + 1}`, item, renderClauses), remove);
    const grid = el('div', null, 'item-grid');
    grid.append(selectField('Section', item.section, [['notes', 'Notes'], ['quals', 'Qualifications'], ['resp', 'Customer responsibilities'], ['incexc', 'Inclusions / exclusions']], v => item.section = v),
      selectField('Inclusion / exclusion mode', item.mode, [['inc', 'Included'], ['exc', 'Excluded'], ['off', 'Omitted']], v => item.mode = v));
    card.append(head, grid, field('Wording', item.text, v => item.text = v, { area: true, max: 3000 }), el('p', item.reason, 'helper'));
    if (item.sources.length) card.append(sourcesNode(item.sources)); $('clauses').append(card);
  });
  if (!draft.clauses.length) $('clauses').append(el('p', 'No clauses suggested. You can add wording here or use the full library in the Quote & Verbiage Suite.', 'helper'));
}
function updatePreview() {
  if (!draft) return;
  const selected = selectedDraft(draft); selected.clauses = selected.clauses.filter(c => c.mode !== 'off');
  $('preview').textContent = proposalText(selected);
  $('scope-count').textContent = draft.deficiencies.filter(x => x.selected).length;
}
$('summary').addEventListener('input', e => { draft.summary = e.target.value; changed(); });
$('introduction').addEventListener('input', e => { draft.introduction = e.target.value; changed(); });
$('add-item').addEventListener('click', () => { if (draft.deficiencies.length >= 100) return tell('A draft can contain up to 100 scope items.', 'error'); draft.deficiencies.push({ component: '', location: '', condition: '', quantity: null, priority: 'unclassified', scope: '', sources: [], selected: true }); changed(); renderItems(); });
$('add-clause').addEventListener('click', () => { if (draft.clauses.length >= 30) return tell('A draft can contain up to 30 clauses.', 'error'); draft.clauses.push({ section: 'notes', mode: 'inc', text: '', reason: 'Manually entered wording.', sources: [], selected: false }); changed(); renderClauses(); });
function canReplace() { return !draft || !dirty || confirm('Replace the current workspace draft? Save or download it first if you need to keep it.'); }
$('manual').addEventListener('click', () => {
  if (!canReplace()) return;
  draft = normalizeDraft(blankDraft(inputJob())); mode = 'Manual draft'; dirty = true; $('reviewed').checked = false; renderDraft();
  tell('Manual draft ready. Add scope items and wording, then review before sending to your quote.', 'success');
});
async function checkConnection() {
  if (!uid) return;
  ready = false; $('analyze').disabled = true;
  const checkingUid = uid;
  try {
    const token = await window.FDECAuth.user.getIdToken();
    const r = await fetch(endpoint(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const result = await r.json();
    if (!r.ok || result.ready !== true) throw Error('not-ready');
    if (uid !== checkingUid) return;
    ready = true; $('connection').textContent = '● AI connected'; $('connection').className = 'pill ready';
    $('setup-state').textContent = 'Connected'; $('setup-message').textContent = 'The secure analysis service is ready. Your existing manager/admin sign-in controls access.';
    tell('Ready. Add reports or technician notes to prepare your draft.');
  } catch {
    if (uid !== checkingUid) return;
    $('connection').textContent = 'AI connection needs setup'; $('connection').className = 'pill';
    $('setup-state').textContent = 'Setup needed'; $('setup-message').textContent = 'AI analysis is unavailable. An administrator needs to deploy the included Firebase function and configure its OpenAI key. If already deployed, check the connection and account permissions.';
    tell('AI analysis is not connected yet. You can prepare, edit, save, and transfer a manual draft.');
  }
  $('analyze').disabled = !ready || busy;
}
$('recheck').addEventListener('click', checkConnection);
function dataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.replace(/^data:[^;]*;/, 'data:application/pdf;')); reader.onerror = () => reject(Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); }); }
$('analyze').addEventListener('click', async () => {
  if (!ready || busy || !uid) return;
  if (!$('consent').checked) return tell('Select the consent box before sending reports or notes for analysis.', 'error');
  if (!$('tech-notes').value.trim() && !files.length) return tell('Add technician notes or a PDF report first.', 'error');
  if (draft && !canReplace()) return;
  controller = new AbortController(); const active = controller; const activeUid = uid;
  setBusy(true); tell('Analyzing source material. Larger reports may take a couple of minutes.');
  const timer = setTimeout(() => active.abort(), 165000);
  try {
    const payload = { type: $('quote-type').value, notes: $('tech-notes').value, job: inputJob(), files: await Promise.all(files.map(async f => ({ name: f.file.name, data: await dataURL(f.file) }))) };
    const token = await window.FDECAuth.user.getIdToken();
    const r = await fetch(endpoint(), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: active.signal });
    let result; try { result = await r.json(); } catch { throw Error('The AI service returned an unreadable response. Check the connection.'); }
    if (!r.ok) throw Error(result.error || 'Analysis failed. Try again later.');
    if (uid !== activeUid) return;
    draft = normalizeDraft(result.draft); mode = 'AI draft'; dirty = true; $('reviewed').checked = false; renderDraft();
    tell('Draft prepared. Check the source references, resolve missing details, and select the wording to include.', 'success');
    $('review-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { if (uid === activeUid) tell(active.signal.aborted ? 'Analysis stopped. Your current draft is unchanged.' : e.message, 'error'); }
  finally { clearTimeout(timer); if (controller === active) controller = null; setBusy(false); }
});
$('cancel').addEventListener('click', () => controller?.abort());
function requireDraft() { if (!draft) { tell('Prepare a draft first.', 'error'); return false; } return true; }
function packageDraft() { return { app: 'FDEC AI Quote Assistant', version: 1, savedAt: new Date().toISOString(), type: $('quote-type').value, mode, draft: rawDraft(draft), selections: { items: draft.deficiencies.map(x => x.selected), clauses: draft.clauses.map(x => x.selected) } }; }
function loadPackage(data) {
  if (data?.app !== 'FDEC AI Quote Assistant' || data.version !== 1 || !['repair', 'annual', 'install', 'backflow', 'fire-alarm'].includes(data.type)) throw Error('This is not an AI Quote Assistant draft.');
  const next = normalizeDraft(data.draft);
  next.deficiencies.forEach((x, i) => x.selected = data.selections?.items?.[i] !== false);
  next.clauses.forEach((x, i) => x.selected = data.selections?.clauses?.[i] === true);
  draft = next; mode = 'Loaded draft'; $('quote-type').value = data.type; $('reviewed').checked = false; clearFiles(); $('tech-notes').value = ''; JOB_FIELDS.forEach(k => $(`input-${k}`).value = next.job[k]); dirty = false; renderDraft();
  tell('Draft loaded. Reattach original PDFs to open page references. Review the draft before transferring it.', 'success');
}
$('save-local').addEventListener('click', () => { if (!requireDraft()) return; try { localStorage.setItem(`fdec_ai_quote_${uid}`, JSON.stringify(packageDraft())); dirty = false; tell('Draft saved on this device for your account. Uploaded PDFs and pasted notes were not saved.', 'success'); } catch { tell('Device storage is unavailable or full. Download the draft instead.', 'error'); } });
$('load-local').addEventListener('click', () => { if (!canReplace()) return; try { const raw = localStorage.getItem(`fdec_ai_quote_${uid}`); if (!raw) return tell('No saved AI draft was found for your account on this device.'); loadPackage(JSON.parse(raw)); } catch (e) { tell(e.message, 'error'); } });
function downloadFile(text, type, extension) { const url = URL.createObjectURL(new Blob([text], { type })); const a = el('a'); a.href = url; a.download = `FDEC_AI_Quote_${(draft.job.quoteNumber || draft.job.site || 'Draft').replace(/[^\w-]+/g, '_')}.${extension}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('download').addEventListener('click', () => { if (!requireDraft()) return; downloadFile(JSON.stringify(packageDraft(), null, 2), 'application/json', 'fdecai'); dirty = false; tell('Draft downloaded. Original PDF attachments and pasted notes are excluded.', 'success'); });
$('load-file').addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; if (!file || !canReplace()) return; if (file.size > 2 * 1024 * 1024) return tell('Draft file is too large (2 MB maximum).', 'error'); try { loadPackage(JSON.parse(await file.text())); } catch (error) { tell(error.message, 'error'); } });
function clearWorkspace() { draft = null; clearFiles(); $('tech-notes').value = ''; $('consent').checked = false; $('reviewed').checked = false; JOB_FIELDS.forEach(k => $(`input-${k}`).value = ''); dirty = false; renderDraft(); }
$('clear').addEventListener('click', () => { if (confirm('Clear this workspace and remove your saved AI draft from this device? Download a copy first if needed.')) { try { localStorage.removeItem(`fdec_ai_quote_${uid}`); } catch {} clearWorkspace(); tell('Workspace and saved device draft cleared.'); } });
function reviewedDraft() {
  if (!requireDraft()) return null;
  if (!$('reviewed').checked) { tell('Review the selected scope and check the review box before continuing.', 'error'); return null; }
  const selected = selectedDraft(draft); selected.clauses = selected.clauses.filter(c => c.mode !== 'off');
  if (!selected.deficiencies.length || selected.deficiencies.some(x => !x.scope.trim() || (x.quantity !== null && (!Number.isFinite(x.quantity) || x.quantity <= 0)))) { tell('Select at least one scope item, complete its wording, and correct any invalid quantities.', 'error'); return null; }
  return selected;
}
$('copy').addEventListener('click', async () => { const data = reviewedDraft(); if (!data) return; try { await navigator.clipboard.writeText(proposalText(data)); tell('Selected customer wording copied.', 'success'); } catch { tell('Clipboard access was blocked. Use the preview to select and copy the wording.', 'error'); } });
$('print').addEventListener('click', () => { const data = reviewedDraft(); if (!data) return; $('print-document').textContent = proposalText(data); window.print(); });
$('transfer').addEventListener('click', () => { const data = reviewedDraft(); if (!data) return;
  try {
    sessionStorage.setItem('fdec_ai_quote_transfer', JSON.stringify({ uid, createdAt: Date.now(), type: $('quote-type').value, draft: data }));
    dirty = false; location.href = new URL($('quote-type').value === 'fire-alarm' ? 'fire-alarm-quoting.html?ai-draft=1' : 'quoting.html?ai-draft=1', document.baseURI).href;
  } catch { tell('Could not transfer the draft. Download it or copy the wording instead.', 'error'); }
});
$('source-fields').addEventListener('input', () => { dirty = true; });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
// The shared gate's ready promise resolves once, including before a later sign-in.
// Watch its resolved account state so a successful login in this tab is recognized.
async function syncAccount() {
  const auth = window.FDECAuth;
  const allowed = auth?.user && auth.canOpen('quoting') && (auth.isAdmin || auth.profile?.role === 'manager');
  const next = allowed ? auth.user.uid : null;
  if (next === lastUid) return;
  lastUid = next;
  controller?.abort(); clearWorkspace(); uid = next; ready = false;
  $('workspace').hidden = !allowed;
  if (next) await checkConnection();
}
setInterval(syncAccount, 600); syncAccount();
