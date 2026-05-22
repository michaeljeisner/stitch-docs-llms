const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const extractedPath = path.join(root, 'data', 'stitch-docs.extracted.json');
const llmsPath = path.join(root, 'llms.txt');
const llmsFullPath = path.join(root, 'llms-full.txt');

const data = JSON.parse(fs.readFileSync(extractedPath, 'utf8').replace(/^\uFEFF/, ''));
const llms = fs.existsSync(llmsPath) ? fs.readFileSync(llmsPath, 'utf8') : '';
const llmsFull = fs.existsSync(llmsFullPath) ? fs.readFileSync(llmsFullPath, 'utf8') : '';

const checks = [];
const warnings = [];

const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

add('docs URL reachable', data.docsReachable === true && data.startUrl === 'https://stitch.withgoogle.com/docs', data.startUrl);
add('iframe entered', data.iframeEntered === true && data.frameStructure.length >= 3, `${data.frameStructure.length} frames`);

const openShadowHostCount = data.shadowHostsFound?.length || 0;
add('shadow DOM probed', Array.isArray(data.shadowHostsFound), `${openShadowHostCount} open shadow hosts found`);
if (openShadowHostCount === 0) {
  warnings.push('Playwright probed for open shadow roots in the rendered docs frame, but the current runtime exposes the content in regular iframe DOM with no open shadow roots.');
}

add('all discovered pages extracted', data.discoveredPages.length > 0 && data.pages.length === data.discoveredPages.length && data.failures.length === 0, `${data.pages.length}/${data.discoveredPages.length} pages, ${data.failures.length} failures`);
add('llms.txt exists and points to llms-full.txt', llms.length > 1000 && llms.includes('llms-full.txt'), `${llms.length} characters`);
add('llms-full.txt exists and is non-empty', llmsFull.length > 1000, `${llmsFull.length} characters`);

const missingSections = data.pages.filter(page => !llmsFull.includes(`Source: ${page.url}`) || !llmsFull.includes(`## ${page.heading}`));
add('each extracted page has source URL and heading in llms-full.txt', missingSections.length === 0, `${missingSections.length} missing sections`);

const boilerplateTerms = ['Skip to content', 'Ctrl\\nK', 'Select theme\\nDark\\nLight\\nAuto'];
const boilerplateHits = boilerplateTerms.filter(term => llmsFull.includes(term));
add('obvious UI boilerplate excluded', boilerplateHits.length === 0, boilerplateHits.length ? boilerplateHits.join(', ') : 'no obvious boilerplate hits');

const pagesWithCode = data.pages.filter(page => page.codeBlockCount > 0);
const fencedCodeCount = (llmsFull.match(/```/g) || []).length / 2;
add('code blocks survived transformation', pagesWithCode.length === 0 || fencedCodeCount >= pagesWithCode.length, `${fencedCodeCount} fenced blocks across ${pagesWithCode.length} pages with code`);

const docsLinks = [...llmsFull.matchAll(/https:\/\/stitch\.withgoogle\.com\/docs\/[^\s)\]]+/g)].map(match => match[0]);
add('key docs links survived transformation', docsLinks.length >= data.discoveredPages.length, `${docsLinks.length} docs links`);

const report = {
  generatedAt: new Date().toISOString(),
  discoveredPages: data.discoveredPages.length,
  extractedPages: data.pages.length,
  failures: data.failures,
  checks,
  warnings,
};

const reportPath = path.join(root, 'data', 'validation-report.json');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
}
for (const warning of warnings) {
  console.log(`WARN ${warning}`);
}

if (checks.some(check => !check.pass)) {
  process.exit(1);
}
