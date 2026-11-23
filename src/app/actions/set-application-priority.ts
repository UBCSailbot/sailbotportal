'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { APPLICATION_PRIORITIES } from '@/lib/applications/queries';

/**
 * Sets one application's priority, or clears it with `null`.
 *
 * Same shape as `moveApplication`, for the same reasons: it runs as the caller,
 * so the RLS policy "leads update own team applications" decides which rows
 * exist to be updated, and the arguments are treated as hostile because a
 * server action is a public endpoint whoever calls it.
 *
 * The check constraint on `applications.priority` is the real enforcement. The
 * check below only turns a bad value into a plain sentence rather than a
 * Postgres constraint message.
 *
 * Writes no `application_events` row. Priority is a working label that changes
 * often, and the audit trigger only fires on status changes.
 */

export type SetPriorityResult = { ok: true } | { ok: false; error: string };

const VALID_PRIORITIES: readonly (string | null)[] = [...APPLICATION_PRIORITIES, null];

/**
 * @param applicationId application who's priority we are setting
 * @param priority      priority the application will be set to (null for none)
 * @param teamSlug      team the application belongs to
 */
export async function setApplicationPriority(
  applicationId: string,
  priority: string | null,
  /** The board to refresh. Comes from the route, not from the caller's claim. */
  teamSlug: string,
): Promise<SetPriorityResult> {
  if (!VALID_PRIORITIES.includes(priority)) {
    return { ok: false, error: 'Priority is unrecognized' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session has expired. Sign in again.' };

  // Read back for the same reason as a move: an UPDATE that RLS filters down to
  // nothing reports success having changed zero rows.
  const { data, error } = await supabase
    .from('applications')
    .update({ priority })
    .eq('id', applicationId)
    .select('id');

  if (error) {
    console.error('[board] priority change failed', { applicationId, message: error.message });
    return { ok: false, error: 'Could not change this priority. Try again.' };
  }

  if (!data || data.length === 0) {
    // Not distinguished from "not yours", as in `moveApplication`.
    return { ok: false, error: 'Application not found on board' };
  }

  // Both places a priority is shown: the board's card and the detail view.
  revalidatePath(`/admin/${teamSlug}`);
  revalidatePath(`/admin/${teamSlug}/applications/${applicationId}`);
  return { ok: true };
}
