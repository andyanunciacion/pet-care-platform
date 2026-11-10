# CSV import format

How to fill in the seed spreadsheet (P0-V3) so `/admin/import` can load it. The rules live in `apps/api/src/services/imports.ts`; the decision is ARCHITECTURE D39. Start from the template on the import page (`/templates/paw-listings-template.csv`): it has every column and one example row.

## How it works

1. Keep the sheet in Google Sheets (or Excel). **One row per branch.** Rows with the same business name (ignoring case and extra spaces) become one business with several branches.
2. File → Download → **Comma-separated values (.csv)**.
3. On `/admin/import`, choose the file. The preview lists every row with its problems and any likely duplicates. Nothing is saved yet.
4. Click **Import N businesses**. The import brings in the businesses whose rows all pass. It skips:
   - **invalid businesses:** any of their rows has an error;
   - **likely duplicates:** unless you tick "Import anyway".
5. Fix the flagged rows in the sheet, download it again and re-check the file. The businesses you already imported now show up as duplicates, so they're skipped instead of added twice.

Imported businesses start **hidden**, with their branches published. Check each one in the admin (prices, photos), then set the business to Published.

## Columns

Header names are matched ignoring case. A space counts as `_`, so `Confirmed on` works for `confirmed_on`. Column order doesn't matter. Columns that aren't listed here (e.g. `notes`, `called by`) are ignored, with a warning. A blank row is skipped. **Row numbers** in the preview are the spreadsheet's (the header is row 1).

| Column | Required | What to write |
|---|---|---|
| `business` | ✓ | The business's name, e.g. `PawCare Veterinary Clinic` |
| `branch` | | The branch's name, e.g. `Balibago`. Blank: the city as written. Two rows of one business can't have the same branch name |
| `data_source` | ✓ | Where the details came from, e.g. `Called the clinic`, `Clinic visit`, `Facebook page`. Recorded per business: it may be blank on that business's later rows, but two different values are an error |
| `address` | ✓ | Street, building, landmark. Leave barangay, city and province to their own columns |
| `barangay` | | As the PSA names it. `Brgy.`/`Barangay`, case and accents are ignored, and so is anything in parentheses (`San Jose (Pob.)` = `San Jose`). Must be in the city |
| `city` | ✓ | City or municipality: `Angeles`, `Angeles City` and `City of Angeles` all work. Clark isn't a city: use Angeles or Mabalacat |
| `province` | ✓ | e.g. `Pampanga`. Only provinces with PSGC data in PAW (Pampanga so far; more are added with `psgc:sql`, see CLAUDE.md) |
| `coordinates` | ✓ | `lat, lng` as Google Maps copies it (right-click the place, then click the numbers at the top of the menu), e.g. `15.1627, 120.5560` |
| `phones` | | One or more numbers, separated by `;`, `,`, `/` or new lines: `0917 123 4567 / (045) 888 1234`. Stored as +63… |
| `viber` | | Viber numbers, same format as `phones` |
| `messenger` | | Messenger links (`m.me/yourclinic`; `https://` is added if missing), separated by `;`, `,` or new lines |
| `email` | | Email addresses, separated by `;`, `,` or new lines |
| `accepts_emergencies` | | `yes` / `no` (also `y`/`n`, `true`/`false`, `1`/`0`, `oo`/`hindi`). Blank means no |
| `open_24h` | | `yes` / `no`. When yes, leave `mon` to `sun` empty |
| `mon` `tue` `wed` `thu` `fri` `sat` `sun` | | That day's hours (see below). **All seven empty** means the hours are unknown ("Hours unknown" on the page). Once any day is filled in, every day needs hours or `closed` |
| `species` | | Species treated, by name or code, separated by `;`, `,` or new lines: `Dog, Cat, Rabbit` |
| `services` | | Services offered, separated by `;`, `,` or new lines. Use the service's name, its code, or a common synonym: `Consultation, Vaccination, Kapon`. A group (`Surgery`) is an error: name the specific services. Each one is added **without a price**: add prices in the branch's Services tab |
| `confirmed_on` | | The day you confirmed the hours with the clinic (a call or visit), as `YYYY-MM-DD`. Sets "Hours confirmed … by PAW" (UX5). Leave it blank when the hours come from a Facebook page or another unconfirmed source. It can't be in the future, and there must be hours to confirm |

## Hours

| Write | Means |
|---|---|
| `8am-5pm`, `8:00 AM - 5:00 PM`, `8:30 a.m. to 5 p.m.` | One interval |
| `08:00-17:00` | 24-hour clock |
| `8am-12nn, 1pm-5pm` | A lunch break: separate intervals with `,`, `;`, `/`, `and`, `&` or a space |
| `12nn` / `noon`, `12mn` / `midnight` | Noon, midnight |
| `8pm-2am` | Past midnight: counts as the day it starts |
| `closed` (or `sarado`) | Closed that day |

These are rejected, with a message on that cell:
- **No am/pm, and it's ambiguous:** `8-5` closes "before" it opens, so is it 8am-5pm? `1-5` opens before 6:00, so is it 1pm-5pm? Write `8am-5pm`, or `08:00-17:00`.
- **24 hours in a day column:** `24 hours` or `24/7`. Use `open_24h` instead.
- **Overlapping intervals:** `8am-5pm, 9am-10am`.
- **Text that isn't a time:** `by appointment`.

## Likely duplicates

A business is flagged when any of its rows:
- **shares a number:** a phone or Viber number with an existing branch, or with a row of another business in the same file;
- **has a similar name nearby:** it's within **250 m** of an existing branch whose business name is similar (`pg_trgm` similarity ≥ 0.3).

The preview links to the existing listing. Tick **Import anyway** when they really are different places, e.g. two clinics in one building.

## Google Sheets tips

- **Format `confirmed_on` as plain text** (Format → Number → Plain text). Otherwise Sheets may turn `2026-11-10` into `11/10/2026`, which is rejected.
- **Coordinates:** the cell must keep both numbers. Paste them into a cell formatted as plain text.
- **Several numbers in a cell:** Alt+Enter (Windows) or ⌘+Enter (Mac) adds a line break, and that works as a separator.
- **Limits:** 1,000 rows and 500 KB per file. Split a bigger sheet into several files.
