const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const BASE = 'http://localhost:4173';
const PAGES = ['/', '/politica-de-privacidade.html', '/fornecedores.html'];

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const check = (ok, label, extra) => {
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra !== undefined ? '  → ' + JSON.stringify(extra) : ''}`);
  };

  /* ================= 1. axe-core (WCAG 2.0/2.1/2.2 A + AA) ================= */
  console.log('=== AXE-CORE ===');
  for (const url of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    // revela tudo para que o axe avalie o conteúdo real, não o estado inicial
    await page.evaluate(() => {
      document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in'));
      const h = document.querySelector('.hero'); if (h) h.classList.add('is-ready');
    });
    await page.waitForTimeout(500);

    const res = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();

    const graves = res.violations.filter(v => ['critical', 'serious'].includes(v.impact));
    const leves = res.violations.filter(v => !['critical', 'serious'].includes(v.impact));

    console.log(`\n  ${url}  —  ${res.passes.length} regras passaram`);
    if (!res.violations.length) console.log('    sem violações');
    res.violations.forEach(v => {
      console.log(`    [${v.impact}] ${v.id}: ${v.help}`);
      v.nodes.slice(0, 3).forEach(n => console.log(`        ${n.target.join(' ')}`));
      if (v.nodes.length > 3) console.log(`        (+${v.nodes.length - 3} outros)`);
    });
    if (graves.length) fails++;
    if (leves.length) console.log(`    (${leves.length} violação(ões) de impacto menor acima)`);
    await ctx.close();
  }

  /* ================= 2. Alvos de toque (WCAG 2.2 — 2.5.8) ================= */
  console.log('\n=== ALVOS DE TOQUE (mínimo 24x24 CSS px) ===');
  for (const w of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 850 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in')));
    const pequenos = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href], button, input, select, textarea').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.sr-only')) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.width < 24 || r.height < 24) {
          out.push({
            el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
            txt: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 26),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }
      });
      return out;
    });
    check(pequenos.length === 0, `alvos >= 24px em ${w}px`, pequenos.length ? pequenos : undefined);
    await ctx.close();
  }

  /* ================= 3. Zoom 200% (WCAG 1.4.4) e reflow (1.4.10) ================= */
  console.log('\n=== ZOOM E REFLOW ===');
  // 1.4.10: 320 CSS px de largura equivale a 1280px com zoom 400%
  for (const [w, h, label] of [[640, 512, 'zoom 200% (1280x1024)'], [320, 256, 'zoom 400% (1280x1024)']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in')));
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(over === 0, `${label} — ${url} sem rolagem horizontal`, over);
    }
    await ctx.close();
  }

  /* ================= 4. Texto redimensionável (1.4.4) ================= */
  console.log('\n=== TEXTO A 200% ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px'; // 200% do padrão
      document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in'));
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cortados: [...document.querySelectorAll('h1,h2,h3,p,a,button')].filter(e => {
        const cs = getComputedStyle(e);
        return cs.overflow === 'hidden' && e.scrollHeight > e.clientHeight + 2;
      }).length,
    }));
    check(r.over === 0 && r.cortados === 0, 'texto a 200% não quebra o layout nem corta conteúdo', r);
    await ctx.close();
  }

  /* O palco travado do carrossel (seção presa na tela) nunca pode cortar a
     navegação nem esmagar os cards: com texto a 200%, janela baixa ou zoom, ele
     precisa cair para o carrossel comum ou caber inteiro. */
  console.log('\n=== PALCO TRAVADO DO CARROSSEL ===');
  for (const [w, h, fonte, rot] of [[1440, 900, 16, 'normal'], [1280, 900, 32, 'texto 200%'], [1366, 768, 32, 'texto 200%'],
                                    [1280, 520, 16, 'janela baixa'], [911, 512, 16, 'zoom 150%'], [1280, 720, 24, 'fonte 24px']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(f => {
      document.documentElement.style.fontSize = f + 'px';
      document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in'));
      dispatchEvent(new Event('resize'));
    }, fonte);
    await page.waitForTimeout(300);
    await page.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY)));
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const s = document.getElementById('obras');
      const fixo = s.classList.contains('obras--fixo');
      const nav = document.getElementById('obrasNav').getBoundingClientRect();
      const trilho = document.getElementById('obrasTrilho').getBoundingClientRect();
      const card = document.querySelector('.work').getBoundingClientRect();
      const palco = document.querySelector('.obras__palco').getBoundingClientRect();
      return { fixo, card: Math.round(card.width),
               cabe: !fixo || (nav.top >= palco.top && trilho.bottom <= palco.bottom + 1 && card.width >= 260) };
    });
    check(r.cabe, `${rot} (${w}x${h}): ${r.fixo ? 'palco travado cabe inteiro' : 'carrossel comum'}`, r);
    await ctx.close();
  }

  // primeira visita: o banner de cookies não pode cobrir as setas do palco travado
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY)));
    await page.waitForTimeout(500);
    const cobertas = await page.evaluate(() => ['obrasPrev', 'obrasNext', 'obrasStatus'].filter(id => {
      const b = document.getElementById(id).getBoundingClientRect();
      const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !e || !e.closest('#' + id);
    }));
    const banner = await page.evaluate(() => !!document.querySelector('.cookiebar'));
    check(banner && cobertas.length === 0, 'com o banner de cookies aberto, setas e estado ficam à vista', cobertas);
    await ctx.close();
  }

  /* ================= 5. Espaçamento de texto (WCAG 1.4.12) ================= */
  console.log('\n=== ESPAÇAMENTO DE TEXTO (1.4.12) ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
                    word-spacing: 0.16em !important; }
                p { margin-bottom: 2em !important; }`,
    });
    await page.evaluate(() => document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in')));
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cortados: [...document.querySelectorAll('h1,h2,h3,p,.btn,.work__cap')].filter(e => {
        const cs = getComputedStyle(e);
        return (cs.overflow === 'hidden' || cs.overflowY === 'hidden') && e.scrollHeight > e.clientHeight + 3;
      }).length,
    }));
    check(r.over === 0 && r.cortados === 0, 'sobrevive ao espaçamento forçado do 1.4.12', r);
    await ctx.close();
  }

  /* ================= 6. Navegação por teclado ================= */
  console.log('\n=== TECLADO ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // 1º Tab = skip link
    await page.keyboard.press('Tab');
    const skip = await page.evaluate(() => {
      const a = document.activeElement;
      const r = a.getBoundingClientRect();
      return { cls: a.className, visivelNaTela: r.top >= 0 && r.top < innerHeight };
    });
    check(skip.cls === 'skip' && skip.visivelNaTela, 'skip link é o 1º foco e fica visível', skip);

    // foco visível em toda a cadeia
    const semAnel = await page.evaluate(async () => {
      const foco = [...document.querySelectorAll('a[href],button,input,select,textarea')]
        .filter(e => e.offsetParent !== null || e.classList.contains('skip'));
      const ruins = [];
      for (const el of foco) {
        el.focus();
        const cs = getComputedStyle(el);
        const temAnel = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== 'none';
        if (!temAnel) ruins.push(el.tagName + '.' + String(el.className).split(' ')[0]);
      }
      return { total: foco.length, ruins };
    });
    check(semAnel.ruins.length === 0, 'todo elemento focável tem anel de foco', semAnel);

    // armadilha de foco: o menu off-canvas fechado não deve ser tabulável… em desktop ele é visível, ok.
    // O lightbox precisa prender o foco enquanto aberto.
    await page.click('.work[data-i="0"]');
    await page.waitForTimeout(400);
    const presos = await page.evaluate(async () => {
      const dentro = [];
      for (let i = 0; i < 8; i++) {
        const a = document.activeElement;
        dentro.push(!!a.closest('#lb'));
      }
      return dentro;
    });
    const lbAberto = await page.evaluate(() => document.getElementById('lb').open);
    check(lbAberto, 'lightbox abre como <dialog> modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Espaço e Enter num card focado abrem a galeria (2.1.1); o motor de
    // movimento não pode transformar o Espaço em rolagem de página
    for (const tecla of ['Space', 'Enter']) {
      await page.evaluate(() => document.querySelector('.work[data-i="1"]').focus());
      const yAntes = await page.evaluate(() => Math.round(scrollY));
      await page.keyboard.press(tecla);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => ({ open: document.getElementById('lb').open, y: Math.round(scrollY) }));
      check(r.open && Math.abs(r.y - yAntes) < 4, `${tecla} no card abre a galeria sem rolar a página`, { ...r, yAntes });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Espaço na seta do carrossel avança as obras (no modo travado, rolando a
    // página até a obra seguinte; é o Espaço do botão, não o PageDown do motor)
    await page.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY)));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('obrasNext').focus());
    const xS = await page.evaluate(() => document.getElementById('obrasTrilho').scrollLeft);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1600);
    const seta = await page.evaluate(() => ({ x: Math.round(document.getElementById('obrasTrilho').scrollLeft),
      passo: Math.round(document.querySelector('.carousel__slide').getBoundingClientRect().width) }));
    // avança uma página de obras, não uma tela inteira (o que o PageDown faria)
    check(seta.x > xS && seta.x <= seta.passo * 3, 'Espaço na seta do carrossel avança as obras', seta);

    // modo comum (celular): Tab até a obra que aparece pela borda a traz inteira
    {
      const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p2 = await c2.newPage();
      await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p2.evaluate(() => document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in')));
      await p2.evaluate(() => document.querySelector('.work[data-i="0"]').focus());
      const visiveis = [];
      for (let i = 1; i < 6; i++) {
        await p2.keyboard.press('Tab');
        await p2.waitForTimeout(500);
        visiveis.push(await p2.evaluate(() => {
          const t = document.getElementById('obrasTrilho').getBoundingClientRect();
          const b = document.activeElement.getBoundingClientRect();
          const vis = Math.max(0, Math.min(b.right, t.right) - Math.max(b.left, t.left)) / b.width;
          return Math.round(vis * 100);
        }));
      }
      check(visiveis.every(v => v >= 98), 'celular: cada Tab traz a obra focada inteira para o trilho', visiveis.map(v => v + '%').join(' '));
      await c2.close();
    }

    // Tab até uma obra fora da vista lateral a traz para dentro do trilho
    await page.evaluate(() => scrollTo(0, Math.round(document.getElementById('obras').getBoundingClientRect().top + scrollY)));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.work[data-i="4"]').focus());
    await page.waitForTimeout(600);
    const vis = await page.evaluate(() => {
      const t = document.getElementById('obrasTrilho').getBoundingClientRect();
      const b = document.activeElement.getBoundingClientRect();
      return { dentro: b.left >= t.left - 8 && b.right <= t.right + 8, left: Math.round(b.left), trilho: [Math.round(t.left), Math.round(t.right)] };
    });
    check(vis.dentro, 'obra focada fora da vista entra no trilho', vis);
    await ctx.close();
  }

  /* ================= 7. Tipografia: medida, órfãs e quebras ================= */
  console.log('\n=== TIPOGRAFIA E QUEBRAS DE LINHA ===');
  for (const [w, rot] of [[1440, 'desktop'], [768, 'tablet'], [375, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in'));
      const h = document.querySelector('.hero'); if (h) h.classList.add('is-ready');
    });
    await page.waitForTimeout(400);

    const tipo = await page.evaluate(() => {
      // mede quantos caracteres cabem numa linha e quantas palavras sobram na última
      function medir(el) {
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const lh = parseFloat(cs.lineHeight) || fs * 1.4;
        const linhas = Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
        const txt = el.textContent.trim().replace(/\s+/g, ' ');
        const chars = txt.length;
        const palavras = txt.split(' ');
        return { linhas, cpl: Math.round(chars / linhas), palavras: palavras.length, txt };
      }
      // órfã = última linha ocupando menos de 25% da largura das demais
      function orfa(el) {
        if (getComputedStyle(el).display.indexOf('flex') === 0) return false;
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter(x => x.width > 1);
        if (rects.length < 2) return false;
        const tops = [...new Set(rects.map(x => Math.round(x.top)))].sort((a, b) => a - b);
        if (tops.length < 2) return false;
        const larguraDe = t => {
          const n = rects.filter(x => Math.abs(x.top - t) < 3);
          return Math.max(...n.map(x => x.right)) - Math.min(...n.map(x => x.left));
        };
        const larguras = tops.map(larguraDe);
        const maior = Math.max(...larguras);
        return maior > 0 && (larguras[larguras.length - 1] / maior) < 0.25;
      }

      const longos = [];
      const curtos = [];
      const viuvas = [];
      document.querySelectorAll('p, h1, h2, h3, li').forEach(el => {
        if (!el.textContent.trim() || el.querySelector('p,li')) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none') return;
        const m = medir(el);
        if (m.linhas < 2 || m.palavras < 4) return;
        if (m.cpl > 82) longos.push({ cpl: m.cpl, t: m.txt.slice(0, 44) });
        const display = /^H[1-3]$/.test(el.tagName) || parseFloat(cs.fontSize) >= 26;
        if (!display && m.cpl < 26 && m.linhas > 2) curtos.push({ cpl: m.cpl, t: m.txt.slice(0, 44) });
        if (orfa(el)) viuvas.push(m.txt.slice(0, 48));
      });
      return { longos, curtos, viuvas };
    });

    check(tipo.longos.length === 0, `${rot}: nenhuma linha acima de 82 caracteres`, tipo.longos.slice(0, 4));
    check(tipo.curtos.length === 0, `${rot}: nenhuma coluna estreita demais (<26 cpl)`, tipo.curtos.slice(0, 4));
    check(tipo.viuvas.length === 0, `${rot}: nenhuma palavra órfã na última linha`, tipo.viuvas.slice(0, 5));
    await ctx.close();
  }

  /* ================= 8. Ritmo vertical / espaçamentos ================= */
  console.log('\n=== ESPAÇAMENTOS ===');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in')));
    await page.waitForTimeout(300);
    const esp = await page.evaluate(() => {
      const secoes = [...document.querySelectorAll('main > section')].filter(s => !s.classList.contains('hero')).map(s => {
        const cs = getComputedStyle(s);
        return {
          id: s.id || s.className.split(' ')[1] || s.className,
          top: Math.round(parseFloat(cs.paddingTop)),
          bottom: Math.round(parseFloat(cs.paddingBottom)),
          mt: Math.round(parseFloat(cs.marginTop)),
          mb: Math.round(parseFloat(cs.marginBottom)),
        };
      });
      // sobreposições: elementos que invadem o vizinho
      const colisoes = [];
      const blocos = [...document.querySelectorAll('.section__head, .services, .process, .about, .carousel, .cta__inner')];
      for (let i = 0; i < blocos.length - 1; i++) {
        const a = blocos[i].getBoundingClientRect();
        const b = blocos[i + 1].getBoundingClientRect();
        if (b.top < a.bottom - 2 && blocos[i].parentElement === blocos[i + 1].parentElement) {
          colisoes.push([blocos[i].className, blocos[i + 1].className]);
        }
      }
      return { secoes, colisoes };
    });
    console.log('  padding vertical por seção:');
    esp.secoes.forEach(s => console.log(`    ${String(s.id).padEnd(22)} top ${String(s.top).padStart(4)}  bottom ${String(s.bottom).padStart(4)}`));
    const consistente = esp.secoes.filter(s => s.top > 0).every(s => s.top === s.bottom);
    check(consistente, 'padding vertical simétrico nas seções de conteúdo');
    check(esp.colisoes.length === 0, 'nenhum bloco colide com o vizinho', esp.colisoes);
    await ctx.close();
  }

  console.log('\n===================================');
  console.log(fails === 0 ? 'WCAG/LAYOUT: TUDO VERDE' : `WCAG/LAYOUT: ${fails} FALHA(S)`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
