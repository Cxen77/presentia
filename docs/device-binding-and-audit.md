# Device binding and post-session review

Apply `supabase/migration_008_device_binding_audit.sql` after migrations 000–007,
then deploy the backend and updated clients together. The migration preserves
legacy sessions' review contract; new sessions require the deferred audit.
All new tables have RLS enabled and are backend-only. No frontend can write
device ownership, findings, jobs, or review events.

## Student workflow

After an authenticated student has a profile, the app registers a random UUID
installation ID. Native apps persist it in Expo SecureStore, using a device-only
iOS keychain accessibility class. Logout never clears it. Multiple installations
may belong to one student; a unique primary key prevents cross-account ownership.
Registration is transactional and never transfers an existing installation.
Conflicts are recorded; attendance is blocked until an administrator resolves them.
The browser uses localStorage, a weaker browser-installation signal.

Scanning and submission obtain fresh foreground Expo Location fixes only within
check-in. There is no startup or background location scan. The actual `mocked`
boolean is preserved; omitted status, failed fixes, and unavailable accuracy become
unknown, never "safe." Campus-restricted classes reject unverifiable/mock fixes
and persist the blocked attempt. With campus restrictions off, unknown or mocked
fixes remain pending and require reasoned faculty review after the audit.
Developer Options are not treated as proof of mock location.

The signed three-minute scan ticket binds student, QR, session, location evidence,
and installation. Private Cloudinary upload authorization requires that ticket
and an active registered installation. New selfie public IDs also contain the
session ID; a verified receipt from another student/session is rejected.
The database still enforces one attendance row per student/session. A row-level
session lock serializes submissions with session close and final confirmation.

## Deferred audit

Closing check-in creates one persistent job through a database trigger. Starting
another session also closes/enqueues prior active sessions. `POST /api/sessions`
accepts optional `collectionMinutes` (1–180); its absolute deadline is enforced on
inserts and swept without requiring an open faculty browser. Existing sessions
without a deadline close through the teacher's End session action.

Render wakes the worker on close/start and at startup. A lightweight 60-second
recovery/deadline tick resumes interrupted jobs; portal reads never enqueue work.
Each claim reads at most 30 rows, uses indexed device/session queries, and saves
findings plus a UUID cursor transactionally. There is a two-minute lease, SKIP
LOCKED claiming, and a fencing token: an expired/stale worker cannot save a batch.
Each wake handles at most four batches; larger classes resume on the next tick.
Failures retain progress and retry after 60 seconds, increasing up to 15 minutes.
An empty final batch marks the job complete. Completed jobs are not rerun by refresh.

Device ownership/status, cross-account installation reuse, mock-location status,
and photo comparison are separate findings. No image is downloaded or compared in
the synchronous submit route. The default photo stage is **faculty review required**;
it never invents a face match or liveness result.

`PhotoVerificationProvider` in `backend/src/services/proxySignals.ts` is the
adapter contract. A reviewed server-only adapter can be supplied to
`startProxyAuditWorker(provider)` and `wakeProxyAudit(provider)`; use the same
adapter for both entry points. No paid service/model is installed or enabled.
Adapters receive bounded signed delivery URLs, must honor the AbortSignal, and
must finish within two seconds per photo pair (otherwise the batch retries).
Check costs, consent, thresholds, retention and Render resources before enabling
one. A match never clears device/mock flags and does not establish liveness.

## Faculty and admin actions

The existing photo cards show a **Verification details / Signal review required**
disclosure with device status, mock status, reasons and comparison status. After
the audit, flagged signal cases require a confirm/reject decision and a 5–500
character reason. The backend records reviewer, timestamp, decision, findings,
and reason. Class confirmation is blocked until the audit completes and flagged
decisions agree with the teacher's inclusion/exclusion choices. Normal manual
photo reviews can still use the existing bulk confirmation. Selfies are deleted
through the existing retryable cleanup after final confirmation; findings/review
history and original profile photos are retained.

Under **People & access → Students → expand student → Manage devices**, the
single admin can inspect devices/conflicts, revoke/restore a device, or explicitly
transfer it to a verified student. A reason is mandatory, and an append-only
ownership event records old/new owners and actor. Teachers/students cannot invoke
this process. A phone replacement normally needs no transfer: the new installation
registers automatically to the same authenticated student.

Installation IDs are resettable/spoofable signals, not hardware identities.
Reinstalling/clearing browser storage can mint a new ID; iOS keychain persistence
may survive reinstall. Platform mock-location flags do not catch every workaround.
Technical failures and suspicious signals are not a finding of fraud.

## Verification and Android builds

Run root/backend/portal typechecks, root/backend test suites, portal build/lint,
Expo lint, and Expo Doctor. The opt-in integration test creates disposable
accounts/classes and real private Cloudinary test uploads; it deletes its own
fixtures afterward. Use a dedicated local backend with workers disabled by
`NODE_ENV=test` so lease/retry tests control job progress:

```powershell
# backend/ — after npm run build; uses ignored backend/.env
$env:NODE_ENV='test'; $env:PORT='4010'; node dist/server.js
# Separate backend/ terminal
$env:PRESENTIA_RUN_INTEGRATION='1'
node --test tests/deviceAudit.integration.cjs
```

The integration suite covers multiple legitimate devices, conflicting ownership,
RLS/RPC denials, simultaneous signed uploads and duplicate submissions, mock/unknown
locations, session-bound receipts, concurrent claims, failed-job recovery, expired
deadlines, closure racing submissions, reasoned review and idempotent confirmation.
Its synthetic photos test transport/review plumbing, not biometric accuracy.

SecureStore adds a native dependency. Produce a new Android development/release
build using the existing EAS workflow before distributing this client; an old APK
cannot acquire a native module through an OTA JS update. No generated native files
are edited. Native SecureStore persistence and genuine mocked-location behavior
still require testing on a physical Android device; browser/integration tests do
not establish those properties.
