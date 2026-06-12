/* ============================================
   lobby.js — Lobby interactif par univers
   Déplacement par clic + vocal de groupe (mesh WebRTC)
   ============================================ */
(function () {
  const root = document.getElementById('lobby-root');
  if (!root) return;

  const UNIVERSES = [
    { id: 'GGMatch', label: 'GGMatch', emoji: '🎮', theme: 'theme-gaming', accent: 'accent-gaming' },
    { id: 'BeatMatch', label: 'BeatMatch', emoji: '🎵', theme: 'theme-music', accent: 'accent-music' },
    { id: 'StudyMatch', label: 'StudyMatch', emoji: '📚', theme: 'theme-study', accent: 'accent-study' },
    { id: 'TalkMatch', label: 'TalkMatch', emoji: '🌍', theme: 'theme-language', accent: 'accent-language' },
    { id: 'GymMatch', label: 'GymMatch', emoji: '🏋️', theme: 'theme-fitness', accent: 'accent-fitness' },
    { id: 'CreateMatch', label: 'CreateMatch', emoji: '🎨', theme: 'theme-creative', accent: 'accent-creative' }
  ];

  // Dimensions virtuelles de la carte (cohérentes avec le placement aléatoire côté serveur)
  const FLOOR_W = 900;
  const FLOOR_H = 400;

  let currentUniverse = UNIVERSES[0].id;
  let socket = null;
  let voice = null;
  let inVoice = false;
  const players = {}; // id -> { username, x, y, inVoice, config, equipped, el }
  let myId = null;

  const KEY_USERNAME = 'ggmatch_lobby_username';
  function getUsername() {
    let name = localStorage.getItem(KEY_USERNAME);
    if (!name) {
      name = 'Invité' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem(KEY_USERNAME, name);
    }
    return name;
  }

  root.innerHTML = `
    <div class="universes-header" style="padding-top: 4rem;">
      <h2 class="universes-title">Choisis ton<br>univers.</h2>
      <div class="universes-count">En direct</div>
    </div>
    <div class="lobby-tabs" id="lobby-tabs"></div>
    <div class="lobby-toolbar">
      <div class="lobby-username-field">
        <label>Pseudo</label>
        <input type="text" id="lobby-username" maxlength="20" value="${getUsername()}">
      </div>
      <div class="lobby-voice-controls">
        <button class="mw-btn" id="lobby-voice-btn">🎙️ Rejoindre le vocal</button>
        <span class="lobby-voice-status" id="lobby-voice-status"></span>
      </div>
    </div>
    <div class="lobby-floor-wrap">
      <div class="lobby-floor" id="lobby-floor"></div>
      <div class="lobby-hint">Clique sur la carte pour déplacer ton avatar</div>
    </div>
    <div class="lobby-players-count" id="lobby-players-count"></div>
  `;

  const elTabs = root.querySelector('#lobby-tabs');
  const elFloor = root.querySelector('#lobby-floor');
  const elUsername = root.querySelector('#lobby-username');
  const elVoiceBtn = root.querySelector('#lobby-voice-btn');
  const elVoiceStatus = root.querySelector('#lobby-voice-status');
  const elPlayersCount = root.querySelector('#lobby-players-count');
  const elAccentEm = document.getElementById('lobby-accent-em');

  UNIVERSES.forEach((u) => {
    const btn = document.createElement('button');
    btn.className = 'bp-tab lobby-tab' + (u.id === currentUniverse ? ' active' : '');
    btn.dataset.universe = u.id;
    btn.innerHTML = `${u.emoji} ${u.label}`;
    btn.addEventListener('click', () => switchUniverse(u.id));
    elTabs.appendChild(btn);
  });

  function applyTheme(universeId) {
    const u = UNIVERSES.find((x) => x.id === universeId);
    if (!u) return;
    UNIVERSES.forEach((x) => root.classList.remove(x.theme));
    root.classList.add(u.theme);
    if (elAccentEm) {
      UNIVERSES.forEach((x) => elAccentEm.classList.remove(x.accent));
      elAccentEm.classList.add(u.accent);
      elAccentEm.textContent = 'Lobby ' + u.label;
    }
    elTabs.querySelectorAll('.lobby-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.universe === universeId);
    });
  }

  function ensureSocket() {
    if (socket) return socket;
    socket = io();

    socket.on('connect', () => {
      myId = socket.id;
      joinLobby();
    });

    socket.on('lobby_state', (data) => {
      clearPlayers();
      myId = data.self.id;
      addPlayer(data.self.id, {
        username: data.self.username,
        x: data.self.x,
        y: data.self.y,
        inVoice: false,
        config: window.GGAvatar ? window.GGAvatar.getConfig() : null,
        equipped: window.GGAvatar ? window.GGAvatar.getEquipped() : null
      }, true);
      (data.players || []).forEach((p) => addPlayer(p.id, p, false));
      updatePlayersCount();
    });

    socket.on('lobby_player_joined', (p) => {
      addPlayer(p.id, p, false);
      updatePlayersCount();
    });

    socket.on('lobby_player_moved', (p) => {
      movePlayer(p.id, p.x, p.y);
    });

    socket.on('lobby_player_left', (p) => {
      removePlayer(p.id);
      if (voice) voice.closePeer(p.id);
      updatePlayersCount();
    });

    socket.on('voice_peers', (data) => {
      (data.peers || []).forEach((id) => {
        if (voice) voice.callPeer(id);
      });
      setTimeout(updateVoiceConnectionStatus, 300);
    });

    socket.on('voice_peer_joined', (data) => {
      if (players[data.id]) {
        players[data.id].inVoice = true;
        updateVoiceIndicator(data.id);
      }
      setTimeout(updateVoiceConnectionStatus, 300);
    });

    socket.on('voice_peer_left', (data) => {
      if (players[data.id]) {
        players[data.id].inVoice = false;
        updateVoiceIndicator(data.id);
      }
      if (voice) voice.closePeer(data.id);
      updateVoiceConnectionStatus();
    });

    socket.on('webrtc_signal', (msg) => {
      if (voice) voice.handleSignal(msg);
    });

    return socket;
  }

  function joinLobby() {
    const username = (elUsername.value || '').trim() || getUsername();
    localStorage.setItem(KEY_USERNAME, username);
    const config = window.GGAvatar ? window.GGAvatar.getConfig() : null;
    const equipped = window.GGAvatar ? window.GGAvatar.getEquipped() : null;
    socket.emit('lobby_join', { universe: currentUniverse, username, config, equipped });
  }

  function switchUniverse(universeId) {
    if (universeId === currentUniverse && Object.keys(players).length) return;
    if (inVoice) leaveVoice();
    currentUniverse = universeId;
    applyTheme(universeId);
    ensureSocket();
    if (socket.connected) {
      socket.emit('lobby_leave');
      joinLobby();
    }
  }

  elUsername.addEventListener('change', () => {
    const username = (elUsername.value || '').trim() || getUsername();
    localStorage.setItem(KEY_USERNAME, username);
    if (socket && socket.connected && players[myId]) {
      players[myId].username = username;
      const nameEl = players[myId].el && players[myId].el.querySelector('.lobby-avatar-name');
      if (nameEl) nameEl.textContent = username;
      // On rejoint pour propager le nouveau pseudo aux autres
      socket.emit('lobby_leave');
      joinLobby();
    }
  });

  function clearPlayers() {
    Object.keys(players).forEach((id) => removePlayer(id));
  }

  function addPlayer(id, data, isSelf) {
    if (players[id]) {
      players[id].el.remove();
    }
    const el = document.createElement('div');
    el.className = 'lobby-avatar' + (isSelf ? ' is-self' : '');
    el.style.left = pctX(data.x) + '%';
    el.style.top = pctY(data.y) + '%';
    el.innerHTML = `
      <div class="lobby-avatar-figure"></div>
      <div class="lobby-voice-icon" style="display:${data.inVoice ? 'flex' : 'none'}">🎙️</div>
      <div class="lobby-avatar-name">${escapeHtml(data.username || '')}</div>
    `;
    elFloor.appendChild(el);

    const figure = el.querySelector('.lobby-avatar-figure');
    if (window.GGAvatar) {
      window.GGAvatar.mountAvatar(figure, data.config || window.GGAvatar.DEFAULT_CONFIG, data.equipped || {});
    }

    players[id] = { username: data.username, x: data.x, y: data.y, inVoice: !!data.inVoice, config: data.config, equipped: data.equipped, el };

    if (isSelf) {
      el.classList.add('is-self');
    }
  }

  function movePlayer(id, x, y) {
    const p = players[id];
    if (!p) return;
    p.x = x;
    p.y = y;
    p.el.style.left = pctX(x) + '%';
    p.el.style.top = pctY(y) + '%';
  }

  function removePlayer(id) {
    const p = players[id];
    if (!p) return;
    p.el.remove();
    delete players[id];
  }

  function updateVoiceIndicator(id) {
    const p = players[id];
    if (!p) return;
    const icon = p.el.querySelector('.lobby-voice-icon');
    if (icon) icon.style.display = p.inVoice ? 'flex' : 'none';
  }

  function updatePlayersCount() {
    const count = Object.keys(players).length;
    elPlayersCount.textContent = count <= 1
      ? 'Tu es seul ici pour le moment — sois le premier à lancer la conversation.'
      : `${count} joueurs présents dans ce lobby.`;
  }

  function pctX(x) {
    return Math.max(0, Math.min(100, (x / FLOOR_W) * 100));
  }
  function pctY(y) {
    return Math.max(0, Math.min(100, (y / FLOOR_H) * 100));
  }

  elFloor.addEventListener('click', (e) => {
    if (!socket || !socket.connected || !myId || !players[myId]) return;
    const rect = elFloor.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * FLOOR_W;
    const relY = ((e.clientY - rect.top) / rect.height) * FLOOR_H;
    const x = Math.max(20, Math.min(FLOOR_W - 20, relX));
    const y = Math.max(20, Math.min(FLOOR_H - 20, relY));
    movePlayer(myId, x, y);
    socket.emit('lobby_move', { x, y });
  });

  // --- Vocal de groupe (mesh WebRTC) ---

  function joinVoice() {
    ensureSocket();
    if (!socket.connected) return;
    voice = window.GGVoice.createVoiceManager(socket, {
      onConnectionStateChange: updateVoiceConnectionStatus
    });
    voice.getLocalStream().then(() => {
      inVoice = true;
      if (players[myId]) {
        players[myId].inVoice = true;
        updateVoiceIndicator(myId);
      }
      socket.emit('voice_join');
      elVoiceBtn.textContent = '🔇 Quitter le vocal';
      elVoiceBtn.classList.add('active');
      updateVoiceConnectionStatus();
    }).catch(() => {
      elVoiceStatus.textContent = "Impossible d'accéder au micro. Vérifie l'autorisation du navigateur.";
    });
  }

  // Affiche un statut réaliste du vocal : nombre de joueurs réellement connectés en audio,
  // pas juste "micro ouvert" (qui ne garantit pas que l'audio circule bien entre les deux pairs).
  function updateVoiceConnectionStatus() {
    if (!inVoice || !voice) return;
    const ids = Object.keys(voice.peers || {});
    if (ids.length === 0) {
      elVoiceStatus.textContent = 'Vocal activé — micro ouvert (en attente d’un autre joueur)';
      return;
    }
    const connected = ids.filter((id) => {
      const st = voice.peers[id] && voice.peers[id].iceConnectionState;
      return st === 'connected' || st === 'completed';
    });
    const failed = ids.filter((id) => {
      const st = voice.peers[id] && voice.peers[id].iceConnectionState;
      return st === 'failed';
    });
    if (connected.length > 0) {
      elVoiceStatus.textContent = `Vocal activé — connecté avec ${connected.length} joueur${connected.length > 1 ? 's' : ''}`;
    } else if (failed.length > 0) {
      elVoiceStatus.textContent = 'Connexion vocale impossible avec cet appareil (réseau trop restrictif). Réessaie ou change de réseau.';
    } else {
      elVoiceStatus.textContent = 'Vocal activé — connexion en cours...';
    }
  }

  function leaveVoice() {
    if (!inVoice) return;
    inVoice = false;
    if (socket && socket.connected) socket.emit('voice_leave');
    if (voice) voice.closeAll();
    voice = null;
    if (players[myId]) {
      players[myId].inVoice = false;
      updateVoiceIndicator(myId);
    }
    elVoiceBtn.textContent = '🎙️ Rejoindre le vocal';
    elVoiceBtn.classList.remove('active');
    elVoiceStatus.textContent = '';
  }

  elVoiceBtn.addEventListener('click', () => {
    if (inVoice) leaveVoice();
    else joinVoice();
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Init
  applyTheme(currentUniverse);
  ensureSocket();

  window.addEventListener('beforeunload', () => {
    if (inVoice && socket && socket.connected) socket.emit('voice_leave');
    if (socket && socket.connected) socket.emit('lobby_leave');
  });
})();
