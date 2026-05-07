# Nidou — CLAUDE.md

Application couple en distance longue. Deux utilisateurs, un espace partagé.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS 3 (classes custom : `glass-card`, `btn-primary`, `input-field`, `animate-blob`)
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
```

## Architecture

```
src/
  App.tsx                    # Auth gate + navigation entre pages (home ↔ pet)
  hooks/useAuth.ts           # session Supabase, signIn, signOut
  lib/supabase.ts            # createClient (anon key)
  components/
    auth/AuthPage.tsx        # Formulaire login (email/password)
    home/
      HomePage.tsx           # Layout principal (navbar, hero, grille 2 cols, card Nidou)
      NextMeetingCard.tsx    # Compte à rebours + barre de progression
      DefiLundi.tsx          # Système de défis hebdomadaires
      CroustiMessage.tsx     # Messagerie temps réel (bulle flottante bas-droite)
      NidouChat.tsx          # Card cliquable (image nidou-cover.png) → page pet
    pet/
      PetPage.tsx            # Page dédiée Tamagotchi : 3 colonnes (actions | 3D | stats)
public/
  nidouchat-v1.glb          # Modèle 3D du chat (Poly Pizza)
  nidou-cover.png           # Illustration du chat dans le nid (card home)
supabase/migrations/        # SQL à exécuter manuellement dans le dashboard Supabase
```

## Navigation

`App.tsx` gère une state `page: 'home' | 'pet'` avec transition Framer Motion slide.
- `HomePage` reçoit `onGoToPet` → déclenche la navigation vers `PetPage`
- `PetPage` reçoit `onBack` → retour vers `HomePage`
- Pas de React Router — navigation par state simple

## Base de données

### `couple_settings`
| Colonne            | Type        | Notes                          |
|--------------------|-------------|--------------------------------|
| id                 | integer PK  | Toujours 1 (ligne unique)      |
| next_meeting_date  | text        | Format YYYY-MM-DD              |
| last_meeting_date  | text        | Format YYYY-MM-DD              |
| updated_at         | timestamptz |                                |

RLS : authenticated users can read/write. Upsert avec `id: 1`.

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
| deadline       | timestamptz | prochain lundi 23h59 depuis la création                      |
| validated      | boolean     | true/false après décision du créateur                        |
| validated_at   | timestamptz |                                                              |
| validated_by   | text        | user.id                                                      |
| validator_name | text        | cache first_name                                             |
| created_at     | timestamptz |                                                              |

Storage : bucket `challenges`, chemin `{challenge_id}/{timestamp}.{ext}`.
Realtime : `postgres_changes` sur tous les events.

### `pet`
| Colonne         | Type        | Notes                                        |
|-----------------|-------------|----------------------------------------------|
| id              | integer PK  | Toujours 1 (ligne unique)                    |
| hunger          | integer     | 0-100, valeur au moment de la dernière action |
| hygiene         | integer     | 0-100                                        |
| happiness       | integer     | 0-100                                        |
| last_fed_at     | timestamptz | timestamp du dernier nourrissage             |
| last_washed_at  | timestamptz | timestamp du dernier lavage                  |
| last_pet_at     | timestamptz | timestamp du dernier câlin                   |
| updated_at      | timestamptz |                                              |

RLS : authenticated users can read/write. Upsert avec `id: 1`.
Realtime : UPDATE subscription (dans NidouChat.tsx et PetPage.tsx).

## Règles métier — Défi du Lundi

- **Création** : uniquement le lundi. Sinon, message "Rendez-vous lundi 📅".
- **Deadline** : prochain lundi à 23h59 depuis la date de création.
- **Flux de statuts** :
  1. `pending` — créé, en attente de preuve photo du destinataire
  2. `proof_submitted` — preuve soumise, le créateur doit valider
  3. `validated` / `rejected` — décision du créateur
- **Auto-validation** : si `proof_submitted` et deadline dépassée → `validated: true` automatiquement (géré côté client dans `fetchChallenges`)
- **Difficulté** : choisie à la création (Facile vert, Moyen bleu, Dur violet, Légendaire jaune-orange)
- **Défi hérité** : les défis sans `deadline` sont gérés normalement ; la deadline est fixée au prochain lundi au moment de la soumission de la preuve.

## Règles métier — Tamagotchi (pet)

- **Dégradation** : calculée côté client depuis les timestamps, jamais stockée directement.
  - Faim : -3/heure
  - Hygiène : -2/heure
  - Bonheur : -1.5/heure
- **Actions** : stockent la nouvelle valeur + le timestamp dans Supabase. Mise à jour optimiste côté client.
- **Cooldowns** : Nourrir 4h, Laver 6h, Câliner 30min
- **Bonus par action** : +80 faim, +80 hygiène, +60 bonheur (plafonné à 100)
- **Humeur** (`Mood`) : `happy` si moyenne > 65, `sad` si < 30, sinon `normal`
- **Animations 3D** : `idle` (flottement selon humeur), `fed` (grossissement + rotation), `washed` (zigzag), `pet` (bonds + rotation)
- Les constantes (`DECAY_PER_HOUR`, `COOLDOWN_MS`, `BONUS`, types `PetRow`/`StatKey`/`AnimState`/`Mood`) sont exportées depuis `PetPage.tsx` et importées dans `NidouChat.tsx`

## Composants — points clés

### App.tsx
- State `page: 'home' | 'pet'` + `dir: number` pour animer le slide.
- `navigate(to)` : met à jour dir et page, déclenche la transition Framer Motion.

### HomePage
- Grille 2 colonnes (`max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2`) : NextMeetingCard + DefiLundi.
- Section centrée sous la grille : `NidouChatIcon` (card image → page pet).
- `<CroustiMessage>` rendu hors grille (bulle fixed bas-droite).
- Reçoit `onGoToPet` en prop.

### NidouChat.tsx (export : `NidouChatIcon`)
- Card cliquable avec `public/nidou-cover.png` en image de fond.
- Overlay gradient bas : nom "Nidou", humeur, 3 dots colorés (vert/orange/rouge).
- Badge `!` si une action est disponible.
- Charge les stats pet depuis Supabase + realtime UPDATE.

### NextMeetingCard
- Lit `couple_settings` au montage (`.maybeSingle()`).
- Upsert avec `{ id: 1, ... }`.
- Affiche : jours restants, barre de progression entre `last_meeting_date` et `next_meeting_date`, date longue FR.
- Gestion d'erreur visible en cas d'échec de l'upsert.

### CroustiMessage
- Bulle fixe bas-droite (`fixed bottom-6 right-6 z-40`), ouvre une modale.
- Badge rouge animé : messages reçus depuis `lastSeen` (localStorage `nidou_messages_last_seen`).
- `lastSeen` mis à jour à l'ouverture de la modale.
- Scroll auto vers le bas à l'ouverture et à chaque nouveau message.

### DefiLundi
- Preview card cliquable → modale `85vh`.
- Lightbox intégrée pour les photos preuve.
- `fetchChallenges` est async et gère l'auto-validation avant de mettre à jour le state.

### PetPage
- Page complète 3 colonnes sur desktop (lg:) : Actions (w-64) | Canvas 3D (flex-1) | Stats (w-64).
- Sur mobile : empilé verticalement.
- **3D** : `OrbitControls` (rotation libre persistante, pas de zoom, pas de pan). Modèle `nidouchat-v1.glb`, scale `0.8`, caméra `[0, 0.3, 6]` fov `40`.
- ⚙️ Pour ajuster le zoom : modifier `scale` sur `<primitive>` (ligne ~75) ou `position` de la caméra (ligne ~175).
- Exports partagés : `calcStats`, `canAct`, `COOLDOWN_MS`, `DECAY_PER_HOUR`, `BONUS`, types.

## Migrations SQL

À exécuter dans le dashboard Supabase → SQL Editor :

1. `supabase/migrations/20260507_couple_settings.sql` — table couple_settings + RLS
2. `supabase/migrations/20260507_challenges_rules.sql` — colonnes difficulty, deadline, validated, etc.
3. `supabase/migrations/20260507_pet.sql` — table pet + RLS

## Conventions

- Langue de l'UI : **français**
- Palette : rose/violet avec glassmorphisme
- Polices : Varela Round (titres), Nunito Sans (corps) — chargées depuis Google Fonts dans `index.html`
- Pas de librairie de state management (tout en state local)
- Noms dans les métadonnées user : `user.user_metadata.first_name`
- `creator_name`, `sender_name`, etc. sont des **caches** du first_name au moment de l'action (ne pas recalculer)
- Les `id` des messages/défis sont des UUID Supabase (text), pas des integers
- Pas de localStorage sauf `nidou_messages_last_seen` (timestamp de dernière lecture des messages)
