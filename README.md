# NStarX Intake App

Next.js 14 (App Router) public intake form and admin dashboard. Built with TypeScript strict mode, Tailwind CSS, shadcn/ui components, and Drizzle ORM on PostgreSQL.

## Brand tokens
- Primary purple: `#6464B4`
- Ink navy text: `#333F50`
- Lime accent: `#8CB428`
- Sky accent: `#64A0DC`
- Amber accent: `#E69138`
- Background: `#F4F6F9`

## Fonts
- Headings: Montserrat Black (900)
- Body: Nunito Sans

## Local development

```bash
cp .env.example .env
# edit .env with real secrets
npm install
npm run dev
```

The dev server starts on http://127.0.0.1:3000.

## Scripts
- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — lint
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:migrate` — run Drizzle migrations
- `npm run db:seed` — seed admin users from env passwords
- `npm run test:intake` — end-to-end intake submission test (spins up dev server)
- `node scripts/test-deployed-intake.js` — verify a deployed Docker app accepts submissions and writes files

## Production deployment

Prerequisites on the Linux host:
- Docker and Docker Compose installed
- PostgreSQL reachable on `127.0.0.1:5434/nstarx_intake`
- The uploads directory exists and is writable by uid 1000:
  `/mnt/hikvision/Shantanu/Work/NStarX-Intake-Uploads`

### 1. Configure secrets

```bash
cd /mnt/hikvision/Shantanu/Work/NStarX-Intake-App
cp .env.example .env
# Set DATABASE_PASSWORD, ADMIN_SHANTANU_PASSWORD, ADMIN_SUJAY_PASSWORD,
# SESSION_SECRET, SENDGRID_API_KEY, and NEXT_PUBLIC_BASE_URL.
```

### 2. Build and start the stack

```bash
sudo docker compose build
sudo docker compose up -d
```

The first startup runs Drizzle migrations and reseeds admin credentials from env.

**Note on networking:** this host's Docker bridge endpoint creation is currently
broken (`iptables INVALID_IPV`), so the compose file uses `network_mode: host`
for both the app and Caddy containers. On a normal host you can switch back to
bridge networking and proxy to the `app` service by name.

Ports used:
- App: `127.0.0.1:8090`
- Caddy HTTP redirect: `0.0.0.0:8089`
- Caddy HTTPS: `0.0.0.0:8444`

### 3. Add the DNS record

Shantanu creates a Cloudflare DNS `A` record for `nstarx-intake.kamkazi.com`
pointing to this host's public IP.

### 4. Route Cloudflare to the origin

Create or update a Cloudflare tunnel so that `https://nstarx-intake.kamkazi.com`
proxies to the Caddy HTTPS listener on this host:

```
https://nstarx-intake.kamkazi.com  ->  https://<host-ip>:8444
```

Caddy presents an internal (self-signed) certificate. If Cloudflare TLS mode is
set to "Full" this is fine; if it is "Full (strict)" you must give Caddy a valid
origin certificate from Cloudflare or use Cloudflare's authenticated origin
pulls.

### 5. Verify

- Public intake: https://nstarx-intake.kamkazi.com/
- Admin login: https://nstarx-intake.kamkazi.com/login
- Dashboard: https://nstarx-intake.kamkazi.com/dashboard

Run the verification scripts after deploy:

```bash
set -a && source .env && set +a
bash scripts/verify-auth-all-criteria.sh
bash scripts/verify-dashboard-shell.sh
bash scripts/verify-requests-list.sh
bash scripts/verify-workflow-api.sh
bash scripts/verify-request-detail.sh
node scripts/test-deployed-intake.js
```

Local HTTPS smoke test (accepts Caddy's internal certificate):

```bash
printf 'GET /login HTTP/1.1\r\nHost: nstarx-intake.kamkazi.com\r\nConnection: close\r\n\r\n' \
  | openssl s_client -connect 127.0.0.1:8444 -servername nstarx-intake.kamkazi.com -quiet 2>/dev/null \
  | head -1
# should print: HTTP/1.1 200 OK
```

## Email notifications

The app sends four kinds of email through SendGrid (`lib/email.ts`):

| Trigger | Recipients | Template |
| --- | --- | --- |
| New submission | `ADMIN_NOTIFY_EMAILS` | `renderAdminNotificationEmail` |
| New submission | the submitter's address | `renderSubmitterConfirmationEmail` |
| Request assigned | the assignee's mapped address | inline assignee template |
| New comment | `ADMIN_NOTIFY_EMAILS` | inline comment template |

Configuration (`.env`):

- `SENDGRID_API_KEY` — required. If it is empty the app logs
  `[email] EMAIL DISABLED — SENDGRID_API_KEY is empty ...` and sends nothing.
  This was the original cause of "no emails arriving".
- `SENDGRID_FROM_EMAIL` — sender address (default
  `noreply@nstarx-intake.kamkazi.com`). It must be a SendGrid-verified sender or
  on an authenticated sending domain for reliable inbox placement.
- `EMAIL_REDIRECT_TO` — optional dev/test safety switch. When set, every
  outbound message goes to that single address and the intended recipients are
  recorded in the subject and body. Leave it **empty** in production so
  submitters receive their own confirmations.
- `ADMIN_NOTIFY_EMAILS` — comma-separated admin recipients. Test/dev
  deployments must only list the placeholder recipient `shantanu@kamkazi.com`.
- `ASSIGNEE_SHANTANU_EMAIL` / `ASSIGNEE_SUJAY_EMAIL` — assignee notification
  addresses; keep both on the placeholder recipient for test/dev.

Every send logs its outcome to stdout (`docker logs nstarx-intake-app`):
`[email] admin notification for <ref> accepted by SendGrid for <to> (message-id=...)`
on success and the SendGrid status/body on failure.

Verify delivery:

```bash
node scripts/test-email.js             # template + service unit tests (no network)
node scripts/test-email-delivery.js    # live send through the app's mail module
```

## Uploads

Intake attachments are stored under `UPLOAD_DIR` (default
`/mnt/hikvision/Shantanu/Work/NStarX-Intake-Uploads`) in subdirectories named by
request id. The compose file bind-mounts this path into the container.

## Security notes
- Session cookies are httpOnly, Secure in production, and SameSite=Lax.
- Admin passwords are stored as scrypt hashes.
- The `.env` file is git-ignored and contains secrets; never commit it.
- The Caddyfile uses `tls internal`. For public trust, replace with a real
  certificate or let Cloudflare terminate TLS and proxy to HTTP.
