import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'

const STORE_KEY = 'nagartrace-gmail-oauth'

/** Connect the user's OWN Gmail so authority emails go from their address, with their
 *  explicit per-send review. Honest states: 503 = this deployment has no Gmail setup;
 *  that is "not available here", never a fake success. */
export default function GmailConnect() {
  const [state, setState] = useState<'loading' | 'unavailable' | 'ready'>('loading')
  const [connected, setConnected] = useState<{ email: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = async () => {
    try {
      const s = await api.gmailStatus()
      setState('ready')
      setConnected(s.connected && s.email ? { email: s.email } : null)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 503 || e.code === 'gmail_unconfigured')) setState('unavailable')
      else if (e instanceof ApiError && e.status === 404) setState('unavailable')
      else { setState('ready'); setErr(e instanceof Error ? e.message : 'Could not check Gmail status') }
    }
  }
  useEffect(() => { void load() }, [])

  const connect = async () => {
    setBusy(true); setErr(null)
    try {
      const s = await api.gmailStart()
      // state + verifier stay in THIS browser tab's session storage; the callback reads them back.
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ state: s.state, code_verifier: s.code_verifier }))
      window.location.assign(s.consent_url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start Gmail connection')
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true); setErr(null); setNote(null)
    try {
      const r = await api.gmailDisconnect()
      setConnected(null)
      setNote(r.google_revoked
        ? 'Disconnected. Google confirmed the access grant was revoked.'
        : 'Disconnected here. Google did not confirm revocation - to be certain, also remove access in your Google account settings.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not disconnect')
    } finally { setBusy(false) }
  }

  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Gmail sending</h3>
      {state === 'loading' && <p className="muted">Checking…</p>}
      {state === 'unavailable' && (
        <p className="muted" style={{ marginBottom: 0 }}>
          Sending email from your own Gmail is not set up on this deployment. When it is, you connect your Gmail here and every message needs your explicit review before it goes.
        </p>
      )}
      {state === 'ready' && (
        <>
          {connected ? (
            <>
              <p className="muted">Connected as <strong>{connected.email}</strong>. Authority emails you review and approve are sent from this address. Nothing is ever sent automatically.</p>
              <button className="btn ghost" disabled={busy} onClick={() => void disconnect()}>{busy ? 'Working…' : 'Disconnect Gmail'}</button>
            </>
          ) : (
            <>
              <p className="muted">
                Connect your Gmail to email an authority about a report directly from your address.
                NagarTrace asks for permission to send only, shows you the exact message first, and sends only when you approve it.
              </p>
              <button className="btn" disabled={busy} onClick={() => void connect()}>{busy ? 'Opening Google…' : 'Connect Gmail'}</button>
            </>
          )}
          {note && <p className="small-note" style={{ marginBottom: 0 }}>{note}</p>}
          {err && <p className="small-note" style={{ marginBottom: 0, color: 'var(--danger, #b3261e)' }}>{err}</p>}
        </>
      )}
    </div>
  )
}
