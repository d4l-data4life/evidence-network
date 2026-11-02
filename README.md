# Data4Life Evidence Network

A minimal, containerized skeleton for the **Data4Life Evidence Network** — a
customizable hub for sharing datasets and discovering/joining digital health
studies, deployable for regional networks (e.g. Latin America), CHAMPS, the
Data4Life Data Library node, or the OHDSI Evidence Network working group. It
proves out the core plumbing the full product will build on:

- a **public** landing page (`/`)
- a **protected** dashboard (`/dashboard`) visible only after signing in
- **two authentication paths**:
  - local **username / password**
  - federated **ORCID** login (OpenID Connect)

## Stack

| Concern         | Choice                                                        |
| --------------- | ------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, TypeScript, `output: "standalone"`)   |
| Auth            | Auth.js v5 (`next-auth@beta`) — Credentials + ORCID OIDC      |
| Session         | JWT strategy (required when a Credentials provider is present)|
| ORM / DB        | Prisma 7 (Rust-free client + `pg` driver adapter) / Postgres 16 |
| Passwords       | bcrypt (`bcryptjs`)                                           |
| i18n            | next-intl (en, pt-BR, es) — per-user language, no URL prefix  |
| Containerization| Docker + docker-compose (db + one-off migrate + app)          |

## Quick start

Prerequisites: Docker Desktop running.

```bash
cp .env.example .env
# generate a session secret and paste it into AUTH_SECRET in .env:
openssl rand -base64 32
```

Then bring up the whole stack:

```bash
docker compose up --build
```

**One-time setup:** map the dev hostname to loopback in your `/etc/hosts`:

```bash
echo "127.0.0.1 evidence.test" | sudo tee -a /etc/hosts
```

Then open **http://evidence.test:3000** (use `evidence.test`, not `localhost` or
`127.0.0.1` — see the ORCID note below).

The stack starts in order: Postgres → a one-off `migrate` service
(`prisma migrate deploy` + seed) → the app.

### Demo credentials login

Three users are seeded automatically — one per system role — all with password
**`password123`**:

| Username | Name | Role | Can do |
| --- | --- | --- | --- |
| `admin` | Admin Arnold | **Superuser** | Everything: manage users' roles and branding (`/admin`), review submissions, plus all normal-user actions. Owns the seeded demo content. |
| `coord` | Coordinator Casey | **Coordinator** | Review the queue at `/review` — approve/reject studies & datasets submitted for publication — plus all normal-user actions. |
| `researcher` | Researcher Robin | **User** | Create and manage data sites, datasets, and studies; submit them for publication. |

