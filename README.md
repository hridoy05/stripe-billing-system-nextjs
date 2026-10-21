This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Payment flows

The app supports three payment flows, all settled by verified Stripe webhooks
(never by trusting the browser redirect):

### 1. Hosted Checkout (branch `feat/01-one-time-hosted-checkout`)

- Product page → server action creates a **Checkout Session** → browser is
  redirected to Stripe-hosted payment page → redirect back to
  `/checkout/success?session_id=...`.
- `checkout.session.completed` webhook records the purchase in PostgreSQL.

### 2. Custom PaymentIntent (branch `feat/02-Custom-PaymentIntent`)

- `/checkout/custom/[slug]` renders an in-app card form with **Stripe Elements
  (Payment Element)**.
- A server action creates a **PaymentIntent** (amount, currency, and
  `userId`/`productId` metadata) and returns the `client_secret`.
- The client confirms with `stripe.confirmPayment(...)`; 3D Secure challenges
  run inline (`redirect: "if_required"`), with a `return_url` fallback for
  full-redirect payment methods.
- `payment_intent.succeeded` records the purchase;
  `payment_intent.payment_failed` is logged and records nothing. Access is
  granted only after the webhook-verified row exists — the UI polls
  `getPurchaseStatus` rather than trusting the redirect.
- Purchases are deduplicated by a unique constraint on the PaymentIntent id;
  when both `checkout.session.completed` and `payment_intent.succeeded` fire
  for the same hosted-checkout payment, only one row is created.

### 3. Saved cards with SetupIntents (branch `feat/03-save-card-setup-intent`)

- `/account/payment-methods` creates or reuses the signed-in user's **Stripe
  Customer**, then starts a **SetupIntent** with `usage: off_session`. Card
  details are collected with **Stripe Elements (Payment Element)** on a
  {NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}-only client; the secret key never leaves
  the server.
- Customers must accept an explicit authorization before a card is saved. The
  consent version, text, timestamp, IP address, and user agent are recorded in
  PostgreSQL and linked to the saved PaymentMethod.
- `setup_intent.succeeded` is the source of truth: the webhook verifies that
  the SetupIntent, Customer, consent, and PaymentMethod all belong together,
  then stores only non-sensitive display data (brand, last four, expiry). The
  UI polls the database instead of trusting the browser success message.
- Customers can choose a default card, detach a card, and pay for a product
  with a saved card from `/checkout/saved/[slug]`.
- Saved-card payments carry a random per-attempt request key; duplicate
  clicks or retried server actions resolve to the same Stripe idempotency key
  instead of creating a second charge.
- Saved-card payments are first attempted server-side with
  `off_session: true`. If Stripe reports `authentication_required`, that
  attempt is cancelled and a fresh on-session PaymentIntent is created for the
  same saved card. Its client secret goes back to the browser so Stripe.js can
  run the 3DS challenge with `stripe.confirmCardPayment` before the webhook
  grants access.
- Ownership is enforced on every operation: the PaymentMethod must belong to
  the local Customer mapped to the authenticated user, and its Stripe
  `customer` must match that same Stripe Customer.

### Comparison

| | Hosted Checkout | Custom PaymentIntent | Saved card |
| --- | --- | --- | --- |
| UI | Stripe-hosted page | In-app form (Stripe Elements) | In-app saved-card picker |
| Server object | Checkout Session | PaymentIntent | SetupIntent + PaymentIntent |
| Client integration | Redirect only | `confirmPayment` | `confirmSetup` / `confirmCardPayment` |
| 3DS | Handled by Stripe page | Inline challenge, `return_url` fallback | Inline challenge, `return_url` fallback |
| Granting webhook | `checkout.session.completed` | `payment_intent.succeeded` | `setup_intent.succeeded` then `payment_intent.succeeded` |
| Card data storage | None | None | Brand, last four, expiry only |
| Branding control | Limited | Full | Full |

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

### Environment

`.env.local` needs:

- `DATABASE_URL` — PostgreSQL (see `docker-compose.yml`)
- `SESSION_SECRET`, `AUTH_EMAIL`, `AUTH_PASSWORD`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — required for the custom PaymentIntent
  flow (`/checkout/custom/[slug]`)
- The Stripe webhook endpoint must subscribe to `checkout.session.completed`,
  `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `setup_intent.succeeded`, `setup_intent.setup_failed`, and
  `payment_method.detached`
  (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`).

Card saving uses the same `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as the custom
PaymentIntent flow.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
