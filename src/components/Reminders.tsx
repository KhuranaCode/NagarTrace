/**
 * Reminders setup + truthful campaign states (follow-up pipeline UI).
 * Feature-detected: when the API routes are not deployed yet (404), the caller
 * keeps showing the static honest plan card instead - this component renders null.
 * Consent is explicit, scope-versioned, revocable; the user approves the exact
 * stage texts shown here before a campaign is created. No fake sending claims:
 * delivery states come from the server and 'accepted' is never called 'delivered'.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type FollowupCampaign as Campaign, type FollowupDelivery as Delivery, type FollowupStage } from '../api'
import { fmtDate, HAZARD_META } from '../ui'
import type { IssueDetail } from '../types'

const CONSENT_VERSION = 'v1-2026-10-30'
const CONSENT_TEXT =
  'I agree that NagarTrace may email me reminders about my own reports on the schedule I approve. ' +
  'I can revoke this at any time in Settings or by deleting the reminder plan. ' +
  'Any message to an authority always needs my separate approval of the exact message and recipient.'


const DELIVERY_LABEL: Record<string, string> = {
  pending: 'scheduled',
  blocked_no_provider: 'waiting - no email provider is connected yet',
  blocked_no_consent: 'stopped - consent was revoked',
  blocked_no_recipient: 'waiting - no verified recipient',
  attempting: 'sending now',
  accepted: 'handed to the email provider (delivery not confirmed)',
  unknown: 'provider outcome unknown - being reconciled, will NOT be resent blindly',
  failed: 'failed - will retry',
  delivered_callback: 'provider confirmed delivery',
  suppressed: 'cancelled',
}

export function stageTexts(d: IssueDetail): FollowupStage[] {
  const hz = HAZARD_META[d.hazard]?.label ?? d.hazard
  const where = d.ward ?? 'your area'
  const link = `${location.origin}${import.meta.env.BASE_URL}app/issues/${d.id}`
  return [7, 10, 15, 30].map((day) => ({
    day,
    subject: `Your report, ${day === 7 ? 'one week' : `${day} days`} in`,
    body_text:
      `${day} days ago you reported ${hz.toLowerCase()} (${where}). Current status: {{status}}.\n\n` +
      `Track it here: ${link}\n\n` +
      (day === 30
        ? 'This is the 30-day stage: you can ask us to escalate to the next responsible level - that needs your separate approval of the exact message and recipient.\n\n'
        : 'If it is still not fixed, you can ask us to send a reminder to the responsible party - that needs your separate approval of the exact message and recipient.\n\n') +
      'You are receiving this because you approved these reminders. Revoke anytime in Settings.',
  }))
}

export default function Reminders({ d, email, onUnavailable }: { d: IssueDetail; email: string | null; onUnavailable: () => void }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const stages = useMemo(() => stageTexts(d), [d])

  const load = useCallback(async () => {
    try {
      const r = await api.followupCampaigns(d.id)
      setSupported(true)
      setCampaigns(r.campaigns)
      setDeliveries(r.deliveries)
    } catch (e: any) {
      if (e?.status === 404) { setSupported(false); onUnavailable() }
      else setSupported(true) // other errors: panel exists, show setup anyway
    }
  }, [d.id, onUnavailable])
  useEffect(() => { void load() }, [load])

  if (supported === null || supported === false) return null
  const active = campaigns.find((c) => c.state === 'active')

  const setup = async () => {
    setBusy(true); setMsg(null)
    try {
      await api.mailConsent('report_reminders', true, CONSENT_VERSION)
      await api.createFollowupCampaign(d.id, {
        audience: 'reporter', recipient_descriptor: 'self', stages,
        idempotency_key: crypto.randomUUID(), recipient_email: email ?? '',
      })
      await load()
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not set up reminders.')
    } finally { setBusy(false) }
  }

  const revoke = async (id: string) => {
    setBusy(true)
    try { await api.deleteFollowupCampaign(id); await load() } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Email reminders</h3>
      {active ? (
        <>
          <ul className="timeline">
            {deliveries.filter((x) => x.campaign_id === active.id).map((x) => (
              <li key={x.stage_day}>
                <div className="ev-kind">Day {x.stage_day} reminder</div>
                <div className="ev-time">Due {fmtDate(x.due_at)} · {DELIVERY_LABEL[x.state] ?? x.state}</div>
              </li>
            ))}
          </ul>
          <p className="small-note">Emails to you at your sign-in address. Nothing has been or will be sent to any authority from this plan. Revoking stops every pending reminder immediately.</p>
          <button className="btn ghost small" disabled={busy} onClick={() => revoke(active.id)}>Stop these reminders</button>
        </>
      ) : (
        <>
          <p className="muted">Get an email at days 7, 10, 15 and 30 if this issue is still open. You approve the exact texts now; they only ever go to your own sign-in address{email ? <> (<strong>{email}</strong>)</> : null}.</p>
          <details className="photo-details">
            <summary>Read the exact reminder texts</summary>
            {stages.map((s) => (
              <div key={s.day} style={{ margin: '10px 0' }}>
                <p style={{ margin: '0 0 4px' }}><strong>Day {s.day}: {s.subject}</strong></p>
                <p className="small-note" style={{ whiteSpace: 'pre-line', margin: 0 }}>{s.body_text}</p>
              </div>
            ))}
          </details>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small-note">{CONSENT_TEXT}</span>
          </label>
          {msg ? <p className="muted">{msg}</p> : null}
          <button className="btn primary" disabled={busy || !consent || !email} onClick={setup}>
            {busy ? 'Setting up…' : 'Approve these texts and start reminders'}
          </button>
          <p className="small-note" style={{ marginBottom: 0 }}>Today no email provider is connected, so reminders will show as waiting until one is - the schedule and your approval are real and recorded either way.</p>
        </>
      )}
    </div>
  )
}
