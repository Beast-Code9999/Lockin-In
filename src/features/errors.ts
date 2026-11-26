import { copy } from '@/copy/en';

/** Server RPCs raise stable keys (e.g. CHECKIN_NOT_OPEN); turn them into friendly copy. */
export function friendlyError(e: unknown): string {
  const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
  const key = message.trim() as keyof typeof copy.errors;
  if (key in copy.errors) return copy.errors[key];
  if (/network|fetch|timeout/i.test(message)) return copy.errors.NETWORK;
  return copy.errors.GENERIC;
}
