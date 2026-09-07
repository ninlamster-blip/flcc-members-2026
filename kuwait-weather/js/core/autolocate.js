// Whether to ask the device where it is, before anyone has asked for that.
//
// Locating on load is what people want from a weather app — it should open on
// where you are standing. But firing `getCurrentPosition` unconditionally on
// every visit is how an app gets its location permission denied for good: the
// dialog lands before the page has said anything, and the fastest way out of a
// dialog is Block.
//
// So the decision is made from three things, and it is pure so it can be
// argued with in a test rather than in a browser:
//
//   permission  what the Permissions API already knows. "granted" means no
//               dialog will appear at all — locating is free and instant.
//   chosen      the place the person last settled on. Someone who picked
//               Jahra from the list means it, and opening on their GPS fix
//               instead would be the app overruling them every morning.
//   declined    whether they have already said no once. Asking again on the
//               next load is the behaviour that earns a permanent Block.

import * as places from './places.js';

export const PERMISSIONS = ['granted', 'prompt', 'denied'];

// How close a fix has to be to a listed area before the app uses that area's
// name, and how far out it will still say which area you are near.
export const SNAP_KM = 12;
export const NEAR_KM = 40;

/**
 * A raw fix → the place the app will show.
 *
 * Inside Kuwait and close to a listed area, the area's name is more useful
 * than a coordinate — "Fahaheel" beats "29.08, 48.13". Further out the
 * coordinate stands on its own and the app says plainly where it thinks that
 * is, including when that is not Kuwait at all.
 *
 * `fromFix` marks every one of these, so the app can say it is showing where
 * you are rather than somewhere you picked — a fix that snapped onto a listed
 * name is still a fix.
 */
export function placeFromFix({ latitude: lat, longitude: lon }) {
  const { place: near, km } = places.nearest(lat, lon);
  const inside = places.inKuwait(lat, lon);
  if (inside && km < SNAP_KM) return { ...near, fromFix: true };
  return {
    id: 'here',
    name: near && km < NEAR_KM ? `Near ${near.name}` : 'Your location',
    gov: inside ? 'Kuwait' : 'Outside Kuwait',
    lat,
    lon,
    fromFix: true,
  };
}

/**
 * @param {object} state
 * @param {'granted'|'prompt'|'denied'} state.permission
 * @param {{id: string}|null} state.chosen  the saved place, or null on a first run
 * @param {boolean} state.declined
 * @param {boolean} state.supported
 * @returns {boolean}
 */
export function shouldAutoLocate({
  permission = 'prompt', chosen = null, declined = false, supported = true,
} = {}) {
  if (!supported) return false;
  if (permission === 'denied') return false;

  // "here" is the place this very mechanism writes, so finding it saved means
  // they used their location last time, not that they pinned somewhere.
  const pinnedSomewhere = Boolean(chosen) && chosen.id !== 'here';
  if (pinnedSomewhere) return false;

  // Already granted: no dialog can appear, so there is nothing to be careful
  // about. Locate every load and keep the reading honest.
  if (permission === 'granted') return true;

  // Otherwise this would raise a dialog, and it is only worth raising once.
  return permission === 'prompt' && !declined;
}

/**
 * The browser's own answer, or "prompt" when it will not say.
 *
 * Safari only learned to answer this for geolocation recently and some
 * browsers throw on the query outright, so a refusal to answer is treated as
 * the cautious case rather than as permission.
 */
export async function permissionState(nav = globalThis.navigator) {
  try {
    const status = await nav.permissions.query({ name: 'geolocation' });
    return PERMISSIONS.includes(status.state) ? status.state : 'prompt';
  } catch {
    return 'prompt';
  }
}

/** A geolocation error that means "no", as opposed to "not right now". */
export function isRefusal(error) {
  // PERMISSION_DENIED is 1; a timeout or a position failure is not a refusal
  // and must not be remembered as one.
  return Boolean(error) && error.code === 1;
}
