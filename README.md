# Clave Bathhouse

Clave Bathhouse is a mobile-first booking app for sauna, plunge, steam, recovery sessions, passes, vouchers, and staff check-in operations.

## Stack

- `packages/client`: React + Vite PWA, Vercel API routes, and Stripe checkout integration points
- `packages/shared`: legacy shared simulation package retained until the app is fully separated from the earlier prototype
- `packages/signal-server`: legacy signaling package retained until removed from the workspace
- Backend: Vercel Serverless Functions with Neon Postgres storage
- Payments: Stripe Checkout and Stripe webhook scaffolding

## Commands

```bash
npm install
npm run dev
npm run build:vercel
npm test
```

## Required Environment

Set these values in Vercel before production use:

```bash
POSTGRES_URL=... # Neon pooled Postgres connection string
AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://clave-bathhouse-client.vercel.app/api/auth/google/callback
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=https://clavebathhouse.com
```

## Current Product Direction

- Real email/password auth with signed HttpOnly sessions
- Role-aware access for customers, staff, and admins
- Server-owned persistence instead of trusting browser-only state
- Stripe-hosted payment collection before booking confirmation
- PWA install and offline app-shell caching
