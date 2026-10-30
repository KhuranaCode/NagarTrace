import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Counters from '../components/Counters'
import type { PublicIssue } from '../types'
import { Deadline, Empty, ErrorBox, HazardTag, MapView, Spinner, StatusPill, SyntheticBadge } from '../ui'
import { IssueCard } from './shared'

const STEPS = [
  { n: '01', t: 'Report', d: 'Snap a photo. GPS and time are captured on the spot.' },
  { n: '02', t: 'Verify', d: 'A municipal officer verifies the report before anyone is assigned. No auto-blame.' },
  { n: '03', t: 'Assign', d: 'The registry decides the owner: utility cut, contractor under warranty, or the city. Deadline set.' },
  { n: '04', t: 'Repair', d: 'The owner uploads an after-photo. The app checks its stated location against the site.' },
  { n: '05', t: 'Confirm', d: 'Reporters confirm the fix. Two yes votes close it. Two no votes reopen it.' },
]

export default function Home() {
  const [issues, setIssues] = useState<PublicIssue[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const nav = useNavigate()

  const load = () => {
    setErr(null)
    api.publicIssues().then((r) => setIssues(r.issues)).catch(setErr)
  }
  useEffect(load, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.12 },
    )
    document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [issues])

  const reports = (issues ?? []).reduce((a, i) => a + (i.reports_count || 0), 0)
  const fixed = (issues ?? []).filter((i) => i.status === 'fixed').length

  return (
    <div>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-eyebrow">Civic tech · Synthetic demo</span>
            <h1>Report the pothole. Reach who must fix it.</h1>
            <div className="dash-strip" aria-hidden="true" />
            <p className="lede lede-full">
              Complaints vanish into city offices. NagarTrace is built to route each verified report to the accountable
              party - the contractor under warranty, the utility that dug the cut, or the municipality - then tracks
              the deadline and whether the repair is confirmed.
            </p>
            <p className="lede lede-short">
              NagarTrace routes each verified report to the accountable party and tracks the deadline to a confirmed repair.
            </p>
            <div className="hero-cta">
              <Link to="/report" className="btn dark">Report a hazard →</Link>
              <Link to="/issues" className="btn ghost">See live issues</Link>
            </div>
            <ul className="hero-feats reveal-stagger">
              <li>Location and time captured with the report</li>
              <li>Photos stay private to the issue's participants</li>
              <li>An officer verifies before anyone is assigned</li>
            </ul>
            <div className="demo-strip">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.8 19a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14 9.5V3" /></svg> Demo running on synthetic data. No live municipal integration is claimed.
            </div>
          </div>
          <div className="record-card">
            <div className="record-head">
              <span className="mono-label">Live record</span>
              <span className="vis-pill public">Public</span>
            </div>
            {err ? <p className="small-note">Live data unavailable right now.</p> : null}
            {!issues && !err ? <Spinner label="Loading the public record." /> : null}
            {issues ? (
              issues.length === 0 ? (
                <p className="small-note">No reports yet. Be the first.</p>
              ) : (
                <>
                  {[...issues].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3).map((i) => (
                    <Link key={i.id} to={`/issues/${i.id}`} className="record-row">
                      <div className="record-row-top">
                        <HazardTag hazard={i.hazard} />
                        <StatusPill status={i.status} />
                      </div>
                      <div className="issue-meta">
                        {i.ward ? <span>Ward {i.ward}</span> : null}
                        <Deadline iso={i.deadline_at} />
                        {i.responsible?.synthetic_data ? <SyntheticBadge /> : null}
                      </div>
                    </Link>
                  ))}
                  <Link to="/issues" className="record-all">See all {issues.length} public issues →</Link>
                </>
              )
            ) : null}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 26 }}>
        <div className="container">
          {issues ? (
            <Counters
              items={[
                { value: issues.length, label: 'Issues tracked live' },
                { value: reports, label: 'Citizen reports' },
                { value: fixed, label: 'Repairs confirmed' },
              ]}
            />
          ) : (
            <Counters items={[{ value: 0, label: 'Issues tracked live' }, { value: 0, label: 'Citizen reports' }, { value: 0, label: 'Repairs confirmed' }]} />
          )}
          <p className="small-note" style={{ marginTop: 10 }}>Live counts from this running demo's synthetic dataset.</p>
        </div>
      </section>

      <section className="section reveal" style={{ paddingTop: 20 }}>
        <div className="container">
          <span className="mono-label">How it works</span>
          <h2>From report to verified repair.</h2>
          <div className="steps-grid reveal-stagger">
            {STEPS.map((s) => (
              <div className="step-card" key={s.n}>
                <span className="step-n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section reveal" style={{ background: 'var(--paper)' }}>
        <div className="container">
          <span className="mono-label">Routing engine</span>
          <h2>Who gets the complaint?</h2>
          <p className="sub">Every verified report is routed by the road's own records, in this order. Wrong blame breaks credibility - so the checks come first.</p>
          <div className="route-grid reveal-stagger">
            <div className="route-card">
              <span className="wm">1</span>
              <span className="mono-label">Check 01</span>
              <h3>Recent utility cut?</h3>
              <p>A telecom, water or gas agency dug here recently - the utility gets the complaint. The contractor is not blamed.</p>
            </div>
            <div className="route-card">
              <span className="wm">2</span>
              <span className="mono-label">Check 02</span>
              <h3>Under warranty?</h3>
              <p>Inside the defect liability period, the contractor who built the road must fix its own bad work - municipality copied.</p>
            </div>
            <div className="route-card">
              <span className="wm">3</span>
              <span className="mono-label">Fallback</span>
              <h3>The city maintains</h3>
              <p>Warranty expired or no record - the municipality takes it as normal maintenance, with the same deadline.</p>
            </div>
            <div className="route-card">
              <span className="wm">!</span>
              <span className="mono-label">Missed deadline</span>
              <h3>Escalation</h3>
              <p>Overdue issues are marked escalated to the municipal engineer, then the department head - in this demo these are recorded entries only; no notices are sent. Each step is kept in a recorded history.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section reveal" style={{ background: 'var(--paper)', paddingTop: 0 }}>
        <div className="container">
          <span className="mono-label">Public status · no login</span>
          <h2>Live on the map</h2>
          <p className="sub">Real reports from the running demo. Public locations are rounded to about 11 m. Photos are never shown publicly.</p>
          {err ? <ErrorBox error={err} onRetry={load} /> : null}
          {!issues && !err ? <Spinner label="Loading live issues. The free demo server may take a minute to wake up." /> : null}
          {issues ? (
            issues.length === 0 ? (
              <Empty>No reports yet. Be the first to report a hazard.</Empty>
            ) : (
              <>
                <MapView
                  pins={issues.map((i) => ({ id: i.id, lat: i.location.lat, lon: i.location.lon, status: i.status, label: `${i.hazard} - ${i.status}` }))}
                  onSelect={(id) => nav(`/issues/${id}`)}
                />
                <div className="map-legend">
                  <span><i style={{ background: '#f59e0b' }} /> Reported</span>
                  <span><i style={{ background: '#3b82f6' }} /> Assigned</span>
                  <span><i style={{ background: '#f97316' }} /> Fix submitted</span>
                  <span><i style={{ background: '#16a34a' }} /> Fixed</span>
                  <span><i style={{ background: '#dc2626' }} /> Reopened</span>
                </div>
                <div className="grid cols-2" style={{ marginTop: 22 }}>
                  {issues.slice(0, 6).map((i) => (
                    <IssueCard key={i.id} issue={i} to={`/issues/${i.id}`} />
                  ))}
                </div>
                {issues.length > 6 ? (
                  <p style={{ marginTop: 16 }}><Link to="/issues">See all {issues.length} issues →</Link></p>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <h2>See a pothole on your way home?</h2>
            <Link to="/report" className="btn dark">Report a hazard →</Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <h4>The promise</h4>
              <p style={{ maxWidth: '44ch', margin: 0 }}>From a road hazard to a repair you can review. Right owner, real deadline, repair photos for review - and a recorded history of each step.</p>
              <p className="small-note" style={{ marginTop: 18 }}>Demo build for Zinnovatio 4.0 by Team Grexars. All roads, contractors, warranties and identities shown are synthetic sample data. This app sends no real complaint and is not an emergency service. AI hazard detection and photo blur are not implemented.</p>
            </div>
            <div className="footer-col">
              <h4>Explore</h4>
              <Link to="/issues">Live issues</Link>
              <Link to="/report">Report a hazard</Link>
              <Link to="/leaderboard">Ward leaderboard</Link>
              <a href="https://github.com/KhuranaCode/nagartrace-api" target="_blank" rel="noreferrer">API source</a>
            </div>
          </div>
          <div className="footer-word">NAGAR<span>TRACE</span></div>
          <div className="footer-base">
            <span>© 2026 NagarTrace · Team Grexars</span>
            <span>Synthetic data demo · Not a government service</span>
            <span>Made in India</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
