/**
 * Demo API adapter (VITE_DEMO=1 only). Serves the synthetic 30-day dataset from
 * src/demo/dataset.ts. NO network calls to the real API or Supabase ever happen in
 * a demo build. Write actions either run fully in-memory (report flow, so the
 * showcase can be walked end to end) or fail with a clear demo ApiError.
 */
import { ApiError } from '../api'
import type { Badges, Issue, IssueDetail, Me, PublicIssue, ReportResult } from '../types'
import { DEMO_AWARDS, DEMO_ISSUES, DEMO_LEADERBOARD, DEMO_USER_ID, toIssue, toPublic, type DemoIssue } from './dataset'

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const disabled = (what: string): never => {
  throw new ApiError(0, 'demo', `Demo build - ${what} is disabled. Simulated data only; nothing is saved or sent anywhere.`)
}

// Reports created while browsing the demo live in sessionStorage only.
const SESSION_KEY = 'nagartrace-demo-reports'
function sessionIssues(): DemoIssue[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as DemoIssue[] } catch { return [] }
}
function allIssues(): DemoIssue[] { return [...sessionIssues(), ...DEMO_ISSUES] }

function detail(d: DemoIssue): IssueDetail {
  return { ...toIssue(d), events: d.eventsList, evidence: [], official_records: null, test_data: true } as IssueDetail
}

export const demoApi = {
  // No AI in the demo: honest unavailable, never a fabricated suggestion.
  aiStatus: async () => { await delay(30); return { configured: false, available: false, reason: 'demo' } },
  aiReportCheck: async () => { await delay(30); return { ai_available: false as const, reason: 'demo' } },

  health: async () => { await delay(60); return { ok: true, verification_mode: 'demo', unrouted_triage: 'demo', policy: 'demo build - synthetic 30-day activity' } },
  me: async (): Promise<Me> => { await delay(); return { id: DEMO_USER_ID, alias: 'demo-visitor', ward: '9', points: 64, created_at: new Date(Date.now() - 21 * 86400e3).toISOString(), memberships: [] } },
  patchMe: async (_body: { alias?: string; ward?: string }) => { await delay(); return { ok: true as const } },
  badges: async (): Promise<Badges> => {
    await delay()
    return {
      badges: [
        { badge: 'first_report', earned: true },
        { badge: 'five_reports', earned: false },
        { badge: 'fix_confirmed', earned: true },
        { badge: 'ward_champion', earned: false },
      ],
      progress: { reports: 4, fix_confirmations: 1 },
      note: 'Demo build - simulated progress.',
    }
  },
  leaderboard: async (ward: string | undefined, period: 'weekly' | 'all') => {
    await delay()
    let rows = DEMO_LEADERBOARD
    if (ward) rows = rows.filter((r) => r.ward === ward)
    if (period === 'weekly') rows = rows.map((r) => ({ ...r, points: Math.round(r.points * 0.35) })).sort((a, b) => b.points - a.points)
    return { leaderboard: rows }
  },
  publicIssues: async (f: { status?: string; ward?: string; responsible?: string } = {}) => {
    await delay()
    let rows = allIssues().map(toPublic)
    if (f.status) rows = rows.filter((r) => r.status === f.status)
    if (f.ward) rows = rows.filter((r) => r.ward === f.ward)
    if (f.responsible) rows = rows.filter((r) => r.responsible?.kind === f.responsible)
    rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { issues: rows }
  },
  publicIssue: async (id: string): Promise<PublicIssue> => {
    await delay()
    const d = allIssues().find((x) => x.id === id)
    if (!d) throw new ApiError(404, 'not_found', 'Issue not found')
    return { ...toPublic(d), official_records: null }
  },
  nhaiAwards: async (_f: { state?: string; nh?: string } = {}) => { await delay(); return DEMO_AWARDS },
  myIssues: async (f: { status?: string; responsible?: string } = {}) => {
    await delay()
    let rows: (Issue | PublicIssue)[] = allIssues().filter((d) => d.mine).map(toIssue)
    if (f.status) rows = rows.filter((r) => r.status === f.status)
    if (f.responsible) rows = rows.filter((r) => r.responsible?.kind === f.responsible)
    return { issues: rows }
  },
  issue: async (id: string): Promise<IssueDetail> => {
    await delay()
    const d = allIssues().find((x) => x.id === id)
    if (!d) throw new ApiError(404, 'not_found', 'Issue not found')
    return detail(d)
  },
  report: async (body: { lat: number; lon: number; accuracy_m?: number; hazard: string; hazards?: string[]; danger?: boolean; note?: string; photo_upload_id?: string; captured_at: string }, _key: string): Promise<ReportResult> => {
    await delay(400)
    const prior = sessionIssues()
    const n = prior.length + 1001
    const now = new Date().toISOString()
    const d: DemoIssue = {
      id: `demo-${n}`,
      complaint_no: n,
      complaint_id: `DEMO-${String(n).padStart(4, '0')}`,
      hazard: body.hazard as Issue['hazard'],
      hazards: (body.hazards?.length ? body.hazards : [body.hazard]) as Issue['hazard'][],
      status: 'reported',
      severity: 3,
      ward: '9',
      location: { lat: body.lat, lon: body.lon },
      responsible: null,
      deadline_at: null,
      reports_count: 1,
      route_flags: [],
      created_at: now,
      updated_at: now,
      danger_flag: !!body.danger,
      route_reason: null,
      route_overridden: false,
      reopen_count: 0,
      fixed_at: null,
      copy_org: null,
      mine: true,
      eventsList: [{ id: n * 100, kind: 'status', from_status: null, to_status: 'reported', reason: null, system: false, created_at: now }],
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([d, ...prior]))
    return { report_id: `demo-report-${n}`, merged_into_existing: false, replayed: false, issue: toIssue(d), photo: body.photo_upload_id ? { evidence_id: 'demo-ev-1', location_ok: true } : null }
  },
  stageUpload: async (_lat: number, _lon: number, _file: Blob, _contentType: string) => {
    await delay(250)
    return { upload_id: 'demo-upload-1', expires_at: new Date(Date.now() + 3600e3).toISOString() }
  },
  uploadEvidence: async () => disabled('photo evidence upload'),
  evidenceBlobUrl: async () => disabled('viewing photos (no real photos are stored)'),
  confirm: async () => disabled('confirming a repair'),
  verify: async () => disabled('staff verification'),
  claimReview: async () => disabled('claiming review'),
  accept: async () => disabled('accepting work'),
  start: async () => disabled('starting work'),
  submitRepair: async () => disabled('submitting a repair'),
  dispute: async () => disabled('raising a dispute'),
  decideDispute: async () => disabled('deciding a dispute'),
  municipalDecision: async () => disabled('municipal decisions'),
  overrideRoute: async () => disabled('route overrides'),
  adminScorecards: async () => disabled('admin scorecards'),
  runEscalations: async () => disabled('admin jobs'),
  createOrg: async () => disabled('creating organisations'),
  grantMembership: async () => disabled('granting membership'),
  mailConsent: async () => disabled('mail consent (demo sends no mail)'),
  followupCampaigns: async (_issueId: string) => { await delay(); return { campaigns: [], deliveries: [] } },
  createFollowupCampaign: async () => disabled('follow-up campaigns (demo sends no mail)'),
  deleteFollowupCampaign: async () => disabled('follow-up campaigns'),
}
