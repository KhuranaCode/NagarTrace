import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { DEMO } from '../config'
import { EMAIL_OTP_ENABLED, GOOGLE_AUTH_ENABLED } from '../config'

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
  if (e.includes('token') || e.includes('otp'))
    return 'That code did not match or has expired. Request a new code and enter it promptly.'
  return err
}

export default function Login() {
  const { signIn, signUp, resendConfirmation, requestEmailOtp, verifyEmailOtp, signInWithGoogle } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'
  const [mode, setMode] = useState<'in' | 'up' | 'otp'>(EMAIL_OTP_ENABLED ? 'otp' : 'in')
  const [otpStage, setOtpStage] = useState<'email' | 'code'>('email')
  const [otpCode, setOtpCode] = useState('')
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
    if (mode === 'otp') {
      if (otpStage === 'email') {
        const err = await requestEmailOtp(email.trim())
        setBusy(false)
        if (err) {
          setError(friendly(err))
          const wait = retrySeconds(err)
          if (wait) startCooldown(wait)
        } else { setOtpStage('code'); startCooldown(30) }
      } else {
        const err = await verifyEmailOtp(email.trim(), otpCode.trim())
        setBusy(false)
        if (err) setError(friendly(err))
        else nav(from, { replace: true })
      }
    } else if (mode === 'in') {
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
      <h1 style={{ letterSpacing: '-0.02em' }}>{mode === 'otp' ? 'Sign in with a code' : mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
      <p className="muted">Report hazards, track repairs and confirm fixes in your ward.</p>

      <div className="auth-tabs" role="tablist" aria-label="Sign-in method">
        <button role="tab" aria-selected={mode === 'otp'} className={mode === 'otp' ? 'on' : ''} onClick={() => { setMode('otp'); setError(null) }}>Email code</button>
        <button role="tab" aria-selected={mode !== 'otp'} className={mode !== 'otp' ? 'on' : ''} onClick={() => { setMode('in'); setError(null) }}>Password</button>
      </div>
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
              Google sign-in is built but not open to everyone yet - the project owner has not enabled public
              access with Google. Password sign-in (tab above) works today.
            </p>
          </>
        )}
        {GOOGLE_AUTH_ENABLED ? <p className="small-note" style={{ textAlign: 'center', margin: '10px 0 0' }}>or use email below</p> : null}
      </div>

      {mode === 'otp' && !EMAIL_OTP_ENABLED ? (
      <div className="card pad-lg">
        <p style={{ marginTop: 0 }}>
          Sign-in by email code is built. It turns on when the project's mail service can send numeric codes -
          today it can only send link emails.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>Password sign-in works today - use the Password tab.</p>
      </div>
      ) : mode === 'otp' ? (
      <form onSubmit={submit} className="card pad-lg">
        <div className="field">
          <label htmlFor="email">{DEMO ? 'ID' : 'Email'}</label>
          <input id="email" type={DEMO ? 'text' : 'email'} required autoComplete={DEMO ? 'username' : 'email'} value={email} onChange={(e) => setEmail(e.target.value)} disabled={otpStage === 'code'} />
          {DEMO ? <p className="sub" style={{ marginTop: 6, fontSize: 12 }}>Demo build: sign in with ID <b>demo</b> and password <b>demo</b>. This is a mock account with simulated data only - do not enter a real password.</p> : null}
        </div>
        {otpStage === 'code' ? (
          <div className="field">
            <label htmlFor="otp">6-digit code</label>
            <input id="otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} className="otp-input" />
            <div className="hint">Enter the code we emailed to {email.trim()}. Verifying it signs you in and confirms your email.</div>
          </div>
        ) : null}
        {error ? <div className="error-box"><p>{error}</p></div> : null}
        <button className="btn primary block" disabled={busy || cooldown > 0 || (otpStage === 'code' && otpCode.trim().length !== 6)}>
          {busy ? 'Please wait…' : cooldown > 0 ? `Try again in ${cooldown}s` : otpStage === 'email' ? 'Send sign-in code' : 'Verify code and sign in'}
        </button>

        {otpStage === 'code' ? (
          <p style={{ textAlign: 'center', marginBottom: 0 }}>
            Did not get it?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); if (cooldown === 0) { setOtpStage('email'); setOtpCode(''); setError(null) } }}>Send a new code</a>
          </p>
        ) : null}
      </form>
      ) : (
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
      )}
      <p className="small-note" style={{ marginTop: 14 }}>
        Continue without an account to <Link to="/issues">browse public issue status</Link> - no login needed.
      </p>
    </div>
  )
}
