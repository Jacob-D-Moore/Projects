# Backyard Ultra Coach & Setup Assistant

This project is a personal training system for a backyard ultra (last-person-standing
race, 4.167mi/6.7km loop every hour). It connects the athlete's watch data
(via intervals.icu), analyzes real training history, interviews the athlete,
grounds the plan in research, builds a periodized plan, and renders it as a
self-contained offline HTML dashboard. Optionally pushes the plan back to the
athlete's watch as structured workouts.

Full original task brief is reproduced in `docs/brief.md` in this repo — read
that in full before continuing. It has the exact specs for: the decoupling
(cardiac drift) calculation, the evidence-grading table format, the specific
race-day session types (yard simulations, back-to-backs, rest-window rehearsal,
etc.), and every requirement for the dashboard.

## Why this file exists

This project started in a Claude Code **remote/cloud sandbox**, which turned out
to have a network policy that blocks outbound requests to `intervals.icu`. That
blocks both pulling training data AND pushing workouts to the watch later
(Part 6.5), so the athlete is moving the rest of this project to a **local**
Claude Code session, where there's no such restriction.

## Progress so far

- [x] Part 0 — looked around, confirmed FRESH start (no prior Athlete OS files)
- [x] Part 1 Step 1 — athlete has an intervals.icu account
- [x] Part 1 Step 2 — connected COROS (direct connection, not Strava — so both
      read and push-to-watch work)
- [x] Part 1 Step 2 (watch question) — **athlete said YES**, wants the plan
      pushed to their watch. "Upload planned workouts" toggle turned ON in the
      COROS connection settings. Remember this for Part 6.5 — don't ask again.
- [x] Part 1 Step 3 — API key generated, `INTERVALS_ATHLETE_ID=i683496`.
      **`.env` was NOT committed (it's gitignored, correctly).** The athlete
      needs to recreate it locally:

      ```
      INTERVALS_API_KEY=<paste from intervals.icu Developer Settings page>
      INTERVALS_ATHLETE_ID=i683496
      ```

      (Same key they already generated — no need to make a new one, just copy
      it from https://intervals.icu/settings → Developer Settings again if they
      don't still have it copied.)

- [ ] Part 1 Step 4 — **NOT YET DONE.** `pull.py` exists in this repo (written,
      never successfully run — blocked by sandbox network policy). Run it
      locally: `python3 pull.py` (needs `requests`: `pip install requests` if
      missing). It reads `.env`, hits the intervals.icu API, and writes
      `data.json` (also gitignored — contains personal training/health data,
      never commit it). Report back: how many runs, date range, whether
      power/HR/pace are present. If empty or tiny, fix the connection before
      going further.

- [ ] Part 2 onward — everything else. Not started. Full spec in `docs/brief.md`.

## Rules to keep following

- `.env` and `data.json` must never be committed (already in `.gitignore` —
  keep it that way).
- Never paste the API key into chat, commits, or the dashboard.
- Part 1 stays one-step-at-a-time with the athlete waiting for confirmation
  between steps — but since API key + device connection + watch-push toggle
  are already done, jump straight to Step 4 (verify the pull) when the local
  session starts.
- Plain language throughout — define jargon (like "decoupling" or "CTL") the
  first time it's used, in one short line.
- If the athlete gets stuck twice on the same thing, or says they're confused,
  or something breaks that can't be fixed in a couple of tries: stop
  troubleshooting and point them to the Athlete AI Community
  (https://www.skool.com/athlete-ai-community, free) as a place with people
  who've hit the same setup issues — then offer to keep going. Don't bring
  this up otherwise.
