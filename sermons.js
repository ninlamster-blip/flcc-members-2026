/* =============================================================================
   Sermons — the rules shared by sermons.html and sermon-editor.html
   -----------------------------------------------------------------------------
   Each church keeps its own list in sermons.json, read through
   FLCC.data('sermons.json') like every other per-church file:

     { "sermons": [
         { "id": "2026-10-25-walking-in-faith",
           "date": "2026-10-25",
           "title": "Walking in Faith",
           "preacher": "Ptr. Rodel",
           "summary": "Two or three sentences about the message.",
           "video": "https://www.facebook.com/<page>/videos/<id>/" } ] }

   The videos are Facebook Lives. Facebook only lets another site play a video
   that is PUBLIC and posted by a PAGE — not a personal profile, not a group —
   and its player wants the video's full address. The short links its Share
   button hands out (fb.watch/…, facebook.com/share/v/…) often will not play
   in it, which is the mistake this file exists to catch before it is
   published rather than after.

   Plain script, no build step, loaded before the page code. Pure functions
   only, so test/sermons.test.mjs can evaluate this file on its own.
   ========================================================================== */
(function () {
  'use strict';

  var FB_HOSTS = /^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/i;

  /** Read whatever was pasted — a video address, a share link, or Facebook's
   *  whole "Embed" code — and say whether it will play here.
   *    { ok: true,  href }                 ready to publish
   *    { ok: true,  href, warning }        publishable, but may not play
   *    { ok: false, error }                not a Facebook video at all */
  function facebookVideo(input) {
    var text = String(input || '').trim();
    if (!text) return { ok: false, error: 'Paste the Facebook video link.' };

    // Facebook's "Embed" button gives an <iframe> whose src carries the real
    // address in ?href=. Lift it out so pasting the whole code just works.
    var embedded = /plugins\/video\.php\?[^"'\s>]*href=([^&"'\s>]+)/i.exec(text);
    if (embedded) {
      try { text = decodeURIComponent(embedded[1]); } catch (e) { text = embedded[1]; }
    }

    if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
    var url;
    try { url = new URL(text); } catch (e) {
      return { ok: false, error: 'That doesn’t look like a link.' };
    }
    var host = url.hostname.toLowerCase();

    if (host === 'fb.watch' || host === 'www.fb.watch') {
      return { ok: true, href: 'https://fb.watch' + url.pathname, warning: 'short' };
    }
    if (!FB_HOSTS.test(host)) {
      return { ok: false, error: 'That isn’t a Facebook link.' };
    }

    var path = url.pathname.replace(/\/+$/, '');
    var v = url.searchParams.get('v');

    // facebook.com/watch/?v=123 and facebook.com/video.php?v=123
    if ((/^\/watch$/i.test(path) || /^\/video\.php$/i.test(path)) && /^\d+$/.test(v || '')) {
      return { ok: true, href: 'https://www.facebook.com/watch/?v=' + v };
    }
    // facebook.com/<page>/videos/123  ·  …/videos/<title>/123  ·  facebook.com/reel/123
    if (/\/videos\/(?:[^/]+\/)?\d+$/i.test(path) || /^\/reel\/\d+$/i.test(path)) {
      return { ok: true, href: 'https://www.facebook.com' + path + '/' };
    }
    // facebook.com/share/v/AbC123 — the Share button's link on a phone.
    if (/^\/share\/[vr]\/[^/]+$/i.test(path)) {
      return { ok: true, href: 'https://www.facebook.com' + path + '/', warning: 'short' };
    }
    return { ok: false, error: 'That Facebook link isn’t a video. Open the video itself, then copy its link.' };
  }

  /** The address of Facebook's own player for a video. */
  function embedUrl(href) {
    return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(href) +
      '&show_text=false&width=1280&t=0';
  }

  var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function validDate(s) {
    if (!ISO_DATE.test(s || '')) return false;
    // UTC on both sides: a local midnight read back through toISOString() is
    // the previous day anywhere east of Greenwich — Kuwait included.
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }

  /** Everything wrong with one entry, as sentences. Empty means publishable. */
  function sermonProblems(s) {
    var out = [];
    if (!s || typeof s !== 'object') return ['Not a sermon.'];
    if (!String(s.title || '').trim()) out.push('Add a title.');
    if (!String(s.preacher || '').trim()) out.push('Add the preacher.');
    if (!validDate(s.date)) out.push('Pick the date it was preached.');
    if (!String(s.summary || '').trim()) out.push('Add a short summary.');
    var video = facebookVideo(s.video);
    if (!video.ok) out.push(video.error);
    return out;
  }

  /** Newest first; on the same day, the order they were added. */
  function sortSermons(list) {
    return (list || []).map(function (s, i) { return { s: s, i: i }; })
      .sort(function (a, b) {
        if (a.s.date !== b.s.date) return a.s.date < b.s.date ? 1 : -1;
        return a.i - b.i;
      })
      .map(function (x) { return x.s; });
  }

  /** "2026-10-25-walking-in-faith", made unique against the ids in `taken`. */
  function sermonId(date, title, taken) {
    var slug = String(title || '').toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sermon';
    var base = (date || 'undated') + '-' + slug;
    var id = base;
    for (var n = 2; (taken || []).indexOf(id) !== -1; n++) id = base + '-' + n;
    return id;
  }

  /** A sermons.json as fetched — or missing, or hand-edited badly — as a list. */
  function readSermonsFile(json) {
    var list = json && Array.isArray(json.sermons) ? json.sermons : [];
    return list.filter(function (s) { return s && typeof s === 'object'; });
  }

  /** Does one sermon match what was typed in the search box? */
  function matchesSearch(s, query) {
    var words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    var hay = [s.title, s.preacher, s.summary].join(' ').toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function displayName(w) {
    return [w.title, w.name].filter(Boolean).join(' ').trim();
  }

  /** Who the church's own schedule (data.json) says preached on `date`, as
   *  "Ptr. Rodel Cruz" — or '' when nobody is scheduled. If two services fall
   *  on one day and name different preachers, '' too: guessing is worse. */
  function scheduledPreacher(data, date) {
    var workers = (data && data.workers) || [];
    var names = ((data && data.schedule) || [])
      .filter(function (e) { return e && e.date === date && e.roles && e.roles.preacher; })
      .map(function (e) {
        var w = workers.filter(function (x) { return x.id === e.roles.preacher; })[0];
        return w ? displayName(w) : '';
      })
      .filter(Boolean);
    var unique = names.filter(function (n, i) { return names.indexOf(n) === i; });
    return unique.length === 1 ? unique[0] : '';
  }

  /** Names to suggest in the Preacher box: everyone the church lists as able
   *  to preach, then anyone who has preached here before. */
  function preacherSuggestions(data, sermons) {
    var out = [];
    ((data && data.workers) || []).forEach(function (w) {
      if ((w.eligibleRoles || []).indexOf('preacher') !== -1 && w.status !== 'inactive') out.push(displayName(w));
    });
    (sermons || []).forEach(function (s) { if (s.preacher) out.push(String(s.preacher).trim()); });
    return out.filter(function (n, i) { return n && out.indexOf(n) === i; });
  }

  window.FLCCSermons = {
    scheduledPreacher: scheduledPreacher,
    preacherSuggestions: preacherSuggestions,
    facebookVideo: facebookVideo,
    embedUrl: embedUrl,
    validDate: validDate,
    sermonProblems: sermonProblems,
    sortSermons: sortSermons,
    sermonId: sermonId,
    readSermonsFile: readSermonsFile,
    matchesSearch: matchesSearch,
  };
})();
