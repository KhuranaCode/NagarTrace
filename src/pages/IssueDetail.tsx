import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { assessEvidence, formatVerdict, parsePhotoMetadata, type MetadataAssessment } from '../evidence/photo-metadata'
import { assessCorroboration, averageHash, formatCorroborationVerdict, type CorroborationAssessment } from '../evidence/corroboration'
import type { EvidenceMeta } from '../types'
import { useAuth } from '../auth'
import type { IssueDetail as Detail, Me } from '../types'
import { Deadline, ErrorBox, fmtDate, HazardTag, MapView, OfficialRecordsBlock, Spinner, STATUS_META, StatusPill, SyntheticBadge } from '../ui'
import RtiDraft from '../components/RtiDraft'
import GrievanceDraft from '../components/GrievanceDraft'
import Reminders from '../components/Reminders'

const EVENT_LABELS: Record<string, string> = {
  reported: 'Report submitted',
  merged: 'Duplicate report merged',
  routing_suggested: 'Routing suggested (awaits officer verification)',
  routed: 'Verified and assigned',
  accepted: 'Accepted by the responsible party',
  rejected_by_officer: 'Rejected by officer',
  fixed_by_municipal_approval: 'Fixed by municipal approval',
  reopened: 'Reopened',
  dispute_raised: 'Dispute raised',
  dispute_upheld: 'Dispute upheld - reassigned to municipality',
  dispute_rejected: 'Dispute rejected',
  route_override: 'Routing overridden by officer',
  escalation: 'Escalated',
  confirm_fixed: 'Citizen confirmed the fix',
  confirm_not_fixed: 'Citizen said not fixed',
}

function EvidenceImage({ issueId, evidenceId, cap }: { issueId: string; evidenceId: string; cap: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [assess, setAssess] = useState<MetadataAssessment | null>(null)
  const [metaBusy, setMetaBusy] = useState(false)
  useEffect(() => {
    let alive = true
    let obj: string | null = null
    api.evidenceBlobUrl(issueId, evidenceId)
      .then((u) => { obj = u; if (alive) setUrl(u) })
      .catch(() => alive && setFailed(true))
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj) }
  }, [issueId, evidenceId])

  // Reviewer aid: parse the stored photo's metadata on demand, on this device only.
  // The server re-encodes uploads as JPEG and drops EXIF, so most stored photos will
  // honestly report 'insufficient-data' - that means 'nothing to check', not suspicion.
  const loadDetails = async () => {
    if (!url || assess || metaBusy) return
    setMetaBusy(true)
    try {
      const blob = await (await fetch(url)).blob()
      const meta = await parsePhotoMetadata(blob)
      setAssess(assessEvidence(meta))
    } catch {
      setAssess(null)
    } finally {
      setMetaBusy(false)
    }
  }

  if (failed) return <div className="evidence-item"><div className="photo-drop">No access</div><div className="cap">{cap}</div></div>
  if (!url) return <div className="evidence-item"><div className="photo-drop">Loading…</div><div className="cap">{cap}</div></div>
  return (
    <div className="evidence-item">
      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={cap} /></a>
      <div className="cap">{cap}</div>
      <details className="photo-details" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void loadDetails() }}>
        <summary>Photo details{assess ? ` - ${formatVerdict(assess.verdict)}` : ''}</summary>
        {metaBusy ? <p className="small-note">Reading metadata on your device…</p> : null}
        {assess ? (
          <>
            <ul>
              {assess.signals.map((sig) => (
                <li key={sig.id} className={`sig-${sig.state}`}><strong>{sig.label}:</strong> {sig.detail}</li>
              ))}
            </ul>
            <p className="small-note">Read on your device only. Uploads are re-encoded and stripped of EXIF, so 'insufficient data' usually just means there is nothing left to check - it is not evidence of manipulation.</p>
          </>
        ) : null}
      </details>
    </div>
  )
}

