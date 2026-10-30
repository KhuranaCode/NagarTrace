export type Hazard = 'pothole' | 'crack' | 'waterlogging' | 'broken_edge' | 'missing_cover' | 'other'
export type Status = 'reported' | 'verified' | 'assigned' | 'in_progress' | 'awaiting_confirmation' | 'fixed' | 'reopened' | 'rejected'

export interface PublicIssue {
  id: string
  hazard: Hazard
  status: Status
  severity: number
  ward: string | null
  location: { lat: number; lon: number }
  responsible: { kind: string; name: string; synthetic_data: boolean } | null
  deadline_at: string | null
  reports_count: number
  route_flags: string[]
  created_at: string
  updated_at: string
  triage_only?: boolean
}

export interface Issue extends PublicIssue {
  danger_flag: boolean
  route_reason: string | null
  route_overridden: boolean
  reopen_count: number
  fixed_at: string | null
  copy_org: string | null
}

export interface EventItem {
  id: number
  kind: string
  from_status: Status | null
  to_status: Status | null
  reason: string | null
  system: boolean
  created_at: string
}

export interface EvidenceMeta {
  id: string
  kind: 'report' | 'after' | 'dispute'
  location_ok: boolean
  created_at: string
}

export interface DisputeRecord {
  id: string
  status: 'open' | 'upheld' | 'rejected' | string
  reason: string
  org_id: string
  evidence_id: string | null
  created_at: string
  decided_at: string | null
  decision_reason: string | null
}

export interface IssueDetail extends Issue {
  events: EventItem[]
  evidence: EvidenceMeta[]
  redaction?: string
  // authorized staff only (absent for reporters/public and on older API versions)
  disputes?: DisputeRecord[]
  responsible_org_id?: string
  copy_org_id?: string
  review_org_id?: string
}

export type Role = 'admin' | 'officer' | 'contractor' | 'utility'
export type OrgKind = 'municipality' | 'contractor' | 'utility'

export interface Membership {
  org_id: string
  kind: OrgKind
  role: Role
}

export interface Me {
  id: string
  alias: string | null
  ward: string | null
  points: number
  created_at: string
  memberships: Membership[]
}

export interface Badges {
  badges: { badge: string; earned: boolean }[]
  progress: { reports: number; fix_confirmations: number }
  note: string
}

export interface ReportResult {
  report_id: string
  merged_into_existing: boolean
  replayed: boolean
  issue: Issue
  photo?: { evidence_id: string; location_ok: boolean } | null
}

export interface Scorecard {
  org_id: string
  name: string
  synthetic_data: boolean
  issues: number
  fix_rate: number
  avg_fix_hours: number | null
  reopen_rate: number
}

export interface LeaderRow {
  alias: string | null
  ward: string | null
  points: number
}
