# AI Quote Assistant — activation

The Quick Hub card, upload/review workspace, manual drafting, device saves, draft downloads, printing, and reviewed transfer to the quote tools work from GitHub Pages. Live AI analysis needs the included Firebase function deployed and an OpenAI API key configured. Until the authenticated health check succeeds, the page explicitly shows **Setup needed** and disables Analyze.

## Activate the secure service

Use a local checkout of QUICK-HUB, Node.js 22, Firebase CLI, and a Firebase account authorized to deploy functions and manage secrets for `fire-defense-itm-reports`. The Firebase project must support Cloud Functions deployment and associated billing. Configure API billing/usage for the OpenAI project that owns your key. Do not paste a key into GitHub, this page, or chat.

From the repository folder:

```sh
cd ai-quote-assistant
npm --prefix functions ci
firebase login
firebase functions:secrets:set OPENAI_API_KEY --project fire-defense-itm-reports
firebase deploy --only functions:ai-quote-assistant --config firebase.json --project fire-defense-itm-reports
```

The secret command prompts for the key privately. The deploy may request permission to enable the required Google Cloud APIs and prompt for `AI_QUOTE_MODEL` (default `gpt-4.1`) and `AI_QUOTE_ORIGINS` (default `https://302stang86.github.io`). The model must accept PDF/image inputs and strict structured output. If your company uses a different hub origin, set the origin parameter to that exact HTTPS origin (comma-separated when there are several). Never use `*`.

This isolated deployment config contains only the `ai-quote-assistant` function codebase. It does not deploy hosting, production Firestore rules, indexes, or existing functions in another codebase. Keep using the existing GitHub Pages root. Check the deployment preview before accepting any proposed removal of unrelated functions.

The resulting function URL should be:

`https://us-central1-fire-defense-itm-reports.cloudfunctions.net/aiQuoteAssistant`

If Firebase returns a different URL, update the public `endpoint` in `config.js`. This file contains only a URL, never a secret. Reload the Assistant, sign in as a manager/admin, and click **Check connection**. A successful authenticated health check changes the status to **AI connected**.

## Access and usage controls

- The home card and page use the existing `quoting` permission, restricted further to manager/admin roles. The backend independently verifies the Firebase ID token (including revocation) and reads the current user and `config/permissions` records on every request.
- Existing designated administrator emails and administrator roles retain the same overrides as the hub. Anonymous users and ordinary unapproved users cannot analyze reports.
- Only managers with an approved profile and permission to use `quoting` can use the manager route. Other roles remain blocked even if assigned quoting access.
- The service stores only counters in `aiQuoteUsage`, not uploaded PDFs, pasted notes, or draft content. Ensure your **existing live Firestore rules do not allow client reads or writes to `aiQuoteUsage`**. With a default-deny ruleset and no wildcard grant this requires no change. If you have broad wildcard allows, narrow them: a specific deny cannot override another matching allow. This repository deliberately does not replace live company rules.
- Limits: five PDFs, 8 MB per PDF, 12 MB combined; 40,000 note characters; one request per 30 seconds; 20 attempted analyses per user per UTC day; 100 per company per UTC day. Attempted requests count even if the provider fails. These are request limits, not guaranteed dollar spending caps. Set and monitor your OpenAI project budget/usage controls and Google Cloud billing alerts as appropriate.
- Files are sent inline to OpenAI with `store: false`; application code does not persist them or log report contents. Provider-side data retention remains subject to your OpenAI account's settings and applicable policy. Device drafts contain extracted customer information and source excerpts; they are saved only when the user explicitly chooses Save on device or Download draft. Device saves are keyed by Firebase UID. Clear workspace removes that account's device draft.
- Cancelling in the browser stops waiting; a server/provider request that already started may still finish and incur usage.

## User workflow

1. Open **AI Quote Assistant** from Quick Hub. Choose repair, annual ITM, installation, backflow, or fire alarm.
2. Add known job details, paste technician notes, and attach PDFs for one job. Agree to send the material and click Analyze.
3. Review extracted facts, source pages/excerpts, missing details, conflicts, scope and quantities. Suggested FDEC clauses are initially unselected. Select only applicable wording. Priority is copied from a source, not assigned by AI.
4. Check the review box and send selected items to the quote. The destination asks you to apply the draft explicitly. Sprinkler scopes and selected wording are added to the corresponding verbiage tab; supplied job identifiers update the quoting template. Existing material costs, rates, labor hours, pricing and other selected wording are preserved. No material bill of quantities is inferred from a deficiency count.
5. Fire alarm transfer adds custom deficiency rows and supplied job details. Each selected fire alarm finding must have a confirmed positive whole-number quantity. Existing rates and priced rows remain unchanged; new rows are unpriced. Selected additional clauses are retained in the fire alarm draft and included in generated deficiency wording.
6. Complete estimates, check all selected terms, and use the existing quote tools to save to Administration or export your final proposal.

The report date is kept separate from the quote date. Source excerpts and internal questions do not appear in customer wording. Printed assistant output is clearly labeled a draft and contains selected scope/clauses only. Quantities and other facts mentioned in a generated scope sentence must also be reviewed when editing the structured fields.

Transfer packets are held in session storage, are restricted to the signed-in UID, and expire after 30 minutes. A session recovery copy is made before applying to an existing quote (`fdec_ai_quote_backup_<uid>` or `fdec_ai_alarm_backup_<uid>`). It is not a replacement for saving your current quote. Uploads are held only in memory; reattach them after reopening a saved draft to open source-page links.

## Verification

From the repository root, run:

```sh
node --test ai-quote-assistant/tests/*.test.mjs
```

These dependency-free tests exercise access checks, upload limits, structured results, provider failure handling, usage enforcement, and preservation of existing quote sections during transfer. They do not call a paid API or a production Firebase database.

After activation, test an actual signed-in manager and admin, a denied account, a text PDF, a scanned report, and transfer into a saved example quote. Verify the deployed function's logs contain no uploaded document content. Live AI accuracy and production permissions must be verified with your reports after deployment.

## References

- [OpenAI PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Firebase secrets and parameters](https://firebase.google.com/docs/functions/config-env)
- [Firebase HTTP functions](https://firebase.google.com/docs/functions/http-events)
