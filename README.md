# Friends Included Finance

A Next.js application for the Wedding Guests for Hire assignment. Supabase is the source of truth. Telegram and website submissions use the same financial rules; Google Sheets receives an automatically synchronized copy.

## Current build

- Demonstration role selector for all five fictional employees
- Role-specific sale and expense entry
- Manager Telegram linking screen
- Manager sale approval and commission correction
- Manager expense allocation and correction
- Project and company financial dashboard
- Per-person commission totals
- Supabase schema with database constraints and audit log
- Telegram webhook for real bot submissions and notifications
- Google Sheets upsert by reference
- Independent Sheets and Telegram failure states with retry
- Automated financial unit tests and a rerunnable assignment verification suite

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in credentials when the integrations are created.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Create a spreadsheet containing `Sales` and `Expenses` tabs and share it with the service account as Editor.
5. Run `pnpm dev` and open `http://localhost:3000`.
6. Before deployment, run `pnpm telegram:poll` in a second terminal to receive Telegram messages locally. Stop polling before enabling the production webhook.

Without Supabase environment variables the interface opens in setup mode so its design can be inspected, but transaction controls remain disabled.

## Verification

- `pnpm test` runs the financial calculation tests.
- `pnpm test:assignment` verifies the completed Test 2 figures, pending records, permissions, validation, duplicate protection, and Sheets synchronization. It can be rerun without resetting the completed dataset.
- `pnpm build` performs the production build and TypeScript checks.

## Deployment

Set every variable from `.env.example` in Vercel. Use server-only values for the Supabase service-role key, Telegram token, webhook secret, and Google private key. Set `NEXT_PUBLIC_GITHUB_URL` and `NEXT_PUBLIC_GOOGLE_SHEETS_URL` so the required submission links appear in the website footer.

After deployment, configure Telegram to send updates to:

```text
https://YOUR-VERCEL-DOMAIN/api/telegram/webhook
```

## Telegram commands

Send `/start` to obtain the Telegram user ID, then link that ID and chat ID through Svetlana's manager setup.

```text
/sale S01 | Olivia Rose | A | One proud uncle and an emotional grandmother | 1000 | 50/30/20
/expense E01 | Rented suit and fake pearl necklace for the relatives | Materials | 120 | A
```

## Security

- Never commit `.env.local`.
- The Supabase service-role key and Google private key are server-only.
- The browser does not write directly to Supabase.
- Demonstration-role permissions are validated again by API input schemas and database constraints.
