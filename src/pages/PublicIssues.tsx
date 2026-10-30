import { useEffect, useState } from 'react'
import { api } from '../api'
import type { PublicIssue, Status } from '../types'
import { Empty, ErrorBox, MapView, Spinner, STATUS_META } from '../ui'
import { IssueCard } from './shared'
import { useNavigate } from 'react-router-dom'

export default function PublicIssues() {
  const [issues, setIssues] = useState<PublicIssue[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [status, setStatus] = useState('')
  const [ward, setWard] = useState('')
  const [responsible, setResponsible] = useState('')
  const nav = useNavigate()

  const load = () => {
    setErr(null)
    setIssues(null)
    api
      .publicIssues({ status: status || undefined, ward: ward || undefined, responsible: responsible || undefined })
      .then((r) => setIssues(r.issues))
      .catch(setErr)
  }
  useEffect(load, [status, responsible])

  const wards = Array.from(new Set((issues ?? []).map((i) => i.ward).filter((w): w is string => !!w)))

  return (
    <div className="container section">
      <h1 style={{ letterSpacing: '-0.02em' }}>Live issue status</h1>
      <p className="muted">Public view - no names, no photos, rounded locations. No login needed.</p>

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <select value={responsible} onChange={(e) => setResponsible(e.target.value)} aria-label="Filter by responsible party">
          <option value="">Any responsible party</option>
          <option value="municipality">Municipality</option>
          <option value="contractor">Contractor</option>
          <option value="utility">Utility</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load() }} style={{ display: 'flex', gap: 8 }}>
          <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Filter by ward">
            <option value="">All wards</option>
            {wards.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button className="btn ghost small" type="submit">Apply ward</button>
        </form>
      </div>

      {err ? <ErrorBox error={err} onRetry={load} /> : null}
      {!issues && !err ? <Spinner label="Loading. The free server sleeps when idle - first load can take a minute." /> : null}
      {issues && issues.length === 0 ? <Empty>No reports to show yet. When a genuine report is filed, it appears here.</Empty> : null}
      {issues && issues.length > 0 ? (
        <>
          <MapView
            pins={issues.map((i) => ({ id: i.id, lat: i.location.lat, lon: i.location.lon, status: i.status, label: `${i.hazard} - ${i.status}` }))}
            onSelect={(id) => nav(`/issues/${id}`)}
          />
          <div className="grid cols-2" style={{ marginTop: 20 }}>
            {issues.map((i) => (
              <IssueCard key={i.id} issue={i} to={`/issues/${i.id}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
