/* Contraste de texto sobre fotografia.
   O axe-core não avalia isso: ele não sabe a cor de um pixel de imagem.
   Aqui o texto é escondido, o fundo atrás dele é fotografado e o pior
   pixel (percentil 97 de luminância) entra no cálculo. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TMP = path.join(process.env.TEMP || '/tmp', '_bg_contraste.png');

function lum([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const cr = (a, b) => { const l = [lum(a), lum(b)].sort((x, y) => y - x); return (l[0] + 0.05) / (l[1] + 0.05); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const PY = [
  'from PIL import Image',
  `im=Image.open(r"${TMP}").convert("RGB")`,
  'px=list(im.getdata())',
  'L=lambda p:0.2126*p[0]+0.7152*p[1]+0.0722*p[2]',
  'px.sort(key=L)',
  'n=len(px)',
  'a=px[int(n*0.97)]; b=px[n//2]',
  'print(a[0],a[1],a[2],b[0],b[1],b[2])',
].join('\n');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    document.querySelectorAll('[data-anim]').forEach(e => e.classList.add('is-in', 'is-done'));
    const h = document.querySelector('.hero'); if (h) h.classList.add('is-ready');
    const cb = document.querySelector('.cookiebar'); if (cb) cb.remove();
  });
  await page.waitForLoadState('networkidle');

  const ALVOS = [
    // menu transparente sobre a foto da hero (no topo, antes de o header ganhar fundo)
    ['.nav a[href="#servicos"]', '#d5d5d6', 'menu: Serviços'],
    ['.nav a[href="#processo"]', '#d5d5d6', 'menu: Como trabalhamos'],
    ['.nav a[href="#obras"]', '#d5d5d6', 'menu: Obras'],
    ['.nav a[href="#sobre"]', '#d5d5d6', 'menu: A Ápice'],
    ['.hero h1', '#fafafa', 'H1 do hero'],
    ['.hero__sub', '#d5d5d6', 'subtítulo do hero'],
    ['.hero .eyebrow', '#ce9e70', 'eyebrow do hero'],
    ['.hero__marks span', '#d5d5d6', 'marcas no hero'],
    ['.band__quote p', '#fafafa', 'citação da faixa 1'],
    ['.band__quote span', '#ce9e70', 'rótulo da faixa 1'],
    ['.band--equipe .band__quote p', '#fafafa', 'citação da faixa 2'],
    ['.band--equipe .band__quote span', '#ce9e70', 'rótulo da faixa 2'],
  ];
  // legendas de TODAS as obras do carrossel, não só da primeira: cada capa é um fundo
  const nObras = await page.locator('.work').count();
  for (let i = 0; i < nObras; i++) {
    ALVOS.push([`.work[data-i="${i}"] .work__tag`, '#ce9e70', `tag da obra ${i + 1}`, true]);
    ALVOS.push([`.work[data-i="${i}"] .work__cap strong`, '#fafafa', `título da obra ${i + 1}`, true]);
    ALVOS.push([`.work[data-i="${i}"] .work__n`, '#d5d5d6', `"N fotos" da obra ${i + 1}`, true]);
  }

  let fails = 0;
  for (const [sel, cor, nome, noTrilho] of ALVOS) {
    const el = page.locator(sel).first();
    // a obra pode estar fora da vista lateral: alinha o trilho a ela antes de medir
    // (no modo travado o trilho segue a rolagem da página: o foco no card é o
    // que leva página e trilho juntos até ele, como acontece com quem usa o Tab)
    if (noTrilho) {
      await el.evaluate(e => { const w = e.closest('.work'); w.focus({ preventScroll: true }); w.blur(); });
      await page.waitForTimeout(350);
    }
    if (!(await el.count())) { console.log('MISS ' + nome); fails++; continue; }

    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // desliga o parallax para o pixel medido ser o que o leitor vê parado
    await page.evaluate(() =>
      document.querySelectorAll('.band__frame img,.hero__media').forEach(e => e.style.setProperty('--py', '0px')));
    await page.waitForTimeout(200);

    // a caixa do bloco pode ser muito mais larga que o texto (um <p> flex ocupa
    // a linha inteira); medir a caixa inteira leria pixels onde não há letra
    // nenhuma. Aqui a região vem dos rects do próprio texto.
    const info = await el.evaluate(e => {
      const cs = getComputedStyle(e);
      const r = document.createRange();
      r.selectNodeContents(e);
      const rects = [...r.getClientRects()].filter(x => x.width > 0.5 && x.height > 0.5);
      if (!rects.length) return null;
      const x0 = Math.min(...rects.map(x => x.left));
      const y0 = Math.min(...rects.map(x => x.top));
      const x1 = Math.max(...rects.map(x => x.right));
      const y1 = Math.max(...rects.map(x => x.bottom));
      return { fs: parseFloat(cs.fontSize), fw: cs.fontWeight,
               x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    });
    if (!info) { console.log('MISS(texto) ' + nome); fails++; continue; }
    const box = info;
    if (box.width < 2 || box.height < 2) { console.log('MISS(box) ' + nome); fails++; continue; }

    await page.evaluate(s => document.querySelectorAll(s).forEach(e => (e.style.visibility = 'hidden')), sel);
    await page.waitForTimeout(160);
    const clip = {
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.max(2, Math.round(Math.min(box.width, 1440 - box.x))),
      height: Math.max(2, Math.round(Math.min(box.height, 900 - box.y))),
    };
    fs.writeFileSync(TMP, await page.screenshot({ clip }));
    await page.evaluate(s => document.querySelectorAll(s).forEach(e => (e.style.visibility = '')), sel);

    const nums = execFileSync('python', ['-c', PY], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().split(/\s+/).map(Number);
    const pior = nums.slice(0, 3), medio = nums.slice(3, 6);
    const fg = hex(cor);
    const rPior = cr(fg, pior), rMedio = cr(fg, medio);
    const grande = info.fs >= 24 || (info.fs >= 18.66 && +info.fw >= 700);
    const min = grande ? 3 : 4.5;
    const ok = rPior >= min;
    if (!ok) fails++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${nome.padEnd(20)} pior ${rPior.toFixed(2)}:1  médio ${rMedio.toFixed(2)}:1` +
      `  (mín ${min}, ${Math.round(info.fs)}px)  pior fundo rgb(${pior.join(',')})`
    );
  }

  console.log('\n' + (fails === 0 ? 'TEXTO SOBRE FOTO: TUDO VERDE' : `TEXTO SOBRE FOTO: ${fails} FALHA(S)`));
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})();
