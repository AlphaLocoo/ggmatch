const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static('public'));

const users = {};
const queue = [];
const SECRET = 'ggmatch_secret';

// Inscription
app.post('/register', async (req, res) => {
  const { username, password, games } = req.body;
  if (users[username]) return res.status(400).json({ error: 'Pseudo déjà pris' });
  const hash = await bcrypt.hash(password, 10);
  users[username] = { password: hash, games };
  res.json({ message: 'Compte créé !' });
});

// Connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Mauvais mot de passe' });
  const token = jwt.sign({ username }, SECRET);
  res.json({ token, username });
});

// Matchmaking
io.on('connection', (socket) => {
  console.log('Joueur connecté:', socket.id);

  socket.on('find_match', (data) => {
    socket.username = data.username;
    socket.game = data.game;
    queue.push(socket);

    if (queue.length >= 2) {
      const p1 = queue.shift();
      const p2 = queue.shift();
      const room = 'room_${p1.id}_${p2.id}';
      p1.join(room);
      p2.join(room);
      io.to(room).emit('match_found', {
        room,
        players: [p1.username, p2.username],
        game: p1.game
      });
    }
  });

  socket.on('message', (data) => {
    io.to(data.room).emit('message', {
      from: socket.username,
      text: data.text
    });
  });

  socket.on('disconnect', () => {
    const i = queue.indexOf(socket);
    if (i > -1) queue.splice(i, 1);
  });
});
app.post('/create-checkout', async (req, res) => {
  const { priceId } = req.body;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://ggmatch-production.up.railway.app/?success=true',
    cancel_url: 'https://ggmatch-production.up.railway.app/?cancelled=true',
  });
  res.json({ url: session.url });
});
server.listen(3000, () => {
  console.log('GGMatch tourne sur http://localhost:3000');
});