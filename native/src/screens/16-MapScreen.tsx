import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'

// WebView on native; on web preview an iframe renders the same HTML.
let MapFrame: React.ComponentType<{ html: string }>
if (Platform.OS === 'web') {
  const { createElement } = require('react-native-web')
  MapFrame = ({ html }: { html: string }) =>
    createElement('iframe', { srcDoc: html, style: { border: 'none', width: '100%', height: '100%', flex: 1 } })
} else {
  const { WebView } = require('react-native-webview')
  MapFrame = ({ html }: { html: string }) => <WebView style={{ flex: 1 }} source={{ html }} originWhitelist={['*']} />
}
import { fetchPublicIssues, PublicIssue } from '../api'
import { HAZARD_LABEL, STATUS_META, colors } from '../theme'

// Real OpenStreetMap tiles via Leaflet inside a WebView (works on device and web preview).
// Marker data comes from the live public API. Map tiles credit OpenStreetMap contributors.
function mapHtml(issues: PublicIssue[]) {
  const markers = issues.map((i) => ({
    lat: i.location.lat, lon: i.location.lon,
    label: `${HAZARD_LABEL[i.hazard] ?? i.hazard} - ${STATUS_META[i.status]?.label ?? i.status}`,
    fixed: i.status === 'fixed',
  }))
  const center = markers.length ? [markers[0].lat, markers[0].lon] : [22.5, 79.5]
  const zoom = markers.length ? 13 : 5
  return `<!doctype html><html><head><meta name="viewport" content="initial-scale=1,width=device-width">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{margin:0;height:100%}</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([${center[0]}, ${center[1]}], ${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const markers = ${JSON.stringify(markers)};
let bounds = [];
for (const m of markers) {
  const c = L.circleMarker([m.lat, m.lon], { radius: 8, color: m.fixed ? '#16a34a' : '#f4571f', weight: 2, fillColor: m.fixed ? '#16a34a' : '#f4571f', fillOpacity: 0.7 }).addTo(map);
  c.bindPopup(m.label);
  bounds.push([m.lat, m.lon]);
}
if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
</script></body></html>`
}

export function MapScreen() {
  const [issues, setIssues] = useState<PublicIssue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetchPublicIssues().then((r) => setIssues(r.issues)).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])
  return (
    <View style={s.wrap}>
      <View style={s.banner}><Text style={s.bannerText}>Test server (policy PROVISIONAL) - points are not verified real reports; the backend hides synthetic samples from public lists, so the map can be empty. Orange = open, green = fixed.</Text></View>
      {err ? <Text style={s.err}>{err}</Text> : null}
      {!issues && !err ? <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} /> : null}
      {issues ? <MapFrame html={mapHtml(issues)} /> : null}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper },
  banner: { backgroundColor: '#fff4e5', borderBottomWidth: 1, borderColor: '#f59e0b', padding: 8 },
  bannerText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  err: { color: colors.red, padding: 16 },
})
