/* Aviso de cookies (LGPD, informativo: as tags disparam desde o carregamento) */
(function () {
  'use strict';

  var KEY = 'cookie_notice';
  var seen = null;
  try { seen = localStorage.getItem(KEY); } catch (e) { /* storage bloqueado */ }

  if (seen === 'ok') return;

  var banner = document.createElement('div');
  banner.className = 'cookiebar';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML =
    '<p class="cookiebar__txt">Usamos cookies para o site funcionar, medir a audiência e mostrar ' +
    'anúncios a quem já nos visitou. Saiba mais na ' +
    '<a href="politica-de-privacidade.html">Política de Privacidade</a>.</p>' +
    '<ul class="cookie-fins" id="cookie-fins" data-cookie-fins hidden>' +
      '<li><strong>Essenciais:</strong> fazem o site funcionar.</li>' +
      '<li><strong>Análise:</strong> Google Analytics e Microsoft Clarity, para saber quais páginas e botões funcionam.</li>' +
      '<li><strong>Publicidade:</strong> Google Ads, Meta e LinkedIn, para mostrar anúncios a quem já visitou o site.</li>' +
    '</ul>' +
    '<div class="cookiebar__actions">' +
      '<button type="button" class="btn btn--ghost" data-cookie-more aria-expanded="false" aria-controls="cookie-fins">Ver finalidades</button>' +
      '<button type="button" class="btn" data-cookie-ok>Entendi</button>' +
    '</div>';

  var fins = banner.querySelector('[data-cookie-fins]');
  var more = banner.querySelector('[data-cookie-more]');

  function finsOpen(open) {
    fins.hidden = !open;
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  banner.querySelector('[data-cookie-ok]').addEventListener('click', function () {
    try { localStorage.setItem(KEY, 'ok'); } catch (e) { /* segue sem persistir */ }
    banner.remove();
  });
  more.addEventListener('click', function () { finsOpen(fins.hidden); });

  function mount() { document.body.appendChild(banner); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
