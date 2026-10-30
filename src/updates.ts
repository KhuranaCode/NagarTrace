/**
 * Product updates shown in-app on /updates. Real shipped changes only - newest first.
 * Each entry is a commit-backed change to the website or API. No marketing copy, no fake items.
 */
export type UpdateEntry = {
  date: string // YYYY-MM-DD
  title: string
  detail: string
  area: 'Website' | 'API' | 'Auth'
}

export const UPDATES: UpdateEntry[] = [
  {
    date: '2026-10-30',
    title: 'Welcome card for new accounts',
    detail: 'First visit to your desk now shows what NagarTrace does and the three steps to your first tracked repair.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Photo details before you submit',
    detail: 'The report form now reads photo metadata on your device (time, GPS, camera) and shows what the evidence supports - honestly, including when nothing can be confirmed. Optional strip-before-upload.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Streaks API',
    detail: 'Daily streaks derived only from verified activity (verified reports, first-reporter bonus, confirmed fixes). Per-user timezone, idempotent recompute. Live after the backend deployment owner applies it.',
    area: 'API',
  },
  {
    date: '2026-10-30',
    title: 'Interactive India map on the landing page',
    detail: 'The overview map is now an accurate India boundary (DataMeet composite, CC BY 4.0) instead of a generic tile map.',
    area: 'Website',
  },
]
