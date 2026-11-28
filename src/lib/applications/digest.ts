import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  APPLICATION_PRIORITIES,
  EMPTY_BOARD_FILTERS,
  serialiseBoardFilters,
  startOfDayUtc,
  startOfNextDayUtc,
  type ApplicationStatus,
  type BoardFilters,
  type PriorityFilter,
} from './queries';

/**
 * The daily digest's numbers for one team's board, and the board links behind
 * them.
 *
 * PRESENTATION-FREE. This returns counts and calendar days, never wording, so
 * the email (and anything else later) decides how to say them.
 *
 * EVERY COUNT IS A BOARD FILTER. "New" and "inactive" are exactly what the
 * board shows for the filters `digestLinks` builds: the same status, the same
 * UTC calendar days, the same day boundaries from `queries.ts`. A count that
 * disagreed with the board it opens would read as a bug.
 *
 * EVERY COUNT RUNS IN POSTGRES, as count-only queries in parallel, the same rule
 * as the board.
 */

/** Applied this many calendar days ago or earlier, and still in Applied. */
export const INACTIVE_AFTER_DAYS = 5;

/** Decided, so no longer worth a lead's attention in the priority counts. */
const OUT_OF_PLAY: readonly ApplicationStatus[] = ['offered', 'rejected', 'waitlisted'];

export type TeamDigest = {
  /** Still in Applied, submitted between these UTC calendar days inclusive. */
  newApplicants: { count: number; from: string; to: string };
  /** Still in Applied, submitted on or before this UTC calendar day. */
  inactive: { count: number; submittedOnOrBefore: string };
  /** Applications still in play, by priority. `none` is no priority set. */
  priorityCounts: Record<PriorityFilter, number>;
};

/**
 * @param postingId the team's posting, chosen the same way the board chooses it.
 * @param now       when the digest is for. Passed in so every count in one
 *                  send agrees on what "today" is.
 * @param supabase  any client. It may be the service role, which bypasses RLS,
 *                  so the posting filter on every query is what keeps a digest
 *                  to one team.
 */
export async function getTeamDigest(
  postingId: string,
  now: Date,
  supabase: SupabaseClient<Database>,
): Promise<TeamDigest> {
  const today = calendarDayUtc(now);
  const yesterday = addDays(today, -1);
  const inactiveCutoff = addDays(today, -INACTIVE_AFTER_DAYS);

  const countFor = () =>
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('posting_id', postingId);

  const inPlay = () => countFor().not('status', 'in', `(${OUT_OF_PLAY.join(',')})`);

  const [newApplicants, inactive, high, medium, low, none] = await Promise.all([
    countFor()
      .eq('status', 'applied')
      .gte('submitted_at', startOfDayUtc(yesterday))
      .lt('submitted_at', startOfNextDayUtc(today)),
    countFor().eq('status', 'applied').lt('submitted_at', startOfNextDayUtc(inactiveCutoff)),
    ...APPLICATION_PRIORITIES.map((priority) => inPlay().eq('priority', priority)),
    inPlay().is('priority', null),
  ]);

  const failed = [newApplicants, inactive, high, medium, low, none].find((result) => result.error);
  if (failed?.error) {
    // As on the board: the PostgREST message names columns, so it goes to the
    // log and the caller gets a plain error.
    console.error('[digest] count query failed', { postingId, message: failed.error.message });
    throw new Error('Could not load the digest for this board.');
  }

  return {
    newApplicants: { count: newApplicants.count ?? 0, from: yesterday, to: today },
    inactive: { count: inactive.count ?? 0, submittedOnOrBefore: inactiveCutoff },
    priorityCounts: {
      high: high.count ?? 0,
      medium: medium.count ?? 0,
      low: low.count ?? 0,
      none: none.count ?? 0,
    },
  };
}

/**
 * Board paths that show exactly the applications behind each count. Paths, not
 * URLs: whoever renders them adds the site's address.
 *
 * Built with `serialiseBoardFilters`, so the parameter names and order are the
 * board's own.
 */
export function digestLinks(
  teamSlug: string,
  digest: TeamDigest,
): { newApplicants: string; inactive: string } {
  const boardPath = (filters: Partial<BoardFilters>) =>
    `/admin/${teamSlug}?${serialiseBoardFilters({ ...EMPTY_BOARD_FILTERS, ...filters })}`;

  return {
    newApplicants: boardPath({
      status: 'applied',
      submittedFrom: digest.newApplicants.from,
      submittedTo: digest.newApplicants.to,
    }),
    inactive: boardPath({
      status: 'applied',
      submittedTo: digest.inactive.submittedOnOrBefore,
    }),
  };
}

/** `YYYY-MM-DD`, the board's calendar-day format. */
function calendarDayUtc(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(startOfDayUtc(day));
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDayUtc(date);
}
