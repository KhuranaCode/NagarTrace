import { useState } from 'react'
import { api } from '../api'

type Msg = { role: 'you' | 'guide'; text: string }

/**
 * Platform guide chat. Answers how-the-app-works questions only - the backend guide has no
 * access to issue, report or account data, and every reply carries that limit. When the
 * owner laptop is offline the panel says so instead of fabricating an answer.
 */
export default function AiGuide() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState<string | null>(null)

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput(''); setBusy(true); setOffline(null)
    setMsgs((m) => [...m, { role: 'you', text: q }])
    try {
      const r = await api.aiChat(q)
      if (r.ai_available) setMsgs((m) => [...m, { role: 'guide', text: r.reply }])
      else setOffline(r.reason === 'not_live_yet' ? 'The guide is not live on this server yet.' : 'The guide is offline right now - it runs on the operator\'s own machine. Try again later.')
    } catch {
      setOffline('Could not reach the guide. Your question was not processed.')
    } finally { setBusy(false) }
  }

  if (!open) return <button className="btn ghost" onClick={() => setOpen(true)} style={{ marginTop: 8 }}>Ask the app guide</button>
  return (
    <div className="notice-box" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>App guide</strong>
        <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="field-hint">Answers questions about how NagarTrace works. It cannot see your reports, issues or account - for those, use the screens themselves.</p>
      {msgs.map((m, i) => (
        <p key={i} style={{ margin: '6px 0' }}><strong>{m.role === 'you' ? 'You: ' : 'Guide: '}</strong>{m.text}</p>
      ))}
      {offline ? <p className="field-hint">{offline}</p> : null}
      <div className="action-row" style={{ marginTop: 6 }}>
        <input value={input} maxLength={500} placeholder="e.g. What happens after I report?" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }} />
        <button className="btn" disabled={busy || !input.trim()} onClick={() => void send()}>{busy ? 'Asking...' : 'Ask'}</button>
      </div>
    </div>
  )
}
