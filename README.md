# Slugs

Self-hosted URL shortening platform with a built-in dashboard, multi-domain workspaces, team permissions, analytics, and a REST API.

## Features

- **Short URLs** with optional custom shortcode, notes, tags, teams, expiration, hit limits, and UTM templates
- **Multi-domain** in a single deployment (each domain maps to an organization/workspace)
- **Authentication & access control** via Better-Auth organizations + roles + API keys
- **Teams** inside an organization, with per-team policy enforcement (create/read/update/delete)
- **Metrics** collected on redirect (browser/device/os/language/referrer/geo/UTMs + internal vs external)
- **Integrations**
  - **Umami** (server-side event tracking)
  - **VirusTotal API** (domain validation / blacklist enforcement)
- **API Reference UI** with Scalar, serving both Slugs + Better-Auth schemas
- **Theme override** via a single `custom.css` file (CSS variables → Tailwind tokens)

## Architecture (high level)

### Multi-domain = Organizations

Slugs is multi-domain without running multiple instances.

- You configure a list of `hosts` in `settings.yaml`
- Each `host.origin` maps to an organization id: `slugify(origin)`
- At request time, Slugs resolves the current host from `event.url.origin`
- The resolved host selects:
  - the active organization
  - the Better-Auth instance (cached per host)
  - per-host options (signup, 2FA, homepage, limits, lowercase fallback, integrations, etc.)

### Request-time enforcement

On authenticated requests, if there is no `activeOrganizationId`, Slugs sets it to the organization derived from the current host.  
If the user is not a member of that organization, access is denied (invitation flow is checked).

## Installation

### Requirements

- Node.js 22+ for production-like runs
- Bun for install/build/dev scripts used by this project
- Postgres database
- Docker or Docker Compose (recommended for deployment/local database)

### Environment

Start from the example file:

```sh
cp .env.example .env
```

Required values:

```env
DATABASE_URL=postgres://slugs:strong-password@localhost:5432/slugs
BETTER_AUTH_SECRET=change-this-to-a-long-random-value
SLUGS_ORIGIN=http://localhost:5173
```

`SLUGS_ORIGIN` is used for auth, emails, organization bootstrap, and generated links. In hosted environments it can reference platform variables, for example `https://$(PRIMARY_DOMAIN)`.

### Easypanel / Oracle Cloud

For Easypanel deploys, use runtime environment variables instead of editing domains or database URLs into the image.

Recommended minimum:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/database
SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)
SLUGS_APPNAME=$(PROJECT_NAME)
BETTER_AUTH_SECRET=troque-por-um-valor-longo-e-fixo
```

See [docs/easypanel-deploy.md](docs/easypanel-deploy.md) for the full deployment checklist, healthcheck notes, and crash-loop prevention behavior.

### Docker Compose (example)

```yaml
services:
  slugs:
    image: uraniadev/slugs:latest
    ports:
      - '1000:1000'
    environment:
      DATABASE_URL: 'postgres://slugs:slugs_password@db:5432/slugs'
      BETTER_AUTH_SECRET: 'change-me'
      SLUGS_ORIGIN: 'http://localhost:1000'
    volumes:
      - ./config:/app/config
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: slugs
      POSTGRES_PASSWORD: slugs_password
      POSTGRES_DB: slugs
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

The production image listens on port `1000` by default. If you deploy behind a reverse proxy, route external traffic to the container's `1000` port and set `SLUGS_ORIGIN` to the public HTTPS origin.

## Configuration

Slugs reads configuration from `config/settings.yaml`.

Minimal example:

```yaml
appname: Slugs

admin:
  - email: admin@example.org
    username: admin

hosts:
  - origin: 'https://slugs.li'
    options:
      customRedirect: '/dashboard'
smtp:
  enabled: false
  # this will log outbound emails
```

Runtime environment variables can override the first host and bootstrap admin without rebuilding the image. The most common overrides are:

- `SLUGS_APPNAME`
- `SLUGS_ORIGIN`
- `SLUGS_ADMIN_EMAIL`
- `SLUGS_ADMIN_USERNAME`
- `SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD`
- `SLUGS_BOOTSTRAP_ADMIN_RESET`
- `SLUGS_DISABLE_SIGNUP`
- `SLUGS_DISABLE_2FA`
- `SLUGS_DISABLE_HOMEPAGE`
- `SLUGS_DISABLE_LIMITS`
- `SLUGS_DISABLE_LOWER_CASE_FALLBACK`
- `SLUGS_CUSTOM_REDIRECT`
- `SLUGS_LIMIT_MAX_SLUGS_PER_USER`
- `SLUGS_LIMIT_REQUESTS_PER_DAY`
- `SLUGS_LIMIT_REQUESTS_PER_MINUTE`
- `SLUGS_SMTP_*`
- `SLUGS_MAXMIND_DB_PATH`
- `MAXMIND_LICENSE_KEY`

See `.env.example` and [docs/easypanel-deploy.md](docs/easypanel-deploy.md) for a deploy-oriented list.

### Bootstrap behavior

On startup, Slugs ensures:

- `admin` users exist (created if missing)
- an organization exists per configured host (`id = slugify(origin)`)
- admin users are members of every organization (as `owner`)
- organization roles (owner/admin/member) are materialized with stored permissions

## Team management & policies

Teams exist inside an organization and are used to scope sharing/visibility and enforcement.

### Roles vs teams

- **Roles**: `owner`, `admin`, `member`
- **Teams**: organization-defined groups (e.g. “Marketing”, “Support”)

