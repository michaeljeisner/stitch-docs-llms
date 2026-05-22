const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'data', 'stitch-docs.extracted.json');
const fullOutputPath = path.join(__dirname, '..', 'llms-full.txt');
const indexOutputPath = path.join(__dirname, '..', 'llms.txt');

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));
const pagesBaseUrl = 'https://michaeljeisner.github.io/stitch-docs-llms';

const normalizeMarkdownLinks = text =>
  String(text || '')
    .replaceAll('https://app-companion-430619.appspot.com/docs/', 'https://stitch.withgoogle.com/docs/')
    .replaceAll('/index.html)', '/)');

const escapeTableCell = value =>
  normalizeMarkdownLinks(value)
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br>')
    .trim();

const pushParagraph = (lines, text) => {
  const normalized = normalizeMarkdownLinks(text).trim();
  if (!normalized) return;
  if (lines[lines.length - 2] === normalized) return;
  lines.push(normalized, '');
};

const pushTable = (lines, rows) => {
  if (!rows.length) return;
  const width = Math.max(...rows.map(row => row.length));
  const paddedRows = rows.map(row => Array.from({ length: width }, (_, index) => escapeTableCell(row[index] || '')));
  lines.push(`| ${paddedRows[0].join(' | ')} |`);
  lines.push(`| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
  for (const row of paddedRows.slice(1)) {
    lines.push(`| ${row.join(' | ')} |`);
  }
  lines.push('');
};

const renderBlock = (lines, block, pageHeading, seenPageHeading) => {
  if (block.type === 'heading') {
    if (!seenPageHeading.value && block.text.trim() === pageHeading.trim()) {
      seenPageHeading.value = true;
      return;
    }
    const level = Math.min(6, Math.max(3, block.level + 1));
    lines.push(`${'#'.repeat(level)} ${normalizeMarkdownLinks(block.text)}`, '');
    return;
  }

  if (block.type === 'paragraph') {
    pushParagraph(lines, block.text);
    return;
  }

  if (block.type === 'list') {
    block.items.forEach((item, index) => {
      const marker = block.ordered ? `${index + 1}.` : '-';
      lines.push(`${marker} ${normalizeMarkdownLinks(item)}`);
    });
    lines.push('');
    return;
  }

  if (block.type === 'code') {
    const language = block.language || '';
    lines.push(`\`\`\`${language}`);
    lines.push(String(block.text || '').replace(/\s+$/g, ''));
    lines.push('```', '');
    return;
  }

  if (block.type === 'table') {
    pushTable(lines, block.rows);
    return;
  }

  if (block.type === 'quote' || block.type === 'note') {
    const label = block.kind ? `[!${block.kind.toUpperCase()}] ` : '';
    const text = normalizeMarkdownLinks(block.text);
    lines.push(`> ${label}${text}`, '');
  }
};

const renderPage = page => {
  const lines = [];
  const heading = page.heading || page.navText || page.title || page.url;
  lines.push(`## ${heading}`, '');
  lines.push(`Source: ${page.url}`, '');

  const firstHeadingIndex = page.blocks.findIndex(block => block.type === 'heading');
  const contentBlocks = firstHeadingIndex >= 0 ? page.blocks.slice(firstHeadingIndex) : page.blocks;
  const seenPageHeading = { value: false };

  for (const block of contentBlocks) {
    renderBlock(lines, block, heading, seenPageHeading);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const fullLines = [
  '# Stitch Documentation',
  '',
  `Source collection: ${data.startUrl}`,
  `Extracted: ${data.fetchedAt}`,
  '',
  'This file contains Markdown converted from the accessible rendered documentation pages discovered at stitch.withgoogle.com/docs. Each page section includes its source URL.',
  '',
  '## Pages',
  '',
  ...data.pages.map(page => `- [${page.heading || page.navText || page.url}](#${(page.heading || page.navText || page.url).toLowerCase().replace(/[^a-z0-9]+/g, '-')}) - ${page.url}`),
  '',
  ...data.pages.map(renderPage),
  '',
];

const indexLines = [
  '# Stitch Docs LLMS',
  '',
  '> A generated LLM-friendly index for Google Stitch documentation, including a complete rendered-docs Markdown corpus for agents, coding assistants, and Context7-style documentation ingestion.',
  '',
  'This file follows the llms.txt proposal: a concise Markdown overview followed by curated file lists. The full documentation export is in `llms-full.txt`; it was generated from the accessible rendered Stitch docs at https://stitch.withgoogle.com/docs.',
  '',
  'Use `llms-full.txt` when a model needs the complete Stitch docs in one context. Use the source documentation links when a browser-enabled agent should verify the current live page.',
  '',
  '## Docs',
  '',
  `- [Complete Stitch docs corpus](${pagesBaseUrl}/llms-full.txt): Full rendered-docs Markdown export with source URLs, headings, links, tables, ordered steps, and code blocks from ${data.pages.length} discovered Stitch documentation pages.`,
  `- [Extraction progress log](${pagesBaseUrl}/PROGRESS.md): Human-readable summary of the extraction method, coverage, validation results, and known runtime note about iframe and shadow-root probing.`,
  '',
  '## Source Documentation',
  '',
  ...data.pages.map(page => `- [${page.heading || page.navText || page.url}](${page.url}): Original Stitch documentation page used as source for the generated corpus.`),
  '',
  '## Optional',
  '',
  `- [Structured extraction JSON](${pagesBaseUrl}/data/stitch-docs.extracted.json): Machine-readable extracted page blocks, links, code block counts, frame metadata, and source URLs used to generate the Markdown corpus.`,
  `- [Validation report](${pagesBaseUrl}/data/validation-report.json): Machine-readable checklist confirming docs reachability, iframe traversal, page coverage, source headings, boilerplate exclusion, and code block preservation.`,
  `- [Extraction scripts](${pagesBaseUrl}/scripts/extract-stitch-docs.playwright.js): Playwright extraction function for refreshing the rendered docs crawl.`,
  `- [Markdown generator](${pagesBaseUrl}/scripts/generate-llms.js): Node.js script that regenerates both \`llms.txt\` and \`llms-full.txt\` from structured extraction data.`,
  '',
];

fs.writeFileSync(fullOutputPath, `${fullLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
fs.writeFileSync(indexOutputPath, `${indexLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
console.log(`Wrote ${indexOutputPath}`);
console.log(`Wrote ${fullOutputPath}`);
