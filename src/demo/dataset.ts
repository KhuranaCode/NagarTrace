/**
 * DEMO SHOWCASE ONLY (VITE_DEMO=1 build at /NagarTrace/demo/).
 * Every record here is SYNTHETIC: aliases, organisations, complaint ids (DEMO-xxxx),
 * locations near Mohali and timestamps. This module never talks to the real API,
 * Supabase or database - the two datasets can never mix.
 */
import type { EventItem, Hazard, Issue, LeaderRow, NhaiAwardsBrowse, PublicIssue, Status } from '../types'

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const R = rng(20261030)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(R() * arr.length)]
const DAY = 86400e3
const NOW = Date.now()

export const DEMO_USER_ID = 'demo-user'

const WARDS = [
  { ward: 'Ward 4', lat: 30.7046, lon: 76.7179 },
  { ward: 'Ward 9', lat: 30.711, lon: 76.733 },
  { ward: 'Ward 13', lat: 30.698, lon: 76.705 },
  { ward: 'Ward 21', lat: 30.679, lon: 76.724 },
] as const

const HAZARDS: Hazard[] = ['pothole', 'crack', 'waterlogging', 'broken_edge', 'missing_cover', 'other']
const HAZARD_W = [0.38, 0.16, 0.15, 0.11, 0.1, 0.1]
function pickHazard(): Hazard {
  let r = R()
  for (let i = 0; i < HAZARDS.length; i++) { r -= HAZARD_W[i]; if (r <= 0) return HAZARDS[i] }
  return 'pothole'
}

const ORGS = [
  { kind: 'municipality', name: 'Demo Municipal Council (synthetic)' },
  { kind: 'contractor', name: 'Demo Roads & Infra Pvt Ltd (synthetic)' },
  { kind: 'utility', name: 'Demo City Water Utility (synthetic)' },
] as const

const LIFECYCLE: Status[] = ['reported', 'verified', 'assigned', 'in_progress', 'awaiting_confirmation', 'fixed']

function statusFor(ageDays: number, r: number): Status {
  if (ageDays > 24) return r < 0.55 ? 'fixed' : r < 0.75 ? 'awaiting_confirmation' : r < 0.9 ? 'in_progress' : 'assigned'
  if (ageDays > 14) return r < 0.3 ? 'fixed' : r < 0.55 ? 'awaiting_confirmation' : r < 0.8 ? 'in_progress' : 'assigned'
  if (ageDays > 6) return r < 0.25 ? 'in_progress' : r < 0.55 ? 'assigned' : r < 0.85 ? 'verified' : 'reported'
  return r < 0.6 ? 'reported' : 'verified'
}

export interface DemoIssue extends Issue { mine?: boolean; eventsList: EventItem[] }

export const DEMO_ISSUES: DemoIssue[] = Array.from({ length: 72 }, (_, i) => {
  const n = i + 1
  const w = pick(WARDS)
  const age = R() * 30
  const created = NOW - age * DAY
  const status = statusFor(age, R())
  const stageIdx = LIFECYCLE.indexOf(status)
  const primary = pickHazard()
  const extra = HAZARDS.filter((h) => h !== primary && R() < 0.18)
  const severity = 1 + Math.floor(R() * 5)
  const routed = stageIdx >= 2
  const org = routed ? pick(ORGS) : null
  const mine = i % 18 === 0
  // status timeline spread between creation and now
  const eventsList: EventItem[] = []
  let prev: Status | null = null
  for (let s = 0; s <= stageIdx; s++) {
    const t = created + ((NOW - created) * (s + 1)) / (stageIdx + 1)
    eventsList.push({ id: n * 100 + s, kind: 'status', from_status: prev, to_status: LIFECYCLE[s], reason: null, system: s > 0, created_at: new Date(t).toISOString() })
    prev = LIFECYCLE[s]
  }
  const lastT = eventsList[eventsList.length - 1].created_at
  return {
    id: `demo-${String(n).padStart(4, '0')}`,
    complaint_no: n,
    complaint_id: `DEMO-${String(n).padStart(4, '0')}`,
    hazard: primary,
    hazards: [primary, ...extra],
    status,
    severity,
    ward: w.ward,
    location: { lat: w.lat + (R() - 0.5) * 0.04, lon: w.lon + (R() - 0.5) * 0.05 },
    responsible: org ? { kind: org.kind, name: org.name, synthetic_data: true } : null,
    deadline_at: routed ? new Date(created + 7 * DAY).toISOString() : null,
    reports_count: 1 + Math.floor(R() * 3),
    route_flags: [],
    created_at: new Date(created).toISOString(),
    updated_at: lastT,
    danger_flag: severity >= 4 && R() < 0.4,
    route_reason: null,
    route_overridden: false,
    reopen_count: 0,
    fixed_at: status === 'fixed' ? lastT : null,
    copy_org: null,
    mine,
    eventsList,
  }
})

export function toPublic(d: DemoIssue): PublicIssue {
  const { mine: _m, eventsList: _e, danger_flag: _df, route_reason: _rr, route_overridden: _ro, reopen_count: _rc, fixed_at: _fa, copy_org: _co, ...pub } = d
  return pub
}
export function toIssue(d: DemoIssue): Issue {
  const { mine: _m, eventsList: _e, ...issue } = d
  return issue
}

export const DEMO_LEADERBOARD: LeaderRow[] = [
  { alias: 'demo-aditi', ward: 'Ward 9', points: 168 },
  { alias: 'demo-kabir', ward: 'Ward 4', points: 141 },
  { alias: 'demo-sana', ward: 'Ward 13', points: 122 },
  { alias: 'demo-vikram', ward: 'Ward 9', points: 104 },
  { alias: 'demo-meera', ward: 'Ward 21', points: 88 },
  { alias: 'demo-arjun', ward: 'Ward 4', points: 71 },
  { alias: 'demo-naina', ward: 'Ward 13', points: 54 },
  { alias: 'demo-rohan', ward: 'Ward 21', points: 33 },
  { alias: 'demo-visitor', ward: 'Ward 9', points: 64 },
].sort((a, b) => b.points - a.points)

export const DEMO_AWARDS: NhaiAwardsBrowse = {
  awards: [1, 2, 3, 4, 5, 6].map((sr) => ({
    sr,
    project_name: `Synthetic demo highway package ${sr} (not a real award)`,
    state: 'Punjab',
    length_km: 12 + sr * 3,
    loa_date: `2025-0${(sr % 9) + 1}-1${sr % 9}`,
    awarded_cost_cr: 40 + sr * 17,
    piu: `Demo PIU ${sr}`,
    mode: sr % 2 ? 'HAM' : 'EPC',
    contractor_name: `Demo Construction Co ${sr} (synthetic)`,
    project_stage: pick(['Under construction', 'Awarded', 'Completed'] as const),
    project_type: '4-laning',
    chainage_km_marks: [`${sr * 4}.000`, `${sr * 4 + 8}.500`],
    nh_from_name: [`NH ${sr + 4}`],
    page: null,
    source_url: 'https://khuranacode.github.io/NagarTrace/',
    source_label: 'Synthetic demo sample - not NHAI data',
    match_status: 'candidate',
  })),
  dataset: {
    rows: 6,
    source_label: 'Synthetic demo sample',
    coverage: 'Demo build only - 6 synthetic rows, not real NHAI records',
    anomaly_note: 'Demo build: every row on this page is synthetic and does not come from any government record.',
  },
}
