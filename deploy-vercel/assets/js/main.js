/* Ápice Arquitetura e Engenharia — interações */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    scrim.classList.toggle('is-on', open);
    scrim.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('nav-locked', open);
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

  /* ---------- Revelação por scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Lightbox do portfólio (só existe na home) ---------- */
  var works = Array.prototype.slice.call(document.querySelectorAll('.work'));
  var lb = document.getElementById('lb');
  if (!lb || !works.length) return;

  var lbImg = document.getElementById('lbImg');
  var lbTitle = document.getElementById('lbTitle');
  var lbTag = document.getElementById('lbTag');
  var current = 0;
  var opener = null;

  var items = works.map(function (w) {
    var img = w.querySelector('img');
    var cap = w.querySelector('.work__cap');
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      title: cap.querySelector('strong').textContent,
      tag: cap.querySelector('span').textContent
    };
  });

  function show(i) {
    current = (i + items.length) % items.length;
    var it = items[current];
    lbImg.setAttribute('src', it.src);
    lbImg.setAttribute('alt', it.alt);
    lbTitle.textContent = it.title;
    lbTag.textContent = it.tag;
  }

  function open(i) {
    opener = works[i];
    show(i);
    if (typeof lb.showModal === 'function') lb.showModal();
    else lb.setAttribute('open', '');
  }

  works.forEach(function (w, i) {
    w.setAttribute('aria-haspopup', 'dialog');
    w.addEventListener('click', function () { open(i); });
  });

  document.getElementById('lbClose').addEventListener('click', function () { lb.close(); });
  document.getElementById('lbPrev').addEventListener('click', function () { show(current - 1); });
  document.getElementById('lbNext').addEventListener('click', function () { show(current + 1); });

  lb.addEventListener('click', function (e) {
    if (e.target === lb) lb.close();
  });

  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
  });

  lb.addEventListener('close', function () {
    if (opener) { opener.focus(); opener = null; }
  });
})();
