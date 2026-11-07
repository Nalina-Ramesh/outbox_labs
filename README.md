# ReachInbox Scheduler

ReachInbox Scheduler is a local email campaign scheduler. Create an account, connect an SMTP sending account, upload a recipient list, and schedule messages. A background worker sends the messages at the requested time while Redis tracks sender limits. PostgreSQL stores users, sender settings, campaigns, and message status.

## What happens when you use it

1. Create an account or sign in with an email and password. Passwords are stored as salted hashes.
2. In **Compose**, connect an SMTP sender. The backend checks the SMTP connection before saving it. The SMTP password is encrypted at rest using a key derived from `JWT_SECRET`.
3. Compose a campaign and upload a plain text or one-column CSV file with one email address per line. Use no header row or extra columns.
4. The backend creates the campaign and scheduled message records in PostgreSQL, then adds delayed jobs to BullMQ, which uses Redis.
5. The worker picks up each job, applies the sender's hourly limit, and sends the email using SMTP. It updates message status in PostgreSQL and indexes delivery details in Elasticsearch.

The frontend is a Next.js app, the API and worker are separate Node.js processes, and PostgreSQL, Redis, and Elasticsearch run locally in Docker.

## Architecture

```text
Next.js frontend (localhost:3000)
        | HTTP + session cookie
        v
Express API (localhost:4000) ---- PostgreSQL
        |                              campaign, email, user, SMTP account records
        +---- BullMQ queue ---- Redis
                    |
                    v
             BullMQ email worker ---- SMTP provider (Ethereal for testing)
                    |
                    +---- Redis sender rate-limit counters
                    +---- Elasticsearch delivery index
```

### Scheduling and persistence

When a campaign is submitted, the API validates the recipient file, creates a campaign and one scheduled email row per recipient in PostgreSQL, then creates a delayed BullMQ job for each email in Redis. The target time for recipient number `n` is the campaign start time plus `(n - 1) × delaySeconds`.

PostgreSQL is the durable source of campaign and email state. On API startup, `synchronizeSchedulerState()` scans emails still marked `SCHEDULED` or `PENDING_RETRY`; if the corresponding BullMQ job is missing, it recreates it using the stored `scheduledFor` time. Redis also stores the queue jobs and is backed by a Docker volume in the local Compose setup. The recovery scan can rebuild missing jobs from PostgreSQL after a Redis restart.

The worker loads each job's email and sender details from PostgreSQL, checks the sender's hourly limit, waits for the configured delay after dequeuing, sends over SMTP, and updates the email status. Because the delay is also used to offset each job's target time, the actual delivery cadence depends on worker concurrency and can be longer than the configured interval. BullMQ is configured for three attempts with exponential backoff; successful and failed queue records are retained for one day and seven days, respectively. A rate-limited message is separately rescheduled for when the sender's rolling hour window allows it.

### Rate limiting and concurrency

The worker uses a Redis sorted set per sender to record send timestamps. Before sending, it removes entries older than one hour and compares the remaining count with the campaign's hourly limit. When at the limit, the email is rescheduled for when the oldest send expires from that window. Slack alerts are optional and throttled with a Redis lock.

Worker concurrency is controlled by `WORKER_CONCURRENCY` (default `10`). This is the maximum number of BullMQ jobs that one worker process handles concurrently; it is separate from the per-sender hourly cap and the campaign's delay between messages. Each active job holds a worker slot while it waits for its send delay and SMTP operation. Running more than one worker process increases total parallelism.

## Requirements

- Node.js 20.9 or newer and npm
- Docker Desktop with Docker Compose
- An Ethereal Email test account (recommended for local testing) or another SMTP account

## First-time setup (Windows PowerShell)

Run commands from the repository root.

### 1. Install packages

```powershell
npm install
```

### 2. Start local services

Make sure Docker Desktop is running, then start PostgreSQL, Redis, and Elasticsearch:

```powershell
docker compose up -d
```

The Compose file creates a local PostgreSQL database named `outbox_labs` with the development user `postgres` and password `postgres`. These are local development credentials; do not expose this setup to the public internet.

### 3. Configure environment files

Create these files from the examples. If a file already exists, edit it rather than overwriting it:

```powershell
Copy-Item apps\backend\.env.example .env
Copy-Item apps\backend\.env.example apps\backend\.env
Copy-Item apps\frontend\.env.example apps\frontend\.env.local
```

The root `.env` is used by Prisma commands run from the repository root. `apps/backend/.env` is used by the API and worker. Keep `DATABASE_URL` and `JWT_SECRET` the same in both backend environment files.

Set `DATABASE_URL` in both `.env` files to match the included Docker Compose database:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/outbox_labs?schema=public
```

Generate a secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copy the output into `JWT_SECRET` in **both** `.env` files. Keep this value private and stable: changing it logs users out and prevents the worker from decrypting already-saved SMTP passwords, so sender accounts must be reconnected after a change.

The backend example has local defaults for Redis (`127.0.0.1:6379`) and Elasticsearch (`127.0.0.1:9200`). The frontend example points to the local API at `http://localhost:4000`. Keep `FRONTEND_ORIGIN=http://localhost:3000` in the backend environment. Use `localhost` consistently in the browser rather than switching to `127.0.0.1`.

