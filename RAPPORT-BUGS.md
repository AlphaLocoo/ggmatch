# Rapport de tests — Parcours utilisateur GGMatch (production)

Site testé : https://ggmatch-production.up.railway.app/
Parcours couvert : inscription → matchmaking → lobby/vocal → univers (6 pages) → tournois/lives → boutique → paiement.

Ce rapport liste tous les bugs identifiés, classés par priorité, avec le fichier/ligne concerné et un correctif proposé.

---

## P0 — Critique (monétisation/paiement cassés) — ✅ CORRIGÉS

### 1. Les 3 CTA de la section Tarifs ne déclenchent aucun paiement — ✅ corrigé
Sur la page d'accueil, les boutons "S'abonner maintenant" (Premium 9€) et "Devenir Pro" (19€) faisaient tous `document.getElementById('jouer').scrollIntoView(...)` au lieu d'ouvrir un checkout.

- **Fichier** : `public/index.html`, section `id="pricing"`.
- **Correctif appliqué** : les deux boutons appellent désormais `subscribe('premium')` / `subscribe('pro')`. Le bouton gratuit conserve le scroll vers `#jouer`.

### 2. `/create-battlepass-checkout` échoue (401) — Pass Saison non achetable — ✅ corrigé
La route est protégée par `requireAuth`, mais le `fetch` côté client n'envoyait pas le header `Authorization: Bearer <token>`.

- **Fichier** : `public/boutique.html`, lignes ~336-352.
- **Correctif appliqué** : ajout de `'Authorization': 'Bearer ' + GGAuth.getToken()` ; si l'utilisateur n'est pas connecté, le modal de connexion s'ouvre désormais avant l'appel ; les erreurs renvoyées par le serveur sont affichées.

### 3. `subscribe()` / `/create-checkout` : code mort et buggé — ✅ corrigé
La fonction `subscribe(priceId)` contenait une faute de frappe sur l'URL (`'\create-checkout'`), n'envoyait pas le header d'autorisation, et n'était appelée par aucun bouton.

- **Fichiers** : `public/index.html` (fonction `subscribe`), `index.js` (route `/create-checkout`).
- **Correctif appliqué** :
  - `subscribe(plan)` corrige l'URL, ajoute le header `Authorization`, ouvre le modal de connexion si l'utilisateur n'est pas authentifié, et affiche un message d'erreur si le serveur en renvoie un.
  - `/create-checkout` accepte désormais `{ plan: 'premium' | 'pro' }` et résout le `priceId` Stripe via les variables d'environnement `STRIPE_PRICE_PREMIUM` / `STRIPE_PRICE_PRO` (l'ancien format `{ priceId }` reste accepté pour compatibilité).

**⚠️ Action requise côté configuration** : `STRIPE_PRICE_PREMIUM` et `STRIPE_PRICE_PRO` doivent être renseignés avec de vrais Price IDs Stripe (abonnements récurrents à 9€ et 19€) dans les variables d'environnement de production (Railway). Des valeurs placeholder ont été ajoutées dans `.env` local — sans price IDs réels configurés en prod, `/create-checkout` renverra une erreur explicite ("plan non configuré") au lieu d'échouer silencieusement.

---

## P1 — Majeur (expérience utilisateur dégradée)

### 4. Le pseudo du lobby est déconnecté du compte connecté — ✅ corrigé
Le lobby (`lobby.js`) utilisait sa propre clé `localStorage` (`ggmatch_lobby_username`), totalement indépendante du système d'authentification (`GGAuth` / `ggmatch_username` dans `auth.js`). Conséquences :
- Un utilisateur connecté avec un pseudo choisi à l'inscription se voyait attribuer un pseudo aléatoire type "Invité1234" dans le lobby, sans lien avec son compte.
- Si plusieurs comptes étaient utilisés dans le même navigateur, ils partageaient/écrasaient la même clé `ggmatch_lobby_username`.

