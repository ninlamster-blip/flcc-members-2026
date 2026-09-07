// The map projection, written out rather than imported.
//
// A slippy map is four equations and some absolutely positioned images. Every
// mapping library is those four equations plus a great deal else, and this app
// has no build step and no dependencies — so here are the four.
//
// Web Mercator, the projection every tile server on earth uses: the world is
// one square at zoom 0, four at zoom 1, and 4^z at zoom z.

export const TILE_SIZE = 256;

export const lonToTileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;

export function latToTileY(lat, z) {
  // Mercator cannot represent the poles, so latitude is clamped to the band
  // the projection is defined over.
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const r = (clamped * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
  // At the clamp itself the arithmetic lands a hair outside the world — a few
  // ten-billionths of a tile, but negative, and `viewport` drops rows above the
  // top of the world. Pin the ends rather than lose a row of tiles to rounding.
  return Math.max(0, Math.min(2 ** z, y));
}

export const tileXToLon = (x, z) => (x / 2 ** z) * 360 - 180;

export function tileYToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Tile coordinates wrap around the world eastward and clamp at the poles. */
export function wrap(x, z) {
  const span = 2 ** z;
  return ((x % span) + span) % span;
}

/**
 * Which tiles cover a viewport, and where each one sits inside it.
 *
 * @returns {{tiles: Array<{x, y, z, key, left, top}>, originX, originY}}
 *          `x` is wrapped for the URL; `left`/`top` are pixel offsets.
 */
export function viewport({ lat, lon, zoom, width, height, tileSize = TILE_SIZE }) {
  const z = Math.max(0, Math.round(zoom));
  const centreX = lonToTileX(lon, z);
  const centreY = latToTileY(lat, z);

  // The pixel position of the top-left corner of the viewport, in world pixels.
  const originX = centreX * tileSize - width / 2;
  const originY = centreY * tileSize - height / 2;

  const firstX = Math.floor(originX / tileSize);
  const firstY = Math.floor(originY / tileSize);
  const lastX = Math.floor((originX + width) / tileSize);
  const lastY = Math.floor((originY + height) / tileSize);

  const span = 2 ** z;
  const tiles = [];
  for (let y = firstY; y <= lastY; y++) {
    if (y < 0 || y >= span) continue; // above the north pole or below the south
    for (let x = firstX; x <= lastX; x++) {
      tiles.push({
        x: wrap(x, z),
        y,
        z,
        key: `${z}/${wrap(x, z)}/${y}`,
        left: Math.round(x * tileSize - originX),
        top: Math.round(y * tileSize - originY),
      });
    }
  }
  return { tiles, originX, originY };
}

/** Where a coordinate lands inside that viewport, in pixels. */
export function pointIn({ lat, lon }, view) {
  const { zoom, tileSize = TILE_SIZE } = view;
  const z = Math.max(0, Math.round(zoom));
  return {
    left: Math.round(lonToTileX(lon, z) * tileSize - view.originX),
    top: Math.round(latToTileY(lat, z) * tileSize - view.originY),
  };
}

/** Panning by a pixel drag → the new centre. */
export function panBy({ lat, lon, zoom, tileSize = TILE_SIZE }, dx, dy) {
  const z = Math.max(0, Math.round(zoom));
  const x = lonToTileX(lon, z) - dx / tileSize;
  const y = latToTileY(lat, z) - dy / tileSize;
  const span = 2 ** z;
  return {
    lon: tileXToLon(((x % span) + span) % span, z),
    lat: tileYToLat(Math.max(0, Math.min(span, y)), z),
  };
}
