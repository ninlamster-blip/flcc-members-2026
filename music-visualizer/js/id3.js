// Minimal ID3v2.3/2.4 reader — just enough to pull title/artist/album/cover
// art out of a local audio file client-side. No network calls, no
// dependency. Falls back gracefully (returns nulls) for files with no tag,
// ID3v1-only tags, or unsupported formats — callers should have their own
// filename-based fallback.

function readSynchsafeInt(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) |
         ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}

function readUInt32BE(bytes, offset) {
  return (bytes[offset] << 24 | bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]) >>> 0;
}

function decodeText(bytes) {
  if (!bytes.length) return '';
  const encodingByte = bytes[0];
  const body = bytes.subarray(1);
  try {
    if (encodingByte === 0) {
      return new TextDecoder('iso-8859-1').decode(body).replace(/\0+$/, '').trim();
    }
    if (encodingByte === 1) {
      // UTF-16 with BOM
      const hasBom = body.length >= 2;
      const little = hasBom ? (body[0] === 0xff && body[1] === 0xfe) : true;
      const decoder = new TextDecoder(little ? 'utf-16le' : 'utf-16be');
      return decoder.decode(body).replace(/\0+$/, '').trim();
    }
    if (encodingByte === 2) {
      return new TextDecoder('utf-16be').decode(body).replace(/\0+$/, '').trim();
    }
    return new TextDecoder('utf-8').decode(body).replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

function parseApicFrame(bytes) {
  // [encoding:1][mime:cstring][pictureType:1][description:cstring][data...]
  const encodingByte = bytes[0];
  let i = 1;
  let mime = '';
  while (i < bytes.length && bytes[i] !== 0) { mime += String.fromCharCode(bytes[i]); i++; }
  i++; // skip null
  i++; // skip picture type byte
  const isUtf16 = encodingByte === 1 || encodingByte === 2;
  if (isUtf16) {
    while (i + 1 < bytes.length && !(bytes[i] === 0 && bytes[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < bytes.length && bytes[i] !== 0) i++;
    i++;
  }
  const imageData = bytes.subarray(i);
  if (!mime || !imageData.length) return null;
  return { mimeType: mime || 'image/jpeg', data: imageData };
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {{ title: ?string, artist: ?string, album: ?string, picture: ?{ mimeType: string, blob: Blob } }}
 */
export function parseID3(buffer) {
  const result = { title: null, artist: null, album: null, picture: null };
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12));
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return result; // no "ID3" magic
  }

  const majorVersion = bytes[3];
  const flags = bytes[5];
  const view = new Uint8Array(buffer);
  const tagSize = readSynchsafeInt(view, 6);
  let offset = 10;
  if (flags & 0x40) {
    // extended header present — skip it
    const extSize = majorVersion >= 4 ? readSynchsafeInt(view, offset) : readUInt32BE(view, offset);
    offset += extSize;
  }

  const tagEnd = Math.min(view.length, 10 + tagSize);

  while (offset + 10 <= tagEnd) {
    const id = String.fromCharCode(view[offset], view[offset + 1], view[offset + 2], view[offset + 3]);
    if (id === '\0\0\0\0') break;

    const frameSize = majorVersion >= 4
      ? readSynchsafeInt(view, offset + 4)
      : readUInt32BE(view, offset + 4);
    const frameHeaderLen = 10;
    const frameStart = offset + frameHeaderLen;
    const frameEnd = frameStart + frameSize;
    if (frameSize <= 0 || frameEnd > tagEnd) break;

    const frameBytes = view.subarray(frameStart, frameEnd);

    if (id === 'TIT2') result.title = decodeText(frameBytes) || result.title;
    else if (id === 'TPE1') result.artist = decodeText(frameBytes) || result.artist;
    else if (id === 'TALB') result.album = decodeText(frameBytes) || result.album;
    else if (id === 'APIC' && !result.picture) {
      const pic = parseApicFrame(frameBytes);
      if (pic) {
        const blob = new Blob([pic.data], { type: pic.mimeType });
        result.picture = { mimeType: pic.mimeType, blob };
      }
    }

    offset = frameEnd;
  }

  return result;
}

/** Best-effort "Artist - Title" guess from a bare filename, for files with no usable tag. */
export function guessFromFilename(filename) {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
  const parts = base.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: null, title: base };
}
