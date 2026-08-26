import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBolls, normalizeBibleApi, stripTags, joinText, TRANSLATIONS } from '../js/core/bible.js';

test('both shapes bolls.life has served are read correctly', () => {
  // { pk, verse: <number>, text: <string> }
  const modern = normalizeBolls([
    { pk: 26138, verse: 2, text: 'the second verse' },
    { pk: 26137, verse: 1, text: 'the first verse' },
  ]);
  assert.deepEqual(modern, [{ n: 1, text: 'the first verse' }, { n: 2, text: 'the second verse' }]);

  // { pk: <number>, verse: <string> }
  const older = normalizeBolls([
    { pk: 1, verse: 'the first verse' },
    { pk: 2, verse: 'the second verse' },
  ]);
  assert.deepEqual(older, [{ n: 1, text: 'the first verse' }, { n: 2, text: 'the second verse' }]);
});

test('markup and junk rows never reach a reader', () => {
  const verses = normalizeBolls([
    { pk: 1, verse: 'a <i>word</i> with&nbsp;markup' },
    { pk: 2, verse: '   ' },
    null,
    { pk: 'x', verse: 'no number' },
    'nonsense',
  ]);
  assert.deepEqual(verses, [{ n: 1, text: 'a word with markup' }]);
  assert.equal(normalizeBolls(null).length, 0);
  assert.equal(stripTags('<p>Hello &amp; welcome</p>'), 'Hello & welcome');
});

test('the second source is normalised to the same shape', () => {
  const verses = normalizeBibleApi({ verses: [{ verse: 16, text: 'For God so loved…\n' }] });
  assert.deepEqual(verses, [{ n: 16, text: 'For God so loved…' }]);
  assert.equal(joinText(verses), 'For God so loved…');
  assert.deepEqual(normalizeBibleApi(null), []);
});

test('MVP ships public-domain translations only', () => {
  const ids = TRANSLATIONS.map((t) => t.id);
  assert.deepEqual(ids, ['WEB', 'KJV', 'ASV']);
  for (const licensed of ['NIV', 'ESV', 'NLT', 'MSG', 'ICB']) {
    assert.ok(!ids.includes(licensed), `${licensed} needs a publisher licence`);
  }
});
