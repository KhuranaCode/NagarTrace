/**
 * Tests for src/evidence/photo-metadata.ts
 *
 * Run from the repo root with Node >= 22 (built-in TypeScript support, no deps):
 *   node --test tests/evidence/
 *
 * Fixtures are built in code - no binary test files needed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assessEvidence,
  detectFormat,
  distanceMeters,
  formatVerdict,
  parsePhotoMetadata,
  stripJpegMetadata,
} from '../../src/evidence/photo-metadata.ts'

// --- fixture builders -------------------------------------------------------

function str(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0))
}

function tiffHeader(little: boolean): number[] {
  return little ? str('II').concat([42, 0, 8, 0, 0, 0]) : str('MM').concat([0, 42, 0, 0, 0, 8])
}

interface Entry {
  tag: number
  type: number
  count: number
  value: number[] // raw bytes; <=4 inline, else placed in overflow area
}

/** Build a minimal TIFF blob: header, one IFD, overflow data, then extra blobs. */
function buildTiff(entries: Entry[], extras: number[][] = []): Uint8Array {
  const ifdSize = 2 + entries.length * 12 + 4
  const overflowDataLen = entries.filter((e) => e.value.length > 4).reduce((n, e) => n + e.value.length, 0)
  const extraOffsets: number[] = []
  let cursor = 8 + ifdSize + overflowDataLen
  for (const e of extras) {
    extraOffsets.push(cursor)
    cursor += e.length
  }
  const bytes: number[] = tiffHeader(true)
  bytes.push(entries.length, 0)
  const overflowData: number[] = []
  let overflow = 8 + ifdSize
  for (const e of entries) {
    bytes.push(e.tag & 0xff, e.tag >> 8, e.type, 0, e.count & 0xff, (e.count >> 8) & 0xff, (e.count >> 16) & 0xff, (e.count >> 24) & 0xff)
    if (e.value.length <= 4) {
      bytes.push(...e.value, ...[0, 0, 0, 0].slice(e.value.length))
    } else {
      bytes.push(overflow & 0xff, (overflow >> 8) & 0xff, (overflow >> 16) & 0xff, (overflow >> 24) & 0xff)
      overflow += e.value.length
      overflowData.push(...e.value)
    }
  }
  bytes.push(0, 0, 0, 0) // next IFD = none
  bytes.push(...overflowData)
  for (const e of extras) bytes.push(...e)
  void extraOffsets
  return Uint8Array.from(bytes)
}

function asciiEntry(tag: number, s: string): Entry {
  return { tag, type: 2, count: s.length + 1, value: str(s).concat([0]) }
}

/** Build a sub-IFD whose value offsets are absolute TIFF offsets (base = where it will sit). */
function buildSubIfd(entries: Entry[], base: number): number[] {
  const size = 2 + entries.length * 12 + 4
  let overflow = base + size
  const bytes: number[] = [entries.length, 0]
  const overflowData: number[] = []
  for (const e of entries) {
    bytes.push(e.tag & 0xff, e.tag >> 8, e.type, 0, e.count & 0xff, (e.count >> 8) & 0xff, (e.count >> 16) & 0xff, (e.count >> 24) & 0xff)
    if (e.value.length <= 4) {
      bytes.push(...e.value, ...[0, 0, 0, 0].slice(e.value.length))
    } else {
      bytes.push(overflow & 0xff, (overflow >> 8) & 0xff, (overflow >> 16) & 0xff, (overflow >> 24) & 0xff)
      overflow += e.value.length
      overflowData.push(...e.value)
    }
  }
  bytes.push(0, 0, 0, 0, ...overflowData)
  return bytes
}

function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
}

function rational(n: number, d: number): number[] {
  return [...u32le(n), ...u32le(d)]
}

function jpegSegment(marker: number, body: number[]): number[] {
  const len = body.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...body]
}

function jpegWithExif(tiff: Uint8Array): Blob {
  const sof = jpegSegment(0xc0, [8, 0, 2, 0, 3, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]) // 3x2 SOF0
  const app1 = jpegSegment(0xe1, [...str('Exif\0\0'), ...tiff])
  const sos = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0]
  return new Blob([Uint8Array.from([0xff, 0xd8, ...app1, ...sof, ...sos, 0xff, 0xd9])], { type: 'image/jpeg' })
}

// --- tests ------------------------------------------------------------------

