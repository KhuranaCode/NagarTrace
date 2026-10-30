import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Spinner } from '../ui'

const STORE_KEY = 'nagartrace-gmail-oauth'

/** Return page for Google consent. Pairs the callback with the verifier saved in this
 *  tab's session storage. Anything missing or failed is reported as-is - never a fake connect. */
export default function GmailCallback() {
  const [params] = useSearchParams()
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working')
  const [email, setEmail] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const gerr = params.get('error')
      if (gerr) { setState('failed'); setErr(gerr === 'access_denied' ? 'You declined the Google permission. Nothing was connected.' : `Google returned an error: ${gerr}. Nothing was connected.`); return }
      const st = params.get('state'); const code = params.get('code')
      if (!st || !code) { setState('failed'); setErr('The Google response was incomplete. Nothing was connected.'); return }
      const saved = sessionStorage.getItem(STORE_KEY)
      sessionStorage.removeItem(STORE_KEY)
      let verifier: string | null = null
      try {
        const parsed = saved ? JSON.parse(saved) : null
        if (parsed?.state === st && typeof parsed?.code_verifier === 'string') verifier = parsed.code_verifier
      } catch { /* fall through */ }
      if (!verifier) { setState('failed'); setErr('This sign-in was not started from this browser tab, or it expired. Nothing was connected - start again from Settings.'); return }
      try {
        const r = await api.gmailCallback({ state: st, code, code_verifier: verifier })
        setEmail(r.email); setState('done')
      } catch (e) {
        setState('failed'); setErr(e instanceof Error ? e.message : 'The connection could not be completed. Nothing was connected.')
      }
    }
    void run()
  }, [params])

  return (
    <div className="card pad" style={{ maxWidth: 560, margin: '48px auto' }}>
      <h2 style={{ marginTop: 0 }}>Gmail connection</h2>
      {state === 'working' && <><Spinner /><p className="muted">Finishing the connection with Google…</p></>}
      {state === 'done' && <p>Connected as <strong>{email}</strong>. You can close this tab or go back to <Link to="/app/settings">Settings</Link>.</p>}
      {state === 'failed' && <><p>{err}</p><p className="muted"><Link to="/app/settings">Back to Settings</Link></p></>}
    </div>
  )
}
