# Interview tags and Google Docs notes (issue 15)

Author: Beam Tantivongsakij
Status: Implementing; user approved existing-subteam tags, multiple tags, and one document link per per-team application.
Date: 2026-11-09

## Overview and scope

Leads need to identify the subteams interviewing an applicant and open their shared call notes. The existing status, applicant ranking and final placement are different facts. This change adds reviewer-managed tags and one optional Google Docs URL to the existing detail modal and board, while preserving all existing in-house notes, status values, status timestamps and question snapshots.

Use existing subteam IDs. Labels combine the uppercase team slug with its existing code, or uppercase name when no code exists: SOFT-WEB, SOFT-DEVOPS, MECH-HULL. The user approved this initial taxonomy; Andy/Raghu can review display naming in the PR without changing stored IDs. Tags remain until removed and do not change workflow status. Different teams' application rows remain separate and retain their existing access restrictions.

No document fetching, Google OAuth, document creation, sharing changes, generic tag registry, status changes, priority, scheduling, cross-team permissions expansion, or prototype redesign belongs to this change.

## Technical plan

`application_interview_tags(application_id, subteam_id)` has a composite primary key and cascading foreign keys. An index on subteam/application supports filtering. Authenticated callers may read/add/remove only through an authorized parent application. Adding requires an active subteam belonging to that parent's posting team, even for admins. Previously attached inactive tags remain readable/removable; active own-team choices appear in the editor. Filters include all of the board team's subteams so retained inactive tags are still findable. No tag UPDATE operation is exposed.

Applications gain nullable `interview_notes_url`. Existing rows start null. Portal actions use the authenticated caller's client, never the service role. First establish that the parent application is visible under RLS. Nonexistent and unauthorized IDs return the same error. A duplicate add and an already-absent removal then succeed idempotently; independent insert/delete operations preserve concurrent additions of other tags. A preexisting inactive tag can also be added again idempotently. Only the requested metadata changes.

The Google Docs input contract is:

- A string, trimmed, at most 2048 characters; blank clears to null.
- HTTPS on exactly docs.google.com, no credentials or nondefault port. Explicit port 443 normalizes to no port.
- Path `/document/d/ID` or `/document/u/N/d/ID`, optionally followed by `/edit`, `/view` or `/preview`, and an optional final slash. N is decimal digits; ID contains only ASCII letters, digits, underscore and dash.
- Query and fragment are discarded. Store `https://docs.google.com/document/d/ID/edit`, also at most 2048 characters.
- The database accepts only null or that canonical stored form. Action and rendering validation share a helper. Never render a corrupt stored value as an executable link.

Examples: a sharing URL ending in `/edit?usp=sharing#heading=abc` and `/document/u/0/d/abc/view` both store `/document/d/abc/edit`. HTTP, non-Docs hosts, host lookalikes, credentials, Sheets paths, arbitrary suffixes, and overlong values fail without being saved.

An AFTER INSERT/DELETE tag trigger issues a deliberate no-op status UPDATE on the parent application. The existing RLS-scoped, posting-filtered application realtime subscription therefore refreshes boards for both additions and removals. No relation-delete subscription or extra publication is needed. The trigger has a fixed empty search path, schema-qualified table access and revoked direct execution. Existing status triggers compare old/new status; tests verify status time and audit history do not change. Cascade deletes tolerate an already-removed parent.

Board queries embed all tag IDs and resolve subteam labels in a batch. Filtering adds a separate inner relationship alias, so filtering by one tag still returns all the candidate's tags. The new `interviewTag` UUID URL parameter is separate from the existing first-choice `subteam` parameter. Existing navigation calls the same board query and therefore preserves the filtered cohort. Board payloads do not add full answers or document URLs.

The detail read adds current tags, the document URL and active own-team tag options. The editor displays saved tags and an Open document link, with native disclosure for the editing forms. Edits have pending/error feedback, and failures preserve typed input. A key based on application ID resets unsaved draft state when navigating to another applicant. Existing NotesPanel remains in the header.

## Detailed implementation plan and file boundary

Database checkpoint:

