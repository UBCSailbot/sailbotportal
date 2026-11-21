# Goldfish annotated review report — review fixes

Target: `docs/plans/2026-11-20-review-fixes.md`, full file. The user authorized fixing the review findings, completing checks and using the EGM review loop. In-scope document repairs and verification are handled under that task authorization; no remote publication or production operation is included.

Reviewers: bundled `implementation_readiness` and `codebase_details`, both mapped to `resources/document_standards/implementation-readiness-standard.md` in EGM 0.1.1. Direct dispatch uses new `fork_turns: none` agents each round. No parent transcript, private reasoning or memory is supplied. Each reviewer must read its persona, standard, target and explicit 14-file reading context. Host instruction-file exclusion is unverified. Failed reviewers must be retried once and recorded as not run if they fail again; they never count as clean.

The reading context is the new security migration; existing profiles, RLS and status-audit migrations; the metadata component and its tests; filter component and its tests; RLS and move-action integration tests; Supabase fixture helpers; metadata actions; board realtime hook; and metadata integration test. Paths are specified in the target plan. This is a focused document/code consistency loop, not a claim of completing every stage of the broader EGM feature pipeline.

## Round 1 — not clean

Target re-read immediately before dispatch: lines 1–55. Both reviewers completed and explicitly confirmed reading all required files. Both observed that validation is still in progress, not a claim of passed checks.

- Implementation Readiness: completed, no findings.
- Codebase Details: completed, one Major finding below; no other concrete code drift or functional gap.

### codebase_details-1-1 — Major

- Affected scope: target line 55, “refresh local submission artifacts,” and Exact write boundary at lines 41–47.
- Discrepancy: submission artifact writes were authorized without exact paths or Create/Modify/Delete actions. They were absent from the allowlist.
- Rationale: a fresh implementer would have to choose artifact files or exceed the documented boundary; the standard requires exact paths.
- AI suggestion: PROPOSE FIX.
- Resolution: applied within the user-approved repair scope. Add `Modify ../issue-15.patch`, `Modify ../issue-15.bundle` and `Modify ../issue-15-pull-request.md` as workspace-only handoff artifacts, generated from the final committed range without environment/credential files. They are not staged repository source.

The Major was raised before its repair, so round 1 is not clean. It must be rechecked; an applied fix does not settle a recurring finding. There are no contested, escalated or accepted-risk findings.

## Round 2 — clean

Target re-read before dispatch: lines 1–56. Both fresh-context reviewers completed and explicitly confirmed reading persona, standard, full target and all 14 supplied context files. Implementation Readiness reported no findings. Codebase Details reported no Blocker, Major or Nit findings and also verified the existing application-ID key. The artifact-path gap did not recur. This is the first consecutive clean round; convergence is not yet claimed.

## Round 3 — clean; converged

Target re-read before dispatch: lines 1–56. Both fresh-context reviewers completed and explicitly confirmed reading persona, standard, full target and all 14 supplied context files. Neither raised a Blocker, Major or Nit finding. Codebase Details additionally verified the application-ID key and build/verify script references. Rounds 2 and 3 are consecutive clean rounds, so this focused loop converged after three rounds, with no open finding or not-run reviewer. Six fresh reviewer runs completed in total. A separate code review follows this loop.

## Round 4 — clean on the revised editor contract

Target re-read before dispatch: lines 1–56. Both new reviewers completed and explicitly confirmed persona, standard, target and all 14 context reads. Neither raised Blocker, Major or Nit findings. This is the first clean round after the post-EGM save-ordering correction; a second is required before final convergence.

## Round 5 — clean; final editor contract converged

Target re-read before dispatch: lines 1–56. Both new reviewers completed with explicit persona, standard, target and all 14 context read confirmations. Neither raised Blocker, Major or Nit findings. Rounds 4 and 5 are consecutive clean rounds on the corrected save-ordering contract. Ten fresh reviewer runs completed across five rounds, with one document-boundary Major repaired and the separate code-review finding repaired and re-reviewed. A separate final code review follows this convergence.

## Verification in progress

The separate post-EGM code review reopened the editor repair: after saving B from A, a newer C could arrive without an exact B echo, leaving B permanently treated as dirty. It also identified C arriving before the action response. Classified PROPOSE FIX and applied: explicit dirty tracking cleared on success, plus observed-state identity so saved props received during a pending action take precedence over its older response, including URL changes away and back. Two new ordering tests failed before the correction; regression coverage was then expanded for the away/back case. The plan was updated before further review. Because code/contract changed after round 3, that convergence does not cover the final correction; two new consecutive clean rounds are required on the revised target, followed by code review again.

- Regression-first checks: the new UI assertions failed six cases before implementation; new database assertions failed five before the security migration.
- After fixes: 543 unit tests plus type checking/lint passed; focused RLS/status-action integration tests passed 50 cases before the additional null-assignment case was added.
- The intermittent realtime control timeout was reproduced after a healthy cold restart. The test now waits for both join acknowledgement and the observed PostgreSQL-subscription readiness system event. The corrected 13-case metadata suite passed warm and against a healthy cold restart, without raising timeouts, adding sleeps or retrying a failed assertion.
- Complete integration suite: 206/206 passed across 12 suites with `--runInBand --detectOpenHandles`, including the null-assignment guard test.
- Default `npm run build`: passed from a clean generated cache with the old server stopped. No dependency or build configuration change was needed.
- Browser checks and final code review remain pending. The migration has been applied only to the isolated local database. No production or remote operation occurred.

## Final code follow-up

The later code review identified a draft-loss case when a lead typed the previous URL before the save echo. Input changes now explicitly mark the draft dirty. Browser diagnostics also found signed-in tabs joining Realtime with anonymous claims. The hook now awaits session authentication, refreshes on database readiness, and ignores late events after unmount. These changes postdate round 5. Final automated verification passed 555 unit tests, 206 integration tests and the default production build.
