// avatar.js — avatar 2D personnalisable (façon "Mii"/Sackboy) + inventaire boutique
// Tout est stocké en localStorage (pas de compte requis).

(function () {
  const KEY_CONFIG = 'ggmatch_avatar_config';
  const KEY_COINS = 'ggmatch_coins';
  const KEY_INVENTORY = 'ggmatch_inventory';
  const KEY_EQUIPPED = 'ggmatch_equipped';
  const KEY_LAST_CLAIM = 'ggmatch_last_claim';

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

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, read(KEY_CONFIG, {}));
  }

  function saveConfig(partial) {
    const current = getConfig();
    const next = Object.assign({}, current, partial);
    write(KEY_CONFIG, next);
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
    return total;
  }

  function spendCoins(amount) {
    const total = getCoins();
    if (total < amount) return false;
    write(KEY_COINS, total - amount);
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
    return true;
  }

  function getEquipped() {
    return read(KEY_EQUIPPED, { accessory: null, outfit: null });
  }

  function equipItem(item) {
    const eq = getEquipped();
    if (item.type === 'accessory') {
      eq.accessory = (eq.accessory && eq.accessory._id === item._id) ? null : item;
    } else if (item.type === 'outfit') {
      eq.outfit = (eq.outfit && eq.outfit._id === item._id) ? null : item;
    }
    write(KEY_EQUIPPED, eq);
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

  function renderAvatarSVG(config, equipped) {
    config = config || getConfig();
    equipped = equipped || getEquipped();
    const outfitColor = (equipped.outfit && equipped.outfit.color) || config.outfitColor;
    const accessoryIcon = equipped.accessory ? equipped.accessory.icon : null;

    return `
<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
  <ellipse cx="100" cy="232" rx="55" ry="8" fill="rgba(0,0,0,0.12)"/>
  <path d="M40 240 C 40 175, 60 150, 100 150 C 140 150, 160 175, 160 240 Z" fill="${outfitColor}"/>
  <circle cx="100" cy="80" r="48" fill="${config.skinTone}"/>
  ${eyesMarkup(config.eyes)}
  <path d="M85 112 Q 100 122 115 112" stroke="#7a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${hairPath(config.hairStyle, config.hairColor)}
  ${accessoryIcon ? `<text x="100" y="48" font-size="34" text-anchor="middle">${accessoryIcon}</text>` : ''}
</svg>`;
  }

  function mountAvatar(target, config, equipped) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.innerHTML = renderAvatarSVG(config, equipped);
  }

  window.GGAvatar = {
    PALETTES,
    DEFAULT_CONFIG,
    getConfig,
    saveConfig,
    getCoins,
    addCoins,
    spendCoins,
    claimDailyCoins,
    getInventory,
    ownsItem,
    unlockItem,
    getEquipped,
    equipItem,
    renderAvatarSVG,
    mountAvatar
  };
})();
