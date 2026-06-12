// auth.js — compte utilisateur (connexion / inscription) + session JWT, partagé sur toutes les pages
(function () {
  const TOKEN_KEY = 'ggmatch_token';
  const USER_KEY = 'ggmatch_username';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUsername() { return localStorage.getItem(USER_KEY); }
  function isLoggedIn() { return !!getToken(); }

  function setSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.reload();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML =
      '<div class="auth-modal">' +
        '<button class="auth-close" aria-label="Fermer">&times;</button>' +
        '<div class="auth-tabs">' +
          '<button type="button" class="auth-tab active" data-tab="login">Connexion</button>' +
          '<button type="button" class="auth-tab" data-tab="register">Créer un compte</button>' +
        '</div>' +
        '<form class="auth-form" id="authForm">' +
          '<label class="auth-field">' +
            '<span>Pseudo</span>' +
            '<input type="text" name="username" required autocomplete="username">' +
          '</label>' +
          '<label class="auth-field">' +
            '<span>Mot de passe</span>' +
            '<input type="password" name="password" required autocomplete="current-password" minlength="4">' +
          '</label>' +
          '<p class="auth-error" id="authError"></p>' +
          '<button type="submit" class="auth-submit">Se connecter</button>' +
        '</form>' +
        '<p class="auth-hint">Ton compte synchronise tes pièces, ton avatar et ton Pass Saison sur tous tes appareils.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function openModal() {
    let overlay = document.querySelector('.auth-overlay');
    if (!overlay) overlay = buildModal();
    overlay.classList.add('open');

    const form = overlay.querySelector('#authForm');
    const error = overlay.querySelector('#authError');
    const tabs = overlay.querySelectorAll('.auth-tab');
    const submit = overlay.querySelector('.auth-submit');
    const passInput = form.querySelector('input[name="password"]');
    let mode = 'login';

    function setMode(m) {
      mode = m;
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === m); });
      submit.textContent = m === 'login' ? 'Se connecter' : 'Créer mon compte';
      passInput.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      error.textContent = '';
    }

    tabs.forEach(function (t) { t.onclick = function () { setMode(t.dataset.tab); }; });
    setMode('login');

    overlay.querySelector('.auth-close').onclick = function () { overlay.classList.remove('open'); };
    overlay.onclick = function (e) { if (e.target === overlay) overlay.classList.remove('open'); };

    form.onsubmit = function (e) {
      e.preventDefault();
      error.textContent = '';
      const username = form.username.value.trim();
      const password = form.password.value;
      if (!username || !password) return;
      submit.disabled = true;

      const afterAuth = function () {
        return fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        }).then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok) throw new Error(d.error || 'Erreur de connexion');
            setSession(d.token, d.username);
            if (window.GGAvatar && window.GGAvatar.syncProfile) {
              return window.GGAvatar.syncProfile();
            }
          });
        });
      };

      let p;
      if (mode === 'register') {
        p = fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password, games: [] })
        }).then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok) throw new Error(d.error || 'Erreur lors de la création du compte');
            return afterAuth();
          });
        });
      } else {
        p = afterAuth();
      }

      p.then(function () {
        location.reload();
      }).catch(function (err) {
        error.textContent = err.message;
        submit.disabled = false;
      });
    };
  }

  function mountWidget() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const navCta = nav.querySelector('.nav-cta');
    const right = document.createElement('div');
    right.className = 'nav-right';
    if (navCta && navCta.parentNode === nav) {
      nav.insertBefore(right, navCta);
      right.appendChild(navCta);
    } else {
      nav.appendChild(right);
    }

    const wrap = document.createElement('div');
    wrap.className = 'auth-widget';

    if (isLoggedIn()) {
      wrap.innerHTML =
        '<button class="auth-account-btn" id="authAccountBtn">👤 ' + escapeHtml(getUsername()) + '</button>' +
        '<div class="auth-account-menu" id="authAccountMenu">' +
          '<button class="auth-logout" id="authLogoutBtn">Déconnexion</button>' +
        '</div>';
    } else {
      wrap.innerHTML = '<button class="auth-login-btn" id="authLoginBtn">Connexion</button>';
    }

    right.appendChild(wrap);

    if (isLoggedIn()) {
      const btn = wrap.querySelector('#authAccountBtn');
      const menu = wrap.querySelector('#authAccountMenu');
      btn.onclick = function (e) { e.stopPropagation(); menu.classList.toggle('open'); };
      wrap.querySelector('#authLogoutBtn').onclick = logout;
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) menu.classList.remove('open');
      });
    } else {
      wrap.querySelector('#authLoginBtn').onclick = openModal;
    }

    mountNavToggle(right);
  }

  // Menu hamburger mobile : affiche/masque les liens de nav (Univers, Boutique, Lobby...)
  function mountNavToggle(right) {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Menu');
    toggle.textContent = '☰';
    toggle.onclick = function (e) {
      e.stopPropagation();
      const open = navLinks.classList.toggle('nav-open');
      toggle.textContent = open ? '✕' : '☰';
    };
    right.appendChild(toggle);
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('nav-open') && !navLinks.contains(e.target) && e.target !== toggle) {
        navLinks.classList.remove('nav-open');
        toggle.textContent = '☰';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountWidget();
    if (isLoggedIn() && window.GGAvatar && window.GGAvatar.syncProfile) {
      window.GGAvatar.syncProfile();
    }
  });

  window.GGAuth = { getToken: getToken, getUsername: getUsername, isLoggedIn: isLoggedIn, logout: logout, openModal: openModal, setSession: setSession };
})();
