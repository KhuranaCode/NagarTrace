import { API_BASE, DEMO } from './config'
import { demoApi } from './demo/api-demo'
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
      else if (j?.ai_available === false && typeof j?.reason === 'string') code = j.reason // AI 503s carry { ai_available, reason }, not { error }
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

export interface AiStatus { configured: boolean; available: boolean; model?: string; reason?: string }
export interface Advisory {
  summary: string
  severity_hint: 'low' | 'medium' | 'high' | null
  suggested_hazard: string | null
  missing_details: string[]
  model: string
  advisory: true
}
/** 503 body when the owner laptop is offline: never a fabricated suggestion. */
export interface AiUnavailable { ai_available: false; reason: string }
export type AiFeature = 'guide_chat' | 'email_draft' | 'report_check' | 'photo_advisory' | 'contractor_finder'

const realApi = {
  health: () => req<Health>('/health', { auth: false }),

  me: () => req<Me>('/v1/me'),
  patchMe: (body: { alias?: string; ward?: string }) => req<{ ok: true }>('/v1/me', { method: 'PATCH', body }),
  badges: () => req<Badges>('/v1/me/badges'),
  leaderboard: (ward: string | undefined, period: 'weekly' | 'all') =>
    req<{ leaderboard: LeaderRow[] }>(`/v1/leaderboard?period=${period}${ward ? `&ward=${encodeURIComponent(ward)}` : ''}`),

  publicIssues: (f: { status?: string; ward?: string; responsible?: string; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (f.status) q.set('status', f.status)
    if (f.ward) q.set('ward', f.ward)
    if (f.responsible) q.set('responsible', f.responsible)
    if (f.limit) q.set('limit', String(f.limit))
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

  report: (body: { lat: number; lon: number; accuracy_m?: number; hazard: string; hazards?: string[]; danger?: boolean; note?: string; photo_upload_id?: string; captured_at: string }, idempotencyKey: string) =>
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

  /** Owner-laptop AI bridge. Status: honest availability. Check: advisory only, 503-shaped when offline. */
  aiStatus: () => req<AiStatus>('/v1/ai/status'),
  aiReportCheck: async (body: { hazard: string; note?: string; lat: number; lon: number; ward?: string }): Promise<{ ai_available: true; advisory: Advisory } | AiUnavailable> => {
    try {
      return await req<{ ai_available: true; advisory: Advisory }>('/v1/ai/report-check', { method: 'POST', body })
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return { ai_available: false, reason: e.code !== 'error' ? e.code : 'http_503' }
      if (e instanceof ApiError && e.status === 403) return { ai_available: false, reason: e.code } // consent_required / ai_not_allowed
      if (e instanceof ApiError && e.status === 0) return { ai_available: false, reason: 'network' } // transport failed before any HTTP response
      if (e instanceof ApiError) return { ai_available: false, reason: `http_${e.status}` } // numeric status only, never the body
      // The deployed API may predate these routes: 404 = feature not live yet, say so honestly.
      if (e instanceof ApiError && e.status === 404) return { ai_available: false, reason: 'not_live_yet' }
      throw e
    }
  },
  /** Platform guide chat: answers how-the-app-works questions only; 503-shaped when the laptop is offline. */
  aiChat: async (message: string): Promise<{ ai_available: true; reply: string; model: string } | AiUnavailable> => {
    try {
      return await req<{ ai_available: true; reply: string; model: string }>('/v1/ai/chat', { method: 'POST', body: { message } })
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return { ai_available: false, reason: e.code !== 'error' ? e.code : 'http_503' }
      if (e instanceof ApiError && e.status === 403) return { ai_available: false, reason: e.code } // consent_required / ai_not_allowed
      if (e instanceof ApiError && e.status === 0) return { ai_available: false, reason: 'network' } // transport failed before any HTTP response
      if (e instanceof ApiError) return { ai_available: false, reason: `http_${e.status}` } // numeric status only, never the body
      if (e instanceof ApiError && e.status === 404) return { ai_available: false, reason: 'not_live_yet' }
      throw e
    }
  },
  /** Contractor brief: summarizes NHAI award-registry rows for a contractor name. Historical candidates only. */
  aiContractorBrief: async (contractorName: string): Promise<{ ai_available: true; found: boolean; reason?: string; brief: { summary: string; record_count: number; key_facts: string[]; model: string } | null; candidate_warning?: string } | AiUnavailable> => {
    try {
      return await req('/v1/ai/contractor-brief', { method: 'POST', body: { contractor_name: contractorName } })
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return { ai_available: false, reason: e.code }
      if (e instanceof ApiError && e.status === 403) return { ai_available: false, reason: e.code } // consent_required / ai_not_allowed
      if (e instanceof ApiError && e.status === 404) return { ai_available: false, reason: 'not_live_yet' }
      throw e
    }
  },
  /** Grievance email DRAFT: text the citizen reviews and sends themselves. The app never sends it. */
  aiEmailDraft: async (body: { hazard: string; note?: string; lat: number; lon: number; ward?: string; complaint_no?: string }): Promise<{ ai_available: true; subject: string; body: string; draft: true } | AiUnavailable> => {
    try {
      const r = await req<{ subject: string; body: string; draft: true }>('/v1/ai/email-draft', { method: 'POST', body })
      return { ai_available: true, ...r }
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) return { ai_available: false, reason: e.code }
      if (e instanceof ApiError && e.status === 403) return { ai_available: false, reason: e.code } // consent_required / ai_not_allowed
      if (e instanceof ApiError && e.status === 404) return { ai_available: false, reason: 'not_live_yet' }
      throw e
    }
  },
  /** AI consent: versioned notice, per-feature grant/revoke (server enforces before any processing). */
  aiConsentNotice: () => req<{ version: string; text: string; features: AiFeature[] }>('/v1/ai/consent-notice'),
  aiConsents: () => req<{ notice_version: string; consents: { feature: AiFeature; notice_version: string; granted_at: string; revoked_at: string | null }[] }>('/v1/ai/consents'),
  aiGrantConsent: (feature: AiFeature, notice_version: string) =>
    req<{ ok: true }>('/v1/ai/consents', { method: 'POST', body: { feature, notice_version } }),
  aiRevokeConsent: (feature: AiFeature) =>
    req<{ ok: true }>('/v1/ai/consents/revoke', { method: 'POST', body: { feature } }),
}

export type Api = typeof realApi
/** Demo builds serve the synthetic showcase adapter; real builds talk to the API. */
export const api: Api = DEMO ? (demoApi as Api) : realApi
