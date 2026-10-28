# Day Challenge

A private, offline-first personal growth tracker: one new challenge a day for a length you choose, a rotating habit system, personal bests, progress analytics, reminders and an optional Hard Mode accountability system.

No account, no server, no analytics. Everything is stored in your browser on your device.

## Challenges and plans

- **Library:** about 160 one-day challenges across six interests (mind, body, creative, social, practical, wellbeing), each rated difficulty 1–5. Source: `src/data/challenges.ts` (the Signature 30) and `src/data/libraryExtra.ts`.
- **Length:** 3–100 days (presets 7 / 14 / 21 / 30 / 60 / 90).
- **Choose for me:** `src/domain/planner.ts` builds a plan that ramps from difficulty 1 to 5, prefers the chosen interests and owned equipment, avoids repeating a category on consecutive days, and is sorted so no day is easier than the one before. Shuffle picks a new set.
- **Signature 30:** the original hand-built 30-day program.
- **Difficulty curve:** gentle, steady or steep.
- **Rest days:** optional rest / catch-up day every 5th or 7th day (never the last day); rest days never count as missed.
- **Your own challenges:** create, edit and delete them in the Library and swap them into any day.
- **Summary:** `/#/summary` recaps the program and exports a shareable 1080×1350 image.
- **Swapping:** any day can be swapped for another library challenge until something is logged against it. The whole plan, including its length, can be rebuilt until anything at all is logged.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # development at http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
```

### Use it on your phone

The production build in `dist/` is a static site and an installable PWA. Host it on any static host that serves HTTPS (Netlify, Cloudflare Pages, GitHub Pages, Vercel). No server code or environment variables are needed. Routing uses `#/` URLs, so no rewrite rules are needed either. Then open it on your phone and use **Add to Home Screen**. It works fully offline after the first load.

Data is stored **per browser and per device**. The phone and the laptop don't sync, so pick one as your main device, or move data between them with Settings → Export / Import.

## Photos

The design uses three landscape photos. Until they are added, those spots are simply left out. To add them, put JPEGs in `public/images/` with these names and push:

| File | Where it appears | Suggested size |
|---|---|---|
| `hero.jpg` | Today banner (lone figure on a misty coast works best) | ~1600×700 |
| `quote-1.jpg` | Quote cards on Today and challenge pages (misty peaks) | ~800×800 |
| `quote-2.jpg` | Quote card on the calendar (rocky ridge) | ~800×800 |

Photos are shown slightly desaturated to match the palette.

## Notifications: what works, and when

| Situation | Morning / evening / bedtime reminder |
|---|---|
| App open (any tab, foreground) | ✅ System notification + in-app banner |
| App in a background tab or installed-app window | ✅ System notification (fires within ~30 s of the time) |
| App opened up to 2 h after the reminder time | ✅ Shown on open (in-app, plus system if allowed) |
| App/browser fully closed | ❌ Not possible without a push server. **Use the calendar export.** |

- **Calendar export (reliable when closed):** Settings → Reminders → *Add to calendar (.ics)*. It creates one event with an alarm per reminder per program day, in UTC computed from your timezone, so daylight saving is handled. Re-export after changing reminder times or the start date.
- **Testing:** Settings → Reminders → *Send test notification* really calls the browser's notification API and reports the actual outcome. It never fakes success. If permission is blocked, the app says so.
- **iPhone/iPad:** web notifications require iOS 16.4+ **and** the app added to the Home Screen.
- **Privacy:** notification text never includes habit names. Quiet hours suppress delivery completely, and each reminder fires at most once per local day (it's claimed in IndexedDB, so several open tabs won't duplicate it).

## What's stored, and where

All data lives in the browser's **IndexedDB** (database `thirty-day-challenge`) on this device, and the browser is asked to keep it persistent. `localStorage` holds only the theme and the calendar/list view preference.

Stored: settings, program dates (plus the history of date changes), the 30 challenge definitions (plus revisions when you edit one), challenge progress (status, timestamps, measurements, notes, audit history, missed-day acknowledgements), logged attempts, evidence files (photos, recordings, reports), habits and daily habit entries, evening reflections, earned achievements, a reminder-delivery log (pruned after 14 days), and running timers (so a refresh never loses a focus session).

No location data is collected, and nothing is sent anywhere. The production build ships a strict Content-Security-Policy (`connect-src 'self'`).

- **Export:** Settings → Your data → Export backup (JSON, optionally including files).
- **Import:** validated against the full schema before anything changes. An invalid file changes nothing.
- **Delete:** Settings → Your data → Delete all data (type DELETE to confirm).

## Project structure

```
src/
  domain/      Pure, tested logic: types/schemas (zod), dates & timezones, schedule mapping,
               success criteria, personal bests, habits, analytics, achievements, reminders, .ics
  data/        Canonical seed: the 30 challenges and the habit set (single source of truth)
  db/          Dexie (IndexedDB) schema, all mutations (actions.ts), backup/import
  lib/         App data context, reminder scheduler, notifications, toasts, selectors
  components/  Design-system primitives and the app shell (sidebar / bottom nav)
  features/    today · challenges · habits · progress · settings · onboarding · tools
  sw.ts        Service worker: offline precache + notification click handling
```

## Known limitations

- Reminders can't fire while the app is fully closed (see the table above). The calendar export covers that case.
- There's no cross-device sync, by design (local-only, private). Use export/import to move data.
- Clearing the browser's site data deletes everything, so export a backup regularly.
- Attachments are capped at 50 MB each and limited by the browser's storage quota. Settings shows current usage.
- Measurement fields and success rules are built in per challenge. Editing a challenge changes its text, plan and estimates, but not its measurement fields or rules.
