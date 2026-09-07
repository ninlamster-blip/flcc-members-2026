// Where in Kuwait the forecast is for.
//
// Kuwait is small — about 200 km end to end — but the weather across it is not
// uniform in the ways this app cares about. Jahra and Abdali sit open to the
// desert and take the shamal and its dust first; the coast from Salmiya down
// to Fahaheel is cooler by a couple of degrees and far more humid, which is
// worse for a body, not better; Wafra and Khiran in the south are the hottest
// numbers on any Kuwait summer afternoon.
//
// Coordinates are to four decimals, which is more than enough for a forecast
// grid, and every one of them is a place people actually live or work in.

export const GOVERNORATES = [
  'Al Asimah', 'Hawalli', 'Farwaniya', 'Mubarak Al-Kabeer', 'Ahmadi', 'Jahra',
];

export const PLACES = [
  // Al Asimah (Capital)
  { id: 'kuwait-city', name: 'Kuwait City',      gov: 'Al Asimah',         lat: 29.3759, lon: 47.9774 },
  { id: 'shuwaikh',    name: 'Shuwaikh',          gov: 'Al Asimah',         lat: 29.3450, lon: 47.9300 },
  { id: 'salmiya',     name: 'Salmiya',           gov: 'Hawalli',           lat: 29.3339, lon: 48.0757 },
  { id: 'hawally',     name: 'Hawally',           gov: 'Hawalli',           lat: 29.3326, lon: 48.0289 },
  { id: 'jabriya',     name: 'Jabriya',           gov: 'Hawalli',           lat: 29.3179, lon: 48.0261 },
  { id: 'salwa',       name: 'Salwa',             gov: 'Hawalli',           lat: 29.2917, lon: 48.0806 },
  // Farwaniya
  { id: 'farwaniya',   name: 'Farwaniya',         gov: 'Farwaniya',         lat: 29.2775, lon: 47.9586 },
  { id: 'khaitan',     name: 'Khaitan',           gov: 'Farwaniya',         lat: 29.2861, lon: 47.9583 },
  { id: 'jleeb',       name: 'Jleeb Al-Shuyoukh', gov: 'Farwaniya',         lat: 29.2650, lon: 47.9250 },
  { id: 'airport',     name: 'Kuwait Airport',    gov: 'Farwaniya',         lat: 29.2266, lon: 47.9689 },
  // Mubarak Al-Kabeer
  { id: 'sabah-salem', name: 'Sabah Al Salem',    gov: 'Mubarak Al-Kabeer', lat: 29.2569, lon: 48.0631 },
  { id: 'qurain',      name: 'Al Qurain',         gov: 'Mubarak Al-Kabeer', lat: 29.2214, lon: 48.0656 },
  // Ahmadi
  { id: 'ahmadi',      name: 'Ahmadi',            gov: 'Ahmadi',            lat: 29.0769, lon: 48.0838 },
  { id: 'fahaheel',    name: 'Fahaheel',          gov: 'Ahmadi',            lat: 29.0826, lon: 48.1305 },
  { id: 'mangaf',      name: 'Mangaf',            gov: 'Ahmadi',            lat: 29.0989, lon: 48.1300 },
  { id: 'mahboula',    name: 'Mahboula',          gov: 'Ahmadi',            lat: 29.1512, lon: 48.1275 },
  { id: 'fintas',      name: 'Fintas',            gov: 'Ahmadi',            lat: 29.1725, lon: 48.1211 },
  { id: 'wafra',       name: 'Al Wafra',          gov: 'Ahmadi',            lat: 28.6394, lon: 47.9317 },
  { id: 'khiran',      name: 'Al Khiran',         gov: 'Ahmadi',            lat: 28.6500, lon: 48.3739 },
  { id: 'shuaiba',     name: 'Shuaiba',           gov: 'Ahmadi',            lat: 29.0400, lon: 48.1500 },
  // Jahra
  { id: 'jahra',       name: 'Al Jahra',          gov: 'Jahra',             lat: 29.3375, lon: 47.6581 },
  { id: 'abdali',      name: 'Al Abdali',         gov: 'Jahra',             lat: 30.0333, lon: 47.7000 },
  { id: 'salmi',       name: 'Al Salmi',          gov: 'Jahra',             lat: 29.1167, lon: 46.7500 },
  { id: 'failaka',     name: 'Failaka Island',    gov: 'Jahra',             lat: 29.4406, lon: 48.3336 },
];

export const DEFAULT_PLACE_ID = 'kuwait-city';

export function place(id) {
  return PLACES.find((p) => p.id === id) || null;
}

export function defaultPlace() {
  return place(DEFAULT_PLACE_ID);
}

/** Places grouped in the order GOVERNORATES lists them — the shape a <select> wants. */
export function byGovernorate() {
  return GOVERNORATES
    .map((gov) => ({ gov, places: PLACES.filter((p) => p.gov === gov) }))
    .filter((group) => group.places.length > 0);
}

// A generous box around Kuwait and its waters. Used only to decide whether to
// say "this is your location" or "this is where you are, which is outside
// Kuwait" — never to refuse a coordinate.
export const BOUNDS = { south: 28.45, north: 30.15, west: 46.50, east: 48.50 };

export function inKuwait(lat, lon) {
  return lat >= BOUNDS.south && lat <= BOUNDS.north && lon >= BOUNDS.west && lon <= BOUNDS.east;
}

/** The listed place nearest a coordinate, by great-circle distance. */
export function nearest(lat, lon) {
  let best = null;
  let bestKm = Infinity;
  for (const p of PLACES) {
    const km = distanceKm(lat, lon, p.lat, p.lon);
    if (km < bestKm) { bestKm = km; best = p; }
  }
  return { place: best, km: bestKm };
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
