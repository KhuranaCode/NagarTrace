/**
 * Client for the streaks API (api/src/streaks.ts). Kept as a separate module so this patch adds
 * no edits to existing files; the integrator may fold these into src/api.ts and src/types.ts.
 * Mirrors api.ts conventions: bearer token from auth.tsx, ApiError shape, free-host network note.
 */
import { API_BASE } from './config'
import { accessToken } from './auth'

export interface StreakMilestone {
  days: number
  earned: boolean
}

export interface Streaks {
  timezone: string
  current_streak: number
  longest_streak: number
  streak_alive: boolean
  today_credited: boolean
  last_credited_date: string | null
  credited_days: number
  recent_days: string[]
  milestones: StreakMilestone[]
  note: string
}

export class StreakApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function streakReq<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = await accessToken()
  const headers: Record<string, string> = {}
  if (t) headers['authorization'] = `Bearer ${t}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new StreakApiError(0, 'network', 'Cannot reach the server. Check your connection or retry - the free host may still be waking up.')
  }
  if (!res.ok) {
    let code = 'error'
    let message = `Request failed (${res.status})`
    try {
      const j = await res.json()
      if (j?.error) code = j.error
      if (j?.message) message = j.message
    } catch { /* keep defaults */ }
    throw new StreakApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

export const streaksApi = {
  get: () => streakReq<Streaks>('/v1/me/streaks'),
  setTimezone: (timezone: string) => streakReq<Streaks>('/v1/me/streaks/timezone', { method: 'PATCH', body: { timezone } }),
}
