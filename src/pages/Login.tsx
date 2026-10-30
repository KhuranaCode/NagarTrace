import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { GOOGLE_AUTH_ENABLED } from '../config'

function retrySeconds(err: string): number | null {
  const m = err.match(/after (\d+) seconds?/i)
  return m ? parseInt(m[1], 10) : null
}

function friendly(err: string): string {
  const wait = retrySeconds(err)
  if (wait) return `Too many attempts. The mail service asked us to wait ${wait} seconds - the form will unlock when it is time.`

  const e = err.toLowerCase()
  if (e.includes('email not confirmed'))
    return 'This email is not confirmed yet. Open the confirmation link we sent you, then sign in.'
  if (e.includes('invalid login credentials'))
    return 'Wrong email or password. If you just signed up, confirm your email from the link we sent first.'
  if (e.includes('user already registered'))
    return 'This email already has an account. Sign in instead.'
  if (e.includes('security purposes') || e.includes('rate limit') || e.includes('too many'))
    return 'Too many attempts. Please wait a little, then try again.'
  if (e.includes('password'))
    return 'Password needs at least 6 characters.'
  return err
}

export default function Login() {
  const { signIn, signUp, resendConfirmation, signInWithGoogle } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // After a successful signup (or when an unconfirmed user tries to sign in)
  // the form is replaced by this panel so success and error states never mix.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [sentNow, setSentNow] = useState(false)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const startCooldown = (secs: number) => {
    setCooldown(secs)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) { clearInterval(timer.current); timer.current = null }
        return c - 1
      })
    }, 1000)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResent(false)
    if (mode === 'in') {
      const err = await signIn(email.trim(), password)
      setBusy(false)
      if (err) {
        if (err.toLowerCase().includes('email not confirmed')) setAwaitingConfirm(true)
        else setError(friendly(err))
      } else nav(from, { replace: true })
    } else {
      const r = await signUp(email.trim(), password)
      setBusy(false)
      if (r.error) {
        setError(friendly(r.error))
        const wait = retrySeconds(r.error)
        if (wait) startCooldown(wait)
      }
      else if (r.needsConfirmation) { setSentNow(true); setAwaitingConfirm(true); startCooldown(30) }
      else nav(from, { replace: true })
    }
  }

  const resend = async () => {
    if (cooldown > 0 || busy) return
    setBusy(true)
    setError(null)
    const err = await resendConfirmation(email.trim())
    setBusy(false)
    if (err) {
      setError(friendly(err))
      const wait = retrySeconds(err)
      if (wait) startCooldown(wait)
    }
    else { setResent(true); setSentNow(true); startCooldown(30) }
  }

  const google = async () => {
    setBusy(true)
    setError(null)
    const err = await signInWithGoogle()
    setBusy(false)
    if (err) setError(friendly(err))
  }

  if (awaitingConfirm) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingTop: 50 }}>
        <h1 style={{ letterSpacing: '-0.02em' }}>Confirm your email</h1>
        <div className="card pad-lg">
          <p>
            {sentNow
              ? <>We sent a confirmation link to <strong>{email.trim()}</strong>. Open that email and tap the link, then come back and sign in.</>
              : <>The account <strong>{email.trim()}</strong> is not confirmed yet. Open the confirmation link from its original email, or resend it below.</>}
          </p>
          <p className="muted">
            The email can take a few minutes. Check Spam and Promotions folders too. If it does not arrive,
            resend it below.
          </p>
          {resent ? <div className="notice-box">Confirmation email sent again.</div> : null}
          {error ? <div className="error-box"><p>{error}</p></div> : null}
          <button className="btn dark block" onClick={resend} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : busy ? 'Sending…' : 'Resend confirmation email'}
          </button>
          <p style={{ textAlign: 'center', marginBottom: 0 }}>
            Confirmed already?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setAwaitingConfirm(false); setSentNow(false); setMode('in'); setError(null); setResent(false); setPassword('') }}>Sign in</a>
          </p>
        </div>
        <p className="small-note" style={{ marginTop: 14 }}>
          Continue without an account to <Link to="/issues">browse public issue status</Link> - no login needed.
        </p>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 460, paddingTop: 50 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
      <p className="muted">Report hazards, track repairs and confirm fixes in your ward.</p>

      <div className="card pad-lg" style={{ marginBottom: 14 }}>
        {GOOGLE_AUTH_ENABLED ? (
          <button className="btn dark block" onClick={google} disabled={busy}>
            Continue with Google
          </button>
        ) : (
          <>
            <button className="btn dark block" disabled title="Google sign-in is not open to everyone yet">
              Continue with Google
            </button>
            <p className="small-note" style={{ textAlign: 'center', margin: '10px 0 0' }}>
              Google sign-in is ready in the app but stays locked until Google's app review is completed by the
              project owner. Email sign-in below works today.
            </p>
          </>
        )}
        {GOOGLE_AUTH_ENABLED ? <p className="small-note" style={{ textAlign: 'center', margin: '10px 0 0' }}>or use email below</p> : null}
      </div>

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
        <button className="btn primary block" disabled={busy || cooldown > 0}>
          {busy ? 'Please wait…' : cooldown > 0 ? `Try again in ${cooldown}s` : mode === 'in' ? 'Sign in' : 'Create account'}
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
