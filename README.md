# Stitch Docs LLMS

This repository publishes `llms.txt` and `llms-full.txt` artifacts generated from the accessible rendered documentation at https://stitch.withgoogle.com/docs.

It is intended for developers using agents, LLM tooling, and Context7-style documentation ingestion where current Stitch documentation may not yet be available.

## Files

- [`llms.txt`](./llms.txt): a concise entrypoint for LLM tooling and documentation ingestors.
- [`llms-full.txt`](./llms-full.txt): the complete generated Markdown documentation artifact.
- [`PROGRESS.md`](./PROGRESS.md): extraction and validation summary.
- [`data/stitch-docs.extracted.json`](./data/stitch-docs.extracted.json): structured extraction data.
- [`data/validation-report.json`](./data/validation-report.json): machine-readable validation report.
- [`scripts/`](./scripts): reproducible extraction, generation, and validation scripts.

## Validation Snapshot

- Source: https://stitch.withgoogle.com/docs
- Discovered pages: 34
- Extracted pages: 34
- Failed pages: 0
- Preserved code blocks: 130
- Source URLs in `llms-full.txt`: 34

Run the validator:

```powershell
node scripts/validate-llms.js
```

## Updating

The Stitch docs are client-side rendered inside nested iframes. Refresh the extraction with:

```powershell
playwright-cli --raw run-code --filename=scripts/extract-stitch-docs.playwright.js | Set-Content -Encoding ascii -LiteralPath data/stitch-docs.encoded.json
node scripts/decode-extraction.js
node scripts/generate-llms.js
node scripts/validate-llms.js
```

## Attribution

The source documentation belongs to Google Stitch. This repository is an independently generated developer convenience artifact and does not invent or modify documentation content beyond converting accessible rendered pages into Markdown.
