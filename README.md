# Clave Bathhouse

Clave Bathhouse is a mobile-first booking app for sauna, plunge, steam, recovery sessions, passes, vouchers, and staff check-in operations.

## Stack

- `packages/client`: React + Vite PWA, Vercel API routes, and Stripe checkout integration points
- `packages/shared`: shared domain utilities retained while the production client is separated from older workspace packages
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
FIRST_ADMIN_EMAIL=owner@example.com
FIRST_ADMIN_NAME=Owner Name
FIRST_ADMIN_PASSWORD=optional-temporary-password
ENABLE_DEMO_SEED=false
RESEND_API_KEY=...
EMAIL_FROM=Clave Bathhouse <bookings@your-domain.com>
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
- Production-safe first-admin setup through environment variables
- Admin-visible `/api/health` checks for database, auth, email, Google, and app URL configuration
- Stripe-hosted payment collection before booking confirmation
- PWA install and offline app-shell caching
