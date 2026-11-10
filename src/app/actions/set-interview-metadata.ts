'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  parseInterviewNotesUrl,
  type InterviewNotesUrlResult,
} from '@/lib/applications/interview-metadata';

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

async function applicationClient(applicationId: string, teamSlug: string) {
  if (
    !isUuid(applicationId) ||
    typeof teamSlug !== 'string' ||
    !/^[a-z0-9-]{1,64}$/.test(teamSlug)
  ) {
    return { ok: false as const, error: 'That application is not available.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Your session has expired. Sign in again.' };
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .maybeSingle();
  if (error || !data) return { ok: false as const, error: 'That application is not available.' };
  return { ok: true as const, supabase };
}

function refresh(applicationId: string, teamSlug: string) {
  revalidatePath(`/admin/${teamSlug}`);
  revalidatePath(`/admin/${teamSlug}/applications/${applicationId}`);
}

export async function addInterviewTag(
  applicationId: string,
  subteamId: string,
  teamSlug: string,
): Promise<Result> {
  if (!isUuid(subteamId)) return { ok: false, error: 'Choose a subteam from this team.' };
  const access = await applicationClient(applicationId, teamSlug);
  if (!access.ok) return access;
  // Check the relation, not the affected-row count: adding an existing tag is successful too.
  const existing = await access.supabase
    .from('application_interview_tags')
    .select('subteam_id')
    .eq('application_id', applicationId)
    .eq('subteam_id', subteamId)
    .maybeSingle();
  if (existing.error) return { ok: false, error: 'Could not load interview tags. Try again.' };
  if (!existing.data) {
    const { error } = await access.supabase
      .from('application_interview_tags')
      .upsert(
        { application_id: applicationId, subteam_id: subteamId },
        { onConflict: 'application_id,subteam_id', ignoreDuplicates: true },
      );
    if (error)
      return {
        ok: false,
        error: 'Could not add this tag. Choose an active subteam from this team.',
      };
  }
  refresh(applicationId, teamSlug);
  return { ok: true };
}

export async function removeInterviewTag(
  applicationId: string,
  subteamId: string,
  teamSlug: string,
): Promise<Result> {
  if (!isUuid(subteamId)) return { ok: false, error: 'Choose a subteam from this team.' };
  const access = await applicationClient(applicationId, teamSlug);
  if (!access.ok) return access;
  const { error } = await access.supabase
    .from('application_interview_tags')
    .delete()
    .eq('application_id', applicationId)
    .eq('subteam_id', subteamId);
  if (error) return { ok: false, error: 'Could not remove this tag. Try again.' };
  refresh(applicationId, teamSlug);
  return { ok: true };
}

export async function saveInterviewNotesUrl(
  applicationId: string,
  value: string,
  teamSlug: string,
): Promise<InterviewNotesUrlResult> {
  const parsed = parseInterviewNotesUrl(value);
  if (!parsed.ok) return parsed;
  const access = await applicationClient(applicationId, teamSlug);
  if (!access.ok) return access;
  const { data, error } = await access.supabase
    .from('applications')
    .update({ interview_notes_url: parsed.url })
    .eq('id', applicationId)
    .select('id');
  if (error) return { ok: false, error: 'Could not save the document link. Try again.' };
  if (!data?.length) return { ok: false, error: 'That application is not available.' };
  refresh(applicationId, teamSlug);
  return parsed;
}
