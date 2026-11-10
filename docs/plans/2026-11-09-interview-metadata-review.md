# Issue 15 EGM review

A targeted implementation-readiness pass used three fresh-context Goldfish reviewers, not a claim of completing the full five-stage EGM pipeline. Each reviewer confirmed reading its bundled persona and target. Readiness and codebase reviewers read the implementation-readiness standard plus their explicit repository source reading lists; style read the target alone. They did not access chat history or external URLs. Host instruction-file isolation was not independently established.

Target was the predecessor plan `2026-11-09-issue-15-interview-tags-and-docs.md` in the original checkout. Its decisions and precise implementation contracts are now consolidated in `2026-11-09-interview-metadata.md`. Reports returned as text because the reviewer personas require read-only behavior; the parent recorded them here.

## Findings and resolutions

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| IR-01 | Blocker | Taxonomy, multiplicity and document count were proposed, not approved. | User explicitly approved existing subteams, multiple tags and one document link. IDs are stored; display names remain adjustable for maintainer review. |
| IR-02 / CD-01 | Major | Missing exact file boundary and typed fixture changes. | Design names every source/test/migration/doc path, grouped into independently testable checkpoints. |
| IR-03 / CD-05 / STYLE-001 | Major | URL grammar, length, ports and normalization unspecified; FK deletion behavior missing. | Exact raw-input and canonical-storage grammar, 2048 limit, query/fragment removal and port handling documented and tested. Relation FKs cascade; retained inactive tags stay removable. |
| IR-04 / CD-02 | Major | Junction-table add/remove realtime behavior unchosen. | A fixed-search-path, execution-revoked trigger signals the existing parent applications stream. Real second-session tests cover both add/remove and unchanged status clock/history. |
| IR-05 / CD-04 | Major | Duplicate/absent no-op success conflicted with zero-row authorization detection. | Verify parent visibility through caller RLS first; then duplicate add/absent remove succeed. Nonexistent and unauthorized parent IDs share one error. |
| CD-03 | Major | Active choices and retained inactive tag reads/filters unspecified. | Active own-team editor choices; existing inactive tags loaded independently and removable; board tag-filter options include all team subteams and are independent of applicant ranking. |

These are author-approved defaults and implementation clarifications, not claims of Andy/Raghu approval. The rejected alternatives were unrestricted text tags (unstable filtering), overwriting a tag array (concurrent edits can erase another lead's tags), and using applicant preferences/final placement as interview tags (changes a different fact). This is an engineering rationale for the selected plan, not an upstream maintainer rejection.

## Validation record

Validated against an isolated Supabase instance on ports 545xx, with all migrations applied and generated types refreshed:

- `npm run verify`: type generation/checking, lint, and 535 tests across 40 suites passed.
- `npm run test:integration`: 199 tests across 12 suites passed. Its parallel run reported a worker-teardown warning; the full serial diagnostic run (`--runInBand --detectOpenHandles`) also passed all 199 tests without an open-handle report.
- `npm run build`: production compilation, type checking and route generation passed.
- `git diff --check`: passed.
- The real realtime test covers a changed-value control update followed by both tag addition and removal through another authorized client. An earlier local run timed out on the control update as well; subsequent focused and complete runs passed. This is recorded as a local startup/realtime reliability observation, not silently retried evidence of an unconditional guarantee.

The root agent manually reviewed the actions, URL boundary, database privileges/RLS, trigger, query embedding and UI integration. The independent implementation audit resumed and completed with no confirmed actionable finding; it reviewed tracked/untracked changes, callers, permissions, trigger behavior, concurrency, URL validation and read/UI integration, and passed 44 focused unit tests. Browser validation with Expect against the running local app confirmed: opening the detail view; adding WEB and NET tags together; removing NET while retaining WEB; normalizing a sharing URL to the canonical Docs link; persistence after reload; rejection of a non-Google host while retaining the draft; clearing the link; board filtering by WEB while still displaying all attached tags; next-applicant navigation retaining the filtered cohort; keyboard disclosure via Enter; and editor/input bounds fitting a 390px viewport. The existing Notes button remained available. Second-client realtime was verified by the database integration test, not by a second interactive browser session. Production migration/deployment and upstream maintainer approval have not been performed.


## Submission status

The implementation is committed on `codex/issue-15-interview-tags-doc-link`. A normal feature-branch push was attempted, but GitHub returned HTTP 403: account `beam-9` lacks write access to UBCSailbot/sailbotportal. No upstream branch or PR was created. Submission needs repository write access or a writable fork. The original prototype checkout remains untouched.
