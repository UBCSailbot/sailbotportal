'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  addInterviewTag,
  removeInterviewTag,
  saveInterviewNotesUrl,
} from '@/app/actions/set-interview-metadata';
import { interviewTagLabel, parseInterviewNotesUrl } from '@/lib/applications/interview-metadata';
import type { BoardSubteam } from '@/lib/applications/queries';

const control =
  'rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50';

export function InterviewMetadata({
  applicationId,
  teamSlug,
  initialTags,
  tagOptions,
  initialNotesUrl,
}: {
  applicationId: string;
  teamSlug: string;
  initialTags: BoardSubteam[];
  tagOptions: BoardSubteam[];
  initialNotesUrl: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState('');
  const [draftUrl, setDraftUrl] = useState(initialNotesUrl ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const available = tagOptions.filter((option) => !initialTags.some((tag) => tag.id === option.id));
  const link = parseInterviewNotesUrl(initialNotesUrl ?? '');

  async function changeTag(subteamId: string, remove: boolean) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const result = await (remove ? removeInterviewTag : addInterviewTag)(
        applicationId,
        subteamId,
        teamSlug,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected('');
      setMessage(remove ? 'Interview tag removed.' : 'Interview tag added.');
      router.refresh();
    } catch {
      setError('Could not update interview tags. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function saveDocument(value: string) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const result = await saveInterviewNotesUrl(applicationId, value, teamSlug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraftUrl(result.url ?? '');
      setMessage(result.url ? 'Document link saved.' : 'Document link cleared.');
      router.refresh();
    } catch {
      setError('Could not save the document link. Try again.');
    } finally {
      setPending(false);
    }
  }

  function addTag(event: FormEvent) {
    event.preventDefault();
    if (selected) void changeTag(selected, false);
  }
  function saveLink(event: FormEvent) {
    event.preventDefault();
    void saveDocument(draftUrl);
  }

  return (
    <section aria-label="Interview details" className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Interview details</h2>
        {link.ok && link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Open interview notes in Google Docs
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-muted-foreground">
        Interview tags:{' '}
        {initialTags.length
          ? initialTags.map((tag) => interviewTagLabel(tag, teamSlug)).join(', ')
          : 'None yet'}
      </p>
      <details className="mt-3">
        <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
          Edit interview details
        </summary>
        <fieldset disabled={pending} className="mt-4 grid gap-4 disabled:opacity-70">
          <div>
            <p className="text-muted-foreground">
              Choose the subteams interviewing this applicant. Tags do not change their hiring
              stage.
            </p>
            {initialTags.length ? (
              <ul aria-label="Interview tags" className="mt-2 flex flex-wrap gap-2">
                {initialTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
                  >
                    <span>{interviewTagLabel(tag, teamSlug)}</span>
                    <button
                      type="button"
                      onClick={() => void changeTag(tag.id, true)}
                      aria-label={`Remove ${interviewTagLabel(tag, teamSlug)} tag`}
                      className="rounded-sm px-2 py-1 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form onSubmit={addTag} className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={`interview-tag-${applicationId}`} className="mb-1 block">
                  Interviewing subteam
                </label>
                <select
                  id={`interview-tag-${applicationId}`}
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  className={`w-full ${control}`}
                >
                  <option value="">Choose a subteam</option>
                  {available.map((option) => (
                    <option key={option.id} value={option.id}>
                      {interviewTagLabel(option, teamSlug)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={!selected || pending} className={control}>
                Add tag
              </button>
            </form>
          </div>
          <form onSubmit={saveLink}>
            <label htmlFor={`interview-doc-${applicationId}`} className="mb-1 block">
              Google Docs interview notes link
            </label>
            <input
              id={`interview-doc-${applicationId}`}
              type="url"
              value={draftUrl}
              maxLength={2048}
              onChange={(event) => setDraftUrl(event.target.value)}
              aria-describedby={`interview-doc-help-${applicationId}`}
              className={`w-full ${control}`}
              placeholder="https://docs.google.com/document/d/…/edit"
            />
            <p id={`interview-doc-help-${applicationId}`} className="mt-2 text-muted-foreground">
              The document’s sharing settings control who can open it. Existing portal notes are
              kept separately.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="submit" className={control}>
                Save link
              </button>
              <button
                type="button"
                disabled={!initialNotesUrl && !draftUrl}
                onClick={() => void saveDocument('')}
                className={control}
              >
                Clear link
              </button>
            </div>
          </form>
        </fieldset>
      </details>
      {pending ? (
        <p role="status" className="mt-2">
          Saving interview details…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-2">
          {message}
        </p>
      ) : null}
    </section>
  );
}
