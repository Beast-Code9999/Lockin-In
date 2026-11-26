import { CONFIG } from './constants';

/** Quick picks for onboarding/settings; any valid IANA name can still be typed. */
export const COMMON_TIMEZONES = [
  'Australia/Darwin',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Adelaide',
  'Australia/Perth',
  'Australia/Hobart',
  'Asia/Dili',
  'Asia/Singapore',
  'Pacific/Auckland',
] as const;

/** The device's IANA timezone, falling back to the game default. */
export function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.includes('/') ? tz : CONFIG.DEFAULT_TIMEZONE;
  } catch {
    return CONFIG.DEFAULT_TIMEZONE;
  }
}

/** 'Australia/Darwin' → 'Darwin' */
export function timezoneCity(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}
