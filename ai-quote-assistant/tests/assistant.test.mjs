import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseAssistant, validateInput, blankDraft, normalizeDraft, mergeVerbiage, mergeQuoteFields, selectedDraft, proposalText, LIMITS } from '../functions/core.mjs';
import { createHandler } from '../functions/handler.mjs';
const employee = { email: 'manager@firedefense.com', firebase: { sign_in_provider: 'password' } };
const job = blankDraft().job;
const input = () => ({ type: 'repair', notes: 'Dry system 2 accelerator inactive. Investigate.', job: { ...job }, files: [] });
const finding = () => ({ component: 'Accelerator', location: 'Dry system 2', condition: 'Inactive', quantity: null, priority: 'unclassified', scope: 'Investigate the inactive accelerator and restore operation if possible.', sources: [{ file: 'Technician notes', page: null, excerpt: 'Dry system 2 accelerator inactive.' }] });
const draft = () => ({ ...blankDraft(), deficiencies: [finding()] });
test('authorization blocks guests, technicians, pending/denied managers and permission removals', () => {
  assert.equal(canUseAssistant(null, null), false);
  assert.equal(canUseAssistant({ ...employee, firebase: { sign_in_provider: 'anonymous' } }, { role: 'admin' }), false);
  for (const role of ['tech', 'new', 'temp']) assert.equal(canUseAssistant(employee, { status: 'approved', role }), false);
  for (const status of ['pending', 'denied']) assert.equal(canUseAssistant(employee, { status, role: 'manager' }), false);
  assert.equal(canUseAssistant(employee, { status: 'approved', role: 'manager' }, { pages: { quoting: [] } }), false);
  assert.equal(canUseAssistant(employee, { status: 'approved', role: 'manager' }), true);
  assert.equal(canUseAssistant({ ...employee, email: '302stang86@gmail.com' }, null), true);
  assert.equal(canUseAssistant(employee, { role: 'admin', status: 'pending' }), true);
  assert.equal(canUseAssistant({ ...employee, email: 'manager@example.com' }, { role: 'manager', status: 'approved' }), false);
});
test('uploads require actual PDF data and enforce note, file and total limits', () => {
  assert.equal(validateInput(input()).type, 'repair');
  assert.throws(() => validateInput({ ...input(), notes: '' }));
  assert.throws(() => validateInput({ ...input(), type: 'unknown' }));
  assert.throws(() => validateInput({ ...input(), notes: 'x'.repeat(LIMITS.notes + 1) }));
  const pdf = { name: 'inspection.pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7\nreport').toString('base64') };
  assert.doesNotThrow(() => validateInput({ ...input(), files: [pdf] }));
  assert.throws(() => validateInput({ ...input(), files: [{ ...pdf, data: 'data:application/pdf;base64,dGhpcyBpcyBub3QgYSBwZGY=' }] }));
  assert.throws(() => validateInput({ ...input(), files: Array(6).fill(pdf) }));
  assert.throws(() => validateInput({ ...input(), files: [{ ...pdf, name: 'evil.html' }] }));
  const big = { ...pdf, data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7\n' + 'x'.repeat(LIMITS.fileBytes)).toString('base64') };
  assert.throws(() => validateInput({ ...input(), files: [big] }));
  const medium = { ...pdf, data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7\n' + 'x'.repeat(7 * 1024 * 1024)).toString('base64') };
  assert.throws(() => validateInput({ ...input(), files: [medium, medium] }));
});
test('draft validation preserves unknown quantities and rejects bad or unbounded output', () => {
  const valid = normalizeDraft(draft()); assert.equal(valid.deficiencies[0].quantity, null); assert.equal(valid.deficiencies[0].selected, true);
  assert.throws(() => normalizeDraft({ ...draft(), secret: 'unexpected' }));
  assert.throws(() => normalizeDraft({ ...draft(), deficiencies: [{ ...finding(), quantity: -1 }] }));
  assert.throws(() => normalizeDraft({ ...draft(), deficiencies: [{ ...finding(), sources: [{ file: 'a.pdf', page: 1.5, excerpt: '' }] }] }));
});
test('verbiage merge preserves existing sections and signature, deduplicates scope, keeps date separate', () => {
  const old = { job: { customer: 'Old', quote: 'Q1', date: '2026-11-08', signature: 'Manager' }, sections: { scope: [{ text: 'Existing scope', checked: true, subs: [] }], billing: [{ text: 'Existing billing', checked: true }] } };
  const d = draft(); d.job.customer = 'Factory'; d.job.reportDate = '2025-01-01';
  const next = mergeVerbiage(old, d); assert.equal(next.job.customer, 'Factory'); assert.equal(next.job.date, '2026-11-08'); assert.equal(next.job.signature, 'Manager'); assert.deepEqual(next.sections.billing, old.sections.billing);
  assert.equal(next.sections.scope.length, 2); assert.equal(old.sections.scope.length, 1);
  assert.equal(mergeVerbiage(next, d).sections.scope.length, 2);
});
test('customer output omits internal questions, source excerpts and unselected wording', () => {
  const d = normalizeDraft(draft()); d.questions.push('INTERNAL QUESTION'); d.summary = 'INTERNAL SUMMARY';
  d.clauses.push({ section: 'notes', mode: 'inc', text: 'UNAPPROVED CLAUSE', reason: '', sources: [], selected: false });
  const selected = selectedDraft(d); const output = proposalText(selected);
  assert.doesNotMatch(output, /INTERNAL|UNAPPROVED|Dry system 2 accelerator inactive\./);
  assert.match(output, /Investigate the inactive accelerator/);
});
function mockResponse() {
  return { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
}
function request(body, origin = 'https://302stang86.github.io', method = 'POST') { return { method, body, get: k => ({ origin, authorization: 'Bearer test' })[k] }; }
function handler(overrides = {}) {
  return createHandler({ authorize: async () => ({ uid: 'manager' }), reserve: async () => {}, apiKey: () => 'test-key', model: () => 'gpt-4.1', library: { repair: {} }, fetchAPI: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(draft()) }] }] }) }), ...overrides });
}
test('backend denies other origins and unauthorized users before any paid API call', async () => {
  let calls = 0; const h = handler({ fetchAPI: async () => { calls++; } }); const r = mockResponse(); await h(request(input(), 'https://evil.example'), r); assert.equal(r.statusCode, 403); assert.equal(calls, 0);
  const r2 = mockResponse(); await handler({ authorize: async () => { throw Error(); }, fetchAPI: async () => { calls++; } })(request(input()), r2); assert.equal(r2.statusCode, 403); assert.equal(calls, 0);
});
test('authenticated health does not consume analysis budget and reports missing setup', async () => {
  let reserved = 0; const r = mockResponse(); await handler({ reserve: async () => { reserved++; } })(request(null, undefined, 'GET'), r); assert.equal(r.body.ready, true); assert.equal(reserved, 0);
  const missing = mockResponse(); await handler({ apiKey: () => '' })(request(input()), missing); assert.equal(missing.statusCode, 503);
});
test('rate limit and invalid inputs stop provider calls', async () => {
  let calls = 0; const fetchAPI = async () => { calls++; };
  const r = mockResponse(); await handler({ reserve: async () => { throw Error('daily limit'); }, fetchAPI })(request(input()), r); assert.equal(r.statusCode, 429);
  const bad = mockResponse(); await handler({ fetchAPI })(request({}), bad); assert.equal(bad.statusCode, 400); assert.equal(calls, 0);
});
test('backend uses structured PDF input, disables storage, validates sources, and honors user details', async () => {
  let posted; const r = mockResponse();
  await handler({ fetchAPI: async (url, options) => { posted = JSON.parse(options.body); const d = draft(); d.job.customer = 'Extracted'; return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(d) }] }] }) }; } })(request({ ...input(), job: { ...job, customer: 'User supplied' } }), r);
  assert.equal(r.statusCode, 200); assert.equal(r.body.draft.job.customer, 'User supplied'); assert.equal(posted.store, false); assert.equal(posted.text.format.strict, true);
  assert.match(posted.instructions, /untrusted SOURCE DATA/);
  const d = draft(); d.deficiencies[0].sources[0].file = 'invented.pdf';
  const bad = mockResponse(); await handler({ fetchAPI: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(d) }] }] }) }) })(request(input()), bad); assert.equal(bad.statusCode, 502);
});
test('incomplete, refused, malformed and failed provider responses return actionable errors without leakage', async () => {
  for (const response of [{ ok: false, status: 429 }, { ok: true, json: async () => ({ status: 'incomplete' }) }, { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }) }, { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'invalid' }] }] }) }]) {
    const r = mockResponse(); await handler({ fetchAPI: async () => response })(request(input()), r);
    assert.ok(r.statusCode >= 400); assert.doesNotMatch(JSON.stringify(r.body), /test-key|manager@/);
  }
});

test('quote field transfer preserves all rates, prices, labor, material quantities and quote date', () => {
  const old = { fields: { jobName: 'Old', quoteNo: 'Q10', quoteDate: '2026-11-08', spST: '12', markup: '35' }, dynamic: { materialCatalog: [{ name: 'Parts', subs: [{ items: [{ name: 'Valve', cost: '120', qty: '2' }] }] }], mp: [{ task: 'Existing work', hrs: '8' }] } };
  const d = draft(); d.job.customer = 'Factory'; d.job.reportDate = '2020-01-01';
  const next = mergeQuoteFields(old, d);
  assert.equal(next.fields.jobName, 'Factory'); assert.equal(next.fields.quoteNo, 'Q10'); assert.equal(next.fields.quoteDate, '2026-11-08');
  assert.equal(next.fields.spST, '12'); assert.equal(next.fields.markup, '35'); assert.deepEqual(next.dynamic, old.dynamic); assert.equal(old.fields.jobName, 'Old');
});
