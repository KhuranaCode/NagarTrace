import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import type { Hazard, ReportResult } from '../types'
import { ErrorBox, HAZARD_META, HazardIcon } from '../ui'
import { assessEvidence, formatVerdict, parsePhotoMetadata, type MetadataAssessment } from '../evidence/photo-metadata'

type Gps = { lat: number; lon: number; accuracy_m: number; captured_at: string }

export default function Report() {
  const { session, ready } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [gps, setGps] = useState<Gps | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsErr, setGpsErr] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [hazard, setHazard] = useState<Hazard | null>(null)
  const [danger, setDanger] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [photoState, setPhotoState] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle')
  const [photoAssess, setPhotoAssess] = useState<MetadataAssessment | null>(null)
  const [photoMsg, setPhotoMsg] = useState<string | null>(null)
  const [photoPickedAt, setPhotoPickedAt] = useState<number | null>(null)
  const [bindErr, setBindErr] = useState<string | null>(null)
  const [moved, setMoved] = useState(false)
  const [, setTick] = useState(0) // countdown re-render
  const watchId = useRef<number | null>(null)
  const idemKey = useRef<string>(crypto.randomUUID())
  const pointsBaseline = useRef<number | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null)

  // Baseline for honest points feedback: we only ever show the measured delta.
  useEffect(() => {
    if (!session) return
    api.me().then((m) => { pointsBaseline.current = m.points }).catch(() => undefined)
  }, [session])

  const hazards = useMemo(() => Object.entries(HAZARD_META) as [Hazard, { label: string; icon: string }][], [])

  if (ready && !session) {
    return (
      <div className="container section" style={{ maxWidth: 520 }}>
        <h1>Report a hazard</h1>
        <div className="notice-box">You need a free account to submit a report - it helps reduce spam and lets you confirm the repair later.</div>
        <Link to="/login" state={{ from: '/report' }} className="btn primary block">Sign in or create an account</Link>
        <p style={{ textAlign: 'center' }}><Link to="/issues">Browse public issue status without an account →</Link></p>
      </div>
    )
  }

  // GPS-FIRST 15-SECOND CAPTURE BINDING (user-requested): the photo must be taken within 15 s
  // of a fresh GPS fix, and moving away before the photo invalidates the fix. Honest scope:
  // this REDUCES photo/location mismatch - a browser timer cannot prove where a photo was
  // taken, and gallery picks inside the window are indistinguishable from camera shots.
  const BIND_WINDOW_MS = 15_000
  const MOVE_INVALIDATE_M = 60
  const distM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371000, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lon - a.lon) * Math.PI / 180
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }
  const fixAge = () => (gps ? Date.now() - new Date(gps.captured_at).getTime() : Number.POSITIVE_INFINITY)
  const windowLive = !!gps && !moved && fixAge() <= BIND_WINDOW_MS
  const bound = !!photo && !!photoPickedAt && !!gps && !moved && photoPickedAt - new Date(gps.captured_at).getTime() <= BIND_WINDOW_MS

  // countdown re-render while the window is open; stop the movement watch on unmount
  useEffect(() => {
    if (!gps || photo) return
    const t = setInterval(() => setTick((x) => x + 1), 500)
    return () => clearInterval(t)
  }, [gps, photo])
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }, [])

  const captureGps = () => {
    setGpsBusy(true)
    setGpsErr(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy ?? 9999),
          captured_at: new Date().toISOString(),
        }
        setGps(fix)
        setMoved(false)
        setBindErr(null)
        setPhotoPickedAt(null)
        pickPhoto(null) // a fresh fix starts a fresh window: any earlier photo is unbound
        // Movement before the photo invalidates the fix - it was taken somewhere else.
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
        watchId.current = navigator.geolocation.watchPosition((p2) => {
          if (distM(fix, { lat: p2.coords.latitude, lon: p2.coords.longitude }) > MOVE_INVALIDATE_M) {
            setMoved(true)
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
          }
        }, () => undefined, { enableHighAccuracy: true, maximumAge: 0 })
        setGpsBusy(false)
      },
      (e) => {
        setGpsErr(e.message || 'Location permission denied')
        setGpsBusy(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }

  const pickPhoto = (f: File | null) => {
    setPhoto(f)
    setPhotoAssess(null)
    if (f) {
      setPhotoPickedAt(Date.now())
      if (!gps) setBindErr('Get a GPS fix first, then take the photo within 15 seconds.')
      else if (moved) setBindErr('You moved away from the GPS fix before the photo. Capture GPS again at the hazard, then take the photo within 15 seconds.')
      else if (fixAge() > BIND_WINDOW_MS) setBindErr('The 15-second window ran out after the GPS fix. Capture GPS again, then take the photo.')
      else setBindErr(null)
    } else {
      setPhotoPickedAt(null)
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(f ? URL.createObjectURL(f) : null)
    if (f) {
      // On-device metadata read - the photo never leaves the phone for this.
      parsePhotoMetadata(f)
        .then((meta) => setPhotoAssess(assessEvidence(meta, { reportLat: gps?.lat, reportLon: gps?.lon, reportedAt: new Date() })))
        .catch(() => setPhotoAssess(null))
    }
  }

  const staleCapture = gps ? Date.now() - new Date(gps.captured_at).getTime() > 13 * 60 * 1000 : false

  const submit = async () => {
    if (!photo) { setStep(0); return }
    if (!gps || !hazard) return
    if (!bound) {
      setStep(0)
      setBindErr(moved
        ? 'You moved away from the GPS fix before the photo. Capture GPS again at the hazard, then take the photo within 15 seconds.'
        : 'The photo is outside the 15-second window after the GPS fix. Capture GPS again, then take the photo.')
      return
    }
    setBusy(true)
    setErr(null)
    // The photo and the report are one thing: stage the photo first, then the
    // report binds it in the same server transaction. If either step fails,
    // nothing half-exists - no report without its photo.
    try {
      setPhotoState('uploading')
      const staged = await api.stageUpload(gps.lat, gps.lon, photo, photo.type || 'image/jpeg')
      const r = await api.report(
        {
          lat: gps.lat,
          lon: gps.lon,
          accuracy_m: gps.accuracy_m,
          hazard,
          danger: danger || undefined,
          note: note.trim() || undefined,
          photo_upload_id: staged.upload_id,
          captured_at: new Date().toISOString(),
        },
        idemKey.current,
      )
      setResult(r)
      // Real points delta only - replays/merges may award less or nothing.
      if (pointsBaseline.current !== null) {
        api.me().then((m) => {
          const d = m.points - (pointsBaseline.current ?? m.points)
          setPointsAwarded(d > 0 ? d : 0)
          pointsBaseline.current = m.points
        }).catch(() => setPointsAwarded(null))
      }
      idemKey.current = crypto.randomUUID()
      if (r.photo) {
        setPhotoState('done')
        setPhotoMsg(r.photo.location_ok ? 'Photo attached to this report.' : 'Photo attached, but it looks far from the report location and may not count as evidence.')
      } else {
        setPhotoState('idle')
        setPhotoMsg(null)
      }
    } catch (e) {
      setPhotoState('failed')
      setPhotoMsg(null)
      setErr(e)
      if (e instanceof ApiError && e.code === 'stale_report') setStep(0)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="container section" style={{ maxWidth: 620 }}>
        <div className="card pad-lg">
          <h1 style={{ marginTop: 0 }}>{result.replayed ? 'Report already received' : result.merged_into_existing ? 'Merged with a nearby report' : 'Report submitted'}</h1>
          {result.merged_into_existing && !result.replayed ? (
            <p>Someone already reported this {hazard ? HAZARD_META[hazard].label.toLowerCase() : 'hazard'} within about 30 m. Your report was added as a confirmation, which raises its priority.</p>
          ) : (
            <p>Your report is in. A municipal officer verifies new reports before an owner and deadline are assigned.</p>
          )}
          {photoState === 'done' ? <div className="ok-box">{photoMsg}</div> : null}
          {pointsAwarded !== null && pointsAwarded > 0 ? (
            <div className="ok-box">Your points went up by {pointsAwarded} since this page opened.</div>
          ) : result.replayed ? null : pointsAwarded === 0 ? (
            <p className="small-note">No new points recorded yet{result.merged_into_existing ? ' - merged confirmations earn less or nothing by design' : ''}.</p>
          ) : null}
          <div className="action-row" style={{ marginTop: 18 }}>
            <Link to={`/app/issues/${result.issue.id}`} className="btn primary">Track this issue</Link>
            <button className="btn ghost" onClick={() => { setResult(null); setStep(0); setGps(null); pickPhoto(null); setHazard(null); setNote(''); setDanger(false); setPhotoState('idle'); setPointsAwarded(null) }}>Report another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Report a hazard</h1>
      <p className="muted">Quick to file: location, hazard type, done. Photos stay private to the issue's participants.</p>
      <div className="steps">
        {[0, 1, 2].map((i) => <div key={i} className={`dot ${step >= i ? 'on' : ''}`} />)}
      </div>

      {step === 0 ? (
        <div className="card pad-lg">
          <h2 style={{ marginTop: 0 }}>Where is it?</h2>
          <div className="field">
            <label>Location first</label>
            {gps ? (
              <div className={gps.accuracy_m > 100 ? 'warn-box' : 'ok-box'} style={{ margin: 0 }}>
                GPS locked: {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)} (±{gps.accuracy_m} m)
                {gps.accuracy_m > 100 ? ' - accuracy is too low, move to open sky and retry.' : ''}
              </div>
            ) : (
              <div className="photo-drop">Stand at the hazard and capture GPS. We never store your location beyond this report.</div>
            )}
            {gpsErr ? <div className="error-box"><p>{gpsErr}. Allow location access and try again.</p></div> : null}
            <button className="btn dark" onClick={captureGps} disabled={gpsBusy}>{gpsBusy ? 'Getting GPS…' : gps ? 'Capture GPS again' : 'Capture GPS'}</button>
            {gps && !photo ? (
              windowLive ? (
                <div className="notice-box" style={{ marginTop: 10 }}>Photo window open: <strong>{Math.max(0, Math.ceil((BIND_WINDOW_MS - fixAge()) / 1000))}s</strong> left. Take the photo now, right here.</div>
              ) : (
                <div className="warn-box" style={{ marginTop: 10 }}>{moved ? 'You moved away from this fix. Capture GPS again at the hazard.' : 'The 15-second window ran out. Capture GPS again, then take the photo.'}</div>
              )
            ) : null}
          </div>
          <div className="field">
            <label>Photo (required, within 15 seconds of the GPS fix)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={!gps || moved}
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
            <div className="hint">GPS first, photo right after: this keeps the photo tied to this spot and reduces mismatched reports. It cannot prove where a photo was taken. Never shown publicly; the server removes hidden metadata on upload.</div>
            {bindErr ? <div className="error-box"><p>{bindErr}</p></div> : null}
            {photoUrl ? <img src={photoUrl} className="photo-preview" alt="Selected hazard" /> : null}
            {photoAssess ? (
              <details className="photo-details">
                <summary>Photo details - {formatVerdict(photoAssess.verdict)}</summary>
                <ul>
                  {photoAssess.signals.map((sig) => (
                    <li key={sig.id} className={`sig-${sig.state}`}><strong>{sig.label}:</strong> {sig.detail}</li>
                  ))}
                </ul>
                <p className="small-note">Read on your device only - the photo is not sent anywhere for this check. Metadata can be missing after forwarding (unknown, not suspicious) and can be forged when present.</p>
              </details>
            ) : null}
          </div>
          <div className="action-row">
            <button className="btn primary" disabled={!bound || (gps?.accuracy_m ?? 9999) > 100} onClick={() => setStep(1)}>Next: what is it?</button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="card pad-lg">
          <h2 style={{ marginTop: 0 }}>What is the hazard?</h2>
          <div className="hazard-grid">
            {hazards.map(([key, m]) => (
              <button key={key} className={`hazard-pick ${hazard === key ? 'sel' : ''}`} onClick={() => setHazard(key)}>
                <span className="ic" aria-hidden><HazardIcon kind={m.icon} size={26} /></span> {m.label}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 18 }}>
            <label className="checkrow">
              <input type="checkbox" checked={danger} onChange={(e) => setDanger(e.target.checked)} />
              This is dangerous right now (traffic risk, injury risk)
            </label>
          </div>
          <div className="field">
            <label htmlFor="note">Note (optional)</label>
            <textarea id="note" maxLength={500} placeholder="e.g. Two-wheelers are skidding here after rain" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="action-row">
            <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn primary" disabled={!hazard} onClick={() => setStep(2)}>Next: review</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card pad-lg">
          <h2 style={{ marginTop: 0 }}>Review and send</h2>
          <table className="table">
            <tbody>
              <tr><th>Hazard</th><td>{hazard ? HAZARD_META[hazard].label : '-'}{danger ? ' (marked dangerous)' : ''}</td></tr>
              <tr><th>Location</th><td>{gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)} (±${gps.accuracy_m} m)` : '-'}</td></tr>
              <tr><th>Photo</th><td>Attached (uploaded with the report)</td></tr>
              {note.trim() ? <tr><th>Note</th><td>{note.trim()}</td></tr> : null}
            </tbody>
          </table>
          {staleCapture ? <div className="warn-box">This GPS reading is getting old. Go back and refresh it before sending.</div> : null}
          {err ? <ErrorBox error={err} onRetry={() => setErr(null)} /> : null}
          <p className="small-note">Sending creates a public-status entry (rounded location, no name, no photo). Duplicate reports within about 30 m are merged automatically.</p>
          <div className="action-row">
            <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn primary" disabled={busy || staleCapture} onClick={submit}>{busy ? 'Sending…' : 'Submit report'}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
