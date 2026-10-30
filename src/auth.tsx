import { createClient, type Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

interface AuthState {
  session: Session | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }

  const signUp = async (email: string, password: string) => {
    const emailRedirectTo = import.meta.env.DEV ? 'http://localhost:3000/' : 'https://khuranacode.github.io/NagarTrace/'
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
    if (error) return { error: error.message, needsConfirmation: false }
    // When email confirmation is enabled, no session is returned.
    return { error: null, needsConfirmation: !data.session }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, ready, signIn, signUp, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
