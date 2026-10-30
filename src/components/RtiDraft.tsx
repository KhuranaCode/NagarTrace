import { useMemo, useState } from 'react'
import type { IssueDetail } from '../types'
import { HAZARD_META } from '../ui'

/** Draft-only RTI helper. Generates an EDITABLE draft seeking records/status about the
 *  report. Never files anything, never invents the authority or PIO - those stay as
 *  bracketed placeholders the user must verify and fill. Grounded in rtionline.gov.in
 *  guidelines (3000-char portal text limit, fee per RTI Rules 2012, 30-day timeline). */
export default function RtiDraft({ d }: { d: IssueDetail }) {
  const [open, setOpen] = useState(false)
  const hazard = HAZARD_META[d.hazard]?.label ?? d.hazard
  const draft0 = useMemo(() => {
    const ref = d.complaint_id ?? `report ${d.id}`
    const where = `latitude ${d.location.lat.toFixed(5)}, longitude ${d.location.lon.toFixed(5)}${d.ward ? `, ${d.ward}` : ''}`
    return `To,
The Public Information Officer,
[NAME OF PUBLIC AUTHORITY - verify: Municipal Corporation / Council for city roads, PWD for state highways, NHAI for national highways, Gram Panchayat/PMGSY for village roads]
[ADDRESS OF THE AUTHORITY OFFICE]

Subject: Application under Section 6(1) of the Right to Information Act, 2005 - records regarding road hazard complaint ${ref}

Sir/Madam,

I reported a road hazard (${hazard}) at ${where} on ${d.created_at.slice(0, 10)}. It is registered as ${ref}. Under the RTI Act, 2005, I request the following records and information:

1. The current status of complaint ${ref} and all action taken on it so far, with dates.
2. The name and designation of the officer(s) responsible for resolving it.
3. The public authority and/or contractor responsible for maintenance of the road at the above location, with the relevant work order or contract reference.
4. If the authority's records contain a sanctioned schedule, target date or work order covering the repair of this stretch, a copy of that record.

Application fee: Rs [10 for Central authorities / as per your State RTI Rules] paid by [IPO / court fee stamp / online payment - as accepted by the authority].

Name: [YOUR FULL NAME]
Address: [YOUR POSTAL ADDRESS]
Date: [DATE]
Signature: ______________`
  }, [d, hazard])
  const [text, setText] = useState(draft0)
  const [copied, setCopied] = useState(false)

  return (
    <div className="card pad" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>RTI draft</h3>
      {!open ? (
        <>
          <p className="muted" style={{ marginBottom: 10 }}>
            If the complaint stalls, you can ask the authority for its records under the Right to Information Act, 2005.
            This creates an editable draft only - NagarTrace does not file anything.
          </p>
          <button className="btn" onClick={() => { setText(draft0); setOpen(true) }}>Create RTI draft</button>
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}>{copied ? 'Copied' : 'Copy draft'}</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          <p className="small-note" style={{ marginBottom: 0 }}>
            Before filing: fill every [bracket] yourself. Verify the correct public authority and its Public Information Officer - NagarTrace does not know them.
            Ministries and Departments of the Government of India accept RTI online at rtionline.gov.in (portal text limited to 3000 characters; fee per RTI Rules, 2012). Not every public authority is on that portal.
            State authorities have their own rules, fees and portals. A reply is generally due within 30 days of the authority receiving your application.
          </p>
        </>
      )}
    </div>
  )
}
