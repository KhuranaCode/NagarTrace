import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { colors } from './theme'

const MOCK_AUTH = process.env.EXPO_PUBLIC_MOCK_AUTH === '1'
const MOCK_SESSION = { access_token: 'mock-fixture-token', token_type: 'bearer', user: { id: 'mock-user-1', email: 'mock@example.test' } } as unknown as Session

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  if (MOCK_AUTH) {
    // Isolated UI-test mode: no real Supabase session. Data comes from the local mock server.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return { session: MOCK_SESSION, ready: true }
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return { session, ready }
}

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (!data.session) setMsg('Account created. Check your email to confirm it, then sign in. Your reports stay tied to this account.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.eyebrow}>NAGARTRACE</Text>
      <Text style={s.title}>{mode === 'signin' ? 'Sign in' : 'Create your account'}</Text>
      <Text style={s.sub}>Reporting, confirmations, points and badges need an account. Reading the public record never does.</Text>
      <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password (6+ characters)" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
      {err ? <Text style={s.err}>{err}</Text> : null}
      {msg ? <Text style={s.ok}>{msg}</Text> : null}
      <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</Text>}
      </Pressable>
      <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); setMsg(null) }}>
        <Text style={s.switch}>{mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 48 },
  eyebrow: { color: colors.muted, letterSpacing: 4, fontSize: 12, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 6 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 8, marginBottom: 20 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.ink, marginBottom: 10 },
  btn: { backgroundColor: colors.navy, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  switch: { color: colors.accent, textAlign: 'center', marginTop: 16, fontWeight: '600' },
  err: { color: colors.red, marginBottom: 6 },
  ok: { color: colors.green, marginBottom: 6 },
})
