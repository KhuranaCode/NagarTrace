/**
 * Streak card for the Dashboard. Sits next to the points KPI; reads GET /v1/me/streaks.
 * Honest states only: while the streaks API is not deployed yet (404) or unreachable, it shows
 * a calm unavailable note instead of fake numbers. Light/minimal styling reuses existing classes.
 */
import { useEffect, useState } from 'react'
import { streaksApi, type Streaks } from '../streaks'

export default function StreakCard() {
  const [streaks, setStreaks] = useState<Streaks | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    streaksApi.get().then(setStreaks).catch(() => setUnavailable(true))
  }, [])

  if (unavailable) {
    return (
      <div className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ marginTop: 0 }}>Streak</h3>
        <p className="small-note" style={{ marginBottom: 0 }}>Streaks are not available yet. Your reports and points are unaffected.</p>
      </div>
    )
  }
  if (!streaks) return null

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <h3 style={{ marginTop: 0 }}>Streak</h3>
      <div className="kpi-row" style={{ margin: '10px 0 14px' }}>
        <div className="kpi"><div className="n">{streaks.current_streak}</div><div className="l">Day streak</div></div>
        <div className="kpi"><div className="n">{streaks.longest_streak}</div><div className="l">Best streak</div></div>
        <div className="kpi"><div className="n">{streaks.credited_days}</div><div className="l">Active days</div></div>
      </div>
      <div className="badge-row" style={{ marginBottom: 12 }}>
        {streaks.milestones.map((m) => (
          <span key={m.days} className={`badge-chip ${m.earned ? 'earned' : ''}`}>{m.earned ? '✓ ' : ''}{m.days}-day</span>
        ))}
      </div>
      <p className="small-note" style={{ marginBottom: 0 }}>
        {streaks.today_credited
          ? 'Today counts toward your streak.'
          : streaks.streak_alive
            ? 'Do a verified action today to keep the streak going.'
            : streaks.credited_days > 0
              ? 'Your streak paused. A verified action starts a new one.'
              : 'A day counts once your activity is verified.'}
        {' '}Days follow your timezone ({streaks.timezone}).
      </p>
    </div>
  )
}
