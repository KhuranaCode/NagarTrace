/**
 * photo-metadata.ts - browser-side photo evidence metadata inspection.
 *
 * Reads metadata from a photo Blob entirely on the device (no upload, no
 * third-party service, no paid API) and turns it into honest review signals
 * for report / repair / dispute evidence photos.
 *
 * Design rules baked into the types below:
 *  - Every signal has an explicit 'unknown' state. Missing or stripped
 *    metadata is reported as unknown, never as proof of manipulation.
 *  - Nothing here can certify a photo as genuine or as fake. Metadata is
 *    advisory: messaging apps strip it and editors can forge it. The verdict
 *    vocabulary is deliberately limited to
 *    'consistent' | 'review-suggested' | 'inconclusive' | 'insufficient-data'.
 *  - GPS handling is opt-in: parsing exposes embedded GPS, and
 *    stripPhotoMetadata() lets a reporter remove hidden metadata (including
 *    GPS) before upload. Photos stay private to issue participants; this
 *    utility never changes that.
 *
 * Zero dependencies. Runs in the browser (Blob/DataView) and in Node >= 18
 * for tests. Handles JPEG (EXIF + XMP + C2PA marker), PNG (eXIf, tEXt, zTXt,
 * iTXt) and WebP (EXIF/XMP chunks, VP8/VP8L/VP8X dimensions). HEIC/AVIF are
 * detected but not parsed (their metadata stays unknown).
 */

export type PhotoFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'unknown'
export type SignalState = 'present' | 'absent' | 'unknown'

export interface EmbeddedGps {
  lat: number
  lon: number
  altitudeM: number | null
}

export interface PhotoMetadata {
  format: PhotoFormat
  byteSize: number
  width: number | null
  height: number | null
  /** EXIF DateTimeOriginal (when the camera says the shot was taken), parsed to a Date. */
  capturedAt: Date | null
  /** Raw EXIF OffsetTimeOriginal like '+05:30', when present. */
  capturedOffset: string | null
  /** EXIF ModifyDate (last edit timestamp recorded by software), parsed to a Date. */
  modifiedAt: Date | null
  cameraMake: string | null
  cameraModel: string | null
  lensModel: string | null
  /** EXIF Software tag, e.g. an editor or camera firmware name. */
  software: string | null
  /** Embedded GPS coordinates, when the file carries them. */
  gps: EmbeddedGps | null
  /** EXIF orientation 1-8, null when absent. */
  orientation: number | null
  /** True when the file carries a C2PA content-credentials manifest. */
  hasC2paManifest: boolean
  /** Distinct XMP text found in the file (already stringified, truncated). */
  xmpText: string[]
  /** Free-text metadata strings (PNG text chunks, EXIF UserComment, XMP) worth scanning. */
  textAnnotations: string[]
}

export type SignalId =
  | 'capture-timestamp'
  | 'embedded-gps'
  | 'gps-matches-report'
  | 'camera-identity'
  | 'capture-time-vs-report'
  | 'editing-software'
  | 'ai-generator-signature'
  | 'provenance-credentials'

export interface MetadataSignal {
  id: SignalId
  state: SignalState
  /** One short label for UI, e.g. "Capture time". */
  label: string
  /** One or two sentences of honest explanation; says 'unknown' when it is. */
  detail: string
}

export type AssessmentVerdict = 'consistent' | 'review-suggested' | 'inconclusive' | 'insufficient-data'

export interface MetadataAssessment {
  verdict: AssessmentVerdict
  /** Plain-language summary. Never claims authenticity or forgery. */
  summary: string
  signals: MetadataSignal[]
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function ascii(view: DataView, start: number, length: number): string {
  let out = ''
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    out += String.fromCharCode(view.getUint8(start + i))
  }
  return out
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

// ---------------------------------------------------------------------------
// Container detection
// ---------------------------------------------------------------------------

export function detectFormat(view: DataView): PhotoFormat {
  if (view.byteLength < 12) return 'unknown'
  if (view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8) return 'jpeg'
  if (
    view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a
  ) {
    return 'png'
  }
  if (ascii(view, 0, 4) === 'RIFF' && ascii(view, 8, 4) === 'WEBP') return 'webp'
  if (ascii(view, 4, 4) === 'ftyp') {
    const brand = ascii(view, 8, 4)
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'mif1') return 'heic'
    if (brand === 'avif' || brand === 'avis') return 'avif'
  }
  return 'unknown'
}

