// Song structure detection — a real (if approximate) MIR technique, not a
// trained model: decode the whole file, compute a coarse spectral "shape"
// once per second, and find where that shape changes sharply (segment
// boundaries) and where it repeats (which segment is the chorus, since a
// chorus is — definitionally — the part that plays again). Labels like
// "Chorus"/"Verse"/"Bridge" come from that repetition + position, not from
// understanding lyrics or any labeled training data, and can misfire on
// through-composed pieces, live sets, or anything with an unconventional
// structure. Treat it as "here's roughly where things change," not ground
// truth.
//
// Everything below the ANALYZE STRUCTURE section is pure array math with no
// browser API dependency, deliberately, so it can be unit-tested without a
// DOM. Only analyzeStructure() itself needs AudioContext.decodeAudioData.

const FEATURE_BANDS = [
  [20, 60], [60, 150], [150, 300], [300, 600], [600, 1200],
  [1200, 2400], [2400, 4000], [4000, 6000], [6000, 10000], [10000, 16000],
];

const WINDOW_SIZE = 4096; // power of 2, required by the FFT below
const HOP_SECONDS = 1.0; // ~1 feature vector per second of audio
const NOVELTY_KERNEL_HALF = 6; // ~6s each side — how local a "change" has to be to count
const MIN_SEGMENT_SECONDS = 8; // merge anything shorter into a neighbor
const CLUSTER_SIMILARITY_THRESHOLD = 0.86;

/** In-place iterative radix-2 Cooley-Tukey FFT. `real`/`imag` length must be a power of 2. */
export function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len / 2;
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let j = 0; j < half; j++) {
        const ur = real[i + j], ui = imag[i + j];
        const vr = real[i + j + half] * curWr - imag[i + j + half] * curWi;
        const vi = real[i + j + half] * curWi + imag[i + j + half] * curWr;
        real[i + j] = ur + vr; imag[i + j] = ui + vi;
        real[i + j + half] = ur - vr; imag[i + j + half] = ui - vi;
        const nWr = curWr * wr - curWi * wi;
        const nWi = curWr * wi + curWi * wr;
        curWr = nWr; curWi = nWi;
      }
    }
  }
}

export function buildHannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/** Reduces a magnitude spectrum to a small, L2-normalized band-energy vector — normalized so
 * two performances of "the same section" at different volumes still read as similar in shape. */
export function computeFeatureVector(magnitudes, sampleRate, windowSize) {
  const binHz = sampleRate / windowSize;
  const vec = FEATURE_BANDS.map(([lo, hi]) => {
    const loBin = Math.max(0, Math.round(lo / binHz));
    const hiBin = Math.min(magnitudes.length - 1, Math.max(loBin + 1, Math.round(hi / binHz)));
    let sum = 0;
    for (let i = loBin; i < hiBin; i++) sum += magnitudes[i];
    return sum / (hiBin - loBin);
  });
  // norm doubles as a raw energy/loudness scalar for this window — returned
  // alongside the normalized vector so callers can use it later without
  // losing the magnitude information normalization deliberately discards.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return { vector: vec.map((v) => v / norm), energy: norm };
}

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

export function buildSimilarityMatrix(vectors) {
  const n = vectors.length;
  const ssm = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    ssm[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      ssm[i][j] = sim;
      ssm[j][i] = sim;
    }
  }
  return ssm;
}

/** Foote's checkerboard-kernel novelty function: high where the local
 * self-similarity structure changes sharply (a segment boundary), low where
 * it stays self-similar (the middle of a stable section). */
export function computeNovelty(ssm, kernelHalf = NOVELTY_KERNEL_HALF) {
  const n = ssm.length;
  const novelty = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, count = 0;
    for (let a = -kernelHalf; a < kernelHalf; a++) {
      const x = i + a;
      if (x < 0 || x >= n) continue;
      const signA = a < 0 ? -1 : 1;
      for (let b = -kernelHalf; b < kernelHalf; b++) {
        const y = i + b;
        if (y < 0 || y >= n) continue;
        const signB = b < 0 ? -1 : 1;
        sum += ssm[x][y] * signA * signB;
        count++;
      }
    }
    novelty[i] = count ? sum / count : 0;
  }
  const max = Math.max(...novelty, 1e-9);
  return Array.from(novelty, (v) => Math.max(0, v) / max);
}

