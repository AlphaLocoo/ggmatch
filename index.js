require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connecté');
    seedEvents();
    seedShopItems();
    seedBattlePass();
    seedFeaturedTournaments();
  })
  .catch((err) => console.error('Erreur connexion MongoDB:', err.message));

// Données de démarrage : tournois & lives par univers (modifiables ensuite via /admin.html)
async function seedEvents() {
  try {
    const count = await Event.countDocuments();
    if (count > 0) return;

    const seed = [
      // GGMatch — Gaming
      { universe: 'GGMatch', type: 'tournoi', title: 'Tournoi Valorant 5v5 — Saison Été', description: 'Tournoi communautaire en élimination directe, ouvert à tous les niveaux.', date: new Date('2026-06-14T20:00:00+02:00'), format: '5v5 · Simple élimination', prize: '500€ + skins exclusifs', host: 'Équipe GGMatch', link: '/?univers=GGMatch#jouer' },
      { universe: 'GGMatch', type: 'tournoi', title: 'Clash communautaire League of Legends', description: 'Affrontez d\'autres équipes de la communauté en BO1.', date: new Date('2026-06-21T19:00:00+02:00'), format: '5v5 · BO1', prize: 'Abonnements Pro offerts', host: 'Équipe GGMatch', link: '/?univers=GGMatch#jouer' },
      { universe: 'GGMatch', type: 'live', title: 'Coaching Diamond+ en direct avec ProGamer_Lex', description: 'Analyse de replays et conseils pour grimper en ranked.', date: new Date('2026-06-12T21:00:00+02:00'), format: 'Live Twitch', host: 'ProGamer_Lex', link: '/?univers=GGMatch#jouer' },
      { universe: 'GGMatch', type: 'live', title: 'Watch Party — Finale Esport Mondiale', description: 'Regardez la finale ensemble avec le chat communautaire.', date: new Date('2026-06-25T18:00:00+02:00'), format: 'Live communautaire', host: 'Équipe GGMatch', link: '/?univers=GGMatch#jouer' },

      // BeatMatch — Musique
      { universe: 'BeatMatch', type: 'tournoi', title: 'Beat Battle — Production Hip-Hop', description: 'Affrontez d\'autres producteurs sur un même thème, votes communautaires.', date: new Date('2026-06-15T20:00:00+02:00'), format: '1v1 · Battle de prods', prize: 'Mise en avant + pack samples', host: 'Équipe BeatMatch', link: '/?univers=BeatMatch#jouer' },
      { universe: 'BeatMatch', type: 'tournoi', title: 'Freestyle Cypher en ligne', description: 'Cypher ouvert, chacun son couplet, l\'ambiance avant tout.', date: new Date('2026-06-20T21:00:00+02:00'), format: 'Cypher collectif', prize: 'Featuring avec un artiste partenaire', host: 'Équipe BeatMatch', link: '/?univers=BeatMatch#jouer' },
      { universe: 'BeatMatch', type: 'live', title: 'Session Mix & Mastering avec DJ Nova', description: 'Démonstration en direct des techniques de mix.', date: new Date('2026-06-13T19:00:00+02:00'), format: 'Live', host: 'DJ Nova', link: '/?univers=BeatMatch#jouer' },
      { universe: 'BeatMatch', type: 'live', title: 'Jam acoustique communautaire', description: 'Session improvisée ouverte à tous les instruments.', date: new Date('2026-06-19T20:00:00+02:00'), format: 'Live', host: 'Équipe BeatMatch', link: '/?univers=BeatMatch#jouer' },

      // StudyMatch — Études
      { universe: 'StudyMatch', type: 'tournoi', title: 'Quiz Battle — Culture Générale', description: 'Quiz chronométré en équipes de deux.', date: new Date('2026-06-16T18:00:00+02:00'), format: 'Duo · Quiz chronométré', prize: 'Mois Pro offert', host: 'Équipe StudyMatch', link: '/?univers=StudyMatch#jouer' },
      { universe: 'StudyMatch', type: 'tournoi', title: 'Marathon Révisions Concours', description: 'Session longue durée en binômes, objectifs fixés ensemble.', date: new Date('2026-06-22T09:00:00+02:00'), format: 'Marathon Pomodoro', prize: 'Classement + badges', host: 'Équipe StudyMatch', link: '/?univers=StudyMatch#jouer' },
      { universe: 'StudyMatch', type: 'live', title: 'Masterclass méthode Pomodoro', description: 'Apprendre à structurer ses sessions de révision.', date: new Date('2026-06-14T17:00:00+02:00'), format: 'Live', host: 'Équipe StudyMatch', link: '/?univers=StudyMatch#jouer' },
      { universe: 'StudyMatch', type: 'live', title: 'Co-révision Médecine PASS', description: 'Salon vocal partagé pour réviser ensemble en direct.', date: new Date('2026-06-17T20:00:00+02:00'), format: 'Live', host: 'Communauté PASS', link: '/?univers=StudyMatch#jouer' },

      // TalkMatch — Langues
      { universe: 'TalkMatch', type: 'tournoi', title: 'Speed Language Exchange — 6 langues', description: 'Rotation de mini-conversations de 5 minutes.', date: new Date('2026-06-15T18:30:00+02:00'), format: 'Speed exchange', prize: 'Badge Polyglotte', host: 'Équipe TalkMatch', link: '/?univers=TalkMatch#jouer' },
      { universe: 'TalkMatch', type: 'tournoi', title: 'Concours d\'accent — Imitation native', description: 'Défi de prononciation jugé par la communauté.', date: new Date('2026-06-21T19:00:00+02:00'), format: 'Défi communautaire', prize: 'Mois Pro offert', host: 'Équipe TalkMatch', link: '/?univers=TalkMatch#jouer' },
      { universe: 'TalkMatch', type: 'live', title: 'Conversation Club Anglais', description: 'Discussion ouverte, tous niveaux bienvenus.', date: new Date('2026-06-13T18:00:00+02:00'), format: 'Live', host: 'Équipe TalkMatch', link: '/?univers=TalkMatch#jouer' },
      { universe: 'TalkMatch', type: 'live', title: 'Atelier culture & langue japonaise', description: 'Découverte culturelle et bases de conversation.', date: new Date('2026-06-18T19:30:00+02:00'), format: 'Live', host: 'Communauté JP', link: '/?univers=TalkMatch#jouer' },

      // GymMatch — Sport
      { universe: 'GymMatch', type: 'tournoi', title: 'Challenge Fitness 30 jours — Lancement', description: 'Inscriptions ouvertes pour le challenge collectif du mois.', date: new Date('2026-06-16T08:00:00+02:00'), format: 'Challenge collectif', prize: 'Pack équipement sportif', host: 'Équipe GymMatch', link: '/?univers=GymMatch#jouer' },
      { universe: 'GymMatch', type: 'tournoi', title: 'Tournoi Running virtuel 10km', description: 'Chacun court de son côté, classement en temps réel.', date: new Date('2026-06-23T09:00:00+02:00'), format: 'Course virtuelle', prize: 'Médaille digitale + Pro', host: 'Équipe GymMatch', link: '/?univers=GymMatch#jouer' },
      { universe: 'GymMatch', type: 'live', title: 'Cours collectif HIIT en direct', description: 'Séance guidée en direct, tous niveaux.', date: new Date('2026-06-12T18:30:00+02:00'), format: 'Live', host: 'Coach GymMatch', link: '/?univers=GymMatch#jouer' },
      { universe: 'GymMatch', type: 'live', title: 'Live Yoga matinal', description: 'Réveil en douceur avant la journée.', date: new Date('2026-06-14T07:30:00+02:00'), format: 'Live', host: 'Coach GymMatch', link: '/?univers=GymMatch#jouer' },

      // CreateMatch — Créatif
      { universe: 'CreateMatch', type: 'tournoi', title: 'Concours Design — Affiche thème "Futur"', description: 'Création libre sur le thème, votes communautaires.', date: new Date('2026-06-17T20:00:00+02:00'), format: 'Concours créatif', prize: 'Mise en avant + Pro', host: 'Équipe CreateMatch', link: '/?univers=CreateMatch#jouer' },
      { universe: 'CreateMatch', type: 'tournoi', title: 'Battle d\'illustration speedpaint', description: 'Une heure chrono pour illustrer le thème imposé.', date: new Date('2026-06-22T19:00:00+02:00'), format: 'Speedpaint · 1h', prize: 'Pack ressources premium', host: 'Équipe CreateMatch', link: '/?univers=CreateMatch#jouer' },
      { universe: 'CreateMatch', type: 'live', title: 'Live Drawing avec un illustrateur pro', description: 'Démonstration de technique en direct, questions ouvertes.', date: new Date('2026-06-13T20:00:00+02:00'), format: 'Live', host: 'Illustrateur invité', link: '/?univers=CreateMatch#jouer' },
      { universe: 'CreateMatch', type: 'live', title: 'Critique de portfolio en direct', description: 'Retours constructifs sur les portfolios envoyés.', date: new Date('2026-06-19T19:00:00+02:00'), format: 'Live', host: 'Équipe CreateMatch', link: '/?univers=CreateMatch#jouer' },
    ];

    await Event.insertMany(seed);
    console.log(`${seed.length} événements (tournois/lives) initialisés.`);
  } catch (e) {
    console.error('Erreur seed events:', e.message);
  }
}

