const { chromium } = require('playwright');
const BASE = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const check = (ok, label, extra) => {
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra !== undefined ? '  → ' + JSON.stringify(extra) : ''}`);
  };

  /* ---------- 1. Estado inicial: nada abaixo da dobra aparece ---------- */
  console.log('=== ESTADO INICIAL (sem scroll) ===');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('JS: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const inicial = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-anim]')];
    const vh = innerHeight;
    const abaixo = els.filter(e => e.getBoundingClientRect().top > vh);
    return {
      jsClass: document.documentElement.classList.contains('js'),
      total: els.length,
      abaixoDaDobra: abaixo.length,
      abaixoInvisiveis: abaixo.filter(e => +getComputedStyle(e).opacity < 0.05 ||
        getComputedStyle(e).clipPath.includes('inset')).length,
      ultimoCardOpacity: +getComputedStyle(document.querySelector('.work[data-i="11"]')).opacity,
    };
  });
  check(inicial.jsClass, 'html.js aplicado antes do paint');
  check(inicial.abaixoDaDobra > 10, 'há elementos animáveis abaixo da dobra', inicial.abaixoDaDobra);
  check(inicial.abaixoInvisiveis === inicial.abaixoDaDobra,
    'todos escondidos antes de entrar na viewport',
    `${inicial.abaixoInvisiveis}/${inicial.abaixoDaDobra}`);

  /* ---------- 2. Hero entra sozinho ---------- */
  console.log('\n=== ENTRADA DO HERO ===');
  await page.waitForTimeout(1400);
  const hero = await page.evaluate(() => {
    const h = document.querySelector('.hero');
    const kids = [...h.querySelectorAll('.hero__inner > *')];
    return {
      ready: h.classList.contains('is-ready'),
      visiveis: kids.filter(k => +getComputedStyle(k).opacity > 0.95).length,
      total: kids.length,
      delays: kids.map(k => k.style.getPropertyValue('--d')),
      imgScale: getComputedStyle(h.querySelector('.hero__media img')).transform,
    };
  });
  check(hero.ready, 'hero recebe .is-ready');
  check(hero.visiveis === hero.total, 'todos os blocos do hero entraram', `${hero.visiveis}/${hero.total}`);
  check(hero.delays.every((d, i) => d === (120 + i * 110) + 'ms'), 'atrasos encadeados no hero', hero.delays);

  /* ---------- 3. Stagger é aplicado no lote que entra junto ---------- */
  console.log('\n=== STAGGER POR LOTE ===');
  const grupos = await page.evaluate(() =>
    [...document.querySelectorAll('[data-stagger]')].map(g => ({
      nome: g.className.split(' ')[0] || g.tagName,
      step: +g.getAttribute('data-stagger'),
      filhos: g.querySelectorAll(':scope > [data-anim]').length,
    })));
  check(grupos.length >= 6, 'grupos com stagger declarados', grupos.map(g => g.nome));

  // A cascata deve reiniciar a cada lote que entra (na prática, a cada linha
  // da grade), e não acumular o atraso de todos os cards anteriores.
  await page.evaluate(() => document.querySelector('#servicos').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1600);
  const linha1 = await page.evaluate(() =>
    [...document.querySelectorAll('.services > .service')].map(e => e.style.getPropertyValue('--d')));
  await page.evaluate(() => scrollBy(0, 420));
  await page.waitForTimeout(1600);
  const linha2 = await page.evaluate(() =>
    [...document.querySelectorAll('.services > .service')].map(e => e.style.getPropertyValue('--d')));

  const primeira = linha1.slice(0, 3).join(',');
  const segunda = linha2.slice(3, 6).join(',');
  check(primeira === '0ms,70ms,140ms', 'primeira linha de serviços cascateia 0/70/140', linha1.slice(0, 3));
  check(segunda === '0ms,70ms,140ms', 'segunda linha REINICIA a cascata (não acumula)', linha2.slice(3, 6));

  // o último card da grade entra sozinho -> atraso zero, não 11 x step (= 770ms)
  await page.evaluate(() => document.querySelector('.work[data-i="11"]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  const dUltimo = await page.evaluate(() =>
    document.querySelector('.work[data-i="11"]').style.getPropertyValue('--d'));
  check(dUltimo !== '' && parseInt(dUltimo, 10) < 300,
    'último card não herda o atraso da grade inteira', dUltimo);

  /* ---------- 4. Reveal ao rolar ---------- */
  console.log('\n=== REVEAL AO ROLAR ===');
  const alvo = '#obras .work[data-i="11"]';
  const antes = inicial.ultimoCardOpacity;
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), alvo);
  await page.waitForTimeout(2000);
  const depois = await page.evaluate(s => {
    const el = document.querySelector(s);
    const cs = getComputedStyle(el);
    return { op: +cs.opacity, tr: cs.transform, isIn: el.classList.contains('is-in') };
  }, alvo);
  check(antes < 0.05, 'último card começa invisível', antes);
  check(depois.op > 0.95 && depois.isIn && depois.tr === 'none', 'último card revelado ao entrar', depois);

  /* ---------- 5. will-change liberado ---------- */
  console.log('\n=== WILL-CHANGE ===');
  await page.waitForTimeout(2600);
  const wc = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-anim].is-in')];
    return { revelados: els.length, liberados: els.filter(e => e.classList.contains('is-done')).length };
  });
  check(wc.liberados > 0 && wc.liberados === wc.revelados, 'will-change liberado após a transição', wc);

  /* ---------- 6. Parallax ---------- */
  console.log('\n=== PARALLAX ===');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const banda = '.band__media img';
  await page.evaluate(() => document.querySelector('.band').scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(400);
  const py1 = await page.evaluate(s => document.querySelector(s).style.getPropertyValue('--py'), banda);
  await page.evaluate(() => scrollBy(0, 700));
  await page.waitForTimeout(400);
  const py2 = await page.evaluate(s => document.querySelector(s).style.getPropertyValue('--py'), banda);
  check(py1 !== '' && py2 !== '' && py1 !== py2, 'faixa desloca com o scroll', { py1, py2 });

  const heroPy1 = await page.evaluate(() => {
    scrollTo(0, 0); return new Promise(r => setTimeout(() =>
      r(document.querySelector('.hero__media').style.getPropertyValue('--py')), 350));
  });
  const heroPy2 = await page.evaluate(() => {
    scrollTo(0, 500); return new Promise(r => setTimeout(() =>
      r(document.querySelector('.hero__media').style.getPropertyValue('--py')), 350));
  });
  check(heroPy1 !== heroPy2, 'hero desloca com o scroll', { heroPy1, heroPy2 });

  /* ---------- 7. Barra de progresso ---------- */
  console.log('\n=== BARRA DE PROGRESSO ===');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  const topo = await page.evaluate(() => document.querySelector('.progress').style.getPropertyValue('--p'));
  // rola até o fim e deixa as imagens lazy assentarem antes de medir
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const prog = { topo, fim: await page.evaluate(() => document.querySelector('.progress').style.getPropertyValue('--p')) };
  check(+prog.topo < 0.05 && +prog.fim > 0.95, 'progresso vai de 0 a 1', prog);

  /* ---------- 8. Filetes animados ---------- */
  console.log('\n=== FILETES (eyebrow e etapas) ===');
  const filetes = await page.evaluate(() => {
    const step = document.querySelector('.step.is-in .step__rule');
    const eb = document.querySelector('.eyebrow__rule');
    return {
      stepScale: step ? getComputedStyle(step).transform : null,
      stepIsIn: !!step,
      ebScale: eb ? getComputedStyle(eb).transform : null,
    };
  });
  check(filetes.stepIsIn && filetes.stepScale && !filetes.stepScale.includes('matrix(0'),
    'régua da etapa cresceu até 100%', filetes.stepScale);
  check(filetes.ebScale && !filetes.ebScale.includes('matrix(0'),
    'filete do eyebrow cresceu', filetes.ebScale);

  /* ---------- 9. Sem JavaScript, o site aparece inteiro ---------- */
  console.log('\n=== SEM JAVASCRIPT ===');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const pNo = await noJs.newPage();
  await pNo.goto(BASE + '/', { waitUntil: 'load' });
  const semJs = await pNo.evaluate === undefined ? null : await pNo.locator('[data-anim]').first().isVisible();
  const opacidades = await pNo.$$eval('[data-anim]', els =>
    els.map(e => getComputedStyle(e).opacity).filter(o => +o < 0.95).length);
  check(opacidades === 0, 'sem JS, nenhum elemento fica invisível', { invisiveis: opacidades });
  await noJs.close();

  /* ---------- 10. Reduced motion desliga tudo ---------- */
  console.log('\n=== PREFERS-REDUCED-MOTION ===');
  const rmCtx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const pRm = await rmCtx.newPage();
  await pRm.goto(BASE + '/', { waitUntil: 'networkidle' });
  await pRm.evaluate(() => scrollTo(0, 1200));
  await pRm.waitForTimeout(600);
  const rm = await pRm.evaluate(() => {
    const els = [...document.querySelectorAll('[data-anim]')];
    const bar = document.querySelector('.progress');
    const bandImg = document.querySelector('.band__media img');
    return {
      jsClass: document.documentElement.classList.contains('js'),
      invisiveis: els.filter(e => +getComputedStyle(e).opacity < 0.95).length,
      comTransform: els.filter(e => getComputedStyle(e).transform !== 'none').length,
      barra: getComputedStyle(bar).display,
      bandTransform: getComputedStyle(bandImg).transform,
      heroPy: document.querySelector('.hero__media').style.getPropertyValue('--py'),
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  check(!rm.jsClass, 'html.js NÃO é aplicado sob reduced-motion');
  check(rm.invisiveis === 0, 'nada fica invisível', rm.invisiveis);
  check(rm.comTransform === 0, 'nenhum transform residual', rm.comTransform);
  check(rm.barra === 'none', 'barra de progresso escondida', rm.barra);
  check(rm.bandTransform === 'none', 'parallax da faixa desligado', rm.bandTransform);
  check(rm.heroPy === '', 'parallax do hero nunca escreve --py', rm.heroPy);
  check(rm.scroll === 'auto', 'smooth scroll desligado', rm.scroll);
  await rmCtx.close();

  console.log('\n=== ERROS DE RUNTIME ===');
  console.log(errors.length ? errors.join('\n') : 'nenhum');
  if (errors.length) fails++;

  console.log('\n===================================');
  console.log(fails === 0 ? 'MOVIMENTO: TUDO VERDE' : `MOVIMENTO: ${fails} FALHA(S)`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
