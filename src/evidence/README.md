# Photo evidence metadata inspection (browser-side)

`photo-metadata.ts` reads metadata from an evidence photo **entirely on the
device** - no upload to any third party, no paid API, zero dependencies - and
turns it into honest review signals for officers.

## What it does

- Parses JPEG (EXIF + XMP + C2PA marker), PNG (eXIf, tEXt, zTXt, iTXt) and
  WebP (EXIF/XMP chunks, VP8/VP8L/VP8X dimensions). HEIC/AVIF are detected
  but not parsed (metadata reported as unknown).
- Extracts capture time (+ timezone offset when recorded), camera make/model,
  lens, software tag, embedded GPS, orientation, dimensions.
- Scans metadata text for known AI-generator signatures (DALL-E, Midjourney,
  Stable Diffusion, ComfyUI, Adobe Firefly, Google Imagen/Gemini, and generic
  AI tags) and common editing software (Photoshop, Snapseed, GIMP, ...).
- Cross-checks embedded GPS against the report's own GPS (`distanceMeters`,
  default 150 m tolerance) and capture time against report time (default 72 h
  freshness window).
- `stripJpegMetadata()` returns a pixel-identical JPEG copy with EXIF/XMP/
  C2PA/IPTC/comments removed - the reporter-facing privacy control.

## What it deliberately never does

- It never says a photo is "fake" or "authentic". The verdict vocabulary is
  `consistent | review-suggested | inconclusive | insufficient-data`. Missing
  metadata (normal after WhatsApp/chat forwarding) is `unknown`, not
  suspicious. Signatures and EXIF are advisory: strippable and forgeable.
- It never sends the photo anywhere. Parsing runs on the local `Blob`. The
  existing "photos are private to participants" rule is untouched.
- It does not replace the server-side `location_ok` check - it is an
  additional, honest signal layer.

## Integration points (no existing files are modified by this patch)

Report flow (`src/pages/Report.tsx`, `pickPhoto` / review step):

```ts
import { parsePhotoMetadata, assessEvidence, formatVerdict } from '../evidence/photo-metadata'

const meta = await parsePhotoMetadata(file)
const assessment = assessEvidence(meta, {
  reportLat: gps?.lat, reportLon: gps?.lon, reportedAt: new Date(),
})
// show formatVerdict(assessment.verdict) + signal details on the review step;
// when assessment.verdict === 'review-suggested', suggest the reporter retake
// the photo on the spot instead of blocking them.
```

Issue detail (`src/pages/IssueDetail.tsx`, `EvidenceImage`): after
`api.evidenceBlobUrl(...)` resolves, run the same two calls on the fetched
blob and render an expandable "Photo details" panel for officers.

Privacy option (report flow): offer "remove hidden metadata (including any
embedded location) before upload" via `stripJpegMetadata(file)`; keep the
original when it returns null (non-JPEG) or route PNG/WebP through a canvas
re-encode if that is ever wanted.

## Tests

`tests/evidence/photo-metadata.test.ts` - fixtures are built in code, plus the
parser was verified against real encoder output (PIL-written EXIF JPEG with
GPS, and a PNG with a Firefly text chunk). Run from the repo root with
Node >= 22 (built-in TypeScript support, no new dependencies):

```sh
node --test 'tests/evidence/*.test.ts'
```

The test file intentionally lives outside `src/` because it imports the `.ts`
extension directly (Node test-runner style); `tsconfig.json` only includes
`src`, so `npm run typecheck` stays clean.

## Known limits

- HEIC/AVIF (iPhone default) metadata is not parsed yet - reported as unknown.
- C2PA manifests are detected, not signature-verified.
- XMP text is capped at 20 KB per packet for the signature scan.
- AI-signature matching is a substring scan over metadata text. It catches
  generators that label their output; it cannot catch unlabeled fakes, and it
  must not be presented as detection.