/** Cross-photo consistency checks over the whole evidence set (on-device, honest wording). */
function CorroborationPanel({ issueId, evidence }: { issueId: string; evidence: EvidenceMeta[] }) {
  const [result, setResult] = useState<CorroborationAssessment | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (evidence.length === 0) { setResult(assessCorroboration([], new Map())); return }
    let live = true
    setBusy(true)
    void (async () => {
      const hashes = new Map<string, bigint | null>()
      await Promise.all(evidence.map(async (e) => {
        try {
          const objUrl = await api.evidenceBlobUrl(issueId, e.id)
          try {
            const blob = await (await fetch(objUrl)).blob()
            hashes.set(e.id, await averageHash(blob))
          } finally { URL.revokeObjectURL(objUrl) }
        } catch { hashes.set(e.id, null) }
      }))
      if (live) { setResult(assessCorroboration(evidence, hashes)); setBusy(false) }
    })()
    return () => { live = false }
  }, [issueId, evidence])
  if (!result) return null
  return (
    <details className="photo-details" style={{ marginTop: 10 }}>
      <summary>Cross-checks across these photos - {formatCorroborationVerdict(result.verdict)}</summary>
      {busy ? <p className="small-note">Comparing photos on your device…</p> : null}
      <ul>
        {result.signals.map((sig) => (
          <li key={sig.id} className={`sig-${sig.state}`}><strong>{sig.label}:</strong> {sig.detail}</li>
        ))}
      </ul>
      <p className="small-note">Cross-checks compare upload times, the server's upload-time GPS checks and pixel similarity. Upload time is not capture time, and pixel similarity is not identity. A pass is weak corroboration only - it never proves a photo is genuine.</p>
    </details>
  )
}

function ReasonForm({ label, placeholder, min = 10, onSubmit, submitLabel, danger }: {
  label: string
  placeholder: string
  min?: number
  submitLabel: string
  danger?: boolean
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true)
      setMsg(null)
      try {
        await onSubmit(reason.trim())
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Failed')
      } finally {
        setBusy(false)
      }
    }}>
      <div className="field">
        <label>{label}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={1000} />
        <div className="hint">At least {min} characters. This is added to the issue's recorded history.</div>
      </div>
      {msg ? <div className="error-box"><p>{msg}</p></div> : null}
      <button className={`btn ${danger ? 'danger' : 'dark'}`} disabled={busy || reason.trim().length < min}>{busy ? 'Working…' : submitLabel}</button>
    </form>
  )
}

/** Follow-up plan: the product's day 7/10/15/30 reminder + escalation ladder,
 *  shown with its TRUE state. Nothing here claims anything was sent. */
function FollowUpCard({ d }: { d: Detail }) {
  const open = d.status !== 'fixed' && d.status !== 'rejected'
  const submittedAt = new Date(d.created_at)
  const daysSince = Math.max(0, (+Date.now() - +submittedAt) / 86400000)
  const escalations = d.events.filter((e) => e.kind === 'escalation')
  const stages = [
    { day: 7, what: 'First reminder to the responsible party' },
    { day: 10, what: 'Second reminder' },
    { day: 15, what: 'Third reminder' },
    { day: 30, what: 'Escalation to the next level up' },
  ]
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Follow-up plan</h3>
      {!open ? (
        <p className="muted">This issue is {d.status === 'fixed' ? 'fixed' : 'closed'} - no follow-ups are scheduled.</p>
      ) : (
        <>
          <p className="muted">
            Our target is to chase open issues at days 7, 10, 15 and 30 after submission, then escalate. These are
            NagarTrace's own service targets, not legal deadlines for any authority.
          </p>
          <ul className="timeline">
            {stages.map((st) => {
              const due = daysSince >= st.day
              return (
                <li key={st.day}>
                  <strong>Day {st.day} - {st.what}:</strong>{' '}
                  {due ? (
                    <span>Due now, <strong>not sent</strong>. There is no verified delivery channel for the responsible party yet - nothing has been emailed or dispatched. Any real message needs a verified recipient and your explicit approval first.</span>
                  ) : (
                    <span>Not due yet ({Math.ceil(st.day - daysSince)} day(s) to go, counted from submission on {fmtDate(d.created_at)}).</span>
                  )}
                </li>
              )
            })}
          </ul>
          {escalations.length > 0 ? (
            <p className="muted">Escalation level recorded {escalations.length} time(s) by an officer (latest {fmtDate(escalations.reduce((a, b) => (+new Date(b.created_at) > +new Date(a.created_at) ? b : a)).created_at)}). A recorded level is internal status only - it is not a sent notice.</p>
          ) : (
            <p className="muted">No escalation recorded yet.</p>
          )}
        </>
      )}
    </div>
  )
}

