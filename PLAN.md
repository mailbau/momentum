# Momentum — Phase 1 Plan: Kanban Board

Momentum is a personal Kanban board for university students, built around Pintrich's four-phase Self-Regulated Learning (SRL) cycle. It is a fresh rebuild of the thesis app `self-regulated-learning` (Flask + MongoDB + Next.js Pages-era code).

Roadmap:
1. **Phase 1 — Kanban board (this plan)**
2. Phase 2 — Curriculum knowledge graph (Neo4j, multiple majors)
3. Phase 3 — Personalized student chatbot (grounded on board data + knowledge graph)

Phase 1 builds no code for phases 2 and 3. It only keeps the data shaped so they can attach later (stable course codes, a major/program table, and an event log of student activity).

---

## 1. What the old app did (feature inventory)

**Student**
- Register / login / logout, forgot + reset password (email link), edit profile, change password
- One board per user, four fixed columns mapped to SRL phases:
  `Planning (To Do)` → `Monitoring (In Progress)` → `Controlling (Review)` → `Reflection (Done)`
- Add card: pick course (name/code from admin list) + material title
- Drag-and-drop between and within columns; every column change logged (`column_movements`)
- Card detail: description, study timer (start/stop sessions, total minutes), pre-test and post-test grade, checklists, external links, priority (low→critical), difficulty (easy→expert), learning strategy (from admin list), notes/summary, 1–5 star reflection rating
- Stage gating in the card detail:
  - pre-test: editable everywhere except Reflection
  - post-test: Controlling or Reflection only
  - notes: Controlling or Reflection only
  - rating: Reflection only
  - timer: disabled in Reflection
  - delete: only if timer is not running (or card is in Reflection)
- Archive card, view archived cards, restore, delete
- File attachments per card (upload/download)
- Analytics: total/done/completion %, cards per stage (doughnut), top 3 strategies with most-used course, pre vs post average per course, strategy box plots (min/q1/median/q3/max), top courses by card count
- Empty-column prompts ("Planning is empty! Do you have any new tasks…")
- Demo mode (localStorage mock API, no backend)
- Chatbot bubble (placeholder only, no logic)

**Admin**
- CRUD courses (code + name), CRUD learning strategies (name + description)
- List users, view a user's profile and board read-only, view card movement history with time spent per column
- Auth logs (login/logout)

## 2. Problems in the old app (fix by design, not by porting)

| Problem | Fix in Momentum |
|---|---|
| Admin endpoints (`/users`, `/boards`, `/board/<id>`, `/delete-user`, `/logs`, `/debug/users`, course/strategy CRUD) had no auth or role check | Role middleware on every admin route; no debug routes |
| Whole board overwritten on every drag (`update-board` sends all lists) — race conditions, lost edits across tabs | Per-card `PATCH /cards/{id}/move` with stage + position; server writes the event row in the same transaction |
| Course derived by parsing card title `"Name [CODE]"` | `cards.course_id` foreign key |
| Grades stored as strings | `numeric(5,2)` with 0–100 check |
| Optimistic move had no rollback | TanStack Query optimistic update with `onError` rollback + toast |
| Stage gating only in the UI | Same rules enforced in the API |
| Analytics computed in Python loops over the whole board | SQL aggregates (`count … group by`, `percentile_cont`) |
| Timer sessions could be left open forever | One open session per user enforced by a partial unique index; stopping is idempotent |

## 3. Expert-validation gaps (from the thesis, Table 4.2)

The psychologist found features "present but passive." Candidate improvements, each small:

1. **Prior-knowledge prompt** — free text "What do I already know about this?" next to pre-test
2. **Understanding self-rating** (Feeling of Knowing / Judgement of Learning) — 1–5 scale, asked when moving into Monitoring and again into Reflection
3. **Archive reason** — short required reason when archiving ("no longer relevant to my goal", etc.)
4. **Pomodoro mode** — countdown option on the timer alongside the stopwatch
5. **Onboarding tour** — a first-login walkthrough explaining what each column means in SRL terms
6. **Stage-transition prompts** — light nudges on move (e.g. moving to Reflection opens post-test + notes)

Decision needed: which of these go in v1 (see §10).

## 4. Stack

**Monorepo**
```
momentum/
  backend/     Go API
  frontend/    Next.js app
  docker-compose.yml   (local Postgres)
  PLAN.md
```

