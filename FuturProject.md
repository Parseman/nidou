# FuturProject — Idées de concepts pour Nidou

Brainstorm de features pour augmenter l'usage quotidien de l'app. Classé par difficulté technique d'implémentation.

---

## 🟢 Niveau 1 — Facile (frontend + 1 table Supabase)

Pas de logique temps réel, pas de service externe, pas de jobs planifiés. Une table simple et un peu d'UI.

### 🎨 Humeur du jour
Un cercle de couleur / emoji choisi chaque jour. L'autre voit instantanément. Trois "rouges" d'affilée → Nidou propose une question ouverte douce.

- **Tables :** `daily_moods (user_id, date, mood, note)`
- **UI :** widget home (2 cercles côte à côte), historique sur 7j
- **Logique :** simple insert/upsert par jour, lecture pour les deux users
- **Why ça pousse au quotidien :** input minimal, output émotionnel max

### 🌦️ Météo des deux villes
Météo des deux côté à côte sur la home. Nidou propose une attention contextuelle ("il pleut chez elle → film cosy").

- **API :** Open-Meteo (gratuite, sans clé) ou OpenWeather
- **Tables :** `couple_settings.city_a`, `city_b` (déjà partiellement présent ?)
- **UI :** mini-widget hero, 2 lignes
- **Why :** sensation de présence passive, info nouvelle chaque jour

### 💌 Capsule temporelle
Écrire une lettre maintenant, scellée jusqu'à une date (par défaut : prochaines retrouvailles).

- **Tables :** `time_capsules (id, author_id, content, unlock_date, opened_at)`
- **UI :** form d'écriture + liste de capsules (verrouillées/déverrouillables), animation "ouverture"
- **Logique :** simple check `unlock_date <= today` côté client
- **Why :** cliquet vers le futur, anticipation

### 📓 Carnet des "à se dire"
Endroit privé pour noter ce qu'on veut dire en vrai. Révélé à l'autre lors des retrouvailles.

- **Tables :** `talk_notes (id, author_id, content, created_at, revealed_at)`
- **UI :** liste type "post-it", bouton "révéler à la prochaine date"
- **Logique :** un job côté client le jour J change `revealed_at` (ou simple check sur lecture)
- **Why :** garantit des sujets de qualité IRL, déculpabilise de ne pas tout dire à distance

### 🎁 Paliers J-7 / J-3 / J-1
Extensions du `NextMeetingCard` existant. Chaque palier débloque un rituel : wishlist d'activités, choix d'outfit, lettre cachée.

- **Tables :** `meeting_rituals (meeting_id, palier, completed_by, content)`
- **UI :** chips/cartes qui s'illuminent à mesure que la date approche
- **Logique :** purement basée sur `daysRemaining()` (déjà calculé dans `NextMeetingCard.tsx`)
- **Why :** maximise l'usage les 7 derniers jours avant retrouvailles

---

## 🟡 Niveau 2 — Moyen (jobs planifiés, push, état partagé)

Nécessite logique de fenêtre temporelle (jour qui change), push notifs, ou état dérivé pour les deux users.

### 🌙 Bonjour / Bonne nuit + streak partagée
Un bouton matin, un bouton soir. Streak commune qui casse si l'un des deux manque.

- **Tables :** `daily_checkins (user_id, date, morning_at, night_at)`, `couple_streak (current, longest, last_break_date)`
- **Logique :** edge function quotidienne qui recalcule la streak à minuit (timezone du couple à gérer), push reminder configurable
- **UI :** 2 boutons + grand compteur de streak en home
- **Risque :** timezone — il faut un timezone unique "couple" ou gérer les deux. Le mode "fenêtre tolérante" (ex: 6h-12h pour le matin) évite les bugs cross-timezone
- **Why :** **le levier n°1 de retention** (Duolingo, Snap Streaks). Le coût psychologique de casser la streak fait revenir.

### 🐣 Nidou nourri à deux
Le pet existant (`PetPage.tsx`) ne progresse QUE si les deux ont interagi dans la journée.

- **Tables :** ajouter `pet_state.last_fed_by_a`, `last_fed_by_b`, `xp`
- **Logique :** XP du pet incrémenté uniquement quand les deux entrées du jour sont présentes
- **UI :** indicateur "Nidou attend l'autre 🥺" / "Nidou est heureux ✨"
- **Why :** réutilise un asset existant, force la réciprocité sans culpabilité unilatérale

### 📸 Photo capsule 24h
Un slot photo par jour, qui disparaît après 24h.

- **Storage :** Supabase Storage avec policy d'expiration (ou cleanup job)
- **Tables :** `daily_photos (id, user_id, storage_path, expires_at, viewed_at)`
- **Logique :** edge function de cleanup quotidien, ou simple filtre `expires_at > now()` à la lecture
- **UI :** zone d'upload + viewer plein écran
- **Why :** FOMO doux, rareté = qualité

