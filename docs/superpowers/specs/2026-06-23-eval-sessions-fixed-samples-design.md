# Session-based Evaluation + Fixed Samples + Dataset Admin Gate — Design

Date: 2026-06-23

## Goal

Make MOS/CMOS evaluation **session-based**: a user must complete a full session of
N ratings before any result is recorded. Abandoning mid-session records nothing.
Each session always includes a set of admin-chosen **fixed (anchor) samples** plus
random fill. The eval UI shows each sample's text, a progress indicator, a
pre-session notice, and a leave warning. The Dataset tab gets a basic admin gate
and a control to mark/unmark fixed samples.

## Confirmed decisions

- **Persistence:** client buffers answers; the full batch is committed once at the
  end (atomic, all-or-nothing). Abandon = never submitted = nothing saved.
- **Session size:** configurable via backend config, default `N = 20`. Fixed count
  is data-driven (however many samples admin marks), capped at N.
- **Modes:** MOS and CMOS each run as their own separate session.
- **Admin auth:** frontend-only password gate (password `admin`). Acknowledged that
  the password is visible in the client bundle — basic gate, not real security.
- **Style:** preserve existing CSS/UI; reuse existing components. Backend logic may
  change freely.

## 1. Backend — data model

### 1.1 `Sample` — add fixed flag
`app/models_eval.py`: add `is_fixed: bool = Field(default=False, index=True)`.

### 1.2 New `EvalSession` table
```python
class EvalSession(SQLModel, table=True):
    __tablename__ = "eval_sessions"
    id: str = Field(primary_key=True)            # opaque token, e.g. "es_..."
    client_session_id: str = Field(index=True)   # localStorage session id
    kind: str = Field(index=True)                # 'mos' | 'cmos'
    size: int
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)
```

### 1.3 `Trial` — link to session
Add `eval_session_id: str | None = Field(default=None, index=True)` to `Trial`.
The existing `consumed` flag is reused (set true on completion).

### 1.4 Migration
`app/db.py`: extend the existing idempotent migration approach. After
`create_all`, ensure legacy DBs get the new columns:
- `ALTER TABLE samples ADD COLUMN is_fixed` (default 0) if missing.
- `ALTER TABLE trials ADD COLUMN eval_session_id` if the `trials` table exists
  without it.
`eval_sessions` is created by `create_all` on fresh and existing DBs.

### 1.5 Config
`app/config.py` + `.env.example`: add `eval_session_size: int = 20`.

## 2. Backend — session service & endpoints

Replace the per-trial next/submit flow with two endpoints. Logic lives in
`EvalService` (extended); schemas in `app/schemas_eval.py`.

### 2.1 `POST /api/eval/session/start`
Request: `{kind: 'mos'|'cmos', client_session_id: str}`.
Steps:
1. Build N items via the session builder (§2.3).
2. Insert one `EvalSession` row (`completed=False`, `size=len(items)`).
3. Insert N `Trial` rows (kind, sample_id, model_id for MOS / model_slot1+slot2
   for CMOS, `eval_session_id`, `session_id=client_session_id`, `consumed=False`).
4. Return:
```
{ eval_session_id, kind, size, items: [...] }
```
- MOS item: `{trial_id, sample_id, text, audio_url}`
- CMOS item: `{trial_id, sample_id, text, slot1_url, slot2_url}`
  (frontend keeps its existing A/B randomization per item).

Model identity is never returned — same blind/anti-tamper property as before
(client only ever sees `trial_id` + audio URLs).

### 2.2 `POST /api/eval/session/complete`
Request:
```
{ eval_session_id, client_session_id,
  answers: [ {trial_id, score} ... ]            # MOS
          | [ {trial_id, choice} ... ] }        # CMOS, choice in slot1|slot2|same
```
Validation (any failure → raise, write nothing):
- Session exists, `kind` matches, `client_session_id` matches, not already
  `completed`.
- `len(answers) == session.size`.
- Every `trial_id` belongs to this `eval_session_id`, is unconsumed, and each
  trial is answered exactly once (no duplicates / no foreign trials).
- Each `score` in the valid MOS band; each `choice` in `{slot1, slot2, same}`.

On success, inside one transaction:
- Insert all `MosScore` / `CmosScore` rows.
- Mark every trial `consumed=True`.
- Mark session `completed=True`.
- Commit once.

Response: `{ ok: true }`.

### 2.3 Session builder
Pool = samples that have the required audio:
- MOS: samples with ≥1 `Audio` row.
- CMOS: samples with ≥2 distinct model audios (so at least one pair exists).

Selection:
- `fixed_pool` = samples in the pool with `is_fixed=True`.
- `random_pool` = pool minus fixed.
- If `len(fixed_pool) >= N`: take a random N-subset of fixed; no random fill.
- Else: take all fixed + random fill `N - len(fixed_pool)` from `random_pool`.
- If total pool `< N`: session size = pool size (graceful; builder uses what's
  available).
- Per sample, pick the model (MOS) / model pair (CMOS) using the existing
  exposure-balancing helper (`_pick_least_voted`) over committed score counts, so
  abandoned trials never skew balancing. Each chosen sample appears once.

