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
      carrosselOpacity: +getComputedStyle(document.getElementById('obrasCarrossel')).opacity,
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

  // rolagem humana: passos pequenos, como uma roda de mouse
  async function rolarDevagar(pg, total, passo = 90, pausa = 55) {
    for (let i = 0; i < Math.ceil(total / passo); i++) {
      await pg.mouse.wheel(0, passo);
      await pg.waitForTimeout(pausa);
    }
    await pg.waitForTimeout(500);
  }

  // A cascata deve reiniciar a cada lote que entra (na prática, a cada linha
  // da grade), e não acumular o atraso de todos os cards anteriores.
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const alvoY = await page.evaluate(() =>
    document.querySelector('.services').getBoundingClientRect().top - innerHeight + 260);
  // passos de leitura calma: com 90px/55ms o pico de velocidade do lerp às vezes
  // passa do limite de "rolagem rápida" do motor e a linha entra pronta (correto
  // para o motor, mas não é o que este teste mede)
  await rolarDevagar(page, alvoY, 60, 80);
  const linha1 = await page.evaluate(() =>
    [...document.querySelectorAll('.services > .service')].map(e => e.style.getPropertyValue('--d')));
  // diagnóstico, só aparece se a cascata falhar
  const diag1 = await page.evaluate(() => ({ y: Math.round(scrollY),
    cards: [...document.querySelectorAll('.services > .service')].slice(0, 3)
      .map(e => e.className.replace('service', '').trim() + '@' + Math.round(e.getBoundingClientRect().top)) }));
  await rolarDevagar(page, 300, 60, 80);
  const linha2 = await page.evaluate(() =>
    [...document.querySelectorAll('.services > .service')].map(e => e.style.getPropertyValue('--d')));

  check(linha1.slice(0, 3).join(',') === '0ms,70ms,140ms',
    'primeira linha de servicos cascateia 0/70/140',
    linha1.slice(0, 3).join(',') === '0ms,70ms,140ms' ? linha1.slice(0, 3) : { d: linha1.slice(0, 3), ...diag1 });
  check(linha2.slice(3, 6).join(',') === '0ms,70ms,140ms',
    'segunda linha REINICIA a cascata (nao acumula)', linha2.slice(3, 6));

  /* ---------- 3b. Titulo palavra por palavra ---------- */
  console.log('\n=== SPLIT DE TITULO ===');
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(700);
    const r = await p2.evaluate(() => {
      const h2s = [...document.querySelectorAll('#conteudo h2')];
      const comSplit = h2s.filter(h => h.dataset.split === '1');
      const um = comSplit[0];
      return {
        h2: h2s.length,
        split: comSplit.length,
        soft: h2s.filter(h => h.getAttribute('data-anim') === 'soft').length,
        // o texto tem de sobreviver a divisao, sem espaco perdido
        textoIntacto: um ? /\S \S/.test(um.textContent) : false,
        palavras: um ? um.querySelectorAll('.w > i').length : 0,
        atrasos: um ? [...um.querySelectorAll('.w > i')].slice(0, 4)
          .map(i => i.style.getPropertyValue('--wd')) : [],
        h1Preservado: !!document.querySelector('.hero h1 em'),
      };
    });
    check(r.split >= 4, 'titulos de texto puro divididos em palavras', { split: r.split, de: r.h2 });
    check(r.soft === r.split, 'bloco do titulo dividido passa a "soft"', { soft: r.soft });
    check(r.textoIntacto, 'espacos entre palavras preservados');
    check(r.atrasos.join(',') === '0ms,42ms,84ms,126ms', 'stagger de 42ms por palavra', r.atrasos);
    check(r.h1Preservado, 'h1 com <em> NAO e dividido (marcacao preservada)');

    // as palavras sobem de dentro da mascara e chegam a zero
    await p2.evaluate(() => document.querySelector('#servicos h2').scrollIntoView({ block: 'center' }));
    await p2.waitForTimeout(1800);
    const fim = await p2.evaluate(() => {
      const i = document.querySelector('#servicos h2 .w > i');
      const w = i.closest('.w');
      return { tr: getComputedStyle(i).transform, overflow: getComputedStyle(w).overflow,
               isIn: document.querySelector('#servicos h2').classList.contains('is-in') };
    });
    check(fim.tr === 'none' || fim.tr === 'matrix(1, 0, 0, 1, 0, 0)',
      'palavras terminam em repouso', fim.tr);
    check(fim.overflow === 'hidden', 'cada palavra tem mascara propria', fim.overflow);
    await c.close();
  }

  /* ---------- 3c. A animacao cabe na tela ---------- */
  console.log('\n=== A ANIMACAO TERMINA A VISTA ===');
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(700);

    // rolagem media: o motor deve encurtar a duracao, nao deixar a animacao
    // terminar fora da tela
    for (let i = 0; i < 10; i++) { await p2.mouse.wheel(0, 320); await p2.waitForTimeout(45); }
    await p2.waitForTimeout(1200);

    const r = await p2.evaluate(() => {
      const revelados = [...document.querySelectorAll('[data-anim].is-in')];
      const comDur = revelados.filter(e => e.style.getPropertyValue('--dur'));
      const acimaDaTela = revelados.filter(e => e.getBoundingClientRect().bottom < 0);
      return {
        revelados: revelados.length,
        encurtados: comDur.length,
        duracoes: comDur.slice(0, 5).map(e => e.style.getPropertyValue('--dur')),
        // nada que ja saiu por cima pode estar com opacidade parcial
        fantasmas: acimaDaTela.filter(e => {
          const o = +getComputedStyle(e).opacity;
          return o > 0.02 && o < 0.98;
        }).length,
      };
    });
    check(r.fantasmas === 0, 'nada segue animando acima da dobra', r.fantasmas);
    check(r.duracoes.every(d => parseInt(d, 10) >= 260),
      'duracao encurtada nunca fica abaixo do minimo', r.duracoes);
    console.log(`     (${r.revelados} revelados, ${r.encurtados} com duracao encurtada)`);
    await c.close();
  }

  /* ---------- 3d. Scroll suave por lerp ---------- */
  console.log('\n=== LERP DA RODA DO MOUSE ===');
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(600);

    // um unico giro de roda deve produzir movimento gradual, nao um salto
    await p2.evaluate(() => scrollTo(0, 0));
    await p2.waitForTimeout(300);
    await p2.mouse.move(700, 500);
    await p2.mouse.wheel(0, 600);
    const amostras = [];
    for (let i = 0; i < 8; i++) {
      amostras.push(await p2.evaluate(() => Math.round(scrollY)));
      await p2.waitForTimeout(55);
    }
    const cresceGradual = amostras.some((v, i) => i > 0 && v > amostras[i - 1] && v < 600);
    const chegou = amostras[amostras.length - 1] > 300;
    check(cresceGradual && chegou, 'a roda move em passos, nao em salto', amostras.join(' '));

    // o loop cede quando outro codigo mexe no scroll
    await p2.mouse.wheel(0, 2000);
    await p2.waitForTimeout(60);
    await p2.evaluate(() => scrollTo(0, 0));
    await p2.waitForTimeout(500);
    const cedeu = await p2.evaluate(() => Math.round(scrollY));
    check(cedeu < 60, 'o lerp cede a um scroll externo', cedeu);

    // nao sequestra a roda com o lightbox aberto
    await p2.evaluate(() => document.querySelector('.work[data-i="0"]').scrollIntoView({ block: 'center' }));
    await p2.waitForTimeout(500);
    await p2.click('.work[data-i="0"]');
    await p2.waitForTimeout(500);
    const yAntes = await p2.evaluate(() => Math.round(scrollY));
    await p2.mouse.wheel(0, 700);
    await p2.waitForTimeout(500);
    const yDepois = await p2.evaluate(() => Math.round(scrollY));
    check(Math.abs(yDepois - yAntes) < 40, 'com o lightbox aberto a pagina nao rola',
      { yAntes, yDepois });
    await p2.keyboard.press('Escape');

    // roda vertical sobre o carrossel segue no lerp; gesto lateral move o trilho
    await p2.evaluate(() => scrollTo(0, 0));
    await p2.waitForTimeout(300);
    await p2.evaluate(() => document.getElementById('obrasTrilho').scrollIntoView({ block: 'center' }));
    await p2.waitForTimeout(500);
    const caixa = await p2.evaluate(() => {
      const b = document.getElementById('obrasTrilho').getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await p2.mouse.move(caixa.x, caixa.y);
    const y0 = await p2.evaluate(() => Math.round(scrollY));
    await p2.mouse.wheel(0, 500);
    const amostrasC = [];
    for (let i = 0; i < 6; i++) { amostrasC.push(await p2.evaluate(() => Math.round(scrollY)) - y0); await p2.waitForTimeout(50); }
    check(amostrasC.some((v, i) => i > 0 && v > amostrasC[i - 1] && v < 500) && amostrasC[5] > 150,
      'roda vertical sobre o carrossel rola a página em passos', amostrasC.join(' '));
    await p2.waitForTimeout(900);
    await p2.evaluate(() => document.getElementById('obrasTrilho').scrollIntoView({ block: 'center' }));
    await p2.waitForTimeout(400);
    const cx = await p2.evaluate(() => {
      const b = document.getElementById('obrasTrilho').getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await p2.mouse.move(cx.x, cx.y);
    const antesX = await p2.evaluate(() => ({ x: document.getElementById('obrasTrilho').scrollLeft, y: Math.round(scrollY) }));
    await p2.mouse.wheel(400, 0);
    await p2.waitForTimeout(700);
    const depoisX = await p2.evaluate(() => ({ x: document.getElementById('obrasTrilho').scrollLeft, y: Math.round(scrollY) }));
    check(depoisX.x > antesX.x, 'gesto lateral do trackpad também passa as obras', { antesX, depoisX });

    // avanço preso à rolagem: com o topo da seção no topo da tela, a roda
    // passa as obras com o palco travado e, no fim do trilho, a página segue
    const topoObras = await p2.evaluate(() => {
      const s = document.getElementById('obras');
      return { fixo: s.classList.contains('obras--fixo'), y: Math.round(s.getBoundingClientRect().top + scrollY) };
    });
    check(topoObras.fixo, 'tela grande com mouse: carrossel em modo travado');
    await p2.evaluate(y => scrollTo(0, y), topoObras.y);
    await p2.waitForTimeout(400);
    await p2.mouse.move(cx.x, cx.y);
    const trava = [];
    for (let i = 0; i < 6; i++) {
      await p2.mouse.wheel(0, 240); await p2.waitForTimeout(160);
      trava.push(await p2.evaluate(() => ({ x: Math.round(document.getElementById('obrasTrilho').scrollLeft),
        palco: Math.round(document.querySelector('.obras__palco').getBoundingClientRect().top) })));
    }
    check(trava.every(t => Math.abs(t.palco) <= 1) && trava.every((t, i) => i === 0 || t.x > trava[i - 1].x),
      'a roda avança as obras com o palco travado', trava.map(t => t.x + '@' + t.palco).join(' '));
    // durante a rolagem o estado visível acompanha o trilho, quadro a quadro
    const coerente = await p2.evaluate(() => {
      const t = document.getElementById('obrasTrilho');
      const passo = document.querySelector('.carousel__slide').getBoundingClientRect().width +
        (parseFloat(getComputedStyle(t).columnGap) || 0);
      const primeira = Math.min(6, Math.ceil(t.scrollLeft / passo - 0.02) + 1);
      const st = document.getElementById('obrasStatus').textContent;
      return { primeira, st, ok: st.includes(' ' + primeira + ' ') || t.scrollLeft >= t.scrollWidth - t.clientWidth - 2 };
    });
    check(coerente.ok, 'o estado "Obras X a Y" acompanha o trilho durante a rolagem', coerente);
    for (let i = 0; i < 18; i++) { await p2.mouse.wheel(0, 320); await p2.waitForTimeout(70); }
    await p2.waitForTimeout(900);
    const solta = await p2.evaluate(() => {
      const t = document.getElementById('obrasTrilho');
      return { noFim: t.scrollLeft >= t.scrollWidth - t.clientWidth - 2,
               palco: Math.round(document.querySelector('.obras__palco').getBoundingClientRect().top) };
    });
    check(solta.noFim && solta.palco < -50, 'depois da última obra o palco solta e a página segue', solta);

    // clique de mouse num card com a seção ainda entrando na tela: abre a
    // galeria e a página não salta (o foco do mousedown não pode rolar nada)
    await p2.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY) - 250));
    await p2.waitForTimeout(600);
    const alvoCard = await p2.evaluate(() => {
      const b = document.querySelector('.work[data-i="1"]').getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 60) };
    });
    const yClique = await p2.evaluate(() => Math.round(scrollY));
    await p2.mouse.click(alvoCard.x, alvoCard.y);
    await p2.waitForTimeout(500);
    const clique = await p2.evaluate(() => ({ aberto: document.getElementById('lb').open, y: Math.round(scrollY) }));
    check(clique.aberto && Math.abs(clique.y - yClique) < 4, 'clique de mouse no card abre a galeria sem a página saltar', { ...clique, yClique });
    await p2.keyboard.press('Escape');
    await p2.waitForTimeout(400);
    const yFechou = await p2.evaluate(() => Math.round(scrollY));
    check(Math.abs(yFechou - yClique) < 4, 'fechar a galeria devolve o foco sem rolar a página', { yFechou, yClique });

    // teclado: End vai ao fim
    await p2.waitForTimeout(400);
    await p2.evaluate(() => document.body.focus());
    await p2.keyboard.press('End');
    await p2.waitForTimeout(1400);
    const noFim = await p2.evaluate(() =>
      scrollY >= (document.documentElement.scrollHeight - innerHeight) - 8);
    check(noFim, 'End leva ao fim da pagina');
    await c.close();
  }

  /* ---------- 4. Reveal ao rolar ---------- */
  console.log('\n=== REVEAL AO ROLAR ===');
  // o reveal é do carrossel inteiro: slide fora da vista lateral nunca fica
  // preso invisível esperando um observer que não dispararia
  const alvo = '#obrasCarrossel';
  const antes = inicial.carrosselOpacity;
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), alvo);
  await page.waitForTimeout(2000);
  const depois = await page.evaluate(s => {
    const el = document.querySelector(s);
    const cs = getComputedStyle(el);
    return { op: +cs.opacity, tr: cs.transform, isIn: el.classList.contains('is-in') };
  }, alvo);
  check(antes < 0.05, 'carrossel de obras começa invisível', antes);
  check(depois.op > 0.95 && depois.isIn && depois.tr === 'none', 'carrossel revelado ao entrar', depois);
  const slidesAnimados = await page.evaluate(() => document.querySelectorAll('#obrasTrilho [data-anim]').length);
  check(slidesAnimados === 0, 'nenhum data-anim dentro do trilho (nada escondido fora da vista lateral)', slidesAnimados);

  /* ---------- 4a. Máscara e cortina revelam com o elemento na tela ----------
     Um alvo 100% recortado por clip-path nunca intersecta para o observer;
     aqui nada é forçado: rola devagar até centralizar e exige a revelação. */
  console.log('\n=== MÁSCARA E CORTINA NA TELA ===');
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(600);
    const alvos = await p2.evaluate(() => [...document.querySelectorAll('[data-anim="mask"],[data-anim="curtain"]')]
      .map((e, i) => { e.setAttribute('data-teste', i); return i; }));
    const presos = [];
    for (const i of alvos) {
      const destino = await p2.evaluate(i => {
        const e = document.querySelector(`[data-teste="${i}"]`);
        const b = e.getBoundingClientRect();
        return Math.round(b.top + scrollY - innerHeight / 2 + b.height / 2);
      }, i);
      let y = await p2.evaluate(() => scrollY);
      while (y < destino) { y = Math.min(destino, y + 40); await p2.evaluate(v => scrollTo(0, v), y); await p2.waitForTimeout(45); }
      await p2.waitForTimeout(1500);
      const r = await p2.evaluate(i => {
        const e = document.querySelector(`[data-teste="${i}"]`);
        return { isIn: e.classList.contains('is-in'), top: Math.round(e.getBoundingClientRect().top) };
      }, i);
      if (!r.isIn) presos.push({ i, ...r });
    }
    check(alvos.length >= 4 && presos.length === 0, 'foto do Sobre e citações das faixas aparecem na tela (sem forçar classe)',
      { total: alvos.length, presos });
    await c.close();
  }

  /* ---------- 4b. Guardas: quando NAO animar ---------- */
  console.log('\n=== QUANDO NAO ANIMAR ===');

  // (a) rolagem rapida: quem esta saltando recebe o conteudo pronto
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(700);
    for (let i = 0; i < 14; i++) { await p2.mouse.wheel(0, 900); }
    await p2.waitForTimeout(900);
    const r = await p2.evaluate(() => {
      const vis = [...document.querySelectorAll('[data-anim]')].filter(e => {
        const b = e.getBoundingClientRect();
        return b.top < innerHeight && b.bottom > 0;
      });
      return {
        naTela: vis.length,
        aindaAnimando: vis.filter(e => +getComputedStyle(e).opacity < 0.95).length,
      };
    });
    check(r.naTela > 0 && r.aindaAnimando === 0, 'rolagem rapida: nada fica animando na tela', r);
    await c.close();
  }

  // (b) zona final: chegar ao rodape nao deixa nada por revelar
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p2.waitForLoadState('networkidle');
    await p2.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p2.waitForTimeout(800);
    const r = await p2.evaluate(() => {
      const els = [...document.querySelectorAll('[data-anim]')];
      return {
        total: els.length,
        porRevelar: els.filter(e => !e.classList.contains('is-in')).length,
        invisiveis: els.filter(e => +getComputedStyle(e).opacity < 0.95).length,
      };
    });
    check(r.porRevelar === 0 && r.invisiveis === 0, 'zona final: nada sobra por revelar', r);
    await c.close();
  }

  // (c) rolar de volta para cima nao redispara animacao
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p2.waitForTimeout(900);
    for (let i = 0; i < 8; i++) { await p2.mouse.wheel(0, -700); await p2.waitForTimeout(70); }
    await p2.waitForTimeout(700);
    const invis = await p2.evaluate(() =>
      [...document.querySelectorAll('[data-anim]')].filter(e => +getComputedStyle(e).opacity < 0.95).length);
    check(invis === 0, 'subindo: nada volta a ficar invisivel', invis);
    await c.close();
  }

  // (d) salto por ancora do menu entrega a secao pronta
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(700);
    await p2.click('.nav a[href="#obras"]');
    await p2.waitForTimeout(1600);
    const r = await p2.evaluate(() => {
      const vis = [...document.querySelectorAll('#obras [data-anim]')].filter(e => {
        const b = e.getBoundingClientRect();
        return b.top < innerHeight && b.bottom > 0;
      });
      return { naTela: vis.length, invisiveis: vis.filter(e => +getComputedStyle(e).opacity < 0.95).length };
    });
    check(r.naTela > 0 && r.invisiveis === 0, 'salto de ancora entrega a secao pronta', r);
    await c.close();
  }

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
  const banda = '.band__frame img';
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

  /* ---------- 7b. Header compacta ao rolar ---------- */
  console.log('\n=== HEADER ===');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const hTopo = await page.evaluate(() => document.getElementById('header').getBoundingClientRect().height);
  await page.evaluate(() => scrollTo(0, 1600));
  await page.waitForTimeout(800);
  const hRolado = await page.evaluate(() => ({
    h: document.getElementById('header').getBoundingClientRect().height,
    compact: document.getElementById('header').classList.contains('is-compact'),
    stuck: document.getElementById('header').classList.contains('is-stuck'),
  }));
  check(hRolado.compact && hRolado.h < hTopo && hRolado.stuck,
    'header encolhe e ganha fundo ao rolar', { hTopo: Math.round(hTopo), h: Math.round(hRolado.h) });

  /* ---------- 8. Filetes animados ---------- */
  console.log('\n=== FILETES (etapas) ===');
  const filetes = await page.evaluate(() => {
    const step = document.querySelector('.step.is-in .step__rule');
    return {
      stepScale: step ? getComputedStyle(step).transform : null,
      stepIsIn: !!step,
      // o eyebrow ficou sem filete a pedido do cliente (05/10/2026)
      eyebrowsComFilete: document.querySelectorAll('.eyebrow .eyebrow__rule, .eyebrow i').length,
    };
  });
  check(filetes.stepIsIn && filetes.stepScale && !filetes.stepScale.includes('matrix(0'),
    'régua da etapa cresceu até 100%', filetes.stepScale);
  check(filetes.eyebrowsComFilete === 0, 'eyebrows sem filete', filetes.eyebrowsComFilete);

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
    const bandImg = document.querySelector('.band__frame img');
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
