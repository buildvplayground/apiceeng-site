const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const dump = async (tag) => {
    const r = await p.evaluate(() => {
      const vh = innerHeight;
      return [...document.querySelectorAll('.services > .service')].map((e, i) => {
        const b = e.getBoundingClientRect();
        return { i, d: e.style.getPropertyValue('--d'), isIn: e.classList.contains('is-in'),
                 top: Math.round(b.top), bottom: Math.round(b.bottom), vh, op: getComputedStyle(e).opacity };
      });
    });
    console.log('--- ' + tag);
    r.forEach(x => console.log(JSON.stringify(x)));
  };
  await dump('inicial (topo da pagina)');
  await p.evaluate(() => document.querySelector('#servicos').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(2500);
  await dump('apos scrollIntoView(start) + 2.5s');
  await p.evaluate(() => scrollBy(0, 400));
  await p.waitForTimeout(1500);
  await dump('apos +400px');
  await b.close();
})();
