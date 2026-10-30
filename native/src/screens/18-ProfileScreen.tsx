import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Me, getBadges, getMe, patchMe } from '../api'
import { supabase } from '../supabase'
import { colors } from '../theme'

export function ProfileScreen() {
  const [me, setMe] = useState<Me | null>(null)
  const [badges, setBadges] = useState<{ badge: string; earned: boolean }[] | null>(null)
  const [progress, setProgress] = useState<{ reports: number; fix_confirmations: number } | null>(null)
  const [alias, setAlias] = useState('')
  const [ward, setWard] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getMe().then((m) => { setMe(m); setAlias(m.alias ?? ''); setWard(m.ward ?? '') }).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
    getBadges().then((b) => { setBadges(b.badges); setProgress(b.progress) }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setMsg(null); setErr(null)
    try {
      await patchMe({ alias: alias.trim() || undefined, ward: ward.trim() || undefined })
      setMsg('Saved. Your alias is what shows on the leaderboard - never your email or real name.')
      load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.pad}>
      <Text style={s.title}>Profile</Text>
      {!me && !err ? <ActivityIndicator color={colors.navy} /> : null}
      {err ? <Text style={s.err}>{err}</Text> : null}
      {me ? (
        <>
          <View style={s.card}>
            <Text style={s.cardLabel}>POINTS</Text>
            <Text style={s.points}>{me.points}</Text>
            <Text style={s.cardSub}>+10 per report, +5 per merge confirmation, +5 per fix vote (per server rules; daily caps apply)</Text>
          </View>
          <Text style={s.label}>ALIAS (PUBLIC)</Text>
          <TextInput style={s.input} value={alias} onChangeText={setAlias} placeholder="Pick an alias for the leaderboard" placeholderTextColor={colors.muted} />
          <Text style={s.label}>HOME WARD</Text>
          <TextInput style={s.input} value={ward} onChangeText={setWard} placeholder="e.g. W-12" placeholderTextColor={colors.muted} autoCapitalize="characters" />
          {msg ? <Text style={s.ok}>{msg}</Text> : null}
          <Pressable style={s.btn} onPress={save}><Text style={s.btnText}>Save</Text></Pressable>
        </>
      ) : null}
      <Text style={s.label}>BADGES</Text>
      {!badges ? <ActivityIndicator color={colors.navy} /> : badges.map((b) => (
        <View key={b.badge} style={[s.card, !b.earned && { opacity: 0.55 }]}>
          <Text style={s.cardValue}>{b.badge}{b.earned ? ' - earned' : ''}</Text>
        </View>
      ))}
      {progress ? <Text style={s.cardSub}>Progress: {progress.reports} reports, {progress.fix_confirmations} fix confirmations.</Text> : null}
      <Pressable style={[s.btn, { backgroundColor: colors.red, marginTop: 24 }]} onPress={() => supabase.auth.signOut()}>
        <Text style={s.btnText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  pad: { padding: 20, paddingBottom: 60 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', marginBottom: 10 },
  label: { color: colors.muted, letterSpacing: 2, fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardLabel: { color: colors.muted, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  cardValue: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 2 },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  points: { color: colors.navy, fontSize: 32, fontWeight: '800' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.ink },
  btn: { backgroundColor: colors.navy, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  err: { color: colors.red, marginTop: 10 },
  ok: { color: colors.green, marginTop: 8 },
})
