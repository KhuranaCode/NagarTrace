import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import type { Me } from '../types'

export default function Settings() {
  const { session, ready, signOut } = useAuth()
  const nav = useNavigate()
  const [me, setMe] = useState<Me | null>(null)
  const [alias, setAlias] = useState('')
  const [ward, setWard] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const m = await api.me()
      setMe(m)
      setAlias(m.alias ?? '')
      setWard(m.ward ?? '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load your profile')
    }
  }, [])

  useEffect(() => { if (session) void load() }, [session, load])

  if (ready && !session) {
    return (
      <div className="container section" style={{ maxWidth: 560 }}>
        <div className="card pad-lg" style={{ textAlign: 'center' }}>
          <p>Sign in to open your settings.</p>
          <Link to="/login" state={{ from: '/app/settings' }} className="btn primary block">Sign in</Link>
        </div>
      </div>
    )
  }
  if (!me) return <div className="container section"><p className="muted">Loading…</p>{err ? <div className="warn-box">{err}</div> : null}</div>

  const dirty = alias.trim() !== (me.alias ?? '') || ward.trim() !== (me.ward ?? '')

  const save = async () => {
    setBusy(true); setErr(null); setSaved(false)
    try {
      await api.patchMe({ alias: alias.trim() || undefined, ward: ward.trim() || undefined })
      await load()
      setSaved(true)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Settings</h1>
      <p className="muted">Your public identity and account.</p>

      <div className="card pad-lg" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Public identity</h2>
        <div className="field">
          <label htmlFor="alias">Public name</label>
          <input id="alias" type="text" value={alias} maxLength={40} onChange={(e) => { setAlias(e.target.value); setSaved(false) }} />
          <div className="hint">Shown publicly on the leaderboard next to your points. You can use your real name or a nickname - it is your choice, and you can change it anytime. Never filled from your Google account automatically.</div>
        </div>
        <div className="field">
          <label htmlFor="ward">Ward</label>
          <input id="ward" type="text" value={ward} maxLength={60} onChange={(e) => { setWard(e.target.value); setSaved(false) }} placeholder="e.g. Ward 12" />
          <div className="hint">Used to filter your local leaderboard and issues.</div>
        </div>
        {err ? <div className="warn-box">{err}</div> : null}
        {saved ? <div className="ok-box">Saved. The leaderboard shows your updated name immediately.</div> : null}
        <button className="btn primary" disabled={busy || !dirty || alias.trim().length < 2} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="card pad-lg" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <p style={{ margin: '4px 0' }}><span className="mono-label">Email</span><br />{session?.user.email}</p>
        <p style={{ margin: '12px 0 0' }}><span className="mono-label">Points</span><br />{me.points}</p>
        <p className="hint" style={{ marginTop: 12 }}>Points arrive only when activity is verified - signing in alone adds none.</p>
      </div>

      <div className="card pad-lg" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Emails &amp; reminders</h2>
        <p className="muted" style={{ marginBottom: 10 }}>
          NagarTrace sends no email today - no provider is connected, and nothing has ever been sent to you or to any authority.
        </p>
        <p className="muted" style={{ marginBottom: 10 }}>
          When report reminders launch, they will be opt-in from this page first. Messages to an authority about one of your reports
          additionally need a verified recipient and your approval of that exact message, every time. Signing up never grants access
          to your Gmail or any other mailbox - that would be a separate consent you can refuse.
        </p>
        <p className="hint" style={{ margin: 0 }}>Status: email not available yet. There is nothing to turn on or off.</p>
      </div>

      <div className="card pad-lg">
        <h2 style={{ marginTop: 0 }}>Session</h2>
        <button className="btn" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
      </div>
    </div>
  )
}
