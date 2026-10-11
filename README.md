# RouteLab delivery route planner

React 19 + TypeScript + Vite + Leaflet. No external fonts, API keys, paid services, or paid tiers. The geographic workspace uses free community services by default; all map/search/routing providers can be self-hosted. See [geographic routing](../backend/docs/GEOGRAPHIC_ROUTING.md).

## Develop

Start the backend on 127.0.0.1:8000, then:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies API, event streams, health, and API docs locally. Set `ROUTELAB_API_TARGET` to change the development proxy target. For a separate API origin, set `VITE_API_URL` before building and configure the backend's allowed origins.

Place search suggests addresses after a short typing pause, prioritizes the current map area, and supports mouse or keyboard selection. Selecting a suggestion centers the map; use the depot or delivery action to add it to the route.

Netlify uses `netlify.toml` to run the full frontend check, publish `dist`, and serve the single-page app with security and asset-cache headers. Set `VITE_API_URL` in the Netlify build environment to the backend URL; `.env.example` documents the value. The app remains a shared workspace without sign-in.

## Build checks

```sh
npm run check
npm run format:lab
```

The first command runs interaction tests, TypeScript checks, ESLint, and the production build. `npm audit --audit-level=low` checks installed dependencies. Stop the dev server before `npm ci` on Windows to release native-module file locks.

## Source boundaries

The interface uses minimal neo-brutalism: bold system typography, black borders, hard shadows, lime primary actions, and lavender controls. Plan, Compare, and History navigation keeps the primary tasks visible. The four-step Places/Fleet/Constraints/Solve panel sits beside the map and opens with Route settings on smaller screens. Dense tables, import tools, solver settings, and reproduction data use expandable sections. Shared route colors link maps, schedules, and analysis.

- `src/main.jsx` mounts `src/lab/RouteLab.tsx`.
- `types.ts` and `api.ts`: contracts, requests, uploads, exports.
- `PlaceSearch.tsx`: debounced suggestions, viewport relevance, cancellation, keyboard selection.
- `GeographicMap.tsx`: lazy-loaded Leaflet, safe text labels, editable stops, road geometry, provider disclosure.
- `WorkflowControls.tsx`: the four-step planning workflow and secondary scenario/benchmark library.
- `RouteCanvas.tsx`: fully offline schematic routes, focus, stop inspection.
- `ResultViews.tsx`: schedules, convergence, comparisons, candidate-move checking, provenance.
- `StopEditor.tsx`: names, coordinates, capacity demand, service, windows.
- `TimeField.tsx`: time pickers with optional day selection, stored as minutes for the API.
- `lab.css` and `geography.css`: responsive neo-brutalist styling.

Scenario drafts live in browser storage; saved snapshots and jobs live in the backend SQLite notebook. Editing a draft never mutates a saved run. Road drafts freeze a directed matrix before job submission; a failed road request never silently becomes a straight-line solve. Search replay is explicitly schematic; final road geometry must agree with each matrix leg. Imported/frozen matrices lock coordinate and membership editing until deliberately detached.

Leaflet is the only mapping runtime, used directly without an additional React wrapper.

See the backend's `docs/RELEASE_AUDIT.md` for test evidence and unresolved container verification. Saved routes and job history are shared by all visitors.

ALNS-specific iteration, removal, adaptation, and local-improvement controls are shown only for ALNS. Other methods retain the seed and time cap that they actually consume. Exact reference is limited to eight deliveries. History labels delay repair as onboard sequence repair.
