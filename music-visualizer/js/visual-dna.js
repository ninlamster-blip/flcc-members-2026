// Visual DNA — a five-axis "fingerprint" for a track, rendered as a small
// radar-style glyph colored by the AI Director's current mood hue. Two axes
// (stereo width, dynamic range) come from a one-time full-file measurement;
// the other three (tempo, energy, vocal presence) come from what's actually
// been observed while playing it, refining across repeat plays rather than
// being computed all at once. Not audio fingerprinting or song
// identification — see fingerprint.js for that; this is just a compact
// visual summary of a few real, already-computed signals, not a trained
// embedding or anything ML-derived.

export const DNA_AXES = ['tempo', 'energy', 'stereoWidth', 'dynamicRange', 'vocalPresence'];

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function normalizeTempo(bpm) {
  if (bpm == null || !isFinite(bpm)) return 0.4; // neutral default for undetected tempo
  return clamp01((bpm - 60) / 140); // 60-200bpm -> 0..1
}

// ~3-20dB covers most real-world material: heavily compressed/limited
// masters sit low, dynamic acoustic/classical recordings sit high.
export function normalizeDynamicRange(db) {
  if (db == null || !isFinite(db)) return 0.5;
  return clamp01((db - 3) / 17);
}

/** Stereo width: 0 = channels identical (mono, or a mono source), 1 = fully
 * decorrelated. Based on the normalized cross-correlation between L and R
 * sampled across the whole file — a standard, if approximate, width
 * estimate, not a perceptual loudness model. */
export function computeStereoWidth(buffer) {
  if (buffer.numberOfChannels < 2) return 0;
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const step = Math.max(1, Math.floor(left.length / 200000));
  let sumLR = 0, sumLL = 0, sumRR = 0;
  for (let i = 0; i < left.length; i += step) {
    sumLR += left[i] * right[i];
    sumLL += left[i] * left[i];
    sumRR += right[i] * right[i];
  }
  const denom = Math.sqrt(sumLL * sumRR);
  const correlation = denom > 0 ? sumLR / denom : 1;
  return clamp01(1 - correlation);
}

/** Dynamic range as a crest factor: 20*log10(peak/rms) in dB, sampled
 * across the whole file on one channel — a standard, real measurement, not
 * a broadcast-standard LU/LRA loudness computation. */
export function computeDynamicRange(buffer) {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / 200000));
  let peak = 0, sumSquares = 0, count = 0;
  for (let i = 0; i < data.length; i += step) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
    sumSquares += data[i] * data[i];
    count++;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, count));
  if (rms <= 0 || peak <= 0) return null;
  return 20 * Math.log10(peak / rms);
}

/** Decodes a file once and returns its offline-measurable DNA stats.
 * Browser-only (decodeAudioData). Returns null on decode failure. */
export async function analyzeAudioStats(file) {
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return null;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let buffer;
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  } finally {
    ctx.close?.().catch(() => {});
  }
  return {
    stereoWidth: computeStereoWidth(buffer),
    dynamicRangeDb: computeDynamicRange(buffer),
  };
}

/** Builds the 5-axis 0..1 vector from whatever data is currently available.
 * Any input may be null/undefined (not yet analyzed, or not yet played
 * enough to observe) — each axis falls back to a neutral default rather
 * than collapsing the glyph to a point. */
export function buildDnaVector({ bpm, energy, vocalPresence, stereoWidth, dynamicRangeDb } = {}) {
  return {
    tempo: normalizeTempo(bpm),
    energy: clamp01(energy ?? 0.4),
    stereoWidth: clamp01(stereoWidth ?? 0),
    dynamicRange: normalizeDynamicRange(dynamicRangeDb),
    vocalPresence: clamp01(vocalPresence ?? 0.3),
  };
}

/** SVG polygon point string for a regular pentagon radar chart, one vertex
 * per axis (in DNA_AXES order), radius scaled by that axis's 0..1 value.
 * Never fully collapses to the center, so a near-zero axis still reads as
 * part of the shape rather than vanishing. */
export function dnaPolygonPoints(vector, radius = 40, cx = 50, cy = 50) {
  return DNA_AXES.map((axis, i) => {
    const value = clamp01(vector[axis] ?? 0);
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / DNA_AXES.length;
    const r = radius * (0.15 + value * 0.85);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
