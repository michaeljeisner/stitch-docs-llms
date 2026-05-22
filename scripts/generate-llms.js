const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'data', 'stitch-docs.extracted.json');
const fullOutputPath = path.join(__dirname, '..', 'llms-full.txt');
const indexOutputPath = path.join(__dirname, '..', 'llms.txt');

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));

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
  '> Up-to-date generated Markdown for Google Stitch documentation.',
  '',
  'This repository contains a complete rendered-docs export for Stitch, generated from https://stitch.withgoogle.com/docs.',
  '',
  '## Full Documentation',
  '',
  '- [llms-full.txt](./llms-full.txt): complete extracted Stitch documentation with source URLs, headings, links, tables, ordered steps, and code blocks.',
  '- [validation report](./data/validation-report.json): extraction coverage and quality checks.',
  '- [source docs](https://stitch.withgoogle.com/docs): original Stitch documentation.',
  '',
  '## Coverage',
  '',
  `- Discovered pages: ${data.discoveredPages.length}`,
  `- Extracted pages: ${data.pages.length}`,
  `- Failed pages: ${data.failures.length}`,
  `- Code blocks: ${data.pages.reduce((total, page) => total + page.codeBlockCount, 0)}`,
  '',
  '## Page Sources',
  '',
  ...data.pages.map(page => `- ${page.heading || page.navText || page.url}: ${page.url}`),
  '',
];

fs.writeFileSync(fullOutputPath, `${fullLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
fs.writeFileSync(indexOutputPath, `${indexLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
console.log(`Wrote ${indexOutputPath}`);
console.log(`Wrote ${fullOutputPath}`);