/** Local maxima in the novelty curve, above the mean, at least minGapSteps apart. */
export function pickBoundaries(novelty, minGapSteps) {
  const n = novelty.length;
  const mean = novelty.reduce((s, v) => s + v, 0) / (n || 1);
  const candidates = [];
  for (let i = 1; i < n - 1; i++) {
    if (novelty[i] > mean && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]) {
      candidates.push({ i, v: novelty[i] });
    }
  }
  candidates.sort((a, b) => b.v - a.v);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.every((k) => Math.abs(k - c.i) >= minGapSteps)) chosen.push(c.i);
  }
  return chosen.sort((a, b) => a - b);
}

/** Greedy single-pass clustering by cosine similarity to the running cluster mean —
 * this is what finds "this section is basically the same audio as that one." */
export function clusterSegments(meanVectors, threshold = CLUSTER_SIMILARITY_THRESHOLD) {
  const clusters = []; // { members: [vector, ...], indices: [i, ...] }
  const assignment = [];
  meanVectors.forEach((vec, i) => {
    let best = -1, bestSim = -1;
    clusters.forEach((c, ci) => {
      const centroid = c.members.reduce((acc, v) => acc.map((x, k) => x + v[k]), vec.map(() => 0))
        .map((x) => x / c.members.length);
      const sim = cosineSimilarity(vec, centroid);
      if (sim > bestSim) { bestSim = sim; best = ci; }
    });
    if (best >= 0 && bestSim >= threshold) {
      clusters[best].members.push(vec);
      clusters[best].indices.push(i);
      assignment.push(best);
    } else {
      clusters.push({ members: [vec], indices: [i] });
      assignment.push(clusters.length - 1);
    }
  });
  return { clusters, assignment };
}

/** Picks which cluster is "the chorus": most-repeated first (must repeat at
 * least once), breaking ties — genuinely common, e.g. 3 verses vs 3
 * choruses — by average energy, since a chorus is conventionally both
 * repeated *and* fuller/louder than a verse. Without this, a tie is an
 * arbitrary pick based on which cluster happened to form first. */
function pickChorusCluster(clusters, segmentEnergy) {
  let best = -1, bestCount = 1, bestEnergy = -1;
  clusters.forEach((c, idx) => {
    if (c.indices.length < 2) return;
    const energy = c.indices.reduce((s, i) => s + segmentEnergy[i], 0) / c.indices.length;
    if (c.indices.length > bestCount || (c.indices.length === bestCount && energy > bestEnergy)) {
      best = idx; bestCount = c.indices.length; bestEnergy = energy;
    }
  });
  return best;
}

/** Turns cluster assignments into listener-facing labels. See the file header
 * for exactly what these labels do and don't mean. */
export function labelSegments(segments, assignment, clusters, duration, segmentEnergy) {
  const n = segments.length;
  const clusterCounts = clusters.map((c) => c.indices.length);
  const chorusCluster = pickChorusCluster(clusters, segmentEnergy);

  const labels = new Array(n);
  const verseNumbers = new Map();
  let nextVerseNum = 1;
  let bridgeUsed = false;

  segments.forEach((seg, i) => {
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const segDur = seg.end - seg.start;
    if (isFirst && segDur < duration * 0.15 && segDur < 25) { labels[i] = 'Intro'; return; }
    if (isLast && segDur < duration * 0.15 && segDur < 25) { labels[i] = 'Outro'; return; }

    const cIdx = assignment[i];
    if (cIdx === chorusCluster && chorusCluster !== -1) { labels[i] = 'Chorus'; return; }
    if (clusterCounts[cIdx] === 1 && !bridgeUsed && i > n * 0.4) {
      labels[i] = 'Bridge';
      bridgeUsed = true;
      return;
    }
    if (!verseNumbers.has(cIdx)) verseNumbers.set(cIdx, nextVerseNum++);
    labels[i] = `Verse ${verseNumbers.get(cIdx)}`;
  });
  return labels;
}

/** Merges any segment shorter than MIN_SEGMENT_SECONDS into its neighbor —
 * raw boundary-picking can occasionally produce a sliver next to a real one. */
