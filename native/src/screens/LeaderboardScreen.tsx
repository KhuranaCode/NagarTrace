import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getLeaderboard } from '../api'
import { colors } from '../theme'

export function LeaderboardScreen() {
  const [period, setPeriod] = useState<'weekly' | 'all'>('weekly')
  const [rows, setRows] = useState<{ alias: string | null; ward: string | null; points: number }[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null); setRows(null)
    getLeaderboard(period).then((r) => setRows(r.leaderboard)).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [period])
  useEffect(() => { load() }, [load])

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.pad}>
      <Text style={s.title}>Leaderboard</Text>
      <Text style={s.sub}>Only chosen aliases are shown. Emails and account details stay private.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {(['weekly', 'all'] as const).map((p) => (
          <Pressable key={p} style={[s.chip, period === p && s.chipOn]} onPress={() => setPeriod(p)}>
            <Text style={[s.chipText, period === p && s.chipTextOn]}>{p === 'weekly' ? 'This week' : 'All time'}</Text>
          </Pressable>
        ))}
      </View>
      {err ? <Text style={s.err}>{err}</Text> : null}
      {!rows && !err ? <ActivityIndicator color={colors.navy} /> : null}
      {rows?.length === 0 ? <Text style={s.cardSub}>No points yet in this period.</Text> : null}
      {rows?.map((r, idx) => (
        <View key={idx} style={s.card}>
          <Text style={s.rank}>{idx + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardValue}>{r.alias ?? 'Unnamed citizen'}</Text>
            <Text style={s.cardSub}>{r.ward ? `Ward ${r.ward}` : 'Ward not set'}</Text>
          </View>
          <Text style={s.points}>{r.points} pts</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  pad: { padding: 20, paddingBottom: 60 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { color: colors.accent, fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center' },
  cardValue: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  cardSub: { color: colors.muted, fontSize: 12 },
  points: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  err: { color: colors.red, marginTop: 10 },
})
