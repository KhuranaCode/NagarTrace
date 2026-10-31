import { useEffect, useState } from 'react'
import { api } from '../api'
import type { NhaiAwardsBrowse } from '../types'
import { ErrorBox, Spinner } from '../ui'
import { AiConsentGate } from '../components/AiConsent'

/** Public catalog of official NHAI FY2024-25 awarded projects (verbatim source rows).
 *  Historical snapshot - real contractors on record, NOT current road maintainers. */
export default function Records() {
  const [data, setData] = useState<NhaiAwardsBrowse | null | undefined>(undefined)
  const [err, setErr] = useState<unknown>(null)
  const [state, setState] = useState('')
  const [nh, setNh] = useState('')
  const [cname, setCname] = useState('')
  const [cbusy, setCbusy] = useState(false)
  const [consentNeeded, setConsentNeeded] = useState(false)
  const [cresult, setCresult] = useState<{ kind: 'brief'; summary: string; record_count: number; key_facts: string[]; warning?: string } | { kind: 'note'; text: string } | null>(null)

  const brief = async () => {
    const q = cname.trim()
    if (q.length < 2 || cbusy) return
    setCbusy(true); setCresult(null)
    try {
      const r = await api.aiContractorBrief(q)
      if (!r.ai_available && r.reason === 'consent_required') setConsentNeeded(true)
      else if (!r.ai_available) setCresult({ kind: 'note', text: r.reason === 'not_live_yet' ? 'The AI brief is not live on this server yet. The catalog filter above works without it.' : 'The AI brief is offline right now - it runs on the operator\'s own machine. The catalog filter above works without it.' })
      else if (!r.found) setCresult({ kind: 'note', text: r.reason === 'registry_not_loaded' ? 'The award registry is not loaded on this deployment yet.' : 'No award records match that name in the FY2024-25 NHAI snapshot.' })
      else if (r.brief) setCresult({ kind: 'brief', summary: r.brief.summary, record_count: r.brief.record_count, key_facts: r.brief.key_facts, warning: r.candidate_warning })
      else setCresult({ kind: 'note', text: 'No brief was returned.' })
    } catch (e: any) {
      setCresult({ kind: 'note', text: e?.status === 401 ? 'Sign in to use the AI contractor brief.' : 'Could not reach the AI brief. Nothing was looked up.' })
    } finally { setCbusy(false) }
  }

  const load = (f: { state?: string; nh?: string } = {}) => {
    setErr(null)
    api.nhaiAwards(f).then(setData).catch(setErr)
  }
  useEffect(() => { load() }, [])

  if (err) return <div className="container section"><ErrorBox error={err} onRetry={() => load()} /></div>
  if (data === undefined) return <div className="container section"><Spinner label="Loading official records. The free server sleeps when idle - first load can take a minute." /></div>

  return (
    <div className="container section" style={{ maxWidth: 900 }}>
      <h1>Official road records</h1>
      <p className="muted">
        Real awarded-project records from NHAI (National Highways Authority of India), verbatim from the official source.
        This is a <strong>historical FY2024-25 snapshot</strong>: it names contractors on record for awarded projects.
        It does <strong>not</strong> say who maintains or is responsible for any given road today.
      </p>
      {data === null ? (
        <div className="card pad">
          <p><strong>Catalog not available on this deployment yet.</strong></p>
          <p className="muted">The official-records integration is built and in review; the live server has not been updated with it yet.</p>
        </div>
      ) : (
        <>
          <div className="card pad" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0 }}><strong>Dataset:</strong> {data.dataset.coverage} - {data.dataset.rows} rows{data.dataset.source_label ? ` (${data.dataset.source_label})` : ''}.</p>
            <p className="small-note" style={{ marginBottom: 0 }}>{data.dataset.anomaly_note}</p>
          </div>
          <form className="card pad" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); load({ state: state || undefined, nh: nh || undefined }) }}>
            <label>State<br /><input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Punjab" /></label>
            <label>National highway<br /><input value={nh} onChange={(e) => setNh(e.target.value)} placeholder="e.g. 44" /></label>
            <button className="btn" type="submit">Filter</button>
          </form>
          <div className="card pad" style={{ marginTop: 12 }}>
            <strong>AI contractor brief</strong>
            <p className="field-hint">Summarizes this snapshot's award rows for a contractor name. Sign-in required; historical award candidates only - never proof of who caused or must fix a specific defect.</p>
            <div className="action-row">
              <input value={cname} maxLength={120} placeholder="Contractor name, e.g. from a record above" onChange={(e) => setCname(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void brief() }} />
              <button className="btn" disabled={cbusy || cname.trim().length < 2} onClick={() => void brief()}>{cbusy ? 'Checking...' : 'Brief'}</button>
            </div>
            {consentNeeded ? <AiConsentGate feature="contractor_finder" onGranted={() => setConsentNeeded(false)} /> : null}
            {cresult?.kind === 'note' ? <p className="field-hint">{cresult.text}</p> : null}
            {cresult?.kind === 'brief' ? (
              <div style={{ marginTop: 8 }}>
                {cresult.warning ? <p className="small-note">{cresult.warning}</p> : null}
                <p style={{ margin: '6px 0' }}>{cresult.summary}</p>
                <p className="muted" style={{ margin: '4px 0' }}>{cresult.record_count} record{cresult.record_count === 1 ? '' : 's'} summarized</p>
                <ul style={{ margin: '4px 0' }}>{cresult.key_facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            ) : null}
          </div>
          <p className="muted" style={{ marginTop: 12 }}>{data.awards.length} record{data.awards.length === 1 ? '' : 's'}</p>
          {data.awards.map((a) => (
            <div className="card pad" key={a.sr} style={{ marginBottom: 10 }}>
              <strong>{a.project_name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Contractor on record: {a.contractor_name ?? 'not stated in source'}
                {a.awarded_cost_cr != null ? ` · awarded cost Rs ${a.awarded_cost_cr} cr (verbatim)` : ''}
                {a.loa_date ? ` · LOA ${a.loa_date.slice(0, 10)}` : ''}
                {a.state ? ` · ${a.state}` : ''}
                {a.nh_from_name?.length ? ` · ${a.nh_from_name.map((t) => 'NH-' + t).join(' / ')}` : ''}
                {a.length_km != null ? ` · ${a.length_km} km` : ''}
                {a.piu ? ` · PIU ${a.piu}` : ''}
                {' · '}
                <a href={a.source_url} target="_blank" rel="noreferrer">source{a.page ? ` (p.${a.page})` : ''}</a>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
