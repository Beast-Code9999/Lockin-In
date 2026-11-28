import { routeForLink, shiftTime, timeLabel } from './links';

describe('routeForLink', () => {
  it.each(['/', '/leaderboard', '/history', '/votes', '/settings', '/profile/53859595-c3a5-40e4-b25e-18cabc91f95d'])('opens %s', (link) => {
    expect(routeForLink(link)).toBe(link);
  });

  it.each([undefined, null, 42, '', 'https://example.com', '/profile/not-a-uuid', '/dev/widgets', '//evil', '/leaderboard?x=1'])(
    'falls back to Home for %p',
    (link) => {
      expect(routeForLink(link)).toBe('/');
    },
  );
});

describe('reminder time helpers', () => {
  it('steps and wraps around midnight', () => {
    expect(shiftTime('21:00', 30)).toBe('21:30');
    expect(shiftTime('23:30', 30)).toBe('00:00');
    expect(shiftTime('00:00', -30)).toBe('23:30');
  });

  it('labels 12-hour times', () => {
    expect(timeLabel('21:00')).toBe('9:00pm');
    expect(timeLabel('00:30')).toBe('12:30am');
    expect(timeLabel('12:00')).toBe('12:00pm');
  });
});
