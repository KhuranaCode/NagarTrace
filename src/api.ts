import { API_BASE } from './config'
import { accessToken } from './auth'
import type { Badges, Issue, IssueDetail, LeaderRow, Me, NhaiAwardsBrowse, PublicIssue, ReportResult, Scorecard } from './types'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.body !== undefined && !headers['content-type']) headers['content-type'] = 'application/json'
  if (opts.auth !== false) {
    const t = await accessToken()
    if (t) headers['authorization'] = `Bearer ${t}`
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : headers['content-type'] === 'application/json' ? JSON.stringify(opts.body) : (opts.body as BodyInit),
    })
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check your connection or retry - the free host may still be waking up.')
  }
  if (!res.ok) {
    let code = 'error'
    let message = `Request failed (${res.status})`
    try {
      const j = await res.json()
      if (j?.error) code = j.error
      if (j?.message) message = j.message
    } catch { /* keep defaults */ }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}


export interface FollowupStage { day: number; subject: string; body_text: string }
export interface FollowupCampaign { id: string; audience: string; recipient_descriptor: string; recipient_verified: boolean; state: string; stages: FollowupStage[]; created_at: string }
export interface FollowupDelivery { campaign_id: string; stage_day: number; due_at: string; state: string; attempt_count: number; last_error: string | null }

export interface Health {
  ok: boolean
  verification_mode: string
  unrouted_triage: string
  policy: string
}

