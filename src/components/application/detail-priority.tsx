'use client';

import { startTransition, useOptimistic, useState } from 'react';
import { setApplicationPriority } from '@/app/actions/set-application-priority';
import type { ApplicationPriority } from '@/lib/applications/queries';
import { PriorityPicker } from '@/components/board/priority-picker';

/**
 * The detail view's priority control.
 *
 * The board's picker, wired to the action directly: the detail view is not a
 * child of the board, so it cannot use the board's handler. Optimistic the
 * same way. The label changes on click, and if the action fails nothing is
 * revalidated, so `priority` never changes and the old label comes back on its
 * own.
 */
export function DetailPriority({
  applicationId,
  teamSlug,
  applicantName,
  priority,
}: {
  applicationId: string;
  teamSlug: string;
  applicantName: string;
  priority: ApplicationPriority | null;
}) {
  const [optimisticPriority, setOptimisticPriority] = useOptimistic(priority);
  const [error, setError] = useState<string | null>(null);

  // For the detail pane we optimistically set the new chosen prority
  // before the database operation runs/finishes
  function change(next: ApplicationPriority | null) {
    setError(null);
    startTransition(async () => {
      setOptimisticPriority(next);
      const result = await setApplicationPriority(applicationId, next, teamSlug);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <PriorityPicker priority={optimisticPriority} onChange={change} subject={applicantName} />
      {error ? (
        // Its own line in the header row, the same inline pattern as the notes
        // panel's errors.
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
