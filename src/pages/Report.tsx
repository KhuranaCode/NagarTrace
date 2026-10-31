import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO } from '../config'
import { api, ApiError, type Advisory } from '../api'
import { useAuth } from '../auth'
import type { Hazard, ReportResult } from '../types'
import { ErrorBox, HAZARD_META, HazardIcon } from '../ui'
import { assessEvidence, formatVerdict, parsePhotoMetadata, type MetadataAssessment } from '../evidence/photo-metadata'
import { AiConsentGate } from '../components/AiConsent'

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
  const [extraHazards, setExtraHazards] = useState<Hazard[]>([])
  // Multi-hazard pick: first choice is the PRIMARY hazard; further taps add/remove others.
  // Tapping the primary promotes the oldest extra (or clears when there are none).
  const pickHazard = (key: Hazard) => {
    if (hazard === key) {
      const [next, ...rest] = extraHazards
      setHazard(next ?? null)
      setExtraHazards(rest)
    } else if (extraHazards.includes(key)) {
      setExtraHazards(extraHazards.filter((h) => h !== key))
    } else if (!hazard) {
      setHazard(key)
    } else {
      setExtraHazards([...extraHazards, key])
    }
  }
  const [danger, setDanger] = useState(false)
  const [otherText, setOtherText] = useState('') // 'Other' hazard detail - always optional
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
  const fixPerfAt = useRef<number | null>(null)
  const pausedMs = useRef(0) // camera-app time excluded from the window for THIS fix
  const pausedAtPick = useRef(0)
  const hiddenAt = useRef<number | null>(null)
  const [mtimeHint, setMtimeHint] = useState<'old' | 'unknown' | null>(null)
  const idemKey = useRef<string>(crypto.randomUUID())
  const pointsBaseline = useRef<number | null>(null)
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null)
  // AI pre-check (owner-laptop advisory). Honest states: never a fabricated suggestion;
  // when the laptop is offline we say so and the normal submit path is unchanged.
  const [aiState, setAiState] = useState<'idle' | 'checking' | 'done' | 'unavailable' | 'consent'>('idle')
  const [advisory, setAdvisory] = useState<Advisory | null>(null)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const AI_KNOWN_REASONS = ['not_configured', 'misconfigured', 'laptop_unreachable', 'timeout', 'bad_output', 'model_not_vision', 'busy', 'gateway_auth_refused', 'model_missing', 'ai_disabled', 'network', 'non_json']
  const safeAiReason = (r: unknown) => (typeof r === 'string' && (AI_KNOWN_REASONS.includes(r) || /^http_\d{3}$/.test(r)) ? r : 'unknown')

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

  // GPS-FIRST PHOTO BINDING. The feature (photo bound to a fresh GPS fix) was requested by
  // the user, and the 15-second window was shown to them. The 60 m movement threshold is an
  // engineering choice, not a verified standard. Honest scope: these checks REDUCE
  // photo/location mismatch. A browser timer cannot prove where a photo was taken; gallery
  // picks are indistinguishable from camera shots; file dates are editable hints only.
  const BIND_WINDOW_MS = 15_000
  const MOVE_INVALIDATE_M = 60 // engineering threshold - not authenticity proof
  const FIX_MAX_ACCURACY_M = 100 // engineering threshold: worse fixes are too imprecise to bind to
  const distM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const R = 6371000, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lon - a.lon) * Math.PI / 180
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }
  // Monotonic window clock: performance.now() never jumps with wall-clock changes.
  const elapsedMs = () => (fixPerfAt.current === null ? Number.POSITIVE_INFINITY : performance.now() - fixPerfAt.current - pausedMs.current)
  const windowLive = !!gps && !moved && elapsedMs() <= BIND_WINDOW_MS
  const bound = !!photo && photoPickedAt !== null && fixPerfAt.current !== null && !moved
    && (photoPickedAt - fixPerfAt.current - pausedAtPick.current) <= BIND_WINDOW_MS

  // countdown re-render while the window is open; stop the movement watch on unmount
  useEffect(() => {
    if (!gps || photo) return
    const t = setInterval(() => setTick((x) => x + 1), 500)
    return () => clearInterval(t)
  }, [gps, photo])
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }, [])

  const runAiCheck = async () => {
    if (!hazard || !gps) return
    setAiState('checking')
    setAdvisory(null)
    setAiReason(null)
    const merged = (otherText.trim() ? `Other: ${otherText.trim()}${note.trim() ? ' - ' + note.trim() : ''}` : note.trim()) || undefined
    try {
      const r = await api.aiReportCheck({ hazard, note: merged, lat: gps.lat, lon: gps.lon })
      if (r.ai_available) {
        setAdvisory(r.advisory)
        setAiState('done')
      } else if (r.reason === 'consent_required') {
        setAiState('consent')
      } else {
        setAiReason(safeAiReason(r.reason))
        setAiState('unavailable')
      }
    } catch {
      setAiReason('network')
      setAiState('unavailable')
    }
  }

  const captureGps = () => {
    if (!('geolocation' in navigator)) { setGpsErr('This browser or device has no location access'); return }
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
        // A fresh fix starts a fresh window: any earlier photo is unbound and can never
        // silently attach to this later fix/location.
        fixPerfAt.current = performance.now()
        pausedMs.current = 0
        hiddenAt.current = null
        setGps(fix)
        setMoved(false)
        setBindErr(null)
        setPhotoPickedAt(null)
        pickPhoto(null)
        // Movement before the photo invalidates the fix. Jitter guard: invalidate only when
        // the displacement exceeds BOTH the engineering threshold AND the combined accuracy
        // radius of the two readings, and only on strictly newer sensor readings.
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
        watchId.current = navigator.geolocation.watchPosition((p2) => {
          if (p2.timestamp <= pos.timestamp) return
          const acc2 = Math.round(p2.coords.accuracy ?? 9999)
          const d = distM(fix, { lat: p2.coords.latitude, lon: p2.coords.longitude })
          if (d > MOVE_INVALIDATE_M && d > fix.accuracy_m + acc2) {
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

  // Camera-app pause: opening the native camera suspends this page. If the window is LIVE
  // when the page hides, the clock pauses; on return we take a fresh fix and only then give
  // the hidden time back - confirmed same spot. If the re-fix shows movement, the fix is
  // invalidated. A window that was already dead when the page hid gets nothing. A photo
  // picked before expiry can never re-bind to a later fix: any new fix clears it (above).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (fixPerfAt.current !== null && !moved && elapsedMs() <= BIND_WINDOW_MS) hiddenAt.current = performance.now()
        return
      }
      if (hiddenAt.current === null) return
      const paused = performance.now() - hiddenAt.current
      hiddenAt.current = null
      const fix = gps
      if (!fix) return
      navigator.geolocation.getCurrentPosition((p3) => {
        const acc3 = Math.round(p3.coords.accuracy ?? 9999)
        const d = distM(fix, { lat: p3.coords.latitude, lon: p3.coords.longitude })
        if (d <= MOVE_INVALIDATE_M || d <= fix.accuracy_m + acc3) pausedMs.current += paused
        else setMoved(true)
        setTick((x) => x + 1)
      }, () => setTick((x) => x + 1), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  })

    const pickPhoto = (f: File | null) => {
    setPhoto(f)
    setPhotoAssess(null)
    if (f) {
      setPhotoPickedAt(performance.now())
      pausedAtPick.current = pausedMs.current
      // File saved-date: a HINT only. mtimes are editable and often stripped by sharing
      // apps, so an old or missing date never blocks - it is shown as unknown/hint.
      if (!f.lastModified) setMtimeHint('unknown')
      else setMtimeHint(Date.now() - f.lastModified > BIND_WINDOW_MS + 60_000 ? 'old' : null)
      if (!gps) setBindErr('Get a GPS fix first, then take the photo within 15 seconds.')
      else if (moved) setBindErr('You moved away from the GPS fix before the photo. Capture GPS again at the hazard, then take the photo within 15 seconds.')
      else if (elapsedMs() > BIND_WINDOW_MS) setBindErr('The 15-second window ran out after the GPS fix. Capture GPS again, then take the photo.')
      else setBindErr(null)
    } else {
      setPhotoPickedAt(null)
      setMtimeHint(null)
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
          hazards: extraHazards.length ? [hazard, ...extraHazards] : undefined,
          danger: danger || undefined,
          note: (otherText.trim() ? `Other: ${otherText.trim()}${note.trim() ? ' - ' + note.trim() : ''}` : note.trim()) || undefined,
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
        setPhotoMsg(DEMO
          ? 'Demo preview - the photo stayed on this device; nothing was uploaded.'
          : r.photo.location_ok ? 'Photo attached to this report.' : 'Photo attached, but it looks far from the report location and may not count as evidence.')
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
          ) : DEMO ? (
            <p>Demo preview - this report lives only in this browser session. It was not stored on any server, no officer will review it, and closing the tab removes it.</p>
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
              <div className={gps.accuracy_m > FIX_MAX_ACCURACY_M ? 'warn-box' : 'ok-box'} style={{ margin: 0 }}>
                GPS locked: {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)} (±{gps.accuracy_m} m)
                {gps.accuracy_m > FIX_MAX_ACCURACY_M ? ' - accuracy is too low, move to open sky and retry.' : ''}
              </div>
            ) : (
              <div className="photo-drop">Stand at the hazard and capture GPS. We never store your location beyond this report.</div>
            )}
            {gpsErr ? <div className="error-box"><p>{gpsErr}. Allow location access and try again.</p></div> : null}
            <button className="btn dark" onClick={captureGps} disabled={gpsBusy}>{gpsBusy ? 'Getting GPS…' : gps ? 'Capture GPS again' : 'Capture GPS'}</button>
            {gps && !photo ? (
              windowLive ? (
                <div className="notice-box" style={{ marginTop: 10 }}>Photo window open: <strong>{Math.max(0, Math.ceil((BIND_WINDOW_MS - elapsedMs()) / 1000))}s</strong> left. Take the photo now, right here.</div>
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
            <div className="hint">GPS first, photo right after. The 15-second window and 60 m movement check are engineering thresholds: they reduce mismatched reports, they cannot prove where a photo was taken. The clock pauses while your camera app is open, and we re-check you are at the same spot when you come back. Never shown publicly; the server removes hidden metadata on upload.</div>
            {bindErr ? <div className="error-box"><p>{bindErr}</p></div> : null}
            {photo && bound ? <div className="ok-box" style={{ marginTop: 8 }}>Photo captured inside the window - bound to this spot (±{gps?.accuracy_m} m).</div> : null}
            {mtimeHint === 'old' ? <div className="warn-box" style={{ marginTop: 8 }}>This file's saved date looks older than the capture window. File dates can be edited or stripped, so this is only a hint - if you just took this photo, you can continue.</div> : null}
            {mtimeHint === 'unknown' ? <div className="hint" style={{ marginTop: 8 }}>This file has no saved date - recorded as unknown, not as evidence for or against freshness.</div> : null}
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
            <button className="btn primary" disabled={!bound || (gps?.accuracy_m ?? 9999) > FIX_MAX_ACCURACY_M} onClick={() => setStep(1)}>Next: what is it?</button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="card pad-lg">
          <h2 style={{ marginTop: 0 }}>What is the hazard?</h2>
          <p className="muted" style={{ marginTop: -6 }}>Pick everything you see at this spot. Your first pick is the main one.</p>
          <div className="hazard-grid">
            {hazards.map(([key, m]) => (
              <button key={key} className={`hazard-pick ${hazard === key ? 'sel' : extraHazards.includes(key) ? 'sel extra' : ''}`} onClick={() => pickHazard(key)}>
                <span className="ic" aria-hidden><HazardIcon kind={m.icon} size={26} /></span> {m.label}
                {hazard === key ? <span className="primary-chip">main</span> : null}
              </button>
            ))}
          </div>
          {(hazard === 'other' || extraHazards.includes('other')) ? (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="other-hazard">What is it? (optional)</label>
              <input id="other-hazard" type="text" maxLength={120} placeholder="e.g. Open drain, fallen tree, loose wires" value={otherText} onChange={(e) => setOtherText(e.target.value)} />
            </div>
          ) : null}
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
              <tr><th>Hazard</th><td>{hazard ? [hazard, ...extraHazards].map((h, i) => HAZARD_META[h].label + (i === 0 && extraHazards.length ? ' (main)' : '')).join(', ') : '-'}{danger ? ' (marked dangerous)' : ''}</td></tr>
              <tr><th>Location</th><td>{gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)} (±${gps.accuracy_m} m)` : '-'}</td></tr>
              <tr><th>Photo</th><td>Attached (uploaded with the report)</td></tr>
              {otherText.trim() ? <tr><th>Other hazard</th><td>{otherText.trim()}</td></tr> : null}
              {note.trim() ? <tr><th>Note</th><td>{note.trim()}</td></tr> : null}
            </tbody>
          </table>
          {staleCapture ? <div className="warn-box">This GPS reading is getting old. Go back and refresh it before sending.</div> : null}
          {err ? <ErrorBox error={err} onRetry={() => setErr(null)} /> : null}
          <div className="notice-box" style={{ marginTop: 12 }}>
            <strong>AI pre-check (optional)</strong>
            {aiState === 'idle' ? (
              <p className="small-note" style={{ marginBottom: 0 }}>Get an advisory read on your draft before sending. It runs on the project owner's own machine - it never verifies your report and nothing is sent to officials automatically. <button className="btn ghost" style={{ marginLeft: 6 }} onClick={runAiCheck}>Check my draft</button></p>
            ) : null}
            {aiState === 'checking' ? <p className="small-note" style={{ marginBottom: 0 }}>Checking… (can take up to about 25 seconds)</p> : null}
            {aiState === 'consent' ? (
              <AiConsentGate feature="report_check" onGranted={() => setAiState('idle')} />
            ) : null}
            {aiState === 'unavailable' ? (
              <p className="small-note" style={{ marginBottom: 0 }}>AI check is offline right now{aiReason ? ` (${aiReason.replace(/_/g, ' ')})` : ''}. Your report is unaffected - you can send it normally. <button className="btn ghost" style={{ marginLeft: 6 }} onClick={runAiCheck}>Retry</button></p>
            ) : null}
            {aiState === 'done' && advisory ? (
              <div>
                <p className="small-note" style={{ marginBottom: 4 }}><em>Advisory only - not a verification, not sent anywhere else.</em></p>
                <p style={{ margin: '4px 0' }}>{advisory.summary}</p>
                {advisory.severity_hint ? <p className="small-note" style={{ margin: '2px 0' }}>Severity hint: {advisory.severity_hint}</p> : null}
                {advisory.suggested_hazard && advisory.suggested_hazard !== hazard ? <p className="small-note" style={{ margin: '2px 0' }}>Suggests looking at: {advisory.suggested_hazard} (your pick stays yours)</p> : null}
                {advisory.missing_details.length ? (
                  <p className="small-note" style={{ margin: '2px 0' }}>Worth adding: {advisory.missing_details.join('; ')}</p>
                ) : null}
              </div>
            ) : null}
          </div>
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
