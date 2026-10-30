import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Badges, Issue, Me, PublicIssue, Scorecard } from '../types'
import { Empty, ErrorBox, Spinner, SyntheticBadge } from '../ui'
import StreakCard from '../components/StreakCard'
import { IssueCard } from './shared'

export default function Dashboard() {
  const { session, ready } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [badges, setBadges] = useState<Badges | null>(null)
  const [mine, setMine] = useState<(Issue | PublicIssue)[] | null>(null)
  const [reviewQueue, setReviewQueue] = useState<(Issue | PublicIssue)[] | null>(null)
  const [awaitingDecision, setAwaitingDecision] = useState<(Issue | PublicIssue)[] | null>(null)
  const [assigned, setAssigned] = useState<(Issue | PublicIssue)[] | null>(null)
  const [scorecards, setScorecards] = useState<Scorecard[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [alias, setAlias] = useState('')
  const [ward, setWard] = useState('')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [escMsg, setEscMsg] = useState<string | null>(null)
  // First-visit welcome: shown until dismissed (per browser), only while the account has no reports.
  const [welcomed, setWelcomed] = useState<boolean>(() => {
    try { return localStorage.getItem('nt_welcomed') === '1' } catch { return true }
  })
  const dismissWelcome = () => {
    try { localStorage.setItem('nt_welcomed', '1') } catch { /* private mode: just hide for this visit */ }
    setWelcomed(true)
  }

  const load = useCallback(async () => {
    setErr(null)
    try {
      const m = await api.me()
      setMe(m)
      setAlias(m.alias ?? '')
      setWard(m.ward ?? '')
      const isMuni = m.memberships.some((x) => x.kind === 'municipality' && (x.role === 'officer' || x.role === 'admin'))
      const isAdmin = m.memberships.some((x) => x.role === 'admin')
      const isWorker = m.memberships.some((x) => x.role === 'contractor' || x.role === 'utility')
      const tasks: Promise<void>[] = [
        api.myIssues().then((r) => setMine(r.issues)),
        api.badges().then(setBadges).catch(() => undefined),
      ]
      if (isMuni) {
        tasks.push(api.myIssues({ status: 'reported' }).then((r) => setReviewQueue(r.issues)))
        tasks.push(api.myIssues({ status: 'awaiting_confirmation' }).then((r) => setAwaitingDecision(r.issues)))
      }
      if (isWorker) {
        tasks.push(api.myIssues().then((r) => setAssigned(r.issues.filter((i) => ['assigned', 'in_progress', 'reopened'].includes(i.status)))))
      }
      if (isAdmin) {
        tasks.push(api.adminScorecards().then((r) => setScorecards(r.scorecards)).catch(() => undefined))
      }
      await Promise.all(tasks)
    } catch (e) {
      setErr(e)
    }
  }, [])

  useEffect(() => {
    if (session) void load()
  }, [session, load])

  if (ready && !session) {
    return (
      <div className="container section" style={{ maxWidth: 520 }}>
        <h1>My desk</h1>
        <div className="notice-box">Sign in to see your reports, points and role workspaces.</div>
        <Link to="/login" state={{ from: '/app' }} className="btn primary block">Sign in</Link>
      </div>
    )
  }
  if (err) return <div className="container section"><ErrorBox error={err} onRetry={() => void load()} /></div>
  if (!me || !mine) return <div className="container section"><Spinner label="Loading your desk. The free server sleeps when idle - first load can take a minute." /></div>

  const isMuni = me.memberships.some((x) => x.kind === 'municipality' && (x.role === 'officer' || x.role === 'admin'))
  const isAdmin = me.memberships.some((x) => x.role === 'admin')
  const isWorker = me.memberships.some((x) => x.role === 'contractor' || x.role === 'utility')

  const saveProfile = async () => {
    setProfileMsg(null)
    try {
      await api.patchMe({ alias: alias.trim() || undefined, ward: ward.trim() || undefined })
      setProfileMsg('Saved.')
      void load()
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : 'Could not save')
    }
  }

  const runEsc = async () => {
    setEscMsg(null)
    try {
      await api.runEscalations()
      setEscMsg('Escalation check ran. Any overdue issues were recorded as escalated (recorded only - nothing is sent).')
      void load()
    } catch (e) {
      setEscMsg(e instanceof Error ? e.message : 'Failed')
    }
  }

  const showWelcome = !welcomed && mine.length === 0

  return (
    <div className="container section">
      <h1 style={{ letterSpacing: '-0.02em' }}>Namaste{me.alias ? `, ${me.alias}` : ''}</h1>
      <p className="muted">Your reports, your ward, your roles. <Link to="/app/settings">Settings →</Link></p>

      {showWelcome ? (
        <div className="card pad-lg welcome-card" role="status">
          <div className="welcome-kicker">Welcome to NagarTrace</div>
          <h2 style={{ marginTop: 6 }}>Every fixed road starts with one verified report.</h2>
          <p className="muted" style={{ maxWidth: 560 }}>
            NagarTrace routes what you report to the party actually responsible - the contractor under
            warranty, the utility that dug the cut, or the municipality - and keeps the record public
            until the repair is confirmed.
          </p>
          <ol className="welcome-steps">
            <li><strong>Set your public alias</strong> below - your real name is never shown.</li>
            <li><strong>Report a hazard</strong> with a photo and its location.</li>
            <li><strong>Track it to a confirmed repair</strong> - you get the record, the ward gets the fix.</li>
          </ol>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <Link to="/report" className="btn primary" onClick={dismissWelcome}>Report your first hazard →</Link>
            <button className="btn" onClick={dismissWelcome}>Got it</button>
          </div>
        </div>
      ) : null}

      {!me.alias ? (
        <div className="card pad-lg" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Set up your profile</h3>
          <p className="muted">Pick a public alias - your real name is never shown on leaderboards or issues.</p>
          <div className="field">
            <label htmlFor="alias">Public alias</label>
            <input id="alias" type="text" maxLength={40} placeholder="e.g. rajfromw12" value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ward">Ward (optional)</label>
            <input id="ward" type="text" maxLength={60} placeholder="e.g. Ward 12" value={ward} onChange={(e) => setWard(e.target.value)} />
          </div>
          {profileMsg ? <p className="muted">{profileMsg}</p> : null}
          <button className="btn primary" onClick={saveProfile} disabled={alias.trim().length < 2}>Save profile</button>
        </div>
      ) : null}

      <div className="kpi-row">
        <div className="kpi"><div className="n">{me.points}</div><div className="l">Points</div></div>
        <div className="kpi"><div className="n">{mine.length}</div><div className="l">Issues you follow</div></div>
        <div className="kpi"><div className="n">{me.ward ?? '—'}</div><div className="l">Ward</div></div>
      </div>

      <StreakCard />

      {badges ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <h3 style={{ marginTop: 0 }}>Badges</h3>
          <div className="badge-row">
            {badges.badges.map((b) => (
              <span key={b.badge} className={`badge-chip ${b.earned ? 'earned' : ''}`}>{b.earned ? '✓ ' : ''}{b.badge}</span>
            ))}
          </div>
          <p className="small-note" style={{ marginBottom: 0 }}>
            Reports: {badges.progress.reports} · Fix confirmations: {badges.progress.fix_confirmations}. Badges count submitted reports; there is no verification step for them yet.
          </p>
        </div>
      ) : null}

      {isMuni ? (
        <section style={{ marginBottom: 26 }}>
          <h2>Municipal workspace</h2>
          <div className="grid cols-2">
            <div>
              <h3>Reports to verify ({reviewQueue?.length ?? '…'})</h3>
              <div className="grid">
                {reviewQueue?.length === 0 ? <Empty>Nothing waiting for verification.</Empty> : null}
                {reviewQueue?.map((i) => <IssueCard key={i.id} issue={i} to={`/app/issues/${i.id}`} />)}
              </div>
            </div>
            <div>
              <h3>Fixes awaiting municipal decision ({awaitingDecision?.length ?? '…'})</h3>
              <div className="grid">
                {awaitingDecision?.length === 0 ? <Empty>No submitted fixes waiting.</Empty> : null}
                {awaitingDecision?.map((i) => <IssueCard key={i.id} issue={i} to={`/app/issues/${i.id}`} />)}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isWorker ? (
        <section style={{ marginBottom: 26 }}>
          <h2>Contractor / utility workspace</h2>
          <p className="muted">Issues assigned to your organisation. Open one to accept, start work, upload the repair photo or dispute the routing.</p>
          <div className="grid cols-2">
            {assigned?.length === 0 ? <Empty>Nothing assigned right now.</Empty> : null}
            {assigned?.map((i) => <IssueCard key={i.id} issue={i} to={`/app/issues/${i.id}`} />)}
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: 26 }}>
        <h2>Your reports</h2>
        <div className="grid cols-2">
          {mine.length === 0 ? (
            <Empty>
              No reports yet. <Link to="/report">Report your first hazard →</Link>
            </Empty>
          ) : null}
          {mine.map((i) => <IssueCard key={i.id} issue={i} to={`/app/issues/${i.id}`} />)}
        </div>
      </section>

      {isAdmin ? (
        <section>
          <h2>Admin</h2>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Contractor performance (not public - legal review pending)</h3>
            {scorecards && scorecards.length > 0 ? (
              <table className="table">
                <thead>
                  <tr><th>Organisation</th><th>Issues</th><th>Fix rate</th><th>Avg fix time</th><th>Reopen rate</th></tr>
                </thead>
                <tbody>
                  {scorecards.map((s) => (
                    <tr key={s.org_id}>
                      <td>{s.name} {s.synthetic_data ? <SyntheticBadge /> : null}</td>
                      <td>{s.issues}</td>
                      <td>{Math.round(s.fix_rate * 100)}%</td>
                      <td>{s.avg_fix_hours == null ? '—' : `${Math.round(s.avg_fix_hours)} h`}</td>
                      <td>{Math.round(s.reopen_rate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No scored organisations yet.</p>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Escalation check</h3>
            <p className="muted">Records escalation levels for overdue issues. Nothing is emailed or sent - recorded only.</p>
            {escMsg ? <p className="muted">{escMsg}</p> : null}
            <button className="btn dark" onClick={runEsc}>Run escalation check</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
