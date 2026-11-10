export type InterviewNotesUrlResult =
  { ok: true; url: string | null } | { ok: false; error: string };

export function parseInterviewNotesUrl(value: unknown): InterviewNotesUrlResult {
  if (typeof value !== 'string') return { ok: false, error: 'Enter a Google Docs document link.' };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, url: null };
  if (trimmed.length > 2048) return { ok: false, error: 'The document link is too long.' };
  const invalid = {
    ok: false as const,
    error: 'Enter a Google Docs document link starting with https://docs.google.com/document/.',
  };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalid;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'docs.google.com' ||
    url.port ||
    url.username ||
    url.password
  )
    return invalid;
  const match =
    /^\/document\/(?:u\/[0-9]+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview))?\/?$/.exec(
      url.pathname,
    );
  if (!match) return invalid;
  const canonical = `https://docs.google.com/document/d/${match[1]}/edit`;
  return canonical.length <= 2048
    ? { ok: true, url: canonical }
    : { ok: false, error: 'The document link is too long.' };
}

export function interviewTagLabel(
  tag: { name: string; code: string | null },
  teamSlug: string,
): string {
  return `${teamSlug.toUpperCase()}-${(tag.code || tag.name).toUpperCase()}`;
}
