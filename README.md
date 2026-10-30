# NagarTrace

Road-hazard reporting and repair tracking. Citizens report a hazard with a location and photo. An officer verifies it. The responsible contractor or department repairs it. Citizens confirm the fix.

- App source: this repo (Vite + React + TypeScript). Hosted on GitHub Pages at https://khuranacode.github.io/NagarTrace/
- Backend API: https://github.com/KhuranaCode/nagartrace-api

## Status

Demo with synthetic data. The backend runs on a free tier and sleeps when idle, so the first load can take about a minute. Not an emergency service. No complaint is sent to any authority. AI detection, photo blur and notifications are not built. Photo location is claimed by the device and is not proof.

## Run locally

```
npm ci
npm run dev      # http://localhost:3000
npm run typecheck
npm run build
```

Public config (API URL, Supabase URL, publishable key) is in `src/config.ts`. No secrets belong in this repo.
