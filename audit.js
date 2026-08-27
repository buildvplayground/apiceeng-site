const { chromium } = require('playwright');

const PAGES = ['/', '/politica-de-privacidade.html', '/fornecedores.html'];
const WIDTHS = [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920];
const BASE = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let fails = 0;

  const errors = [];
  page.on('pageerror', e => errors.push('JS: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

  console.log('=== OVERFLOW HORIZONTAL ===');
  for (const p of PAGES) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const over = de.scrollWidth - de.clientWidth;
        const bad = [];
        if (over > 0) {
          const vw = de.clientWidth;
          document.querySelectorAll('body *').forEach(el => {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' && el.closest('.nav')) return;
            const b = el.getBoundingClientRect();
            if (b.width > 0 && (b.right > vw + 1 || b.left < -1)) {
              bad.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0] +
                       ' [' + Math.round(b.left) + '→' + Math.round(b.right) + ']');
            }
          });
        }
        return { over, bad: bad.slice(0, 6) };
      });
      const ok = r.over === 0;
      if (!ok) fails++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${p.padEnd(30)} ${String(w).padStart(5)}px  overflow=${r.over}` +
        (r.bad.length ? '\n       ' + r.bad.join('\n       ') : ''));
    }
  }

  console.log('\n=== MENU HAMBÚRGUER (375px) ===');
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const burgerVisible = await page.isVisible('#burger');
  await page.click('#burger');
  await page.waitForTimeout(600);
  const navOpen = await page.evaluate(() => {
    const n = document.getElementById('nav');
    return { open: n.classList.contains('is-open'), x: Math.round(n.getBoundingClientRect().left),
             expanded: document.getElementById('burger').getAttribute('aria-expanded'),
             scrim: document.getElementById('navScrim').classList.contains('is-on') };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const navClosed = await page.evaluate(() => !document.getElementById('nav').classList.contains('is-open'));
  console.log('burger visível:', burgerVisible, '| abre:', navOpen, '| Esc fecha:', navClosed);
  if (!burgerVisible || !navOpen.open || !navClosed) fails++;

  console.log('\n=== LIGHTBOX ===');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('.work[data-i="0"]');
  await page.waitForTimeout(400);
  let lb = await page.evaluate(() => ({
    open: document.getElementById('lb').open,
    src: document.getElementById('lbImg').getAttribute('src'),
    title: document.getElementById('lbTitle').textContent,
  }));
  await page.click('#lbNext');
  await page.waitForTimeout(300);
  const lb2 = await page.evaluate(() => document.getElementById('lbTitle').textContent);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const lbClosed = await page.evaluate(() => !document.getElementById('lb').open);
  const focusBack = await page.evaluate(() => document.activeElement.classList.contains('work'));
  console.log('abre:', lb.open, '|', lb.title, '→ next →', lb2, '| Esc fecha:', lbClosed, '| foco volta:', focusBack);
  if (!lb.open || lb.title === lb2 || !lbClosed || !focusBack) fails++;

  console.log('\n=== GRADE DO PORTFÓLIO ===');
  for (const [w, exp] of [[1280, 3], [900, 2], [400, 1]]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const cols = await page.evaluate(() =>
      getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length);
    console.log(`${cols === exp ? 'OK  ' : 'FAIL'} ${w}px → ${cols} colunas (esperado ${exp})`);
    if (cols !== exp) fails++;
  }

  console.log('\n=== BANNER DE COOKIES ===');
  await page.setViewportSize({ width: 1280, height: 900 });
  await ctx.clearCookies();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const barVisible = await page.isVisible('.cookiebar');
  await page.click('.cookiebar [data-act="accepted"]');
  await page.waitForTimeout(300);
  const dl = await page.evaluate(() => JSON.stringify(window.dataLayer || []));
  const gone = (await page.$('.cookiebar')) === null;
  console.log('aparece:', barVisible, '| some ao aceitar:', gone, '| dataLayer:', dl);
  if (!barVisible || !gone || !dl.includes('cookie_consent')) fails++;

  console.log('\n=== LINKS ÂNCORA E CTA ===');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const links = await page.evaluate(() => {
    const out = { anchorsOk: [], anchorsBroken: [], wa: 0, forms: 0 };
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      (document.getElementById(id) ? out.anchorsOk : out.anchorsBroken).push(id);
    });
    out.wa = document.querySelectorAll('a[href*="wa.me"]').length;
    out.forms = document.querySelectorAll('form').length;
    return out;
  });
  console.log('âncoras ok:', links.anchorsOk.join(', '));
  console.log('âncoras quebradas:', links.anchorsBroken.length ? links.anchorsBroken.join(', ') : 'nenhuma');
  console.log('CTAs WhatsApp na home:', links.wa, '| formulários na home:', links.forms);
  if (links.anchorsBroken.length || links.wa === 0 || links.forms > 0) fails++;

  console.log('\n=== ESTRUTURA / A11Y ===');
  const a11y = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => h.tagName);
    return {
      h1: document.querySelectorAll('h1').length,
      ordem: hs.join(' '),
      imgsSemAlt: [...document.querySelectorAll('img')].filter(i => i.getAttribute('alt') === null).length,
      imgsSemDim: [...document.querySelectorAll('img')].filter(i => !i.getAttribute('width')).length,
      imgsSemSrc: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === '').length,
      lang: document.documentElement.lang,
      skip: !!document.querySelector('.skip'),
      btnsSemNome: [...document.querySelectorAll('button')]
        .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
      linksSemNome: [...document.querySelectorAll('a')]
        .filter(a => !a.textContent.trim() && !a.getAttribute('aria-label')).length,
      lazy: [...document.querySelectorAll('img')].filter(i => i.getAttribute('loading') === 'lazy').length,
    };
  });
  console.log(JSON.stringify(a11y, null, 2));
  if (a11y.h1 !== 1 || a11y.imgsSemAlt || a11y.btnsSemNome || a11y.linksSemNome || a11y.imgsSemDim || a11y.imgsSemSrc) fails++;

  console.log('\n=== REDUCED MOTION ===');
  const ctx2 = await browser.newContext({ reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(300);
  const rm = await p2.evaluate(() => {
    const els = [...document.querySelectorAll('[data-anim]')];
    return { total: els.length,
             visiveis: els.filter(e => getComputedStyle(e).opacity === '1').length,
             semTransform: els.filter(e => getComputedStyle(e).transform === 'none').length,
             jsClass: document.documentElement.classList.contains('js'),
             scroll: getComputedStyle(document.documentElement).scrollBehavior };
  });
  console.log(rm);
  if (rm.visiveis !== rm.total || rm.semTransform !== rm.total || rm.scroll !== 'auto') fails++;
  await ctx2.close();

  console.log('\n=== ERROS DE RUNTIME / REDE ===');
  console.log(errors.length ? errors.join('\n') : 'nenhum');
  if (errors.length) fails++;

  console.log('\n===================================');
  console.log(fails === 0 ? 'AUDITORIA: TUDO VERDE' : `AUDITORIA: ${fails} FALHA(S)`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
