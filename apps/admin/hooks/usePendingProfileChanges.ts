'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { adminApi } from '@/lib/api';

const POLL_MS = 60_000;

/**
 * Pending driver profile-change requests waiting on an admin decision.
 *
 * Lives behind a hook because the count drives an action badge in the nav —
 * the queue is otherwise invisible until someone opens the drivers list.
 * Re-fetches on navigation so a review just approved drops the badge without
 * waiting out the poll interval.
 */
export function usePendingProfileChanges(): number {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;

    // Best-effort: a failed count must never surface as an error in the nav.
    const load = () =>
      adminApi
        .getProfileChangeCount()
        .then((res) => {
          if (alive) setPending(res.pending);
        })
        .catch(() => {
          if (alive) setPending(0);
        });

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  return pending;
}