Slack OAuth settings are optional. To use Slack alerts, configure `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI` in `apps/backend/.env` with values from your Slack app. Otherwise, leave the example defaults; email scheduling does not require Slack.

### Environment variables

The backend validates these values in `apps/backend/src/config/environment.ts`. Redis and Elasticsearch URLs have local defaults, so they can be omitted for the included Compose setup.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend, worker, Prisma | PostgreSQL connection string; set in root `.env` for Prisma commands and `apps/backend/.env` for the backend processes |
| `JWT_SECRET` | Backend, worker | At least 32 characters; signs sessions and derives the key used to encrypt saved SMTP passwords. Keep identical and stable in both backend env files |
| `PORT` | Backend | API port; default `4000` |
| `FRONTEND_ORIGIN` | Backend | Allowed browser origin; local default `http://localhost:3000` |
| `REDIS_URL` | Backend, worker | BullMQ queue and rate-limit Redis connection; default `redis://127.0.0.1:6379` |
| `ELASTICSEARCH_URL` | Worker | Elasticsearch endpoint used for delivery indexing; default `http://127.0.0.1:9200` |
| `WORKER_CONCURRENCY` | Worker | Concurrent BullMQ jobs per worker process; default `10` |
| `SLACK_CLIENT_ID` | Backend | Optional Slack OAuth app client ID |
| `SLACK_CLIENT_SECRET` | Backend | Optional Slack OAuth app secret |
| `SLACK_REDIRECT_URI` | Backend | Optional Slack OAuth callback URL |
| `NEXT_PUBLIC_API_URL` | Frontend | API base URL; local example is `http://localhost:4000` |

SMTP credentials are **not** environment variables in this app. Enter them in **Compose → Connect a sending account**; the backend verifies the connection and stores the SMTP password encrypted in PostgreSQL. Do not put SMTP credentials in the frontend env file.

### 4. Generate the Prisma client and apply migrations

```powershell
npx prisma generate --schema apps/backend/prisma/schema.prisma
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
```

## Run the application

Open **three separate PowerShell terminals** at the repository root and leave each process running:

**Terminal 1 — API server**

```powershell
npm run dev:backend
```

**Terminal 2 — email worker**

```powershell
npm run dev:worker
```

**Terminal 3 — frontend**

```powershell
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000), create an account, then use **Compose** to connect your sender and schedule a campaign. The API runs at `http://localhost:4000`.

## Deploy the frontend to Vercel

Vercel should host the Next.js frontend only. The Express API and BullMQ worker are long-running services and need a separate Node.js host; PostgreSQL, Redis, and Elasticsearch must also be reachable by that host.

1. Import this repository into Vercel and set **Root Directory** to `apps/frontend`. Leave the framework preset as **Next.js** and use the default build settings.
2. Set `NEXT_PUBLIC_API_URL` in the Vercel project to the public HTTPS URL of the deployed API (without a trailing slash). It is embedded in the frontend bundle, so it is public and must not contain secrets. Configure it for each Vercel environment you use.
3. Configure the backend with `FRONTEND_ORIGIN` set to the exact deployed frontend origin (for example, `https://your-project.vercel.app`), plus production PostgreSQL, Redis, Elasticsearch, and a stable `JWT_SECRET`. Run the Prisma migrations against the production database, then start both the API and the separate worker process.
4. Set `NODE_ENV=production` on the backend. Production session cookies require HTTPS and use `SameSite=None` so credentialed frontend-to-API requests can send them. The backend CORS origin must exactly match `FRONTEND_ORIGIN`. Browser privacy settings may block cross-site cookies; using frontend and API custom domains on the same site is recommended.
5. If Slack alerts are used, set `SLACK_REDIRECT_URI` to the public API URL followed by `/api/slack/callback` and configure the same URL in the Slack app.

The Vercel deployment does not run the API, queue, or email worker. The queue monitor link in the dashboard points to the configured API host.

## Test email with Ethereal

Ethereal is a fake SMTP service for development: messages are captured in a preview inbox and are **not delivered to real recipients**.

