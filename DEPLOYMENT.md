# Deploy InvoicePro Kenya on Render

The GitHub repository **must stay private**. Render can deploy from a private repo after you connect GitHub. People use the public Render URL; they do not need GitHub access.

## Prerequisites

1. A [Render](https://render.com) account (sign in with GitHub is easiest).
2. Access to the private repo `Muikia/invoicepro-kenya`.
3. A Render **PostgreSQL** instance. Render no longer offers a free Postgres plan. `render.yaml` uses `basic-256mb`.
4. Optional: Resend or SMTP for real email; Africastalking for SMS.

## Environment variables

Copy from the repo root `.env.example` or `backend/.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Render sets this; Blueprint uses `10000` |
| `DATABASE_URL` | Yes | Internal Postgres URL from the Render database |
| `JWT_SECRET` | Yes | Long random secret (Blueprint can generate) |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `FRONTEND_URL` | Yes | Public site URL, e.g. `https://invoicepro-kenya.onrender.com` |
| `EMAIL_FROM` | No | From-address for receipts and password reset |
| `SUPPORT_EMAIL` | No | Shown on legal/support copy |
| `RESEND_API_KEY` | No | Sends email via Resend |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | No | Alternative email via SMTP |
| `AFRICASTALKING_API_KEY` / `AFRICASTALKING_USERNAME` | No | Kenya SMS |
| `PAYMENT_URL` | No | External upgrade payment page |

Do not put real secrets in Git. Set them in the Render dashboard.

## Connect GitHub to Render (exact clicks)

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in (GitHub login is fine).
2. Click **New +** → **Blueprint**.
3. If asked, **Connect GitHub** and grant Render access to the **private** repo `invoicepro-kenya` only. Do not make the repo public.
4. Select repository **`Muikia/invoicepro-kenya`**.
5. Branch: **`master`**.
6. Render reads `render.yaml` and should show:
   - PostgreSQL **`invoicepro-db`** (`basic-256mb`, database name `invoicepro`)
   - Web service **`invoicepro-kenya`** (Node, starter)
7. Confirm these Blueprint values:
   - Build: `npm --prefix backend install && npm --prefix frontend install --include=dev && npm --prefix frontend run build`
   - Start: `npm start --prefix backend`
   - Health check: `/api/health`
8. Auto-generated: `DATABASE_URL` (from `invoicepro-db`), `JWT_SECRET`.
9. You only need to enter optional secrets (email/SMS) if you want those features.
10. Click **Apply**.
11. After the first deploy, open `https://invoicepro-kenya.onrender.com/api/health`.
12. If your service URL is not exactly `invoicepro-kenya.onrender.com`, change `FRONTEND_URL` in the web service Environment tab to the real origin and click **Manual Deploy**.

### Manual setup (if you skip Blueprint)

1. **New** → **PostgreSQL** → name `invoicepro-db` → copy the **Internal Database URL**.
2. **New** → **Web Service** → connect the private GitHub repo.
3. Settings:
   - **Runtime:** Node
   - **Build:** `npm --prefix backend install && npm --prefix frontend install --include=dev && npm --prefix frontend run build`
   - **Start:** `npm start --prefix backend`
   - **Health check:** `/api/health`
4. Environment:
   - `NODE_ENV=production`
   - `DATABASE_URL` = Internal Database URL
   - `JWT_SECRET` = random 32+ character string
   - `FRONTEND_URL` = the `.onrender.com` URL Render assigns (set after first deploy if needed)
5. Deploy.

## PostgreSQL

- Use the **Internal** connection string for `DATABASE_URL` (stays on Render’s network).
- SSL is enabled automatically in production (`backend/knexfile.js`).
- Migrations run on boot (`db.migrate.latest()` in `backend/src/index.js`).
- After the first successful health check, tables for users, customers, invoices, inventory, and VAT exist.

## After deploy

1. Open `https://<your-service>.onrender.com/api/health`. Expect `{ "ok": true, ... }`.
2. Set `FRONTEND_URL` to that same origin if it is still blank, then **Manual Deploy**.
3. Open the site, sign up, create a customer and an invoice.
4. Optional: add `RESEND_API_KEY` or SMTP so password-reset emails actually send.

Starter web services sleep on the free/low tier. The first request after idle can take 30–60 seconds.

## Auto-deploy

`render.yaml` sets `autoDeploy: true`. Pushes to `master` on the connected private GitHub repo trigger a new Render build.

Optional GitHub Action: `.github/workflows/render-notify.yml` logs deploys. Add secret `RENDER_DEPLOY_HOOK` if you want GitHub to ping Render’s deploy hook.

See `RENDER_DEPLOYMENT_CHECKLIST.md` for the full go-live list.
