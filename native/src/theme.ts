// Design direction: sky + navy + orange (see product plan, Design route).
export const colors = {
  paper: '#f6f5f0',
  card: '#ffffff',
  ink: '#17130e',
  muted: '#6b675f',
  line: '#e5e1d8',
  navy: '#0e1b2c',
  accent: '#f4571f',
  sky: '#7fb3e0',
  green: '#16a34a',
  amber: '#b45309',
  red: '#dc2626',
}
export const STATUS_META: Record<string, { label: string; color: string }> = {
  reported: { label: 'Reported', color: '#b45309' },
  verified: { label: 'Verified', color: '#6d28d9' },
  assigned: { label: 'Assigned', color: '#1d4ed8' },
  in_progress: { label: 'Repair in progress', color: '#4338ca' },
  awaiting_confirmation: { label: 'Fix submitted', color: '#f4571f' },
  fixed: { label: 'Fixed', color: '#16a34a' },
  reopened: { label: 'Reopened', color: '#dc2626' },
  rejected: { label: 'Rejected', color: '#6b7280' },
}
export const HAZARD_LABEL: Record<string, string> = {
  pothole: 'Pothole', crack: 'Crack', waterlogging: 'Waterlogging',
  broken_edge: 'Broken edge', missing_cover: 'Missing cover', other: 'Other',
}
