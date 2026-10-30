import { UPDATES } from '../updates'

export default function Updates() {
  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Updates</h1>
      <p className="muted">What changed in NagarTrace, newest first. Every entry is a real shipped change - no announcements for things that are not live.</p>
      <div className="updates-list">
        {UPDATES.map((u) => (
          <article key={u.date + u.title} className="card update-item">
            <div className="update-meta">
              <time dateTime={u.date}>{u.date}</time>
              <span className="update-area">{u.area}</span>
            </div>
            <h3 style={{ margin: '6px 0 4px' }}>{u.title}</h3>
            <p className="muted" style={{ margin: 0 }}>{u.detail}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
