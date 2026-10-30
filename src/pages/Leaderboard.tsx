import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { LeaderRow, Me } from '../types'
import { Empty, ErrorBox, Spinner } from '../ui'
import '../leaderboard.css'

type Period = 'weekly' | 'all'

export default function Leaderboard() {
  const { session, ready } = useAuth()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [ward, setWard] = useState('')
  const [appliedWard, setAppliedWard] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [me, setMe] = useState<Me | null>(null)

  const load = useCallback(() => {
    setErr(null)
    setRows(null)
    api
      .leaderboard(appliedWard || undefined, period)
      .then((r) => setRows(r.leaderboard))
      .catch(setErr)
  }, [appliedWard, period])

  useEffect(() => {
    if (session) {
      load()
      api.me().then(setMe).catch(() => undefined)
    }
  }, [session, load])

  if (ready && !session) {
    return (
      <div className="container section lb-signed-out">
        <p className="lb-eyebrow">Leaderboard</p>
        <h1 className="lb-title">The ward keeps score.</h1>
        <div className="notice-box">Sign in to see the leaderboard.</div>
        <Link to="/login" state={{ from: '/leaderboard' }} className="btn primary block">
          Sign in
        </Link>
      </div>
    )
  }

  const top = rows && rows.length > 0 ? rows[0] : null
  const rest = rows && rows.length > 1 ? rows.slice(1) : []

  return (
    <div className="container section lb-page">
      <header className="lb-head">
        <p className="lb-eyebrow">Leaderboard</p>
        <h1 className="lb-title">
          {appliedWard ? `Ward ${appliedWard} keeps score.` : 'The ward keeps score.'}
        </h1>
        <p className="muted lb-sub">
          Points reward useful action - verified reports, first reports, fix confirmations.
          Only chosen aliases are shown. Emails and account details stay private.
        </p>
        <div className="lb-controls">
          <div className="lb-period" role="group" aria-label="Period">
            <button
              type="button"
              className={period === 'weekly' ? 'lb-seg active' : 'lb-seg'}
              aria-pressed={period === 'weekly'}
              onClick={() => setPeriod('weekly')}
            >
              This week
            </button>
            <button
              type="button"
              className={period === 'all' ? 'lb-seg active' : 'lb-seg'}
              aria-pressed={period === 'all'}
              onClick={() => setPeriod('all')}
            >
              All time
            </button>
          </div>
          <form
            className="lb-wardform"
            onSubmit={(e) => {
              e.preventDefault()
              setAppliedWard(ward.trim())
            }}
          >
            <input
              type="text"
              className="lb-wardinput"
              placeholder="Filter by ward"
              aria-label="Filter by ward"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            />
            <button className="btn ghost small" type="submit">
              Apply
            </button>
            {appliedWard ? (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setWard('')
                  setAppliedWard('')
                }}
              >
                Clear
              </button>
            ) : null}
          </form>
        </div>
      </header>

      {err ? <ErrorBox error={err} onRetry={load} /> : null}
      {!rows && !err ? <Spinner label="Loading leaderboard." /> : null}
      {rows && rows.length === 0 ? (
        <Empty>
          {appliedWard
            ? `Nobody on the board for ward ${appliedWard} yet. Points come from verified, useful reports.`
            : 'Nobody on the board yet. Points come from verified, useful reports.'}
        </Empty>
      ) : null}
      {me && rows && !rows.some((r) => r.alias === me.alias && r.points === me.points) ? (
        <div className="notice-box" style={{ marginTop: 14 }}>
          You are not on the board yet{me.alias ? `, ${me.alias}` : ''}. The board ranks points, and points
          arrive only when activity is verified - a verified report, being first on a hazard, or confirming
          a fix. Signing in alone does not add points. Your Google name is not published automatically -
          the board uses your public alias, which you can change on your desk.
        </div>
      ) : null}

      {top ? (
        <section className="lb-first" aria-label="First place">
          <span className="lb-first-rank">1</span>
          <span className="lb-first-body">
            <strong className="lb-alias">{top.alias ?? 'anonymous'}</strong>
            <span className="lb-ward">{top.ward ? `Ward ${top.ward}` : 'Ward not set'}</span>
          </span>
          <span className="lb-points lb-points-first">
            {top.points.toLocaleString()}
            <span className="lb-pts">pts</span>
          </span>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <ol className="lb-list" aria-label="Leaderboard ranks 2 and below">
          {rest.map((r, i) => (
            <li className="lb-row" key={`${r.alias ?? 'anonymous'}-${r.ward ?? ''}-${i}`}>
              <span className="lb-rank">{i + 2}</span>
              <span className="lb-row-body">
                <strong className="lb-alias">{r.alias ?? 'anonymous'}</strong>
                <span className="lb-ward">{r.ward ? `Ward ${r.ward}` : 'Ward not set'}</span>
              </span>
              <span className="lb-points">
                {r.points.toLocaleString()}
                <span className="lb-pts">pts</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {rows && rows.length > 0 ? (
        <p className="muted lb-foot">
          {period === 'weekly' ? 'This week' : 'All time'}
          {appliedWard ? `, ward ${appliedWard}` : ''} - {rows.length}{' '}
          {rows.length === 1 ? 'reporter' : 'reporters'} on the board. Daily caps keep volume from
          beating honesty.
        </p>
      ) : null}
    </div>
  )
}
