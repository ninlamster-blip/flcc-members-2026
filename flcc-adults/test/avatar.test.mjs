// AVATARS — a drawing, or the member's own photo shrunk to a small square.
//
// Two things matter. What the picker can make is what the server accepts, so
// nobody picks a picture that silently never shows. And a photo is a small
// square data URL made on the phone, never a link to somewhere else or the
// full-size picture from the camera roll — the server holds the same limit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanAvatar, AVATAR_PHOTO_MAX } from '../../ask-proxy/next-play.js';
import * as avatars from '../js/core/avatar.js';

const artSource = readFileSync(new URL('../js/core/art.js', import.meta.url), 'utf8');

test('every drawing is one of this app’s own, and none of them is poppy', () => {
  for (const name of avatars.SYMBOLS) assert.ok(new RegExp(`\\b${name}: \\(`).test(artSource), name);
  assert.equal(avatars.TONES.includes('poppy'), false, 'poppy is never a whole shape in this edition');
});

test('the server accepts everything the picker can make', () => {
  for (const name of avatars.SYMBOLS) for (const tone of avatars.TONES) {
    const spec = avatars.make(name, tone);
    assert.equal(cleanAvatar(spec, 'adults'), spec);
  }
  const photo = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
  assert.equal(avatars.isPhoto(photo), true);
  assert.equal(cleanAvatar(photo, 'adults'), photo);
});

test('the phone and the server hold a photo to the same size', () => {
  assert.equal(avatars.PHOTO_MAX, AVATAR_PHOTO_MAX);
  const big = `data:image/jpeg;base64,${'A'.repeat(AVATAR_PHOTO_MAX)}`;
  assert.equal(avatars.isPhoto(big), false);
  assert.equal(cleanAvatar(big, 'adults'), null);
});

test('a picture is never a link to somewhere else', () => {
  for (const bad of ['https://example.com/me.jpg', 'data:text/html;base64,PGgxPg==', 'javascript:alert(1)', 'draw:heart:neon']) {
    assert.equal(avatars.valid(bad), null, bad);
  }
});

test('an adult photo is made small on the phone before it is kept', () => {
  const source = readFileSync(new URL('../js/core/avatar.js', import.meta.url), 'utf8');
  assert.ok(/canvas\.width = PHOTO_SIZE/.test(source) && avatars.PHOTO_SIZE <= 128, 'the photo is not shrunk');
});