### 2.4 Removed
Old endpoints `GET /api/eval/mos/next`, `GET /api/eval/cmos/next`,
`POST /api/eval/mos/submit`, `POST /api/eval/cmos/submit` and their
`EvalService` methods (`next_mos`, `submit_mos`, `next_cmos`, `submit_cmos`) are
removed — directly replaced by start/complete; the frontend was the only consumer.
Kept: `mos_results`, `cmos_results`, and helpers `_pick_least_voted`,
`_consume_trial` semantics (folded into completion), `_recent_samples` (used by
the builder to avoid repeats within a session if needed).

## 3. Backend — dataset fixed toggle

`app/routers/dataset.py` + `DatasetService`:
- `PATCH /api/dataset/samples/{sample_id}/fixed` body `{is_fixed: bool}` →
  set `Sample.is_fixed`, return the updated `DatasetSample`.
- Add `is_fixed` to the `DatasetSample` schema and to `list_samples` output.
- Optional query `?fixed_only=true` on `GET /api/dataset/samples`.

No auth on this endpoint (the gate is the client-side admin modal, per decision).

## 4. Frontend — eval page

`src/pages/EvaluationPage.tsx` + `src/services/eval.service.ts` +
`src/types/eval.types.ts`. Reuse existing `AudioPlayer`, `ScoreSelector`,
`ComparisonSelector`, `PrimaryButton`, `SectionContainer`.

State machine per mode: `idle → notice → in_progress → submitting → done`.
- **idle/notice:** show a notice card/modal — *"Phiên đánh giá gồm N câu. Bạn phải
  hoàn thành tất cả thì kết quả mới được ghi nhận."* with a **Bắt đầu** button.
  No trials load until started.
- **start:** call `session/start`; store `eval_session_id`, `items`, set cursor 0,
  init empty answers buffer. For CMOS, randomize each item's slot→A/B mapping
  (reuse existing `trialDisplayMap` logic, keyed by trial_id).
- **in_progress:** render current item — show **sample text**, audio player(s),
  score/comparison selector, and **progress "Câu X / N"**. On submit of the
  current item: push `{trial_id, score|choice}` into the buffer, advance cursor.
  Require audio played + an answer selected (existing gating rules).
- **last item → submitting:** auto-call `session/complete` with the full buffer.
- **done:** show "Kết quả đã được ghi nhận" + **Bắt đầu phiên mới** button (resets
  to notice).
- **Leave warning:** while `in_progress` (incomplete), add a `beforeunload`
  listener so the browser warns on tab close/refresh (native dialog; text not
  customizable in modern browsers). Switching MOS↔CMOS mid-session shows an in-app
  `confirm()` first; confirming discards the current session (nothing saved).

Service: replace `getNextMosSample/submitMosScore/getNextCmosSample/
submitCmosChoice` with `startSession(kind)` and `completeSession(payload)`. Keep
the mock fallback (when `VITE_API_BASE_URL` is empty) by generating a local
N-item session and accepting the completion as a no-op.

## 5. Frontend — dataset admin gate + fixed toggle

`src/dataset/dataset-content.tsx` (+ a small `AdminGate` component).
- **Gate:** on mount, read `sessionStorage["dataset_admin_ok"]`. If absent, render
  the page content blurred (`blur-sm pointer-events-none select-none`) behind a
  modal asking for the password. Submitting `admin` sets the flag and reveals the
  page; any other value keeps it blurred and shows an inline error.
- **Fixed toggle:** each sample row gets a star/checkbox bound to `is_fixed`,
  calling `dataset.service.setFixed(id, is_fixed)` →
  `PATCH /api/dataset/samples/{id}/fixed`; optimistic UI update with revert on
  error. Add an optional "Chỉ hiện câu cố định" filter chip.
- Service + types: add `is_fixed` to `DatasetSample`, add `setFixed`, extend the
  mock to toggle locally.

## 6. Testing

Backend (pytest):
- Builder: includes all fixed samples and fills to N; honors fixed-subset when
  `fixed > N`; degrades to pool size when `pool < N`.
- `complete`: writes all scores + marks session/trials, atomic; rejects (writes
  nothing) when answers count ≠ size, when a trial is foreign/duplicate, when
  already completed, when client_session mismatches.
- Fixed toggle endpoint sets and returns `is_fixed`; `fixed_only` filter works.
- Migration adds `samples.is_fixed` and `trials.eval_session_id` to legacy DBs.

Frontend:
- `npm run build` type-checks clean.
- Manual: notice → progress → complete → results recorded; abandon (close before
  finishing) → nothing recorded; admin gate blocks until `admin` entered; fixed
  toggle persists and affects subsequent sessions.

## Out of scope

- Server-side pending/resume of in-progress sessions (client buffer only).
- Real authentication / authorization (basic client gate only).
- A combined MOS+CMOS session (each mode is separate).
- Cleanup job for abandoned `EvalSession`/`Trial` rows (harmless; ignored by
  results and balancing).
