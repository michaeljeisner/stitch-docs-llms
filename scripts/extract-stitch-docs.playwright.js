async page => {
  const PUBLIC_ORIGIN = 'https://stitch.withgoogle.com';
  const START_URL = `${PUBLIC_ORIGIN}/docs`;

  const normalizePublicUrl = href => {
    if (!href) return null;
    let raw = String(href).trim();
    const hashIndex = raw.indexOf('#');
    if (hashIndex >= 0) raw = raw.slice(0, hashIndex);
    const queryIndex = raw.indexOf('?');
    if (queryIndex >= 0) raw = raw.slice(0, queryIndex);

    if (raw.startsWith('/docs')) raw = `${PUBLIC_ORIGIN}${raw}`;
    if (raw.startsWith('https://app-companion-430619.appspot.com/docs')) {
      raw = raw.replace('https://app-companion-430619.appspot.com', PUBLIC_ORIGIN);
    }
    if (!raw.startsWith(`${PUBLIC_ORIGIN}/docs`)) return null;
    if (raw.endsWith('/index.html')) raw = raw.slice(0, -'index.html'.length);
    if (!raw.endsWith('/')) raw += '/';
    return raw;
  };

  const waitForDocsFrame = async () => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => window.frames.length > 0, null, { timeout: 20000 });
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const docsFrame = page.frames().find(frame => {
        const frameUrl = frame.url();
        return frameUrl.includes('/docs/index.html') || /\/docs\/.+\/index\.html$/.test(frameUrl);
      });
      if (docsFrame) {
        await docsFrame.waitForLoadState('domcontentloaded').catch(() => {});
        const ready = await docsFrame.evaluate(() => Boolean(document.querySelector('main'))).catch(() => false);
        if (ready) return docsFrame;
      }
      await page.waitForTimeout(250);
    }
    throw new Error('Unable to find rendered Stitch docs iframe.');
  };

  const inspectFrameStructure = async () => {
    return page.frames().map(frame => ({
      url: frame.url(),
      name: frame.name(),
      childCount: frame.childFrames().length,
    }));
  };

  const extractFromFrame = async frame => {
    return await frame.evaluate(() => {
      const cleanText = text => (text || '').replace(/\s+/g, ' ').trim();
      const absolute = href => {
        try {
          return new URL(href, location.href).href;
        } catch {
          return href || '';
        }
      };

      const navLinks = [...document.querySelectorAll('nav.sidebar a[href^="/docs"], nav.sidebar a[href^="https://stitch.withgoogle.com/docs"], nav.sidebar a[href^="https://app-companion-430619.appspot.com/docs"]')]
        .map(link => ({
          text: cleanText(link.textContent),
          href: absolute(link.getAttribute('href')),
        }))
        .filter(link => link.text && link.href);

      const internalLinks = [...document.querySelectorAll('a[href]')]
        .map(link => ({
          text: cleanText(link.textContent),
          href: absolute(link.getAttribute('href')),
        }))
        .filter(link => link.text && /\/docs\/?/.test(link.href));

      const main = document.querySelector('main');
      if (!main) {
        return { navLinks, internalLinks, title: '', heading: '', blocks: [], shadowHosts: [] };
      }

      const shadowHosts = [...document.querySelectorAll('*')]
        .filter(el => el.shadowRoot)
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className : '',
          textSample: cleanText(el.shadowRoot.textContent).slice(0, 240),
        }));

      const shouldSkip = node => {
        if (!(node instanceof Element)) return false;
        if (node.closest('nav, header, footer, aside, dialog, script, style, template')) return true;
        const text = cleanText(node.textContent);
        return ['Copy', 'Copy prompt', 'Copied', 'Terminal window'].includes(text);
      };

      const emitInline = node => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (!(node instanceof Element)) return '';
        const tag = node.tagName.toLowerCase();
        if (['script', 'style', 'template', 'svg', 'img', 'button'].includes(tag)) return '';
        if (tag === 'br') return '\n';
        const text = [...node.childNodes].map(emitInline).join('');
        if (tag === 'code') return `\`${text.trim()}\``;
        if (tag === 'strong' || tag === 'b') return `**${text.trim()}**`;
        if (tag === 'em' || tag === 'i') return `_${text.trim()}_`;
        if (tag === 'a') {
          const href = node.getAttribute('href');
          const label = text.trim();
          if (!href || !label) return label;
          return `[${label}](${absolute(href)})`;
        }
        return text;
      };

      const addBlock = (blocks, type, payload) => {
        if (payload.text !== undefined) payload.text = payload.text.trim();
        if (payload.text === '') return;
        blocks.push({ type, ...payload });
      };

      const processTable = table => {
        const rows = [...table.querySelectorAll('tr')].map(row =>
          [...row.children].map(cell => cleanText(cell.textContent))
        ).filter(row => row.some(Boolean));
        return rows;
      };

      const walk = (root, blocks, listStack = []) => {
        for (const child of root.children) {
          if (shouldSkip(child)) continue;
          const tag = child.tagName.toLowerCase();

          if (/^h[1-6]$/.test(tag)) {
            addBlock(blocks, 'heading', {
              level: Number(tag.slice(1)),
              text: cleanText(child.textContent),
              id: child.id || '',
            });
            continue;
          }

          if (tag === 'pre') {
            const code = child.querySelector('code');
            addBlock(blocks, 'code', {
              text: (code ? code.innerText || code.textContent : child.innerText || child.textContent || '').replace(/\n+$/, ''),
              language: code ? [...code.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || '' : '',
            });
            continue;
          }

          if (tag === 'table') {
            const rows = processTable(child);
            if (rows.length) blocks.push({ type: 'table', rows });
            continue;
          }

          if (tag === 'ul' || tag === 'ol') {
            const ordered = tag === 'ol';
            const items = [...child.children]
              .filter(item => item.tagName.toLowerCase() === 'li')
              .map(item => {
                const nested = [...item.children].filter(el => ['ul', 'ol'].includes(el.tagName.toLowerCase()));
                nested.forEach(el => el.remove());
                const text = cleanText(emitInline(item));
                return text;
              })
              .filter(Boolean);
            if (items.length) blocks.push({ type: 'list', ordered, items, depth: listStack.length });
            continue;
          }

          if (tag === 'blockquote') {
            addBlock(blocks, 'quote', { text: cleanText(emitInline(child)) });
            continue;
          }

          if (['p', 'figcaption'].includes(tag)) {
            addBlock(blocks, 'paragraph', { text: cleanText(emitInline(child)) });
            continue;
          }

          const role = child.getAttribute('role') || '';
          const className = child.className || '';
          if (role === 'note' || /note|tip|caution|warning|danger|aside|starlight-aside/i.test(String(className))) {
            addBlock(blocks, 'note', {
              text: cleanText(emitInline(child)),
              kind: cleanText(child.querySelector('[aria-label], .title, strong')?.textContent || ''),
            });
            continue;
          }

          const hasRecognizedBlock = child.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, pre, table, blockquote');
          if (!hasRecognizedBlock) {
            addBlock(blocks, 'paragraph', { text: cleanText(child.innerText || emitInline(child)) });
            continue;
          }

          walk(child, blocks, listStack);
        }
      };

      const blocks = [];
      walk(main, blocks);
      const firstHeading = blocks.find(block => block.type === 'heading');

      return {
        title: document.title,
        heading: firstHeading?.text || cleanText(main.querySelector('h1')?.textContent || ''),
        navLinks,
        internalLinks,
        blocks,
        shadowHosts,
      };
    });
  };

  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  const initialFrame = await waitForDocsFrame();
  const initialExtraction = await extractFromFrame(initialFrame);
  const frameStructure = await inspectFrameStructure();

  const discovered = new Map();
  discovered.set(normalizePublicUrl(START_URL), { source: 'start', text: 'Docs home' });
  for (const link of [...initialExtraction.navLinks, ...initialExtraction.internalLinks]) {
    const normalized = normalizePublicUrl(link.href);
    if (normalized && !discovered.has(normalized)) {
      discovered.set(normalized, { source: initialExtraction.navLinks.some(nav => nav.href === link.href) ? 'nav' : 'internal', text: link.text });
    }
  }

  const pages = [];
  const failures = [];

  for (const [url, meta] of discovered) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const frame = await waitForDocsFrame();
      await frame.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      const extraction = await extractFromFrame(frame);
      const finalUrl = normalizePublicUrl(page.url()) || url;
      pages.push({
        url,
        finalUrl,
        discoveredFrom: meta.source,
        navText: meta.text,
        frameUrl: frame.url(),
        title: extraction.title,
        heading: extraction.heading,
        blocks: extraction.blocks,
        linkCount: extraction.internalLinks.length,
        codeBlockCount: extraction.blocks.filter(block => block.type === 'code').length,
        tableCount: extraction.blocks.filter(block => block.type === 'table').length,
      });
    } catch (error) {
      failures.push({ url, message: error.message });
    }
  }

  const result = {
    fetchedAt: new Date().toISOString(),
    startUrl: START_URL,
    docsReachable: true,
    frameStructure,
    iframeEntered: frameStructure.length >= 3,
    shadowDomAccessed: true,
    shadowHostsFound: initialExtraction.shadowHosts,
    discoveredPages: [...discovered].map(([url, meta]) => ({ url, ...meta })),
    pages,
    failures,
  };

  const base64 = await page.evaluate(payload => {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, result);

  return {
    encoding: 'base64-json-v1',
    base64,
  };
}
