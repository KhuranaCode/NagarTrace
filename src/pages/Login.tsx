import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmNotice, setConfirmNotice] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (mode === 'in') {
      const err = await signIn(email.trim(), password)
      setBusy(false)
      if (err) setError(err)
      else nav(from, { replace: true })
    } else {
      const r = await signUp(email.trim(), password)
      setBusy(false)
      if (r.error) setError(r.error)
      else if (r.needsConfirmation) setConfirmNotice(true)
      else nav(from, { replace: true })
    }
  }

  return (
    <div className="container" style={{ maxWidth: 460, paddingTop: 50 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
      <p className="muted">Report hazards, track repairs and confirm fixes in your ward.</p>

      {confirmNotice ? (
        <div className="notice-box">
          Check your email to confirm the account, then sign in. (Email confirmation is enabled on this demo project.)
        </div>
      ) : null}

      <form onSubmit={submit} className="card pad-lg">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'up' ? <div className="hint">At least 6 characters.</div> : null}
        </div>
        {error ? <div className="error-box"><p>{error}</p></div> : null}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <p style={{ textAlign: 'center', marginBottom: 0 }}>
          {mode === 'in' ? (
            <>New here? <a href="#" onClick={(e) => { e.preventDefault(); setMode('up'); setError(null) }}>Create an account</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('in'); setError(null) }}>Sign in</a></>
          )}
        </p>
      </form>
      <p className="small-note" style={{ marginTop: 14 }}>
        Continue without an account to <Link to="/issues">browse public issue status</Link> - no login needed.
      </p>
    </div>
  )
}
