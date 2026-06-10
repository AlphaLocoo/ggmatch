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

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  games: [String],
  plan: { type: String, default: 'free' }
});
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
  status: { type: String, enum: ['upcoming', 'live', 'ended'], default: 'upcoming' }
}, { timestamps: true });
const Event = mongoose.model('Event', EventSchema);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static('public'));

const queue = [];

// Protection simple des routes admin (clé définie via la variable d'environnement ADMIN_KEY)
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== (process.env.ADMIN_KEY || 'changeme')) {
    return res.status(401).json({ error: 'Clé admin invalide' });
  }
  next();
}

// Tournois & Lives — lecture publique
app.get('/api/events', async (req, res) => {
  try {
    const { universe, type } = req.query;
    const filter = {};
    if (universe) filter.universe = universe;
    if (type) filter.type = type;
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
    const token = jwt.sign({ username }, process.env.SECRET || 'ggmatch_secret');
    res.json({ token, username });
  } catch(e) {
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

  socket.on('disconnect', () => {
    const i = queue.indexOf(socket);
    if (i > -1) queue.splice(i, 1);
  });
});

app.post('/create-checkout', async (req, res) => {
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId manquant' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://ggmatch-production.up.railway.app/?success=true',
      cancel_url: 'https://ggmatch-production.up.railway.app/?cancelled=true',
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Erreur Stripe:', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GGMatch tourne sur http://localhost:${PORT}`);
});
