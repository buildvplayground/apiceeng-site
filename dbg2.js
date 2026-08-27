const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in'));
    const h = document.querySelector('.hero'); if (h) h.classList.add('is-ready');
  });
  await p.waitForTimeout(500);
  console.log('--- CORTADOS A 200% ---');
  const cut = await p.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,p,a,button')].filter(e => {
      const cs = getComputedStyle(e);
      return cs.overflow === 'hidden' && e.scrollHeight > e.clientHeight + 2;
    }).map(e => ({
      sel: e.tagName + '.' + String(e.className).split(' ')[0],
      pai: e.parentElement.className,
      sh: e.scrollHeight, ch: e.clientHeight,
      txt: e.textContent.trim().slice(0, 40),
    })));
  cut.forEach(c => console.log(JSON.stringify(c)));

  console.log('\n--- ORFAS (fonte normal) ---');
  await p.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await p.waitForTimeout(300);
  const orf = await p.evaluate(() => {
    function linhasDe(el) {
      const r = document.createRange(); r.selectNodeContents(el);
      const rects = [...r.getClientRects()].filter(x => x.width > 1);
      const tops = [...new Set(rects.map(x => Math.round(x.top)))].sort((a, b) => a - b);
      return tops.map(t => {
        const nesta = rects.filter(x => Math.abs(x.top - t) < 3);
        return { top: t, w: Math.round(Math.max(...nesta.map(x => x.right)) - Math.min(...nesta.map(x => x.left))) };
      });
    }
    const out = [];
    document.querySelectorAll('h1,h2,h3,p,li').forEach(el => {
      if (!el.textContent.trim() || el.querySelector('p,li')) return;
      const cs = getComputedStyle(el); if (cs.display === 'none') return;
      const ls = linhasDe(el);
      if (ls.length < 2) return;
      const larguraMax = Math.max(...ls.map(l => l.w));
      const ultima = ls[ls.length - 1].w;
      if (ultima / larguraMax < 0.25) {
        out.push({ sel: el.tagName + '.' + String(el.className).split(' ')[0],
                   linhas: ls.length, razao: +(ultima / larguraMax).toFixed(2),
                   wrap: cs.textWrap || cs.textWrapStyle,
                   txt: el.textContent.trim().replace(/\s+/g,' ').slice(0, 60) });
      }
    });
    return out;
  });
  orf.forEach(o => console.log(JSON.stringify(o)));
  await b.close();
})();
