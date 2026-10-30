import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import IssueDetail from './pages/IssueDetail'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import PublicIssueDetail from './pages/PublicIssueDetail'
import PublicIssues from './pages/PublicIssues'
import Report from './pages/Report'
import Updates from './pages/Updates'
import { TopBar } from './ui'

function oauthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  const err = q.get('error')
  if (!err) return null
  const desc = q.get('error_description')?.replace(/\+/g, ' ') ?? ''
  // Clean the URL so a refresh does not show the error again.
  const url = new URL(window.location.href)
  url.search = ''
  window.history.replaceState(null, '', url.toString())
  if (err === 'access_denied') return 'Google sign-in could not be completed. If Google says the app is still in testing, public access has not been opened yet - use email sign-in meanwhile.'
  return desc || 'Sign-in was interrupted. Please try again.'
}

export default function App() {
  const [warming, setWarming] = useState(false)
  const [oauthErr, setOauthErr] = useState<string | null>(null)
  const { session } = useAuth()

  useEffect(() => {
    const e = oauthErrorFromUrl()
    if (e) setOauthErr(e)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setWarming(true), 2500)
    api.health().catch(() => undefined).finally(() => {
      clearTimeout(t)
      setWarming(false)
    })
    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      {warming ? <div className="warm-banner">Waking up the server - the free tier sleeps when idle. First request can take about a minute.</div> : null}
      {oauthErr ? (
        <div className="warm-banner" role="alert" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          {oauthErr}{' '}
          <button className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => setOauthErr(null)}>Dismiss</button>
        </div>
      ) : null}
      <TopBar points={null} key={session ? 'in' : 'out'} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/issues" element={<PublicIssues />} />
        <Route path="/issues/:id" element={<PublicIssueDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/report" element={<Report />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/issues/:id" element={<IssueDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
