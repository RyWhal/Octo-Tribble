# Webhook Inspector — hooks.rjpw.space

A personal webhook inspection tool. Provides temporary public endpoints that capture and display incoming HTTP requests in full detail, enabling debugging and development of webhook integrations.

Single-user. No multi-tenancy. Auth via Cloudflare Access.

## Architecture

- **Hosting:** Cloudflare Pages (UI) + Cloudflare Workers (ingest + API)
- **Storage:** Cloudflare D1
- **Auth:** Cloudflare Access (Zero Trust) — bypassed only for `/in/*`
- **Domain:** `hooks.rjpw.space`

## Project Structure

```
hooks.rjpw.space/
├── worker/                     # Cloudflare Worker (ingest + API + cron)
│   ├── src/
│   │   ├── index.ts            # Main worker: routes ingest vs API
│   │   ├── ingest.ts           # Handles /in/{id}
│   │   ├── api.ts              # Handles /api/* CRUD
│   │   ├── cron.ts             # Scheduled cleanup
│   │   └── db.ts               # D1 helpers
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── ui/                         # React SPA (Cloudflare Pages)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── pages/
│   │   │   ├── EndpointList.tsx
│   │   │   └── EndpointDetail.tsx
│   │   ├── components/
│   │   │   ├── RequestCard.tsx
│   │   │   ├── CreateEndpointModal.tsx
│   │   │   ├── HeadersTable.tsx
│   │   │   ├── BodyViewer.tsx
│   │   │   └── CopyButton.tsx
│   │   └── utils/
│   │       ├── api.ts
│   │       └── time.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
└── schema.sql                  # D1 schema
```

## Setup

### 1. Create D1 database

```bash
wrangler d1 create hooks-inspector
```

Copy the `database_id` from the output and paste it into `worker/wrangler.toml`.

### 2. Apply schema

```bash
cd worker
npm run db:apply
```

### 3. Deploy the worker

```bash
cd worker
npm install
npm run deploy
```

### 4. Build and deploy the UI

```bash
cd ui
npm install
npm run build
# Deploy the dist/ directory to Cloudflare Pages
# (connect the repo in the Pages dashboard or use `wrangler pages deploy dist`)
```

### 5. Configure Cloudflare Access

- Create an Access policy for `hooks.rjpw.space` requiring authentication
- Add a **bypass rule** for path `/in/*` so ingest endpoints stay public

### 6. DNS

Add a CNAME record for `hooks` pointing at the Pages deployment.

## Local Development

```bash
# Terminal 1 — Worker
cd worker && npm run dev

# Terminal 2 — UI (proxies /api and /in to localhost:8787)
cd ui && npm run dev
```

## Route Map

| Route | Auth | Purpose |
|-------|------|---------|
| `* /in/{endpoint_id}` | None (public) | Ingest — captures requests |
| `GET /` | Cloudflare Access | Dashboard |
| `GET /endpoints/{id}` | Cloudflare Access | Detail view |
| `POST /api/endpoints` | Cloudflare Access | Create endpoint |
| `DELETE /api/endpoints/{id}` | Cloudflare Access | Delete endpoint |
| `PATCH /api/endpoints/{id}` | Cloudflare Access | Update endpoint |
| `DELETE /api/requests/{id}` | Cloudflare Access | Delete single request |

## Limits

- Max 20 active endpoints
- Max 500 stored requests per endpoint (FIFO eviction)
- Max body size: 256KB
- Default endpoint expiry: 48 hours
- Rate limit: 60 requests/minute per IP per endpoint (via Cloudflare rate limiting rules)
- Daily cron purges expired endpoints and their requests