**Backend — Go**
- Go 1.24+, stdlib `net/http` with 1.22+ pattern routing (`mux.HandleFunc("PATCH /cards/{id}", …)`). No web framework.
- `pgx/v5` + `sqlc` for typed queries from plain SQL
- `goose` for migrations (SQL files)
- Auth: short-lived JWT access token (15 min) in memory on the client + refresh token in an httpOnly, Secure, SameSite cookie, stored hashed in `refresh_tokens` so logout/revoke works. Passwords hashed with bcrypt.
- Validation at the handler boundary; `slog` structured logging
- Config from env vars only

**Frontend — Next.js**
- Next.js (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (UI direction comes from your design skills; this plan only fixes structure)
- `@dnd-kit` for drag-and-drop (react-beautiful-dnd is unmaintained)
- TanStack Query for server state, optimistic moves, rollback
- Recharts for analytics
- React Hook Form + Zod for forms
- Route groups: `(auth)`, `(student)`, `(admin)`; route guard in `middleware.ts` using a role claim

**Database — PostgreSQL 16** (local via Docker; hosted Neon or Supabase later)

## 5. Data model

Single board per user with four fixed SRL columns, so there is no `boards` or `lists` table: a card's `stage` is an enum and its order is `position`.

```sql
create type user_role  as enum ('student', 'admin');
create type srl_stage  as enum ('planning', 'monitoring', 'controlling', 'reflection');
create type difficulty as enum ('easy', 'medium', 'hard', 'expert');
create type priority   as enum ('low', 'medium', 'high', 'critical');

-- Multi-curriculum hook for phase 2. One row ("Information Technology") for now.
create table programs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  username citext unique not null,
  password_hash text not null,
  first_name text not null,
  last_name text not null,
  role user_role not null default 'student',
  program_id uuid references programs(id),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash bytea unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table password_resets (
  token_hash bytea primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  code text not null,            -- stable key; phase 2 graph nodes map to this
  name text not null,
  unique (program_id, code)
);

create table learning_strategies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text not null default ''
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id),
  strategy_id uuid references learning_strategies(id),
  title text not null,                       -- the material/topic
  description text not null default '',
  stage srl_stage not null default 'planning',
  position double precision not null,        -- fractional ordering within a stage
  difficulty difficulty not null default 'easy',
  priority priority not null default 'medium',
  pre_test numeric(5,2) check (pre_test between 0 and 100),
  post_test numeric(5,2) check (post_test between 0 and 100),
  prior_knowledge text not null default '',  -- §3.1, if in scope
  notes text not null default '',
  rating smallint check (rating between 1 and 5),
  archived_at timestamptz,
  archive_reason text,                       -- §3.3, if in scope
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on cards (user_id, stage, position) where archived_at is null;

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null
);

create table card_links (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  url text not null,
  label text not null default ''
);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_open_session_per_user on study_sessions (user_id) where ended_at is null;

-- Append-only log of student behaviour. Powers analytics, admin history, and later the chatbot.
create table events (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,
  type text not null,      -- login, logout, card_created, card_moved, card_archived, ...
  data jsonb not null default '{}',   -- e.g. {"from":"planning","to":"monitoring"}
  created_at timestamptz not null default now()
);
create index on events (user_id, created_at);
create index on events (card_id, created_at);
```

Simplifications versus the old app:
- Old cards had multiple titled checklists; Momentum has one flat checklist per card.
- Card deletion is a real delete (archive is the soft state). The old app had both `archived` and `deleted` flags.
- File attachments are left out of v1; links cover most of the use. Add them back if students ask (needs object storage such as R2/S3).
- `column_movements`, auth logs, and other activity collapse into a single `events` table.

## 6. API (v1)

All JSON. `/api` prefix. Student routes act on the caller's own data only.

**Auth**
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh          (cookie)
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

**Me**
```
GET   /api/me
PATCH /api/me                   (name, email, username)
PUT   /api/me/password
POST  /api/me/onboarded
```

**Board and cards**
```
GET    /api/board                       active cards grouped by stage (with checklist counts)
POST   /api/cards                       {course_id, title}  → lands at end of planning
GET    /api/cards/{id}                  full detail incl. checklist, links, total study minutes
PATCH  /api/cards/{id}                  editable fields; stage gating enforced
PATCH  /api/cards/{id}/move             {stage, position} → writes card_moved event in same tx
POST   /api/cards/{id}/archive          {reason}
POST   /api/cards/{id}/restore
DELETE /api/cards/{id}
GET    /api/cards/archived

POST   /api/cards/{id}/checklist        PATCH/DELETE /api/checklist/{itemId}
POST   /api/cards/{id}/links            DELETE /api/links/{linkId}

POST   /api/cards/{id}/sessions/start
POST   /api/sessions/stop               stops the caller's open session
GET    /api/sessions/active
```

**Lookups (any signed-in user)**
```
GET /api/courses
GET /api/strategies
```

**Analytics**
```
GET /api/analytics/summary     totals, done, completion %, cards per stage
GET /api/analytics/strategies  usage count + most-used course, pre/post box-plot stats
GET /api/analytics/courses     pre/post averages, card counts, study minutes
```

**Admin (role = admin)**
```
GET/POST/PATCH/DELETE /api/admin/courses[/{id}]
GET/POST/PATCH/DELETE /api/admin/strategies[/{id}]
GET  /api/admin/users?q=&page=
GET  /api/admin/users/{id}
GET  /api/admin/users/{id}/board
GET  /api/admin/cards/{id}/history        moves + time spent per stage
GET  /api/admin/events?type=&page=
```

## 7. Frontend pages

```
(auth)     /login  /register  /forgot-password  /reset-password
(student)  /board            board + card detail (sheet or dialog) + archived drawer
           /insights         analytics dashboard
           /settings         profile + password
(admin)    /admin/courses  /admin/strategies  /admin/users  /admin/users/[id]  /admin/activity
/          landing page (public)
```

The chatbot bubble from the old app is not rebuilt in phase 1.

## 8. Milestones

Each milestone ends with a working, testable slice. Verify before moving on.

**M0 — Scaffold**
- Monorepo folders, `docker-compose.yml` with Postgres, Go module, Next.js app, `.env.example` for both, `.gitignore`
- Backend `/healthz`, migrations run on startup in dev
- Done when: `docker compose up` + `go run` + `npm run dev` work and the frontend reaches `/healthz`

**M1 — Auth**
- Migrations: programs, users, refresh_tokens, password_resets, events
- Register, login, refresh, logout, me; role middleware; seed admin + IT program
- Frontend: login/register pages, auth context, silent refresh, route guards
- Done when: register → login → reload stays signed in → logout; student cannot reach `/admin` or `/api/admin/*`

**M2 — Board core** ✅ done
- Migrations: courses, strategies, cards; seed courses and strategies from the old app's data
- Board, create card, move (with fractional position), archive/restore/delete
- Frontend: four SRL columns, add-card form, dnd-kit drag with optimistic update + rollback, empty-column prompts, archived drawer
- Verified: moving a card survives reload, writes a `card_moved` event, create/move/archive/restore/delete all tested end-to-end against the live API

**M3 — Card detail** ✅ done
- Checklist, links, grades, strategy/priority/difficulty, notes, rating, study timer, stage gating server-side
- Shipped from §3: prior-knowledge prompt (planning only), archive reason (required), onboarding tour deferred to M6 alongside the rest of account extras
- Pomodoro countdown mode deferred — current timer is stopwatch-only (start/stop, minutes logged); add the countdown variant when revisiting the timer UI
- Verified: every gating rule (pre-test, post-test, notes, rating, prior-knowledge, delete-while-timer-running) rejected by the API when tried from the wrong stage; checklist/links/timer CRUD all tested end-to-end

**M4 — Analytics (Insights)**
- SQL aggregates + three endpoints; frontend charts (stage distribution, strategy usage, pre/post per course, box plots, study minutes)
- Done when: numbers match a hand-checked seeded dataset

**M5 — Admin**
- Course/strategy CRUD, user list/search, read-only user board, card history with time-per-stage, activity log
- Done when: admin can do everything in §1 Admin; all admin routes 403 for students

**M6 — Account extras**
- Profile edit, password change, forgot/reset via email (Resend or SMTP), onboarding tour
- Done when: reset link works end to end and expires after one use / one hour

**M7 — Polish + deploy**
- Seeded demo account (replaces the old localStorage demo mode), loading/empty/error states, mobile layout check, deploy
- Done when: deployed URL works for a fresh student and the demo account

## 9. Testing

- Go: handler tests against a real Postgres (docker-compose test DB), one test file per handler group covering the happy path, auth/ownership checks, and stage-gating rejections
- Analytics: one test seeding known cards and asserting the aggregates
- Frontend: Playwright smoke test for register → add card → drag → open detail → insights, added at M7

## 10. Decisions (resolved)

1. **Expert-validation improvements (§3)** — ship 1 (prior-knowledge text), 3 (archive reason), 4 (pomodoro), 5 (onboarding) in v1. Skip 2 (double understanding-rating) and 6 (stage-transition prompts) until there's real usage data.
2. **Login identifier** — accept email or username.
3. **Language** — English UI only.
4. **Courses** — students pick from the admin-curated list only, no self-add.
5. **Multi-board** — one board per student, no per-semester boards.
6. **Hosting** — deferred to M7 (frontend on Vercel; backend on Fly.io/Railway/Render; Postgres on Neon/Supabase).