- Create `supabase/migrations/20261109090000_interview_metadata.sql`: additive column, canonical URL constraint, tag relation/index/privileges/RLS, and parent realtime signal trigger.
- Modify `src/lib/supabase/types.ts`: regenerate from the migrated local database.
- Create `src/lib/applications/__tests__/interview-metadata.integration.test.ts`: real database/actions, permission failures, duplicates, concurrency, inactive tags, cascades, status/notes preservation and second-session realtime.

Read-path checkpoint:

- Modify `src/lib/applications/queries.ts`: card tags, tag UUID filter parsing/serialization, all-tags embedding plus distinct filter join, batched label resolution.
- Modify `src/lib/applications/detail.ts`: document URL, retained tag labels and active own-team edit choices.
- Modify `src/app/(admin)/admin/[team]/page.tsx`: supply the interview filter independently of applicant ranking and retain active-only first-choice options.
- Modify `src/components/board/card.tsx`: visibly distinguish interview tags from applicant preferences/placement.
- Modify `src/components/board/filter-bar.tsx`: tag filter, URL state and clear behavior.
- Modify `src/lib/applications/__tests__/queries.test.ts` and `navigation.test.ts`: filter shape, invalid UUID handling and round trips.
- Modify `src/lib/applications/__tests__/board-queries.integration.test.ts` and `detail.integration.test.ts`: actual relationship reads, retained inactive tags, all tags after filtering, scoped options and filtered neighbors.
- Modify `src/components/board/__tests__/board.test.tsx`, `columns.test.ts`, `moves.test.ts`: required tag fields in fixtures; preserve existing behavior.
- Create `src/components/board/__tests__/filter-bar.test.tsx`: nonranking-team tag filtering and clearing existing URL state.

Write/editor checkpoint:

- Create `src/lib/applications/interview-metadata.ts`: canonical URL parser and label formatter.
- Create `src/app/actions/set-interview-metadata.ts`: authenticated parent check; add/remove tag; save/clear document URL; board/detail revalidation. Arguments are untrusted runtime values, not trusted merely because TypeScript types them.
- Create `src/components/application/interview-metadata.tsx`: accessible summary and edit forms with no new dependency.
- Modify `src/components/application/application-detail.tsx`: mount the editor while retaining notes, answers, resume and navigation.
- Create `src/lib/applications/__tests__/interview-metadata.test.ts`: URL boundaries, normalization, non-string values and labels.
- Create `src/components/application/__tests__/interview-metadata.test.tsx`: add/remove, retained inactive tags, safe link rendering, failure preservation and clearing.
- Modify `src/components/application/__tests__/application-detail.test.tsx`: new fields and server-action/router boundaries; retain notes/header coverage.
- Create this design and `docs/plans/2026-11-09-interview-metadata-review.md`: decisions and review findings for the issue PR.

No source change to `navigation.ts` is necessary because its cohort already comes from getBoardApplications. No client realtime change is necessary because the parent signal reuses the existing subscription.

## Verification and rollout

Run `npm run verify`, the full `npm run test:integration` suite against real local Supabase, and `npm run build`. Browser-check saved data after reload, tag filtering and next/previous navigation, document open/clear, unchanged in-house notes, keyboard/mobile use and another lead's refresh. Test fixtures use their own generated teams/users and clean up only those records.

Implementation lives in a separate local clone on `codex/issue-15-interview-tags-doc-link`; the managed worktree service did not return a checkout and was cancelled after verifying it created none. Earlier design/prototype files are not copied or staged. Test Supabase uses a private scratch project and ports 545xx, leaving the earlier demo services on 544xx alone. Local environment values are ignored and never staged.

Review the exact issue diff, commit scoped files, and push the feature branch using authorized write credentials, or submit from a personal fork if upstream write remains unavailable. Open a PR to UBCSailbot/sailbotportal:main with `Closes #15`; have the designated maintainer review tag naming and behavior. Green checks and review precede merge. Do not merge or deploy as part of an unreviewed change. Apply the additive migration before application code depends on it; reverting application code can leave the unused schema in place. Production migration credentials and deployment automation still require confirmation.
