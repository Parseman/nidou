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
  components/
    auth/AuthPage.tsx        # Formulaire login (email/password)
    home/
      HomePage.tsx           # Layout principal (navbar + streak 🔥, hero, grille 2 cols, grille 2×2/4×1 raccourcis)
      NextMeetingCard.tsx    # Compte à rebours + barre de progression
      DefiLundi.tsx          # Défi du début de semaine (lun-mer, deadline mercredi suivant 23h59)
      CroustiMessage.tsx     # Messagerie temps réel (bulle flottante bas-droite)
      NidouChat.tsx          # Card cliquable (image nidou-cover.png) → page pet
      SettingsModal.tsx      # Modale paramètres : toggle notifs push + toggle dark mode
      CoinPot.tsx            # Carte pot commun (pièces accumulées selon happiness)
      DistanceCard.tsx       # Carte distance physique (géolocalisation + Haversine + Realtime)
      CroustiArt.tsx         # Dessin collaboratif : hue slider dégradé + gomme + 2 couleurs fixes
      PhotoGame.tsx          # Jeu Photo Duel : upload photo sur thème, vote 👍/👎, rotation 200 thèmes
    BattleGame.tsx         # Jeu Combat : items spawn 3-7h, inventaire, épée/bouclier/cœur, forge enclume, 2 canvas 3D (prisca.glb / cookie.glb)
    pet/
      PetPage.tsx            # Page dédiée Tamagotchi : 3 colonnes (actions | 3D | stats)
public/
  nidouchat-v1.glb          # Modèle 3D du chat (Poly Pizza) — utilisé dans PetPage
  prisca.glb                # Modèle 3D chat de Clément (Battle Game, côté gauche)
  cookie.glb                # Modèle 3D chat de Léona (Battle Game, côté droit)
  nidou-cover.png           # Illustration du chat dans le nid (card home)
  photo-duel-cover.png      # Image de fond de la card Photo Duel (page d'accueil)
  nidou-logo.png            # Logo doré "N" — favicon uniquement (pas dans l'app)
  sw.js                     # Service Worker pour les notifications push
supabase/
  migrations/               # SQL à exécuter manuellement dans le dashboard Supabase
  functions/
    notify-battle/          # Push événements Combat : item_spawned, item_claimed, battle_action
    send-push/              # Envoi notif push sur INSERT messages ou challenges (webhook)
    daily-reminder/         # Rappels défis 2×/jour (pg_cron 7h+13h UTC) + check coins chambre
    notify-pet/             # Alerte Discord si stats pet critiques
    check-pet-push/         # Push si bien-être global < 50 (pg_cron 15min, cooldown 3h)
    check-streak-push/      # Push 20h+23h Paris si user pas connecté aujourd'hui (streak en danger)
    notify-photo-game/      # Push événements Photo Duel : upload, vote dispo, résultats
    check-photo-game-push/  # Rappels Photo Duel upload/vote en retard (pg_cron matin 7h UTC)
