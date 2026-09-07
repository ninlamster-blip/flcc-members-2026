// Whether to ask the device where it is, before anyone has asked for that.
//
// Locating on load is what people want from a weather app — it should open on
// where they are standing. But firing `getCurrentPosition` unconditionally on
// every visit is how an app gets its location permission denied for good: the
// dialog lands before the page has said anything, and the fastest way out of a
// dialog is Block.

import * as places from './places.js';

export const PERMISSIONS = ['granted', 'prompt', 'denied'];

export const SNAP_KM = 15;
export const NEAR_KM = 60;

/**
 * A raw fix → the place the app will show. Inside the Philippines and close to
 * a listed city, that city's name is more use than a coordinate; further out
 * the coordinate stands on its own, and outside the country the app says so
 * rather than pretending otherwise.
 */
export function placeFromFix({ latitude: lat, longitude: lon }) {
  const { place: near, km } = places.nearest(lat, lon);
  const inside = places.inPhilippines(lat, lon);
  if (inside && km < SNAP_KM) return { ...near, fromFix: true };
  return {
    id: 'here',
    name: near && km < NEAR_KM ? `Near ${near.name}` : 'Your location',
    region: inside ? 'Philippines' : 'Outside the Philippines',
    lat,
    lon,
    fromFix: true,
  };
}

export function shouldAutoLocate({
  permission = 'prompt', chosen = null, declined = false, supported = true,
} = {}) {
  if (!supported) return false;
  if (permission === 'denied') return false;
  const pinnedSomewhere = Boolean(chosen) && chosen.id !== 'here';
  if (pinnedSomewhere) return false;
  if (permission === 'granted') return true;
  return permission === 'prompt' && !declined;
}

export async function permissionState(nav = globalThis.navigator) {
  try {
    const status = await nav.permissions.query({ name: 'geolocation' });
    return PERMISSIONS.includes(status.state) ? status.state : 'prompt';
  } catch {
    return 'prompt';
  }
}

/** PERMISSION_DENIED is 1. A timeout is not a refusal and must not be stored as one. */
export function isRefusal(error) {
  return Boolean(error) && error.code === 1;
}