- **Fichier** : `public/lobby.js`, fonction `getUsername()` (lignes 29-41).
- **Correctif appliqué** : `getUsername()` lit d'abord `ggmatch_username` (clé utilisée par `auth.js` pour le compte connecté) ; si présente, c'est le pseudo du compte qui est utilisé par défaut dans le lobby. Sinon, l'ancien comportement (génération/lecture de "Invité####" via `ggmatch_lobby_username`) est conservé pour les visiteurs non connectés. L'utilisateur peut toujours personnaliser son pseudo dans le champ du lobby.

### 5. Dialogues `alert()` bloquants dans la boutique — ✅ corrigé
Plusieurs actions de la boutique utilisaient `alert()` natif du navigateur (pièces insuffisantes, bonus journalier déjà réclamé, bonus XP déjà réclamé, erreur de paiement Pass Saison), ce qui bloquait l'interface et donnait une impression peu professionnelle.

- **Fichier** : `public/boutique.html`, `public/style.css`.
- **Correctif appliqué** : ajout d'un composant de notification "toast" non bloquant (`showToast()` + `.gg-toast-container`/`.gg-toast` en CSS, auto-disparition après 3s), et remplacement des 4 `alert()` concernés.

---

## P2 — Mineur (cosmétique / polish)

### 6. La barre de navigation fixe est transparente et se superpose au contenu — ✅ corrigé
`nav` est en `position: fixed` avec `z-index: 100` mais sans aucune propriété `background`/`background-color` (donc `rgba(0,0,0,0)`). Lors du scroll, le texte du hero ou d'autres sections passe sous la nav et devient illisible par superposition. Reproduit sur `ggmatch.html` (titre du hero, puis la ligne de stats) et `creatematch.html` (titre du hero).

- **Fichier** : `public/style.css`, ligne 27 (`nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; ... }`).
- **Correctif appliqué** : ajout de `background: rgba(5, 5, 7, 0.65); backdrop-filter: blur(12px);` (+ préfixe `-webkit-`), cohérent avec la couleur `--black` du design system.

### 7. Emplacement unique pour les accessoires d'avatar — ✅ corrigé
Le système d'équipement d'avatar ne permettait qu'un seul accessoire à la fois (pas de gestion par catégorie d'emplacement : chapeau, lunettes, etc. simultanément), ce qui limitait la personnalisation malgré les accessoires achetables en boutique.

- **Fichier** : `public/avatar.js`, `public/boutique.html`.
- **Correctif appliqué** : les accessoires sont désormais stockés dans `equipped.accessories` (objet indexé par `slot`), avec migration automatique depuis l'ancien format `equipped.accessory`. Plusieurs accessoires de slots différents (casque, couronne, trophée, etc.) peuvent être équipés simultanément, chacun affiché à une position dédiée sur l'avatar SVG. La boutique (`itemCardHTML`, `refreshEquipped`) reflète l'état "équipé" par accessoire individuellement.

---

## Points positifs (pour référence)

- Inscription, connexion, et matchmaking invité (recherche → état "recherche en cours" → annulation) fonctionnent correctement.
- Les 6 pages univers (GGMatch, BeatMatch, StudyMatch, TalkMatch, GymMatch, CreateMatch) affichent les bons titres/filtres de matchmaking et les bonnes sections "Tournois & Lives" (3 tournois + 2 lives à venir par univers, via `/api/events`).
- L'API publique `/api/events` fonctionne correctement pour les 6 univers.
- Le vocal de groupe en lobby (WebRTC mesh) affiche un statut de connexion réaliste (connecté / en attente / échec).

---

## Synthèse des priorités

| Priorité | Nombre de bugs | Statut | Thème |
|---|---|---|---|
| P0 | 3 | ✅ Corrigés (code) | Paiement / monétisation |
| P1 | 2 | ✅ Corrigés (code) | Identité utilisateur, UX boutique |
| P2 | 2 | ✅ Corrigés (code) | Polish visuel et personnalisation avatar |

**Statut** : les 7 bugs identifiés (3 P0, 2 P1, 2 P2) ont été corrigés dans le code.

**⚠️ Action restante avant mise en prod** : configurer `STRIPE_PRICE_PREMIUM` et `STRIPE_PRICE_PRO` (vrais Price IDs Stripe) dans les variables d'environnement Railway — sans cela, les abonnements Premium/Pro renverront une erreur explicite au lieu de fonctionner.
