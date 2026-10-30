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
import { TopBar } from './ui'

export default function App() {
  const [warming, setWarming] = useState(false)
  const { session } = useAuth()

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
      {warming ? <div className="warm-banner">Waking up the demo server - the free tier sleeps when idle. First request can take about a minute.</div> : null}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
