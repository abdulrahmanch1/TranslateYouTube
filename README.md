TranslateYouTube — AI Captions for YouTube

Overview
- Purpose: Generate SRT/VTT subtitle files for YouTube using AI (replace Google auto-captions by uploading your own file in YouTube Studio → Subtitles).
- Tech: 100% Next.js (App Router), Tailwind CSS, Supabase (auth + user storage), OpenAI (AI translation/quality).
- Plans: Pay‑per‑file via Wallet ($1/file). Subscriptions removed.
- Language: Site UI in English. Dark and Light themes included with a futuristic aesthetic and subtle animated background.

Quick Start
1) Copy .env.example to .env.local and set values:
   - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (server-only, for webhooks)
   - OPENAI_API_KEY (and optionally OPENAI_MODEL)
   - (Optional) Stripe keys not needed now; wallet top‑ups to be wired later.
   - NEXT_PUBLIC_SITE_URL (e.g. http://localhost:3000)
2) Install dependencies and run:
   - npm install
   - npm run dev

Database
- Run migrations in your Supabase project (SQL editor):
  - supabase/migrations/0001_profiles.sql
  - supabase/migrations/0002_wallet.sql (adds balance_cents and RPCs wallet_topup / wallet_charge)
  - supabase/migrations/0003_profiles_auto.sql (auto-create a profile row on new user signup)
  - supabase/migrations/0004_profiles_backfill.sql (backfill for existing users + nonnegative balance constraint)
  - supabase/migrations/0005_profiles_fields.sql (adds display_name, accepted_tos_at)

Wallet
- Each processed file costs $1 (100 cents) deducted from user wallet.
- Ledger: public.wallet_transactions stores every topup/charge (with running balance_after).
- RPCs: ledger_balance(), ledger_topup(amount_cents), ledger_charge(amount_cents).
- UI: /wallet reads ledger_balance and shows recent transactions; dev top‑up calls ledger_topup.

YouTube Transcript
- The API fetches timed transcript using the youtube-transcript package and preserves timing while translating line-by-line.
- If fetching fails, it falls back to naive segmentation or a provided raw transcript.

Pages
- /             Landing with file upload + AI suggestions (accept/reject)
- /login        Login (Supabase email/password)
- /signup       Signup (Supabase email/password)
- /wallet       Wallet balance and dev top‑up

How it works now
- Upload YouTube file (SRT/VTT for captions, or audio/video for transcription via Whisper if OPENAI_API_KEY is set).
- API: POST /api/process (multipart/form-data) returns plain transcript + optional cues.
- Get AI suggestions: POST /api/suggest { text } → returns list of minimal replacements with reasons.
- Accept/Reject then download updated SRT/VTT or plain text.

Replace Google auto-captions
- Upload the generated .srt or .vtt to YouTube Studio → Subtitles for the target language. This replaces auto‑captions with your accurate AI captions.

Auth and wallet
- Supabase stores users. profiles table now has balance_cents (migrations/0002_wallet.sql).
- Call RPC wallet_charge to deduct 100 cents per file; wallet_topup is available for dev top‑ups. Real payments TBD.

Security & notes
- Do not commit real keys. Use .env.local for secrets.
- Set OPENAI_MODEL to a capable model. When a newer model is available, update the env var without code changes.

Future enhancements
- Real payments for top‑up (Stripe/checkout or one‑time payments).
- Better mapping to preserve timings when applying replacements.
- Per‑suggestion accept/reject with iterative refinement.

MCP Server
- Path: mcp/supabase
- Purpose: Allow the assistant to run SQL/RPC safely against Supabase via MCP tools.
- Quick start: see mcp/supabase/README.md
