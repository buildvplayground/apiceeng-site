/* Banner de consentimento de cookies — LGPD
   Emite evento no dataLayer para que as tags só disparem após o consentimento. */
(function () {
  'use strict';

  var KEY = 'apice_consent_v1';
  window.dataLayer = window.dataLayer || [];

  function push(status) {
    window.dataLayer.push({
      event: 'cookie_consent',
      consent_status: status,
      analytics_storage: status === 'accepted' ? 'granted' : 'denied',
      ad_storage: status === 'accepted' ? 'granted' : 'denied'
    });
  }

  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* storage bloqueado */ }

  if (stored) { push(stored); return; }

  function save(status) {
    try { localStorage.setItem(KEY, status); } catch (e) { /* segue sem persistir */ }
    push(status);
    banner.remove();
  }

  var banner = document.createElement('div');
  banner.className = 'cookiebar';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Aviso de cookies');
  banner.innerHTML =
    '<p class="cookiebar__txt">Usamos cookies para entender como o site é usado e melhorar a sua ' +
    'experiência. Você pode aceitar ou recusar — recusar não afeta a navegação. ' +
    '<a href="politica-de-privacidade.html">Política de Privacidade</a>.</p>' +
    '<div class="cookiebar__actions">' +
      '<button type="button" class="btn btn--ghost" data-act="rejected">Recusar</button>' +
      '<button type="button" class="btn" data-act="accepted">Aceitar</button>' +
    '</div>';

  banner.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b) save(b.getAttribute('data-act'));
  });

  function mount() { document.body.appendChild(banner); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
