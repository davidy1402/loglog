# loglog (顺便记)

A privacy-first, offline-ready Progressive Web App (PWA) for bowel movement timing, stool health tracking, and personalized medical trend analysis.

Built with pure Vanilla JavaScript and zero external dependencies.

---

## Features

- **Stopwatch & Manual Logging** — One-tap real-time timer with live elapsed display, plus manual/backfill record entry: pick any past date, time, and duration for an entry you forgot to log in the moment.
- **Bristol Stool Scale Classification** — Visual Type 1–7 stool shape selector with emojis, titles, and clinical descriptions (from hard lumps to liquid).
- **Multi-Dimensional Context** — Record volume, color (with safety warnings), odor, defecation feeling (strain, incomplete evacuation, urgency), accompanying symptoms (e.g. bleeding), mood, and location.
- **Automated Health Insights Engine** — Instant post-log evaluation providing evidence-based feedback referencing:
  - **Bristol Stool Scale** shape guidelines
  - **Rome IV Criteria** for functional constipation pattern detection (evaluating 30-day ratios of hard stools, straining, and incomplete evacuation > 25%)
  - **Mayo Clinic / Cleveland Clinic** stool color clinical reference guides
  - **Toilet-time guidance** — advice on individual sessions and 7-day average duration when time spent sits above the commonly recommended ~10 minute window (associated with increased hemorrhoid risk)
- **Weekly Analytics & 14-Day Chart** — Real-time stat cards tracking 7-day frequency, average interval, average duration, and an interactive 14-day bar chart.
- **Offline PWA Support** — `Cache-First` Service Worker strategy ensuring full functionality in zero-signal environments (e.g. restrooms).
- **Add to Home Screen (A2HS)** — Web App Manifest with standalone display mode, warm-tone maskable icons, and non-intrusive in-app install prompt.
- **Local-First, Cloud-Optional** — Data lives in `localStorage` by default (zero server, zero telemetry), with one-click JSON backup/restore, CSV export, and complete data reset. Optionally connect your own free Supabase project for automatic cloud sync across devices — see [Cloud Sync](#cloud-sync-optional) below.

---

## Tech Stack

- **Core Engine:** Vanilla JavaScript (ES6+, 0 dependencies, pure native DOM)
- **PWA Architecture:** Service Worker (`Cache-First` caching for same-origin assets, network passthrough for cross-origin sync calls, versioned cache cleanup `bm-tracker-v4`), Web App Manifest
- **Styling & Layout:** Native CSS3 with CSS Tokens, Flexbox, CSS Grid, custom warm color palette (`#a97452`, `#f6f4f0`, `#f0e2d6`)
- **Persistence:** Web Storage API (`localStorage` keys: `bm_tracker_records_v2`, `bm_tracker_active_timer`) with optional cloud sync to a user-owned Supabase project (see Cloud Sync)

---

## Quick Start (Local Mode)

No build tools, Node modules, or compilation required — runs natively in any modern web browser:

```bash
# Clone the repository
git clone https://github.com/davidy1402/loglog.git
cd loglog


# Serve locally (required for Service Worker HTTPS/localhost security requirement)
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/bm-tracker.html` in your browser.

---

## PWA & Mobile Installation

### Android / Desktop Chrome
1. Visit the hosted HTTPS URL or local server.
2. Click the **安装应用** (Install App) button in the toolbar, or select **Install App** from Chrome menu.

### iOS Safari
1. Open the URL in Safari.
2. Tap the **Share** button (Square with up arrow).
3. Select **Add to Home Screen** (添加到主屏幕).

---

## Data & Privacy

- **Local Storage by Default:** All health records and timer states are persisted in `localStorage` and never leave the device unless you explicitly opt in to cloud sync below.
- **Export Capabilities:** Export your full history as a standard `.csv` file at any time for personal backup or medical consultation, or a `.json` backup that can be re-imported.
- **Zero Network Leakage (offline mode):** With cloud sync off, there are no background API calls, third-party analytics scripts, or external fonts.

---

## Cloud Sync (optional)

By default all data stays on-device — great for privacy, but it means a lost/broken/reset phone loses everything. Cloud Sync is an **opt-in** feature that backs your records up to **your own** free [Supabase](https://supabase.com) project, so nothing is lost even if the device is. It does not use any Loglog-operated server — you own the database.

### Setup (about 2 minutes)

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In the project's **SQL Editor**, run:
   ```sql
   create table records (
     id text primary key,
     user_id uuid not null default auth.uid() references auth.users(id),
     ts bigint not null,
     duration bigint,
     bristol int,
     amount text, color text, smell text, feel text,
     symptoms jsonb, mood text, place text, note text,
     updated_at bigint not null
   );
   alter table records enable row level security;
   create policy "owner access" on records for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
3. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
4. In the app, open the **云端同步 (Cloud Sync)** card on the home screen, paste both values, then sign in with your email (a one-time 6-digit code is emailed to you — no password to manage).

Once signed in, every new/edited/deleted record automatically syncs in the background (debounced), and pulls happen on load, on reconnect, and periodically. The same Supabase project + email can be used from another device/browser to pull the same data down.

Notes:
- The URL and anon key are stored only in this browser's `localStorage`; they are sent only to the Supabase URL you configured.
- The anon key is meant to be public — access is enforced by the Row Level Security policy above (`auth.uid() = user_id`), not by keeping the key secret.
- Turning Cloud Sync off (or never configuring it) leaves the app fully offline/local, exactly as before.

---

## Medical Disclaimer

The automated suggestions and pattern warnings generated by Loglog are based on personal self-reported logs and public medical guidelines (Bristol Stool Scale, Rome IV Criteria, Mayo Clinic / Cleveland Clinic patient education materials). They are intended strictly for personal self-tracking reference and do not replace professional medical diagnosis or treatment.

---

## License

MIT License.
