// Where in the Philippines the forecast is for.
//
// The list leans deliberately towards the places that flood and the places
// that slide, because those are what this app is for. Marikina, Malabon,
// Calumpit, Cagayan de Oro, Butuan and Cotabato are all here because they
// flood; Baguio and La Trinidad because the slopes above them move after
// days of rain. The big cities are here because that is where people are.

export const REGIONS = ['Metro Manila', 'Luzon', 'Visayas', 'Mindanao'];

export const PLACES = [
  // Metro Manila
  { id: 'quezon-city', name: 'Quezon City', region: 'Metro Manila', lat: 14.6760, lon: 121.0437 },
  { id: 'manila',      name: 'Manila',      region: 'Metro Manila', lat: 14.5995, lon: 120.9842 },
  { id: 'makati',      name: 'Makati',      region: 'Metro Manila', lat: 14.5547, lon: 121.0244 },
  { id: 'marikina',    name: 'Marikina',    region: 'Metro Manila', lat: 14.6507, lon: 121.1029 },
  { id: 'pasig',       name: 'Pasig',       region: 'Metro Manila', lat: 14.5764, lon: 121.0851 },
  { id: 'caloocan',    name: 'Caloocan',    region: 'Metro Manila', lat: 14.6488, lon: 120.9830 },
  { id: 'malabon',     name: 'Malabon',     region: 'Metro Manila', lat: 14.6681, lon: 120.9567 },
  { id: 'taguig',      name: 'Taguig',      region: 'Metro Manila', lat: 14.5176, lon: 121.0509 },
  // Luzon
  { id: 'antipolo',    name: 'Antipolo',    region: 'Luzon', lat: 14.5878, lon: 121.1760 },
  { id: 'cainta',      name: 'Cainta',      region: 'Luzon', lat: 14.5786, lon: 121.1222 },
  { id: 'baguio',      name: 'Baguio',      region: 'Luzon', lat: 16.4023, lon: 120.5960 },
  { id: 'la-trinidad', name: 'La Trinidad', region: 'Luzon', lat: 16.4550, lon: 120.5887 },
  { id: 'san-fernando-p', name: 'San Fernando, Pampanga', region: 'Luzon', lat: 15.0349, lon: 120.6899 },
  { id: 'calumpit',    name: 'Calumpit, Bulacan', region: 'Luzon', lat: 14.9167, lon: 120.7667 },
  { id: 'tuguegarao',  name: 'Tuguegarao',  region: 'Luzon', lat: 17.6132, lon: 121.7270 },
  { id: 'dagupan',     name: 'Dagupan',     region: 'Luzon', lat: 16.0430, lon: 120.3330 },
  { id: 'olongapo',    name: 'Olongapo',    region: 'Luzon', lat: 14.8292, lon: 120.2828 },
  { id: 'batangas',    name: 'Batangas City', region: 'Luzon', lat: 13.7565, lon: 121.0583 },
  { id: 'lucena',      name: 'Lucena',      region: 'Luzon', lat: 13.9374, lon: 121.6170 },
  { id: 'naga',        name: 'Naga, Camarines Sur', region: 'Luzon', lat: 13.6218, lon: 123.1948 },
  { id: 'legazpi',     name: 'Legazpi',     region: 'Luzon', lat: 13.1391, lon: 123.7438 },
  // Visayas
  { id: 'cebu',        name: 'Cebu City',   region: 'Visayas', lat: 10.3157, lon: 123.8854 },
  { id: 'mandaue',     name: 'Mandaue',     region: 'Visayas', lat: 10.3237, lon: 123.9223 },
  { id: 'iloilo',      name: 'Iloilo City', region: 'Visayas', lat: 10.7202, lon: 122.5621 },
  { id: 'bacolod',     name: 'Bacolod',     region: 'Visayas', lat: 10.6407, lon: 122.9689 },
  { id: 'tacloban',    name: 'Tacloban',    region: 'Visayas', lat: 11.2444, lon: 125.0048 },
  { id: 'ormoc',       name: 'Ormoc',       region: 'Visayas', lat: 11.0064, lon: 124.6075 },
  { id: 'dumaguete',   name: 'Dumaguete',   region: 'Visayas', lat: 9.3068,  lon: 123.3054 },
  { id: 'roxas',       name: 'Roxas City',  region: 'Visayas', lat: 11.5853, lon: 122.7511 },
  // Mindanao
  { id: 'davao',       name: 'Davao City',  region: 'Mindanao', lat: 7.1907, lon: 125.4553 },
  { id: 'cdo',         name: 'Cagayan de Oro', region: 'Mindanao', lat: 8.4542, lon: 124.6319 },
  { id: 'iligan',      name: 'Iligan',      region: 'Mindanao', lat: 8.2280, lon: 124.2452 },
  { id: 'butuan',      name: 'Butuan',      region: 'Mindanao', lat: 8.9475, lon: 125.5406 },
  { id: 'cotabato',    name: 'Cotabato City', region: 'Mindanao', lat: 7.2236, lon: 124.2464 },
  { id: 'zamboanga',   name: 'Zamboanga',   region: 'Mindanao', lat: 6.9214, lon: 122.0790 },
  { id: 'gensan',      name: 'General Santos', region: 'Mindanao', lat: 6.1164, lon: 125.1716 },
  { id: 'surigao',     name: 'Surigao',     region: 'Mindanao', lat: 9.7838, lon: 125.4889 },
];

export const DEFAULT_PLACE_ID = 'quezon-city';

export function place(id) {
  return PLACES.find((p) => p.id === id) || null;
}

export function defaultPlace() {
  return place(DEFAULT_PLACE_ID);
}

export function byRegion() {
  return REGIONS
    .map((region) => ({ region, places: PLACES.filter((p) => p.region === region) }))
    .filter((group) => group.places.length > 0);
}

// A box around the archipelago, from Tawi-Tawi to Batanes. Used only to decide
// whether to say "your location" or "your location, outside the Philippines" —
// never to refuse a coordinate.
export const BOUNDS = { south: 4.4, north: 21.5, west: 116.0, east: 127.0 };

export function inPhilippines(lat, lon) {
  return lat >= BOUNDS.south && lat <= BOUNDS.north && lon >= BOUNDS.west && lon <= BOUNDS.east;
}

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