### Policy enforcement

Permissions are stored per organization role and keyed by team id:

- `create`
- `read`
- `update`
- `delete`

Owners are not restricted by team policy (UI disables changing owner permissions).

When you toggle permissions in the UI, Slugs persists the permission graph and invalidates cached auth configuration so changes take effect immediately.

## Metrics

Slugs collects metrics during redirect resolution.

### What is collected

On a successful redirect (and when not blocked by secret checks), Slugs may store:

- timestamp
- browser / os / device / cpu
- language
- referrer
- geo (city / region / country) from IP (IPs are not saved)
- UTM payload attached to the URL
- **internal vs external** visit classification
  - internal/external is computed by comparing the metric’s organization id to the URL’s owning organization id

### Dashboard

The metrics dashboard supports:

- date range selection
- preset ranges (week / 2 weeks / month / 6 months / year)
- organization selection (admin-only cross-org view)
- UTM key filtering + per-key value filtering
- breakdowns (browsers, devices, OS, languages, referrers, countries, regions, cities, visitor organizations)

Country, region and city breakdowns require a MaxMind GeoLite2 City `.mmdb` file. Set `MAXMIND_LICENSE_KEY` to download it automatically on startup, set `SLUGS_MAXMIND_DB_PATH`, or place the file at `config/maxmind/geolite2-city.mmdb`. Without it, visits are still tracked and grouped as `Other`.

## Integrations

Integrations are configured **per host** (per domain).

### Umami

If enabled, Slugs sends server-side events to Umami:

- redirects
- “not found” shortcodes
- invalid login attempts
- DB unavailable alerts
- secret invalid attempts

Configured in Settings → Integrations or in `settings.yaml`:

```yaml
thirdparty:
  umami:
    url: 'https://umami.example.org'
    websiteId: 'your-website-id'
```

### VirusTotal API (VTAPI)

VTAPI is used to validate redirect targets and enforce blacklist rules (watchlist).

Configured in Settings → Integrations or in `settings.yaml`:

```yaml
thirdparty:
  vtapi:
    apikey: 'your-virustotal-api-key'
```

## API

### Main endpoints

- `GET /api` - readiness/health details, including database status
- `GET /api/live` - liveness check that does not depend on the database
- `GET /api/docs` - Scalar API reference UI
- `GET /api/openapi.json` - Slugs OpenAPI schema
- `GET /api/urls` / `POST /api/urls` - list and create short URLs
- `GET /api/urls/:id` / `PATCH /api/urls/:id` / `DELETE /api/urls/:id` - inspect, update, and delete a URL
- `GET /api/urls/:id/stat` - URL statistics
- `PUT|PATCH|DELETE /api/urls/:id/tag` - manage URL tags
- `PUT|PATCH|DELETE /api/urls/:id/teams` - manage URL team visibility
- `GET /api/tags` / `POST /api/tags` - list and create tags
- `GET /api/tags/:id` / `DELETE /api/tags/:id` - inspect and delete a tag
- `GET /api/metrics` - metrics dashboard data
- `POST /api/:shortcode` - API redirect lookup for a shortcode

### Scalar docs

The API reference is served with Scalar at:

- **[https://slugs.li/api/docs](https://slugs.li/api/docs)**

Scalar exposes **two schemas** from the same UI:

- Slugs OpenAPI (`/api/openapi.json`)
- Better-Auth OpenAPI (`/api/auth/open-api/generate-schema/`)

### Authentication

The REST API uses `Authorization: Bearer <api-key>` and verifies permissions scoped to the current host organization.

## Custom styling

Slugs supports runtime theme overrides via a single file:

- `config/custom.css` (mounted into the container)

It is served at:

- `/custom.css` (cached for 1 year)

The file is included at the end of the HTML document:

```html
<link rel="stylesheet" href="/custom.css" />
```

Recommended workflow:

1. Generate a theme (Shadcn theme generator, etc.)
2. Copy only `:root { ... }` and `.dark { ... }`
3. Paste into `config/custom.css`

This overrides the Tailwind-consumed CSS variables without changing component code or rebuilding the app.

## Development

Typical stack:

- SvelteKit (SSR)
- Postgres
- Drizzle ORM
- Better-Auth
- Scalar API Reference UI
- Bun for dependency install and development commands
- Node.js for the production runner (`scripts/start.mjs`)

Run a local database:

```sh
bun run db:start
```

The checked-in `compose.yaml` starts a Postgres instance on `localhost:5432` with:

```env
DATABASE_URL=postgres://root:mysecretpassword@localhost:5432/local
```

Then install dependencies and run the app:

```sh
bun install
cp .env.example .env
# edit DATABASE_URL, BETTER_AUTH_SECRET, and SLUGS_ORIGIN if needed
bun run dev
```

Useful commands:

```sh
bun run check
bun run lint
bun run build
bun run db:push
bun run db:generate
bun run db:migrate
bun run db:studio
```

For a production-like local run:

```sh
bun run build
npm install --omit=dev --legacy-peer-deps
node ./scripts/start.mjs
```

## License

See [LICENSE](./LICENSE.MD).

## Contributing

PRs welcome. Focus areas that matter most:

- correctness of permission enforcement
- redirect path robustness (secrets, blacklist, expiration, limits)
- metrics aggregation performance
- multi-domain safety (host resolution, org scoping)
- I18N Support validation

## About AI

Some validation and code optimizations were assisted by AI, but Slugs remains an artisanal project.
Most AI usage focused on generating documentation content and I18N translations.
