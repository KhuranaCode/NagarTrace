import { useEffect, useState } from 'react'
import { api } from '../api'
import type { NhaiAwardsBrowse } from '../types'
import { ErrorBox, Spinner } from '../ui'

/** Public catalog of official NHAI FY2024-25 awarded projects (verbatim source rows).
 *  Historical snapshot - real contractors on record, NOT current road maintainers. */
export default function Records() {
  const [data, setData] = useState<NhaiAwardsBrowse | null | undefined>(undefined)
  const [err, setErr] = useState<unknown>(null)
  const [state, setState] = useState('')
  const [nh, setNh] = useState('')

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
