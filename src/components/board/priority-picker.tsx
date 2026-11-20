'use client';

import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { APPLICATION_PRIORITIES, type ApplicationPriority } from '@/lib/applications/queries';
import { CheckIcon, PlusIcon } from './icons';

/**
 * A lead's priority label, and the menu that sets it.
 *
 * The same control on the board card and in the detail view, so the two behave
 * identically. It holds no priority of its own: the caller passes the current
 * value (already optimistic) and gets told what was chosen.
 *
 * No priority shows a "+"; a priority shows its label in place of it. Either one
 * opens a GitHub-style menu of High, Medium, Low and None, and None clears it.
 *
 * IT SITS INSIDE A DRAGGABLE CARD. The whole card carries dnd-kit's pointer and
 * keyboard listeners, so a click here or Enter/Space on the trigger would also
 * pick the card up. Pointer and key events are stopped at this control's edge;
 * the document-level listeners below still see them, because they capture.
 */

export const PRIORITY_LABELS: Record<ApplicationPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Whole class names, so Tailwind finds them in the source. The colours are
// tokens in `globals.css`, with their own dark-mode values.
const PRIORITY_STYLES: Record<ApplicationPriority, string> = {
  high: 'bg-priority-high text-priority-high-foreground',
  medium: 'bg-priority-medium text-priority-medium-foreground',
  low: 'bg-priority-low text-priority-low-foreground',
};

const OPTIONS: { value: ApplicationPriority | null; label: string }[] = [
  ...APPLICATION_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
  { value: null, label: 'None' },
];

export function PriorityLabel({ priority }: { priority: ApplicationPriority }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function PriorityPicker({
  priority,
  onChange,
  subject,
}: {
  priority: ApplicationPriority | null;
  /** Omitted for a read-only copy, such as the card following a drag. */
  onChange?: (priority: ApplicationPriority | null) => void;
  /** Who this is the priority of, for the trigger's accessible name. */
  subject: string;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function select(value: ApplicationPriority | null) {
    close({ restoreFocus: true });
    // Picking what is already set is not a change, and would cost a round trip.
    if (value !== priority) onChange?.(value);
  }

  useEffect(() => {
    if (!open) return;

    // Start on the current choice, the way a native select does.
    const selected = OPTIONS.findIndex((option) => option.value === priority);
    itemRefs.current[selected === -1 ? 0 : selected]?.focus();

    // Captured on the document, like the notes panel, so Escape closes this menu
    // before the takeover dialog reads it as "close the application".
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close({ restoreFocus: true });
    };
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close({ restoreFocus: false });
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
    // `priority` is read only to choose where focus starts, once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!onChange) return priority ? <PriorityLabel priority={priority} /> : null;

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const last = items.length - 1;

    const next =
      event.key === 'ArrowDown'
        ? current === last
          ? 0
          : current + 1
        : event.key === 'ArrowUp'
          ? current <= 0
            ? last
            : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;

    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    } else if (event.key === 'Tab') {
      // Tabbing out leaves the menu behind; focus carries on to the next stop.
      close({ restoreFocus: false });
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          priority
            ? `Priority ${PRIORITY_LABELS[priority]} for ${subject}. Change priority`
            : `Set priority for ${subject}`
        }
        onClick={() => setOpen((current) => !current)}
        className={`rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none ${
          priority
            ? // The label paints its own background, so an `accent` hover would
              // sit behind it unseen. Shifting the label itself reads as a
              // button: darker on a light theme, lighter on a dark one.
              'hover:brightness-90 dark:hover:brightness-140'
            : 'p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        {priority ? <PriorityLabel priority={priority} /> : <PlusIcon />}
      </button>

      {open ? (
        <div
          role="menu"
          // The visible heading names the menu, so it is announced on opening.
          aria-labelledby={headingId}
          onKeyDown={onMenuKeyDown}
          // Above the sticky column headers, which sit at z-10.
          className="absolute top-full right-0 z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <p
            id={headingId}
            className="mb-1 px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground"
          >
            Candidate Priority
          </p>
          {OPTIONS.map((option, index) => (
            <Fragment key={option.label}>
              {/* None clears rather than sets, so it sits apart from the three
                  labels. A separator is skipped by the arrow keys. */}
              {option.value === null ? (
                <div role="separator" className="mx-1 my-1 h-px bg-border" />
              ) : null}
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === priority}
                tabIndex={-1}
                onClick={() => select(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <CheckIcon className={option.value === priority ? '' : 'invisible'} />
                {option.value ? <PriorityLabel priority={option.value} /> : <span>None</span>}
              </button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
