# Roadmap 2 — Ship, Test, Operate
## From "BookEasy works on my laptop" to "BookEasy runs in production, is tested, and has AI on top"

Written for Samad · October 2026 · Follows the PostgreSQL roadmap (Stages 1–20 complete, BookEasy API done).

---

## 0. Read this first

### Where you stand
- **Strong:** React / Next.js / TypeScript (3+ years), Node + Express, PostgreSQL (constraints, concurrency, indexing, migrations, security), authentication (JWT + rotating refresh tokens), layered architecture, hardening (CORS, helmet, rate limiting, logging).
- **Missing (this is what job descriptions keep asking for):** deployment, automated tests, CI/CD, Docker, production operations.
- **Not done yet:** the BookEasy React frontend (Step 9). A full-stack project needs both halves, so Stage 1 below finishes it.

### Why this order (market + AI + your situation)
- Junior and generalist roles are squeezed; AI coding tools make *writing* routine code cheap. What stays valuable is people who can **ship, verify, and operate** software, and who can build AI features that do not fail unpredictably. ([Kore1 2026 analysis](https://kore1.com/senior-swe-glut-ai-infra-drought-2026/) — from a staffing firm, so treat numbers as direction, not exact.)
- Deployment, tests, CI/CD and Docker appear in almost every full-stack job description. Without them, "I built it" is hard to believe. With them, BookEasy becomes proof.
- AI application engineering (LLM APIs, RAG, tool calling, evals) comes **after** this roadmap, because AI features need to be deployed, tested and monitored like everything else. Stage 7 previews it.
- You are job hunting now. So: **apply while you learn.** Do not wait to finish this roadmap.

### The rules of this roadmap
1. **Understand first, then implement.** Each stage has *Part A — Understand* (concepts, comparisons, no code) and *Part B — Implement* (one chosen option, shipped).
2. **Every stage ends with something visible:** a live URL, a green CI badge, a Dockerfile in the repo. If it is not visible, it did not happen.
3. **Official docs first**, as you already do. Timebox reading; the goal is a working deliverable, not finished documentation.
4. **Just-in-time learning:** deep topics (replication, sharding, Kubernetes, microservices) wait until a real problem needs them.
5. **Write a short `NOTES.md` per stage** in your learning repo, in your own words. If you cannot explain it, you do not own it yet.

### Overview

| Stage | Topic | Duration (indicative) | You will have |
|---|---|---|---|
| 1 | Finish the React frontend (Step 9) | 2–3 weeks | A full-stack BookEasy |
| 2 | Deployment (understand, then ship) | 2 weeks | A live URL |
| 3 | Testing | 2 weeks | A real test suite |
| 4 | CI/CD with GitHub Actions | 4–5 days | Green checks on every push |
| 5 | Docker | 1 week | Containerised API, one-command local setup |
| 6 | Operating it (logs, errors, backups) | 1 week | You can see and recover production |
| 7 | AI engineering (preview) | 6–8 weeks | BookEasy AI |
| 8 | Later, just in time | ongoing | Redis, queues, system design, deeper Postgres |

Durations are indicative, not deadlines. Spend longer on a stage if you cannot do its deliverable alone.

---

# Stage 1 — Finish the BookEasy Frontend

Not part of your request, but nothing below makes sense without it.

- React app (Vite SPA or Next.js — decide once and write down why).
- Auth: login, signup, **refresh on startup + 401 interceptor**, access token in memory (never `localStorage`), `credentials: 'include'`.
- Pages: venue list with search and filters, venue detail with slots, booking flow, my bookings, owner dashboard (slots, bookings, stats), admin pages.
- Data layer: TanStack Query (you already know it), forms with React Hook Form + Zod.
- Handle the API's error envelope and `X-Trace-Id` in the UI.

**Deliverable:** the whole booking flow works locally from the browser.

---

# Stage 2 — Deployment

## Part A — Understand (complete guide)

### Module 2.1 — The map of a deployed web app

```
Browser
   │  HTTPS
   ▼
DNS  ──►  CDN / edge  ──►  Frontend host  (static files or a Next.js server)
                                │
                                │ HTTPS (API calls)
                                ▼
                         Reverse proxy / load balancer   (TLS terminates here)
                                │
                                ▼
                         API container(s)   (your Express app)
                                │
                                ▼
                         Managed PostgreSQL
```

Know what each box does and who runs it (you, or the platform).

### Module 2.2 — Concepts you need before choosing anything

- **Environments:** development, staging (optional), production. What differs between them (env vars, database, domain, logging level).
- **Configuration and secrets:** environment variables, never committed, rotated if leaked. Your `.env` pattern is correct; hosts have a "secrets / environment" screen.
- **Domains and DNS:** registrar, A vs CNAME records, subdomains (`app.example.com`, `api.example.com`), TTL, propagation.
- **HTTPS / TLS:** certificates (usually automatic via Let's Encrypt on modern hosts), why `secure` cookies need HTTPS, HSTS.
- **Reverse proxy and load balancer:** why `trust proxy` exists (your `TRUST_PROXY_HOPS`), what `X-Forwarded-For` is.
- **CDN:** caching static files near users.
- **Regions and latency:** pick the region closest to your users and keep the API and database in the **same region**. Most cloud regions are far from Pakistan; the nearest are usually in the Middle East, Mumbai or Singapore/Europe depending on the provider. Check which regions each provider offers.
- **Stateless servers and scaling:** vertical (bigger machine) vs horizontal (more copies). Anything stored in server memory is per-copy. **Your in-memory rate limiter would count per instance** once you run more than one. That is fine for a single instance; Redis fixes it later.
- **Cold starts:** services that sleep or scale to zero take seconds to wake. Acceptable for a portfolio; know it exists.
- **Health checks and graceful shutdown:** `/health` (you have it) and the SIGTERM handler (you have it). Hosts use both during deploys.
- **Zero-downtime deploys and rollbacks:** new version starts, passes health check, receives traffic; if it fails, the old one stays.
- **Migrations during deploy:** run them *before* new code receives traffic (a "pre-deploy" or release step), and keep them backward-compatible (your Module 15).
- **Logs, backups, cost control:** where logs go (you already log JSON to stdout), how backups work, budget alerts so a mistake cannot bill you.

### Module 2.3 — Where to host the frontend

| Option | Best for | Notes |
|---|---|---|
| **Vercel** | Next.js (made by the same company), also Vite SPAs | Preview deployment per pull request; easiest path |
| **Netlify** | Static sites / SPAs | Similar workflow to Vercel |
| **Cloudflare Pages** | Static / edge | Strong CDN |
| **S3 + CloudFront** (AWS) | Static sites inside AWS | More setup, same result |

A static Vite SPA can go anywhere. A Next.js app that uses server rendering needs a Node runtime, which Vercel provides natively.

### Module 2.4 — Where to host the backend (the four models)

1. **PaaS (platform as a service): Render, Railway, Fly.io**
   - You connect a GitHub repo (or a Docker image); the platform builds, runs, gives you HTTPS and a URL.
   - Pros: least work, good for a first deployment. Cons: costs more at scale, less control.
   - Pricing styles differ (checked October 2026; verify before choosing):
     - **Render:** fixed instance tiers (Starter around $7/month, Standard around $25), managed Postgres from about $7.
     - **Railway:** usage-based (per vCPU-second and GB-second), Hobby plan about $5/month with usage credits; a card is required.
     - **Fly.io:** priced by machine size (a small shared machine is a couple of dollars a month); runs your Docker image in chosen regions.
     - Sources: [pricing comparison](https://sota.io/blog/railway-vs-render-vs-fly-pricing-2026). Free tiers and trial rules change often. Check each provider's pricing page.
2. **VPS + Docker Compose + a reverse proxy (Caddy or nginx)**
   - Rent a small Linux server (Hetzner, DigitalOcean, Contabo and others). You install Docker, run your Compose file, put Caddy in front for automatic HTTPS.
   - Pros: cheapest and teaches the most (Linux, firewalls, SSH). Cons: security updates, backups and monitoring are your job.
3. **Serverless containers: Google Cloud Run, AWS App Runner / ECS Fargate, Azure Container Apps**
   - You give them a Docker image; they run it, scale it, and can scale to zero.
   - Pros: real cloud skills with little server management. Cons: needs Docker first; the cloud account setup is bigger.
4. **Serverless functions: AWS Lambda, Vercel Functions, Cloud Functions**
   - Good for small isolated tasks. A long-lived Express app with a `pg` connection pool is an awkward fit (many short-lived instances open many connections), so you would need a connection pooler. Not the best first choice for BookEasy.
5. **Kubernetes** — skip for now. It solves problems of large teams.

### Module 2.5 — Where to host the database

| Option | What it is | Things to know |
|---|---|---|
| **Neon** | Serverless Postgres | Scales to zero when idle (small cold-start delay); instant database branching; free tier is limited by compute hours and 0.5 GB storage |
| **Supabase** | Postgres plus auth, storage, realtime, edge functions | Free projects pause after 7 days of inactivity; 500 MB free database. You built your own auth, so you would use only its Postgres |
| **Render / Railway Postgres** | Postgres next to your API on the same platform | Simple, same dashboard, often same region |
| **AWS RDS / GCP Cloud SQL / Azure Database for PostgreSQL** | Cloud-provider managed Postgres | Most control and cost; the enterprise standard |

(Sources: [Neon vs Supabase comparison](https://bytebase.com/blog/neon-vs-supabase); free-tier numbers change, verify.)

Things to check **before** choosing a database host for BookEasy:
- **Extensions:** your schema needs `btree_gist` (exclusion constraint). Later you want `pgvector`. Confirm both are available.
- **Connection strings:** hosts offer a *direct* and a *pooled* connection. Run **migrations on the direct connection**. Understand what a transaction-mode pooler changes (session features, prepared statements) before pointing your app at it.
- **SSL:** use `DB_SSL=true` and keep `DB_SSL_REJECT_UNAUTHORIZED=true` unless the host documents otherwise.
- **Backups:** what is included on the free plan, how long are they kept, how do you restore.
- **Region:** same region as your API.

BaaS vs your own API: Supabase and Firebase can replace a backend entirely. You chose to build the backend yourself on purpose — that is the skill employers are testing. Use the platform for hosting, not for replacing your API.

### Module 2.6 — The big three clouds (understand the map)

You are not learning three clouds. You are learning that they are **the same building blocks with different names**.

| Need | AWS | Google Cloud | Azure |
|---|---|---|---|
| Virtual machine | EC2 | Compute Engine | Virtual Machines |
| Run a container (managed) | ECS Fargate, App Runner | Cloud Run | Container Apps |
| Serverless function | Lambda | Cloud Functions | Azure Functions |
| Managed PostgreSQL | RDS, Aurora | Cloud SQL, AlloyDB | Azure Database for PostgreSQL |
| File / object storage | S3 | Cloud Storage | Blob Storage |
| CDN | CloudFront | Cloud CDN | Front Door |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| Secrets | Secrets Manager | Secret Manager | Key Vault |
| Container registry | ECR | Artifact Registry | Container Registry |
| Identity and permissions | IAM | IAM | Entra ID + RBAC |
| Logs and metrics | CloudWatch | Cloud Logging / Monitoring | Azure Monitor |
| Queue / messaging | SQS, SNS | Pub/Sub | Service Bus |
| Managed AI models | Bedrock | Vertex AI | Azure AI Foundry / Azure OpenAI |

Which one first?
- **AWS** has the widest job-market presence (it is generally reported as the largest cloud by market share), so it is the safest default for CV value.
- **Azure** is common in enterprise and Microsoft/.NET-heavy companies. If a target employer uses it, learn it.
- **GCP Cloud Run** is the *easiest* way to run a container in a big cloud, good for a first hands-on.

Practical things for Pakistan: big clouds usually require an **international card** at sign-up. Check whether your bank card supports international online payments, or use a virtual card service that does. Always set a **budget alert** immediately after creating the account, and delete resources you are not using.

Core ideas to learn once, in any cloud: IAM (users, roles, least privilege, never use the root account), networking basics (VPC, public vs private subnets, security groups / firewall rules), managed vs self-managed services, and billing.

### Module 2.7 — Production gotchas specific to BookEasy

These will bite you on the first deploy. Know them now.

1. **Cross-site cookies (most important).** Your refresh token is a cookie with `SameSite=Lax` and `path=/auth`. If the frontend is on `myapp.vercel.app` and the API on `myapi.onrender.com`, those are **different sites**, and the browser will **not send the cookie** on the refresh request. Login will seem to work and sessions will die on page refresh. Fixes:
   - **(a) Same registrable domain:** `app.yourdomain.com` and `api.yourdomain.com` are the same site, so `Lax` works (CORS with credentials is still required). Needs a domain name.
   - **(b) Proxy the API through the frontend host:** Vercel/Next.js rewrites send `/api/*` to your API, so the browser only talks to one origin. No CORS, first-party cookie.
   - **(c) `SameSite=None; Secure`:** works cross-site on paper, but browsers increasingly block third-party cookies, so it is unreliable. Avoid.
2. **CORS:** set `FRONTEND_ORIGIN` to the real frontend URL (comma-separated if several). Preview deployments get new URLs, so plan for that.
3. **`TRUST_PROXY_HOPS=1`** on most platforms, so `req.ip` and your rate limiter see real client IPs. Log `req.ip` once to verify.
4. **`NODE_ENV=production`** so cookies are `secure`.
5. **`DB_SSL=true`** and the database connection string from the host; **migrations before traffic**.
6. **`PORT`:** platforms inject it; your `env.PORT` already reads it.
7. **Secrets:** a long random `JWT_ACCESS_SECRET` (32+ characters), set in the host dashboard, never in git.
8. **Health check path:** configure `/health`.
9. **In-memory rate limiter:** correct for one instance; remember it resets on restart.
10. **Logs:** your JSON lines go to stdout, which the platform shows in its Logs tab (retention is short on cheap plans).

### Module 2.8 — Decision matrix and recommended path

Choose by these questions:
- Does it accept my payment method? (Often the deciding factor.)
- Does it support Docker, pre-deploy commands (migrations), health checks, automatic HTTPS, and GitHub auto-deploy?
- Region near my users, and API + database in the same region?
- Is pricing predictable (fixed vs usage-based)?
- Are `btree_gist` and `pgvector` available on its Postgres?

**Recommended path:**
1. **Ship #1 (PaaS):** frontend on Vercel, API on Render or Railway (whichever you can pay for), database on Neon or the same platform's Postgres. Apply fix (a) or (b) from 2.7 for cookies.
2. **Ship #2 (stretch, after Docker in Stage 5):** the same API as a container on one big cloud (AWS App Runner/ECS or Cloud Run). Goal: learn registry, IAM, networking, billing. Timebox it and set a budget alert first.
3. Optional: a VPS with Docker Compose + Caddy, to learn Linux. Valuable, not urgent.

## Part B — Implement

- Pick one stack from the matrix and write a half-page "why this choice" in `NOTES.md`.
- Deploy: database → run migrations → API (env vars, health check, pre-deploy migrations) → frontend. Solve the cookie problem deliberately.
- Create the first admin on production with your `create-admin` script (one-off command).
- Smoke-test in the browser: signup, login, refresh the page (session must survive), book a slot, cancel.
- Add the live URL to the CV, the README and LinkedIn.

**Deliverable:** a public URL anyone can use, with HTTPS, working auth across page refreshes, and logs you can read.

**Interview talking points:** the cross-site cookie problem and your fix; why migrations run before traffic; why API and database share a region; what you would change to scale to multiple instances (shared rate-limit store, stateless API).

---

# Stage 3 — Testing

## Part A — Understand

### Module 3.1 — Why test, and what to test

- Tests prove behaviour **and protect you when you change code** (and AI-generated changes especially need verification).
- **The test pyramid:** many fast unit tests, a good number of integration tests, a few end-to-end tests.
- For BookEasy the most valuable tests are **integration tests against a real database**, because your guarantees live in Postgres constraints (the partial unique index, the exclusion constraint). A mocked database cannot prove those.
- Do not chase a coverage percentage. Test the workflows and rules that would hurt if broken: authentication, authorization (who can do what), double booking, overlap, cancellation rules, money snapshot.

### Module 3.2 — Which libraries (and why)

| Layer | Use | Why |
|---|---|---|
| Test runner (backend and frontend) | **Vitest** | Native ESM and TypeScript, fast, almost Jest-compatible API. Your project is ESM + TypeScript, where Jest needs extra configuration |
| HTTP integration tests | **Supertest** | Calls your Express `app` directly without opening a port (your `app.ts` and `server.ts` are already split, which makes this easy) |
| Real database in tests | A dedicated test database (Docker Postgres) or **Testcontainers** | Constraints must be real |
| React component tests | **React Testing Library** + `user-event` | Tests what the user sees and does |
| Mocking the API in frontend tests | **MSW (Mock Service Worker)** | Intercepts network requests realistically |
| End-to-end browser tests | **Playwright** (or Cypress, which you have studied) | Playwright: multi-browser, auto-waiting, parallel, trace viewer, free. Either is acceptable; pick one and go deep |
| API regression | **Newman** (your existing Postman collections) | You already have ~700 assertions across 7 collections. Run them in CI as a quick win |

### Module 3.3 — Testing a real database

- A **separate test database** with migrations applied once before the run.
- **Isolation between tests:** truncate tables (`TRUNCATE ... RESTART IDENTITY CASCADE`) before each test or each file, or wrap each test in a transaction that is rolled back.
- **Parallelism:** test files run in parallel by default and will collide on one database. Run DB test files serially, or give each worker its own schema or database.
- **Fixtures and factories:** small helper functions (`createUser`, `createVenue`, `createSlot`) instead of copy-pasted inserts.
- Test **the constraints directly**: insert a violating row, expect the error code.
- Test **concurrency**: fire 10 booking requests with `Promise.all`, expect exactly one `201` and nine `409`. This is your interview story, turned into a permanent test.

### Module 3.4 — What to test, by layer (BookEasy examples)

- **Unit:** pure functions: validation schemas (Zod), mappers, pagination math, date helpers.
- **Integration (Supertest + real Postgres):**
  - Auth: signup, login, wrong password, disabled account, refresh rotation (old token rejected), logout.
  - Authorization: customer cannot create a venue; owner cannot touch another owner's venue; admin routes reject non-admins.
  - Slots: overlap rejected, booked slot cannot change time, past slot rejected.
  - Bookings: double booking, cancel twice, cancel after start, price snapshot.
  - Error format: every error uses the envelope, 503 mapping.
  - Rate limit: the 11th failed login returns 429 (configure a small limit in tests).
- **Frontend:** login form validation, protected routes, booking button disabled when the slot is booked, error display.
- **End-to-end (Playwright):** signup → login → find a venue → book → see it in "my bookings" → cancel. One or two flows, not twenty.

### Module 3.5 — Testing AI features (preview for Stage 7)

- Never call a real LLM in normal unit/integration tests: slow, costly, non-deterministic. Use a **fake provider** that returns canned responses.
- Test the parts you control: prompt construction, **schema validation of structured output** (Zod), tool-call argument validation, timeouts and retries, refusal and error handling.
- **Evals** (a fixed set of example inputs with expected properties, scored automatically) are the AI equivalent of tests. Run them on demand or on a schedule, not on every commit (cost).
- Test prompt-injection attempts: the model must not be able to book on behalf of another user or read another customer's data.

## Part B — Implement

1. Set up Vitest for the API; add `pnpm test`.
2. Create the test database, a migration step for tests, and a cleanup helper.
3. Write integration tests for auth, venues, slots, bookings, admin (port your Postman scenarios), including the **concurrent booking test** and the **overlap test**.
4. Add unit tests for schemas and helpers.
5. Frontend: Vitest + Testing Library + MSW for 3–5 key components and flows.
6. Add one Playwright end-to-end flow.
7. Keep the Postman collections; wire Newman into CI in Stage 4.

**Deliverable:** `pnpm test` passes locally; the double-booking and overlap guarantees are automated tests.

**Interview talking points:** why integration tests hit a real database; how you isolate tests; why the concurrency test exists; why you test authorization, not just happy paths.

**This stage also closes Module 18 (Database Testing) of your PostgreSQL roadmap.**

---

# Stage 4 — CI/CD with GitHub Actions

## Part A — Understand

### Module 4.1 — Concepts

- **CI (continuous integration):** on every push and pull request, a clean machine installs your project, type-checks, builds and runs tests. Failing checks mean "do not merge".
- **CD (continuous delivery/deployment):** when checks pass on `main`, the app deploys automatically.
- **GitHub Actions vocabulary:** workflow (a YAML file in `.github/workflows/`), event (`push`, `pull_request`, `schedule`, `workflow_dispatch`), job, step, runner (`ubuntu-latest`), action (reusable step, e.g. `actions/checkout`), secrets, environment variables, artifacts, caching, matrix builds, **service containers** (a Postgres container next to your tests), `concurrency` (cancel outdated runs), `permissions` (least privilege for the workflow token), **environments** with approvals, **branch protection** (require checks before merge).
- **Secrets:** stored in repository settings, never in the repo; prefer short-lived credentials (OIDC to a cloud) over long-lived keys once you reach cloud deployments.
- **Two common CD styles:**
  1. The hosting platform watches your repo and deploys after CI passes (simplest; Render, Railway and Vercel support this).
  2. Your workflow builds a Docker image, pushes it to a registry (GitHub Container Registry), and tells the host to run the new image.
- **Supply-chain basics:** pin or periodically update action versions (Dependabot), keep dependencies updated, scan for vulnerabilities (`pnpm audit`, CodeQL optional).

### Module 4.2 — A CI workflow, in outline

A sketch to read, not final code. Check the latest versions of each action when you write the real file.

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
      JWT_ACCESS_SECRET: ci-only-secret-at-least-32-characters-long
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm migrate up
      - run: pnpm test
```

Later additions: a frontend job (typecheck, lint, test, build), a Playwright job, a Newman job, a Docker build job.

## Part B — Implement

1. Add the CI workflow for the API (typecheck, migrations, tests).
2. Add a frontend workflow (typecheck, lint, test, build).
3. Run the Postman collections with Newman in CI.
4. Turn on **branch protection**: `main` requires passing checks and a pull request.
5. Work through pull requests even though you are alone (it is how teams work and it is visible on GitHub).
6. Add Dependabot for dependency updates.
7. Connect CD: platform auto-deploy after CI passes, or a deploy job. Make migrations part of the deploy.
8. Add status badges to the README.

**Deliverable:** every push runs the full test suite; merging to `main` deploys; a red check blocks the merge.

**Interview talking points:** what CI protects against; how the test database is created in CI; how a broken commit is stopped; how a bad deploy is rolled back.

---

# Stage 5 — Docker

## Part A — Understand

### Module 5.1 — Concepts

- **Image vs container:** an image is a packaged filesystem and start command (a recipe plus ingredients); a container is a running instance of it.
- **Layers and the build cache:** each Dockerfile instruction is a layer; ordering instructions so rarely changing things come first (copy `package.json` and install before copying source) makes rebuilds fast.
- **Dockerfile instructions:** `FROM`, `WORKDIR`, `COPY`, `RUN`, `ENV`, `EXPOSE`, `CMD`, `ENTRYPOINT`, `USER`, `HEALTHCHECK`.
- **`.dockerignore`:** keep `node_modules`, `.env`, `.git` out of the image.
- **Multi-stage builds:** one stage builds (TypeScript compiler and dev dependencies), the final stage contains only compiled JavaScript and production dependencies, so the image is small.
- **Base images:** `node:22-slim` is a safe default. Alpine is smaller but uses a different C library that can break native dependencies (you use `bcryptjs`, which is pure JavaScript, so you are safe either way).
- **Run as a non-root user.** Never bake secrets into an image; pass them at runtime.
- **Signals:** Node as PID 1 must handle `SIGTERM` for graceful shutdown (your server already does); `docker run --init` helps.
- **Volumes:** persistent data (database files) outside the container's disposable filesystem. **Networks:** containers reach each other by service name.
- **Docker Compose:** one YAML file to run the API, Postgres (and later Redis) together; `depends_on` with health checks; `env_file`.
- **Registries:** Docker Hub, GitHub Container Registry (GHCR), cloud registries (ECR, Artifact Registry, ACR); tags and versioning (never rely on `latest` in production).
- **On Windows:** Docker Desktop with WSL2.
- **What Docker is not:** it is not a virtual machine, and it is not Kubernetes. Learn Docker and Compose only.

## Part B — Implement

1. Write a multi-stage `Dockerfile` for the API (build with `tsc`, run `node dist/server.js`), a `.dockerignore`, a non-root user, and a `HEALTHCHECK` calling `/health`.
2. Write `docker-compose.yml`: `api` + `postgres` (with a named volume and health check) so a new developer runs one command.
3. Run migrations inside the Compose setup (a one-off command or an init step).
4. Use the same Postgres container for local tests and in CI.
5. Add a Docker build (and optionally push to GHCR) to the CI workflow.
6. Deploy the image to a host that accepts images (Render, Fly.io, Cloud Run or similar).
7. Update the README: "run the whole system with `docker compose up`".

**Deliverable:** `docker compose up` starts a working API and database; CI builds the image; the production host runs that image.

**Interview talking points:** why multi-stage; why not bake secrets; how layers and cache speed up builds; why the container handles SIGTERM.

---

# Stage 6 — Operating Production

This closes the operational half of **Module 19** of your PostgreSQL roadmap (deferred until you had a deployed product).

### Part A — Understand
- **Logs:** structured logs (Pino), log levels, trace ids (you have these), log retention and drains to a log service.
- **Error tracking:** Sentry (or similar): grouped exceptions with stack traces and release versions.
- **Uptime and health monitoring:** an external ping on `/health`, with alerts.
- **Metrics:** latency, error rate, request volume; the idea of the "golden signals".
- **Database operations:** connection counts, `pg_stat_activity`, slow queries (`pg_stat_statements`), table and index size, backups, **restore drill**, point-in-time recovery (awareness).
- **Incident basics:** how to roll back, how to read logs from a trace id, how to write a short post-mortem.
- **Security checklist:** secrets rotation, dependency updates, least-privilege database role for the app (not the owner role), HTTPS only.

### Part B — Implement
1. Switch the request logger to Pino with levels and redaction of sensitive headers.
2. Add Sentry to the API and the frontend.
3. Add an uptime monitor with an alert.
4. Create a **separate, least-privilege database role** for the app; migrations use another role.
5. Take a backup, **restore it into a fresh database**, and confirm the data. Write the steps down.
6. Read `pg_stat_statements` and `EXPLAIN ANALYZE` on BookEasy with about 100k seeded rows; add an index only where the plan proves it helps.

**Deliverable:** you can answer "what happened to the request a user complained about?" and "how do I recover if the database is lost?".

---

# Stage 7 — AI Engineering (preview; detailed roadmap comes after Stage 6)

Order, in TypeScript first:
1. LLM APIs: structured outputs (validated with Zod), tool/function calling, streaming to the frontend, timeouts, retries, token and cost awareness.
2. Embeddings and **pgvector** (semantic search over venues), full-text + vector (hybrid) search.
3. RAG: chunking, retrieval, citations, access control (a customer must never see another customer's data).
4. Agents with tool use and MCP, with strict validation of every tool call.
5. **Evals:** golden datasets, scoring, regression checks; AI observability (latency, cost, quality); security (prompt injection, data leakage).
6. Deployment details specific to AI: API keys as secrets, spending caps, streaming through proxies (some proxies buffer or time out long streams), background jobs for slow work.

**Capstone: BookEasy AI.** A customer types *"marquee in Islamabad for 300 guests on Saturday under 200,000"*. The system understands the request, finds matching venues (vector search + your SQL filters), checks availability, and books through **tool calls to your existing API**, with tests, evals, logs and a live demo.

**Deliverable:** a deployed AI feature that is tested, measured and cannot book on behalf of someone else.

---

# Stage 8 — Later, Just in Time

Learn each only when a real need appears in BookEasy or a job requires it.

- **Redis:** caching the venue list, a shared rate-limit store (fixes the multi-instance limiter), session-adjacent data.
- **Queues and background jobs (BullMQ):** booking confirmation emails, reminders, report generation; retries, backoff, idempotent processing.
- **Idempotency keys and webhooks** (payments, third-party callbacks).
- **WebSockets / Server-Sent Events** for live availability.
- **System design:** learn by explaining BookEasy's failure points and scaling path; then study standard cases (URL shortener, rate limiter, booking system, notification system). Caching, queues, consistency, observability, trade-offs.
- **Cloud depth:** pick AWS (or the cloud your target employers use) and go deeper: networking, IAM, managed databases, infrastructure as code.
- **Advanced PostgreSQL, cherry-picked:** window functions, partitioning, replication concepts, `VACUUM`/bloat; internals (MVCC, WAL) only when a production problem needs them.
- **Data structures and algorithms:** a steady light routine for interviews (easy/medium patterns).
- **Python fundamentals:** a couple of weeks once AI work is underway, since much AI tooling and many tutorials assume it.

**Deliberately postponed:** Kubernetes, microservices, Kafka and brokers, sharding, training models, deep-learning math, learning multiple frameworks at once. They are valuable later and poor value now.

---

# Weekly rhythm

- **Study blocks** (official docs, small experiments), then **build blocks** (apply it to BookEasy). Aim for at least half your time building.
- **Job search runs in parallel:** a fixed number of applications per week and outreach from your software-house list; update the CV with the live URL as soon as Stage 2 is done.
- **Learn in public:** a short post per milestone (live deployment, first green CI, the cookie problem you solved, the concurrency test). These double as interview stories.
- **"End of day" notes** in your learning repo as you already do.

---

# Definition of done for this roadmap

- [ ] BookEasy frontend and backend are live on public URLs with HTTPS
- [ ] Sessions survive a page refresh in production (cookie strategy solved)
- [ ] Automated tests cover auth, authorization, slots, bookings, admin, concurrency and overlap
- [ ] Frontend component tests and at least one Playwright end-to-end flow
- [ ] GitHub Actions runs typecheck, migrations, tests (and Newman) on every pull request
- [ ] `main` is protected and deploys automatically after checks pass
- [ ] `docker compose up` runs the full system locally; CI builds the image
- [ ] Logs are readable, errors are tracked, uptime is monitored
- [ ] A backup has been restored successfully at least once
- [ ] The app uses a least-privilege database role
- [ ] README explains architecture, the two hard problems (double booking, overlapping slots), how to run, how to test, and links the live demo
- [ ] CV and LinkedIn link the live project

---

# Resources (official documentation first)

- Vitest, Supertest, React Testing Library, MSW, Playwright, Testcontainers documentation
- GitHub Actions documentation (workflows, service containers, environments, branch protection)
- Docker documentation: "Get started", "Dockerfile best practices", "Multi-stage builds", "Compose"
- Your chosen host's documentation: Vercel, Render or Railway or Fly.io, Neon or Supabase
- Cloud providers' "getting started" and "pricing calculator" pages (AWS, Google Cloud, Azure)
- Node.js and Express production best-practice guides (you have read Express's already)

*Provider prices, free tiers and regional availability change often. Always confirm on the provider's own pricing page before committing.*
