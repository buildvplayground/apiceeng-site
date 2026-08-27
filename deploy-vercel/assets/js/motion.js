/* ============================================================
   Ápice — motor de movimento
   Carregado antes do CSS pintar (marca .js no <html>) para que
   os elementos já nasçam no estado inicial, sem "flash" de conteúdo.
   Sem JS, nada disso roda e o site aparece inteiro — é progressive
   enhancement, não dependência.

   Regra que orienta tudo: a animação serve para apresentar conteúdo
   a quem está chegando nele. Quem já passou, quem está voltando, quem
   saltou de âncora ou está no fim da página recebe o conteúdo pronto,
   sem espera. Animação atrasada é ruído, não acabamento.
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

    var VELOCIDADE_MAX = 2.2;   // px/ms — acima disso o usuário está saltando, não lendo
    var ZONA_FINAL = 0.88;      // a partir de 88% da página nada mais espera para aparecer

    /* --------------------------------------------------------
       Estado do scroll: direção e velocidade
       -------------------------------------------------------- */
    var ultimoY = window.scrollY;
    var ultimoT = performance.now();
    var velocidade = 0;
    var descendo = true;
    var saltoProgramatico = 0;   // timestamp até quando ignorar animação

    function amostrarScroll() {
      var y = window.scrollY;
      var t = performance.now();
      var dt = t - ultimoT;
      if (dt > 0) {
        var dy = y - ultimoY;
        // média móvel: um único quadro lento não deve mascarar um salto
        velocidade = velocidade * 0.4 + (Math.abs(dy) / dt) * 0.6;
        if (Math.abs(dy) > 2) descendo = dy > 0;
      }
      ultimoY = y;
      ultimoT = t;
    }

    // Saltos de âncora e do skip link não devem animar o destino
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) saltoProgramatico = performance.now() + 1200;
    }, true);
    window.addEventListener('hashchange', function () {
      saltoProgramatico = performance.now() + 1200;
    });

    function naZonaFinal() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 && (window.scrollY / max) >= ZONA_FINAL;
    }

    /* --------------------------------------------------------
       Revelar — com ou sem transição, conforme o contexto
       -------------------------------------------------------- */
    function revelar(el, delay, instantaneo) {
      if (el.classList.contains('is-in')) return;

      if (instantaneo) {
        el.classList.add('is-instant', 'is-in', 'is-done');
        // devolve a transição no quadro seguinte, para hover e afins
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { el.classList.remove('is-instant'); });
        });
        return;
      }

      el.style.setProperty('--d', delay + 'ms');
      el.classList.add('is-in');
      setTimeout(function () { el.classList.add('is-done'); }, 1600 + delay);
    }

    /* Um elemento deve aparecer pronto quando:
       - o usuário está rolando rápido demais para ler;
       - o usuário está subindo (já passou por ali);
       - houve salto de âncora;
       - a página está na zona final;
       - o elemento entrou já acima do meio da tela (o scroll passou por cima). */
    function deveSerInstantaneo(rect) {
      if (velocidade > VELOCIDADE_MAX) return true;
      if (!descendo) return true;
      if (performance.now() < saltoProgramatico) return true;
      if (naZonaFinal()) return true;
      if (rect && rect.bottom < window.innerHeight * 0.5) return true;
      return false;
    }

    function stepDe(el) {
      var group = el.parentElement && el.parentElement.closest('[data-stagger]');
      return group ? (parseInt(group.getAttribute('data-stagger'), 10) || 80) : 0;
    }

    /* --------------------------------------------------------
       1. Entrada do hero — encadeada, logo após o primeiro paint
       -------------------------------------------------------- */
    var hero = document.querySelector('.hero');
    if (hero) {
      // quem chega com a página já rolada (recarregou no meio) não vê o hero animar
      var heroInstantaneo = window.scrollY > window.innerHeight * 0.4;
      hero.querySelectorAll('.hero__inner > *').forEach(function (el, i) {
        el.style.setProperty('--d', heroInstantaneo ? '0ms' : (120 + i * 110) + 'ms');
      });
      if (heroInstantaneo) hero.classList.add('is-instant');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hero.classList.add('is-ready');
          if (heroInstantaneo) {
            setTimeout(function () { hero.classList.remove('is-instant'); }, 60);
          }
        });
      });
    }

    /* --------------------------------------------------------
       2. Reveal por scroll
       -------------------------------------------------------- */
    var animated = document.querySelectorAll('[data-anim]');

    if (!('IntersectionObserver' in window)) {
      animated.forEach(function (el) { el.classList.add('is-in', 'is-done'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        var entrando = entries.filter(function (e) { return e.isIntersecting; });
        if (!entrando.length) return;

        // a cascata segue a ordem de leitura dentro do lote que entrou junto
        entrando.sort(function (a, b) {
          var ra = a.boundingClientRect, rb = b.boundingClientRect;
          return (ra.top - rb.top) || (ra.left - rb.left);
        });

        var instantaneo = deveSerInstantaneo();
        entrando.forEach(function (entry, i) {
          revelar(
            entry.target,
            i * stepDe(entry.target),
            instantaneo || deveSerInstantaneo(entry.boundingClientRect)
          );
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

      var pendentes = [];
      var naTela = [];

      animated.forEach(function (el) {
        var r = el.getBoundingClientRect();
        // o que já está visível no carregamento entra sem esperar o scroll
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0 && !el.closest('.hero')) naTela.push(el);
        else { pendentes.push(el); io.observe(el); }
      });

      naTela.forEach(function (el, i) { revelar(el, i * stepDe(el), false); });

      /* Rede de segurança: se o usuário chegou à zona final, tudo o que
         ainda não entrou aparece de uma vez. Ninguém deve ver blocos
         surgindo enquanto lê o rodapé. */
      function liberarPendentes() {
        if (!naZonaFinal()) return;
        pendentes.forEach(function (el) {
          if (!el.classList.contains('is-in')) { io.unobserve(el); revelar(el, 0, true); }
        });
        pendentes = [];
        window.removeEventListener('scroll', liberarPendentes);
      }
      window.addEventListener('scroll', liberarPendentes, { passive: true });
    }

    /* --------------------------------------------------------
       3. Parallax, header e barra de progresso — um único rAF
       -------------------------------------------------------- */
    var bar = document.querySelector('.progress');
    var header = document.getElementById('header');
    var layers = [];

    if (hero) layers.push({ el: hero.querySelector('.hero__media'), host: hero, depth: 0.18 });
    document.querySelectorAll('.band__frame').forEach(function (m) {
      layers.push({ el: m.querySelector('img'), host: m, depth: 0.14 });
    });

    var ticking = false;
    var running = true;

    function frame() {
      ticking = false;
      if (!running) return;

      var vh = window.innerHeight;
      var y = window.scrollY;

      if (bar) {
        var max = document.documentElement.scrollHeight - vh;
        bar.style.setProperty('--p', max > 4 ? Math.min(1, y / max).toFixed(4) : '0');
      }

      if (header) header.classList.toggle('is-compact', y > vh * 0.6);

      layers.forEach(function (l) {
        if (!l.el) return;
        var r = l.host.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) return;
        // -1 (abaixo da dobra) → +1 (acima da dobra)
        var progresso = (vh / 2 - (r.top + r.height / 2)) / ((vh + r.height) / 2);
        l.el.style.setProperty('--py', (progresso * r.height * l.depth).toFixed(1) + 'px');
      });
    }

    function onScroll() {
      amostrarScroll();
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();

    // a velocidade decai quando o scroll para, senão o próximo elemento
    // herdaria a leitura de um salto que já acabou
    setInterval(function () { velocidade *= 0.6; }, 200);

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) onScroll();
    });

    window.__apiceStop = function () {
      running = false;
      window.removeEventListener('scroll', onScroll);
      layers.forEach(function (l) { if (l.el) l.el.style.removeProperty('--py'); });
      if (bar) bar.style.setProperty('--p', '0');
    };
  });
})();
