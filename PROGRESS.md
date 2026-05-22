# Stitch docs llms.txt progress log

Date: 2026-05-22

## What was extracted

- Source: https://stitch.withgoogle.com/docs
- Discovered pages: 34
- Extracted pages: 34
- Failed pages: 0
- Output artifact: `llms.txt`

The extractor entered the public Stitch docs page, followed the nested iframe chain into the rendered documentation frame, discovered all internal docs links exposed by the rendered sidebar and page content, visited every discovered route, and converted the rendered `main` content into Markdown.

## Validation

Command run:

```powershell
node scripts/validate-llms.js
```

Validation results:

- PASS docs URL reachable: https://stitch.withgoogle.com/docs
- PASS iframe entered: 3 frames
- PASS shadow DOM probed: 0 open shadow hosts found
- PASS all discovered pages extracted: 34/34 pages, 0 failures
- PASS `llms.txt` exists and is non-empty: 182400 characters
- PASS each extracted page has source URL and heading
- PASS obvious UI boilerplate excluded
- PASS code blocks survived transformation: 130 fenced blocks across 22 pages with code
- PASS key docs links survived transformation: 106 docs links

Note: Playwright probed for open shadow roots in the rendered docs frame and across the runtime, but the current accessible docs content is exposed through nested iframes with no open shadow roots. The extractor therefore records the shadow-DOM probe and extracts from the accessible iframe DOM.

## Generated files

- `llms.txt`: final Markdown llms artifact
- `scripts/extract-stitch-docs.playwright.js`: Playwright extraction script
- `scripts/decode-extraction.js`: UTF-8-safe extraction decoder
- `scripts/generate-llms.js`: Markdown generator
- `scripts/validate-llms.js`: validation checklist
- `data/stitch-docs.extracted.json`: structured extraction data
- `data/validation-report.json`: machine-readable validation report
