import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { LeaderRow } from '../types'
import { Empty, ErrorBox, Spinner } from '../ui'

export default function Leaderboard() {
  const { session, ready } = useAuth()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [ward, setWard] = useState('')
  const [period, setPeriod] = useState<'weekly' | 'all'>('all')

  const load = () => {
    setErr(null)
    setRows(null)
    api.leaderboard(ward || undefined, period).then((r) => setRows(r.leaderboard)).catch(setErr)
  }
  useEffect(() => { if (session) load() }, [session, period])

  if (ready && !session) {
    return (
      <div className="container section" style={{ maxWidth: 520 }}>
        <h1>Ward leaderboard</h1>
        <div className="notice-box">Sign in to see the leaderboard.</div>
        <Link to="/login" state={{ from: '/leaderboard' }} className="btn primary block">Sign in</Link>
      </div>
    )
  }

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Ward leaderboard</h1>
      <p className="muted">Points reward useful actions: verified reports, first reports, fix confirmations. Daily caps keep volume from beating honesty. Aliases only - never real names.</p>
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value as 'weekly' | 'all')} aria-label="Period">
          <option value="all">All time</option>
          <option value="weekly">This week</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load() }} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Ward (optional)"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            style={{ font: 'inherit', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10 }}
          />
          <button className="btn ghost small" type="submit">Apply</button>
        </form>
      </div>
      {err ? <ErrorBox error={err} onRetry={load} /> : null}
      {!rows && !err ? <Spinner label="Loading leaderboard." /> : null}
      {rows && rows.length === 0 ? <Empty>Nobody on the board yet. Points come from verified, useful reports.</Empty> : null}
      {rows && rows.length > 0 ? (
        <div className="card" style={{ padding: 6 }}>
          <table className="table">
            <thead><tr><th>#</th><th>Alias</th><th>Ward</th><th>Points</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><strong>{r.alias ?? 'anonymous'}</strong></td>
                  <td>{r.ward ?? '—'}</td>
                  <td>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
