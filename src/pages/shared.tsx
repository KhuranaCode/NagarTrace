import { Link } from 'react-router-dom'
import type { PublicIssue } from '../types'
import { Deadline, HazardTag, StatusPill, SyntheticBadge, timeAgo } from '../ui'

export function IssueCard({ issue, to }: { issue: PublicIssue; to: string }) {
  return (
    <Link to={to} className="card issue-card">
      <div className="issue-top">
        <HazardTag hazard={issue.hazard} />
        <StatusPill status={issue.status} />
      </div>
      {issue.complaint_id ? <div className="issue-meta"><span>Complaint {issue.complaint_id}</span></div> : null}
      <div className="issue-resp">
        {issue.responsible ? (
          <>
            <span>
              Responsible: <strong>{issue.responsible.name}</strong> ({issue.responsible.kind})
            </span>
            {issue.responsible.synthetic_data ? <SyntheticBadge /> : null}
          </>
        ) : (
          <span className="muted">No owner assigned yet - awaiting officer verification</span>
        )}
      </div>
      <div className="issue-meta">
        {issue.ward ? <span>Ward: {issue.ward}</span> : null}
        <span>Severity {issue.severity}/5</span>
        <span>{issue.reports_count} report{issue.reports_count === 1 ? '' : 's'}</span>
        <Deadline iso={issue.deadline_at} />
        <span>{timeAgo(issue.created_at)}</span>
      </div>
      {issue.route_flags?.length ? (
        <div className="issue-meta">
          {issue.route_flags.map((f) => (
            <span key={f} className="syn-badge" title="Routing flag">{f.replaceAll('_', ' ')}</span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
