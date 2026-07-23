# FLCC Music Visualizer 🎧

A real-time, audio-reactive visual engine for worship and practice. Kick,
bass, snare, hi-hats, and vocals each drive their own part of the scene, and
an AI Visual Director picks the palette and pacing as the song moves.

**This is a standalone app** — it has no navigation to or from the members
app and installs to the home screen under its own icon (Share → Add to Home
Screen on iOS, or the install prompt in Chrome/Edge). It shares only this
repository for hosting.

## How it works

- **Audio source**: drop in local audio files (drag-and-drop or the file
  picker, with a small playlist/prev/next), or connect a microphone / line-in
  for projecting during an actual service.
- **Analysis**: the Web Audio API's `AnalyserNode` gives real FFT data, split
  into the classic mix-engineering bands — kick (20–60Hz), bass (60–250Hz),
  low guitar (250–500Hz), vocals (500Hz–2kHz), snare (2–4kHz), hi-hat
  (4–8kHz), cymbals (8–16kHz) — each with adaptive per-band onset (transient)
  detection and a rolling BPM estimate from kick/snare onsets. These are
  frequency-band labels, not true ML instrument separation — a browser can't
  actually tell a guitar from a synth pad in the same range, so treat "guitar"
  and "vocals" as "energy in that part of the spectrum," not a claim of
  source isolation.
- **Visuals**: a Three.js scene — a glowing core that breathes with bass and
  punches on kick, pooled shockwave rings for kick/snare, a particle shell
  that sparkles on hi-hats, ribbons reacting to vocal energy, a noise-shader
  background, and camera choreography, with optional bloom.
- **AI Visual Director**: an on-device heuristic (no backend — this is a
  static site) that scores Worship/Rock/Jazz/EDM/Classical/Ambient themes
  against live energy, BPM, and bass/treble balance, and crossfades into the
  winner with hysteresis so it doesn't flicker between a song's quieter and
  louder sections.
- **Metadata**: a small hand-rolled ID3v2 parser pulls title/artist/album art
  straight out of local files — no network calls, no Spotify/Apple Music
  account needed. `MediaSession` API wiring means OS media keys and the
  lock-screen also work.

## Offline

`sw.js` precaches the app shell (markup, styles, logic, icons), so the page
opens instantly from the home-screen icon with no signal. Three.js itself
loads from a CDN at runtime and isn't precached — without a network the shell
still opens, the 3D scene just can't start until the CDN is reachable again.

## Privacy

Everything runs on-device. No accounts, no analytics, no uploads — audio
files and microphone input never leave the browser.

## Icons

`icons/` holds a generated placeholder (glowing ring mark on the app's own
dark/orange palette) at the sizes `manifest.webmanifest` expects: 192,
512, a maskable 512 (content kept inside the safe center ~80%), and a
180×180 Apple touch icon. Swap them for real artwork any time — same
filenames, same sizes.
