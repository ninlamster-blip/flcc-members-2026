// "Bagong panalangin" (new prayer) and the evening Sanctuary reminder push
// notifications — two independent opt-ins that can share one underlying
// browser-level PushManager subscription (a device only needs one; the
// server decides what to send based on which flags are set on that
// subscription's row — see ask-proxy/worker.js). Enabled/disabled state is
// tracked in localStorage as the UI's source of truth (the server is
// authoritative for whether pushes actually fire) — same pattern as this
// app's other settings.
//
// Same same-origin default as the prayer chain (see prayerchain.js's
// apiBase note) — an unset AI-chat proxy URL means "this same site", not
// "nothing configured".
import { getConnection } from './ai.js';

const PRAYER_KEY = 'flcc-kasama-notify-prayers';
const EVENING_KEY = 'flcc-kasama-notify-evening';

function apiBase() {
  const { proxyUrl } = getConnection();
  return proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';
}

function urlBase64ToUint8Array(base64Url) {
  const pad = base64Url.length % 4 === 0 ? '' : '='.repeat(4 - (base64Url.length % 4));
  const base64 = (base64Url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Whether the church Worker has a VAPID key configured at all. Lets the UI
// hide both notification toggles rather than offer one that can only fail.
export async function pushConfiguredOnServer() {
  if (!pushSupported()) return false;
  try {
    const res = await fetch(apiBase() + '/api/push/vapid-public-key');
    const data = await res.json();
    return !!(data.configured && data.publicKey);
  } catch {
    return false;
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export const isPrayerNotifyEnabled = () => localStorage.getItem(PRAYER_KEY) === 'true';
export const isEveningNotifyEnabled = () => localStorage.getItem(EVENING_KEY) === 'true';
// Kept for the existing prayer-toggle call site — same thing, old name.
export const isEnabled = isPrayerNotifyEnabled;

// One-time migration: before the evening reminder existed, any live push
// subscription implicitly meant "prayer notifications on" — the only thing
// that existed. If we find one but no explicit flag yet (a device that
// enabled notifications before this update), honor that instead of
// silently losing their existing opt-in.
export async function migrateLegacySubscription() {
  if (localStorage.getItem(PRAYER_KEY) !== null) return; // already migrated, or a fresh device
  const sub = await currentSubscription();
  localStorage.setItem(PRAYER_KEY, sub ? 'true' : 'false');
}

async function ensureSubscription(keyData) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }
  return sub;
}

// Minutes EAST of UTC — same sign convention as /calendar's tzOffsetMinutes
// param elsewhere in this app. getTimezoneOffset() is (UTC - local), the
// opposite sign, hence the negation.
function currentTzOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}

async function subscribeTo(path, flagKey, extraBody) {
  if (!pushSupported()) throw new Error('Hindi supported ng browser/device na ito ang push notifications.');

  const res = await fetch(apiBase() + '/api/push/vapid-public-key');
  const keyData = await res.json();
  if (!keyData.configured) throw new Error('Hindi pa naka-set up ang notifications ng church.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Hindi pinayagan ang notifications sa browser settings.');

  const sub = await ensureSubscription(keyData);
  const subJson = sub.toJSON();
  await fetch(apiBase() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: { endpoint: subJson.endpoint, keys: subJson.keys }, ...extraBody }),
  });
  localStorage.setItem(flagKey, 'true');
}

async function unsubscribeFrom(path, flagKey, otherFlagKey) {
  const sub = await currentSubscription();
  localStorage.setItem(flagKey, 'false');
  if (sub?.endpoint) {
    try {
      await fetch(apiBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch {
      // Device-side state below is what actually matters for the UI; a
      // stale server row just gets pruned automatically next time a push
      // to it 404s/410s.
    }
  }
  // Only tear down the shared browser-level subscription once neither
  // feature wants it anymore — otherwise disabling one would silently kill
  // the other, since both ride on the same PushManager subscription.
  if (sub && localStorage.getItem(otherFlagKey) !== 'true') {
    await sub.unsubscribe().catch(() => {});
  }
}

export const enableNotifications = () => subscribeTo('/api/push/subscribe', PRAYER_KEY);
export const disableNotifications = () => unsubscribeFrom('/api/push/unsubscribe', PRAYER_KEY, EVENING_KEY);
export const enableEveningNotify = () => subscribeTo('/api/push/evening/subscribe', EVENING_KEY, { tzOffsetMinutes: currentTzOffsetMinutes() });
export const disableEveningNotify = () => unsubscribeFrom('/api/push/evening/unsubscribe', EVENING_KEY, PRAYER_KEY);

// Keeps the server's record of this device's time zone current — worth
// re-sending opportunistically (e.g. whenever Settings renders and the
// reminder is already on) since it's only ever captured at subscribe time
// otherwise. Silent best-effort: a stale offset just means the reminder
// keeps firing at wherever it last knew, not a broken feature.
export async function refreshEveningTzOffset() {
  if (!isEveningNotifyEnabled()) return;
  const sub = await currentSubscription();
  if (!sub?.endpoint) return;
  try {
    const subJson = sub.toJSON();
    await fetch(apiBase() + '/api/push/evening/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
        tzOffsetMinutes: currentTzOffsetMinutes(),
      }),
    });
  } catch {
    // best-effort — see comment above
  }
}
