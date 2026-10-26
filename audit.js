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

  // o toque no link precisa cair no link (não no véu) e navegar, no topo e com a
  // página rolada (header com fundo); e o painel ocupa a altura da tela
  for (const yInicial of [0, 1500]) {
    const ctxT = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const pt = await ctxT.newPage();
    await pt.goto(BASE + '/', { waitUntil: 'networkidle' });
    await pt.evaluate(y => scrollTo(0, y), yInicial);
    await pt.waitForTimeout(400);
    await pt.tap('#burger');
    await pt.waitForTimeout(600);
    const m = await pt.evaluate(() => {
      const nav = document.getElementById('nav').getBoundingClientRect();
      const links = [...document.querySelectorAll('#nav a')].filter(a => a.getAttribute('href').startsWith('#'));
      const tocaveis = links.filter(a => {
        const b = a.getBoundingClientRect();
        const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return e && e.closest('a') === a;
      }).length;
      return { altura: Math.round(nav.height), vh: innerHeight, tocaveis, total: links.length };
    });
    const alvo = await pt.$('#nav a[href="#obras"]');
    const caixa = await alvo.boundingBox();
    await pt.touchscreen.tap(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await pt.waitForTimeout(1400);
    const depois = await pt.evaluate(() => ({ y: Math.round(scrollY),
      topoObras: Math.round(document.getElementById('obras').getBoundingClientRect().top),
      aberto: document.getElementById('nav').classList.contains('is-open') }));
    const ok = m.tocaveis === m.total && m.altura >= m.vh - 2 && !depois.aberto && Math.abs(depois.topoObras) < 140;
    console.log(`${ok ? 'OK  ' : 'FAIL'} menu por toque (página em y=${yInicial}): ${m.tocaveis}/${m.total} links tocáveis,` +
      ` painel ${m.altura}/${m.vh}px, "Obras" leva a #obras (topo a ${depois.topoObras}px)`);
    if (!ok) fails++;
    await ctxT.close();
  }

  console.log('\n=== LIGHTBOX POR OBRA ===');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('.work[data-i="0"]');
  await page.waitForTimeout(400);
  let lb = await page.evaluate(() => ({
    open: document.getElementById('lb').open,
    src: document.getElementById('lbImg').getAttribute('src'),
    title: document.getElementById('lbTitle').textContent,
    count: document.getElementById('lbCount').textContent,
    setas: !document.getElementById('lbNext').hidden,
  }));
  await page.click('#lbNext');
  await page.waitForTimeout(300);
  const lb2 = await page.evaluate(() => ({
    src: document.getElementById('lbImg').getAttribute('src'),
    title: document.getElementById('lbTitle').textContent,
    count: document.getElementById('lbCount').textContent,
    anuncio: document.getElementById('lbLive').textContent,
    nome: document.getElementById('lb').getAttribute('aria-label'),
  }));
  const anunciou = /^Foto 2 de \d+: \S/.test(lb2.anuncio) && lb2.nome.includes(lb2.title);
  console.log(`${anunciou ? 'OK  ' : 'FAIL'} troca de foto anunciada ("${lb2.anuncio.slice(0, 40)}…") e diálogo nomeado com a obra`);
  if (!anunciou) fails++;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const lbClosed = await page.evaluate(() => !document.getElementById('lb').open);
  const focusBack = await page.evaluate(() => document.activeElement.classList.contains('work'));
  // a seta avança DENTRO da obra: a foto e o contador mudam, o título da obra não
  const naObra = lb2.src !== lb.src && lb2.title === lb.title && /^2 \/ \d+$/.test(lb2.count);
  console.log('abre:', lb.open, '|', lb.title, lb.count, '→ next →', lb2.count,
    '| mesma obra, outra foto:', naObra, '| Esc fecha:', lbClosed, '| foco volta:', focusBack);
  if (!lb.open || !/^1 \/ \d+$/.test(lb.count) || !lb.setas || !naObra || !lbClosed || !focusBack) fails++;

  // toda galeria declarada existe no servidor e o "N fotos" do card bate com ela
  const galerias = await page.evaluate(() => [...document.querySelectorAll('.work')].map(w => ({
    fotos: (w.getAttribute('data-gallery') || '').split('|'),
    dims: (w.getAttribute('data-dims') || '').split('|'),
    legendas: (w.getAttribute('data-legendas') || '').split('|').filter(l => l.trim()).length,
    // "6 fotos" ou "4 fotos e 2 projetos 3D": soma os números da contagem visível
    n: (w.querySelector('.work__n').textContent.match(/\d+(?= (fotos?|projetos?))/g) || []).reduce((t, x) => t + +x, 0),
  })));
  let galeriaOk = true;
  for (const g of galerias) {
    if (g.fotos.length !== g.n || g.legendas !== g.n || g.dims.length !== g.n) galeriaOk = false;
    for (let k = 0; k < g.fotos.length; k++) {
      const f = g.fotos[k];
      if (!f.trim()) { galeriaOk = false; console.log('       entrada vazia na galeria'); continue; }
      const r = await page.request.get(BASE + '/' + f);
      if (r.status() !== 200) { galeriaOk = false; console.log('       foto ausente:', f); continue; }
      // a dimensão declarada (usada no lightbox para não saltar) bate com o arquivo?
      const real = await page.evaluate(src => new Promise(ok => {
        const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('erro'); i.src = src;
      }), f);
      if (real !== g.dims[k]) { galeriaOk = false; console.log(`       ${f}: data-dims ${g.dims[k]} ≠ real ${real}`); }
    }
  }
  console.log(`${galeriaOk ? 'OK  ' : 'FAIL'} galerias: ${galerias.map(g => g.fotos.length).join('/')} fotos, legendas e "N fotos" conferem`);
  if (!galeriaOk) fails++;

  /* Carrossel de obras: exceção registrada ao "grade 3/2/1" (pedido do cliente,
     05/10/2026), com obras maiores: 2 inteiras + a próxima pela borda no desktop,
     1 + borda no tablet e no celular. Card = obra e número par continuam valendo.
     Em tela grande com mouse o avanço é preso à rolagem (palco travado): a seta
     rola a página até a obra seguinte. */
  console.log('\n=== CARROSSEL DO PORTFÓLIO ===');
  for (const [w, exp] of [[1280, 2], [800, 1], [400, 1]]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // posiciona a seção no topo antes de medir e clicar: o clique do Playwright
    // rola até o botão, e no modo travado essa rolagem por si só já moveria o trilho
    await page.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY)));
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const t = document.getElementById('obrasTrilho');
      const tr = t.getBoundingClientRect();
      const slides = [...t.querySelectorAll('.carousel__slide')];
      const inteiros = slides.filter(s => {
        const b = s.getBoundingClientRect();
        return b.left >= tr.left - 1 && b.right <= tr.right + 1;
      }).length;
      return {
        inteiros, total: slides.length,
        rotulos: slides.every((s, i) => s.getAttribute('aria-label') === `${i + 1} de ${slides.length}`),
        prev: document.getElementById('obrasPrev').getAttribute('aria-disabled'),
        status: document.getElementById('obrasStatus').textContent,
        x0: t.scrollLeft,
      };
    });
    const fixo = await page.evaluate(() => document.getElementById('obras').classList.contains('obras--fixo'));
    await page.click('#obrasNext');
    await page.waitForTimeout(1600);
    const depois = await page.evaluate(() => ({
      x: document.getElementById('obrasTrilho').scrollLeft,
      prev: document.getElementById('obrasPrev').getAttribute('aria-disabled'),
      status: document.getElementById('obrasStatus').textContent,
      passo: document.querySelector('.carousel__slide').getBoundingClientRect().width +
        (parseFloat(getComputedStyle(document.getElementById('obrasTrilho')).columnGap) || 0),
    }));
    // a seta avança exatamente uma "página" de obras inteiras, nem mais nem menos
    const umaPagina = Math.abs((depois.x - r.x0) - depois.passo * r.inteiros) <= 3;
    const ok = r.inteiros === exp && r.total % 2 === 0 && r.rotulos && r.prev === 'true' &&
      umaPagina && depois.prev === 'false' && depois.status !== r.status;
    // o modo travado só existe com mouse e acima de 900px
    const modoOk = fixo === (w > 900);
    console.log(`${ok && modoOk ? 'OK  ' : 'FAIL'} ${w}px → ${r.inteiros} obra(s) inteira(s) por vista (esperado ${exp}), ${r.total} obras,` +
      ` ${fixo ? 'avanço preso à rolagem' : 'carrossel de arrastar'}, "${r.status}" → próxima → "${depois.status}"`);
    if (!ok || !modoOk) fails++;
  }

  console.log('\n=== BANNER DE COOKIES ===');
  await page.setViewportSize({ width: 1280, height: 900 });
  await ctx.clearCookies();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // aviso informativo: "Entendi" grava cookie_notice=ok; "Ver finalidades" abre a lista;
  // nenhum evento de consentimento vai para o dataLayer (as tags disparam desde o carregamento)
  const barVisible = await page.isVisible('.cookiebar');
  const finsFechada = await page.$eval('.cookiebar [data-cookie-fins]', el => el.hidden);
  await page.click('.cookiebar [data-cookie-more]');
  const finsAberta = await page.evaluate(() => {
    const fins = document.querySelector('.cookiebar [data-cookie-fins]');
    const more = document.querySelector('.cookiebar [data-cookie-more]');
    return !fins.hidden && more.getAttribute('aria-expanded') === 'true' &&
      more.getAttribute('aria-controls') === fins.id;
  });
  await page.click('.cookiebar [data-cookie-ok]');
  await page.waitForTimeout(300);
  const dl = await page.evaluate(() => JSON.stringify(window.dataLayer || []));
  const gone = (await page.$('.cookiebar')) === null;
  const nota = await page.evaluate(() => localStorage.getItem('cookie_notice'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const naoVolta = (await page.$('.cookiebar')) === null;
  const semEvento = !/cookie_consent|consent_update|analytics_storage|ad_storage/.test(dl);
  console.log('aparece:', barVisible, '| finalidades fechadas → abrem:', finsFechada && finsAberta,
    '| some em "Entendi":', gone, '| cookie_notice:', nota, '| não volta após recarregar:', naoVolta,
    '| sem evento de consentimento no dataLayer:', semEvento);
  if (!barVisible || !finsFechada || !finsAberta || !gone || nota !== 'ok' || !naoVolta || !semEvento) fails++;

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