1. Generate a test account from the repository root:

   ```powershell
   node -e "require('nodemailer').createTestAccount().then(a => console.log(JSON.stringify({ email: a.user, username: a.user, password: a.pass, host: a.smtp.host, port: a.smtp.port }, null, 2))).catch(e => { console.error(e.message); process.exit(1); })"
   ```

   This contacts Ethereal and prints temporary test SMTP credentials in your terminal. Keep the output private. You can also create a test account at [ethereal.email](https://ethereal.email/).
2. Sign into ReachInbox at `http://localhost:3000`, open **Compose**, then choose **Connect a sending account**.
3. Enter the generated Ethereal account details:

   | Compose field | Value |
   | --- | --- |
   | Sender email | The generated `email` value |
   | SMTP host | The generated `host` value (normally `smtp.ethereal.email`) |
   | SMTP port | The generated `port` value (normally `587`) |
   | SMTP username | The generated `username` value |
   | SMTP password | The generated `password` value |

4. Click **Verify and connect**. Compose the campaign with test recipient addresses and schedule it.
5. Once the worker processes the messages, sign into Ethereal's web interface with that same test account to inspect the captured messages.

Ethereal credentials are saved with the sender account in PostgreSQL, not in `.env`. Use port `587` for STARTTLS, or port `465` if the provider specifically requires implicit TLS. The application marks port `465` as secure automatically.

For real Gmail sending instead, use `smtp.gmail.com`, port `587`, your full Gmail address as both sender and SMTP username, and a Google App Password (not your regular Google password). Other providers have their own SMTP settings. The app verifies SMTP connectivity before saving a sender.

## Useful commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev:backend` | Start the API server |
| `npm run dev:worker` | Start the email queue worker |
| `npm run dev:frontend` | Start the Next.js frontend |
| `npm run build --workspace=backend` | Build the backend |
| `npm run build --workspace=frontend` | Build the frontend |
| `npx prisma studio --schema apps/backend/prisma/schema.prisma` | Open Prisma Studio |
| `docker compose down` | Stop local service containers |
| `docker compose down -v` | Stop containers and delete local database/search data |

Use the last command only if you intentionally want to erase the local PostgreSQL and Elasticsearch data.

## Project layout

```text
apps/
  backend/
    prisma/       Database schema and migrations
    src/
      config/     Environment validation
      controllers/ API handlers
      middlewares/Authentication and request handling
      queue/      BullMQ setup and email worker
      routes/     API routes
      services/   Rate limits, search indexing, Slack integration
      utils/      SMTP credential encryption and parsing helpers
  frontend/
    src/app/      Login, signup, and dashboard pages
    src/components/Compose and dashboard UI
docker-compose.yml
```

## Implemented features

### Backend

- **Authentication:** email/password signup and login, salted password hashes, HTTP-only JWT session cookies, logout, and authenticated API routes.
- **Sender accounts:** SMTP connection verification before saving; SMTP passwords are encrypted at rest.
- **Scheduler:** campaign creation, recipient validation, one PostgreSQL email record and one delayed BullMQ job per recipient.
- **Persistence and recovery:** campaign/email state persists in PostgreSQL; API startup reconciles active scheduled rows with the Redis-backed BullMQ queue and recreates missing jobs.
- **Rate limiting:** rolling one-hour send counts per sender stored in Redis sorted sets; jobs are rescheduled when the sender reaches the campaign's hourly cap.
- **Concurrency and retries:** configurable BullMQ worker concurrency, per-campaign inter-send delays, and up to three queue attempts with exponential backoff.
- **Status/integrations:** PostgreSQL email status updates, Elasticsearch delivery indexing, and optional Slack alerts for rate-limit events.
- **Queue monitoring:** authenticated Bull Board UI at `http://localhost:4000/admin/queues`.

### Frontend

- **Login and signup:** email/password forms that use the backend session-cookie auth flow.
- **Dashboard:** authenticated workspace with scheduled and sent/failed message views, sender identity, counts, refresh, and sign out.
- **Compose:** connect/change an SMTP sender, build a campaign, upload recipient files, set subject/body, per-message delay, hourly cap, and scheduled time.
- **Message table/list:** recipient, status, subject, body preview, and timestamp rows; open a message to inspect its details and delivery error.
- **Search:** search messages by recipient, campaign subject/body, or status using the backend's PostgreSQL query.
- **Queue monitor link:** open the backend Bull Board dashboard.

## Troubleshooting

- **API cannot connect to PostgreSQL or Redis:** confirm Docker Desktop is running and `docker compose ps` shows the services. Check the matching ports and `DATABASE_URL`.
- **Login or requests fail:** make sure the API is running, `FRONTEND_ORIGIN` is `http://localhost:3000`, and frontend `NEXT_PUBLIC_API_URL` is `http://localhost:4000`.
- **SMTP verification fails:** for Ethereal, use `smtp.ethereal.email`, port `587`, and the generated Ethereal username/password. Check that the username/password belong to the same test account.
- **Ethereal messages do not arrive in a real inbox:** that is expected; Ethereal captures messages for preview and does not deliver them.
- **Messages stay scheduled:** confirm the worker is running and Redis is healthy. Check the API/worker terminal for errors.
- **Next.js reports a file lock under OneDrive:** stop duplicate dev servers. If it continues, move the project to a folder not synchronized by OneDrive.

Only send to recipients who have given permission, and respect your email provider's sending limits and applicable anti-spam laws. Do not commit `.env` files or share database, JWT, Slack, or SMTP credentials.
