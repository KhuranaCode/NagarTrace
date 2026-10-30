import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import type { IssueDetail } from '../types'
import { HAZARD_META } from '../ui'

type Outcome = { status: 'accepted' | 'failed' | 'unknown'; replayed?: boolean } | null

/** Email an authority about this issue FROM the user's own connected Gmail.
 *  The user writes/edits the message, reviews the EXACT final text, and only then sends.
 *  Outcomes are truthful: 'accepted' (Gmail accepted it - not proof of delivery),
 *  'failed' (Gmail rejected it), 'unknown' (Gmail never confirmed - it may exist;
 *  no automatic retry, check Gmail Sent before sending again). */
export default function AuthorityEmail({ d }: { d: IssueDetail }) {
  const [avail, setAvail] = useState<'unknown' | 'no' | 'yes'>('unknown')
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const hazard = HAZARD_META[d.hazard]?.label ?? d.hazard
  const ref = d.complaint_id ?? `report ${d.id}`
  const subject0 = useMemo(() => `Road hazard at ${d.location.lat.toFixed(5)}, ${d.location.lon.toFixed(5)} (${ref})`, [d, ref])
  const body0 = useMemo(() =>
`Sir/Madam,

I want to report a road hazard: ${hazard}${(d as any).hazards && (d as any).hazards.length > 1 ? ` (also: ${(d as any).hazards.filter((h: string) => h !== d.hazard).map((h: string) => HAZARD_META[h as keyof typeof HAZARD_META]?.label ?? h).join(', ')})` : ''}.

Location: latitude ${d.location.lat.toFixed(5)}, longitude ${d.location.lon.toFixed(5)}${d.ward ? `, ${d.ward}` : ''}
First reported: ${d.created_at.slice(0, 10)}
My reference: ${ref} (a NagarTrace-internal reference number, not an acknowledgement from your office)

Please look into this and let me know what action is being taken.

[Your name]`, [d, hazard, ref])
  const [subject, setSubject] = useState(subject0)
  const [body, setBody] = useState(body0)
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome>(null)

  useEffect(() => {
    (async () => {
      try {
        const s = await api.gmailStatus()
        setAvail('yes')
        setEmail(s.connected && s.email ? s.email : null)
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 503)) setAvail('no')
        else setAvail('no')
      }
    })()
  }, [])

  if (avail !== 'yes') return null

  const toOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())

  const send = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await api.sendAuthorityEmail(d.id, { to: to.trim(), subject, body_text: body, idempotency_key: crypto.randomUUID() })
      setOutcome({ status: r.status, replayed: r.replayed })
      setReview(false)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'gmail_not_connected') { setEmail(null); setOpen(false) }
      setErr(e instanceof Error ? e.message : 'Send failed')
    } finally { setBusy(false) }
  }

  if (!email) {
    return (
      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Email the authority</h3>
        <p className="muted" style={{ marginBottom: 0 }}>Connect your Gmail in <a href="/app/settings">Settings</a> to email the authority about this report from your own address. You review the exact message first; nothing is sent automatically.</p>
      </div>
    )
  }

  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Email the authority</h3>
      {outcome && (
        <div className="notice-box" style={{ marginBottom: 12 }}>
          {outcome.status === 'accepted' && <>Gmail accepted your message to <strong>{to}</strong>. Accepted by Gmail is not proof of delivery or reading.</>}
          {outcome.status === 'failed' && <>Gmail rejected this message. It was not sent. You can correct it and send again.</>}
          {outcome.status === 'unknown' && <>Gmail did not confirm this send - the message may or may not have been sent. Check your Gmail Sent folder before sending again. NagarTrace does not retry automatically.</>}
        </div>
      )}
      {!open ? (
        <>
          <p className="muted" style={{ marginBottom: 10 }}>Send an email about this report from <strong>{email}</strong>. You write and review the exact message; it goes only when you approve it.</p>
          <button className="btn" onClick={() => { setSubject(subject0); setBody(body0); setTo(''); setOutcome(null); setErr(null); setReview(false); setOpen(true) }}>Write the email</button>
        </>
      ) : !review ? (
        <>
          <label className="field"><span className="flabel">To (authority email - verify this address yourself)</span>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. commissioner@mc-city.gov.in" />
          </label>
          <label className="field"><span className="flabel">Subject</span>
            <input type="text" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="field"><span className="flabel">Message</span>
            <textarea rows={12} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.5 }} />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" disabled={!toOk || !subject.trim() || !body.trim()} onClick={() => setReview(true)}>Review the exact message</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">This exact message will be sent from <strong>{email}</strong> to <strong>{to}</strong>:</p>
          <div className="notice-box" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>
            <div><strong>Subject:</strong> {subject}</div>
            <hr style={{ opacity: 0.3 }} />
            {body}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : `Send exactly this from ${email}`}</button>
            <button className="btn ghost" disabled={busy} onClick={() => setReview(false)}>Back to edit</button>
          </div>
          {err && <p className="small-note" style={{ marginBottom: 0, color: 'var(--danger, #b3261e)' }}>{err}</p>}
        </>
      )}
    </div>
  )
}
