// utils/cooldown.ts
// Shared phrasing for the two rate-limited account actions: a password may be
// changed once a week, and a driver's name or phone once every 30 days. Both
// answer with an ISO instant, and both apps have to say the same thing about it.

/** e.g. "3 Sep 2026". Locale-independent so it reads the same in all 4 languages. */
export function formatUnlockDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Human gap until the unlock: "tomorrow", "in 5 days", "in about 3 hours".
 * Rounds up, so "in 1 day" never means "in 40 minutes".
 */
export function describeCooldown(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours <= 1) return 'in under an hour';
  if (hours < 24) return `in about ${hours} hours`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** One sentence an app can drop straight into a banner or toast. */
export function cooldownSentence(action: string, iso: string, now: Date = new Date()): string {
  return `You can ${action} again ${describeCooldown(iso, now)} (${formatUnlockDate(iso)}).`;
}