// Articles cosmétiques de la boutique (avatar) — modifiables ensuite via /admin.html
// Le seed est appliqué via upsert (clé universe+slot) : on peut ajouter de nouveaux
// articles à tout moment sans dupliquer ni toucher aux objets déjà possédés.
async function seedShopItems() {
  try {
    const seed = [
      // GGMatch
      { universe: 'GGMatch', type: 'accessory', slot: 'headset', name: 'Casque gamer', description: 'Casque-micro RGB pour les sessions intenses.', price: 80, icon: '🎧' },
      { universe: 'GGMatch', type: 'accessory', slot: 'controller', name: 'Manette néon', description: 'Une manette qui brille dans le noir.', price: 100, icon: '🎮' },
      { universe: 'GGMatch', type: 'accessory', slot: 'trophy', name: 'Trophée MVP', description: 'La récompense des champions.', price: 130, icon: '🏆' },
      { universe: 'GGMatch', type: 'accessory', slot: 'mic', name: 'Micro streaming', description: 'Pour commenter tes meilleures actions.', price: 90, icon: '🎙️' },
      { universe: 'GGMatch', type: 'accessory', slot: 'crown', name: 'Couronne Champion', description: 'Réservée aux meilleurs joueurs.', price: 150, icon: '👑' },
      { universe: 'GGMatch', type: 'hairstyle', slot: 'hair-spiky-neon', name: 'Crête gamer', description: 'Coupe hérissée vert néon.', price: 110, icon: '⚡', value: 'spiky', color: '#00ff87' },
      { universe: 'GGMatch', type: 'hairstyle', slot: 'hair-long-neon', name: 'Mèches néon', description: 'Cheveux longs bleu cyan électrique.', price: 110, icon: '💠', value: 'long', color: '#00c8ff' },
      { universe: 'GGMatch', type: 'outfit', slot: 'jersey', name: 'Maillot Pro Gamer', description: 'Le style des équipes esport.', price: 120, color: '#7c3aed' },
      { universe: 'GGMatch', type: 'outfit', slot: 'hoodie', name: 'Hoodie esport', description: 'Confort et discrétion pour les longues sessions.', price: 100, color: '#1f2937' },
      { universe: 'GGMatch', type: 'outfit', slot: 'streamer-jacket', name: 'Veste streamer', description: 'Le look des créateurs de contenu.', price: 130, color: '#dc2626' },

      // BeatMatch
      { universe: 'BeatMatch', type: 'accessory', slot: 'headphones', name: 'Casque audio studio', description: 'Pour mixer comme un pro.', price: 80, icon: '🎧' },
      { universe: 'BeatMatch', type: 'accessory', slot: 'guitar', name: 'Guitare', description: 'Toujours prête pour un freestyle.', price: 110, icon: '🎸' },
      { universe: 'BeatMatch', type: 'accessory', slot: 'vinyl', name: 'Vinyle collector', description: 'Une pièce de collection qui en jette.', price: 90, icon: '💿' },
      { universe: 'BeatMatch', type: 'accessory', slot: 'mic-vintage', name: 'Micro vintage', description: 'Pour des sessions au charme rétro.', price: 100, icon: '🎤' },
      { universe: 'BeatMatch', type: 'accessory', slot: 'dj-cap', name: 'Casquette DJ', description: 'Le style derrière les platines.', price: 70, icon: '🧢' },
      { universe: 'BeatMatch', type: 'hairstyle', slot: 'hair-spiky-pink', name: 'Crête punk', description: 'Coupe hérissée rose flashy.', price: 110, icon: '🎀', value: 'spiky', color: '#ff3cac' },
      { universe: 'BeatMatch', type: 'hairstyle', slot: 'hair-buns-pop', name: 'Couettes pop', description: 'Deux couettes couleur magenta.', price: 100, icon: '🎵', value: 'buns', color: '#a83279' },
      { universe: 'BeatMatch', type: 'outfit', slot: 'jacket', name: 'Veste Rockstar', description: 'Look scène, prêt pour le live.', price: 120, color: '#ec4899' },
      { universe: 'BeatMatch', type: 'outfit', slot: 'stage-suit', name: 'Combinaison scène dorée', description: 'Pour briller sous les projecteurs.', price: 140, color: '#f59e0b' },
      { universe: 'BeatMatch', type: 'outfit', slot: 'band-tee', name: 'T-shirt groupe', description: 'Le merch de ton groupe préféré.', price: 90, color: '#1f2937' },

      // StudyMatch
      { universe: 'StudyMatch', type: 'accessory', slot: 'glasses', name: 'Lunettes intello', description: 'Pour mieux lire les annales.', price: 60, icon: '🤓' },
      { universe: 'StudyMatch', type: 'accessory', slot: 'book', name: 'Pile de livres', description: 'Révisions en cours.', price: 90, icon: '📚' },
      { universe: 'StudyMatch', type: 'accessory', slot: 'grad-cap', name: 'Toque de diplômé', description: 'Pour fêter la réussite.', price: 100, icon: '🎓' },
      { universe: 'StudyMatch', type: 'accessory', slot: 'calculator', name: 'Calculatrice', description: 'Indispensable pour les exams.', price: 70, icon: '🧮' },
      { universe: 'StudyMatch', type: 'accessory', slot: 'coffee', name: 'Café révision', description: 'Le carburant des longues sessions.', price: 60, icon: '☕' },
      { universe: 'StudyMatch', type: 'hairstyle', slot: 'hair-buns-studious', name: 'Chignon studieux', description: 'Pratique pour se concentrer.', price: 100, icon: '📌', value: 'buns', color: '#7a4a26' },
      { universe: 'StudyMatch', type: 'hairstyle', slot: 'hair-short-sage', name: 'Carré sage', description: 'Coupe courte et nette.', price: 80, icon: '✏️', value: 'short', color: '#1c1c1c' },
      { universe: 'StudyMatch', type: 'outfit', slot: 'sweater', name: 'Pull campus', description: 'Le confort avant tout.', price: 110, color: '#2563eb' },
      { universe: 'StudyMatch', type: 'outfit', slot: 'blazer', name: 'Blazer académique', description: 'Pour les grandes occasions.', price: 140, color: '#1e3a8a' },
      { universe: 'StudyMatch', type: 'outfit', slot: 'varsity', name: 'Veste universitaire', description: 'L\'esprit campus US.', price: 120, color: '#ffd60a' },

      // TalkMatch
      { universe: 'TalkMatch', type: 'accessory', slot: 'globe', name: 'Petit globe', description: 'Le monde entier à portée de main.', price: 90, icon: '🌍' },
      { universe: 'TalkMatch', type: 'accessory', slot: 'flags', name: 'Drapeaux du monde', description: 'Affiche les langues que tu parles.', price: 100, icon: '🏳️' },
      { universe: 'TalkMatch', type: 'accessory', slot: 'passport', name: 'Passeport tamponné', description: 'Les preuves de tes voyages.', price: 80, icon: '📔' },
      { universe: 'TalkMatch', type: 'accessory', slot: 'translate-headset', name: 'Casque traduction', description: 'Pour ne perdre aucun mot.', price: 100, icon: '🎧' },
      { universe: 'TalkMatch', type: 'accessory', slot: 'camera', name: 'Appareil photo voyage', description: 'Immortalise tes échanges.', price: 90, icon: '📷' },
      { universe: 'TalkMatch', type: 'hairstyle', slot: 'hair-long-traveler', name: 'Tresses voyageuses', description: 'Cheveux longs tressés.', price: 100, icon: '🧵', value: 'long', color: '#c98a3c' },
      { universe: 'TalkMatch', type: 'hairstyle', slot: 'hair-buzz-explorer', name: 'Bandana globe-trotter', description: 'Coupe courte façon explorateur.', price: 80, icon: '🧭', value: 'buzz', color: '#3b2417' },
      { universe: 'TalkMatch', type: 'outfit', slot: 'scarf', name: 'Écharpe voyageuse', description: 'Souvenir de tes échanges.', price: 110, color: '#f59e0b' },
      { universe: 'TalkMatch', type: 'outfit', slot: 'explorer-jacket', name: 'Veste explorateur', description: 'Prête pour l\'aventure.', price: 130, color: '#16a34a' },
      { universe: 'TalkMatch', type: 'outfit', slot: 'poncho', name: 'Poncho coloré', description: 'Un style venu d\'ailleurs.', price: 110, color: '#0891b2' },

      // GymMatch
      { universe: 'GymMatch', type: 'accessory', slot: 'dumbbell', name: 'Haltère', description: 'Toujours motivé.', price: 90, icon: '🏋️' },
      { universe: 'GymMatch', type: 'accessory', slot: 'headband', name: 'Bandeau de sport', description: 'Style et transpiration maîtrisée.', price: 60, icon: '🎽' },
      { universe: 'GymMatch', type: 'accessory', slot: 'medal', name: 'Médaille d\'or', description: 'La récompense de l\'effort.', price: 130, icon: '🥇' },
      { universe: 'GymMatch', type: 'accessory', slot: 'bottle', name: 'Gourde sport', description: 'Reste hydraté pendant l\'effort.', price: 60, icon: '🥤' },
      { universe: 'GymMatch', type: 'accessory', slot: 'smartwatch', name: 'Montre connectée', description: 'Suis tes performances.', price: 100, icon: '⌚' },
      { universe: 'GymMatch', type: 'hairstyle', slot: 'hair-long-sport', name: 'Queue de cheval sportive', description: 'Pratique pour bouger.', price: 90, icon: '🎗️', value: 'long', color: '#1c1c1c' },
      { universe: 'GymMatch', type: 'hairstyle', slot: 'hair-buzz-motiv', name: 'Crâne rasé motivé', description: 'Coupe courte et efficace.', price: 70, icon: '🔥', value: 'buzz', color: '#1c1c1c' },
      { universe: 'GymMatch', type: 'outfit', slot: 'tracksuit', name: 'Survêtement', description: 'Prêt pour la séance.', price: 120, color: '#16a34a' },
      { universe: 'GymMatch', type: 'outfit', slot: 'tank', name: 'Débardeur performance', description: 'Léger et respirant.', price: 100, color: '#dc2626' },
      { universe: 'GymMatch', type: 'outfit', slot: 'joggers', name: 'Jogging premium', description: 'Confort et style en salle.', price: 130, color: '#1f2937' },

      // CreateMatch
      { universe: 'CreateMatch', type: 'accessory', slot: 'palette', name: 'Palette de peinture', description: 'L\'inspiration à portée de main.', price: 90, icon: '🎨' },
      { universe: 'CreateMatch', type: 'accessory', slot: 'beret', name: 'Béret d\'artiste', description: 'Un classique indémodable.', price: 70, icon: '🧢' },
      { universe: 'CreateMatch', type: 'accessory', slot: 'brush', name: 'Pinceau magique', description: 'Pour les coups de génie.', price: 80, icon: '🖌️' },
      { universe: 'CreateMatch', type: 'accessory', slot: 'camera-art', name: 'Appareil photo', description: 'Capture tes meilleures idées.', price: 90, icon: '📸' },
      { universe: 'CreateMatch', type: 'accessory', slot: 'glasses-creative', name: 'Lunettes créatives', description: 'Vois le monde autrement.', price: 70, icon: '🕶️' },
      { universe: 'CreateMatch', type: 'hairstyle', slot: 'hair-spiky-rainbow', name: 'Mèches arc-en-ciel', description: 'Coupe hérissée violette éclatante.', price: 120, icon: '🌈', value: 'spiky', color: '#b57bee' },
      { universe: 'CreateMatch', type: 'hairstyle', slot: 'hair-long-artist', name: 'Crinière artiste', description: 'Cheveux longs roses vifs.', price: 110, icon: '✨', value: 'long', color: '#ec4899' },
      { universe: 'CreateMatch', type: 'outfit', slot: 'apron', name: 'Tablier créatif', description: 'Pour ne pas tacher tes habits.', price: 110, color: '#f97316' },
      { universe: 'CreateMatch', type: 'outfit', slot: 'overalls', name: 'Salopette créative', description: 'Look atelier décontracté.', price: 130, color: '#f97316' },
      { universe: 'CreateMatch', type: 'outfit', slot: 'print-jacket', name: 'Veste imprimée', description: 'Un motif unique, signé toi.', price: 120, color: '#7c3aed' },
    ];

    let inserted = 0;
    for (const item of seed) {
      const result = await ShopItem.updateOne(
        { universe: item.universe, slot: item.slot },
        { $setOnInsert: item },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
    }
    if (inserted > 0) console.log(`${inserted} nouveaux articles boutique ajoutés.`);
  } catch (e) {
    console.error('Erreur seed boutique:', e.message);
  }
}

// Génère les paliers du passe de combat pour un univers donné.
// 10 paliers, XP cumulée requise = palier * 150. Récompenses gratuites et premium en pièces,
// avec une icône à thème pour chaque palier (purement visuel pour l'instant).
function buildBattlePassTiers(universe, icons) {
  const tiers = [];
  for (let tier = 1; tier <= 10; tier++) {
    const icon = icons[(tier - 1) % icons.length];
    const freeCoins = 20 + tier * 10;
    const premiumCoins = freeCoins * 2 + 50;
    tiers.push({
      universe,
      tier,
      xpRequired: tier * 150,
      freeReward: { label: `${freeCoins} pièces`, icon, coins: freeCoins },
      premiumReward: { label: `${premiumCoins} pièces + ${icon}`, icon, coins: premiumCoins }
    });
  }
  return tiers;
}

// Passe de combat — paliers par univers (récompenses gratuites + premium)
async function seedBattlePass() {
  try {
    const seed = [
      ...buildBattlePassTiers('GGMatch', ['🎮', '🏆', '🎧', '⚡', '👑', '🔥', '💎', '🚀', '🥇', '🌟']),
      ...buildBattlePassTiers('BeatMatch', ['🎵', '🎤', '🎸', '💿', '🎧', '🔥', '💎', '🚀', '🥇', '🌟']),
      ...buildBattlePassTiers('StudyMatch', ['📚', '🎓', '✏️', '☕', '🧮', '🔥', '💎', '🚀', '🥇', '🌟']),
      ...buildBattlePassTiers('TalkMatch', ['🌍', '🏳️', '📔', '🧭', '📷', '🔥', '💎', '🚀', '🥇', '🌟']),
      ...buildBattlePassTiers('GymMatch', ['🏋️', '🥇', '⌚', '🎽', '💪', '🔥', '💎', '🚀', '🏅', '🌟']),
      ...buildBattlePassTiers('CreateMatch', ['🎨', '🖌️', '📸', '🧢', '🕶️', '🔥', '💎', '🚀', '🥇', '🌟']),
    ];

    let inserted = 0;
    for (const t of seed) {
      const result = await BattlePassReward.updateOne(
        { universe: t.universe, tier: t.tier },
        { $setOnInsert: t },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
    }
    if (inserted > 0) console.log(`${inserted} paliers de passe de combat ajoutés.`);
  } catch (e) {
    console.error('Erreur seed passe de combat:', e.message);
  }
}

// Grands tournois "Saison 1" — un par univers, avec cash prize, premier rendez-vous le 1er janvier 2027.
// Upsert par (universe, title) : peut être ajouté sans dupliquer même si la base existe déjà.
async function seedFeaturedTournaments() {
  try {
    const launchDate = new Date('2027-01-01T18:00:00+01:00');
    const seed = [
      { universe: 'GGMatch', type: 'tournoi', title: 'Grand Tournoi GGMatch — Saison 1', description: 'Le premier grand tournoi officiel GGMatch, ouvert à tous les niveaux. Inscriptions bientôt disponibles.', date: launchDate, format: 'Bracket multi-jeux · Élimination directe', prize: '1 000€ de cash prize', host: 'Équipe GGMatch', link: '/?univers=GGMatch#jouer', featured: true },
      { universe: 'BeatMatch', type: 'tournoi', title: 'Grand Battle BeatMatch — Saison 1', description: 'La première grande battle officielle BeatMatch, tous styles musicaux confondus.', date: launchDate, format: 'Battle · Votes communautaires', prize: '500€ de cash prize', host: 'Équipe BeatMatch', link: '/?univers=BeatMatch#jouer', featured: true },
      { universe: 'StudyMatch', type: 'tournoi', title: 'Grand Tournoi StudyMatch — Saison 1', description: 'Le premier grand tournoi de quiz et révisions par équipes StudyMatch.', date: launchDate, format: 'Duo · Quiz chronométré', prize: '500€ de cash prize', host: 'Équipe StudyMatch', link: '/?univers=StudyMatch#jouer', featured: true },
      { universe: 'TalkMatch', type: 'tournoi', title: 'Grand Tournoi TalkMatch — Saison 1', description: 'Le premier grand échange linguistique multi-langues TalkMatch, avec classement et récompenses.', date: launchDate, format: 'Speed exchange · Multi-langues', prize: '500€ de cash prize', host: 'Équipe TalkMatch', link: '/?univers=TalkMatch#jouer', featured: true },
      { universe: 'GymMatch', type: 'tournoi', title: 'Grand Challenge GymMatch — Saison 1', description: 'Le premier grand challenge fitness collectif GymMatch, classement en temps réel.', date: launchDate, format: 'Challenge collectif · Classement', prize: '500€ de cash prize', host: 'Équipe GymMatch', link: '/?univers=GymMatch#jouer', featured: true },
      { universe: 'CreateMatch', type: 'tournoi', title: 'Grand Concours CreateMatch — Saison 1', description: 'Le premier grand concours créatif CreateMatch, votes communautaires et mise en avant des gagnants.', date: launchDate, format: 'Concours créatif · Votes communautaires', prize: '500€ de cash prize', host: 'Équipe CreateMatch', link: '/?univers=CreateMatch#jouer', featured: true },
    ];

    let inserted = 0;
    for (const ev of seed) {
      const result = await Event.updateOne(
        { universe: ev.universe, title: ev.title },
        { $setOnInsert: ev },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
    }
    if (inserted > 0) console.log(`${inserted} grands tournois Saison 1 ajoutés.`);
  } catch (e) {
    console.error('Erreur seed grands tournois:', e.message);
  }
}

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  games: [String],
  plan: { type: String, default: 'free' },
  coins: { type: Number, default: 300 },
  avatarConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  inventory: { type: [String], default: [] },
  equipped: { type: mongoose.Schema.Types.Mixed, default: {} },
  battlePassXP: { type: mongoose.Schema.Types.Mixed, default: {} },
  battlePassPremium: { type: mongoose.Schema.Types.Mixed, default: {} },
  battlePassClaimed: { type: mongoose.Schema.Types.Mixed, default: {} },
  matchHistory: [{ universe: String, partner: String, date: { type: Date, default: Date.now } }],
  stripeCustomerId: String
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

// Tournois & Lives par univers
const EventSchema = new mongoose.Schema({
  universe: { type: String, required: true, index: true },
  type: { type: String, enum: ['tournoi', 'live'], required: true },
  title: String,
  description: String,
  date: Date,
  format: String,
  prize: String,
  host: String,
  link: String,
  status: { type: String, enum: ['upcoming', 'live', 'ended'], default: 'upcoming' },
  featured: { type: Boolean, default: false }
}, { timestamps: true });
const Event = mongoose.model('Event', EventSchema);

// Articles cosmétiques de la boutique (avatar)
const ShopItemSchema = new mongoose.Schema({
  universe: { type: String, required: true, index: true },
  type: { type: String, enum: ['accessory', 'hairstyle', 'outfit'], required: true },
  slot: String,
  name: String,
  description: String,
  price: Number,
  icon: String,
  color: String,
  value: String
}, { timestamps: true });
const ShopItem = mongoose.model('ShopItem', ShopItemSchema);

// Passe de combat — paliers par univers (récompenses gratuites + premium)
const BattlePassRewardSchema = new mongoose.Schema({
  universe: { type: String, required: true, index: true },
  tier: { type: Number, required: true },
  xpRequired: { type: Number, required: true },
  freeReward: {
    label: String,
    icon: String,
    coins: Number
  },
  premiumReward: {
    label: String,
    icon: String,
    coins: Number
  }
}, { timestamps: true });
BattlePassRewardSchema.index({ universe: 1, tier: 1 }, { unique: true });
const BattlePassReward = mongoose.model('BattlePassReward', BattlePassRewardSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Webhook Stripe — déclaré avant express.json() car Stripe exige le corps brut pour vérifier la signature
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook Stripe invalide:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const username = session.client_reference_id;
    if (username) {
      try {
        if (session.mode === 'subscription') {
          await User.findOneAndUpdate({ username }, { plan: 'pro' });
          console.log(`Abonnement Pro activé pour ${username}`);
        } else if (session.mode === 'payment' && session.metadata && session.metadata.universe) {
          const universe = session.metadata.universe;
          await User.findOneAndUpdate({ username }, { [`battlePassPremium.${universe}`]: true });
          console.log(`Passe premium ${universe} activé pour ${username}`);
        }
      } catch (e) {
        console.error('Erreur mise à jour utilisateur après paiement:', e.message);
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static('public'));

const queue = [];

// Lobby interactif : joueurs présents par univers (déplacement + vocal de groupe)
const lobbyPlayers = {}; // socket.id -> { universe, username, x, y, inVoice, config, equipped }
function lobbyRoomName(universe) {
  return `lobby_${universe}`;
}

// Protection simple des routes admin (clé définie via la variable d'environnement ADMIN_KEY)
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== (process.env.ADMIN_KEY || 'changeme')) {
    return res.status(401).json({ error: 'Clé admin invalide' });
  }
  next();
}

// Authentification par token (compte utilisateur)
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, process.env.SECRET || 'ggmatch_secret');
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
  }
}