function mergeShortSegments(boundaries, totalSteps) {
  const bounds = [0, ...boundaries, totalSteps];
  const merged = [bounds[0]];
  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i] - merged[merged.length - 1] < MIN_SEGMENT_SECONDS / HOP_SECONDS && i < bounds.length - 1) continue;
    merged.push(bounds[i]);
  }
  if (merged[merged.length - 1] !== bounds[bounds.length - 1]) merged.push(bounds[bounds.length - 1]);
  return merged;
}

/** Full pipeline from per-second feature vectors + energy scalars down to
 * labeled segments. `energies[i]` must correspond to `featureVectors[i]`. */
export function computeStructure(featureVectors, energies, duration) {
  if (featureVectors.length < 6) return null; // too short to say anything meaningful

  const ssm = buildSimilarityMatrix(featureVectors);
  const novelty = computeNovelty(ssm);
  const minGapSteps = Math.round(MIN_SEGMENT_SECONDS / HOP_SECONDS);
  const boundarySteps = pickBoundaries(novelty, minGapSteps);
  const bounds = mergeShortSegments(boundarySteps, featureVectors.length);
  if (bounds.length < 3) return null; // fewer than 2 real segments — nothing to show

  const segments = [];
  const meanVectors = [];
  const segmentEnergy = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i], to = bounds[i + 1];
    const slice = featureVectors.slice(from, to);
    const mean = slice.reduce((acc, v) => acc.map((x, k) => x + v[k]), slice[0].map(() => 0))
      .map((x) => x / slice.length);
    meanVectors.push(mean);
    const energySlice = energies.slice(from, to);
    segmentEnergy.push(energySlice.reduce((s, e) => s + e, 0) / energySlice.length);
    segments.push({
      start: from * HOP_SECONDS,
      end: (i === bounds.length - 2 ? duration : to * HOP_SECONDS),
    });
  }

  const { clusters, assignment } = clusterSegments(meanVectors);
  const labels = labelSegments(segments, assignment, clusters, duration, segmentEnergy);
  // energy is each segment's average raw (unnormalized) magnitude — only
  // meaningful relative to other segments of the *same* track, which is all
  // the director agent uses it for (is the next section louder or quieter
  // than this one).
  return segments.map((seg, i) => ({ ...seg, label: labels[i], energy: segmentEnergy[i] }));
}

// ---------------- ANALYZE STRUCTURE (browser-only: needs decodeAudioData) ----------------

function mixToMono(audioBuffer) {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0);
  const len = audioBuffer.length;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += data[i] / audioBuffer.numberOfChannels;
  }
  return mono;
}

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Decodes an audio File and returns labeled structure segments, or null if
 * nothing meaningful could be found (very short clips, decode failure, etc).
 * Runs entirely in the browser off the main thread's critical path isn't
 * guaranteed (no worker — this is plain JS math), so it yields periodically
 * during the FFT pass to avoid janking playback controls on longer files.
 */
export async function analyzeStructure(file, { onProgress } = {}) {
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return null;
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new Ctx();
  let audioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  } finally {
    decodeCtx.close?.().catch(() => {});
  }

  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const channelData = mixToMono(audioBuffer);
  const hop = Math.round(sampleRate * HOP_SECONDS);
  const hann = buildHannWindow(WINDOW_SIZE);
  const real = new Float64Array(WINDOW_SIZE);
  const imag = new Float64Array(WINDOW_SIZE);
  const half = WINDOW_SIZE / 2;
  const featureVectors = [];
  const energies = [];

  let windowCount = 0;
  for (let start = 0; start + WINDOW_SIZE <= channelData.length; start += hop) {
    for (let i = 0; i < WINDOW_SIZE; i++) {
      real[i] = channelData[start + i] * hann[i];
      imag[i] = 0;
    }
    fft(real, imag);
    const mags = new Float64Array(half);
    for (let i = 0; i < half; i++) mags[i] = Math.hypot(real[i], imag[i]);
    const { vector, energy } = computeFeatureVector(mags, sampleRate, WINDOW_SIZE);
    featureVectors.push(vector);
    energies.push(energy);

    windowCount++;
    if (windowCount % 40 === 0) {
      onProgress?.(start / channelData.length);
      await yieldToMain();
    }
  }

  return computeStructure(featureVectors, energies, duration);
}
