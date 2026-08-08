# Nidou — CLAUDE.md

Application couple en distance longue. Deux utilisateurs, un espace partagé.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS 3 (`darkMode: 'class'`, classes custom : `glass-card`, `btn-primary`, `input-field`, `animate-blob`)
- Framer Motion (animations)
- Supabase (Auth + Postgres + Realtime + Storage)
- Lucide React (icônes)
- Three.js + React Three Fiber v8 + Drei (scène 3D du chat)

## Commandes

```bash
npm run dev      # serveur local
npm run build    # tsc + vite build
npm run preview  # preview du build
```

## Variables d'environnement

`.env` (ne pas commiter) :
```
VITE_SUPABASE_URL=https://xymhisdmffdgarabglne.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID>
```

À définir aussi dans **Vercel → Settings → Environment Variables** (le `.env` n'est pas déployé).

Secrets Supabase (Edge Functions → Secrets) :
```
VAPID_PUBLIC_KEY=<clé publique VAPID>
VAPID_PRIVATE_KEY=<clé privée VAPID>
```

Générer les clés VAPID : `npx web-push generate-vapid-keys`

## Architecture

```
src/
  App.tsx                    # Auth gate + navigation + auto-enregistrement push si permission déjà granted
  hooks/useAuth.ts           # session Supabase, signIn, signOut
  lib/supabase.ts            # createClient (anon key)
  lib/pushNotifications.ts   # registerPush, unregisterPush, getPushEnabled
  lib/useTheme.ts            # hook dark mode (lit/écrit localStorage nidou_dark_mode, toggle classe html.dark)
  lib/useStreak.ts           # hook streak : incrémente chaque nouveau jour, reset si jour sauté, upsert user_streaks
  lib/photoGameThemes.ts     # tableau THEMES[200] — thèmes du Photo Duel
  lib/photoGameSchedule.ts   # getRoundBoundaries() — calendrier fixe jeudi 00h00 → mardi 23h59 (Europe/Paris, DST-safe)
  lib/wallet.ts              # awardCoins(userId, amount) — RPC award_coins, crédite la bourse individuelle d'un user
  lib/marketItems.ts         # tableau MARKET_ITEMS[34] — catalogue du Marché (id, label, price, tier), prix fixes codés en dur
  components/
    auth/AuthPage.tsx        # Formulaire login (email/password)
    home/
      HomePage.tsx           # Layout principal (navbar + streak 🔥, hero, grille 4 cartes, bouton téléphone — toutes tailles d'écran)
      NextMeetingCard.tsx    # Compte à rebours + barre de progression
      TripProgress.tsx       # Barre de progression inline dans la navbar (entre le streak et le nom), toujours visible, % de progression affiché à droite ; trajet propre à chaque user, lecture seule
      DefiLundi.tsx          # Défi du début de semaine (lun-mer, deadline mercredi suivant 23h59)
      CroustiMessage.tsx     # Messagerie temps réel (bulle flottante bas-droite)
      NidouChat.tsx          # Card cliquable (image nidou-cover.png) → modale Tamagotchi (actions, 3D, stats), self-contained comme PhotoGame/BattleGame
      SettingsModal.tsx      # Modale paramètres : toggle notifs push + toggle dark mode
      PhoneModal.tsx         # Modale « téléphone », seul point d'entrée vers les jeux (toutes tailles d'écran) : plein écran sans bezel sur mobile/tablette, mockup de téléphone (bezel + encoche) sur PC
      CoinPot.tsx            # Carte bourse individuelle (pièces accumulées selon happiness + partenaire)
      DistanceCard.tsx       # Carte distance physique (géolocalisation + Haversine + Realtime)
      CroustiArt.tsx         # Dessin collaboratif : hue slider dégradé + gomme + 2 couleurs fixes
      PhotoGame.tsx          # Jeu Photo Duel : upload photo sur thème, vote 👍/👎, rotation 200 thèmes
    BattleGame.tsx         # Jeu Combat : items spawn 3-7h, inventaire, épée/bouclier/cœur, forge enclume, 2 canvas 3D (prisca.glb / cookie.glb)
    Marche.tsx             # Marché : achat de demandes à l'autre avec la bourse individuelle, self-contained comme PhotoGame/BattleGame (icône emoji, pas d'asset image)
public/
  nidouchat-v1.glb          # Modèle 3D du chat (Poly Pizza) — utilisé dans NidouChat.tsx
  prisca.glb                # Modèle 3D chat de Clément (Battle Game, côté gauche)
  cookie.glb                # Modèle 3D chat de Léona (Battle Game, côté droit)
  nidou-cover.png           # Illustration du chat dans le nid (card home)
  photo-duel-cover.png      # Image de fond de la card Photo Duel (page d'accueil)
  battle-cover.png          # Image de fond de la card Combat (page d'accueil)
  marche-cover.png          # Image de fond de la card Marché (PhoneModal)
  nidou-logo.png            # Logo doré "N" — favicon uniquement (pas dans l'app)
  sw.js                     # Service Worker pour les notifications push
supabase/
  migrations/               # SQL à exécuter manuellement dans le dashboard Supabase
  functions/
    notify-battle/          # Push événements Combat : item_spawned, item_claimed, battle_action
    notify-meeting-date/    # Push quand la date de prochaine retrouvaille est modifiée
    send-push/              # Envoi notif push sur INSERT messages ou challenges (webhook)
    daily-reminder/         # Rappels défis 2×/jour (pg_cron 7h+13h UTC)
    notify-pet/             # Alerte Discord si stats pet critiques
    check-pet-push/         # Push si bien-être global < 50 (pg_cron 15min, cooldown 3h)
    check-streak-push/      # Push 20h+23h Paris si user pas connecté aujourd'hui (streak en danger)
    notify-photo-game/      # Push événements Photo Duel : upload, vote dispo, résultats
    check-photo-game-push/  # Rappels Photo Duel upload/vote en retard (pg_cron matin 7h UTC)
    notify-market/          # Push événements Marché : item_purchased, item_fulfilled
```

## Navigation

Pas de page-level routing : `App.tsx` affiche uniquement `AuthPage` (déconnecté) ou `HomePage` (connecté).
Tous les jeux (Nidou, CroustiArt, Photo Duel, Combat) sont des modales self-contained ouvertes par-dessus `HomePage` — jamais de navigation qui démonte la page courante (important pour `PhoneModal`, voir plus bas).
- Pas de React Router — chaque composant gère son propre state `open`/`onClose`

## Base de données

### `couple_settings`
| Colonne               | Type        | Notes                                      |
|-----------------------|-------------|--------------------------------------------|
| id                    | integer PK  | Toujours 1 (ligne unique)                  |
| next_meeting_date     | text        | Format YYYY-MM-DD                          |
| last_meeting_date     | text        | Format YYYY-MM-DD                          |
| coins                 | integer     | **Obsolète** — ancien pot commun, remplacé par `user_wallet` |
| last_coin_update_at   | timestamptz | **Obsolète**                                |
| coin_rate             | integer     | **Obsolète**                                |
| updated_at            | timestamptz |                                            |

RLS : authenticated users can read/write. Upsert avec `id: 1`.
Les colonnes coins/last_coin_update_at/coin_rate ne sont plus lues ni écrites par le code (voir `user_wallet` ci-dessous) — conservées telles quelles en base pour éviter une migration destructive.

### `user_wallet`
| Colonne     | Type        | Notes                                |
|-------------|-------------|---------------------------------------|
| user_id     | text PK     | user.id Supabase                      |
| coins       | integer     | Solde individuel, peut être négatif   |
| updated_at  | timestamptz |                                       |

RLS : SELECT pour tous les authentifiés (affichage de la bourse du partenaire dans `CoinPot.tsx`), INSERT pour sa propre ligne, UPDATE ouvert à tous les authentifiés (les récompenses croisées — ex. défi validé par l'autre joueur — créditent le portefeuille du partenaire, comme `battle_state`).
Realtime : `postgres_changes` (`*`) — `CoinPot.tsx` distingue sa propre ligne de celle du partenaire via `user_id`.
RPC `award_coins(p_user_id, p_amount)` : upsert atomique (`INSERT ... ON CONFLICT DO UPDATE SET coins = coins + p_amount`), utilisé par `awardCoins()` (`src/lib/wallet.ts`) — **seule** source de mouvement de pièces (voir « Règles métier — Bourse individuelle »). Pas de règlement ambiant : les pièces ne s'accumulent pas passivement, uniquement via des actions.

### `messages`
| Colonne      | Type        | Notes                      |
|--------------|-------------|----------------------------|
| id           | text PK     |                            |
| sender_id    | text        | user.id Supabase           |
| sender_name  | text        | cache de first_name        |
| content      | text        |                            |
| created_at   | timestamptz |                            |

Realtime : INSERT subscription.

### `challenges`
| Colonne        | Type        | Notes                                                        |
|----------------|-------------|--------------------------------------------------------------|
| id             | text PK     |                                                              |
| created_by     | text        | user.id                                                      |
| creator_name   | text        | cache first_name                                             |
| title          | text        |                                                              |
| description    | text        | nullable                                                     |
| difficulty     | text        | easy / medium / hard / legendary                             |
| status         | text        | pending / proof_submitted / validated / rejected / completed |
| proof_url      | text        | URL Supabase Storage                                         |
| completed_by   | text        | user.id qui a soumis la preuve                               |
| completer_name | text        | cache first_name                                             |
| completed_at   | timestamptz |                                                              |
| deadline       | timestamptz | prochain mercredi 23h59 depuis la création                   |
| validated      | boolean     | true/false après décision du créateur                        |
| validated_at   | timestamptz |                                                              |
| validated_by   | text        | user.id                                                      |
| validator_name | text        | cache first_name                                             |
| created_at     | timestamptz |                                                              |

Storage : bucket `challenges`, chemin `{challenge_id}/{timestamp}.{ext}`.
Realtime : `postgres_changes` sur tous les events.

### `pet`
| Colonne                  | Type        | Notes                                              |
|--------------------------|-------------|----------------------------------------------------|
| id                       | integer PK  | Toujours 1 (ligne unique)                          |
| hunger                   | integer     | 0-100, valeur au moment de la dernière action      |
| hygiene                  | integer     | 0-100                                              |
| happiness                | integer     | 0-100                                              |
| last_fed_at              | timestamptz | timestamp du dernier nourrissage                   |
| last_washed_at           | timestamptz | timestamp du dernier lavage                        |
| last_pet_at              | timestamptz | timestamp du dernier câlin                         |
| last_notified_at         | timestamptz | anti-spam Discord (notify-pet)                     |
| last_happiness_push_at   | timestamptz | anti-spam push bien-être global < 50 (cooldown 3h) |
| updated_at               | timestamptz |                                                    |

RLS : authenticated users can read/write. Upsert avec `id: 1`.
Realtime : UPDATE subscription (dans NidouChat.tsx).

### `user_streaks`
| Colonne          | Type    | Notes                                   |
|------------------|---------|-----------------------------------------|
| user_id          | text PK | user.id Supabase                        |
| streak           | integer | Nombre de jours consécutifs de connexion |
| last_login_date  | date    | Date locale du dernier login (YYYY-MM-DD) |

RLS : chaque user lit/écrit uniquement sa propre ligne.

### `feedback_reports`
| Colonne     | Type        | Notes                                   |
|-------------|-------------|------------------------------------------|
| id          | text PK     | `gen_random_uuid()::text`                |
| user_id     | text        | user.id de l'auteur                      |
| author_name | text        | cache de first_name au moment de l'envoi |
| type        | text        | `bug` / `idea`                           |
| description | text        |                                          |
| created_at  | timestamptz |                                          |

RLS : SELECT pour tous les authentifiés, INSERT pour sa propre ligne (`user_id = auth.uid()`), DELETE ouvert à tous les authentifiés (les deux users gèrent ensemble la liste, comme `battle_state`/`user_wallet`). Pas de Realtime — lu au montage de `SettingsModal` (`fetchFeedback`), rafraîchi après chaque insert/delete.

### `user_locations`
| Colonne    | Type        | Notes                                  |
|------------|-------------|----------------------------------------|
| user_id    | text PK     | user.id Supabase                       |
| lat        | float8      | Latitude                               |
| lng        | float8      | Longitude                              |
| updated_at | timestamptz | Mis à jour à chaque ouverture de l'app |

RLS : SELECT pour tous les authentifiés, INSERT/UPDATE pour sa propre ligne.
Realtime : UPDATE subscription (DistanceCard recalcule dès que le partenaire sauvegarde).

### `photo_game`
| Colonne          | Type        | Notes                                                        |
|------------------|-------------|--------------------------------------------------------------|
| id               | integer PK  | Toujours 1 (ligne unique)                                    |
| theme_index      | integer     | Index dans THEMES[200], incrémenté à chaque nouveau tour     |
| started_at       | timestamptz | Début du tour courant                                        |
| photo_1_url      | text        | URL Storage du premier upload                                |
| photo_1_user_id  | text        | user.id du premier à avoir uploadé                           |
| photo_2_url      | text        | URL Storage du second upload                                 |
| photo_2_user_id  | text        | user.id du second                                            |
| vote_1           | boolean     | Vote SUR photo_1 (posé par l'uploader de photo_2)            |
| vote_2           | boolean     | Vote SUR photo_2 (posé par l'uploader de photo_1)            |
| status           | text        | active / voting / done                                       |
| updated_at       | timestamptz |                                                              |

Storage : bucket `photo-game` (public), chemin `{theme_index}/{user_id}/{timestamp}.{ext}`.
Realtime : UPDATE subscription.
RPC `advance_photo_game()` : atomique (FOR UPDATE), avance dès que `started_at` appartient à une semaine antérieure au jeudi 00h00 Paris courant (voir calendrier fixe ci-dessous) — archive d'abord le tour courant dans `photo_game_history` avant de réinitialiser la ligne.

### `photo_game_history`
| Colonne          | Type        | Notes                                                        |
|------------------|-------------|--------------------------------------------------------------|
| id               | serial PK   |                                                              |
| theme_index      | integer     | Index dans THEMES[200] du tour archivé                       |
| started_at       | timestamptz | Début du tour archivé                                        |
| ended_at         | timestamptz | Moment de l'archivage (= avance vers le tour suivant)         |
| photo_1_url      | text        |                                                              |
| photo_1_user_id  | text        |                                                              |
| photo_2_url      | text        |                                                              |
| photo_2_user_id  | text        |                                                              |
| vote_1           | boolean     |                                                              |
| vote_2           | boolean     |                                                              |

RLS : SELECT pour tous les authentifiés, écriture uniquement via `advance_photo_game()` (SECURITY DEFINER), jamais depuis le client.
Alimentée automatiquement par `advance_photo_game()` : chaque tour (même incomplet, sans photo) est archivé avant réinitialisation, pour un historique complet.
Consultée dans `PhotoGame.tsx` via le bouton historique (icône ☰) à côté du compte à rebours — modale listant thème, date, les 2 photos et les votes de chaque tour passé, la plus récente en premier.

### `user_trips`
| Colonne         | Type        | Notes                                              |
|-----------------|-------------|-----------------------------------------------------|
| user_id         | text PK     | user.id Supabase                                    |
| user_name       | text        | cache de first_name au moment de la sauvegarde       |
| departure_date  | text        | Format YYYY-MM-DD, date de départ propre à ce user   |
| arrival_date    | text        | Format YYYY-MM-DD, date d'arrivée propre à ce user   |
| updated_at      | timestamptz |                                                      |

RLS : SELECT pour tous les authentifiés (affichage de la progression du partenaire dans `TripProgress.tsx`), INSERT/UPDATE pour sa propre ligne (`user_id = auth.uid()::text`).
Realtime : `postgres_changes` (`*`) — chaque partenaire voit l'avancée de l'autre en temps réel.

### `market_purchases`
| Colonne      | Type        | Notes                                                        |
|--------------|-------------|--------------------------------------------------------------|
| id           | text PK     | `gen_random_uuid()::text`                                    |
| item_id      | text        | Référence l'`id` dans `MARKET_ITEMS` (`src/lib/marketItems.ts`) |
| item_label   | text        | Cache du libellé au moment de l'achat (résiste aux évolutions du catalogue) |
| price        | integer     | Prix payé, cache (résiste aux évolutions du catalogue)       |
| buyer_id     | text        | user.id de l'acheteur (celui qui paie et reçoit la demande réalisée) |
| buyer_name   | text        | Cache de first_name de l'acheteur                             |
| status       | text        | `pending` / `done`                                            |
| proof_url    | text        | URL Supabase Storage, nullable (preuve optionnelle)           |
| completed_at | timestamptz | nullable                                                      |
| created_at   | timestamptz |                                                              |

RLS : SELECT pour tous les authentifiés, INSERT pour sa propre ligne (`buyer_id = auth.uid()`), UPDATE ouvert à tous les authentifiés (c'est le partenaire, pas l'acheteur, qui marque la demande `done` — même logique que `battle_state`/`user_wallet`/`feedback_reports`).
Storage : bucket `market` (public), chemin `{purchase_id}/{timestamp}.{ext}`.
Realtime : `postgres_changes` (`*`).

## Règles métier — Défi du début de semaine

- **Création** : lundi, mardi ou mercredi uniquement. Sinon, message d'attente.
- **Deadline** : prochain mercredi à 23h59 depuis la date de création.
- **Flux de statuts** :
  1. `pending` — créé, en attente de preuve photo du destinataire
  2. `proof_submitted` — preuve soumise, le créateur doit valider
  3. `validated` / `rejected` — décision du créateur
- **Auto-validation** : si `proof_submitted` et deadline dépassée → `validated: true` (géré côté client dans `fetchChallenges`)
- **Difficulté** : Facile vert, Moyen bleu, Dur violet, Légendaire jaune-orange

## Règles métier — Photo Duel

- **Thèmes** : 200 thèmes dans `src/lib/photoGameThemes.ts`, sélectionné par `theme_index % 200`.
- **Calendrier fixe** (depuis le 2026-08-05, remplace l'ancien délai flottant de 3 jours) : chaque tour démarre le **jeudi à minuit heure de Paris** et la deadline pour uploader/voter est le **mardi suivant 23h59 heure de Paris**. Le **mercredi est un jour mort** : uploads et votes sont verrouillés côté client (`locked`), en attente du thème suivant qui ne démarre jamais avant le jeudi 00h00 suivant. Logique de calendrier partagée dans `src/lib/photoGameSchedule.ts` (`getRoundBoundaries()`, calcul DST-safe via `Intl` + `Europe/Paris`) côté client, et répliquée nativement en SQL (`AT TIME ZONE 'Europe/Paris'`, `EXTRACT(ISODOW ...)`) dans `advance_photo_game()`.
- **Statuts** :
  - `active` : en attente des photos — upload possible de jeudi 00h00 à mardi 23h59, verrouillé le mercredi
  - `voting` : les 2 photos sont là, on vote — même fenêtre (jeudi→mardi 23h59), verrouillé le mercredi
  - `done` : les 2 votes enregistrés → compte à rebours jusqu'au jeudi 00h00 suivant avant le thème suivant (auto)
- **Avance atomique** : `advance_photo_game()` (RPC, `FOR UPDATE`) n'avance que si `started_at` appartient à une semaine antérieure au jeudi 00h00 courant (Paris) — évite la double-avance si les deux users chargent la page simultanément, et fonctionne quel que soit le statut (`active` incomplet, `voting`, ou `done`) : un tour non terminé est silencieusement sauté au jeudi suivant.
- **Votes** : `vote_1` = vote SUR photo_1 par l'uploader de photo_2 ; `vote_2` = inverse.
- **Rappels** (`check-photo-game-push`) : basés sur le jour de la semaine (Paris), pas sur un delta de temps — mardi (dernier jour) → message urgent, lundi (avant-dernier jour) → rappel simple, mercredi → aucun rappel (jour mort).
- **Notifications** : edge function `notify-photo-game` appelée depuis le client après chaque action. Ciblage par `target_user_id` (uniquement le destinataire prévu) sauf `photo_uploaded` et `new_theme` où les deux joueurs doivent être notifiés (broadcast, aucun `target_user_id`/`exclude_user_id`, sauf pour `photo_uploaded` qui exclut l'uploader). Événements : premier upload → `photo_uploaded` (exclut l'uploader) ; second upload qui complète la paire → `partner_uploaded` (cible le premier uploader, jamais le second) ; vote posé (partie pas encore complète) → `vote_cast` (cible le partenaire, inclut `actor_name`/`liked`) ; second vote qui termine la partie → `game_done` (cible le partenaire) ; passage automatique au thème suivant (jeudi 00h00 franchi) → `new_theme` (broadcast aux deux). Déclenché exclusivement par le cron serveur `photo-game-advance-new-theme` (`*/15 * * * *`) — le client ne fait plus aucun appel à `advance_photo_game()` (retiré volontairement pour que le passage au thème suivant et sa notif ne dépendent jamais du fait que quelqu'un ouvre l'app ; ouvrir l'app ne doit jamais déclencher de notif). `PhotoGame.tsx` se contente de lire l'état courant (`select` + Realtime `postgres_changes` sur `UPDATE`) pour refléter l'avance faite par le cron.

## Règles métier — Combat ⚔️

- **Spawn items** : `advance_battle_spawn()` RPC (atomique FOR UPDATE). Délai aléatoire 3-7h entre chaque item. Types : épée, cœur, bouclier. Ligne unique `battle_spawn id=1`. Quand un item apparaît et `claimed_by IS NULL` → modal automatique. Une fois récupéré, l'autre ne peut plus l'avoir (UPDATE avec `.is('claimed_by', null)` atomique). Déclenché exclusivement par le cron serveur `battle-spawn-advance` (`*/15 * * * *`) — le client ne fait plus d'appel à `advance_battle_spawn()` (retiré volontairement, même raison que pour Photo Duel : l'apparition d'un item et sa notif ne doivent jamais dépendre du fait que quelqu'un ouvre l'app). `BattleGame.tsx` se contente de lire l'état courant (`loadSpawn()` : `select` + Realtime `postgres_changes` sur `UPDATE`) pour refléter l'avance faite par le cron.
- **Inventaire** : `battle_inventory`, privé (RLS own-only). Types : `sword`, `enhanced_sword`, `heart`, `shield`, `enhanced_shield`.
- **Forge** : 3 épées → 1 `enhanced_sword` (-5 PV) ; 3 boucliers → 1 `enhanced_shield` (3 charges + riposte).
- **Combat** : client-side avec mises à jour croisées (RLS UPDATE permet à tout authentifié de modifier n'importe quelle ligne de `battle_state`).
  - Épée normale vs sans bouclier : -1 PV
  - Épée améliorée vs sans bouclier : -5 PV
  - Épée normale vs bouclier normal : 0 dégât, bouclier brisé, +10 XP défenseur
  - Épée améliorée vs bouclier normal : -4 PV, bouclier brisé
  - Épée normale vs bouclier amélioré : 0 dégât, -1 PV attaquant (riposte), bouclier perd 1 charge, +10 XP défenseur
  - Épée améliorée vs bouclier amélioré : 0 dégât, les deux se brisent, +10 XP défenseur
- **XP** : +20 attaque, +5 soin, +10 blocage (accordé au défenseur lors de l'attaque). Level = `floor(xp/100) + 1`.
- **HP** : 0-10. Cœur = +1 PV (max 10), +5 XP.
- **Bouclier actif** : stocké dans `battle_state.shield_type` + `shield_charges` (1 pour normal, 3 pour amélioré). Activation = suppression de l'inventaire + écriture dans battle_state.
- **Visibilité** : `battle_state` public (HP, XP, bouclier visible des deux). `battle_inventory` privé.
- **Notifications** : edge function `notify-battle`. Types : `item_spawned`, `item_claimed`, `battle_action`. `item_claimed` et `battle_action` restent envoyés depuis le client (actions directes d'un joueur). `item_spawned` est envoyé exclusivement par le cron serveur `battle-spawn-advance`, uniquement quand `advance_battle_spawn()` retourne `true` (nouvel item réellement apparu à cet appel, évite les doublons) — titre "Item apparu", description "{Item} vient d'apparaître ! Récupère-le avant l'autre."
- **Modèles 3D** : `prisca.glb` = Clément, `cookie.glb` = Léona. Attribution par tri de `user_id` : le plus petit alphabétiquement = Prisca. Chaque joueur voit son propre chat à gauche. Noms affichés : "Prisca (Clément)" et "Cookie (Léona)". 2 canvas WebGL indépendants avec `OrbitControls` (zoom + rotation, pas de pan).

### `battle_state`
| Colonne         | Type        | Notes                                     |
|-----------------|-------------|-------------------------------------------|
| user_id         | text PK     | user.id Supabase                          |
| hp              | integer     | 0-10, PV actuels                          |
| xp              | integer     | XP total accumulé (level = floor/100 + 1) |
| shield_type     | text        | 'normal' \| 'enhanced' \| NULL            |
| shield_charges  | integer     | Charges restantes du bouclier             |
| updated_at      | timestamptz |                                           |

### `battle_inventory`
| Colonne    | Type        | Notes                                                        |
|------------|-------------|--------------------------------------------------------------|
| id         | uuid PK     |                                                              |
| user_id    | text        | user.id — RLS own-only                                       |
| item_type  | text        | sword / enhanced_sword / heart / shield / enhanced_shield    |
| created_at | timestamptz |                                                              |

### `battle_spawn`
| Colonne       | Type        | Notes                                        |
|---------------|-------------|----------------------------------------------|
| id            | integer PK  | Toujours 1                                   |
| item_type     | text        | sword / heart / shield                       |
| spawned_at    | timestamptz |                                              |
| claimed_by    | text        | user_id ou NULL                              |
| claimed_at    | timestamptz |                                              |
| next_spawn_at | timestamptz | spawned_at + 3-7h aléatoire                  |

## Règles métier — Streak 🔥

- `useStreak(user)` appelé au montage de `HomePage`.
- Lit `user_streaks`, compare `last_login_date` à la date locale (`sv-SE` locale = YYYY-MM-DD en heure locale).
- `diff = 0` → déjà connecté, pas de mise à jour. `diff = 1` → incrémente. `diff > 1` → reset à 1.
- Affiché à côté de "Nidou" dans la navbar : `🔥{streak}`.
- Push 20h et 23h Paris (crons 18h+21h UTC) via `check-streak-push` si `last_login_date < aujourd'hui`.

## Règles métier — Tamagotchi (pet)

- **Dégradation** : calculée côté client depuis les timestamps, jamais stockée directement.
  - Faim : -3/heure | Hygiène : -2/heure | Bonheur : -1.5/heure
- **Cooldowns** : Nourrir 4h, Laver 6h, Câliner 30min
- **Bonus par action** : +80 faim, +80 hygiène, +60 bonheur (plafonné à 100)
- **Humeur** (`Mood`) : `happy` si moyenne > 65, `sad` si < 30, sinon `normal`
- Les constantes (`DECAY_PER_HOUR`, `COOLDOWN_MS`, `BONUS`, types `PetRow`/`StatKey`/`AnimState`/`Mood`) et la logique (fetch, actions, 3D) sont toutes dans `NidouChat.tsx` (composant self-contained, plus de fichier séparé)

## Règles métier — Bourse individuelle 🪙

- Remplace l'ancien pot commun (`couple_settings.coins`) : chaque user a sa propre ligne dans `user_wallet`, créditée/débitée indépendamment.
- **Pas d'accumulation passive** : contrairement à l'ancien pot commun, les pièces ne s'accumulent plus toutes seules dans le temps (plus de ±1/min selon happiness du pet) — uniquement des récompenses ponctuelles sur action.
- **Récompenses ponctuelles** (via `awardCoins()`, `src/lib/wallet.ts` → RPC `award_coins`, atomique) :
  | Action | Récompense | Fichier |
  |---|---|---|
  | Câliner le pet | +5 | `NidouChat.tsx` (`act('happiness')`) |
  | Nourrir le pet | +20 | `NidouChat.tsx` (`act('hunger')`) |
  | Laver le pet | +20 | `NidouChat.tsx` (`act('hygiene')`) |
  | Participation Photo Duel (upload photo) | +50 | `PhotoGame.tsx` (`handleFile`) |
  | Attaque à l'épée (Combat) | +10 | `BattleGame.tsx` (`handleUseSword`) |
  | Défi hebdo validé — Facile | +10 | `DefiLundi.tsx` (`validateChallenge` + auto-validation à expiration) |
  | Défi hebdo validé — Moyen | +20 | idem |
  | Défi hebdo validé — Dur | +50 | idem |
  | Défi hebdo validé — Légendaire | +100 | idem |
- Le défi hebdo crédite `completed_by` (celui qui a relevé le défi), pas `user.id` du validateur — la validation peut donc créditer la bourse du partenaire (RLS `user_wallet_update_all` ouvert, comme `battle_state`).
- La participation Photo Duel ne récompense que l'upload (premier ou second slot), pas le vote.
- Pas de récompense pour le vote Photo Duel, le soin (cœur) ou l'activation de bouclier en Combat — seule l'attaque à l'épée en rapporte.
- Le Marché (voir « Règles métier — Marché ») est le seul **débit** volontaire de la bourse — tout le reste ne fait que créditer.

## Règles métier — Trajet ✈️ (barre de progression navbar)

- Barre affichée **dans la navbar**, entre le streak 🔥 et le nom/les boutons (`TripProgress.tsx`, `HomePage.tsx`), en plus de la barre existante de `NextMeetingCard` sur la page d'accueil — les deux coexistent, l'une ne remplace pas l'autre.
- Toujours visible dans la navbar (la ligne s'affiche même sans aucune donnée), même si aucun trajet n'est encore configuré — seuls les avatars et le % apparaissent/disparaissent selon les données disponibles, la structure de la barre ne dépend jamais du contenu de `user_trips`.
- Le % de progression du user courant (`myPct`, arrondi) est affiché en texte à droite de la ligne — pas celui du partenaire, qui reste uniquement visible via son avatar + tooltip sur la ligne.
- Chaque user configure **son propre** départ et son propre retour (`user_trips`, une ligne par user) — les deux dates sont indépendantes d'un user à l'autre (ex : l'un part avant l'autre, ou pour une durée de trajet différente), donc le pourcentage d'avancement (`(aujourd'hui - départ) / (retour - départ)`, borné 0-100) est propre à chacun même si affiché sur la même ligne.
- Représentation : un avatar rond avec l'initiale du prénom de chaque user (soi = dégradé rose, partenaire = dégradé violet), positionné sur la ligne selon son propre pourcentage. Si un user n'a pas encore configuré son trajet, son avatar n'apparaît simplement pas.
- `TripProgress.tsx` est **lecture seule** (fetch + Realtime `postgres_changes` sur `user_trips`, comme `CoinPot`) — aucune édition depuis la navbar.
- Édition : section "Ton trajet" dans `SettingsModal.tsx` (champs "Départ"/"Retour" + bouton Enregistrer), modifie uniquement le trajet du user courant (upsert `user_trips`, jamais celui du partenaire, cohérent avec la RLS own-row en écriture). La navbar se met à jour automatiquement via Realtime après l'enregistrement.
- Aucune notification, aucune récompense de pièces liée à ce trajet — purement visuel/informatif.
- ⚠️ Nécessite que la migration `20260808_user_trips.sql` ait été exécutée manuellement dans le dashboard Supabase (voir « Migrations SQL ») — sans elle, la barre reste vide (aucune erreur visible côté client, fetch/upsert échouent silencieusement en console).

## Règles métier — Marché 🛍️

- Catalogue de 34 demandes à prix fixe, codé en dur dans `MARKET_ITEMS` (`src/lib/marketItems.ts`), classé en 3 paliers de rareté (`MarketTier`) :
  - `frequent` (200-450 🪙) : petites attentions, photos/vidéos rapides — pensé pour rester accessible 2-3×/semaine.
  - `occasional` (600-900 🪙) : moments partagés, gages plus engageants — ~1×/semaine.
  - `rare` (2200-2600 🪙) : cartes postales, repas cuisiné précis, film ensemble, soirée à thème — pensé pour rester rare, 1-2×/mois.
- **Achat** (`Marche.tsx`, `buy()`) : débite immédiatement l'acheteur via `awardCoins(user.id, -item.price)` (négatif — la RPC `award_coins` gère aussi bien crédit que débit) et insère une ligne `market_purchases` (`status: 'pending'`). Bouton désactivé si le solde (`user_wallet.coins`, lu + Realtime) est insuffisant.
- **Réalisation** : le partenaire (jamais l'acheteur) marque la demande `done` depuis la section « Demandes reçues », avec une preuve photo optionnelle (upload Storage `market`, même pattern que `challenges`). Aucun mouvement de pièces à la réalisation — le paiement a déjà eu lieu à l'achat.
- Pas de délai/deadline imposé sur la réalisation (contrairement au défi hebdo) — la demande reste `pending` indéfiniment jusqu'à ce que le partenaire la traite.
- **Notifications** : edge function `notify-market`, deux types, tous deux en excluant l'auteur de l'action (`exclude_user_id`, jamais de lookup explicite de l'id du partenaire) : achat → `item_purchased` (cible le partenaire, qui doit réaliser la demande) ; réalisation → `item_fulfilled` (cible l'acheteur, dont la demande vient d'être honorée).

## Composants — points clés

### App.tsx
- Pas de state de page — rend directement `HomePage` une fois connecté (aucun composant ne démonte `HomePage`, tous les jeux sont des modales).
- Au login, si `Notification.permission === 'granted'`, appelle `registerPush` silencieusement.

### HomePage
- Navbar : logo 🪺 + "Nidou" + streak 🔥N, puis `TripProgress` (barre de trajet), puis nom + Paramètres + Déconnexion.
  - **PC (`sm:` et plus)** : tout sur une seule ligne, `TripProgress` au milieu (`sm:flex-1`) entre le streak et le nom.
  - **Mobile (< `sm`)** : `flex-wrap` sur le conteneur — `TripProgress` passe en pleine largeur (`w-full`) donc wrap automatiquement sur une 2e ligne sous logo/streak + nom/boutons (réordonnée en dernier via `order-3`, séparée par une bordure `border-t`). Un seul montage du composant (jamais dupliqué dans le DOM) — seul son wrapper change de largeur/ordre par breakpoint, pour éviter le piège realtime double-montage (voir `PhoneModal`).
- Grille principale : `NextMeetingCard`, `DefiLundi`, `CoinPot`, `DistanceCard` — 1 colonne mobile, 2 (`md`), 4 sur la même ligne en PC (`lg:grid-cols-4`, conteneur `lg:max-w-5xl`).
- Hero, cartes principales et footer sont en tailles compactes sur mobile (padding, marges, tailles de police réduites sans préfixe Tailwind) et retrouvent leur taille normale à partir de `md:` — objectif : limiter le scroll vertical sur mobile où les 4 cartes s'empilent en 1 colonne. Toute nouvelle carte ajoutée à cette grille doit suivre le même pattern (`p-4 md:p-6`, `mb-2 md:mb-4`, texte agrandi via `md:text-*` plutôt que par défaut).
- Accès à `PhoneModal` — seul point d'entrée vers les jeux (Nidou, CroustiArt, Photo Duel, Combat), qu'on soit sur mobile, tablette ou PC :
  - **PC (`lg:`)** : bouton "Ouvrir le téléphone" (icône `Smartphone`) en bas de la page, dans le flux normal (`hidden lg:flex`).
  - **Mobile/tablette (< `lg`)** : bulle flottante fixe en bas à gauche (`fixed bottom-6 left-6`, miroir de la bulle `CroustiMessage` à droite), icône `Smartphone` seule, toujours accessible sans scroller.
- `<CroustiMessage>` fixed bas-droite. `<SettingsModal>` déclenché par Paramètres.
- Props : `user`, `onSignOut`.

### PhoneModal
- Modale plein écran (overlay + clic dehors pour fermer, comme `SettingsModal` — sur mobile/tablette le backdrop est masqué puisque le contenu occupe déjà tout l'écran, fermeture uniquement via le bouton `X`) — **seul point d'entrée vers les jeux**, déclenchée par le bouton "Ouvrir le téléphone" de `HomePage` à toutes les tailles d'écran.
- Rendu responsive au sein du même JSX (classes `lg:` conditionnelles, pas de détection JS du breakpoint) :
  - **Mobile/tablette (< `lg`)** : plein écran, sans bezel ni encoche, fond dégradé identique à l'intérieur de l'écran du mockup PC ; en-tête avec titre "Mes jeux" + bouton fermer (`X`) puisqu'il n'y a pas de backdrop cliquable visible ; padding `env(safe-area-inset-top/bottom)` pour respecter l'encoche/la home indicator du vrai téléphone.
  - **PC (`lg:`)** : mockup de téléphone à taille fixe (bezel + encoche + `border`/`shadow`), comportement inchangé (clic sur le backdrop pour fermer).
- Écran du téléphone en `flex flex-col` : zone de contenu scrollable en haut (`flex-1 overflow-y-auto`) + dock fixe en bas (`shrink-0`, non scrollable).
- Zone de contenu : grille 2×2 des composants `NidouChatIcon`, `CroustiArt` (compact), `PhotoGame`, `BattleGame`, en mini-icônes façon écran d'accueil (icônes limitées à `max-w-[140px]` sur mobile/tablette, `w-[92px]` fixe sur PC, centrées dans leur cellule via `justify-items-center`). Chaque icône garde son comportement normal (ouvre sa propre modale plein écran par-dessus le téléphone).
- Dock du bas : bande séparée visuellement de la grille par une bordure (`border-t`) et un fond distinct (`bg-white/40 dark:bg-black/30 backdrop-blur-md`, glassmorphism), réservée aux futurs jeux/éléments prioritaires — vide pour le moment, en attente de contenu.
- ⚠️ Piège realtime : ces 4 composants montent chacun un channel Supabase avec un nom **fixe** en dur (ex. `'photo-game-rt'`). Or `supabase.channel(topic)` renvoie la **même instance** si un channel du même nom existe déjà (`RealtimeClient.channel()`), et rappeler `.on()` sur un channel déjà `subscribe()` **lève une exception synchrone** (`RealtimeChannel.on()` : `cannot add \`type\` callbacks... after \`subscribe()\``). Comme l'app n'a pas d'`ErrorBoundary`, ça fait planter tout React (écran vide) dès qu'une 2e instance du même composant est montée en parallèle. Depuis que `PhoneModal` est le seul point d'entrée vers les jeux (plus de grille raccourcis séparée sur `HomePage`), une seule instance de chaque composant est jamais montée à la fois — le risque de double montage ne peut plus survenir dans ce flux normal. **Fix conservé en défense** : chaque composant génère quand même un `useId()` et l'ajoute au nom du channel (ex. `` `photo-game-rt-${instanceId}` ``), pour que toute future utilisation en double montage d'un de ces composants suive le même pattern.

### CoinPot
- Affiche la **bourse individuelle** (`user_wallet`) : solde de l'utilisateur courant en grand, solde du partenaire en petit sous un séparateur.
- Purement en lecture : `select` au montage + subscription Realtime (`postgres_changes` sur `user_wallet`), pas d'écriture depuis ce composant.
- Aucune accumulation passive : le solde ne bouge que lorsqu'une récompense est créditée ailleurs (câlin, nourrir, bain, Photo Duel, Combat, défi hebdo) via `awardCoins()` (`src/lib/wallet.ts` → RPC `award_coins`).

### SettingsModal
- Section "Apparence" : toggle dark mode via `useTheme()`.
- Section "Ton trajet" : 2 champs date ("Départ"/"Retour") + bouton Enregistrer, upsert dans `user_trips` (own row) — seul point d'édition du trajet, affiché en lecture seule dans la navbar par `TripProgress.tsx`.
- Section "Notifications" : toggle push via `registerPush` / `unregisterPush`.
- Section "Idées & bugs" : seul point d'entrée pour signaler une idée ou un bug **et** pour consulter/supprimer la liste (pas de composant séparé). Bouton `+` révèle un formulaire inline (2 boutons Idée 💡/Bug 🐛 + `textarea` description) → insert dans `feedback_reports`. Liste en dessous (scrollable, `max-h-52`), la plus récente en premier, chaque entrée avec un bouton `Trash2` qui supprime immédiatement (pas de confirmation, cohérent avec le reste de l'app). Modale globale rendue scrollable (`max-h-[85vh] overflow-y-auto`) pour accueillir cette liste.

### DistanceCard
- Géolocalisation au montage → upsert `user_locations` → lecture toutes les lignes → calcul Haversine.
- `myPosRef` : stocke la position propre pour recalculer quand le Realtime reçoit la position du partenaire.
- Statuts : `loading` | `ok` | `no-partner` | `denied` | `unavailable`.

### CroustiArt
- Hue slider dégradé (pointer capture pour drag mobile/desktop) + 2 couleurs fixes (Noir, Blanc) + gomme.
- `colorRef` : ref vers la couleur courante (évite les re-renders sur chaque coup de crayon).

### PhotoGame
- Card compacte (aspectRatio 1/1, fond `public/photo-duel-cover.png`) ouvre une modale.
- Point rouge si action en attente (upload ou vote), masqué si `locked` (jour mort du mercredi).
- Upload via `<input type="file" hidden>` → Storage `photo-game` → update `photo_game`.
- Vote : détermine `mySlot` (1 ou 2) depuis `photo_1/2_user_id`, écrit dans `vote_2` si slot 1 ou `vote_1` si slot 2.
- Countdown + verrouillage (`locked`) calculés via `getRoundBoundaries()` (`src/lib/photoGameSchedule.ts`), recalculés à chaque tick (60s) : avant la deadline mardi 23h59 → countdown vers la deadline ; après (mercredi, verrouillé) ou en `done` → countdown vers le jeudi 00h00 suivant, moment où `advance_photo_game()` est appelé côté client.

### Marche.tsx
- Self-contained comme `PhotoGame`/`BattleGame` : card cliquable avec `public/marche-cover.png` en image de fond.
- Bulle rouge avec le nombre de demandes en attente (`pendingForMe.length`, plafonné à "9+") sur l'icône et à côté du titre de la section « Demandes reçues » dans la modale, dès qu'au moins une demande achetée par le partenaire attend d'être réalisée.
- Modale en 4 sections empilées : demandes reçues (à réaliser, avec bouton « Marquer comme fait » + upload photo optionnel), mes achats en attente (lecture seule, en attente que le partenaire les réalise), catalogue complet groupé par palier (`TIER_LABEL`), historique des demandes honorées.
- Solde affiché dans le header de la modale (`user_wallet.coins` de l'utilisateur courant, lu au montage + Realtime) — les boutons « Acheter » du catalogue se désactivent si le solde est insuffisant.

### NidouChat.tsx (export : `NidouChatIcon`)
- Self-contained comme `PhotoGame`/`BattleGame` : state `open` local, card cliquable avec `public/nidou-cover.png` en image de fond → ouvre une modale par-dessus le contexte courant (ne navigue jamais, donc reste au-dessus du `PhoneModal` s'il est ouvert).
- Card : overlay gradient bas (nom "Nidou", humeur, 3 dots colorés), badge `!` si une action est disponible.
- Modale : canvas 3D (`nidouchat-v1.glb`, scale `0.8`, caméra `[0, 0.3, 6]` fov `40`, `OrbitControls` rotation libre sans zoom/pan) + 3 actions (Nourrir/Laver/Câliner) + stats (barres Faim/Hygiène/Bonheur).
- Exports partagés : `calcStats`, `canAct`, `COOLDOWN_MS`, `DECAY_PER_HOUR`, `BONUS`, types `PetRow`/`StatKey`/`AnimState`/`Mood`.

## Dark mode

- `tailwind.config.js` : `darkMode: 'class'`.
- `index.html` : script inline anti-flash (lit `nidou_dark_mode` avant le rendu React).
- `src/index.css` : surcharges CSS pour `html.dark` (`.glass-card`, `.input-field`, body).
- `src/lib/useTheme.ts` : hook `useTheme()` → `{ dark, toggle }`.
- localStorage key : `nidou_dark_mode` (string `'true'`/`'false'`).

## Notifications push — architecture

- **Service Worker** : `public/sw.js` — reçoit les push et affiche les notifications. Icône : `nidou-logo.png`.
- **`src/lib/pushNotifications.ts`** : `registerPush` / `unregisterPush` / `getPushEnabled`.
- **Table `push_subscriptions`** : une ligne par appareil. RLS : chaque user gère ses propres lignes.
- **`send-push`** : `--no-verify-jwt`. Appelée par triggers Postgres (INSERT messages + challenges).
- **`check-pet-push`** : `--no-verify-jwt`. pg_cron `*/15 * * * *`. Push si bien-être < 50, cooldown 3h.
- **`daily-reminder`** : `--no-verify-jwt`. pg_cron `0 7,13 * * *` (2×/jour). Rappels défis.
- **`check-streak-push`** : `--no-verify-jwt`. pg_cron `0 18,21 * * *` (20h+23h Paris). Push si `last_login_date < today`.
- **`notify-battle`** : `--no-verify-jwt`. Appelée depuis le client (`BattleGame.tsx`) pour `item_claimed`/`battle_action`, et depuis le cron `battle-spawn-advance` pour `item_spawned`. Types : `item_spawned`, `item_claimed`, `battle_action`.
- **`notify-photo-game`** : `--no-verify-jwt`. Appelée depuis le client pour tous les types sauf `new_theme`, qui ne vient plus que du cron serveur. Types : `photo_uploaded` (exclut l'uploader, destinataire inconnu à l'avance), `partner_uploaded` (cible explicitement le premier uploader), `vote_cast` (cible le partenaire dont la photo vient d'être votée, prénom sans accents dans le titre), `game_done` (cible le partenaire quand les 2 votes sont là), `new_theme` (broadcast aux deux, envoyé uniquement par le cron `photo-game-advance-new-theme` — le client n'appelle plus jamais `advance_photo_game()`, pour garantir qu'ouvrir l'app ne déclenche jamais cette notif).
- **`check-photo-game-push`** : `--no-verify-jwt`. pg_cron `0 7 * * *` (le matin). Rappels pour ceux qui n'ont pas encore uploadé (`active`) ou pas encore voté (`voting`), basés sur le jour de la semaine (Paris) : lundi → "Plus qu'un jour...", mardi (dernier jour) → "VITE...", mercredi → aucun rappel (jour mort, verrouillé). Cible précisément les users manquants (roster via `auth.admin.listUsers()` pour l'upload, `vote_1`/`vote_2` null pour le vote) — n'avance pas la partie, ne fait que rappeler.
- **`photo-game-advance-new-theme`** (pg_cron, `*/15 * * * *`, pas une edge function) : seul déclencheur de l'avance de partie. Appelle `advance_photo_game()` puis POST directement vers `notify-photo-game` (`type: new_theme`) via `net.http_post` si la partie a réellement avancé. Le client (`PhotoGame.tsx`) ne fait plus cet appel lui-même (retiré volontairement) : il se contente de lire l'état via `select` + Realtime.
- **`battle-spawn-advance`** (pg_cron, `*/15 * * * *`, pas une edge function) : seul déclencheur de l'apparition des items de Combat. Appelle `advance_battle_spawn()` puis POST directement vers `notify-battle` (`type: item_spawned`, `item_type`) via `net.http_post` si un nouvel item est réellement apparu. Le client (`BattleGame.tsx`) ne fait plus cet appel lui-même (retiré volontairement, même logique que Photo Duel) : il se contente de lire l'état via `select` + Realtime (`loadSpawn()`).
- **`notify-meeting-date`** : appelée depuis le client (`NextMeetingCard.tsx`) après un `save()` réussi avec une `next_meeting_date` définie. Broadcast aux deux users (y compris l'auteur de la modification). Titre "Date mise à jour !", corps "Plus que X jours avant de se revoir..." (calculé côté client avec `daysRemaining()`, cas particuliers pour 0 et négatif).
- **`notify-market`** : `--no-verify-jwt`. Appelée depuis le client (`Marche.tsx`) uniquement — pas de cron, contrairement à Photo Duel/Combat, car l'achat et la réalisation sont toujours des actions directes d'un joueur. Types : `item_purchased` (exclut l'acheteur, cible le partenaire qui doit réaliser la demande), `item_fulfilled` (exclut celui qui vient de réaliser la demande, cible l'acheteur).
- **iOS** : Web Push nécessite d'ajouter l'app à l'écran d'accueil depuis Safari.
- **Convention fonctions appelées depuis le client** (`notify-battle`, `notify-photo-game`, `notify-meeting-date`, `notify-market` — fetch direct avec header `Authorization` custom, pas `supabase.functions.invoke`) : toujours déployer avec `--no-verify-jwt`. Sans ce flag, la gateway Supabase exige un JWT valide même sur le preflight CORS (`OPTIONS`, qui n'a jamais de header `Authorization`) et le rejette avant que la fonction ne s'exécute — le `fetch` échoue silencieusement côté client (catché en `non-bloquant`), sans notif ni erreur visible. Chaque fonction gère aussi explicitement `OPTIONS` (early return avec headers `Access-Control-Allow-*`) et n'a **jamais** de valeur par défaut correspondant à un vrai type de notif (le fallback doit tomber dans la branche "Type inconnu" / un guard de méthode, sinon un `OPTIONS` ou un body vide déclenche un vrai push).

## Migrations SQL

À exécuter dans le dashboard Supabase → SQL Editor (dans l'ordre) :

1. `20260507_couple_settings.sql` — table couple_settings + RLS
2. `20260507_challenges_rules.sql` — colonnes difficulty, deadline, validated, etc.
3. `20260507_pet.sql` — table pet + RLS
4. `20260510_push_subscriptions.sql` — table push_subscriptions + RLS
5. `20260511_coins.sql` — colonnes coins/last_coin_update_at/coin_rate + realtime
6. `20260511_pet_happiness_push.sql` — colonne last_happiness_push_at sur pet
7. `20260616_user_locations.sql` — table user_locations + RLS + realtime
8. `20260617_user_streaks.sql` — table user_streaks + RLS
9. `20260617_photo_game.sql` — table photo_game + bucket photo-game + RPC advance_photo_game
10. `20260617_streak_push_cron.sql` — crons 20h+23h streak (remplacer `<SERVICE_ROLE_KEY>`)
11. `20260616_challenge_reminder_cron.sql` — crons défis 2×/jour (remplacer `<SERVICE_ROLE_KEY>`)
12. `20260618_battle_game.sql` — tables battle_state, battle_inventory, battle_spawn + RPC advance_battle_spawn
13. `20260803_battle_spawn_notify_fix.sql` — `advance_battle_spawn()` renvoie désormais un booléen (nouvel item apparu ou non), pour permettre au client d'envoyer la notif `item_spawned` sans doublon
14. `20260803_photo_game_done_delay.sql` — `advance_photo_game()` attend désormais aussi 3 jours depuis `updated_at` quand `status = 'done'` (avant : avance immédiate)
15. `20260804_photo_game_reminder_cron.sql` — cron matin (7h UTC) pour `check-photo-game-push` (remplacer `<SERVICE_ROLE_KEY>`)
16. `20260805_photo_game_fixed_schedule.sql` — `advance_photo_game()` passe d'un délai flottant (3 jours) à un calendrier fixe : avance dès que `started_at` appartient à une semaine antérieure au jeudi 00h00 Paris courant, quel que soit le statut
17. `20260805_photo_game_new_theme_cron.sql` — cron `*/15 * * * *` (remplacer `<SERVICE_ROLE_KEY>`) qui appelle `advance_photo_game()` et envoie le push `new_theme` côté serveur si la partie a réellement avancé — le passage au thème suivant ne dépend plus d'un client ouvert au bon moment
18. `20260806_user_wallet.sql` — table `user_wallet` (bourse individuelle par user) + RLS + RPC `award_coins` (upsert atomique) + realtime ; remplace le pot commun `couple_settings.coins` (colonnes conservées mais plus utilisées)
19. `20260806_user_wallet_remove_rate.sql` — retire `last_coin_update_at`/`coin_rate` de `user_wallet` : plus de règlement ambiant, uniquement des récompenses ponctuelles
20. `20260806_remove_room_game.sql` — retrait du jeu "Ma Chambre" : drop des tables `rooms`/`room_purchases`, de la RPC `purchase_room_upgrade`, du trigger de notif associé et du cron `room-upgrade-reminder` (bucket Storage `room-photos` à supprimer manuellement dans le dashboard)
21. `20260808_battle_spawn_cron.sql` — cron `battle-spawn-advance` (`*/15 * * * *`, remplacer `<SERVICE_ROLE_KEY>`) qui appelle `advance_battle_spawn()` et envoie le push `item_spawned` côté serveur si un nouvel item est réellement apparu — l'apparition des items de Combat ne dépend plus d'un client ouvert au bon moment (même remède que `20260805_photo_game_new_theme_cron.sql` pour Photo Duel)
22. `20260808_photo_game_history.sql` — table `photo_game_history` (archive en lecture seule des tours Photo Duel passés) + RLS + `advance_photo_game()` modifiée pour archiver le tour courant avant réinitialisation — alimente le bouton historique de `PhotoGame.tsx`
23. `20260808_feedback_reports.sql` — table `feedback_reports` (idées/bugs signalés par les users) + RLS (lecture/suppression ouvertes aux deux, insert own) — alimente la section "Idées & bugs" de `SettingsModal.tsx`
24. `20260808_market.sql` — table `market_purchases` (achats de demandes via la bourse individuelle) + RLS (lecture ouverte, insert own, update ouvert) + realtime ; bucket Storage `market` à créer manuellement dans le dashboard (public, comme `challenges`/`photo-game`)
25. `20260808_user_trips.sql` — table `user_trips` (trajet départ/arrivée propre à chaque user) + RLS (lecture ouverte, insert/update own) + realtime — alimente la barre de progression `TripProgress.tsx` dans la navbar

## Conventions

- Langue de l'UI : **français**
- Palette : rose/violet avec glassmorphisme
- Polices : Varela Round (titres), Nunito Sans (corps) — Google Fonts dans `index.html`
- Titre onglet : `Nidou` (simple)
- Favicon : `nidou-logo.png` (logo doré "N") — pas utilisé dans l'app elle-même
- Pas de librairie de state management (tout en state local)
- Noms dans les métadonnées user : `user.user_metadata.first_name`
- `creator_name`, `sender_name`, etc. sont des **caches** du first_name au moment de l'action
- Les `id` des messages/défis sont des UUID Supabase (text), pas des integers
- localStorage : `nidou_messages_last_seen`, `nidou_dark_mode`
- Déploiement CLI Supabase : `npm install -g supabase` puis `supabase login` + `supabase link --project-ref xymhisdmffdgarabglne`