// Tournois & Lives — lecture publique
app.get('/api/events', async (req, res) => {
  try {
    const { universe, type, featured } = req.query;
    const filter = {};
    if (universe) filter.universe = universe;
    if (type) filter.type = type;
    if (featured !== undefined) filter.featured = (featured === 'true');
    if (!req.headers['x-admin-key']) filter.status = { $ne: 'ended' };
    const events = await Event.find(filter).sort({ date: 1 }).limit(50);
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Tournois & Lives — gestion (admin)
app.post('/api/events', requireAdmin, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.json(event);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(event);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Boutique — lecture publique (catalogue d'articles cosmétiques pour l'avatar)
app.get('/api/shop', async (req, res) => {
  try {
    const { universe } = req.query;
    const filter = {};
    if (universe) filter.universe = universe;
    const items = await ShopItem.find(filter).sort({ universe: 1, type: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Boutique — gestion (admin)
app.post('/api/shop', requireAdmin, async (req, res) => {
  try {
    const item = new ShopItem(req.body);
    await item.save();
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/shop/:id', requireAdmin, async (req, res) => {
  try {
    const item = await ShopItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/shop/:id', requireAdmin, async (req, res) => {
  try {
    await ShopItem.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Passe de combat — lecture publique (paliers par univers)
app.get('/api/battlepass', async (req, res) => {
  try {
    const { universe } = req.query;
    const filter = {};
    if (universe) filter.universe = universe;
    const tiers = await BattlePassReward.find(filter).sort({ universe: 1, tier: 1 });
    res.json(tiers);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Passe de combat — gestion (admin)
app.post('/api/battlepass', requireAdmin, async (req, res) => {
  try {
    const tier = new BattlePassReward(req.body);
    await tier.save();
    res.json(tier);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/battlepass/:id', requireAdmin, async (req, res) => {
  try {
    const tier = await BattlePassReward.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(tier);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/battlepass/:id', requireAdmin, async (req, res) => {
  try {
    await BattlePassReward.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Inscription
app.post('/register', async (req, res) => {
  const { username, password, games } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Pseudo deja pris' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash, games });
    await user.save();
    res.json({ message: 'Compte cree !' });
  } catch(e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Mauvais mot de passe' });
    const token = jwt.sign({ username }, process.env.SECRET || 'ggmatch_secret', { expiresIn: '30d' });
    res.json({ token, username });
  } catch(e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Profil complet du joueur connecté (pièces, avatar, inventaire, passe de combat, historique)
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.username }).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mise à jour partielle du profil (synchronisation avec le client)
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const allowed = ['coins', 'avatarConfig', 'inventory', 'equipped', 'battlePassXP', 'battlePassPremium', 'battlePassClaimed'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const user = await User.findOneAndUpdate({ username: req.username }, update, { new: true, upsert: false }).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajoute une partie à l'historique du joueur (50 dernières conservées)
app.post('/api/profile/match', requireAuth, async (req, res) => {
  try {
    const { universe, partner } = req.body;
    const user = await User.findOneAndUpdate(
      { username: req.username },
      { $push: { matchHistory: { $each: [{ universe, partner, date: new Date() }], $slice: -50 } } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Calcule un score d'affinité entre deux joueurs en file d'attente
// selon les filtres choisis (jeu, niveau, langue, etc.) pour cet univers.
function matchScore(a, b) {
  let score = 0;
  const fa = a.filters || {};
  const fb = b.filters || {};

  if (a.game === 'TalkMatch') {
    // Échange linguistique croisé : ma langue cible = sa langue maternelle (et vice versa)
    if (fa.target && fb.native && fa.target === fb.native) score += 2;
    if (fa.native && fb.target && fa.native === fb.target) score += 2;
    return score;
  }

  for (const key of Object.keys(fa)) {
    if (fa[key] && fb[key] && fa[key] === fb[key]) score += 1;
  }
  return score;
}

// Matchmaking
io.on('connection', (socket) => {
  console.log('Joueur connecté:', socket.id);

  socket.on('find_match', (data) => {
    // Mode invité : aucun compte requis, un pseudo est généré si besoin
    socket.username = (data && data.username && data.username.trim()) || `Invité${Math.floor(1000 + Math.random() * 9000)}`;
    socket.game = (data && data.game) || 'Match';
    socket.filters = (data && data.filters) || {};

    if (!queue.includes(socket)) queue.push(socket);

    // On cherche le meilleur partenaire compatible déjà en attente sur cet univers
    const candidates = queue.filter((s) => s !== socket && s.game === socket.game);
    if (candidates.length > 0) {
      let best = candidates[0];
      let bestScore = matchScore(socket, best);
      for (const c of candidates.slice(1)) {
        const sc = matchScore(socket, c);
        if (sc > bestScore) { best = c; bestScore = sc; }
      }

      queue.splice(queue.indexOf(socket), 1);
      queue.splice(queue.indexOf(best), 1);

      const room = `room_${socket.id}_${best.id}`;
      socket.join(room);
      best.join(room);
      io.to(room).emit('match_found', {
        room,
        players: [socket.username, best.username],
        playerIds: [socket.id, best.id],
        game: socket.game,
        filters: { you: socket.filters, partner: best.filters }
      });
    }
  });

  socket.on('message', (data) => {
    io.to(data.room).emit('message', {
      from: socket.username,
      text: data.text
    });
  });

  socket.on('leave_queue', () => {
    const i = queue.indexOf(socket);
    if (i > -1) queue.splice(i, 1);
  });

  // --- Lobby interactif (déplacement par clic + vocal de groupe) ---

  socket.on('lobby_join', (data) => {
    const universe = (data && data.universe) || 'GGMatch';
    const username = (data && data.username && data.username.trim()) || `Invité${Math.floor(1000 + Math.random() * 9000)}`;
    const config = (data && data.config) || null;
    const equipped = (data && data.equipped) || null;

    leaveLobby(socket);

    const x = 80 + Math.random() * 740;
    const y = 80 + Math.random() * 320;
    socket.lobbyUniverse = universe;
    lobbyPlayers[socket.id] = { universe, username, x, y, inVoice: false, config, equipped };
    socket.join(lobbyRoomName(universe));

    const others = Object.entries(lobbyPlayers)
      .filter(([id, p]) => id !== socket.id && p.universe === universe)
      .map(([id, p]) => ({ id, username: p.username, x: p.x, y: p.y, inVoice: p.inVoice, config: p.config, equipped: p.equipped }));

    socket.emit('lobby_state', { self: { id: socket.id, x, y, username }, players: others });
    socket.to(lobbyRoomName(universe)).emit('lobby_player_joined', { id: socket.id, username, x, y, inVoice: false, config, equipped });
  });

  socket.on('lobby_move', (data) => {
    const p = lobbyPlayers[socket.id];
    if (!p || !data) return;
    p.x = data.x;
    p.y = data.y;
    socket.to(lobbyRoomName(p.universe)).emit('lobby_player_moved', { id: socket.id, x: p.x, y: p.y });
  });

  socket.on('lobby_leave', () => leaveLobby(socket));

  // Vocal de groupe (mesh WebRTC) : on annonce sa présence aux autres membres déjà en vocal
  socket.on('voice_join', () => {
    const p = lobbyPlayers[socket.id];
    if (!p) return;
    const peers = Object.entries(lobbyPlayers)
      .filter(([id, o]) => id !== socket.id && o.universe === p.universe && o.inVoice)
      .map(([id]) => id);
    p.inVoice = true;
    socket.emit('voice_peers', { peers });
    socket.to(lobbyRoomName(p.universe)).emit('voice_peer_joined', { id: socket.id });
  });

  socket.on('voice_leave', () => {
    const p = lobbyPlayers[socket.id];
    if (!p) return;
    p.inVoice = false;
    socket.to(lobbyRoomName(p.universe)).emit('voice_peer_left', { id: socket.id });
  });

  // Relais générique de signalisation WebRTC (lobby vocal de groupe + vocal 1v1 en match)
  socket.on('webrtc_signal', (data) => {
    if (!data || !data.to) return;
    io.to(data.to).emit('webrtc_signal', { from: socket.id, data: data.data });
  });

  socket.on('disconnect', () => {
    const i = queue.indexOf(socket);
    if (i > -1) queue.splice(i, 1);
    leaveLobby(socket);
  });
});

function leaveLobby(socket) {
  const p = lobbyPlayers[socket.id];
  if (!p) return;
  socket.to(lobbyRoomName(p.universe)).emit('lobby_player_left', { id: socket.id });
  socket.leave(lobbyRoomName(p.universe));
  delete lobbyPlayers[socket.id];
}

app.post('/create-checkout', requireAuth, async (req, res) => {
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId manquant' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: req.username,
      success_url: 'https://ggmatch-production.up.railway.app/?success=true',
      cancel_url: 'https://ggmatch-production.up.railway.app/?cancelled=true',
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Erreur Stripe:', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

// Achat du palier Premium du passe de combat (paiement unique, par univers)
const BATTLEPASS_PRICE_EUR = 4.99;
app.post('/create-battlepass-checkout', requireAuth, async (req, res) => {
  const { universe } = req.body;
  if (!universe) return res.status(400).json({ error: 'universe manquant' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(BATTLEPASS_PRICE_EUR * 100),
          product_data: { name: `Pass Saison Premium — ${universe}` }
        },
        quantity: 1
      }],
      client_reference_id: req.username,
      metadata: { universe },
      success_url: `https://ggmatch-production.up.railway.app/boutique.html?bp_premium=${encodeURIComponent(universe)}`,
      cancel_url: 'https://ggmatch-production.up.railway.app/boutique.html?cancelled=true',
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Erreur Stripe (passe de combat):', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GGMatch tourne sur http://localhost:${PORT}`);
});
