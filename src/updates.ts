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
    title: 'Points shown on every report',
    detail: 'After you submit a report you now see the exact points it earned - measured from your account, never an assumed number. Merged duplicates and replays honestly earn less or nothing.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Follow-up plan on every issue',
    detail: 'Each issue now shows the day 7/10/15/30 chase plan and its true state: due reminders are plainly marked not sent (no verified delivery channel yet), and recorded escalations are labeled internal status, not sent notices.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Cross-checks across an issue\'s photos',
    detail: 'The private photo panel now compares all of an issue\'s photos: upload chronology, the server\'s upload-time location checks, and pixel similarity that can catch a reused photo. Every result is labeled with what it can and cannot prove.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Your name, your choice (Settings)',
    detail: 'A new Settings page holds your public name and ward. The leaderboard only ever shows the name you choose - it is never filled from your Google account.',
    area: 'Website',
  },
  {
    date: '2026-10-30',
    title: 'Daily streaks are live',
    detail: 'Streaks count days with verified activity (verified reports, first reports, confirmed fixes) and show on your desk with milestone chips. Timezone-aware, no made-up numbers.',
    area: 'API',
  },
  {
    date: '2026-10-30',
    title: 'Photo-first reporting',
    detail: 'A report and its photo are now one atomic thing: the photo is staged and bound to the report in a single server transaction, so no report exists without its evidence. Retries are safe - re-sending never double-files.',
    area: 'API',
  },
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
    title: 'Interactive India map on the landing page',
    detail: 'The overview map is now an accurate India boundary (DataMeet composite, CC BY 4.0) instead of a generic tile map.',
    area: 'Website',
  },
]

/** Built and code-reviewed, but NOT live yet. Never presented as shipped. */
export const UPCOMING: UpdateEntry[] = [
  {
    date: '2026-10-30',
    title: 'Branded emails, ready but not sending',
    detail: 'Verification, welcome and reminder email templates are designed and stored. Sending starts only when a real mail provider exists - and messages to authorities additionally need a verified recipient and your approval of the exact text.',
    area: 'Website',
  },
]
