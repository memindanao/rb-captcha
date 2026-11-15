# Human-ish CAPTCHA

A deliberately frustrating CAPTCHA demo with independently registered, selectable mini-games.

## Run

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `STRIPE_SECRET_KEY` to a Stripe test-mode secret (`sk_test_...`).
3. Run `npm start` and open [http://localhost:4173](http://localhost:4173).

The skip button uses Stripe-hosted Checkout for a one-time $0.99 USD payment. The app grants the skip only after the server verifies the paid Checkout Session, amount, currency, and product metadata. Card details never reach this app. Test keys are accepted by default; live keys are rejected unless `ENABLE_LIVE_PAYMENTS=true` is explicitly set on the server.

The game registry and plug-in contract are documented in [src/games/README.md](src/games/README.md).