test('detectFormat recognises JPEG, PNG, WebP, HEIC, unknown', () => {
  const dv = (bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer)
  assert.equal(detectFormat(dv([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpeg')
  assert.equal(detectFormat(dv([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'png')
  assert.equal(detectFormat(dv([...str('RIFF'), 0, 0, 0, 0, ...str('WEBP')])), 'webp')
  assert.equal(detectFormat(dv([0, 0, 0, 0, ...str('ftyp'), ...str('heic')])), 'heic')
  assert.equal(detectFormat(dv([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), 'unknown')
})

test('parses camera make/model, software, capture time from JPEG EXIF', async () => {
  const entries = [asciiEntry(0x010f, 'samsung'), asciiEntry(0x0110, 'SM-A546E'), asciiEntry(0x0131, 'FW1')]
  const ifd0Overflow = entries.filter((e) => e.value.length > 4).reduce((n, e) => n + e.value.length, 0)
  const exifPtr = 8 + 2 + (entries.length + 1) * 12 + 4 + ifd0Overflow
  const exifSub = buildSubIfd([asciiEntry(0x9003, '2026:10:30 14:22:05'), asciiEntry(0x9011, '+05:30')], exifPtr)
  const tiff = buildTiff([...entries, { tag: 0x8769, type: 4, count: 1, value: u32le(exifPtr) }], [exifSub])
  const meta = await parsePhotoMetadata(jpegWithExif(tiff))
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, 3)
  assert.equal(meta.height, 2)
  assert.equal(meta.cameraMake, 'samsung')
  assert.equal(meta.cameraModel, 'SM-A546E')
  assert.equal(meta.software, 'FW1')
  assert.ok(meta.capturedAt instanceof Date)
  assert.equal(meta.capturedAt!.toISOString(), '2026-10-30T08:52:05.000Z')
  assert.equal(meta.capturedOffset, '+05:30')
})

test('parses embedded GPS from EXIF GPS IFD', async () => {
  // GPS sub-IFD: lat 28.6139 N (28 deg 36' 50.04"), lon 77.2090 E
  const latVals = [...rational(28, 1), ...rational(36, 1), ...rational(5004, 100)]
  const lonVals = [...rational(77, 1), ...rational(12, 1), ...rational(3240, 100)]
  const gpsEntries: Entry[] = [
    { tag: 1, type: 2, count: 2, value: str('N\0') },
    { tag: 2, type: 5, count: 3, value: latVals },
    { tag: 3, type: 2, count: 2, value: str('E\0') },
    { tag: 4, type: 5, count: 3, value: lonVals },
  ]
  const ifd0Size = 2 + 12 + 4
  const gpsPtr = 8 + ifd0Size
  const gpsSub = buildSubIfd(gpsEntries, gpsPtr)
  const tiff = buildTiff([{ tag: 0x8825, type: 4, count: 1, value: u32le(gpsPtr) }], [gpsSub])
  const meta = await parsePhotoMetadata(jpegWithExif(tiff))
  assert.ok(meta.gps)
  assert.ok(Math.abs(meta.gps!.lat - 28.6139) < 0.0001, `lat ${meta.gps!.lat}`)
  assert.ok(Math.abs(meta.gps!.lon - 77.209) < 0.0001, `lon ${meta.gps!.lon}`)
})

test('flags AI generator signature in PNG text chunk as review-suggested', async () => {
  const ihdr = [0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const chunk = (type: string, body: number[]): number[] => {
    return [...u32be(body.length), ...str(type), ...body, 0, 0, 0, 0]
  }
  function u32be(n: number): number[] {
    return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
  }
  const text = chunk('tEXt', [...str('parameters\0DreamShaper on Stable Diffusion, steps: 30')])
  const png = new Blob([Uint8Array.from([...pngHeader, ...chunk('IHDR', ihdr), ...text, ...chunk('IEND', [])])], { type: 'image/png' })
  const meta = await parsePhotoMetadata(png)
  assert.equal(meta.format, 'png')
  assert.equal(meta.width, 2)
  const a = assessEvidence(meta, { reportLat: 28.6, reportLon: 77.2 })
  assert.equal(a.verdict, 'review-suggested')
  const sig = a.signals.find((s) => s.id === 'ai-generator-signature')!
  assert.equal(sig.state, 'absent')
  assert.match(sig.detail, /Stable Diffusion/)
})

test('empty-metadata JPEG yields insufficient-data, never a fake verdict', async () => {
  const sof = jpegSegment(0xc0, [8, 0, 4, 0, 4, 1, 1, 0x11, 0])
  const sos = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0]
  const blob = new Blob([Uint8Array.from([0xff, 0xd8, ...sof, ...sos, 0xff, 0xd9])], { type: 'image/jpeg' })
  const meta = await parsePhotoMetadata(blob)
  assert.equal(meta.capturedAt, null)
  const a = assessEvidence(meta)
  assert.equal(a.verdict, 'insufficient-data')
  assert.doesNotMatch(a.summary, /fake|forged|manipulat/i)
  for (const id of ['capture-timestamp', 'embedded-gps', 'camera-identity', 'capture-time-vs-report'] as const) {
    const sig = a.signals.find((s) => s.id === id)!
    assert.equal(sig.state, 'unknown')
    assert.match(sig.detail.toLowerCase(), /unknown|no .*recorded|cannot compare/)
  }
})

test('GPS mismatch beyond tolerance suggests review', async () => {
  const gpsPtr = 8 + 2 + 12 + 4
  const gpsSub = buildSubIfd(
    [
      { tag: 1, type: 2, count: 2, value: str('N\0') },
      { tag: 2, type: 5, count: 3, value: [...rational(28, 1), ...rational(36, 1), ...rational(5004, 100)] },
      { tag: 3, type: 2, count: 2, value: str('E\0') },
      { tag: 4, type: 5, count: 3, value: [...rational(77, 1), ...rational(12, 1), ...rational(3240, 100)] },
    ],
    gpsPtr,
  )
  const tiff = buildTiff([{ tag: 0x8825, type: 4, count: 1, value: u32le(gpsPtr) }], [gpsSub])
  const meta = await parsePhotoMetadata(jpegWithExif(tiff))
  const near = assessEvidence(meta, { reportLat: 28.614, reportLon: 77.209 })
  assert.equal(near.signals.find((s) => s.id === 'gps-matches-report')!.state, 'present')
  const far = assessEvidence(meta, { reportLat: 19.076, reportLon: 72.8777 }) // Mumbai vs Delhi
  assert.equal(far.signals.find((s) => s.id === 'gps-matches-report')!.state, 'absent')
  assert.equal(far.verdict, 'review-suggested')
})

test('distanceMeters sanity: Delhi to Mumbai ~1150 km', () => {
  const d = distanceMeters({ lat: 28.6139, lon: 77.209 }, { lat: 19.076, lon: 72.8777 })
  assert.ok(d > 1_100_000 && d < 1_200_000, `${d}`)
})

test('stripJpegMetadata removes EXIF but keeps pixels byte-identical', async () => {
  const tiff = buildTiff([asciiEntry(0x010f, 'samsung')], [])
  const original = jpegWithExif(tiff)
  const stripped = await stripJpegMetadata(original)
  assert.ok(stripped)
  const before = new Uint8Array(await original.arrayBuffer())
  const after = new Uint8Array(await stripped!.arrayBuffer())
  assert.ok(after.length < before.length)
  const meta = await parsePhotoMetadata(stripped!)
  assert.equal(meta.cameraMake, null)
  // Scan data (everything after SOS marker in the original) must survive verbatim.
  const sosIdx = before.findIndex((_, i) => before[i] === 0xff && before[i + 1] === 0xda)
  const scanTail = before.slice(sosIdx)
  const afterTail = after.slice(after.length - scanTail.length)
  assert.deepEqual([...afterTail], [...scanTail])
})

test('stripJpegMetadata returns null for non-JPEG', async () => {
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' })
  assert.equal(await stripJpegMetadata(png), null)
})

test('verdict labels stay non-accusatory', () => {
  assert.equal(formatVerdict('consistent'), 'No red flags found')
  assert.equal(formatVerdict('review-suggested'), 'Officer review suggested')
  assert.equal(formatVerdict('inconclusive'), 'Inconclusive')
  assert.equal(formatVerdict('insufficient-data'), 'No usable metadata')
})

test('C2PA APP11 marker detected in JPEG', async () => {
  const jumb = jpegSegment(0xeb, [...str('JP'), 0, 0, ...str('jumb'), ...str('c2pa')])
  const sof = jpegSegment(0xc0, [8, 0, 4, 0, 4, 1, 1, 0x11, 0])
  const sos = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0]
  const blob = new Blob([Uint8Array.from([0xff, 0xd8, ...jumb, ...sof, ...sos, 0xff, 0xd9])], { type: 'image/jpeg' })
  const meta = await parsePhotoMetadata(blob)
  assert.equal(meta.hasC2paManifest, true)
})
