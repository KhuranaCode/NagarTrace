import { useEffect, useState } from 'react'
import { AiFeature, api } from '../api'

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  guide_chat: 'App guide chat',
  email_draft: 'Grievance email draft',
  photo_advisory: 'Photo / report check',
  contractor_finder: 'Contractor brief',
}

/**
 * Per-feature AI consent gate. Shows the server's versioned notice VERBATIM and grants that one
 * feature only on explicit accept. Nothing is processed before the grant; revocation lives in
 * Settings. Rendered by AI features when the server answers 403 consent_required.
 */
export function AiConsentGate({ feature, onGranted }: { feature: AiFeature; onGranted: () => void }) {
  const [notice, setNotice] = useState<{ version: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.aiConsentNotice().then((n) => setNotice({ version: n.version, text: n.text })).catch(() => setErr('Could not load the consent notice.'))
  }, [])
  const accept = async () => {
    if (!notice || busy) return
    setBusy(true); setErr(null)
    try { await api.aiGrantConsent(feature, notice.version); onGranted() }
    catch { setErr('Consent could not be saved. Nothing was processed.') }
    finally { setBusy(false) }
  }
  return (
    <div className="notice-box" style={{ marginTop: 8 }}>
      <strong>Before {AI_FEATURE_LABEL[feature]} runs</strong>
      <p className="field-hint">This feature processes your input on the operator's own computer. Read the notice, then choose:</p>
      {notice ? <p className="field-hint" style={{ whiteSpace: 'pre-wrap' }}>{notice.text}</p> : <p className="field-hint">Loading notice...</p>}
      {err ? <p className="field-hint">{err}</p> : null}
      <div className="action-row" style={{ marginTop: 6 }}>
        <button className="btn" disabled={!notice || busy} onClick={() => void accept()}>{busy ? 'Saving...' : 'I understand, enable this feature'}</button>
      </div>
      <p className="field-hint">You can revoke this any time in Settings.</p>
    </div>
  )
}

/** Settings section: list active AI consents with per-feature revoke. */
export function AiConsentList() {
  const [rows, setRows] = useState<{ feature: AiFeature; notice_version: string; granted_at: string; revoked_at: string | null }[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.aiConsents().then((c) => setRows(c.consents.filter((r) => !r.revoked_at))).catch(() => setRows([]))
  }, [])
  const revoke = async (feature: AiFeature) => {
    setErr(null)
    try {
      await api.aiRevokeConsent(feature)
      setRows((rs) => (rs ?? []).filter((r) => r.feature !== feature))
    } catch { setErr('Revoke failed - try again. Your consent stays until it succeeds.') }
  }
  if (rows === null) return <p className="field-hint">Loading...</p>
  if (rows.length === 0) return <p className="field-hint">No AI features enabled. Each AI feature asks for your consent before it processes anything.</p>
  return (
    <div>
      {rows.map((r) => (
        <div key={r.feature} className="action-row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <span>{AI_FEATURE_LABEL[r.feature]} <span className="field-hint">(notice {r.notice_version})</span></span>
          <button className="btn ghost" onClick={() => void revoke(r.feature)}>Revoke</button>
        </div>
      ))}
      {err ? <p className="field-hint">{err}</p> : null}
    </div>
  )
}
