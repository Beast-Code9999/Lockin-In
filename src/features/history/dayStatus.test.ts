import { calendarStatus } from './dayStatus';

const ctx = { today: '2026-12-10', yesterday: '2026-12-09', firstEligible: '2026-12-03' };

describe('calendarStatus', () => {
  it('maps records, using the UI vocabulary', () => {
    expect(calendarStatus('2026-12-05', 'clean', ctx)).toBe('clean');
    expect(calendarStatus('2026-12-05', 'relapse', ctx)).toBe('slipped');
    expect(calendarStatus('2026-12-05', 'missed', ctx)).toBe('missed');
    expect(calendarStatus('2026-12-05', 'frozen', ctx)).toBe('frozen');
  });

  it('marks today and yesterday as still open', () => {
    expect(calendarStatus('2026-12-10', undefined, ctx)).toBe('open');
    expect(calendarStatus('2026-12-09', undefined, ctx)).toBe('open');
  });

  it('separates future, pre-Pact and unrecorded days', () => {
    expect(calendarStatus('2026-12-11', undefined, ctx)).toBe('future');
    expect(calendarStatus('2026-12-02', undefined, ctx)).toBe('beforePact');
    expect(calendarStatus('2026-12-05', undefined, ctx)).toBe('empty');
  });
});