// ---------------------------------------------------------------------------
// JPEG segment scan
// ---------------------------------------------------------------------------

interface JpegScan {
  sofWidth: number | null
  sofHeight: number | null
  exif: Uint8Array[] // TIFF payloads (after the "Exif\0\0" header)
  xmp: string[]
  app13Text: string[]
  hasC2pa: boolean
}

function scanJpeg(view: DataView): JpegScan {
  const out: JpegScan = { sofWidth: null, sofHeight: null, exif: [], xmp: [], app13Text: [], hasC2pa: false }
  let pos = 2 // skip SOI
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) {
      pos++
      continue
    }
    const marker = view.getUint8(pos + 1)
    if (marker === 0xd9 || marker === 0xda) break // EOI or start of scan data
    const len = view.getUint16(pos + 2)
    const body = pos + 4
    if (body + len - 2 > view.byteLength) break
    if (marker === 0xe1) {
      if (ascii(view, body, 6) === 'Exif\0\0') {
        out.exif.push(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body + 6, view.byteOffset + body + len - 2)))
      } else if (ascii(view, body, 29) === 'http://ns.adobe.com/xap/1.0/\0') {
        out.xmp.push(bytesToText(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body + 29, view.byteOffset + body + len - 2))))
      }
    }
    if (marker === 0xeb) {
      // APP11: C2PA JUMBF manifest marker ('JP' header) - presence only.
      if (ascii(view, body, 2) === 'JP' && ascii(view, body + 4, 4) === 'jumb') out.hasC2pa = true
    }
    if (marker === 0xed) {
      // APP13: IPTC / Photoshop IRB - keep text for signature scanning.
      out.app13Text.push(bytesToText(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len - 2))))
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      out.sofHeight = view.getUint16(body + 1)
      out.sofWidth = view.getUint16(body + 3)
    }
    pos = body + len - 2
  }
  return out
}

// ---------------------------------------------------------------------------
// TIFF / EXIF parse (shared by JPEG APP1, PNG eXIf, WebP EXIF)
// ---------------------------------------------------------------------------

interface ExifValues {
  make: string | null
  model: string | null
  lensModel: string | null
  software: string | null
  modifyDate: string | null
  dateTimeOriginal: string | null
  offsetTimeOriginal: string | null
  orientation: number | null
  userComment: string | null
  gps: EmbeddedGps | null
}

type Ifd = Map<number, { type: number; count: number; valueOffset: number }>

function readIfd(view: DataView, start: number, little: boolean): Ifd {
  const ifd: Ifd = new Map()
  if (start + 2 > view.byteLength) return ifd
  const count = view.getUint16(start, little)
  for (let i = 0; i < count; i++) {
    const entry = start + 2 + i * 12
    if (entry + 12 > view.byteLength) break
    ifd.set(view.getUint16(entry, little), {
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      valueOffset: entry + 8,
    })
  }
  return ifd
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

function entryBytes(view: DataView, entry: { type: number; count: number; valueOffset: number }, little: boolean): Uint8Array | null {
  const size = (TYPE_SIZE[entry.type] ?? 1) * entry.count
  const base = size <= 4 ? entry.valueOffset : view.getUint32(entry.valueOffset, little)
  if (base + size > view.byteLength) return null
  return new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + base, view.byteOffset + base + size))
}

function entryAscii(view: DataView, ifd: Ifd, tag: number, little: boolean): string | null {
  const e = ifd.get(tag)
  if (!e) return null
  const bytes = entryBytes(view, e, little)
  if (!bytes) return null
  let text = bytesToText(bytes)
  const nul = text.indexOf('\0')
  if (nul >= 0) text = text.slice(0, nul)
  text = text.trim()
  return text.length > 0 ? text : null
}

