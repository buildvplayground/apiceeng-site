/* Ápice Arquitetura e Engenharia: interações */
(function () {
  'use strict';

  /* ---------- Ano no rodapé ---------- */
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  /* ---------- Header fixo ganha fundo ao rolar ---------- */
  var header = document.getElementById('header');
  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Menu off-canvas ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  var scrim = document.getElementById('navScrim');

  function setNav(open) {
    nav.classList.toggle('is-open', open);
    // o header sobe acima do véu enquanto o menu está aberto (o nav vive dentro dele)
    header.classList.toggle('is-menu', open);
    scrim.classList.toggle('is-on', open);
    scrim.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('is-locked', open);
  }

  burger.addEventListener('click', function () {
    setNav(burger.getAttribute('aria-expanded') !== 'true');
  });
  scrim.addEventListener('click', function () { setNav(false); });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setNav(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setNav(false);
      burger.focus();
    }
  });

  /* Revelação por scroll e parallax: ver motion.js */

  /* ---------- Carrossel de obras ----------
     Em tela grande com mouse, o avanço fica preso à rolagem: a seção trava na
     tela (palco sticky) e a roda passa as obras na horizontal; terminado o
     trilho, a página segue. O modo travado só liga se o palco couber inteiro
     na janela (janela baixa, zoom ou texto ampliado caem no modo comum). Toque,
     tela pequena e prefers-reduced-motion ficam com o carrossel de arrastar.
     Sem autoplay em nenhum modo. */
  var trilho = document.getElementById('obrasTrilho');
  var secaoObras = document.getElementById('obras');
  if (trilho && secaoObras) {
    var palco = secaoObras.querySelector('.obras__palco');
    var cabecaObras = secaoObras.querySelector('.section__head');
    var cNav = document.getElementById('obrasNav');
    var cPrev = document.getElementById('obrasPrev');
    var cNext = document.getElementById('obrasNext');
    var cStatus = document.getElementById('obrasStatus');
    var cAnuncio = document.getElementById('obrasAnuncio');
    var slides = Array.prototype.slice.call(trilho.querySelectorAll('.carousel__slide'));
    var mqReduz = window.matchMedia('(prefers-reduced-motion: reduce)');
    var mqFixo = window.matchMedia('(hover:hover) and (pointer:fine) and (min-width:901px)');
    var fixo = false;
    var percurso = 0;
    var ultimoAnuncio = '';

    cNav.hidden = false;   // sem JS os controles nem aparecem: o trilho rola nativo

    var gapDe = function () { return parseFloat(getComputedStyle(trilho).columnGap) || 0; };
    var passo = function () { return slides[0].getBoundingClientRect().width + gapDe(); };
    // quantas obras cabem inteiras na vista (a sobra da próxima não conta)
    var porVista = function () {
      return Math.max(1, Math.floor((trilho.clientWidth + gapDe() + 2) / passo()));
    };
    var maxX = function () { return Math.max(0, trilho.scrollWidth - trilho.clientWidth); };
    var limitar = function (x) { return Math.max(0, Math.min(maxX(), x)); };
    // índice da primeira obra inteira na vista
    var primeira = function () { return Math.ceil(trilho.scrollLeft / passo() - 0.02); };

    var textoEstado = function () {
      var total = slides.length;
      var n = porVista();
      var ini = Math.min(total, primeira() + 1);
      if (trilho.scrollLeft >= maxX() - 2) ini = Math.max(1, total - n + 1);
      var ult = Math.min(total, ini + n - 1);
      return ini === ult ? 'Obra ' + ini + ' de ' + total : 'Obras ' + ini + ' a ' + ult + ' de ' + total;
    };
    // estado visível e setas: a cada quadro, para nunca descrever outra obra
    var pintarEstado = function () {
      var x = trilho.scrollLeft;
      cPrev.setAttribute('aria-disabled', String(x <= 2));
      cNext.setAttribute('aria-disabled', String(x >= maxX() - 2));
      var txt = textoEstado();
      if (cStatus.textContent !== txt) cStatus.textContent = txt;
    };
    // anúncio ao leitor de tela: só quando a rolagem assenta, e só se mudou
    var espera = null;
    var anunciar = function () {
      clearTimeout(espera);
      espera = setTimeout(function () {
        var txt = textoEstado();
        if (txt !== ultimoAnuncio) { ultimoAnuncio = txt; cAnuncio.textContent = txt; }
      }, 400);
    };

    // posição do trilho que corresponde à rolagem atual da página
    var xDaPagina = function () {
      return Math.min(percurso, Math.max(0, -secaoObras.getBoundingClientRect().top));
    };
    var sincronizar = function () {
      if (fixo) trilho.scrollLeft = xDaPagina();
    };

    // o palco cabe na janela sem cortar a navegação e sem esmagar os cards?
    var palcoCabe = function () {
      var pr = palco.getBoundingClientRect();
      var topo = cabecaObras.getBoundingClientRect().top;
      var base = trilho.getBoundingClientRect().bottom;
      var util = pr.height - (parseFloat(getComputedStyle(palco).paddingTop) || 0);
      var card = slides[0].getBoundingClientRect();
      var legenda = slides[0].querySelector('.work__cap').getBoundingClientRect();
      return (base - topo) <= util - 8 && card.width >= 260 && legenda.height <= card.height * 0.6;
    };

    var ligarFixo = function (on) {
      fixo = on;
      secaoObras.classList.toggle('obras--fixo', on);
      if (on) {
        // a altura extra da seção é o percurso horizontal: 1px de roda = 1px de trilho
        percurso = maxX();
        secaoObras.style.setProperty('--percurso', percurso + 'px');
      } else {
        percurso = 0;
        secaoObras.style.removeProperty('--percurso');
      }
    };

    var medir = function () {
      var quer = mqFixo.matches && !mqReduz.matches;
      if (quer !== fixo) ligarFixo(quer);
      else if (fixo) ligarFixo(true);           // remede o percurso (resize)
      if (fixo && !palcoCabe()) ligarFixo(false);
      sincronizar();
      pintarEstado();
    };

    // leva o trilho até x: no modo travado isso é rolar a página até o ponto equivalente
    var irPara = function (x, suave) {
      x = limitar(x);
      var comportamento = suave && !mqReduz.matches ? 'smooth' : 'auto';
      if (fixo) {
        var topo = secaoObras.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: topo + x, behavior: comportamento });
      } else {
        trilho.scrollTo({ left: x, behavior: comportamento });
      }
    };

    var mover = function (dir, botao) {
      if (botao.getAttribute('aria-disabled') === 'true') return;
      irPara((primeira() + dir * porVista()) * passo(), true);
    };
    cPrev.addEventListener('click', function () { mover(-1, cPrev); });
    cNext.addEventListener('click', function () { mover(1, cNext); });

    // Tab até uma obra que não está inteira na vista: traz a obra (e, no modo
    // travado, rola a página até o ponto equivalente). Só com foco de teclado:
    // o clique do mouse foca o botão no mousedown, e rolar ali faria o clique
    // cair em outro lugar.
    trilho.addEventListener('focusin', function (e) {
      var s = e.target.closest('.carousel__slide');
      if (!s) return;
      try { if (!e.target.matches(':focus-visible')) return; } catch (err) { /* navegador sem :focus-visible */ }
      var tr = trilho.getBoundingClientRect();
      var sr = s.getBoundingClientRect();
      var esq = sr.left - tr.left + trilho.scrollLeft;   // posição da obra no conteúdo do trilho
      var dir = esq + sr.width;
      var w = trilho.clientWidth;
      // o que o leitor está vendo: no modo travado é o ponto que a página
      // determina (o navegador pode ter rolado o trilho sozinho ao focar, e a
      // próxima sincronização desfaria isso)
      var x0 = fixo ? xDaPagina() : trilho.scrollLeft;
      if (esq >= x0 - 1 && dir <= x0 + w + 1) {         // já está inteira
        if (fixo) trilho.scrollLeft = x0;
        return;
      }
      var x = esq < x0 || !fixo ? esq - 6 : dir - w + 6;
      irPara(x, false);
      if (fixo) trilho.scrollLeft = limitar(x);
    });

    // gesto lateral do trackpad sobre o trilho também anda a página no modo
    // travado, mas só enquanto o trilho ainda pode andar naquele sentido
    trilho.addEventListener('wheel', function (e) {
      if (!fixo || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      var x = trilho.scrollLeft;
      if ((e.deltaX < 0 && x <= 0) || (e.deltaX > 0 && x >= percurso)) return;
      e.preventDefault();
      window.scrollBy(0, e.deltaX);
    }, { passive: false });

    var quadroPendente = false;
    var aoMover = function () {
      if (!quadroPendente) {
        quadroPendente = true;
        requestAnimationFrame(function () { quadroPendente = false; sincronizar(); pintarEstado(); });
      }
      anunciar();
    };
    window.addEventListener('scroll', function () { if (fixo) aoMover(); }, { passive: true });
    trilho.addEventListener('scroll', aoMover, { passive: true });
    window.addEventListener('resize', medir, { passive: true });
    window.addEventListener('load', medir);
    if (mqFixo.addEventListener) {
      mqFixo.addEventListener('change', medir);
      mqReduz.addEventListener('change', medir);
    }
    medir();
    ultimoAnuncio = textoEstado();   // o estado inicial não precisa ser anunciado
  }

  /* ---------- Lightbox por obra (só existe na home) ----------
     Cada card é uma obra: o clique abre as fotos dela em sequência,
     com contador "N / total". Sem setas quando a obra tem uma foto só. */
  var works = Array.prototype.slice.call(document.querySelectorAll('.work'));
  var lb = document.getElementById('lb');
  if (!lb || !works.length) return;

  var lbImg = document.getElementById('lbImg');
  var lbTitle = document.getElementById('lbTitle');
  var lbTag = document.getElementById('lbTag');
  var lbCount = document.getElementById('lbCount');
  var lbLive = document.getElementById('lbLive');
  var lbPrev = document.getElementById('lbPrev');
  var lbNext = document.getElementById('lbNext');
  var obra = 0;
  var foto = 0;
  var opener = null;

  var lista = function (w, attr) {
    return (w.getAttribute(attr) || '').split('|').filter(function (x) { return x.trim() !== ''; });
  };
  var galerias = works.map(function (w) {
    var fotos = lista(w, 'data-gallery');
    var legendas = lista(w, 'data-legendas');
    var dims = lista(w, 'data-dims');
    return {
      titulo: w.querySelector('.work__cap strong').textContent,
      fotos: fotos.map(function (src, k) {
        var d = (dims[k] || '').split('x');
        return { src: src, legenda: legendas[k] || '', w: +d[0] || 0, h: +d[1] || 0 };
      })
    };
  });

  function mostrar(k, anunciarTroca) {
    var g = galerias[obra];
    var total = g.fotos.length;
    foto = (k + total) % total;
    var f = g.fotos[foto];
    if (f.w && f.h) { lbImg.setAttribute('width', f.w); lbImg.setAttribute('height', f.h); }
    else { lbImg.removeAttribute('width'); lbImg.removeAttribute('height'); }
    lbImg.setAttribute('src', f.src);
    lbImg.setAttribute('alt', f.legenda);
    lbTitle.textContent = g.titulo;
    lbTag.textContent = f.legenda;
    lbCount.textContent = (foto + 1) + ' / ' + total;
    // o foco fica no Fechar: sem esta região, a troca de foto passaria em silêncio
    if (anunciarTroca) lbLive.textContent = 'Foto ' + (foto + 1) + ' de ' + total + ': ' + f.legenda;
    // adianta as vizinhas para a navegação não esperar a rede
    if (total > 1) {
      new Image().src = g.fotos[(foto + 1) % total].src;
      new Image().src = g.fotos[(foto - 1 + total) % total].src;
    }
  }

  function open(i) {
    opener = works[i];
    obra = i;
    var umaFoto = galerias[i].fotos.length < 2;
    lbPrev.hidden = umaFoto;
    lbNext.hidden = umaFoto;
    lb.setAttribute('aria-label', 'Fotos da obra ' + galerias[i].titulo);
    lbLive.textContent = '';
    mostrar(0, false);
    if (typeof lb.showModal === 'function') lb.showModal();
    else lb.setAttribute('open', '');
    document.body.classList.add('is-locked');
  }

  works.forEach(function (w, i) {
    w.setAttribute('aria-haspopup', 'dialog');
    w.addEventListener('click', function () { open(i); });
  });

  document.getElementById('lbClose').addEventListener('click', function () { lb.close(); });
  lbPrev.addEventListener('click', function () { mostrar(foto - 1, true); });
  lbNext.addEventListener('click', function () { mostrar(foto + 1, true); });

  lb.addEventListener('click', function (e) {
    if (e.target === lb) lb.close();
  });

  lb.addEventListener('keydown', function (e) {
    if (galerias[obra].fotos.length < 2) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(foto - 1, true); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(foto + 1, true); }
  });

  lb.addEventListener('close', function () {
    document.body.classList.remove('is-locked');
    // sem rolar: o card já estava à vista quando foi aberto
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  });
})();
