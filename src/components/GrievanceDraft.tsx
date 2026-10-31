import { useState } from 'react'
import { api } from '../api'
import { AiConsentGate } from './AiConsent'
import type { IssueDetail } from '../types'

/** AI grievance email DRAFT. The backend only drafts text: nothing is addressed or sent.
 *  The citizen reviews, edits, picks the recipient and sends it themselves. When the
 *  guide machine is offline the control says so instead of inventing a draft. */
export default function GrievanceDraft({ d }: { d: IssueDetail }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unavail, setUnavail] = useState<string | null>(null)
  const [consentNeeded, setConsentNeeded] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const generate = async () => {
    setBusy(true); setUnavail(null)
    try {
      const r = await api.aiEmailDraft({ hazard: d.hazard, lat: d.location.lat, lon: d.location.lon, ward: d.ward ?? undefined, complaint_no: d.complaint_id ?? undefined })
      if (r.ai_available) { setSubject(r.subject); setBody(r.body) }
      else if (r.reason === 'consent_required') setConsentNeeded(true)
      else setUnavail(r.reason === 'not_live_yet' ? 'The drafting assistant is not live on this server yet.' : 'The drafting assistant is offline right now - it runs on the operator\'s own machine. Try again later.')
    } catch {
      setUnavail('Could not reach the drafting assistant. Nothing was drafted.')
    } finally { setBusy(false) }
  }

  if (!open) return <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Draft a grievance email (AI)</button>
  return (
    <div className="card pad-lg" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Grievance email draft</h3>
        <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="field-hint">A draft only - NagarTrace never sends it. Review and edit it, choose the right authority yourself, and send it from your own email.</p>
      {!subject && !unavail ? <button className="btn" disabled={busy} onClick={() => void generate()}>{busy ? 'Drafting...' : 'Generate draft'}</button> : null}
      {consentNeeded ? <AiConsentGate feature="email_draft" onGranted={() => setConsentNeeded(false)} /> : null}
      {unavail ? <p className="field-hint">{unavail}</p> : null}
      {subject ? (
        <>
          <label htmlFor="gd-subject">Subject</label>
          <input id="gd-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label htmlFor="gd-body" style={{ marginTop: 10 }}>Body</label>
          <textarea id="gd-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => { void navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`) }}>Copy draft</button>
            <button className="btn ghost" disabled={busy} onClick={() => void generate()}>{busy ? 'Drafting...' : 'Regenerate'}</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