Roles are separation-of-duties: a coordinator/superuser can't approve their own
(or their team's) submissions — so use `researcher` to submit and `coord` to
approve when trying the workflow.

Sign in, and you'll land on `/dashboard` showing your session details. Signing
out returns you to the public page and re-locks the dashboard.

## ORCID federated login

ORCID login is wired up but needs your own OAuth client credentials. ORCID has a
free, self-service **sandbox** (a separate test system from production).

### 1. Register a sandbox OAuth client

1. **Create a sandbox account** at <https://sandbox.orcid.org/register>.
   The sandbox only sends emails to **`@mailinator.com`** addresses, so register
   with e.g. `yourname@mailinator.com`, then open
   <https://www.mailinator.com>, search that inbox, and click the verification
   link. (Developer Tools stays greyed out until your email is verified.)
2. Go to **Developer Tools**: <https://sandbox.orcid.org/developer-tools>,
   accept the Public API terms, and register an application:
   - **Application URL:** any valid https URL — `https://example.com` is fine
     (this field is informational; `localhost` is rejected here).
   - **Redirect URI:** `http://evidence.test:3000/api/auth/callback/orcid`
     — ORCID's validator rejects the word `localhost`, and a custom host also
     avoids a Next.js quirk (see the note below).
3. Copy the generated **Client ID** (`APP-…`) and **Client Secret**.

### 2. Configure the app

Put the values in `.env`:

```env
ORCID_ISSUER="https://sandbox.orcid.org"
ORCID_CLIENT_ID="APP-XXXXXXXXXXXXXXXX"
ORCID_CLIENT_SECRET="your-secret"
```

Restart the app (`docker compose up -d app`), then click **Sign in with ORCID**
on the login page. You'll be redirected to sandbox.orcid.org, and after
authorizing, back to the dashboard. ORCID does not share an email address, so
the account is keyed on the ORCID iD (the OIDC `sub` claim).

For **production**, repeat the registration at
<https://orcid.org/developer-tools>, set `ORCID_ISSUER=https://orcid.org`, and
point `AUTH_URL` / the redirect URI at your real https domain.

### Why `evidence.test` and not `localhost` / `127.0.0.1`?

Two things collide locally: ORCID **rejects the literal host `localhost`** in a
redirect URI, while Next.js **rewrites the loopback IP `127.0.0.1` → `localhost`**
internally (which desynchronizes the OAuth `redirect_uri` and the state/PKCE
cookie host, breaking the callback). A custom hostname mapped to `127.0.0.1`
sidesteps both: it's accepted by ORCID (not the string `localhost`) and left
untouched by Next.js — so the browser host, the cookie host, the emitted
`redirect_uri`, and the callback host are all consistently `evidence.test`.

We use **`evidence.test`** via an `/etc/hosts` entry rather than a public
loopback domain like `lvh.me`: the `.test` TLD is reserved by RFC 6761, so it
depends on no external DNS, works on any network and offline, and isn't blocked
by routers with DNS-rebinding protection (which drop public DNS answers that
point to `127.0.0.1`). Set `AUTH_URL=http://evidence.test:3000` and **always open
the app at `http://evidence.test:3000`**. For production, a normal https domain
has none of these quirks.

## Domain (Study Phase A + Dataset D1)

The first slices of the domain are implemented (design docs in
[`docs/`](docs)). Everything below is behind authentication — "visible" means
visible to any signed-in user, never anonymous.

- **Studies** (`/studies`) — catalog of network studies. Create with
  `/studies/new`; the executable design is an external link (`designRef`) for
  now (structured cohorts/analyses come in a later phase; cohorts will round-trip
  with ATLAS 3.0). Each study has a team (`StudyMembership`) and a visibility flag.
  Studies are **editable** (`/studies/[slug]/edit` mutates the working copy) and
  **versioned**: "Publish version" freezes an **immutable, numbered snapshot**
  (`StudyVersion`) that is referenceable and read-only at
  `/studies/[slug]/versions/[n]` — editing the head never changes a published
  version.
- **Sites & datasets** (`/sites`) — a site owner **enrolls a site** (data
  partner), then registers **datasets** (OMOP databases), and browses visible
  datasets at `/datasets`. Each dataset has its own **visibility** (private vs.
  authenticated) and two independent axes:
  - **Releases** (`DatasetRelease`) — OMOP `CDM_SOURCE` data cuts; a published
    release is immutable, add a new one for a refresh (`/datasets/[slug]/releases/new`).
    The Achilles / DQD result-push tiers (D2/D3) attach here later.
  - **Metadata versions** (`DatasetVersion`) — immutable snapshots of the catalog
    record (see versioning below).

- **User roles & the approval workflow.** Every user has a system role
  (`User.systemRole`), separate from per-study/site membership:
  - **User** — create sites, datasets, and studies (as before).
  - **Coordinator** — also **review the queue** at `/review`, approving or
    rejecting studies/datasets that others submit for publication.
  - **Superuser** — also the **admin**: `/admin/users` (promote/demote roles)
    and `/admin/branding` (app name, tagline, accent color, logo upload).

  **Publication approval is separate from visibility.** A study/dataset is shown
  to other authenticated users only when it is **both** `Authenticated` **and**
  `Approved`. The owner submits for publication (Draft → Pending); a coordinator
  who is *not* the owner or a team member approves (→ Published) or rejects (with
  a note). No one can approve their own submissions (separation of duties). Sites
  themselves are owner-managed (not part of the approval queue).

- **Editing + versioning is uniform across Study, Site, and Dataset.** Each has a
  mutable working copy edited at `/…/[slug]/edit`, and a **"Publish version"**
  button that freezes an **immutable, numbered snapshot** (`StudyVersion` /
  `SiteVersion` / `DatasetVersion`), read-only and referenceable at
  `/…/[slug]/versions/[n]`. Editing the head never changes a published version.

The seed adds one example site, dataset (+version), and study owned by `admin` so
the lists aren't empty. Data model rationale: [`docs/study-data-model.md`](docs/study-data-model.md),
[`docs/dataset-data-model.md`](docs/dataset-data-model.md).

## Internationalization & customization

- **Languages.** The UI ships in **English**, **Brazilian Portuguese (`pt-BR`)**,
  and **Spanish (`es`)** via next-intl (the locale is *not* in the URL). Each user
  chooses their language on the **Account** page; it is stored on their profile
  (`User.locale`). A user with no choice follows the deployment's **default
  locale**. The **theme** (light / dark / system) is likewise a per-user profile
  preference, so neither language nor theme leaks between accounts on a shared
  browser.
- **System locale settings.** A superuser sets the **default language** and which
  languages are **offered** in the switcher at `/admin/branding`.
- **Deployment profiles.** Each instance's identity — name, tagline, landing
  intro, accent color, default + offered languages — comes from a **deployment
  profile** selected with the `DEPLOYMENT` env var (`default`, `data-library`,
  `champs`, `latam`, `ohdsi-wg`; see
  [`lib/deployment/profiles.json`](lib/deployment/profiles.json)). The profile
  seeds the branding row on first run; a superuser can override everything at
  runtime in `/admin/branding`. Example:

  ```env
  DEPLOYMENT=latam   # Spanish-first Latin America instance
  ```

- **Message catalogs** live in `messages/<locale>.json` (shared chrome + enum
  labels) and `messages/<locale>/<domain>.json` (studies, sites, datasets,
  review, admin-users), merged per request in `i18n/request.ts`.

## Local development (without Docker)

You still need a Postgres to point at (the compose `db` service works — it
publishes port 5432 on the host):

```bash
docker compose up -d db          # start just Postgres
npm install
npx prisma migrate deploy        # or: npm run db:migrate
npm run db:seed                  # seed the demo users + example content
npm run dev                      # http://evidence.test:3000
```

`.env` already points `DATABASE_URL` at `localhost:5432` for host-side tooling;
inside compose the app talks to the `db` service instead.

## Project layout

```
app/
  page.tsx                        public landing page
  login/page.tsx                  credentials form + "Sign in with ORCID"
  login/orcid-button.tsx          client-side ORCID sign-in (avoids a cookie bug)
  dashboard/page.tsx              protected home (matches overview + nav)
  studies/                        study catalog: list, new (+actions.ts), [slug]
  sites/                          site enrollment + datasets: list, new, [slug], actions.ts
  datasets/                       dataset browse/detail/create + [slug]/versions/new
  _components/                    shared server-safe UI + form primitives
  api/auth/[...nextauth]/route.ts Auth.js route handler
  generated/prisma/               generated Prisma client (gitignored)
auth.ts                           Auth.js config (providers, adapter, callbacks)
auth.config.ts                    edge-safe config used by the proxy
proxy.ts                          route protection (Next 16 "proxy"); gates the authed area
lib/prisma.ts                     Prisma client singleton (pg driver adapter)
lib/{session,slug,labels}.ts      auth guard, slug helper, enum label/option lists
lib/i18n/                         locale config + per-request locale resolution
lib/deployment/                   deployment profiles (profiles.json + accessor)
i18n/request.ts                   next-intl request config (merges message catalogs)
messages/                         translation catalogs (en, pt-BR, es)
prisma/
  schema.prisma                   auth models + domain (Study/Site/Dataset/…)
  migrations/                     SQL migrations (prisma migrate deploy)
  seed.mjs                        demo users + example content (pg + bcryptjs)
docs/                             study + dataset data-model design docs
Dockerfile                        deps → builder → migrator + runner
docker-compose.yml                db (healthcheck) + migrate + app
```

## Notes / next steps

- No sign-up flow yet — three demo users are seeded (see above). A registration page is the
  natural next addition.
- Sessions are stateless JWTs; the Prisma adapter still persists ORCID
  `User`/`Account` rows for federated logins.
- To reset everything (including the database volume): `docker compose down -v`.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