export const api = {
  health: () => req<Health>('/health', { auth: false }),

  me: () => req<Me>('/v1/me'),
  patchMe: (body: { alias?: string; ward?: string }) => req<{ ok: true }>('/v1/me', { method: 'PATCH', body }),
  badges: () => req<Badges>('/v1/me/badges'),
  leaderboard: (ward: string | undefined, period: 'weekly' | 'all') =>
    req<{ leaderboard: LeaderRow[] }>(`/v1/leaderboard?period=${period}${ward ? `&ward=${encodeURIComponent(ward)}` : ''}`),

  publicIssues: (f: { status?: string; ward?: string; responsible?: string } = {}) => {
    const q = new URLSearchParams()
    if (f.status) q.set('status', f.status)
    if (f.ward) q.set('ward', f.ward)
    if (f.responsible) q.set('responsible', f.responsible)
    const s = q.toString()
    return req<{ issues: PublicIssue[] }>(`/v1/public/issues${s ? `?${s}` : ''}`, { auth: false })
  },
  publicIssue: (id: string) => req<PublicIssue>(`/v1/public/issues/${id}`, { auth: false }),

  /** Official NHAI FY2024-25 award catalog browse. null when the deployed API predates the route. */
  nhaiAwards: async (f: { state?: string; nh?: string } = {}): Promise<NhaiAwardsBrowse | null> => {
    const q = new URLSearchParams()
    if (f.state) q.set('state', f.state)
    if (f.nh) q.set('nh', f.nh)
    q.set('limit', '352')
    try {
      return await req<NhaiAwardsBrowse>(`/v1/public/gov-records/nhai-awards?${q}`, { auth: false })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },

  myIssues: (f: { status?: string; responsible?: string } = {}) => {
    const q = new URLSearchParams()
    if (f.status) q.set('status', f.status)
    if (f.responsible) q.set('responsible', f.responsible)
    const s = q.toString()
    return req<{ issues: (Issue | PublicIssue)[] }>(`/v1/issues${s ? `?${s}` : ''}`)
  },
  issue: (id: string) => req<IssueDetail>(`/v1/issues/${id}`),

  report: (body: { lat: number; lon: number; accuracy_m?: number; hazard: string; danger?: boolean; note?: string; photo_upload_id?: string; captured_at: string }, idempotencyKey: string) =>
    req<ReportResult>('/v1/reports', { method: 'POST', body, headers: { 'idempotency-key': idempotencyKey } }),

  stageUpload: async (lat: number, lon: number, file: Blob, contentType: string) => {
    const t = await accessToken()
    const res = await fetch(`${API_BASE}/v1/uploads/stage?lat=${lat}&lon=${lon}`, {
      method: 'POST',
      headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), 'content-type': contentType },
      body: file,
    })
    if (!res.ok) {
      let code = 'error'
      let message = `Photo upload failed (${res.status})`
      try {
        const j = await res.json()
        if (j?.error) code = j.error
        if (j?.message) message = j.message
      } catch { /* keep defaults */ }
      throw new ApiError(res.status, code, message)
    }
    return (await res.json()) as { upload_id: string; expires_at: string }
  },

  uploadEvidence: async (issueId: string, kind: 'report' | 'after' | 'dispute', lat: number, lon: number, file: Blob, contentType: string) => {
    const t = await accessToken()
    const res = await fetch(`${API_BASE}/v1/issues/${issueId}/evidence?kind=${kind}&lat=${lat}&lon=${lon}`, {
      method: 'POST',
      headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), 'content-type': contentType },
      body: file,
    })
    if (!res.ok) {
      let code = 'error'
      let message = `Upload failed (${res.status})`
      try {
        const j = await res.json()
        if (j?.error) code = j.error
        if (j?.message) message = j.message
      } catch { /* keep defaults */ }
      throw new ApiError(res.status, code, message)
    }
    return (await res.json()) as { evidence_id: string; location_ok: boolean }
  },

  evidenceBlobUrl: async (issueId: string, evidenceId: string): Promise<string> => {
    const t = await accessToken()
    const res = await fetch(`${API_BASE}/v1/issues/${issueId}/evidence/${evidenceId}`, {
      headers: t ? { authorization: `Bearer ${t}` } : {},
    })
    if (!res.ok) throw new ApiError(res.status, 'evidence', 'Could not load this photo (photos are private to participants).')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  confirm: (id: string, is_fixed: boolean) => req<{ status: string; fixed_votes?: number; not_fixed_votes?: number }>(`/v1/issues/${id}/confirm`, { method: 'POST', body: { is_fixed } }),
  verify: (id: string, decision: 'verify' | 'reject', reason: string) => req<{ status: string }>(`/v1/issues/${id}/verify`, { method: 'POST', body: { decision, reason } }),
  claimReview: (id: string, reason: string, orgId?: string) => req<unknown>(`/v1/issues/${id}/claim-review`, { method: 'POST', body: orgId ? { org_id: orgId, reason } : { reason } }),
  accept: (id: string) => req<{ accepted: boolean; already: boolean }>(`/v1/issues/${id}/accept`, { method: 'POST', body: {} }),
  start: (id: string) => req<{ status: string }>(`/v1/issues/${id}/start`, { method: 'POST', body: {} }),
  submitRepair: (id: string, evidenceId: string) => req<{ status: string }>(`/v1/issues/${id}/submit-repair`, { method: 'POST', body: { evidence_id: evidenceId } }),
  dispute: (id: string, reason: string, evidenceId?: string) =>
    req<{ dispute_id: string }>(`/v1/issues/${id}/dispute`, { method: 'POST', body: evidenceId ? { reason, evidence_id: evidenceId } : { reason } }),
  decideDispute: (disputeId: string, decision: 'upheld' | 'rejected', reason: string) =>
    req<{ status: string }>(`/v1/disputes/${disputeId}/decide`, { method: 'POST', body: { decision, reason } }),
  municipalDecision: (id: string, decision: 'approve' | 'reject', reason: string) =>
    req<{ status: string }>(`/v1/issues/${id}/municipal-decision`, { method: 'POST', body: { decision, reason } }),
  overrideRoute: (id: string, orgId: string, reason: string) =>
    req<{ ok: true }>(`/v1/issues/${id}/override-route`, { method: 'POST', body: { org_id: orgId, reason } }),

  adminScorecards: () => req<{ scorecards: Scorecard[]; note: string }>('/v1/admin/scorecards'),
  runEscalations: () => req<unknown>('/v1/admin/jobs/escalate', { method: 'POST', body: {} }),
  createOrg: (body: { municipality_org_id: string; kind: 'contractor' | 'utility'; name: string; is_synthetic: boolean }) =>
    req<{ org_id: string }>('/v1/admin/orgs', { method: 'POST', body }),
  grantMembership: (body: { user_id: string; org_id: string; role: string }) => req<unknown>('/v1/admin/memberships', { method: 'POST', body }),
  // Follow-up reminder pipeline (feature-detected: absent on older API heads -> ApiError 404)
  mailConsent: (kind: 'report_reminders', granted: boolean, scope_version: string) =>
    req<{ kind: string; granted: boolean }>('/v1/me/mail-consent', { method: 'POST', body: { kind, granted, scope_version } }),
  followupCampaigns: (issueId: string) =>
    req<{ campaigns: FollowupCampaign[]; deliveries: FollowupDelivery[] }>(`/v1/issues/${issueId}/followup-campaigns`),
  createFollowupCampaign: (issueId: string, body: { audience: 'reporter' | 'authority'; recipient_descriptor: string; stages: FollowupStage[]; idempotency_key: string; recipient_email: string }) =>
    req<{ campaign_id: string; state: string; replayed?: boolean }>(`/v1/issues/${issueId}/followup-campaigns`, { method: 'POST', body }),
  deleteFollowupCampaign: (campaignId: string) =>
    req<{ revoked: boolean }>(`/v1/followup-campaigns/${campaignId}`, { method: 'DELETE' }),
}
