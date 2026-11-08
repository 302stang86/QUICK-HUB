export const TYPES = ['repair', 'annual', 'install', 'backflow', 'fire-alarm'];
export const LIMITS = { files: 5, fileBytes: 8 * 1024 * 1024, totalBytes: 12 * 1024 * 1024, notes: 40000 };
export const JOB_FIELDS = ['customer', 'site', 'address', 'contact', 'email', 'phone', 'jobNumber', 'quoteNumber', 'reportDate', 'system'];
export const ADMIN_EMAILS = ['mp1@firedefense.com', '302stang86@gmail.com', 'wh1@firedefense.com'];
const str = (max = 5000) => ({ type: 'string', maxLength: max });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items, maxItems = 100) => ({ type: 'array', items, maxItems });
export const sourceSchema = obj({ file: str(240), page: { type: ['integer', 'null'], minimum: 1 }, excerpt: str(500) });
export const draftSchema = obj({
  job: obj(Object.fromEntries(JOB_FIELDS.map(k => [k, str(500)]))),
  jobSources: arr(obj({ field: { type: 'string', enum: JOB_FIELDS }, sources: arr(sourceSchema, 5) }), 10),
  summary: str(4000), introduction: str(4000),
  deficiencies: arr(obj({ component: str(500), location: str(500), condition: str(2000),
    quantity: { type: ['number', 'null'], exclusiveMinimum: 0 },
    priority: { type: 'string', enum: ['impaired', 'critical', 'non-critical', 'unclassified'] },
    scope: str(3000), sources: arr(sourceSchema, 5) })),
  clauses: arr(obj({ section: { type: 'string', enum: ['notes', 'quals', 'resp', 'incexc'] },
    mode: { type: 'string', enum: ['inc', 'exc', 'off'] }, text: str(3000), reason: str(1000), sources: arr(sourceSchema, 5) }), 30),
  questions: arr(str(1000), 40), conflicts: arr(str(1000), 40)
});
export function canUseAssistant(token, profile, permissions) {
  if (!token || token.firebase?.sign_in_provider === 'anonymous') return false;
  const email = String(token.email || '').toLowerCase();
  if (ADMIN_EMAILS.includes(email) || profile?.role === 'admin') return true;
  return email.endsWith('@firedefense.com') && profile?.status === 'approved' && profile.role === 'manager'
    && (permissions?.pages?.quoting || ['manager', 'admin']).includes(profile.role);
}
export function validateInput(input) {
  if (!input || !TYPES.includes(input.type)) throw Error('Choose a quote type.');
  if (typeof input.notes !== 'string' || input.notes.length > LIMITS.notes) throw Error('Notes exceed the 40,000 character limit.');
  if (!Array.isArray(input.files) || input.files.length > LIMITS.files) throw Error('Attach up to five PDFs.');
  if (!input.notes.trim() && !input.files.length) throw Error('Add technician notes or a PDF report.');
  if (!input.job || Object.keys(input.job).some(k => !JOB_FIELDS.includes(k)) || JOB_FIELDS.some(k => typeof input.job[k] !== 'string' || input.job[k].length > 500)) throw Error('Job details are invalid.');
  let total = 0;
  for (const f of input.files) {
    if (typeof f.name !== 'string' || !/\.pdf$/i.test(f.name) || f.name.length > 240 || typeof f.data !== 'string'
      || !/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(f.data)) throw Error('Only PDF files are accepted.');
    const raw = f.data.split(',')[1];
    const size = raw.length * 3 / 4 - (raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0);
    if (size < 8 || size > LIMITS.fileBytes || !raw.startsWith('JVBERi0')) throw Error('A PDF is invalid or exceeds 8 MB.');
    total += size;
  }
  if (total > LIMITS.totalBytes) throw Error('PDFs exceed the combined 12 MB limit.');
  return input;
}
// Validate again at the network/file boundary, including imported local drafts.
export function matchesSchema(v, s) {
  const types = Array.isArray(s.type) ? s.type : [s.type];
  const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  if (!types.includes(type) && !(types.includes('integer') && Number.isInteger(v))) return false;
  if (typeof v === 'number' && (!Number.isFinite(v) || (s.minimum != null && v < s.minimum) || (s.exclusiveMinimum != null && v <= s.exclusiveMinimum))) return false;
  if (typeof v === 'string' && s.maxLength && v.length > s.maxLength) return false;
  if (s.enum && !s.enum.includes(v)) return false;
  if (type === 'array') return v.length <= (s.maxItems ?? 1000) && v.every(x => matchesSchema(x, s.items));
  if (type === 'object') return s.required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => s.properties[k] && matchesSchema(v[k], s.properties[k]));
  return true;
}
export function normalizeDraft(d) {
  if (!matchesSchema(d, draftSchema)) throw Error('The draft could not be read. Please try again or check the draft file.');
  return { ...d, deficiencies: d.deficiencies.map(x => ({ ...x, selected: true })), clauses: d.clauses.map(x => ({ ...x, selected: false })) };
}
export function rawDraft(d) {
  return { ...d, deficiencies: d.deficiencies.map(({ selected, ...x }) => x), clauses: d.clauses.map(({ selected, ...x }) => x) };
}
export function blankDraft(job = {}) {
  return { job: Object.fromEntries(JOB_FIELDS.map(k => [k, job[k] || ''])), jobSources: [], summary: '', introduction: '', deficiencies: [], clauses: [], questions: [], conflicts: [] };
}
export function selectedDraft(d) {
  return { ...rawDraft(d), deficiencies: d.deficiencies.filter(x => x.selected).map(({ selected, ...x }) => x), clauses: d.clauses.filter(x => x.selected).map(({ selected, ...x }) => x) };
}
export function proposalText(d, internal = false) {
  const lines = ['FIRE DEFENSE EQUIPMENT CO.', 'QUOTE DRAFT — REVIEW BEFORE ISSUING', '',
    ...JOB_FIELDS.filter(k => d.job[k]).map(k => `${k.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${d.job[k]}`), '', d.introduction, '', 'SCOPE OF WORK'];
  d.deficiencies.filter(x => x.selected !== false).forEach((x, i) => lines.push(`${i + 1}. ${x.scope || [x.component, x.location, x.condition].filter(Boolean).join(' — ')}`));
  const sections = { notes: 'NOTES', quals: 'QUALIFICATIONS', resp: 'CUSTOMER RESPONSIBILITIES', incexc: 'INCLUSIONS / EXCLUSIONS' };
  for (const [key, label] of Object.entries(sections)) {
    const rows = d.clauses.filter(x => x.selected !== false && x.section === key);
    if (rows.length) lines.push('', label, ...rows.map(x => `${key === 'incexc' ? (x.mode === 'exc' ? 'Excluded: ' : 'Included: ') : ''}${x.text}`));
  }
  if (internal) lines.push('', 'INTERNAL REVIEW', d.summary, ...d.questions.map(q => `To confirm: ${q}`), ...d.conflicts.map(q => `Conflict: ${q}`), '', ...d.deficiencies.flatMap((x,i) => [`Item ${i + 1} source:`, ...x.sources.map(s => `${s.file}${s.page ? `, page ${s.page}` : ''}: ${s.excerpt}`)]));
  return lines.filter(x => x != null).join('\n');
}
export function mergeVerbiage(current, draft) {
  const next = structuredClone(current);
  next.job ||= {};
  const customer = [draft.job.customer, draft.job.site, draft.job.address].filter(Boolean).join(' — ');
  if (customer) next.job.customer = customer;
  if (draft.job.quoteNumber) next.job.quote = draft.job.quoteNumber;
  if (draft.introduction) next.job.intro = draft.introduction;
  next.sections ||= {};
  const add = (key, text, mode) => {
    next.sections[key] ||= [];
    const match = next.sections[key].find(x => x.text.trim().toLowerCase() === text.trim().toLowerCase());
    if (match) { if (key === 'incexc') match.mode = mode; else match.checked = true; }
    else next.sections[key].push(key === 'incexc' ? { text, mode } : { text, checked: true, subs: [] });
  };
  draft.deficiencies.forEach(x => { if (x.scope.trim()) add('scope', x.scope); });
  draft.clauses.forEach(x => add(x.section, x.text, x.mode));
  return next;
}

export function mergeQuoteFields(current, draft) {
  const next = structuredClone(current);
  const jobName = [draft.job.customer, draft.job.site, draft.job.address].filter(Boolean).join(' — ');
  if (jobName) next.fields.jobName = jobName;
  if (draft.job.quoteNumber) next.fields.quoteNo = draft.job.quoteNumber;
  return next;
}