function entryRational(view: DataView, ifd: Ifd, tag: number, little: boolean, index: number): number | null {
  const e = ifd.get(tag)
  if (!e || e.type !== 5 || index >= e.count) return null
  const bytes = entryBytes(view, e, little)
  if (!bytes || bytes.length < (index + 1) * 8) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset)
  const num = dv.getUint32(index * 8, little)
  const den = dv.getUint32(index * 8 + 4, little)
  if (den === 0) return null
  return num / den
}

function entryUint(view: DataView, ifd: Ifd, tag: number, little: boolean): number | null {
  const e = ifd.get(tag)
  if (!e) return null
  if (e.type === 3) return view.getUint16(e.valueOffset, little)
  if (e.type === 4) return view.getUint32(e.valueOffset, little)
  return null
}

function parseExifDate(text: string | null, offset: string | null): Date | null {
  if (!text) return null
  // EXIF format: 'YYYY:MM:DD HH:MM:SS'
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text.trim())
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : 'Z'}`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseExif(tiff: Uint8Array): ExifValues | null {
  if (tiff.length < 8) return null
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  const order = ascii(view, 0, 2)
  const little = order === 'II'
  if (!little && order !== 'MM') return null
  if (view.getUint16(2, little) !== 42) return null
  const ifd0 = readIfd(view, view.getUint32(4, little), little)

  let dateTimeOriginal: string | null = null
  let offsetTimeOriginal: string | null = null
  let userComment: string | null = null
  let lensModel: string | null = null
  let gps: EmbeddedGps | null = null

  const readExifTags = (ifd: Ifd) => {
    dateTimeOriginal ??= entryAscii(view, ifd, 0x9003, little)
    offsetTimeOriginal ??= entryAscii(view, ifd, 0x9011, little)
    lensModel ??= entryAscii(view, ifd, 0xa434, little)
    const uc = ifd.get(0x9286)
    if (uc && !userComment) {
      const bytes = entryBytes(view, uc, little)
      if (bytes && bytes.length > 8) {
        // Skip the 8-byte character-code prefix; accept ASCII or UTF-8.
        userComment = bytesToText(bytes.slice(8)).replace(/\0+$/, '').trim() || null
      }
    }
  }
  const exifPtr = entryUint(view, ifd0, 0x8769, little)
  if (exifPtr !== null) readExifTags(readIfd(view, exifPtr, little))
  readExifTags(ifd0) // some encoders (and PIL) write these tags directly in IFD0

  const gpsPtr = entryUint(view, ifd0, 0x8825, little)
  if (gpsPtr !== null) {
    const g = readIfd(view, gpsPtr, little)
    const latRef = entryAscii(view, g, 1, little)
    const lonRef = entryAscii(view, g, 3, little)
    const dms = (tag: number): number | null => {
      const d = entryRational(view, g, tag, little, 0)
      const m = entryRational(view, g, tag, little, 1)
      const s = entryRational(view, g, tag, little, 2)
      if (d === null) return null
      return d + (m ?? 0) / 60 + (s ?? 0) / 3600
    }
    const lat = dms(2)
    const lon = dms(4)
    if (lat !== null && lon !== null) {
      const alt = entryRational(view, g, 6, little, 0)
      const altRef = g.get(5) ? view.getUint8(g.get(5)!.valueOffset) : 0
      gps = {
        lat: latRef === 'S' ? -lat : lat,
        lon: lonRef === 'W' ? -lon : lon,
        altitudeM: alt !== null ? (altRef === 1 ? -alt : alt) : null,
      }
    }
  }

  return {
    make: entryAscii(view, ifd0, 0x010f, little),
    model: entryAscii(view, ifd0, 0x0110, little),
    lensModel,
    software: entryAscii(view, ifd0, 0x0131, little),
    modifyDate: entryAscii(view, ifd0, 0x0132, little),
    dateTimeOriginal,
    offsetTimeOriginal,
    orientation: entryUint(view, ifd0, 0x0112, little),
    userComment,
    gps,
  }
}

// ---------------------------------------------------------------------------
// PNG parse
// ---------------------------------------------------------------------------

interface PngScan {
  width: number | null
  height: number | null
  exif: Uint8Array[]
  xmp: string[]
  texts: string[]
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const ds = new DecompressionStream('deflate')
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(ds)
    const buf = await new Response(stream).arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

async function scanPng(view: DataView): Promise<PngScan> {
  const out: PngScan = { width: null, height: null, exif: [], xmp: [], texts: [] }
  let pos = 8
  while (pos + 12 <= view.byteLength) {
    const len = view.getUint32(pos)
    const type = ascii(view, pos + 4, 4)
    const body = pos + 8
    if (body + len > view.byteLength) break
    if (type === 'IHDR') {
      out.width = view.getUint32(body)
      out.height = view.getUint32(body + 4)
    } else if (type === 'eXIf') {
      out.exif.push(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len)))
    } else if (type === 'tEXt') {
      out.texts.push(bytesToText(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len))))
    } else if (type === 'zTXt') {
      const raw = new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len))
      const nul = raw.indexOf(0)
      if (nul > 0 && raw[nul + 1] === 0) {
        const keyword = bytesToText(raw.slice(0, nul))
        const inflated = await inflateRaw(raw.slice(nul + 2))
        if (inflated) out.texts.push(`${keyword}\0${bytesToText(inflated)}`)
      }
    } else if (type === 'iTXt') {
      const raw = new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len))
      const nul = raw.indexOf(0)
      if (nul > 0) {
        const keyword = bytesToText(raw.slice(0, nul))
        const compressionFlag = raw[nul + 1]
        // After keyword: compression flag, method, language tag\0, translated\0, text
        let p = nul + 3
        const langEnd = raw.indexOf(0, p)
        if (langEnd < 0) break
        p = raw.indexOf(0, langEnd + 1)
        if (p < 0) break
        let textBytes = raw.slice(p + 1)
        if (compressionFlag === 1) {
          const inflated = await inflateRaw(textBytes)
          if (!inflated) continue
          textBytes = inflated
        }
        const text = bytesToText(textBytes)
        out.texts.push(`${keyword}\0${text}`)
        if (keyword === 'XML:com.adobe.xmp') out.xmp.push(text)
      }
    } else if (type === 'IEND') {
      break
    }
    pos = body + len + 4
  }
  return out
}

// ---------------------------------------------------------------------------
// WebP parse
// ---------------------------------------------------------------------------

interface WebpScan {
  width: number | null
  height: number | null
  exif: Uint8Array[]
  xmp: string[]
}

function scanWebp(view: DataView): WebpScan {
  const out: WebpScan = { width: null, height: null, exif: [], xmp: [] }
  let pos = 12
  while (pos + 8 <= view.byteLength) {
    const type = ascii(view, pos, 4)
    const len = view.getUint32(pos + 4, true)
    const body = pos + 8
    if (body + len > view.byteLength) break
    if (type === 'VP8X' && len >= 10) {
      out.width = 1 + (view.getUint8(body + 4) | (view.getUint8(body + 5) << 8) | (view.getUint8(body + 6) << 16))
      out.height = 1 + (view.getUint8(body + 7) | (view.getUint8(body + 8) << 8) | (view.getUint8(body + 9) << 16))
    } else if (type === 'VP8 ' && len >= 10) {
      const sig = body + 3
      if (view.getUint8(sig) === 0x9d && view.getUint8(sig + 1) === 0x01 && view.getUint8(sig + 2) === 0x2a) {
        out.width = view.getUint16(sig + 3, true) & 0x3fff
        out.height = view.getUint16(sig + 5, true) & 0x3fff
      }
    } else if (type === 'VP8L' && len >= 5) {
      if (view.getUint8(body) === 0x2f) {
        const b0 = view.getUint8(body + 1)
        const b1 = view.getUint8(body + 2)
        const b2 = view.getUint8(body + 3)
        const b3 = view.getUint8(body + 4)
        out.width = 1 + (b0 | ((b1 & 0x3f) << 8))
        out.height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10))
      }
    } else if (type === 'EXIF') {
      // WebP EXIF chunk is the TIFF payload directly (no 'Exif\0\0').
      out.exif.push(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len)))
    } else if (type === 'XMP ') {
      out.xmp.push(bytesToText(new Uint8Array((view.buffer as ArrayBuffer).slice(view.byteOffset + body, view.byteOffset + body + len))))
    }
    pos = body + len + (len % 2) // chunks are padded to even sizes
  }
  return out
}

// ---------------------------------------------------------------------------
// Known generator / editor signatures (substring match, case-insensitive)
// ---------------------------------------------------------------------------

const AI_GENERATOR_SIGNATURES: { needle: string; name: string }[] = [
  { needle: 'dall-e', name: 'DALL-E' },
  { needle: 'dall\u00b7e', name: 'DALL-E' },
  { needle: 'midjourney', name: 'Midjourney' },
  { needle: 'stable diffusion', name: 'Stable Diffusion' },
  { needle: 'stablediffusion', name: 'Stable Diffusion' },
  { needle: 'comfyui', name: 'ComfyUI' },
  { needle: 'adobe firefly', name: 'Adobe Firefly' },
  { needle: 'firefly', name: 'Adobe Firefly' },
  { needle: 'bing image creator', name: 'Bing Image Creator' },
  { needle: 'ideogram', name: 'Ideogram' },
  { needle: 'nightcafe', name: 'NightCafe' },
  { needle: 'craiyon', name: 'Craiyon' },
  { needle: 'deepai', name: 'DeepAI' },
  { needle: 'gpt-image', name: 'GPT Image' },
  { needle: 'imagen', name: 'Google Imagen' },
  { needle: 'gemini', name: 'Google Gemini' },
  { needle: 'flux.1', name: 'FLUX' },
  { needle: 'leonardo.ai', name: 'Leonardo AI' },
  { needle: 'playground.ai', name: 'Playground AI' },
  { needle: 'made with ai', name: 'generic AI tag' },
  { needle: 'ai-generated', name: 'generic AI tag' },
  { needle: 'generated by ai', name: 'generic AI tag' },
]

const EDITOR_SIGNATURES: { needle: string; name: string }[] = [
  { needle: 'photoshop', name: 'Adobe Photoshop' },
  { needle: 'lightroom', name: 'Adobe Lightroom' },
  { needle: 'gimp', name: 'GIMP' },
  { needle: 'snapseed', name: 'Snapseed' },
  { needle: 'picsart', name: 'PicsArt' },
  { needle: 'canva', name: 'Canva' },
  { needle: 'pixlr', name: 'Pixlr' },
  { needle: 'affinity', name: 'Affinity Photo' },
  { needle: 'darktable', name: 'darktable' },
  { needle: 'paint.net', name: 'Paint.NET' },
]

function findSignature(haystacks: (string | null)[], table: { needle: string; name: string }[]): string | null {
  for (const raw of haystacks) {
    if (!raw) continue
    const text = raw.toLowerCase()
    for (const { needle, name } of table) {
      if (text.includes(needle)) return name
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API: parse
// ---------------------------------------------------------------------------

/** Parse photo metadata from a Blob entirely in memory. Never throws on bad data. */
export async function parsePhotoMetadata(blob: Blob): Promise<PhotoMetadata> {
  const base: PhotoMetadata = {
    format: 'unknown',
    byteSize: blob.size,
    width: null,
    height: null,
    capturedAt: null,
    capturedOffset: null,
    modifiedAt: null,
    cameraMake: null,
    cameraModel: null,
    lensModel: null,
    software: null,
    gps: null,
    orientation: null,
    hasC2paManifest: false,
    xmpText: [],
    textAnnotations: [],
  }
  let buf: ArrayBuffer
  try {
    buf = await blob.arrayBuffer()
  } catch {
    return base
  }
  const view = new DataView(buf)
  const format = detectFormat(view)
  base.format = format

  let exifBlobs: Uint8Array[] = []
  if (format === 'jpeg') {
    const scan = scanJpeg(view)
    base.width = scan.sofWidth
    base.height = scan.sofHeight
    exifBlobs = scan.exif
    base.xmpText = scan.xmp
    base.hasC2paManifest = scan.hasC2pa
    base.textAnnotations.push(...scan.app13Text)
  } else if (format === 'png') {
    const scan = await scanPng(view)
    base.width = scan.width
    base.height = scan.height
    exifBlobs = scan.exif
    base.xmpText = scan.xmp
    base.textAnnotations.push(...scan.texts)
  } else if (format === 'webp') {
    const scan = scanWebp(view)
    base.width = scan.width
    base.height = scan.height
    exifBlobs = scan.exif
    base.xmpText = scan.xmp
  }

  for (const tiff of exifBlobs) {
    const exif = parseExif(tiff)
    if (!exif) continue
    base.cameraMake ??= exif.make
    base.cameraModel ??= exif.model
    base.lensModel ??= exif.lensModel
    base.software ??= exif.software
    base.orientation ??= exif.orientation
    base.gps ??= exif.gps
    if (exif.userComment) base.textAnnotations.push(exif.userComment)
    if (!base.capturedAt && exif.dateTimeOriginal) {
      base.capturedAt = parseExifDate(exif.dateTimeOriginal, exif.offsetTimeOriginal)
      base.capturedOffset = exif.offsetTimeOriginal
    }
    if (!base.modifiedAt && exif.modifyDate) {
      base.modifiedAt = parseExifDate(exif.modifyDate, null)
    }
  }
  base.xmpText = base.xmpText.map((t) => (t.length > 20000 ? t.slice(0, 20000) : t))
  return base
}

// ---------------------------------------------------------------------------
// Public API: distance + assessment
// ---------------------------------------------------------------------------

/** Great-circle distance in meters. Used to compare EXIF GPS with the report's GPS. */
export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)))
}

export interface AssessContext {
  /** GPS captured for the report itself (device GPS at report time). */
  reportLat?: number
  reportLon?: number
  /** When the photo was picked / the report was filed (defaults to now). */
  reportedAt?: Date
  /** Tolerance for the GPS cross-check, meters. Default 150. */
  gpsToleranceM?: number
  /** Tolerance for capture-time freshness, hours. Default 72. */
  maxCaptureAgeHours?: number
}

function allSearchText(meta: PhotoMetadata): (string | null)[] {
  return [meta.software, meta.cameraMake, meta.cameraModel, meta.lensModel, ...meta.xmpText, ...meta.textAnnotations]
}

/**
 * Turn parsed metadata into honest, uncertainty-preserving review signals.
 *
 * The verdict never says 'authentic' or 'fake':
 *  - 'consistent'          metadata is present and nothing conflicts with the report
 *  - 'review-suggested'    at least one concrete signal deserves a human look
 *                          (AI-generator signature found, EXIF GPS far from the
 *                          report GPS, or a capture/edit time after the report)
 *  - 'inconclusive'        metadata exists but is too thin to say anything
 *  - 'insufficient-data'   no usable metadata at all (common after chat-app
 *                          forwarding - NOT evidence of manipulation)
 */
export function assessEvidence(meta: PhotoMetadata, ctx: AssessContext = {}): MetadataAssessment {
  const signals: MetadataSignal[] = []
  const now = ctx.reportedAt ?? new Date()
  const gpsTol = ctx.gpsToleranceM ?? 150
  const maxAgeH = ctx.maxCaptureAgeHours ?? 72

  const hasAnyExif =
    meta.capturedAt !== null || meta.cameraMake !== null || meta.cameraModel !== null || meta.software !== null || meta.gps !== null

  signals.push({
    id: 'capture-timestamp',
    state: meta.capturedAt ? 'present' : 'unknown',
    label: 'Capture time',
    detail: meta.capturedAt
      ? `Camera-recorded capture time: ${meta.capturedAt.toISOString()}${meta.capturedOffset ? ` (camera offset ${meta.capturedOffset})` : ' (no timezone recorded - treat clock as approximate)'}.`
      : 'No capture timestamp in the file. It may have been stripped on forwarding - this is unknown, not suspicious by itself.',
  })

  signals.push({
    id: 'embedded-gps',
    state: meta.gps ? 'present' : 'unknown',
    label: 'Location in photo',
    detail: meta.gps
      ? `Photo embeds GPS ${meta.gps.lat.toFixed(5)}, ${meta.gps.lon.toFixed(5)}.`
      : 'No GPS embedded in the photo. The report uses the separately captured device GPS; embedded GPS absence is unknown, not a failure.',
  })

  if (meta.gps && ctx.reportLat !== undefined && ctx.reportLon !== undefined) {
    const d = distanceMeters(meta.gps, { lat: ctx.reportLat, lon: ctx.reportLon })
    signals.push({
      id: 'gps-matches-report',
      state: d <= gpsTol ? 'present' : 'absent',
      label: 'Photo location vs report location',
      detail:
        d <= gpsTol
          ? `Embedded GPS is ${Math.round(d)} m from the report GPS (within ${gpsTol} m).`
          : `Embedded GPS is ${Math.round(d)} m from the report GPS, beyond the ${gpsTol} m tolerance. Worth a human look - cameras can hold a stale fix, but the mismatch is real.`,
    })
  }

  const camera = [meta.cameraMake, meta.cameraModel].filter(Boolean).join(' ')
  signals.push({
    id: 'camera-identity',
    state: meta.cameraMake || meta.cameraModel ? 'present' : 'unknown',
    label: 'Camera identity',
    detail: camera
      ? `File identifies as "${camera}"${meta.lensModel ? ` with lens "${meta.lensModel}"` : ''}. Device tags are self-reported and forgeable - presence is mild support, not proof.`
      : 'No camera make/model recorded. Unknown - not evidence for or against authenticity.',
  })

  if (meta.capturedAt) {
    const ageHours = (now.getTime() - meta.capturedAt.getTime()) / 3600000
    const editedAfterReport = meta.modifiedAt !== null && meta.modifiedAt.getTime() > now.getTime() + 5 * 60 * 1000
    const future = ageHours < -1 // capture time more than an hour in the future
    const fresh = ageHours >= -1 && ageHours <= maxAgeH
    signals.push({
      id: 'capture-time-vs-report',
      state: fresh && !editedAfterReport ? 'present' : 'absent',
      label: 'Capture time vs report time',
      detail: editedAfterReport
        ? 'The file was modified after this report was filed - a human should look at why.'
        : future
          ? 'Camera clock reads in the future relative to the report - likely a wrong camera clock; needs a human look.'
          : fresh
            ? `Captured about ${Math.max(0, Math.round(ageHours))} h before the report (within the ${maxAgeH} h freshness window).`
            : `Captured about ${Math.round(ageHours)} h before the report - an old photo can still be genuine, but recency matters for evidence.`,
    })
  } else {
    signals.push({
      id: 'capture-time-vs-report',
      state: 'unknown',
      label: 'Capture time vs report time',
      detail: 'Cannot compare - no capture timestamp in the file.',
    })
  }

  const editor = findSignature(allSearchText(meta), EDITOR_SIGNATURES)
  signals.push({
    id: 'editing-software',
    state: editor ? 'absent' : meta.software || meta.xmpText.length > 0 ? 'present' : 'unknown',
    label: 'Editing software',
    detail: editor
      ? `Metadata mentions ${editor}. Edits can be innocent crops, but an officer should see the photo before relying on it.`
      : meta.software
        ? `Software tag: "${meta.software}" - no known editor signature.`
        : meta.xmpText.length > 0
          ? 'XMP metadata present with no known editor signature.'
          : 'No software metadata recorded (unknown).',
  })

  const aiHit = findSignature(allSearchText(meta), AI_GENERATOR_SIGNATURES)
  signals.push({
    id: 'ai-generator-signature',
    state: aiHit ? 'absent' : 'unknown',
    label: 'AI-generator signature',
    detail: aiHit
      ? `Metadata contains a ${aiHit} signature. That is a concrete reason for officer review - though signatures can also be forged, so this flags review, not a verdict.`
      : 'No known AI-generator signature in the metadata. Absence of a signature does NOT prove the photo is real - there is no reliable free way to prove that.',
  })

  signals.push({
    id: 'provenance-credentials',
    state: meta.hasC2paManifest ? 'present' : 'unknown',
    label: 'Content credentials (C2PA)',
    detail: meta.hasC2paManifest
      ? 'A C2PA content-credentials manifest is embedded. This utility does not verify its signature - treat as informational only.'
      : 'No C2PA content-credentials manifest found.',
  })

  const reviewSuggested = signals.some((s) => (s.id === 'ai-generator-signature' || s.id === 'gps-matches-report' || s.id === 'capture-time-vs-report') && s.state === 'absent')
  const informative = signals.filter((s) => s.state === 'present').length
  let verdict: AssessmentVerdict
  let summary: string
  if (reviewSuggested) {
    verdict = 'review-suggested'
    summary = 'One or more concrete metadata signals conflict with this report. A person should review the photo before it counts as evidence.'
  } else if (!hasAnyExif && meta.xmpText.length === 0) {
    verdict = 'insufficient-data'
    summary = 'This file carries no usable metadata (common after chat-app forwarding). Nothing can be concluded either way - the separately captured report GPS is the evidence anchor.'
  } else if (informative >= 3) {
    verdict = 'consistent'
    summary = 'Metadata is present and nothing conflicts with the report. Metadata alone cannot prove a photo is genuine; this only means no red flags were found.'
  } else {
    verdict = 'inconclusive'
    summary = 'Some metadata exists but is too thin to judge. No red flags, no confirmation either.'
  }
  return { verdict, summary, signals }
}

// ---------------------------------------------------------------------------
// Public API: metadata stripping (privacy control)
// ---------------------------------------------------------------------------

const JPEG_DROP_MARKERS = new Set([0xe1, 0xe2, 0xeb, 0xec, 0xed, 0xee, 0xfe])

/**
 * Return a copy of a JPEG with EXIF/XMP/C2PA/IPTC/comment segments removed.
 * Pixels are copied byte-for-byte - no re-encode, no quality loss.
 * Returns null for non-JPEG input (callers should keep the original then,
 * or route PNG/WebP through a canvas re-encode in UI code).
 */
export async function stripJpegMetadata(blob: Blob): Promise<Blob | null> {
  const buf = await blob.arrayBuffer()
  const view = new DataView(buf)
  if (detectFormat(view) !== 'jpeg') return null
  const parts: Uint8Array[] = [new Uint8Array(buf.slice(0, 2))]
  let pos = 2
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) {
      parts.push(new Uint8Array(buf.slice(pos)))
      pos = view.byteLength
      break
    }
    const marker = view.getUint8(pos + 1)
    if (marker === 0xda) {
      parts.push(new Uint8Array(buf.slice(pos)))
      pos = view.byteLength
      break
    }
    if (marker === 0xd9) {
      parts.push(new Uint8Array(buf.slice(pos, pos + 2)))
      pos += 2
      continue
    }
    const len = view.getUint16(pos + 2)
    const end = pos + 2 + len
    if (end > view.byteLength) break
    if (!JPEG_DROP_MARKERS.has(marker)) parts.push(new Uint8Array(buf.slice(pos, end)))
    pos = end
  }
  if (pos < view.byteLength) parts.push(new Uint8Array(buf.slice(pos)))
  return new Blob(parts as BlobPart[], { type: 'image/jpeg' })
}

// ---------------------------------------------------------------------------
// Formatting helpers for UI
// ---------------------------------------------------------------------------

export function formatVerdict(v: AssessmentVerdict): string {
  switch (v) {
    case 'consistent':
      return 'No red flags found'
    case 'review-suggested':
      return 'Officer review suggested'
    case 'inconclusive':
      return 'Inconclusive'
    case 'insufficient-data':
      return 'No usable metadata'
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
