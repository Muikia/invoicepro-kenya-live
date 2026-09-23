# Render deployment checklist — InvoicePro Kenya

Keep `Muikia/invoicepro-kenya` **private**. Deploy from GitHub; share only the Render URL.

## Pre-deployment

- [ ] GitHub repo is private (`gh repo view --json isPrivate`)
- [ ] `master` is up to date (`git status` clean, pushed)
- [ ] `render.yaml` exists at repo root
- [ ] Root `package.json` has `build` and `start`
- [ ] Backend `package.json` `start` is `node src/index.js`
- [ ] Frontend `package.json` `build` is `vite build`
- [ ] `backend/.env.example` and root `.env.example` list all variables
- [ ] No `.env` files are committed
- [ ] Health route is `GET /api/health`
- [ ] Production uses SSL for Postgres

## Configuration on Render

- [ ] Render account signed in with GitHub
- [ ] Private repo `invoicepro-kenya` granted to Render (not made public)
- [ ] Blueprint applied **or** web service + Postgres created manually
- [ ] `DATABASE_URL` is the **internal** Postgres URL
- [ ] `JWT_SECRET` is a long random value
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` matches the public `https://….onrender.com` origin
- [ ] Optional email: `RESEND_API_KEY` or SMTP trio
- [ ] Optional SMS: `AFRICASTALKING_API_KEY` + `AFRICASTALKING_USERNAME`
- [ ] Auto-deploy from `master` enabled

## Build and start (expected)

- Build: `npm --prefix backend install && npm --prefix frontend install --include=dev && npm --prefix frontend run build`
- Start: `npm start --prefix backend`
- App serves API under `/api` and the Vite `frontend/dist` SPA

## Testing after deploy

Hit these on the public host (replace with your URL):

| Check | URL | Expect |
| --- | --- | --- |
| Health | `/api/health` | `200` `{ "ok": true, "database": true }` |
| Landing | `/` | InvoicePro landing page |
| Signup | `/signup` | Create-account form |
| Login | `/login` | Login form |
| Unknown API | `/api/does-not-exist` | `404` JSON, no stack trace |

Then in the browser:

- [ ] Sign up a Kenyan shop (email, `+254` phone, password with uppercase + number)
- [ ] Land on the dashboard (email verification is not required)
- [ ] Add a customer (optional: mark repeat)
- [ ] Create an invoice in KSh
- [ ] Print / open receipt
- [ ] Log out and log in again

## Health check payload

`GET /api/health` should look like:

```json
{
  "status": "ok",
  "ok": true,
  "service": "invoicepro-kenya",
  "env": "production",
  "database": true,
  "time": "2026-08-19T12:00:00.000Z"
}
```

`database: false` or HTTP 503 means `DATABASE_URL` or SSL is wrong.

## Rollback

- Render → service → **Manual Deploy** → pick a previous successful deploy
- Or revert the Git commit on `master` (repo stays private) and let auto-deploy run
