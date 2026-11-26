import type { LocalDate } from '@/shared/dates';

import type { CheckinStatus } from '../home/types';

export type CalendarStatus = 'clean' | 'slipped' | 'missed' | 'frozen' | 'vacation' | 'open' | 'empty' | 'beforePact' | 'future';

/** How one calendar day should look (SPEC §14.4). Pure, so it's easy to test. */
export function calendarStatus(
  date: LocalDate,
  record: CheckinStatus | undefined,
  ctx: { today: LocalDate; yesterday: LocalDate; firstEligible: LocalDate | null },
): CalendarStatus {
  if (date > ctx.today) return 'future';
  if (record === 'clean') return 'clean';
  if (record === 'relapse') return 'slipped';
  if (record) return record;
  if (!ctx.firstEligible || date < ctx.firstEligible) return 'beforePact';
  if (date === ctx.today || date === ctx.yesterday) return 'open';
  return 'empty';
}

export function isEditable(date: LocalDate, ctx: { today: LocalDate; yesterday: LocalDate }): boolean {
  return date === ctx.today || date === ctx.yesterday;
}
