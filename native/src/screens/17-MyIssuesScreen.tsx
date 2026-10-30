import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ApiError, Issue, IssueDetail, PublicIssue, confirmIssue, getIssueDetail, getMyIssues } from '../api'
import { HAZARD_LABEL, STATUS_META, colors } from '../theme'
import { fmtDate } from '../fmt'

export function MyIssuesScreen() {
  const [issues, setIssues] = useState<(Issue | PublicIssue)[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [voteMsg, setVoteMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setErr(null)
    getMyIssues().then((r) => setIssues(r.issues)).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])
  useEffect(() => { load() }, [load])

  // UI-test hook: auto-open the first issue detail (mock mode + ?detail=1)
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_MOCK_AUTH === '1' && typeof window !== 'undefined' && window.location.search.includes('detail=1') && issues?.length && !detail) {
      openDetail(issues[0].id)
    }
  }, [issues])

  const openDetail = (id: string) => {
    setDetail(null); setVoteMsg(null)
    getIssueDetail(id).then(setDetail).catch((e) => setErr(e instanceof ApiError ? `${e.message} (${e.code})` : String(e)))
  }

  const vote = async (isFixed: boolean) => {
    if (!detail) return
    try {
      const r = await confirmIssue(detail.id, isFixed)
      setVoteMsg(`Vote recorded. Status now: ${STATUS_META[r.status]?.label ?? r.status}.`)
      getIssueDetail(detail.id).then(setDetail).catch(() => {})
      load()
    } catch (e) {
      setVoteMsg(e instanceof ApiError ? `${e.message} (${e.code})` : String(e))
    }
  }

  if (detail) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.pad}>
        <Pressable onPress={() => setDetail(null)}><Text style={s.back}>{'< My reports'}</Text></Pressable>
        <Text style={s.title}>{HAZARD_LABEL[detail.hazard] ?? detail.hazard}</Text>
        <Text style={s.sub}>{detail.ward ? `Ward ${detail.ward}` : 'Ward not set'} · {STATUS_META[detail.status]?.label ?? detail.status}</Text>
        {detail.status === 'awaiting_confirmation' ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>IS IT FIXED?</Text>
            <Text style={s.cardSub}>The assigned party submitted a repair. You reported this - your confirmation counts (2 confirmations close an issue, 2 rejections reopen it).</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable style={[s.btn, { backgroundColor: colors.green, flex: 1 }]} onPress={() => vote(true)}><Text style={s.btnText}>Yes, fixed</Text></Pressable>
              <Pressable style={[s.btn, { backgroundColor: colors.red, flex: 1 }]} onPress={() => vote(false)}><Text style={s.btnText}>Not fixed</Text></Pressable>
            </View>
          </View>
        ) : null}
        {voteMsg ? <Text style={s.sub}>{voteMsg}</Text> : null}
        <Text style={s.label}>AUDIT TRAIL</Text>
        {detail.events.length === 0 ? <Text style={s.cardSub}>No events yet.</Text> : detail.events.map((e) => (
          <View key={e.id} style={s.card}>
            <Text style={s.cardValue}>{e.kind}{e.from_status || e.to_status ? ` (${e.from_status ?? '-'} to ${e.to_status ?? '-'})` : ''}</Text>
            {e.reason ? <Text style={s.cardSub}>{e.reason}</Text> : null}
            <Text style={s.cardSub}>{fmtDate(e.created_at)}{e.system ? ' · system' : ''}</Text>
          </View>
        ))}
        <Text style={s.label}>PHOTOS</Text>
        {detail.evidence.length === 0 ? <Text style={s.cardSub}>No photos attached yet.</Text> : detail.evidence.map((ev) => (
          <View key={ev.id} style={s.card}>
            <Text style={s.cardValue}>{ev.kind} photo {ev.location_ok ? '' : '(location mismatch)'}</Text>
            <Text style={s.cardSub}>{fmtDate(ev.created_at)}</Text>
          </View>
        ))}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setRefreshing(false) }} />}>
      <Text style={s.title}>My reports</Text>
      <Text style={s.sub}>Issues you reported or confirmed, with their full audit trail.</Text>
      {err ? <Text style={s.err}>{err}</Text> : null}
      {!issues && !err ? <ActivityIndicator color={colors.navy} /> : null}
      {issues?.length === 0 ? <Text style={s.cardSub}>Nothing yet. Your first report earns the First Report badge.</Text> : null}
      {issues?.map((i) => (
        <Pressable key={i.id} style={s.card} onPress={() => openDetail(i.id)}>
          <Text style={s.cardValue}>{HAZARD_LABEL[i.hazard] ?? i.hazard}</Text>
          <Text style={s.cardSub}>{i.ward ? `Ward ${i.ward}` : 'Ward not set'} · {STATUS_META[i.status]?.label ?? i.status} · {i.reports_count} report{i.reports_count === 1 ? '' : 's'}</Text>
          <Text style={s.cardSub}>{fmtDate(i.created_at)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  pad: { padding: 20, paddingBottom: 60 },
  back: { color: colors.accent, fontWeight: '700', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 8 },
  label: { color: colors.muted, letterSpacing: 2, fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardLabel: { color: colors.muted, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  cardValue: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 2 },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  btn: { borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  err: { color: colors.red, marginTop: 10 },
})
