import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import * as Crypto from 'expo-crypto'
import { ApiError, Hazard, ReportResult, postReport, uploadEvidence } from '../api'
import { HAZARD_LABEL, colors } from '../theme'

type Fix = { lat: number; lon: number; accuracy: number | null }

export function ReportScreen() {
  const [fix, setFix] = useState<Fix | null>(null)
  const [hazard, setHazard] = useState<Hazard>('pothole')
  const [danger, setDanger] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [photoState, setPhotoState] = useState<string | null>(null)

  // UI-test hook: auto-acquire the mock fix on mount (mock mode + ?fix=1)
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_MOCK_AUTH === '1' && typeof window !== 'undefined' && window.location.search.includes('fix=1')) {
      setFix({ lat: 28.4595, lon: 77.0266, accuracy: 8 })
    }
  }, [])

  const locate = async () => {
    setBusy(true); setErr(null)
    try {
      // UI-test hook: fixed GPS under mock mode only (EXPO_PUBLIC_MOCK_AUTH=1 + ?fix=1)
      if (process.env.EXPO_PUBLIC_MOCK_AUTH === '1' && typeof window !== 'undefined' && window.location.search.includes('fix=1')) {
        setFix({ lat: 28.4595, lon: 77.0266, accuracy: 8 })
        return
      }
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) throw new Error('Location permission denied. NagarTrace needs GPS to place the report on a road.')
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setFix({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const submit = async () => {
    if (!fix) { setErr('Get your GPS position first.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await postReport({
        lat: fix.lat, lon: fix.lon,
        accuracy_m: fix.accuracy ?? undefined,
        hazard, danger, note: note.trim() || undefined,
        captured_at: new Date().toISOString(),
      }, Crypto.randomUUID())
      setResult(r)
    } catch (e) {
      if (e instanceof ApiError) {
        const known: Record<string, string> = {
          stale_report: 'This report looked older than 15 minutes. Retake it at the spot.',
          poor_gps: 'GPS accuracy too low. Move into the open and try again.',
          already_reported: 'You already reported this hazard.',
          daily_cap: 'Daily report limit reached. Try again tomorrow.',
        }
        setErr(known[e.code] ?? `${e.message} (${e.code})`)
      } else setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const addPhoto = async () => {
    if (!result || !fix) return
    setBusy(true); setPhotoState(null)
    try {
      const opts: ImagePicker.ImagePickerOptions = { quality: 0.8, mediaTypes: ['images'] }
      const shot = Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync(opts)
        : await ImagePicker.launchCameraAsync(opts)
      if (shot.canceled || !shot.assets[0]) { setBusy(false); return }
      const a = shot.assets[0]
      const mime = a.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(a.mimeType) ? a.mimeType : 'image/jpeg'
      const up = await uploadEvidence(result.issue.id, 'report', fix.lat, fix.lon, a.uri, mime)
      setPhotoState(up.location_ok ? 'Photo attached to the report. It stays private to participants.' : 'Photo attached, but its location did not match the report spot (flagged for review).')
    } catch (e) {
      setPhotoState(e instanceof ApiError ? `Photo upload failed: ${e.message} (${e.code})` : `Photo upload failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const reset = () => { setResult(null); setPhotoState(null); setNote(''); setDanger(false) }

  if (result) {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.pad}>
        <Text style={s.title}>{result.replayed ? 'Already submitted' : result.merged_into_existing ? 'Matched an existing issue' : 'Report submitted'}</Text>
        <Text style={s.sub}>
          {result.replayed ? 'This exact report was already received (idempotent retry-safe).'
            : result.merged_into_existing ? 'Another report of the same hazard exists within ~30 m, so yours was merged in as an extra confirmation. More reporters = more weight.'
            : 'Your report is on the record. Routing to the responsible party follows the registry rules.'}
        </Text>
        <View style={s.card}>
          <Text style={s.cardLabel}>STATUS</Text>
          <Text style={s.cardValue}>{result.issue.status}</Text>
        </View>
        {result.issue.route_flags?.length ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>ROUTING FLAGS</Text>
            <Text style={s.cardValue}>{result.issue.route_flags.join(', ')}</Text>
          </View>
        ) : null}
        {photoState ? <Text style={s.photoMsg}>{photoState}</Text> : null}
        {!photoState || photoState.startsWith('Photo upload failed') ? (
          <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={addPhoto}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{Platform.OS === 'web' ? 'Attach a photo' : 'Take a photo of the hazard'}</Text>}
          </Pressable>
        ) : null}
        <Pressable onPress={reset}><Text style={s.switch}>Report another hazard</Text></Pressable>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.pad}>
      <Text style={s.title}>Report a hazard</Text>
      <Text style={s.sub}>Stand at the spot. GPS and time are checked for plausibility; reports within ~30 m of an existing issue merge as confirmations.</Text>

      <Text style={s.label}>1. LOCATION</Text>
      {fix ? (
        <View style={s.card}>
          <Text style={s.cardValue}>{fix.lat.toFixed(5)}, {fix.lon.toFixed(5)}</Text>
          <Text style={s.cardSub}>{fix.accuracy ? `GPS accuracy about ${Math.round(fix.accuracy)} m` : 'Accuracy unknown'}</Text>
        </View>
      ) : null}
      <Pressable style={[s.btnGhost, busy && { opacity: 0.6 }]} disabled={busy} onPress={locate}>
        <Text style={s.btnGhostText}>{fix ? 'Refresh GPS position' : 'Get my GPS position'}</Text>
      </Pressable>

      <Text style={s.label}>2. WHAT IS IT?</Text>
      <View style={s.chips}>
        {(Object.keys(HAZARD_LABEL) as Hazard[]).map((h) => (
          <Pressable key={h} style={[s.chip, hazard === h && s.chipOn]} onPress={() => setHazard(h)}>
            <Text style={[s.chipText, hazard === h && s.chipTextOn]}>{HAZARD_LABEL[h]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>3. DETAILS</Text>
      <Pressable style={[s.chip, danger && s.chipDanger]} onPress={() => setDanger(!danger)}>
        <Text style={[s.chipText, danger && { color: '#fff' }]}>{danger ? 'Dangerous to traffic - marked' : 'Mark as dangerous to traffic'}</Text>
      </Pressable>
      <TextInput style={s.input} placeholder="Short note (optional) - landmark, lane, size" placeholderTextColor={colors.muted} value={note} onChangeText={setNote} multiline />

      {err ? <Text style={s.err}>{err}</Text> : null}
      <Pressable style={[s.btn, (!fix || busy) && { opacity: 0.6 }]} disabled={!fix || busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Submit report</Text>}
      </Pressable>
      <Text style={s.fine}>You can attach a photo after submitting. Photos stay private to participants - they are never public.</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  pad: { padding: 20, paddingBottom: 60 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14, marginTop: 8, marginBottom: 8 },
  label: { color: colors.muted, letterSpacing: 2, fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardLabel: { color: colors.muted, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  cardValue: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 2 },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 4 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipDanger: { backgroundColor: colors.red, borderColor: colors.red },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, fontSize: 15, color: colors.ink, marginTop: 10, minHeight: 48 },
  btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost: { borderWidth: 1, borderColor: colors.navy, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnGhostText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  switch: { color: colors.accent, textAlign: 'center', marginTop: 16, fontWeight: '600' },
  err: { color: colors.red, marginTop: 10 },
  fine: { color: colors.muted, fontSize: 12, marginTop: 12 },
  photoMsg: { color: colors.navy, fontSize: 14, marginTop: 10 },
})
