import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { PublicIssue } from '../types'
import { Deadline, ErrorBox, fmtDate, HazardTag, MapView, Spinner, STATUS_META, StatusPill, SyntheticBadge, timeAgo } from '../ui'

export default function PublicIssueDetail() {
  const { id } = useParams<{ id: string }>()
  const [issue, setIssue] = useState<PublicIssue | null>(null)
  const [err, setErr] = useState<unknown>(null)

  const load = () => {
    if (!id) return
    setErr(null)
    api.publicIssue(id).then(setIssue).catch(setErr)
  }
  useEffect(load, [id])

  if (err) return <div className="container section"><ErrorBox error={err} onRetry={load} /></div>
  if (!issue) return <div className="container section"><Spinner label="Loading issue. The free demo server may take a minute to wake up." /></div>

  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <p><Link to="/issues">← All issues</Link></p>
      <div className="card pad-lg">
        <div className="issue-top">
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}><HazardTag hazard={issue.hazard} /></h1>
          <span className="vis-pill public">Public record - no names, no photos</span>
          <StatusPill status={issue.status} />
        </div>
        <p className="muted">{STATUS_META[issue.status].hint}</p>
        <div className="issue-resp">
          {issue.responsible ? (
            <>
              <span>Responsible: <strong>{issue.responsible.name}</strong> ({issue.responsible.kind})</span>
              {issue.responsible.synthetic_data ? <SyntheticBadge /> : null}
            </>
          ) : (
            <span className="muted">No owner assigned yet - a municipal officer verifies new reports first.</span>
          )}
        </div>
        <div className="issue-meta">
          {issue.ward ? <span>Ward: {issue.ward}</span> : null}
          <span>Severity {issue.severity}/5</span>
          <span>{issue.reports_count} report{issue.reports_count === 1 ? '' : 's'}</span>
          <Deadline iso={issue.deadline_at} />
          <span>Reported {timeAgo(issue.created_at)}</span>
          <span>Updated {fmtDate(issue.updated_at)}</span>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <MapView height={300} pins={[{ id: issue.id, lat: issue.location.lat, lon: issue.location.lon, status: issue.status, label: issue.hazard }]} />
        <p className="small-note">Public locations are rounded to about 11 m. Photos are private to participants and are never shown publicly.</p>
      </div>
    </div>
  )
}
