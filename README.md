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

- Postgres database
- Docker (recommended)

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
      - '3000:3000'
    environment:
      DATABASE_URL: 'postgres://slugs:slugs_password@db:5432/slugs'
      BETTER_AUTH_SECRET: 'change-me'
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
- Oven Bun (but there has been some inconsistencies with layerchart, so we use node as for now).

Run locally with a Postgres instance and set:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`

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
