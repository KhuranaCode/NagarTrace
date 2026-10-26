# NagarTrace

Private, independently runnable React + TypeScript road-hazard accountability prototype.

## Run
Requires Node.js 22.12+.

```sh
npm ci
npm run dev
npm run build
npm test
```

The expanded application source is under `src/src/`. `index.html` points to its entrypoint. Photos are bundled as typed data-URL modules so the app needs no external image host. The root source-part files and restore.mjs are a recoverable backup of the earlier prototype, not needed to run this current checkout.

Production servers must rewrite `/desk`, `/report`, `/registry`, `/about` to `index.html`.

## Working
Responsive landing, coloured full hazard gallery, supplied photos, mobile dialog menu, perspective scroll stack, role slider, issue desk/filter/search, 20 synthetic registry records, intake -> simulated officer review -> preview -> explicit finalisation. Routing/deadline/state-machine rules have 19 tests.

## Limits
Development demo only. Roads, companies, warranties and citizen roles are fictional. No real complaint sent. No backend, authority integration, authentication, real repair evidence, exact-pin duplicate detection, live maps, immutable audit or notifications. Browser-local state is not shared. Intake and photo/GPS previews are temporary. Same-road/hazard merging demonstrates a rule, not production incident matching.

## Images and design
Supplied photos are private reference images, not verified cases, endorsements or repair evidence. Location/date and public publication rights remain unverified. Source includes compressed copies; originals remain unchanged privately. Keep this repo private pending permission checks.

Design direction: https://nova-dental-dev.webflow.io/ . No reference-site code, fonts or assets copied. PRD attribution: Manan Bharti.