### 🆘 Mode "j'ai besoin de toi"
Bouton qui notifie l'autre sans contexte. L'autre bascule en "mode présence" (fond d'écran apaisant partagé).

- **Tables :** `emotional_pings (id, from_user, sent_at, responded_at)`
- **Logique :** push notif (déjà en place : `pushNotifications.ts`), UI overlay sur la home de l'autre
- **UI :** bouton discret (pas un gros bouton rouge, plutôt une fleur), mode présence = scène calme partagée
- **Why :** différenciateur émotionnel fort. Plus puissant qu'un sms "ça va pas"

### 🎯 Wishlist retrouvailles
Liste collaborative des choses à faire ensemble lors de la prochaine retrouvaille.

- **Tables :** `meeting_wishlist (id, meeting_id, author_id, item, voted_by_partner)`
- **UI :** liste type todo, swipe pour voter
- **Logique :** archivage automatique après la date passée → devient un "souvenir"
- **Why :** débloque à J-7 via les paliers, pousse à revenir pour vérifier les ajouts de l'autre

---

## 🔴 Niveau 3 — Difficile (temps réel, OAuth tiers, sync latence)

Websockets, intégrations tierces, ou synchronisation à la seconde.

### 🟢 Présence live + co-room
Point vert quand l'autre est dans l'app. Ouvre une scène partagée animée (pas de chat, juste co-présence).

- **Techno :** Supabase Realtime (channels presence)
- **Tables :** présence éphémère (pas en DB)
- **UI :** indicateur dans la nav, "co-room" = scène 3D partagée avec curseurs/avatars
- **Challenge :** gérer la déconnexion proprement, ne pas spammer le partenaire avec le point vert
- **Why :** la *vraie* présence asynchrone, ce que les LDR cherchent

### 💋 Bisou synchro
Bouton à presser dans une fenêtre de ~5s par les deux pour déclencher une anim partagée.

- **Techno :** Supabase Realtime broadcast, latence critique
- **Tables :** `kisses (id, initiated_at, completed_at)` pour le compteur mensuel
- **Challenge :** UX sans frustration (que faire si l'autre n'est pas dispo ?). Fallback : "bisou laissé en attente, à récupérer dans les 24h"
- **Why :** moment fort, mais demande coordination

### 🎧 Now Playing Spotify partagé
Voir en permanence ce que l'autre écoute. Bouton "ajouter à notre playlist".

- **API :** Spotify Web API (OAuth user, scope `user-read-currently-playing`)
- **Tables :** `spotify_tokens (user_id, access_token, refresh_token, expires_at)`, `shared_playlist_id`
- **Challenges :**
  - OAuth flow Spotify (callbacks, refresh tokens)
  - Polling toutes les 30s (ou webhook si dispo) → coût serveur
  - Gérer les utilisateurs sans compte Spotify Premium (l'API est limitée en Free)
- **Why :** sentiment de présence le plus naturel et passif

### 🎬 Soirée ciné synchro
Choisir un film/série, lancer la lecture en sync, réagir avec emojis live.

- **Techno :** WebRTC ou simple message bus pour les events (play/pause/seek)
- **Limites légales :** ne pas streamer le contenu (juste synchroniser les actions, l'utilisateur lance Netflix/Disney+ de son côté)
- **UX :** beaucoup d'edge cases (qui a la "main" sur le play, désync de lecture)
- **Why :** activité de couple à distance par excellence — mais Teleparty / Watch2Gether existent déjà, ROI à challenger

---

## 🧭 Recommandation de roadmap

Si je devais ordonner pour maximiser l'engagement quotidien avec un effort raisonnable :

1. **🌙 Bonjour / Bonne nuit + streak** *(Niveau 2)* → le moteur principal de retour quotidien
2. **🎨 Humeur du jour** *(Niveau 1)* → quick win, valeur affective immédiate
3. **🐣 Nidou nourri à deux** *(Niveau 2)* → réutilise un asset existant et créé la réciprocité
4. **🎁 Paliers J-7 / J-3 / J-1** *(Niveau 1)* → exploite la fonctionnalité phare existante
5. **🆘 Mode "j'ai besoin de toi"** *(Niveau 2)* → différenciateur émotionnel
6. Le reste selon l'envie / le retour utilisateur

---

## ⚠️ Points d'attention transversaux

- **Timezone du couple** : la plupart des features quotidiennes (streak, humeur, photo 24h) supposent une notion de "jour" partagée. Décider tôt : timezone unique configurable dans `couple_settings`, ou logique tolérante (fenêtres larges).
- **Quand l'un des deux est inactif** : ne pas culpabiliser celui qui est là. Privilégier "Nidou attend l'autre" plutôt que "ta partenaire t'a oublié".
- **Notifs** : `pushNotifications.ts` existe déjà — mais attention à ne pas saturer. Une notif/jour max par feature, avec opt-in granulaire dans `SettingsModal`.
- **Modèle de données couple** : voir si `couple_settings` actuel supporte bien le multi-utilisateur (relation user → couple → settings).
