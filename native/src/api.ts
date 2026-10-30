// NagarTrace API client. Contract: docs/API.md of nagartrace-api (backend authoritative).
// Public surface needs no auth; citizen surface uses the Supabase access token as Bearer.
import { API_BASE } from './config'
import { supabase } from './supabase'

export type Hazard = 'pothole' | 'crack' | 'waterlogging' | 'broken_edge' | 'missing_cover' | 'other'
export type Status =
  | 'reported' | 'verified' | 'assigned' | 'in_progress'
  | 'awaiting_confirmation' | 'fixed' | 'reopened' | 'rejected'

export interface PublicIssue {
  id: string
  hazard: Hazard
  status: Status
  severity: string
  ward: string | null
  location: { lat: number; lon: number }
  responsible: { kind: string; name: string; synthetic_data: boolean } | null
  deadline_at: string | null
  reports_count: number
  route_flags: string[]
  created_at: string
  updated_at: string
}

export interface Issue extends PublicIssue {
  danger_flag: boolean
  route_reason: string | null
  route_overridden: boolean
  reopen_count: number
  fixed_at: string | null
  copy_org: string | null
}

export interface EventItem { id: string; kind: string; from_status: string | null; to_status: string | null; reason: string | null; system: boolean; created_at: string }
export interface EvidenceMeta { id: string; kind: 'report' | 'after' | 'dispute'; location_ok: boolean; created_at: string }
export interface IssueDetail extends Issue { events: EventItem[]; evidence: EvidenceMeta[] }

export interface Me {
  id: string
  alias: string | null
  ward: string | null
  points: number
  created_at: string
  memberships: { org_id: string; kind: string; role: string }[]
}

export interface ReportResult {
  report_id: string
  merged_into_existing: boolean
  replayed: boolean
  issue: Issue
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message) }
}

async function token(): Promise<string | null> {
  if (process.env.EXPO_PUBLIC_MOCK_AUTH === '1') return 'mock-fixture-token' // isolated UI-test mode
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function req<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders }
  const t = await token()
  if (t) headers.Authorization = `Bearer ${t}`
  let init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${API_BASE}${path}`, init)
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON */ }
  if (!res.ok) {
    const code = json?.error ?? `http_${res.status}`
    throw new ApiError(code, json?.message ?? `Request failed (${res.status})`, res.status)
  }
  return json as T
}

export const fetchPublicIssues = () => req<{ issues: PublicIssue[] }>('GET', '/v1/public/issues')
export const fetchPublicIssue = (id: string) => req<PublicIssue>('GET', `/v1/public/issues/${id}`)

export const getMe = () => req<Me>('GET', '/v1/me')
export const patchMe = (patch: { alias?: string; ward?: string }) => req<{ ok: true }>('PATCH', '/v1/me', patch)
export const getBadges = () => req<{ badges: { badge: string; earned: boolean }[]; progress: { reports: number; fix_confirmations: number }; note: string }>('GET', '/v1/me/badges')
export const getLeaderboard = (period: 'weekly' | 'all', ward?: string) =>
  req<{ leaderboard: { alias: string | null; ward: string | null; points: number }[] }>('GET', `/v1/leaderboard?period=${period}${ward ? `&ward=${encodeURIComponent(ward)}` : ''}`)

export const getMyIssues = () => req<{ issues: (Issue | PublicIssue)[] }>('GET', '/v1/issues')
export const getIssueDetail = (id: string) => req<IssueDetail>('GET', `/v1/issues/${id}`)

export const postReport = (input: { lat: number; lon: number; accuracy_m?: number; hazard: Hazard; danger?: boolean; note?: string; captured_at: string }, idempotencyKey: string) =>
  req<ReportResult>('POST', '/v1/reports', input, { 'Idempotency-Key': idempotencyKey })

export async function uploadEvidence(issueId: string, kind: 'report' | 'after' | 'dispute', lat: number, lon: number, uri: string, mime: string): Promise<{ evidence_id: string; location_ok: boolean }> {
  const t = await token()
  const blob = await (await fetch(uri)).blob()
  const res = await fetch(`${API_BASE}/v1/issues/${issueId}/evidence?kind=${kind}&lat=${lat}&lon=${lon}`, {
    method: 'POST',
    headers: { 'Content-Type': mime, ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: blob,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(json?.error ?? `http_${res.status}`, json?.message ?? `Upload failed (${res.status})`, res.status)
  return json
}

export const confirmIssue = (id: string, isFixed: boolean) =>
  req<{ status: string; fixed_votes?: number; not_fixed_votes?: number }>('POST', `/v1/issues/${id}/confirm`, { is_fixed: isFixed })
