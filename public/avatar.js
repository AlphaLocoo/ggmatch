// avatar.js — avatar 2D personnalisable (façon "Mii"/Sackboy) + inventaire boutique
// Tout est stocké en localStorage (pas de compte requis).

(function () {
  const KEY_CONFIG = 'ggmatch_avatar_config';
  const KEY_COINS = 'ggmatch_coins';
  const KEY_INVENTORY = 'ggmatch_inventory';
  const KEY_EQUIPPED = 'ggmatch_equipped';
  const KEY_LAST_CLAIM = 'ggmatch_last_claim';
  const KEY_PLAN = 'ggmatch_plan';
  const TOKEN_KEY = 'ggmatch_token';

  // Badges cosmétiques offerts automatiquement avec les abonnements Premium/Pro
  // (équipés dans le slot "badge" de l'avatar, visibles partout y compris en lobby).
  const PLAN_BADGES = {
    premium: { _id: 'badge_premium', type: 'accessory', slot: 'badge', name: 'Badge Premium', icon: '👑' },
    pro: { _id: 'badge_pro', type: 'accessory', slot: 'badge', name: 'Badge Pro', icon: '💎' }
  };

  const DEFAULT_CONFIG = {
    skinTone: '#f2c9a0',
    hairStyle: 'short',
    hairColor: '#3b2417',
    eyes: 'normal',
    outfitColor: '#4f46e5'
  };

  const PALETTES = {
    skinTones: ['#ffe0bd', '#f2c9a0', '#e0ac69', '#c68642', '#8d5524', '#5a3825'],
    hairColors: ['#1c1c1c', '#3b2417', '#7a4a26', '#c98a3c', '#e8c468', '#a83279', '#3b6ea5', '#e5e5e5'],
    outfitColors: ['#4f46e5', '#dc2626', '#16a34a', '#f59e0b', '#0891b2', '#7c3aed', '#ec4899', '#1f2937'],
    hairStyles: ['short', 'long', 'spiky', 'buzz', 'buns'],
    eyesStyles: ['normal', 'happy', 'sleepy', 'star']
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Synchronisation avec le compte (si connecté) ---

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Envoie l'état local complet (pièces, avatar, inventaire, passe de combat) vers le serveur.
  function pushProfile() {
    const token = getToken();
    if (!token) return Promise.resolve();
    return fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        coins: getCoins(),
        avatarConfig: getConfig(),
        inventory: getInventory(),
        equipped: getEquipped(),
        battlePassXP: read(KEY_BP_XP, {}),
        battlePassPremium: read(KEY_BP_PREMIUM, {}),
        battlePassClaimed: read(KEY_BP_CLAIMED, {})
      })
    }).catch(() => {});
  }

  function getPlan() {
    return read(KEY_PLAN, 'free');
  }

  // Équipe/retire automatiquement le badge cosmétique correspondant au plan
  // d'abonnement (👑 Premium / 💎 Pro), visible sur l'avatar partout (boutique, lobby).
  function applyPlanBadge(plan) {
    const eq = getEquipped();
    const badge = PLAN_BADGES[plan];
    const current = eq.accessories.badge;
    const isPlanBadge = current && (current._id === 'badge_premium' || current._id === 'badge_pro');
    let changed = false;
    if (badge && (!current || current._id !== badge._id)) {
      eq.accessories.badge = badge;
      changed = true;
    } else if (!badge && isPlanBadge) {
      delete eq.accessories.badge;
      changed = true;
    }
    if (changed) {
      write(KEY_EQUIPPED, eq);
      pushProfile();
    }
  }

  // Récupère le profil serveur après connexion : si le compte a déjà une progression,
  // elle remplace les données locales (invité) ; sinon la progression locale est envoyée au compte.
  function syncProfile() {
    const token = getToken();
    if (!token) return Promise.resolve();
    return fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then((res) => res.ok ? res.json() : null)
      .then((profile) => {
        if (!profile) return;
        write(KEY_PLAN, profile.plan || 'free');
        const hasServerData = (profile.inventory && profile.inventory.length > 0)
          || (profile.avatarConfig && Object.keys(profile.avatarConfig).length > 0)
          || (typeof profile.coins === 'number' && profile.coins !== 300);
        let result;
        if (hasServerData) {
          write(KEY_CONFIG, profile.avatarConfig || {});
          write(KEY_COINS, typeof profile.coins === 'number' ? profile.coins : getCoins());
          write(KEY_INVENTORY, profile.inventory || []);
          write(KEY_EQUIPPED, profile.equipped || {});
          write(KEY_BP_XP, profile.battlePassXP || {});
          write(KEY_BP_PREMIUM, profile.battlePassPremium || {});
          write(KEY_BP_CLAIMED, profile.battlePassClaimed || {});
        } else {
          result = pushProfile();
        }
        // Avantage Pro : le Pass Saison Premium est inclus sur tous les univers, même
        // pour un compte qui n'a pas encore de progression locale ("hasServerData" faux).
        if (profile.plan === 'pro' && profile.battlePassPremium) {
          write(KEY_BP_PREMIUM, profile.battlePassPremium);
        }
        applyPlanBadge(profile.plan);
        return result;
      })
      .catch(() => {});
  }

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, read(KEY_CONFIG, {}));
  }

  function saveConfig(partial) {
    const current = getConfig();
    const next = Object.assign({}, current, partial);
    write(KEY_CONFIG, next);
    pushProfile();
    return next;
  }

  function getCoins() {
    const c = read(KEY_COINS, null);
    if (c === null) {
      write(KEY_COINS, 300);
      return 300;
    }
    return c;
  }

  function addCoins(amount) {
    const total = getCoins() + amount;
    write(KEY_COINS, total);
    pushProfile();
    return total;
  }

  function spendCoins(amount) {
    const total = getCoins();
    if (total < amount) return false;
    write(KEY_COINS, total - amount);
    pushProfile();
    return true;
  }

  // Bonus quotidien : +50 pièces une fois par jour (visite de la boutique)
  function claimDailyCoins() {
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(KEY_LAST_CLAIM);
    if (last === today) return 0;
    localStorage.setItem(KEY_LAST_CLAIM, today);
    addCoins(50);
    return 50;
  }

  function getInventory() {
    return read(KEY_INVENTORY, []);
  }

  function ownsItem(itemId) {
    return getInventory().includes(itemId);
  }

  function unlockItem(item) {
    const inv = getInventory();
    if (inv.includes(item._id)) return true;
    if (!spendCoins(item.price)) return false;
    inv.push(item._id);
    write(KEY_INVENTORY, inv);
    pushProfile();
    return true;
  }

  // Les accessoires sont stockés par "slot" (casque, lunettes, trophée, ...) afin
  // de pouvoir en équiper plusieurs simultanément (ex: casque + couronne).
  function getEquipped() {
    const raw = read(KEY_EQUIPPED, {});
    const equipped = Object.assign({ accessories: {}, outfit: null, hairstyle: null }, raw);
    if (!equipped.accessories) equipped.accessories = {};
    // Migration depuis l'ancien format à accessoire unique (eq.accessory)
    if (raw.accessory && Object.keys(equipped.accessories).length === 0) {
      const slot = raw.accessory.slot || raw.accessory._id;
      equipped.accessories[slot] = raw.accessory;
    }
    delete equipped.accessory;
    return equipped;
  }

  function isAccessoryEquipped(itemId) {
    const eq = getEquipped();
    return Object.values(eq.accessories).some((it) => it && it._id === itemId);
  }

  function equipItem(item) {
    const eq = getEquipped();
    if (item.type === 'accessory') {
      const slot = item.slot || item._id;
      if (eq.accessories[slot] && eq.accessories[slot]._id === item._id) {
        delete eq.accessories[slot];
      } else {
        eq.accessories[slot] = item;
      }
    } else if (item.type === 'outfit') {
      eq.outfit = (eq.outfit && eq.outfit._id === item._id) ? null : item;
    } else if (item.type === 'hairstyle') {
      eq.hairstyle = (eq.hairstyle && eq.hairstyle._id === item._id) ? null : item;
    }
    write(KEY_EQUIPPED, eq);
    pushProfile();
    return eq;
  }

  // --- Rendu SVG ---

  function hairPath(style, hairColor) {
    switch (style) {
      case 'long':
        return `<path d="M58 70 C 50 30, 150 30, 142 70 L 148 150 C 138 130, 130 110, 130 90 L 130 70 C 130 50, 70 50, 70 70 L 70 90 C 70 110, 62 130, 52 150 Z" fill="${hairColor}"/>`;
      case 'spiky':
        return `<path d="M55 75 L40 35 L65 55 L75 20 L90 50 L100 15 L110 50 L125 20 L135 55 L160 35 L145 75 Z" fill="${hairColor}"/>`;
      case 'buzz':
        return `<path d="M55 70 C 55 35, 145 35, 145 70 L 145 60 C 145 30, 55 30, 55 60 Z" fill="${hairColor}"/>`;
      case 'buns':
        return `
          <circle cx="48" cy="45" r="14" fill="${hairColor}"/>
          <circle cx="152" cy="45" r="14" fill="${hairColor}"/>
          <path d="M58 70 C 55 35, 145 35, 142 70 Z" fill="${hairColor}"/>`;
      case 'short':
      default:
        return `<path d="M58 72 C 55 30, 145 30, 142 72 C 142 50, 58 50, 58 72 Z" fill="${hairColor}"/>`;
    }
  }

  function eyesMarkup(style) {
    switch (style) {
      case 'happy':
        return `
          <path d="M75 95 Q 83 85 91 95" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M109 95 Q 117 85 125 95" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      case 'sleepy':
        return `
          <line x1="75" y1="95" x2="93" y2="95" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
          <line x1="107" y1="95" x2="125" y2="95" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>`;
      case 'star':
        return `
          <text x="83" y="102" font-size="16" text-anchor="middle">⭐</text>
          <text x="117" y="102" font-size="16" text-anchor="middle">⭐</text>`;
      case 'normal':
      default:
        return `
          <circle cx="83" cy="93" r="5" fill="#1f2937"/>
          <circle cx="117" cy="93" r="5" fill="#1f2937"/>`;
    }
  }

  // Position des accessoires en fonction de leur TYPE (slot) plutôt que de
  // l'ordre dans lequel ils ont été équipés. Chaque slot d'objet appartient à
  // une catégorie (tête, visage, main, buste) qui détermine où il s'affiche
  // sur l'avatar, avec plusieurs emplacements disponibles par catégorie pour
  // éviter les superpositions quand plusieurs objets de la même catégorie
  // sont équipés en même temps.
  const SLOT_CATEGORY = {
    // Tête (au-dessus / sur la tête)
    crown: 'head', headset: 'head', headphones: 'head', 'dj-cap': 'head',
    'grad-cap': 'head', headband: 'head', beret: 'head', 'translate-headset': 'head',
    // Visage
    glasses: 'face', 'glasses-creative': 'face',
    // Mains / objets tenus
    controller: 'hand', mic: 'hand', guitar: 'hand', 'mic-vintage': 'hand',
    dumbbell: 'hand', palette: 'hand', brush: 'hand', camera: 'hand',
    'camera-art': 'hand', calculator: 'hand', vinyl: 'hand', book: 'hand',
    globe: 'hand', bottle: 'hand', smartwatch: 'hand',
    // Buste / accessoires décoratifs
    badge: 'chest', trophy: 'chest', medal: 'chest', flags: 'chest',
    passport: 'chest', coffee: 'chest'
  };

  const CATEGORY_POSITIONS = {
    head:  [{ x: 100, y: 46, size: 34 }],
    face:  [{ x: 100, y: 88, size: 26 }],
    hand: 