import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { OfficialRecords, Hazard, Status } from './types'
import { DEMO } from './config'
import { useAuth } from './auth'
import { INDIA_BOUNDARY } from './india-boundary'

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
  /** Optional PUBLIC-SAFE details for the hover card. Only fields already public on the
   *  issues list belong here - never notes, photos, or reporter identity. */
  hazard?: Hazard
  ward?: string | null
  created_at?: string
  reports_count?: number
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// India-framed default: state boundaries and state names are legible at this zoom.
// It is a regional frame, not the full extent - the Fit India control shows everything.
const INDIA_VIEW: L.LatLngExpression = [23.5, 79.5]
const INDIA_ZOOM = 5
const INDIA_EXTENT = L.latLngBounds([6.6, 68.0], [37.3, 97.6])

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
  const frameKeyRef = useRef<string>('')
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    // Political base map: OSM standard tiles render country/state boundaries and place
    // labels. No paid tile service. Small-site browser use is compatible with the OSM
    // tile usage policy (https://operations.osmfoundation.org/policies/tiles/): the
    // browser sends Referer and honours cache headers, we never prefetch or bulk-load,
    // and the required attribution stays visible on the map. TILE_URL is a constant so
    // the basemap can be switched without touching call sites.
    const map = L.map(ref.current, {
      scrollWheelZoom: false,
      minZoom: 3,
      maxBounds: L.latLngBounds([4, 62], [40, 101]),
    }).setView(INDIA_VIEW, INDIA_ZOOM)
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)
    // India's official claimed external boundary, drawn over the basemap: OSM tiles show
    // de-facto control lines in Kashmir, while the earlier schematic map deliberately
    // depicted the claimed boundary - keep that presentation.
    L.polyline(INDIA_BOUNDARY, {
      color: '#0e1b2c', weight: 1.4, opacity: 0.5, interactive: false,
      attribution: 'Boundary: <a href="https://github.com/datameet/maps">DataMeet</a> (CC BY 4.0)',
    }).addTo(map)
    // The default view frames central India so state names stay legible; this control
    // zooms out to the full claimed extent (incl. Kashmir/Ladakh and Kanyakumari).
    const fitControl = new L.Control({ position: 'topright' })
    fitControl.onAdd = () => {
      const btn = L.DomUtil.create('button', 'fit-india-btn')
      btn.type = 'button'
      btn.textContent = 'Fit India'
      btn.title = 'Zoom out to the full map of India'
      L.DomEvent.disableClickPropagation(btn)
      L.DomEvent.on(btn, 'click', () => map.fitBounds(INDIA_EXTENT, { padding: [10, 10] }))
      return btn
    }
    fitControl.addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      frameKeyRef.current = ''
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const pts: L.LatLngExpression[] = []
    // Touch screens have no hover: first tap on a dot opens its detail card, the second
    // tap (or the card's own button) opens the issue. Pointer devices hover for the card.
    const touch = window.matchMedia('(hover: none)').matches
    pins.forEach((p, idx) => {
      const color = PIN_COLORS[p.status] ?? '#0e1b2c'
      const active = p.status === 'reported' || p.status === 'reopened' || p.status === 'awaiting_confirmation'
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<span class="pin-dot" style="animation-delay:${Math.min(idx * 45, 540)}ms"><span class="pin-core${active ? ' pin-pulse' : ''}" style="--pin:${color}"></span></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const m = L.marker([p.lat, p.lon], { icon, keyboard: true })

      let suppressFocusOpen = false
      const card = document.createElement('div')
      card.className = 'pin-card'
      const title = document.createElement('strong')
      title.textContent = p.hazard ? (HAZARD_META[p.hazard]?.label ?? p.label) : p.label
      card.appendChild(title)
      const st = document.createElement('span')
      st.className = 'pin-card-status'
      st.style.color = color
      st.textContent = STATUS_META[p.status]?.label ?? p.status
      card.appendChild(st)
      const metaBits: string[] = []
      if (p.ward) metaBits.push(`Ward ${p.ward}`)
      if (p.created_at) metaBits.push(timeAgo(p.created_at))
      if (p.reports_count && p.reports_count > 1) metaBits.push(`${p.reports_count} reports`)
      if (metaBits.length > 0) {
        const meta = document.createElement('span')
        meta.className = 'pin-card-meta'
        meta.textContent = metaBits.join(' · ')
        card.appendChild(meta)
      }
      if (onSelect) {
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'pin-card-open'
        open.textContent = 'Open issue'
        open.addEventListener('click', (e) => { e.stopPropagation(); onSelect(p.id) })
        open.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            // Refocusing the dot would reopen the card via its focus listener; skip once.
            suppressFocusOpen = true
            m.closeTooltip()
            m.getElement()?.focus()
            window.setTimeout(() => { suppressFocusOpen = false }, 0)
          }
        })
        card.appendChild(open)
      }
      // Leaflet closes the tooltip the moment the marker blurs, which would drop the
      // "Open issue" button as Tab moves focus onto it. Intercept that specific blur
      // (focus landing inside the card) before Leaflet's own blur listener - this one
      // must be registered first, so it hooks the 'add' event ahead of bindTooltip.
      m.on('add', () => {
        m.getElement()?.addEventListener('blur', (e) => {
          const tipEl = m.getTooltip()?.getElement()
          if (tipEl && e.relatedTarget instanceof Node && tipEl.contains(e.relatedTarget)) {
            e.stopImmediatePropagation()
          }
        })
      })
      // When focus later leaves the card entirely, close it.
      card.addEventListener('focusout', (e) => {
        if (!(e.relatedTarget instanceof Node && card.contains(e.relatedTarget))) m.closeTooltip()
      })
      m.bindTooltip(card, { direction: 'top', offset: [0, -10], interactive: true, className: 'pin-tip' })
      // Touch browsers synthesize mouseout after a tap. Keep the tapped card open
      // until a map tap, another pin, keyboard close, or navigation dismisses it.
      if (touch) m.off('mouseout', m.closeTooltip, m)
      const openTooltip = m.openTooltip.bind(m)
      m.openTooltip = ((latlng?: L.LatLngExpression) => {
        if (suppressFocusOpen) return m
        return openTooltip(latlng)
      }) as L.Marker['openTooltip']
      if (onSelect) {
        // A tap fires emulated mouse events around the click: the mouseover opens the
        // tooltip before the click arrives, and a second tap may close and reopen it, so
        // "is the tooltip open" cannot tell first tap from second. Arm on first tap and
        // navigate only on a second tap within a short window; a later tap re-arms.
        let armedAt = 0
        m.on('click', () => {
          if (!touch) { onSelect(p.id); return }
          const now = Date.now()
          if (armedAt && now - armedAt < 1600) { armedAt = 0; onSelect(p.id); return }
          armedAt = now
          m.openTooltip()
        })
      }
      m.addTo(layer)
      const el = m.getElement()
      if (el) {
        el.setAttribute('aria-label', p.label)
        if (onSelect) {
          // Leaflet only makes the dot focusable; wire the keys ourselves:
          // Enter/Space activates the dot, and Tab moves into the open card so its
          // "Open issue" button stays reachable without tabbing past every other dot.
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              m.fire('click')
            } else if (e.key === 'Tab' && m.isTooltipOpen()) {
              const btn = m.getTooltip()?.getElement()?.querySelector<HTMLElement>('.pin-card-open')
              if (btn) {
                e.preventDefault()
                btn.focus()
              }
            }
          })
        }
      }
      pts.push([p.lat, p.lon])
    })
    // Frame the pins, but never wider than the country: a wide spread (or no pins) gets
    // the fixed India view so state boundaries/labels stay legible. Only re-frame when
    // the pin set actually changes - re-renders must not reset the user's pan/zoom.
    const key = pins.map((p) => p.id + ':' + p.status).join('|')
    if (key !== frameKeyRef.current) {
      frameKeyRef.current = key
      if (pts.length === 0) {
        map.setView(INDIA_VIEW, INDIA_ZOOM)
      } else {
        const b = L.latLngBounds(pts)
        if (b.getNorth() - b.getSouth() > 9 || b.getEast() - b.getWest() > 9) {
          map.setView(INDIA_VIEW, INDIA_ZOOM)
        } else {
          map.fitBounds(b.pad(0.25), { maxZoom: 14 })
        }
      }
    }
  }, [pins, onSelect])

  return <div className="map" style={{ height }} ref={ref} />
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
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