```

## Navigation

`App.tsx` gère une state `page: 'home' | 'pet'` avec transition Framer Motion slide.
- `HomePage` reçoit `onGoToPet` → déclenche la navigation vers `PetPage`
- `PetPage` reçoit `onBack` → retour vers `HomePage`
- Pas de React Router — navigation par state simple

## Base de données

### `couple_settings`
| Colonne               | Type        | Notes                                      |
|-----------------------|-------------|--------------------------------------------|
| id                    | integer PK  | Toujours 1 (ligne unique)                  |
| next_meeting_date     | text        | Format YYYY-MM-DD                          |
| last_meeting_date     | text        | Format YYYY-MM-DD                          |
| coins                 | integer     | Pot commun, peut être négatif              |
| last_coin_update_at   | timestamptz | Timestamp du dernier règlement de pièces   |
| coin_rate             | integer     | +1 ou -1 selon happiness au dernier règlement |
| updated_at            | timestamptz |                                            |

RLS : authenticated users can read/write. Upsert avec `id: 1`.
Realtime : UPDATE subscription (pot commun live).

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
Realtime : UPDATE subscription (dans NidouChat.tsx et PetPage.tsx).

### `user_streaks`
| Colonne          | Type    | Notes                                   |
|------------------|---------|-----------------------------------------|
| user_id          | text PK | user.id Supabase                        |
| streak           | integer | Nombre de jours consécutifs de connexion |
| last_login_date  | date    | Date locale du dernier login (YYYY-MM-DD) |

RLS : chaque user lit/écrit uniquement sa propre ligne.

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
RPC `advance_photo_game()` : atomique (FOR UPDATE), avance si `done` ou `active + expiré > 3j`.

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
- **Durée** : 3 jours pour uploader sa photo (`active`, depuis `started_at`) ET 3 jours après la fin de partie (`done`, depuis `updated_at`) avant de passer automatiquement au thème suivant — pas de bouton manuel, un compte à rebours s'affiche et `advance_photo_game()` est appelé côté client dès expiration.
- **Statuts** :
  - `active` : en attente des photos (max 3 jours)
  - `voting` : les 2 photos sont là, on vote (pas de limite de temps)
  - `done` : les 2 votes enregistrés → compte à rebours de 3 jours avant le thème suivant (auto)
- **Votes** : `vote_1` = vote SUR photo_1 par l'uploader de photo_2 ; `vote_2` = inverse.
- **Avance atomique** : `advance_photo_game()` utilise `FOR UPDATE` pour éviter la double-avance si les deux users chargent la page simultanément.
- **Notifications** : edge function `notify-photo-game` appelée depuis le client après chaque action. Ciblage par `target_user_id` (uniquement le destinataire prévu) sauf `photo_uploaded` et `new_theme` où les deux joueurs doivent être notifiés (broadcast, aucun `target_user_id`/`exclude_user_id`, sauf pour `photo_uploaded` qui exclut l'uploader). Événements : premier upload → `photo_uploaded` (exclut l'uploader) ; second upload qui complète la paire → `partner_uploaded` (cible le premier uploader, jamais le second) ; vote posé (partie pas encore complète) → `vote_cast` (cible le partenaire, inclut `actor_name`/`liked`) ; second vote qui termine la partie → `game_done` (cible le partenaire) ; passage automatique au thème suivant (expiration `active` ou `done`) → `new_theme` (broadcast aux deux, envoyé uniquement par le client dont l'appel `advance_photo_game()` a réellement fait avancer la partie, pour éviter les doublons si les deux chargent l'app en même temps).

## Règles métier — Combat ⚔️

- **Spawn items** : `advance_battle_spawn()` RPC (atomique FOR UPDATE), appelé côté client au chargement. Délai aléatoire 3-7h entre chaque item. Types : épée, cœur, bouclier. Ligne unique `battle_spawn id=1`. Quand un item apparaît et `claimed_by IS NULL` → modal automatique. Une fois récupéré, l'autre ne peut plus l'avoir (UPDATE avec `.is('claimed_by', null)` atomique).
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
- **Notifications** : edge function `notify-battle`, appelée depuis le client. Types : `item_spawned`, `item_claimed`, `battle_action`. `item_spawned` envoyé par `checkSpawn()` (BattleGame.tsx) uniquement quand `advance_battle_spawn()` retourne `true` (nouvel item réellement apparu à cet appel, évite les doublons si les deux joueurs chargent l'app en même temps) — titre "Item apparu", description "{Item} vient d'apparaître ! Récupère-le avant l'autre."
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
- Les constantes (`DECAY_PER_HOUR`, `COOLDOWN_MS`, `BONUS`, types `PetRow`/`StatKey`/`AnimState`/`Mood`) sont exportées depuis `PetPage.tsx` et importées dans `NidouChat.tsx`

## Composants — points clés

### App.tsx
- State `page: 'home' | 'pet'` + `dir: number` pour animer le slide.
- Au login, si `Notification.permission === 'granted'`, appelle `registerPush` silencieusement.

### HomePage
- Navbar : logo 🪺 + "Nidou" + streak 🔥N + bouton Chambre + Paramètres + Déconnexion.
- Grille principale 2 colonnes : `NextMeetingCard`, `DefiLundi`, `CoinPot`, `DistanceCard`.
- Grille raccourcis 2×2 mobile / 4×1 desktop : `NidouChatIcon`, `CroustiArt`, `PhotoGame`, `Chambre`.
- `<CroustiMessage>` fixed bas-droite. `<SettingsModal>` déclenché par Paramètres.
- Props : `user`, `onSignOut`, `onGoToPet`, `onGoToRoom`.

### CoinPot
- **Règlement** au montage : calcule minutes depuis `last_coin_update_at`, applique `coin_rate`, écrit en base.
- **Display live** : `display = coins + rate * floor(elapsed_minutes)` — interval 60s sans écrire en base.
- Happiness > 50 → +1/min (badge vert), < 50 → −1/min (badge rouge). Valeur peut être négative.

### SettingsModal
- Section "Apparence" : toggle dark mode via `useTheme()`.
- Section "Notifications" : toggle push via `registerPush` / `unregisterPush`.

### DistanceCard
- Géolocalisation au montage → upsert `user_locations` → lecture toutes les lignes → calcul Haversine.
- `myPosRef` : stocke la position propre pour recalculer quand le Realtime reçoit la position du partenaire.
- Statuts : `loading` | `ok` | `no-partner` | `denied` | `unavailable`.

### CroustiArt
- Hue slider dégradé (pointer capture pour drag mobile/desktop) + 2 couleurs fixes (Noir, Blanc) + gomme.
- `colorRef` : ref vers la couleur courante (évite les re-renders sur chaque coup de crayon).

### PhotoGame
- Card compacte (aspectRatio 1/1, fond `public/photo-duel-cover.png`) ouvre une modale.
- Point rouge si action en attente (upload ou vote).
- Upload via `<input type="file" hidden>` → Storage `photo-game` → update `photo_game`.
- Vote : détermine `mySlot` (1 ou 2) depuis `photo_1/2_user_id`, écrit dans `vote_2` si slot 1 ou `vote_1` si slot 2.

### NidouChat.tsx (export : `NidouChatIcon`)
- Card cliquable avec `public/nidou-cover.png` en image de fond.
- Overlay gradient bas : nom "Nidou", humeur, 3 dots colorés.
- Badge `!` si une action est disponible.

### PetPage
- Page complète 3 colonnes sur desktop : Actions (w-64) | Canvas 3D (flex-1) | Stats (w-64).
- **3D** : `OrbitControls` (rotation libre, pas de zoom, pas de pan). Modèle `nidouchat-v1.glb`, scale `0.8`, caméra `[0, 0.3, 6]` fov `40`.
- Exports partagés : `calcStats`, `canAct`, `COOLDOWN_MS`, `DECAY_PER_HOUR`, `BONUS`, types.

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
- **`daily-reminder`** : `--no-verify-jwt`. pg_cron `0 7,13 * * *` (2×/jour). Rappels défis + check coins chambre.
- **`check-streak-push`** : `--no-verify-jwt`. pg_cron `0 18,21 * * *` (20h+23h Paris). Push si `last_login_date < today`.
- **`notify-photo-game`** : `--no-verify-jwt`. Appelée depuis le client. Types : `photo_uploaded` (exclut l'uploader, destinataire inconnu à l'avance), `partner_uploaded` (cible explicitement le premier uploader), `vote_cast` (cible le partenaire dont la photo vient d'être votée, prénom sans accents dans le titre), `game_done` (cible le partenaire quand les 2 votes sont là), `new_theme` (broadcast aux deux, envoyé uniquement par le client dont l'appel `advance_photo_game()` a réellement avancé la partie).
- **`check-photo-game-push`** : `--no-verify-jwt`. pg_cron `0 7 * * *` (le matin). Rappels pour ceux qui n'ont pas encore uploadé (`active`) ou pas encore voté (`voting`) : "Plus que 2 jours..." si 1-2 jours écoulés depuis `started_at`/`updated_at`, "VITE..." si 2-3 jours écoulés. Cible précisément les users manquants (roster via `auth.admin.listUsers()` pour l'upload, `vote_1`/`vote_2` null pour le vote) — n'avance pas la partie, ne fait que rappeler.
- **iOS** : Web Push nécessite d'ajouter l'app à l'écran d'accueil depuis Safari.

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
