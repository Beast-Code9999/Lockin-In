import { containsForbiddenWord, findForbiddenWord, FORBIDDEN_WORDS, normaliseForWordCheck } from './forbiddenWords';

describe('forbidden words (SPEC §3.1)', () => {
  // @forbidden-begin
  const blocked: [string, string][] = [
    ['Day 12 of #NoFap', 'camelCase hashtag'],
    ['no-fap gang', 'hyphenated phrase'],
    ['no_fap', 'underscore phrase'],
    ['NOFAP', 'all caps'],
    ['MASTURBATION', 'wildcard term'],
    ['ex-gooner', 'wildcard after punctuation'],
    ['coomer', 'wildcard prefix'],
    ['pörn', 'accented spelling'],
    ['semen retention streak', 'multiple terms'],
    ['no nut november', 'phrase with trailing words'],
    ['ic_porn.png', 'asset file name'],
    ['myPornIcon', 'camelCase identifier'],
    ['NNN', 'acronym'],
    ['edging', 'plain term'],
  ];
  // @forbidden-end

  it.each(blocked)('blocks %p (%s)', (text) => {
    expect(containsForbiddenWord(text)).toBe(true);
  });

  const allowed = [
    'Meet me in the basement', // contains the letters of a term mid-word
    'Hedging my bets at the lagoon',
    'Pledging allegiance to the snag',
    'Hold the line 🛡️',
    'Reset, not over. Owning it is the move.',
    "Lockin' In",
    'Locked in today',
    '',
  ];

  it.each(allowed)('allows %p', (text) => {
    expect(containsForbiddenWord(text)).toBe(false);
  });

  // @forbidden-begin
  it('reports which term matched', () => {
    expect(findForbiddenWord('all good here')).toBeNull();
    expect(FORBIDDEN_WORDS).toContain(findForbiddenWord('#NoFap'));
  });

  it('normalises camelCase, accents and case', () => {
    expect(normaliseForWordCheck('NoFap Été')).toBe('no fap ete');
  });
  // @forbidden-end
});
