# NagarTrace

Independently runnable React + TypeScript road-hazard accountability prototype.

## Run
Requires Node.js 22.12+.

```sh
npm ci
npm run dev
npm run build
npm test
```

The expanded application source is under `src/src/`. `index.html` points to its entrypoint. Photos are bundled as typed data-URL modules so the app needs no external image host. The root source-part files and restore.mjs are a recoverable backup of the earlier prototype, not needed to run this current checkout.

GitHub Pages builds with `/NagarTrace/` as its base. Hash routes such as `#/report` support direct links and refreshes on static hosting. The Pages workflow tests, builds and deploys `dist/`.

## Working
Responsive landing, coloured full hazard gallery, supplied photos, mobile dialog menu, perspective scroll stack, role slider, issue desk/filter/search, 20 synthetic registry records, intake -> simulated officer review -> preview -> explicit finalisation. Routing/deadline/state-machine rules have 19 tests.

## Limits
Development demo only. Roads, companies, warranties and citizen roles are fictional. No real complaint sent. No backend, authority integration, authentication, real repair evidence, exact-pin duplicate detection, live maps, immutable audit or notifications. Browser-local state is not shared. Intake and photo/GPS previews are temporary. Same-road/hazard merging demonstrates a rule, not production incident matching.

## Images and design
Supplied photos are illustrative reference images, not verified cases, endorsements or repair evidence. Location/date remain unverified. The owner approved public publication of the demo source and website images. Source includes compressed copies; originals remain unchanged privately.

Design direction: https://nova-dental-dev.webflow.io/ . No reference-site code, fonts or assets copied. PRD attribution: Manan Bharti.
