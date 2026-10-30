import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { OfficialRecords, Hazard, Status } from './types'
import { DEMO } from './config'
import { useAuth } from './auth'

export const HAZARD_META: Record<Hazard, { label: string; icon: string }> = {
  pothole: { label: 'Pothole', icon: 'pothole' },
  crack: { label: 'Crack', icon: 'crack' },
  waterlogging: { label: 'Waterlogging', icon: 'water' },
  broken_edge: { label: 'Broken edge', icon: 'edge' },
  missing_cover: { label: 'Missing cover', icon: 'cover' },
  other: { label: 'Other', icon: 'pin' },
}

export function HazardIcon({ kind, size = 22 }: { kind: string; size?: number }) {
  const stroke = 'currentColor'
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (kind) {
    case 'pothole':
      return (<svg {...common}><ellipse cx="12" cy="15" rx="8" ry="4.5" /><ellipse cx="12" cy="15" rx="4" ry="2" strokeDasharray="2 2" /></svg>)
    case 'crack':
      return (<svg {...common}><path d="M13 2 9 9l4 3-4 5 3 5" /></svg>)
    case 'water':
      return (<svg {...common}><path d="M3 10c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 3-2" /><path d="M3 16c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 3-2" /></svg>)
    case 'edge':
      return (<svg {...common}><path d="M4 20 20 4" strokeDasharray="4 3" /><path d="M4 20h16" /></svg>)
    case 'cover':
      return (<svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" strokeDasharray="2 2" /></svg>)
    default:
      return (<svg {...common}><path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2" /></svg>)
  }
}

export const STATUS_META: Record<Status, { label: string; hint: string }> = {
  reported: { label: 'Reported', hint: 'Waiting for a municipal officer to verify' },
  verified: { label: 'Verified', hint: 'Verified, routing in progress' },
  assigned: { label: 'Assigned', hint: 'A responsible party is assigned with a deadline' },
  in_progress: { label: 'Repair in progress', hint: 'The assigned party has started work' },
  awaiting_confirmation: { label: 'Fix submitted', hint: 'Repair photo submitted - citizens confirm the fix' },
  fixed: { label: 'Fixed', hint: 'Confirmed fixed' },
  reopened: { label: 'Reopened', hint: 'Fix was rejected - the deadline clock restarted' },
  rejected: { label: 'Rejected', hint: 'Rejected by a municipal officer' },
}

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill st-${status}`}>{STATUS_META[status].label}</span>
}

export function HazardTag({ hazard, hazards }: { hazard: Hazard; hazards?: Hazard[] }) {
  const m = HAZARD_META[hazard] ?? HAZARD_META.other
  const extras = (hazards ?? []).filter((h) => h !== hazard)
  return (
    <>
      <span className="hazard-tag">
        <HazardIcon kind={m.icon} /> {m.label}
      </span>
      {extras.map((h) => {
        const em = HAZARD_META[h] ?? HAZARD_META.other
        return (
          <span key={h} className="hazard-tag extra" title="Also reported at this spot">
            <HazardIcon kind={em.icon} /> {em.label}
          </span>
        )
      })}
    </>
  )
}

export function SyntheticBadge() {
  return <span className="syn-badge" title="Sample record - not a real complaint">Synthetic data</span>
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'not set'
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function Deadline({ iso }: { iso: string | null }) {
  if (!iso) return null
  const overdue = new Date(iso).getTime() < Date.now()
  return <span className={overdue ? 'deadline overdue' : 'deadline'}>{overdue ? 'Overdue - due ' : 'Due '}{fmtDate(iso)}</span>
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      {label ? <p className="muted">{label}</p> : null}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="error-box">
      <p>{msg}</p>
      {onRetry ? <button className="btn ghost" onClick={onRetry}>Retry</button> : null}
    </div>
  )
}

export function TopBar({ points }: { points?: number | null }) {
  const { session, signOut } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const btnRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const overlay = overlayRef.current
    const parent = overlay?.parentElement
    const siblings = parent ? Array.from(parent.children).filter((el) => el !== overlay) : []
    siblings.forEach((el) => el.setAttribute('inert', ''))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusables = () => Array.from(overlay?.querySelectorAll<HTMLElement>('a, button') ?? [])
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      siblings.forEach((el) => el.removeAttribute('inert'))
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      btnRef.current?.focus()
    }
  }, [open])

  const links = (
    <>
      <NavLink to="/issues" end>Live issues</NavLink>
      {session ? <NavLink to="/app">My desk</NavLink> : null}
      {session ? <NavLink to="/leaderboard">Leaderboard</NavLink> : null}
      {session ? <NavLink to="/app/settings">Profile</NavLink> : null}
      {!session ? <NavLink to="/login">Sign in</NavLink> : null}
    </>
  )

  return (
    <>
      <header className="topbar">
        <div className="topbar-pill">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="brand-logo" />
            <span>NagarTrace</span>
          </Link>
          {DEMO ? <span className="demo-pill">Simulated data</span> : null}
          <nav className="topnav">{links}</nav>
          <div className="top-actions">
            {session && typeof points === 'number' ? <span className="points-chip" title="Your points">{points} pts</span> : null}
            <Link to="/report" className="btn primary small mono-btn">Report →</Link>
            {session ? <button className="btn ghost small" onClick={() => { void signOut().then(() => nav('/')) }}>Sign out</button> : null}
            <button ref={btnRef} className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'CLOSE' : 'MENU'} <span className="menu-icon" aria-hidden>{open ? '✕' : '≡'}</span>
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="menu-overlay" ref={overlayRef} onClick={() => setOpen(false)}>
          <button className="menu-close" aria-label="Close menu" onClick={() => setOpen(false)}>
            CLOSE <span aria-hidden>✕</span>
          </button>
          <nav className="menu-links" onClick={(e) => e.stopPropagation()}>
            <NavLink to="/">Home</NavLink>
            <NavLink to="/issues" end>Live issues</NavLink>
            <NavLink to="/report">Report a hazard</NavLink>
            {session ? <NavLink to="/app">My desk</NavLink> : <NavLink to="/login">Sign in</NavLink>}
            {session ? <NavLink to="/leaderboard">Leaderboard</NavLink> : null}
            {session ? <NavLink to="/app/settings">Profile &amp; settings</NavLink> : null}
            {session ? <button className="menu-signout" onClick={() => { void signOut().then(() => nav('/')) }}>Sign out</button> : null}
          </nav>
        </div>
      ) : null}
    </>
  )
}

export interface MapPin {
  id: string
  lat: number
  lon: number
  status: Status
  label: string
}

const PIN_COLORS: Record<Status, string> = {
  reported: '#f59e0b',
  verified: '#8b5cf6',
  assigned: '#3b82f6',
  in_progress: '#6366f1',
  awaiting_confirmation: '#f97316',
  fixed: '#16a34a',
  reopened: '#dc2626',
  rejected: '#6b7280',
}

export function MapView({ pins, height = 380, onSelect }: { pins: MapPin[]; height?: number; onSelect?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView([30.3398, 76.3869], 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const pts: L.LatLngExpression[] = []
    for (const p of pins) {
      const m = L.circleMarker([p.lat, p.lon], {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: PIN_COLORS[p.status] ?? '#0e1b2c',
        fillOpacity: 0.95,
      })
      m.bindTooltip(p.label)
      if (onSelect) m.on('click', () => onSelect(p.id))
      m.addTo(layer)
      pts.push([p.lat, p.lon])
    }
    if (pts.length > 0) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 14 })
  }, [pins, onSelect])

  return <div className="map" style={{ height }} ref={ref} />
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}

// Schematic India overview map (Natural Earth outline, public domain - see src/india.ts).
// Shows real reports at their projected positions; schematic only - exact locations
// live on the per-issue map and in the GPS evidence itself.
import { INDIA_PATH, INDIA_VIEWBOX, indiaProject } from './india'

const INDIA_STATUS_COLORS: Record<Status, string> = PIN_COLORS

export function IndiaMap({ pins, height = 420, onSelect }: { pins: MapPin[]; height?: number; onSelect?: (id: string) => void }) {
  return (
    <div className="india-map" style={{ height }}>
      <svg viewBox={INDIA_VIEWBOX} role="img" aria-label="Schematic map of India showing reported issues" preserveAspectRatio="xMidYMid meet">
        <path d={INDIA_PATH} className="india-outline" />
        {pins.map((p) => {
          const { x, y } = indiaProject(p.lat, p.lon)
          const active = p.status === 'reported' || p.status === 'reopened' || p.status === 'awaiting_confirmation'
          return (
            <g
              key={p.id}
              className="india-dot"
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? 'link' : undefined}
              onClick={() => onSelect?.(p.id)}
              onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(p.id) } }}
            >
              <title>{p.label}</title>
              {active ? <circle cx={x} cy={y} r={0.55} className="india-pulse" fill={INDIA_STATUS_COLORS[p.status] ?? '#0e1b2c'} /> : null}
              <circle cx={x} cy={y} r={0.34} fill={INDIA_STATUS_COLORS[p.status] ?? '#0e1b2c'} stroke="#fff" strokeWidth={0.09} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Official government-record linkage for an issue. Renders the API's candidate warning
 *  BESIDE the award candidates (never buried in metadata): these are possible historical
 *  FY2024-25 NHAI awards on the highway, NOT the report's verified or current contractor. */
export function OfficialRecordsBlock({ rec }: { rec: OfficialRecords }) {
  return (
    <section className="card pad" style={{ marginTop: 16 }} aria-label="Official road records">
      <h3 style={{ marginTop: 0 }}>Official road records</h3>
      {rec.road ? (
        <p style={{ marginBottom: 8 }}>
          Nearest road in our records: <strong>{rec.road.name ?? rec.road.ref ?? 'Unnamed road'}</strong>
          {rec.road.name && rec.road.ref ? ` (${rec.road.ref})` : ''}, about {rec.road.distance_m} m away.
          Source: {rec.road.source_label} ({rec.road.attribution}). Maintainer: <strong>unknown</strong>
          {rec.road.jurisdiction_status === 'unresolved' ? ' - jurisdiction not resolved yet' : ''}.
        </p>
      ) : null}
      <p style={{ marginBottom: 8 }}>Responsible contractor for this report: <strong>unknown</strong>.</p>
      {rec.candidate_awards.length > 0 ? (
        <>
          <p role="note" style={{ background: '#fff7e0', border: '1px solid #e0b400', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}>
            {rec.candidate_warning}
          </p>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            {rec.candidate_awards.map((a) => (
              <li key={a.sr} style={{ marginBottom: 10 }}>
                <strong>{a.project_name}</strong>
                <br />
                <span className="muted">
                  Contractor on record: {a.contractor_name ?? 'not stated in source'}
                  {a.awarded_cost_cr != null ? ` · awarded cost Rs ${a.awarded_cost_cr} cr (verbatim from source)` : ''}
                  {a.loa_date ? ` · LOA ${a.loa_date.slice(0, 10)}` : ''}
                  {a.state ? ` · ${a.state}` : ''}
                  {a.nh_from_name?.length ? ` · ${a.nh_from_name.map((t) => 'NH-' + t).join(' / ')}` : ''}
                  {a.chainage_km_marks?.length ? ` · km ${a.chainage_km_marks.join(', ')}` : ''}
                  {' · '}
                  <a href={a.source_url} target="_blank" rel="noreferrer">source ({a.source_label}{a.page ? `, p.${a.page}` : ''})</a>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="small-note">{rec.coverage_note}</p>
    </section>
  )
}
