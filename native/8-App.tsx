import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native'
import { fetchPublicIssues, type PublicIssue } from './src/api'
import { colors, HAZARD_LABEL, STATUS_META } from './src/theme'
import { fmtDate } from './src/fmt'
import { AuthScreen, useSession } from './src/auth'
import { ReportScreen } from './src/screens/ReportScreen'
import { MyIssuesScreen } from './src/screens/MyIssuesScreen'
import { MapScreen } from './src/screens/MapScreen'
import { LeaderboardScreen } from './src/screens/LeaderboardScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: colors.muted }
  return (
    <View style={[styles.pill, { borderColor: m.color }]}>
      <View style={[styles.pillDot, { backgroundColor: m.color }]} />
      <Text style={[styles.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  )
}

function IssueCard({ issue, onPress }: { issue: PublicIssue; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{HAZARD_LABEL[issue.hazard] ?? issue.hazard}</Text>
        <StatusPill status={issue.status} />
      </View>
      <Text style={styles.cardMeta}>
        {issue.ward ? `Ward ${issue.ward}` : 'Ward not set'}
        {` - ${issue.reports_count} ${issue.reports_count === 1 ? 'report' : 'reports'}`}
      </Text>
      {issue.responsible ? (
        <Text style={styles.cardMeta}>
          {issue.responsible.name}
          {issue.responsible.synthetic_data ? ' (sample record)' : ''}
        </Text>
      ) : (
        <Text style={styles.cardMeta}>Not assigned yet</Text>
      )}
    </Pressable>
  )
}

function Detail({ issue, onBack }: { issue: PublicIssue; onBack: () => void }) {
  const st = STATUS_META[issue.status] ?? { label: issue.status, color: colors.muted }
  return (
    <ScrollView contentContainerStyle={styles.detailWrap}>
      <Pressable onPress={onBack}><Text style={styles.back}>{'< All issues'}</Text></Pressable>
      <Text style={styles.detailEyebrow}>{issue.ward ? `WARD ${issue.ward}` : 'WARD NOT SET'}</Text>
      <Text style={styles.detailTitle}>{HAZARD_LABEL[issue.hazard] ?? issue.hazard}</Text>
      <StatusPill status={issue.status} />
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>STATUS</Text>
        <Text style={styles.detailValue}>{st.label}</Text>
      </View>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>RESPONSIBLE</Text>
        <Text style={styles.detailValue}>
          {issue.responsible
            ? `${issue.responsible.name} (${issue.responsible.kind})${issue.responsible.synthetic_data ? ' - sample record' : ''}`
            : 'Not assigned yet'}
        </Text>
      </View>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>DEADLINE (IST)</Text>
        <Text style={styles.detailValue}>
          {issue.deadline_at ? fmtDate(issue.deadline_at) : 'Not set'}
        </Text>
      </View>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>REPORTS</Text>
        <Text style={styles.detailValue}>{String(issue.reports_count)}</Text>
      </View>
      <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>REPORTED (IST)</Text>
        <Text style={styles.detailValue}>{fmtDate(issue.created_at)}</Text>
      </View>
      <Text style={styles.detailNote}>
        Public record. Approximate location only; photos are never public.
      </Text>
    </ScrollView>
  )
}

function HomeScreen() {
  const [issues, setIssues] = useState<PublicIssue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PublicIssue | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    setError(null)
    fetchPublicIssues()
      .then((r) => setIssues(r.issues))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPublicIssues()
      .then((r) => { setIssues(r.issues); setError(null) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRefreshing(false))
  }, [])

  if (selected) return <Detail issue={selected} onBack={() => setSelected(null)} />

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>NAGARTRACE</Text>
        <Text style={styles.title}>Live issues</Text>
        <Text style={styles.sub}>
          Public road-hazard record. Every entry shows who is responsible and whether the fix is confirmed.
        </Text>
        <View style={styles.testBanner}>
          <Text style={styles.testBannerText}>Test server (policy PROVISIONAL). Nothing here is a verified real-world report; the backend hides its synthetic samples from public lists, so this list can be empty. Sample records are marked only where the data itself says so.</Text>
        </View>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : null}
      {!issues && !error ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.muted}>Loading live issues.</Text></View>
      ) : null}
      {issues && issues.length === 0 ? (
        <View style={styles.center}><Text style={styles.muted}>No public issues yet.</Text></View>
      ) : null}
      {issues && issues.length > 0 ? (
        <FlatList
          data={issues}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <IssueCard issue={item} onPress={() => setSelected(item)} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        />
      ) : null}
    </>
  )
}

type Tab = 'home' | 'map' | 'report' | 'mine' | 'board' | 'profile'
const TABS: { key: Tab; label: string; needsAuth: boolean }[] = [
  { key: 'home', label: 'Home', needsAuth: false },
  { key: 'map', label: 'Map', needsAuth: false },
  { key: 'report', label: 'Report', needsAuth: true },
  { key: 'mine', label: 'My reports', needsAuth: true },
  { key: 'board', label: 'Board', needsAuth: false },
  { key: 'profile', label: 'Profile', needsAuth: true },
]

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('tab')
      if (q && TABS.some((t) => t.key === q)) return q as Tab
    }
    return 'home'
  })
  const { session, ready } = useSession()

  const renderTab = () => {
    const def = TABS.find((t) => t.key === tab)!
    if (def.needsAuth && !session) {
      if (!ready) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      return <AuthScreen />
    }
    switch (tab) {
      case 'home': return <HomeScreen />
      case 'map': return <MapScreen />
      case 'report': return <ReportScreen />
      case 'mine': return <MyIssuesScreen />
      case 'board': return <LeaderboardScreen />
      case 'profile': return <ProfileScreen />
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>{renderTab()}</View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 3, color: colors.muted, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginTop: 4 },
  testBanner: { backgroundColor: '#fff4e5', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 },
  testBannerText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: 6, lineHeight: 19 },
  center: { alignItems: 'center', marginTop: 60, gap: 12 },
  muted: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.line, gap: 6,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardMeta: { fontSize: 13, color: colors.muted },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11.5, fontWeight: '600' },
  errorBox: {
    margin: 16, padding: 14, borderRadius: 12, backgroundColor: '#fdecea',
    borderWidth: 1, borderColor: '#f3c1bb', gap: 10,
  },
  errorText: { color: colors.red, fontSize: 14 },
  retryBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.red,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
  },
  retryText: { color: colors.red, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  detailWrap: { padding: 20, gap: 14 },
  back: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  detailEyebrow: { fontSize: 11, letterSpacing: 3, color: colors.muted, fontWeight: '600' },
  detailTitle: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  detailBlock: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.line, gap: 3,
  },
  detailLabel: { fontSize: 11, letterSpacing: 2, color: colors.muted, fontWeight: '600' },
  detailValue: { fontSize: 15.5, color: colors.ink, fontWeight: '600' },
  detailNote: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 6 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
  tabLabelOn: { color: colors.accent, fontWeight: '800' },
})
