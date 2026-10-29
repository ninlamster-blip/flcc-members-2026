// Recordings — and the narrow exception they make to "nothing leaves the device".
//
// A message's YouTube recording plays inside it; its Facebook one opens on
// Facebook. The promise this file holds is the shape of the exception: the
// phone contacts YouTube only when a member presses Play, never to draw a
// screen — so no thumbnails, no player loaded ahead of time, and the player
// from youtube-nocookie.com. Facebook's player never appears at all: it
// answers "Video unavailable" for service videos because of the worship music.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as video from '../js/core/video.js';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const code = (file) => source(file)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const modules = ['core', 'screens'].flatMap((dir) =>
  readdirSync(new URL(`../js/${dir}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `js/${dir}/${f}`));

test('every usual shape of YouTube link comes back as its id', () => {
  for (const link of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://youtu.be/dQw4w9WgXcQ?si=AbC',
    'youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
  ]) assert.equal(video.youtubeId(link), 'dQw4w9WgXcQ', link);
});

test('anything that is not one YouTube video has no id', () => {
  for (const link of ['', 'https://www.youtube.com/@flcc', 'https://www.youtube.com/playlist?list=PL1',
    'https://www.youtube.com/watch?v=short', 'https://youtube.com.example.org/watch?v=dQw4w9WgXcQ',
    'https://www.facebook.com/share/v/19vr6qa5ro/']) {
    assert.equal(video.youtubeId(link), null, link);
  }
});

test('Facebook video links are recognised, and other links are not', () => {
  for (const link of ['https://www.facebook.com/share/v/19vr6qa5ro/?mibextid=wwXIfr', 'https://fb.watch/abc123/',
    'https://www.facebook.com/official.flcc.gmpi/videos/1802787747839569/',
    'https://www.facebook.com/watch/?v=1802787747839569', 'https://m.facebook.com/reel/123']) {
    assert.equal(video.isFacebookVideo(link), true, link);
  }
  for (const link of ['', 'https://www.facebook.com/official.flcc.gmpi', 'https://youtu.be/dQw4w9WgXcQ',
    'https://facebook.com.example.org/x/videos/1']) {
    assert.equal(video.isFacebookVideo(link), false, link);
  }
});

test('a message offers what it has, and nothing it does not', () => {
  assert.deepEqual(video.recording({ youtube: '', facebook: '' }), { youtube: null, facebook: null });
  assert.deepEqual(video.recording({ youtube: 'https://youtu.be/dQw4w9WgXcQ', facebook: 'https://fb.watch/a1/' }),
    { youtube: 'dQw4w9WgXcQ', facebook: 'https://fb.watch/a1/' });
  assert.deepEqual(video.recording({ youtube: 'https://www.youtube.com/@flcc', facebook: 'nope' }),
    { youtube: null, facebook: null });
});

test("the player is YouTube's no-cookie one, built from the id alone", () => {
  assert.equal(video.playerUrl('dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1');
});

test('YouTube is contacted only when Play is pressed', () => {
  // The one iframe in the app is built inside the Play handler of the message
  // screen. Nothing else in the app names a YouTube host — so no thumbnail,
  // and no player drawn ahead of time.
  for (const file of modules) {
    const body = code(file);
    const hosts = body.match(/ytimg|youtube(?:-nocookie)?\.com\/(?:embed|vi)|img\.youtube/g) || [];
    if (file === 'js/core/video.js') {
      assert.deepEqual(hosts, ['youtube-nocookie.com/embed'], 'video.js builds the player address and nothing else');
    } else {
      assert.deepEqual(hosts, [], `${file} names a YouTube address — go through core/video.js`);
    }
    if (file !== 'js/screens/message.js') {
      assert.equal(/h\('iframe'/.test(body), false, `${file} builds an iframe`);
    }
  }
  const message = code('js/screens/message.js');
  assert.match(message, /const play = \(\) => \{\s*swap\(screen, h\('iframe', \{\s*src: video\.playerUrl\(rec\.youtube\)/,
    'the player is built by the Play handler');
  assert.match(message, /pill\('Play the recording', play\)/);
  assert.equal((message.match(/h\('iframe'/g) || []).length, 1, 'one player, behind Play');
});

test("Facebook's embedded player never appears", () => {
  for (const file of modules) {
    assert.equal(/plugins\/video\.php/.test(code(file)), false, `${file} embeds Facebook's player`);
  }
});
