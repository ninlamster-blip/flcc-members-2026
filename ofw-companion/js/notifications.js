// "Bagong panalangin" push notifications: opt-in per device. Same same-origin
// default as the prayer chain (see prayerchain.js's apiBase note) — an unset
// AI-chat proxy URL means "this same site", not "nothing configured".
import { getConnection } from './ai.js';

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
// hide the whole feature rather than offer a toggle that can only fail.
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

export async function isEnabled() {
  return !!(await currentSubscription());
}

export async function enableNotifications() {
  if (!pushSupported()) throw new Error('Hindi supported ng browser/device na ito ang push notifications.');

  const res = await fetch(apiBase() + '/api/push/vapid-public-key');
  const keyData = await res.json();
  if (!keyData.configured) throw new Error('Hindi pa naka-set up ang notifications ng church.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Hindi pinayagan ang notifications sa browser settings.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  const subJson = sub.toJSON();
  await fetch(apiBase() + '/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: { endpoint: subJson.endpoint, keys: subJson.keys } }),
  });
  return sub;
}

export async function disableNotifications() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await fetch(apiBase() + '/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Device-side unsubscribe already succeeded; a stale server row just
    // gets pruned automatically the next time a push to it 404s/410s.
  }
}
