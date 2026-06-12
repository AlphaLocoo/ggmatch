/* ============================================
   MATCH — Widget de matchmaking invité +
   affichage des tournois/lives par univers
   Utilisé par les 6 pages univers (data-universe="...")
   ============================================ */
(function () {
  const script = document.currentScript;
  const universe = script && script.dataset.universe;

  const CONFIG = {
    GGMatch: {
      title: 'Trouve un coéquipier maintenant.',
      filters: [
        { key: 'jeu', label: 'Jeu', options: ['Valorant', 'League of Legends', 'CS2', 'Fortnite', 'Apex Legends', 'Rocket League', 'Autre'] },
        { key: 'niveau', label: 'Niveau', options: ['Débutant', 'Intermédiaire', 'Avancé', 'Pro'] }
      ]
    },
    BeatMatch: {
      title: 'Trouve ton binôme musical maintenant.',
      filters: [
        { key: 'discipline', label: 'Discipline', options: ['Production', 'Rap / Chant', 'Guitare', 'Piano', 'DJ', 'Autre'] },
        { key: 'genre', label: 'Genre', options: ['Hip-Hop', 'Electro', 'Pop', 'Rock', 'Jazz', 'Autre'] }
      ]
    },
    StudyMatch: {
      title: 'Trouve ton binôme de révision maintenant.',
      filters: [
        { key: 'matiere', label: 'Matière', options: ['Maths', 'Droit', 'Médecine', 'Code', 'Langues', 'Sciences', 'Autre'] },
        { key: 'niveau', label: 'Niveau', options: ['Lycée', 'Prépa', 'Université', 'Concours'] }
      ]
    },
    TalkMatch: {
      title: 'Trouve ton partenaire linguistique maintenant.',
      filters: [
        { key: 'native', label: 'Je parle', options: ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Japonais', 'Autre'] },
        { key: 'target', label: "J'apprends", options: ['Anglais', 'Français', 'Espagnol', 'Allemand', 'Italien', 'Japonais', 'Autre'] }
      ]
    },
    GymMatch: {
      title: 'Trouve ton partenaire de sport maintenant.',
      filters: [
        { key: 'sport', label: 'Sport', options: ['Musculation', 'Running', 'Yoga', 'Boxe', 'Football', 'Tennis', 'Autre'] },
        { key: 'objectif', label: 'Objectif', options: ['Perte de poids', 'Performance', 'Découverte', 'Régularité'] }
      ]
    },
    CreateMatch: {
      title: 'Trouve ton binôme créatif maintenant.',
      filters: [
        { key: 'discipline', label: 'Discipline', options: ['Design', 'Photo', 'Vidéo', 'Écriture', 'Illustration', 'Autre'] },
        { key: 'niveau', label: 'Niveau', options: ['Débutant', 'Intermédiaire', 'Confirmé'] }
      ]
    }
  };

  const cfg = CONFIG[universe];
  if (!cfg) return;

  const widgetRoot = document.getElementById('match-widget-root');
  if (widgetRoot) renderWidget(widgetRoot, cfg);

  const eventsRoot = document.getElementById('events-root');
  if (eventsRoot) renderEvents(eventsRoot, universe);

  function renderWidget(root, cfg) {
    const guestName = 'Invité' + Math.floor(1000 + Math.random() * 9000);

    root.innerHTML = `
      <div class="match-widget-label">Matchmaking — Sans inscription · Sans carte bancaire</div>
      <h2 class="match-widget-title">${cfg.title}</h2>
      <div class="mw-form">
        <div class="mw-field">
          <label>Pseudo</label>
          <input type="text" id="mw-username" value="${guestName}" maxlength="20">
        </div>
        ${cfg.filters.map(f => `
          <div class="mw-field">
            <label>${f.label}</label>
            <select id="mw-${f.key}">
              ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
          </div>
        `).join('')}
        <button class="mw-btn" id="mw-start">Lancer la recherche →</button>
      </div>
      <div class="mw-status" id="mw-status">
        <div class="mw-spinner"></div>
        <div class="mw-status-text">Recherche d'un partenaire compatible…</div>
        <button class="mw-btn mw-btn-secondary" id="mw-cancel">Annuler</button>
      </div>
      <div class="mw-chat" id="mw-chat">
        <div class="mw-chat-header">
          <div class="mw-chat-partner">Connecté avec <span id="mw-partner-name"></span></div>
          <div style="display:flex; gap:0.5rem;">
            <button class="mw-btn mw-btn-secondary mw-voice-btn" id="mw-voice-btn">🎙️ Vocal</button>
            <button class="mw-btn mw-btn-secondary" id="mw-new">Nouveau match</button>
          </div>
        </div>
        <div class="mw-voice-incoming" id="mw-voice-incoming" style="display:none"></div>
        <div class="mw-messages" id="mw-messages"></div>
        <div class="mw-chat-input">
          <input type="text" id="mw-msg-input" placeholder="Écris un message…">
          <button class="mw-btn" id="mw-send">Envoyer</button>
        </div>
      </div>
    `;

    const elStatus = root.querySelector('#mw-status');
    const elChat = root.querySelector('#mw-chat');
    const elStart = root.querySelector('#mw-start');
    const elCancel = root.querySelector('#mw-cancel');
    const elNew = root.querySelector('#mw-new');
    const elMessages = root.querySelector('#mw-messages');
    const elPartner = root.querySelector('#mw-partner-name');
    const elMsgInput = root.querySelector('#mw-msg-input');
    const elSend = root.querySelector('#mw-send');
    const elVoiceBtn = root.querySelector('#mw-voice-btn');
    const elVoiceIncoming = root.querySelector('#mw-voice-incoming');

    let socket = null;
    let room = null;
    let myName = guestName;
    let partnerId = null;
    let voice = null;
    let voiceState = 'idle'; // idle | requesting | incoming | connected

    function ensureSocket() {
      if (socket) return socket;
      socket = io();

      socket.on('match_found', (data) => {
        room = data.room;
        elStatus.classList.remove('active');
        elChat.classList.add('active');
        elMessages.innerHTML = '';
        const partner = data.players.find((p) => p !== myName) || data.players.find((p) => p !== socket.id) || data.players[0];
        elPartner.textContent = partner;
        partnerId = (data.playerIds || []).find((id) => id !== socket.id) || null;
        resetVoice();
        if (window.GGAvatar && window.GGAvatar.addBattlePassXP) {
          window.GGAvatar.addBattlePassXP(universe, window.GGAvatar.BP_MATCH_XP);
        }
      });

      socket.on('message', (data) => {
        appendMessage(data.from === myName ? 'me' : 'them', data.text);
      });

      socket.on('webrtc_signal', (msg) => {
        const data = msg.data || {};
        if (data.type === 'voice_request') {
          voiceState = 'incoming';
          showIncomingVoice();
        } else if (data.type === 'voice_accept') {
          // L'autre joueur a accepté : on initie la connexion
          ensureVoiceManager();
          voice.getLocalStream().then(() => {
            voiceState = 'connected';
            updateVoiceBtn();
            voice.callPeer(partnerId);
          }).catch(() => {
            voiceState = 'idle';
            updateVoiceBtn();
          });
        } else if (data.type === 'voice_decline') {
          voiceState = 'idle';
          updateVoiceBtn();
          appendSystemMessage("L'autre joueur n'est pas disponible pour le vocal.");
        } else if (data.type === 'voice_hangup') {
          if (voice) voice.closeAll();
          voiceState = 'idle';
          hideIncomingVoice();
          updateVoiceBtn();
        } else {
          ensureVoiceManager();
          voice.handleSignal(msg);
        }
      });

      return socket;
    }

    function ensureVoiceManager() {
      if (!voice) voice = window.GGVoice.createVoiceManager(socket, {});
      return voice;
    }

    function resetVoice() {
      if (voice) voice.closeAll();
      voice = null;
      voiceState = 'idle';
      hideIncomingVoice();
      updateVoiceBtn();
    }

    function updateVoiceBtn() {
      if (!elVoiceBtn) return;
      if (voiceState === 'connected') {
        elVoiceBtn.textContent = '🔇 Quitter le vocal';
        elVoiceBtn.classList.add('active');
      } else if (voiceState === 'requesting') {
        elVoiceBtn.textContent = '🎙️ En attente…';
        elVoiceBtn.classList.remove('active');
      } else {
        elVoiceBtn.textContent = '🎙️ Vocal';
        elVoiceBtn.classList.remove('active');
      }
    }

    function showIncomingVoice() {
      if (!elVoiceIncoming) return;
      elVoiceIncoming.style.display = 'flex';
      elVoiceIncoming.innerHTML = `
        <span>${escapeHtml(elPartner.textContent || 'Ton partenaire')} te propose un appel vocal.</span>
        <div class="mw-voice-incoming-actions">
          <button class="mw-btn" id="mw-voice-accept">Accepter</button>
          <button class="mw-btn mw-btn-secondary" id="mw-voice-decline">Refuser</button>
        </div>
      `;
      elVoiceIncoming.querySelector('#mw-voice-accept').addEventListener('click', () => {
        ensureVoiceManager();
        voice.getLocalStream().then(() => {
          voiceState = 'connected';
          hideIncomingVoice();
          updateVoiceBtn();
          if (partnerId) socket.emit('webrtc_signal', { to: partnerId, data: { type: 'voice_accept' } });
        }).catch(() => {
          appendSystemMessage("Impossible d'accéder au micro.");
          hideIncomingVoice();
        });
      });
      elVoiceIncoming.querySelector('#mw-voice-decline').addEventListener('click', () => {
        if (partnerId) socket.emit('webrtc_signal', { to: partnerId, data: { type: 'voice_decline' } });
        voiceState = 'idle';
        hideIncomingVoice();
        updateVoiceBtn();
      });
    }

    function hideIncomingVoice() {
      if (!elVoiceIncoming) return;
      elVoiceIncoming.style.display = 'none';
      elVoiceIncoming.innerHTML = '';
    }

    if (elVoiceBtn) {
      elVoiceBtn.addEventListener('click', () => {
        if (!partnerId || !socket) return;
        if (voiceState === 'connected') {
          if (voice) voice.closeAll();
          voiceState = 'idle';
          socket.emit('webrtc_signal', { to: partnerId, data: { type: 'voice_hangup' } });
          updateVoiceBtn();
        } else if (voiceState === 'idle') {
          voiceState = 'requesting';
          updateVoiceBtn();
          socket.emit('webrtc_signal', { to: partnerId, data: { type: 'voice_request' } });
        }
      });
    }

    function appendSystemMessage(text) {
      const el = document.createElement('div');
      el.className = 'mw-msg them';
      el.style.opacity = '0.6';
      el.style.fontStyle = 'italic';
      el.textContent = text;
      elMessages.appendChild(el);
      elMessages.scrollTop = elMessages.scrollHeight;
    }

    function startSearch() {
      myName = (root.querySelector('#mw-username').value || '').trim() || guestName;
      const filters = {};
      cfg.filters.forEach((f) => {
        filters[f.key] = root.querySelector(`#mw-${f.key}`).value;
      });

      ensureSocket();
      elChat.classList.remove('active');
      elStatus.classList.add('active');
      socket.emit('find_match', { username: myName, game: universe, filters });
    }

    elStart.addEventListener('click', startSearch);

    elCancel.addEventListener('click', () => {
      if (socket) socket.emit('leave_queue');
      elStatus.classList.remove('active');
    });

    elNew.addEventListener('click', () => {
      resetVoice();
      elChat.classList.remove('active');
      startSearch();
    });

    function send() {
      const text = elMsgInput.value.trim();
      if (!text || !room || !socket) return;
      socket.emit('message', { room, text });
      appendMessage('me', text);
      elMsgInput.value = '';
    }

    elSend.addEventListener('click', send);
    elMsgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });

    function appendMessage(cls, text) {
      const el = document.createElement('div');
      el.className = 'mw-msg ' + cls;
      el.textContent = text;
      elMessages.appendChild(el);
      elMessages.scrollTop = elMessages.scrollHeight;
    }
  }

  function renderEvents(root, universe) {
    root.innerHTML = `
      <div class="events-section">
        <div class="universes-header" style="padding:0 0 0;">
          <h2 class="universes-title">Tournois<br>& Lives.</h2>
          <div class="universes-count">À venir</div>
        </div>
        <div class="events-grid">
          <div class="events-col">
            <div class="events-col-header">🏆 Tournois</div>
            <div id="events-tournoi"><div class="events-empty">Chargement…</div></div>
          </div>
          <div class="events-col">
            <div class="events-col-header">🔴 Lives</div>
            <div id="events-live"><div class="events-empty">Chargement…</div></div>
          </div>
        </div>
      </div>
    `;

    fetch(`/api/events?universe=${encodeURIComponent(universe)}`)
      .then((r) => r.json())
      .then((events) => {
        const tournois = (events || []).filter((e) => e.type === 'tournoi');
        const lives = (events || []).filter((e) => e.type === 'live');
        // auth.js a fini de charger à ce stade (script suivant, synchrone) :
        // on peut récupérer le token + le profil (plan, historique d'inscriptions).
        const token = window.GGAuth && window.GGAuth.getToken && window.GGAuth.getToken();
        const meRequest = token
          ? fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);

        meRequest.then((me) => {
          renderEventList(root, 'events-tournoi', tournois, me);
          renderEventList(root, 'events-live', lives, me);
        });
      })
      .catch(() => {
        renderEventList(root, 'events-tournoi', []);
        renderEventList(root, 'events-live', []);
      });
  }

  function renderEventList(root, id, items, me) {
    const el = root.querySelector('#' + id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="events-empty">Rien de programmé pour le moment — reviens bientôt.</div>';
      return;
    }
    el.innerHTML = items.map((ev) => renderEventCard(ev, me)).join('');
    attachEventEntryHandlers(el);
  }

  // Carte pour un live (affichage simple, sans inscription)
  function renderLiveCard(ev) {
    const isLiveNow = countdownText(ev.date) === 'En cours';
    return `
      <div class="event-card">
        ${isLiveNow ? '<div class="event-badges"><div class="event-badge live-badge">🔴 En direct</div></div>' : ''}
        <div class="event-date">${formatDate(ev.date)}</div>
        <div class="event-title">${escapeHtml(ev.title || '')}</div>
        ${ev.description ? `<div class="event-desc">${escapeHtml(ev.description)}</div>` : ''}
        <div class="event-meta">
          ${ev.format ? `<span class="event-tag">${escapeHtml(ev.format)}</span>` : ''}
          ${ev.host ? `<span class="event-tag">${escapeHtml(ev.host)}</span>` : ''}
        </div>
      </div>
    `;
  }

  // Carte tournoi : distingue visuellement les tournois cash prize (rouge/or, urgence,
  // gros affichage du gain) des tournois gratuits (e-coins), et propose un bouton
  // d'inscription branché sur POST /api/events/:id/enter.
  function renderEventCard(ev, me) {
    if (ev.type !== 'tournoi') return renderLiveCard(ev);

    const isCash = ev.tier === 'cash';
    const countdown = countdownText(ev.date);
    const loggedIn = !!(window.GGAuth && window.GGAuth.is