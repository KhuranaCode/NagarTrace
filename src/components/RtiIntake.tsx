import { useState } from 'react'
import { api, ApiError } from '../api'
import type { PublicIssue } from '../types'
import RtiDraft from './RtiDraft'

/** RTI intake: asks for a NagarTrace report ID (NT-000015) or a NagarTrace report link
 *  BEFORE preparing a draft. Resolution rules:
 *  - Links: we never fetch the supplied URL. We only accept our own site paths and
 *    extract the report UUID; everything else is rejected. The id is then looked up
 *    through the PUBLIC issues endpoint - access-controlled reports never leak here.
 *  - NT-ids: the public API has no complaint-number lookup, so we match against the
 *    latest public list (server-capped at 200). If the list is full and the id is not
 *    in it, we say so honestly instead of claiming the report does not exist.
 *  The draft is built from public, rounded data only and stays editable draft-only:
 *  nothing is filed, paid for or sent. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseInput(raw: string): { kind: 'uuid'; id: string } | { kind: 'nt'; no: number } | { kind: 'error'; message: string } {
  const s = raw.trim()
  if (!s) return { kind: 'error', message: 'Enter a report ID or paste a report link.' }
  const nt = /^NT-?0*(\d+)$/i.exec(s)
  if (nt) return { kind: 'nt', no: parseInt(nt[1], 10) }
  if (UUID_RE.test(s)) return { kind: 'uuid', id: s.toLowerCase() }
  if (/^https?:\/\//i.test(s)) {
    let u: URL
    try { u = new URL(s) } catch { return { kind: 'error', message: 'That link could not be read. Paste the full report link from this site.' } }
    const ownSite = u.host === 'khuranacode.github.io' || u.host === window.location.host
    if (!ownSite) return { kind: 'error', message: "That link is not a NagarTrace report link. We never open outside links - paste this site's report link or the NT id." }
    const m = /\/issues\/([0-9a-f-]{36})/i.exec(u.pathname)
    if (m && UUID_RE.test(m[1])) return { kind: 'uuid', id: m[1].toLowerCase() }
    return { kind: 'error', message: 'That NagarTrace link does not point to a report. Open the report and copy its link.' }
  }
  return { kind: 'error', message: 'Enter a report ID like NT-000015, or paste a NagarTrace report link.' }
}

export default function RtiIntake() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [issue, setIssue] = useState<PublicIssue | null>(null)

  async function resolve() {
    setErr(null)
    const p = parseInput(q)
    if (p.kind === 'error') { setErr(p.message); return }
    setBusy(true)
    try {
      if (p.kind === 'uuid') {
        setIssue(await api.publicIssue(p.id))
        return
      }
      // NT id: match against the latest public list (server caps at 200 rows).
      const { issues } = await api.publicIssues({ limit: 200 })
      const hit = issues.find((i) => i.complaint_no === p.no)
      if (hit) { setIssue(hit); return }
      if (issues.length >= 200) {
        setErr('That report is not in the latest 200 public reports. It may still exist - open it from Live issues and paste its link instead.')
      } else {
        setErr('No public report with that ID. Check the number, or paste the report link. Reports stay public only after they exist - nothing here can see private data.')
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setErr('No public report found for that link. It may have been removed, or the link is wrong.')
      else if (e instanceof ApiError && e.status === 0) setErr('The server could not be reached - it may be waking up. Try again in a moment.')
      else setErr('Could not look that up right now. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (issue) {
    return (
      <div>
        <p className="small-note">
          Draft built from the public view of {issue.complaint_id ?? 'this report'} - rounded location, no photos, no names.
          {' '}<button className="btn ghost small" onClick={() => { setIssue(null); setQ('') }}>Start over</button>
        </p>
        <RtiDraft d={issue} roundedLocation />
      </div>
    )
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 10 }}>
        Enter your report ID (like NT-000015) or paste the report's NagarTrace link. We use the public view only -
        rounded location, no photos, no names.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); void resolve() }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="NT-000015 or report link"
          aria-label="Report ID or report link"
          style={{ flex: '1 1 260px', padding: '10px 12px' }}
        />
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Looking up...' : 'Prepare draft'}</button>
      </form>
      {err ? <p className="small-note" role="alert" style={{ color: 'var(--red)', marginTop: 8 }}>{err}</p> : null}
    </div>
  )
}
