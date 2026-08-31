/* ============================================================
   Ápice, motor de movimento
   Implementa a especificação BuildV (sistema-de-movimento.md) para
   este site: entradas por reveal, título palavra por palavra, parallax
   contido e scroll suave por lerp na roda do mouse.

   Carregado no <head>, antes do CSS pintar, para marcar `html.js`: assim
   os elementos já nascem no estado inicial, sem flash de conteúdo.

   Duas regras governam tudo:

   1. A animação apresenta conteúdo a quem está chegando nele. Quem já
      passou, quem volta, quem salta de âncora ou está no fim da página
      recebe o conteúdo pronto. Animação atrasada é ruído.

   2. A animação começa E termina dentro da tela. Antes de revelar, o
      motor calcula quanto tempo aquele elemento ainda tem de viewport
      pela frente, na velocidade atual de rolagem, e encurta a duração
      para caber. Se não couber nem no mínimo, entra pronto.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mq.matches;

  if (!reduced) root.classList.add('js');

  mq.addEventListener('change', function (e) {
    reduced = e.matches;
    root.classList.toggle('js', !reduced);
    if (reduced && window.__apiceStop) window.__apiceStop();
  });

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    if (reduced) return;

    var VEL_MAX = 2.2;        // px/ms; acima disso o leitor está saltando
    var ZONA_FINAL = 0.88;    // últimos 12% da página: nada mais espera
    var DUR_PADRAO = 850;     // ms, espelha --dur-in
    var DUR_MIN = 260;        // abaixo disso não vale a pena animar
    var STAGGER_PALAVRA = 42; // ms entre palavras de um título

    /* ========================================================
       Estado do scroll
       ======================================================== */
    var ultimoY = window.scrollY;
    var ultimoT = performance.now();
    var velocidade = 0;
    var descendo = true;
    var salto = 0;

    function amostrar() {
      var y = window.scrollY, t = performance.now(), dt = t - ultimoT;
      if (dt > 0) {
        var dy = y - ultimoY;
        velocidade = velocidade * 0.4 + (Math.abs(dy) / dt) * 0.6;
        if (Math.abs(dy) > 2) descendo = dy > 0;
      }
      ultimoY = y; ultimoT = t;
    }

    window.addEventListener('hashchange', function () { salto = performance.now() + 1200; });

    function naZonaFinal() {
      var max = root.scrollHeight - window.innerHeight;
      return max > 0 && (window.scrollY / max) >= ZONA_FINAL;
    }

    /* ========================================================
       Título palavra por palavra
       Só em títulos de texto puro: com <strong>, <em>, <br> ou
       ícones dentro, dividir quebraria a marcação.
       ======================================================== */
    function dividirPalavras(el) {
      if (el.dataset.split === '1') return 0;
      var texto = el.textContent;
      if (!texto || !texto.trim()) return 0;

      // separa só no espaço comum: o nbsp mantém palavras ligadas de propósito
      var palavras = texto.trim().split(/ +/);
      if (palavras.length < 2 || palavras.length > 14) return 0;

      var frag = document.createDocumentFragment();
      palavras.forEach(function (palavra, i) {
        var span = document.createElement('span');
        span.className = 'w';
        var it = document.createElement('i');
        it.textContent = palavra;
        it.style.setProperty('--wd', (i * STAGGER_PALAVRA) + 'ms');
        span.appendChild(it);
        frag.appendChild(span);
        if (i < palavras.length - 1) frag.appendChild(document.createTextNode(' '));
      });

      el.textContent = '';
      el.appendChild(frag);
      el.dataset.split = '1';
      return palavras.length;
    }

    // h1 e h2 animados viram split; o bloco em volta passa a só fazer fade
    document.querySelectorAll('h1[data-anim], h2[data-anim]').forEach(function (h) {
      if (h.querySelector('*')) return;            // tem marcação dentro: não mexe
      var n = dividirPalavras(h);
      if (!n) return;
      h.setAttribute('data-anim', 'soft');
      // o bloco só termina quando a última palavra terminar
      h.dataset.extra = String((n - 1) * STAGGER_PALAVRA + 900);
    });

    /* ========================================================
       Revelar
       ======================================================== */
    function duracaoDe(el) {
      return el.dataset.extra ? Math.max(DUR_PADRAO, +el.dataset.extra) : DUR_PADRAO;
    }

    /* Quanto tempo, em ms, este elemento ainda tem de tela pela frente?
       Enquanto ele sobe, o que importa é a distância entre a base dele e
       o topo da viewport: é o trecho em que ainda dá para vê-lo animar. */
    function tempoNaTela(rect) {
      if (velocidade < 0.05) return Infinity;   // parado: tempo de sobra
      return Math.max(0, rect.bottom) / velocidade;
    }

    function revelar(el, delay, instantaneo, rect) {
      if (el.classList.contains('is-in')) return;

      var dur = duracaoDe(el);

      if (!instantaneo && rect) {
        var disponivel = tempoNaTela(rect) - delay;
        if (disponivel < DUR_MIN) {
          instantaneo = true;                    // não cabe: entra pronto
        } else if (disponivel < dur) {
          dur = Math.max(DUR_MIN, disponivel);   // cabe encurtando
          el.style.setProperty('--dur', Math.round(dur) + 'ms');
        }
      }

      if (instantaneo) {
        el.classList.add('is-instant', 'is-in', 'is-done');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { el.classList.remove('is-instant'); });
        });
        return;
      }

      el.style.setProperty('--d', delay + 'ms');
      el.classList.add('is-in');
      setTimeout(function () { el.classList.add('is-done'); }, delay + dur + 120);
    }

    function deveSerInstantaneo(rect) {
      if (velocidade > VEL_MAX) return true;
      if (!descendo) return true;
      if (performance.now() < salto) return true;
      if (naZonaFinal()) return true;
      // o scroll passou por cima: o elemento já subiu além da metade da tela
      if (rect && rect.bottom < window.innerHeight * 0.5) return true;
      return false;
    }

    function stepDe(el) {
      var g = el.parentElement && el.parentElement.closest('[data-stagger]');
      return g ? (parseInt(g.getAttribute('data-stagger'), 10) || 80) : 0;
    }

    /* ========================================================
       Hero: entra no load, não por observer
       ======================================================== */
    var hero = document.querySelector('.hero');
    var abriuHero = false;
    if (hero) {
      var heroDireto = window.scrollY > window.innerHeight * 0.4;
      hero.querySelectorAll('.hero__inner > *').forEach(function (el, i) {
        el.style.setProperty('--d', heroDireto ? '0ms' : (120 + i * 110) + 'ms');
      });
      if (heroDireto) hero.classList.add('is-instant');

      var abrirHero = function () {
        if (abriuHero) return;
        abriuHero = true;
        hero.classList.add('is-ready');
        if (heroDireto) setTimeout(function () { hero.classList.remove('is-instant'); }, 60);
      };
      // rAF não roda em aba de fundo: o timer é a rede de segurança
      requestAnimationFrame(function () { requestAnimationFrame(abrirHero); });
      setTimeout(abrirHero, 160);
    }

    /* ========================================================
       Reveal por scroll, em três camadas
       ======================================================== */
    var animados = document.querySelectorAll('[data-anim]');
    var pendentes = [];

    if (!('IntersectionObserver' in window)) {
      animados.forEach(function (el) { el.classList.add('is-in', 'is-done'); });
    } else {
      /* rootMargin quase nulo: o elemento dispara assim que encosta na base
         da tela, e não depois de já ter subido. É isso que lhe dá a viewport
         inteira para começar e terminar a animação à vista do leitor. */
      var io = new IntersectionObserver(function (entradas) {
        var entrando = entradas.filter(function (e) { return e.isIntersecting; });
        if (!entrando.length) return;

        entrando.sort(function (a, b) {
          var ra = a.boundingClientRect, rb = b.boundingClientRect;
          return (ra.top - rb.top) || (ra.left - rb.left);
        });

        var geral = deveSerInstantaneo();
        entrando.forEach(function (e, i) {
          revelar(e.target, i * stepDe(e.target),
                  geral || deveSerInstantaneo(e.boundingClientRect),
                  e.boundingClientRect);
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -4% 0px', threshold: 0.05 });

      var naTela = [];
      animados.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92 && r.bottom > 0 && !el.closest('.hero')) naTela.push(el);
        else { pendentes.push(el); io.observe(el); }
      });

      // primeira tela por timer, porque observer e rAF não rodam em aba oculta
      var abriuPrimeira = false;
      var abrirPrimeira = function () {
        if (abriuPrimeira) return;
        abriuPrimeira = true;
        naTela.forEach(function (el, i) { revelar(el, i * stepDe(el), false, null); });
      };
      requestAnimationFrame(abrirPrimeira);
      setTimeout(abrirPrimeira, 140);

      /* Rede de segurança para saltos: barra de rolagem arrastada, âncora,
         hash na URL. Nada disso gera callback de observer para o que foi
         pulado, e sem este flush o bloco ficaria invisível para sempre. */
      var flush = function () {
        var vh = window.innerHeight, fim = naZonaFinal();
        pendentes = pendentes.filter(function (el) {
          if (el.classList.contains('is-in')) return false;
          var r = el.getBoundingClientRect();
          if (fim || r.bottom < vh * 0.3) { io.unobserve(el); revelar(el, 0, true); return false; }
          return true;
        });
      };
      window.addEventListener('scroll', flush, { passive: true });
    }

    /* ========================================================
       Parallax, header e barra de leitura, num só rAF
       Parallax <= 0.12, como manda a especificação.
       ======================================================== */
    var barra = document.querySelector('.progress');
    var header = document.getElementById('header');
    var camadas = [];

    if (hero) camadas.push({ el: hero.querySelector('.hero__media'), host: hero, d: 0.12 });
    document.querySelectorAll('.band__frame').forEach(function (m) {
      camadas.push({ el: m.querySelector('img'), host: m, d: 0.10 });
    });

    var agendado = false, rodando = true;

    function quadro() {
      agendado = false;
      if (!rodando) return;

      var vh = window.innerHeight, y = window.scrollY;

      if (barra) {
        var max = root.scrollHeight - vh;
        barra.style.setProperty('--p', max > 4 ? Math.min(1, y / max).toFixed(4) : '0');
      }
      if (header) header.classList.toggle('is-compact', y > vh * 0.6);

      camadas.forEach(function (l) {
        if (!l.el) return;
        var r = l.host.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) return;
        var p = (vh / 2 - (r.top + r.height / 2)) / ((vh + r.height) / 2);
        l.el.style.setProperty('--py', (p * r.height * l.d).toFixed(1) + 'px');
      });
    }

    function aoRolar() {
      amostrar();
      if (!agendado) { agendado = true; requestAnimationFrame(quadro); }
    }

    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar, { passive: true });
    quadro();

    // a velocidade decai quando o scroll para, senão o próximo elemento
    // herdaria a leitura de um salto que já terminou
    setInterval(function () { velocidade *= 0.6; }, 200);

    document.addEventListener('visibilitychange', function () {
      rodando = !document.hidden;
      if (rodando) aoRolar();
    });

    /* ========================================================
       Scroll suave por lerp na roda do mouse
       Usa o scroll real da janela, então sticky, :target e a barra
       do navegador continuam funcionando. Só em ponteiro fino: no
       touch fica o momentum nativo, que é melhor.
       ======================================================== */
    var fino = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var alvo = window.scrollY, atual = window.scrollY, loop = null;

    function maxScroll() { return root.scrollHeight - window.innerHeight; }

    function rolavelSob(node) {
      // não sequestra a roda sobre área que rola por conta própria
      for (var i = 0; node && node !== document.body && i < 8; i++, node = node.parentElement) {
        var cs = getComputedStyle(node);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight + 2) return true;
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
            node.scrollWidth > node.clientWidth + 2) return true;
      }
      return false;
    }

    function overlayAberto() {
      return document.body.classList.contains('is-locked') ||
             !!document.querySelector('dialog[open]');
    }

    var ultimoEscrito = -1;

    function escrever(y) {
      ultimoEscrito = Math.round(y);
      window.scrollTo(0, ultimoEscrito);
    }

    function passo() {
      /* Se a posição real divergiu do que este loop escreveu, alguém mexeu no
         scroll por fora (scrollIntoView de outro script, foco num campo,
         restauração de sessão). Quem chegou depois manda: o lerp sai de cena
         em vez de arrastar a página de volta. */
      if (ultimoEscrito >= 0 && Math.abs(window.scrollY - ultimoEscrito) > 2) {
        loop = null;
        atual = alvo = window.scrollY;
        return;
      }

      atual += (alvo - atual) * 0.105;
      if (Math.abs(alvo - atual) < 0.4) {
        atual = alvo;
        escrever(atual);
        loop = null;
        return;
      }
      escrever(atual);
      loop = requestAnimationFrame(passo);
    }

    function irPara(y) {
      alvo = Math.max(0, Math.min(maxScroll(), y));
      if (!loop) { atual = window.scrollY; ultimoEscrito = -1; loop = requestAnimationFrame(passo); }
    }

    if (fino) {
      window.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.defaultPrevented) return;      // zoom do navegador
        if (overlayAberto() || rolavelSob(e.target)) return;
        e.preventDefault();
        if (!loop) { atual = window.scrollY; alvo = atual; }
        irPara(alvo + e.deltaY);
      }, { passive: false });

      document.addEventListener('keydown', function (e) {
        var t = e.target;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (t && t.isContentEditable) return;
        if (overlayAberto()) return;
        var vh = window.innerHeight, base = loop ? alvo : window.scrollY, d = null;
        if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) d = vh * 0.9;
        else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) d = -vh * 0.9;
        else if (e.key === 'ArrowDown') d = 90;
        else if (e.key === 'ArrowUp') d = -90;
        else if (e.key === 'Home') { e.preventDefault(); irPara(0); return; }
        else if (e.key === 'End') { e.preventDefault(); irPara(maxScroll()); return; }
        if (d !== null) { e.preventDefault(); irPara(base + d); }
      });

      // rolagem por toque cancela o lerp em curso
      window.addEventListener('touchstart', function () {
        if (loop) { cancelAnimationFrame(loop); loop = null; }
      }, { passive: true });
    }

    /* Âncoras pelo motor: desconta o header e impede que o scroll-behavior
       do navegador anime por cima do lerp (os dois brigam pelo mesmo scroll). */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var destino = document.getElementById(href.slice(1));
      if (!destino) return;

      e.preventDefault();
      salto = performance.now() + 1200;

      var doMenu = !!a.closest('.nav') && window.innerWidth <= 900;
      var alturaHeader = header ? header.getBoundingClientRect().height : 0;

      setTimeout(function () {
        var y = destino.getBoundingClientRect().top + window.scrollY - alturaHeader - 8;
        y = Math.max(0, Math.min(maxScroll(), y));
        if (fino) irPara(y); else window.scrollTo(0, y);
        if (history.replaceState) history.replaceState(null, '', href);
        // devolve o foco ao destino, senão o teclado continua no topo
        if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
        destino.focus({ preventScroll: true });
      }, doMenu ? 420 : 80);
    });

    window.__apiceStop = function () {
      rodando = false;
      if (loop) { cancelAnimationFrame(loop); loop = null; }
      window.removeEventListener('scroll', aoRolar);
      camadas.forEach(function (l) { if (l.el) l.el.style.removeProperty('--py'); });
      if (barra) barra.style.setProperty('--p', '0');
    };
  });
})();
