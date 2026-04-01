# Rebooked Prospector v2.0 — 100% Free Business Discovery & Outreach

## Quick Start

```bash
# Find all salons in Austin, TX
node tools/prospector/prospect.mjs search --type salon --location "Austin" --state "Texas"

# Enrich with emails (scrapes business websites)
node tools/prospector/prospect.mjs enrich

# Generate cold emails + call scripts
node tools/prospector/prospect.mjs outreach

# Or run everything in one command:
node tools/prospector/prospect.mjs pipeline --type salon,barber,spa --location "Austin" --state "Texas"
```

## Data Sources (All Free)

| Source | What It Does | Cost | API Key? |
|--------|-------------|------|----------|
| OpenStreetMap (Overpass API) | Finds businesses by type + city | $0 | No |
| Website Scraping | Extracts emails from business contact pages | $0 | No |
| Email Pattern Generation | Generates common email patterns (info@, contact@) | $0 | No |
| Hunter.io (optional) | Email lookup — 25 free/month | $0 | Optional |
| Reddit API (optional) | Finds complaint threads about no-shows | $0 | Optional |

## Commands

### search — Find businesses
```bash
node prospect.mjs search --type salon --location "Dallas" --state "Texas"
node prospect.mjs search --type barber,tattoo,spa --location "Miami" --state "Florida"
```

Business types: `salon`, `barber`, `spa`, `tattoo`, `clinic`, `fitness`

### enrich — Get contact info
```bash
node prospect.mjs enrich              # Uses website scraping + Hunter.io
node prospect.mjs enrich --no-hunter  # Website scraping only
```

Scrapes each business website's contact/about pages for email addresses. Falls back to common email patterns (info@, contact@, etc.) when no email is found on the site.

### complaints — Find pain points
```bash
node prospect.mjs complaints --industry salon
node prospect.mjs complaints   # Searches all industries
```

If Reddit API is configured, searches for threads where business owners complain about no-shows, cancellations, etc. Otherwise uses a curated static list.

### outreach — Generate emails + call scripts
```bash
node prospect.mjs outreach
node prospect.mjs outreach --output "C:\Users\Brend\Desktop\Outreach"
```

### pipeline — Run everything
```bash
node prospect.mjs pipeline --type salon,barber --location "Austin" --state "Texas"
```

Runs: search → enrich → complaints → outreach

### stats — View cache
```bash
node prospect.mjs stats
```

### export — Export to CSV
```bash
node prospect.mjs export
```

## Output Files

All saved to `C:\Users\Brend\Desktop\Outreach\YYYY-MM-DD-prospecting-run\`:

| File | Purpose |
|------|---------|
| `master-prospect-list.csv` | All prospects with contacts, priority scores |
| `emails/batch-cold-emails.csv` | 3-email sequence for mail merge (Day 0, Day 3, Day 7) |
| `emails/by-type/*.txt` | Emails grouped by business type for review |
| `call-scripts/batch-call-scripts.csv` | All call scripts in spreadsheet format |
| `call-scripts/by-type/*.txt` | Call scripts grouped by business type |
| `complaint-leads.csv` | Forum/blog leads where owners complain about no-shows |
| `objection-handling.txt` | Common objections and responses for cold calls |
| `summary-report.txt` | Stats, breakdown by type/region, strategy overview |

## Optional API Keys

Add to your `.env` file to enhance results:

```env
# Hunter.io — 25 free email lookups/month (https://hunter.io)
HUNTER_API_KEY=your_key_here

# Reddit — complaint search (https://www.reddit.com/prefs/apps)
REDDIT_CLIENT_ID=your_id_here
REDDIT_CLIENT_SECRET=your_secret_here
```

## How It Works

1. **OpenStreetMap Overpass API** queries the OSM database for businesses tagged as salons, barbershops, tattoo shops, etc. in a given city. Returns name, address, phone, website.

2. **Website scraping** visits each business's website (/, /contact, /about pages) and extracts email addresses using regex. This is the primary email discovery method.

3. **Email patterns** generate likely addresses (info@domain, contact@domain, etc.) as a fallback when no email is found on the website.

4. **Outreach generation** uses the existing template engine with business-type-specific pain points, stats, and talking points to create personalized 3-email sequences and cold call scripts.

## Local Cache

All discovered data is cached in a local SQLite database (`.prospector-cache/prospects.db`). This means:
- You won't re-fetch businesses you've already found
- Enrichment results are saved permanently
- You can run searches for different cities and accumulate prospects over time
- Delete `.prospector-cache/` to start fresh

## Existing Outreach Generator

The original `generate-outreach.mjs` still works for processing CSV exports:

```bash
node tools/prospector/generate-outreach.mjs --demo
node tools/prospector/generate-outreach.mjs --businesses data.csv --prospects contacts.csv
```
