/**
 * corroboration.ts - cross-photo consistency checks for an issue's evidence set.
 *
 * Everything runs on the device, on data the app already has: the evidence
 * metadata rows (kind, upload time, location check result) and the photo
 * pixels themselves. No server change, no upload, no paid service.
 *
 * Honesty rules (same as photo-metadata.ts):
 *  - The server re-encodes and strips EXIF on upload, so camera metadata is
 *    GONE by the time we see a photo here. Nothing in this file pretends
 *    otherwise - no signal reads metadata that cannot exist.
 *  - A 'consistent' result is weak corroboration, never proof a photo is
 *    genuine. A 'review-suggested' result is a reason to look, never proof
 *    of manipulation. The verdict vocabulary matches photo-metadata.ts.
 */

import type { EvidenceMeta } from '../types'

export type CorroborationVerdict = 'consistent' | 'review-suggested' | 'inconclusive' | 'insufficient-data'

export interface CorroborationSignal {
  id: 'photo-count' | 'timeline-order' | 'location-consistency' | 'near-duplicate'
  state: 'present' | 'unknown'
  label: string
  detail: string
}

export interface CorroborationAssessment {
  verdict: CorroborationVerdict
  signals: CorroborationSignal[]
}

/** 64-bit average hash (aHash) of an image, computed on-device. */
export async function averageHash(blob: Blob): Promise<bigint | null> {
  try {
    const bmp = await createImageBitmap(blob)
    const size = 8
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bmp, 0, 0, size, size)
    bmp.close()
    const { data } = ctx.getImageData(0, 0, size, size)
    const gray: number[] = []
    for (let i = 0; i < data.length; i += 4) gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length
    let hash = 0n
    for (let i = 0; i < 64; i++) if (gray[i] >= avg) hash |= 1n << BigInt(i)
    return hash
  } catch {
    return null
  }
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b
  let n = 0
  while (x) { n += Number(x & 1n); x >>= 1n }
  return n
}

/**
 * Assess one issue's evidence set. hashes maps evidence id -> aHash (null when
 * the pixels could not be read). Pure function - unit-testable without a DOM.
 */
export function assessCorroboration(
  evidence: EvidenceMeta[],
  hashes: Map<string, bigint | null>,
): CorroborationAssessment {
  const signals: CorroborationSignal[] = []
  if (evidence.length === 0) {
    return { verdict: 'insufficient-data', signals: [{ id: 'photo-count', state: 'unknown', label: 'Photos', detail: 'No photos on this issue yet.' }] }
  }

  signals.push({
    id: 'photo-count',
    state: 'present',
    label: 'Photos',
    detail: evidence.length === 1
      ? 'One photo. Cross-checks need at least two - a single photo stands on its own.'
      : `${evidence.length} photos from ${new Set(evidence.map((e) => e.kind)).size} stage(s) of the issue.`,
  })

  // Timeline: upload order must make sense (a repair photo cannot precede the report).
  const sorted = [...evidence].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  const firstReport = sorted.find((e) => e.kind === 'report')
  const firstAfter = sorted.find((e) => e.kind === 'after')
  if (firstReport && firstAfter) {
    const gapMin = (+new Date(firstAfter.created_at) - +new Date(firstReport.created_at)) / 60000
    if (gapMin < 0) {
      signals.push({ id: 'timeline-order', state: 'present', label: 'Upload order', detail: 'A repair photo was uploaded BEFORE the first report photo. That order is impossible for a real repair - review suggested.' })
    } else if (gapMin < 5) {
      signals.push({ id: 'timeline-order', state: 'present', label: 'Upload order', detail: `The repair photo was uploaded ${Math.max(1, Math.round(gapMin))} minute(s) after the report. Very fast repairs happen (an existing crew), but a same-minute before/after pair deserves a look.` })
    } else {
      const hours = gapMin / 60
      signals.push({ id: 'timeline-order', state: 'present', label: 'Upload order', detail: `Repair photo came ${hours >= 24 ? `${Math.round(hours / 24)} day(s)` : `${Math.round(hours)} hour(s)`} after the report - a plausible repair timeline.` })
    }
  } else {
    signals.push({ id: 'timeline-order', state: 'unknown', label: 'Upload order', detail: 'No report-and-repair pair yet, so there is no timeline to cross-check.' })
  }

  // Location checks: the server verified each photo's claimed spot against the report.
  const mismatched = evidence.filter((e) => !e.location_ok)
  signals.push({
    id: 'location-consistency',
    state: 'present',
    label: 'Location checks',
    detail: mismatched.length === 0
      ? `All ${evidence.length} photo(s) were uploaded from near the issue location (server-checked).`
      : `${mismatched.length} of ${evidence.length} photo(s) did NOT match the issue location at upload. Those may not show this issue - review suggested.`,
  })

  // Near-duplicates: pixel-similar photos (reused image). Works post-EXIF-strip.
  const hashed = evidence.filter((e) => hashes.get(e.id) != null)
  if (hashed.length < 2) {
    signals.push({ id: 'near-duplicate', state: 'unknown', label: 'Image similarity', detail: 'Could not compare the photo pixels here - similarity unknown (not a defect by itself).' })
  } else {
    const dups: string[] = []
    for (let i = 0; i < hashed.length; i++)
      for (let j = i + 1; j < hashed.length; j++) {
        const dist = hamming(hashes.get(hashed[i].id)!, hashes.get(hashed[j].id)!)
        if (dist <= 6) dups.push(`${hashed[i].kind} #${i + 1} ~ ${hashed[j].kind} #${j + 1}`)
      }
    signals.push({
      id: 'near-duplicate',
      state: 'present',
      label: 'Image similarity',
      detail: dups.length > 0
        ? `Near-identical image pair(s) detected (${dups.join('; ')}). The same photo may have been reused - review suggested.`
        : 'The photos are visually distinct images. That rules out a reused photo - it does NOT by itself prove each one is genuine.',
    })
  }

  const review = signals.some((s) => s.id !== 'photo-count' && s.state === 'present' && /review suggested/.test(s.detail))
  const informative = signals.filter((s) => s.state === 'present' && s.id !== 'photo-count')
  const verdict: CorroborationVerdict =
    evidence.length < 2 && !firstAfter ? 'insufficient-data'
    : review ? 'review-suggested'
    : informative.length > 0 ? 'consistent' : 'inconclusive'
  return { verdict, signals }
}

export function formatCorroborationVerdict(v: CorroborationVerdict): string {
  switch (v) {
    case 'consistent': return 'cross-checks pass (weak corroboration, not proof)'
    case 'review-suggested': return 'review suggested'
    case 'inconclusive': return 'inconclusive'
    case 'insufficient-data': return 'insufficient data'
  }
}