export default function IssueDetail() {
  const [pipelineAvailable, setPipelineAvailable] = useState(true)
  const onPipelineUnavailable = useCallback(() => setPipelineAvailable(false), [])
  const { id } = useParams<{ id: string }>()
  const { session, ready } = useAuth()
  const [d, setD] = useState<Detail | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [actMsg, setActMsg] = useState<string | null>(null)
  const [actBusy, setActBusy] = useState(false)
  const afterFile = useRef<File | null>(null)
  const [afterName, setAfterName] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setErr(null)
    try {
      const [detail, meRes] = await Promise.all([api.issue(id), api.me()])
      setD(detail)
      setMe(meRes)
    } catch (e) {
      setErr(e)
    }
  }, [id])

  useEffect(() => { if (session) void load() }, [session, load])

  if (ready && !session) {
    return (
      <div className="container section" style={{ maxWidth: 520 }}>
        <h1>Issue detail</h1>
        <div className="notice-box">Full detail, photos and actions are private to the issue's participants. Sign in to continue.</div>
        <Link to="/login" state={{ from: `/app/issues/${id}` }} className="btn primary block">Sign in</Link>
        <p><Link to={`/issues/${id}`}>View the public summary instead →</Link></p>
      </div>
    )
  }
  if (err) {
    const e404 = err instanceof ApiError && err.status === 404
    return (
      <div className="container section">
        <ErrorBox error={e404 ? new Error('This issue is not visible to your account. Photos and details are private to its participants.') : err} onRetry={() => void load()} />
        <p><Link to="/app">← Back to my desk</Link></p>
      </div>
    )
  }
  if (!d || !me) return <div className="container section"><Spinner label="Loading issue. The free server sleeps when idle - first load can take a minute." /></div>

  const ms = me.memberships
  // The issue DTO does not expose org ids, so panels key off the user's memberships and the
  // server enforces the exact per-organisation permission (clear 403/404 messages shown on failure).
  const isMuniStaff = ms.some((m) => (m.role === 'officer' || m.role === 'admin') && m.kind === 'municipality')
  const isWorker = ms.some((m) => m.role === 'contractor' || m.role === 'utility')
  const canConfirm = d.status === 'awaiting_confirmation' && !isWorker && !isMuniStaff

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setActBusy(true)
    setActMsg(null)
    try {
      await fn()
      setActMsg(ok)
      await load()
    } catch (e) {
      setActMsg(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActBusy(false)
    }
  }

  const uploadAfter = async () => {
    const f = afterFile.current
    if (!f) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await act(async () => {
          const up = await api.uploadEvidence(d.id, 'after', pos.coords.latitude, pos.coords.longitude, f, f.type || 'image/jpeg')
          if (!up.location_ok) throw new Error('Photo location is more than 50 m from the issue - retake it at the repair site.')
          await api.submitRepair(d.id, up.evidence_id)
        }, 'Repair submitted. Citizens who reported this issue are now asked to confirm the fix.')
      },
      (e) => setActMsg(`GPS needed for the repair photo: ${e.message}`),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }

  return (
    <div className="container section" style={{ maxWidth: 860 }}>
      <p><Link to="/app">← My desk</Link></p>

      <div className="card pad-lg">
        <div className="issue-top">
          <h1 style={{ margin: 0, fontSize: '1.9rem' }}><HazardTag hazard={d.hazard} /></h1>
          {d.complaint_id ? <div className="muted" style={{ marginTop: 4, whiteSpace: 'nowrap' }}>Complaint {d.complaint_id}</div> : null}
          <StatusPill status={d.status} />
        </div>
        <p className="muted">{STATUS_META[d.status].hint}</p>
        {d.danger_flag ? <div className="warn-box">Marked dangerous by the reporter.</div> : null}
        <div className="issue-resp">
          {d.responsible ? (
            <>
              <span>Responsible: <strong>{d.responsible.name}</strong> ({d.responsible.kind})</span>
              {d.responsible.synthetic_data ? <SyntheticBadge /> : null}
            </>
          ) : (
            <span className="muted">No owner yet - a municipal officer verifies this report first. Any suggested routing is not final.</span>
          )}
          {d.copy_org ? <span className="muted">Copied: {d.copy_org}</span> : null}
        </div>
        {d.route_reason ? <p className="small-note">Routing reason: {d.route_reason}{d.route_overridden ? ' (overridden by an officer)' : ''}</p> : null}
        <div className="issue-meta">
          {d.ward ? <span>Ward: {d.ward}</span> : null}
          <span>Severity {d.severity}/5</span>
          <span>{d.reports_count} report{d.reports_count === 1 ? '' : 's'}</span>
          {d.reopen_count > 0 ? <span>Reopened {d.reopen_count}×</span> : null}
          <Deadline iso={d.deadline_at} />
          {d.fixed_at ? <span>Fixed {fmtDate(d.fixed_at)}</span> : null}
        </div>
      </div>

      {d.official_records ? <OfficialRecordsBlock rec={d.official_records} /> : null}
      <RtiDraft d={d} />
      <GrievanceDraft d={d} />

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Location</h3>
          <MapView height={260} pins={[{ id: d.id, lat: d.location.lat, lon: d.location.lon, status: d.status, label: d.hazard }]} />
          <p className="small-note" style={{ marginBottom: 0 }}>Full-precision location is visible only to participants.</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Photos <span className="vis-pill private" style={{ verticalAlign: 'middle' }}>Private to participants</span></h3>
          {d.evidence.length === 0 ? <p className="muted">No photos yet.</p> : (
            <div className="evidence-grid">
              {d.evidence.map((e) => (
                <EvidenceImage
                  key={e.id}
                  issueId={d.id}
                  evidenceId={e.id}
                  cap={`${e.kind === 'report' ? 'Report' : e.kind === 'after' ? 'Repair' : 'Dispute'} photo · ${e.location_ok ? 'location ok' : 'location not matched'} · ${fmtDate(e.created_at)}`}
                />
              ))}
            </div>
          )}
          <CorroborationPanel issueId={d.id} evidence={d.evidence} />
          <p className="small-note">Photos have no face or plate blur - they stay private to participants and are never shown publicly.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recorded history</h3>
        <ul className="timeline">
          {d.events.map((e) => (
            <li key={e.id}>
              <div className="ev-kind">{EVENT_LABELS[e.kind] ?? e.kind.replaceAll('_', ' ')}</div>
              <div className="ev-time">{fmtDate(e.created_at)}{e.system ? ' · system' : ''}{e.to_status ? ` · → ${STATUS_META[e.to_status].label}` : ''}</div>
              {e.reason ? <div className="ev-reason">{e.reason}</div> : null}
            </li>
          ))}
        </ul>
      </div>

      <FollowUpCard d={d} />
      {/* Self-reminder pipeline UI: renders only when the API exposes the follow-up routes;
          on older API heads the static honest FollowUpCard above stays as the fallback. */}
      {pipelineAvailable ? <Reminders d={d} email={session?.user?.email ?? null} onUnavailable={onPipelineUnavailable} /> : null}

      {actMsg ? <div className="notice-box">{actMsg}</div> : null}

      {canConfirm ? (
        <div className="card action-panel">
          <h3>Is it fixed?</h3>
          <p className="sub">The assigned party says the repair is done. You reported this - your vote counts. Two confirmations close it; two rejections reopen it. (Your account must be at least 24 h old.)</p>
          <div className="action-row">
            <button className="btn primary" disabled={actBusy} onClick={() => act(() => api.confirm(d.id, true), 'Thanks - your confirmation is recorded.')}>Yes, it's fixed</button>
            <button className="btn danger" disabled={actBusy} onClick={() => act(() => api.confirm(d.id, false), 'Recorded - the issue reopens when a second reporter agrees.')}>No, not fixed</button>
          </div>
        </div>
      ) : null}

      {isMuniStaff && d.status === 'reported' ? (
        <div className="card action-panel">
          <h3>Officer verification</h3>
          <p className="sub">Verifying assigns the suggested owner and starts the deadline clock. Rejecting closes the report as not accepted.</p>
          <ReasonForm
            label="Reason"
            placeholder="e.g. Verified on site - pothole on registry road W12-R3"
            submitLabel="Verify and assign"
            onSubmit={async (r) => { await api.verify(d.id, 'verify', r); setActMsg('Verified and assigned.'); await load() }}
          />
          <div style={{ height: 14 }} />
          <ReasonForm
            label="Rejection reason"
            placeholder="e.g. Not a road hazard - private property"
            submitLabel="Reject report"
            danger
            onSubmit={async (r) => { await api.verify(d.id, 'reject', r); setActMsg('Report rejected.'); await load() }}
          />
        </div>
      ) : null}

      {isMuniStaff && d.status === 'awaiting_confirmation' ? (
        <div className="card action-panel">
          <h3>Municipal decision</h3>
          <p className="sub">Citizen confirmations decide by default. As municipal staff you can approve the fix, or reject and reopen it.</p>
          <ReasonForm label="Reason" placeholder="e.g. Repair inspected and approved" submitLabel="Approve fix" onSubmit={async (r) => { await api.municipalDecision(d.id, 'approve', r); setActMsg('Approved as fixed.'); await load() }} />
          <div style={{ height: 14 }} />
          <ReasonForm label="Rejection reason" placeholder="e.g. Surface already cracking again" submitLabel="Reject and reopen" danger onSubmit={async (r) => { await api.municipalDecision(d.id, 'reject', r); setActMsg('Rejected - issue reopened.'); await load() }} />
        </div>
      ) : null}

      {isMuniStaff ? (
        <div className="card action-panel">
          <h3>Override routing</h3>
          <p className="sub">Reassign this issue to another organisation. The reason is logged permanently.</p>
          <ReasonForm
            label="Organisation ID and reason"
            placeholder="Paste the target organisation's UUID, then explain why"
            submitLabel="Override routing"
            onSubmit={async (r) => {
              const [orgId, ...rest] = r.split(/\s+/)
              await api.overrideRoute(d.id, orgId.trim(), rest.join(' ').trim() || 'Officer routing override')
              setActMsg('Routing overridden.')
              await load()
            }}
          />
        </div>
      ) : null}

      {isMuniStaff && Array.isArray(d.disputes) ? (
        <div className="card action-panel">
          <h3>Disputes</h3>
          {d.disputes.length === 0 ? (
            <p className="sub">No disputes on this issue.</p>
          ) : (
            d.disputes.map((dp) => (
              <div key={dp.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
                <div className="cap" style={{ marginBottom: 6 }}>
                  {dp.status === 'open' ? 'Open dispute' : dp.status === 'upheld' ? 'Upheld' : dp.status === 'rejected' ? 'Rejected' : dp.status}
                  {' · '}{fmtDate(dp.created_at)}
                </div>
                <p className="sub" style={{ margin: '0 0 8px' }}>{dp.reason}</p>
                {dp.decision_reason ? <p className="hint">Decision: {dp.decision_reason}</p> : null}
                {dp.status === 'open' ? (
                  <>
                    <ReasonForm label="Decision reason" placeholder="Why is this dispute upheld or rejected?" submitLabel="Uphold - reroute to municipality" onSubmit={async (r) => { await api.decideDispute(dp.id, 'upheld', r); setActMsg('Dispute upheld - issue rerouted to the municipality.'); await load() }} />
                    <div style={{ height: 12 }} />
                    <ReasonForm label="Rejection reason" placeholder="Why is the dispute rejected?" submitLabel="Reject dispute" danger onSubmit={async (r) => { await api.decideDispute(dp.id, 'rejected', r); setActMsg('Dispute rejected.'); await load() }} />
                  </>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {isWorker ? (
        <div className="card action-panel">
          <h3>Contractor / utility actions</h3>
          <p className="sub">Accept the assignment, start work, then upload the repair photo from the site. Disputes must be raised within 48 h of assignment.</p>
          <div className="action-row">
            {['assigned', 'reopened'].includes(d.status) ? (
              <>
                <button className="btn dark" disabled={actBusy} onClick={() => act(() => api.accept(d.id), 'Accepted.')}>Accept</button>
                <button className="btn primary" disabled={actBusy} onClick={() => act(() => api.start(d.id), 'Work started.')}>Start work</button>
              </>
            ) : null}
          </div>
          {d.status === 'in_progress' ? (
            <div style={{ marginTop: 16 }}>
              <div className="field">
                <label>Repair photo (taken at the site - GPS is checked)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => { afterFile.current = e.target.files?.[0] ?? null; setAfterName(e.target.files?.[0]?.name ?? null) }} />
                {afterName ? <div className="hint">{afterName}</div> : null}
              </div>
              <button className="btn primary" disabled={actBusy || !afterName} onClick={uploadAfter}>{actBusy ? 'Uploading…' : 'Submit repair for confirmation'}</button>
            </div>
          ) : null}
          {['assigned', 'in_progress', 'reopened'].includes(d.status) ? (
            <div style={{ marginTop: 18 }}>
              <ReasonForm
                label="Dispute this routing (within 48 h of assignment)"
                placeholder="e.g. This damage comes from the water board cut on 12 Aug - see records"
                submitLabel="Raise dispute"
                onSubmit={async (r) => { await api.dispute(d.id, r); setActMsg('Dispute raised. A municipal officer will decide.'); await load() }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
