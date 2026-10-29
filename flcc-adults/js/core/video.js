// A message's recording — the one place this app reads a video link.
//
// FLCC streams its services to YouTube and to Facebook Live, so a message in
// content/messages.json can carry either link, or both, or neither:
//
//   youtube   PLAYS in the message, behind a button. YouTube lets other sites
//             play its videos.
//   facebook  OPENS on Facebook. Facebook refuses to play a service video
//             inside another site once it hears music it believes someone else
//             owns — the worship set, so nearly every service — and shows
//             "Video unavailable". A link out works every time.
//
// This is a deliberate exception to "nothing leaves the device", and a narrow
// one: the phone contacts YouTube only when a member presses Play on a
// recording, never to draw a screen. That is why there is no thumbnail — a
// picture from YouTube would be a request to YouTube from everyone who merely
// scrolls past — and why the player comes from youtube-nocookie.com, which
// sets no cookies until the video plays. Nothing the member has written,
// prayed or read goes with it. test/video.test.mjs holds all of that.
//
// Written here rather than shared with the members app's sermons.js: the apps
// in this repository share no code.

const YT_HOST = /^(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com$/i;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const FB_HOST = /^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/i;

function parse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
}

/** The 11-character id of a YouTube video link of any usual shape, or null. */
export function youtubeId(link) {
  const url = parse(link);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (YT_HOST.test(host)) {
    const m = /^\/(?:live|shorts|embed|v)\/([^/]+)/i.exec(url.pathname);
    id = m ? m[1] : (/^\/watch\/?$/i.test(url.pathname) ? url.searchParams.get('v') : null);
  }
  return YT_ID.test(id || '') ? id : null;
}

/** True for a link to one Facebook video (share links included). */
export function isFacebookVideo(link) {
  const url = parse(link);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'fb.watch') return url.pathname.length > 1;
  if (!FB_HOST.test(host)) return false;
  const path = url.pathname.replace(/\/+$/, '');
  return (/^\/watch$/i.test(path) && /^\d+$/.test(url.searchParams.get('v') || ''))
    || /\/videos\/(?:[^/]+\/)?\d+$/i.test(path)
    || /^\/reel\/\d+$/i.test(path)
    || /^\/share\/[vr]\/[^/]+$/i.test(path);
}

/** YouTube's player for one video, started by the press that loaded it. */
export function playerUrl(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

/** What a message offers: { youtube: id|null, facebook: link|null }. */
export function recording(message) {
  const id = youtubeId(message && message.youtube);
  const fb = message && isFacebookVideo(message.facebook) ? String(message.facebook).trim() : null;
  return { youtube: id, facebook: fb };
}
