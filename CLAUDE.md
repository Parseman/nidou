# Nidou — CLAUDE.md

Application couple en distance longue. Deux utilisateurs, un espace partagé.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS 3 (classes custom : `glass-card`, `btn-primary`, `input-field`, `animate-blob`)
- Framer Motion (animations)
- Supabase (Auth + Postgres + Realtime + Storage)
- Lucide React (icônes)

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
  App.tsx                  # Auth gate : loading → AuthPage | HomePage
  hooks/useAuth.ts         # session Supabase, signIn, signOut
  lib/supabase.ts          # createClient (anon key)
  components/
    auth/AuthPage.tsx      # Formulaire login (email/password)
    home/
      HomePage.tsx         # Layout principal (navbar, hero, grille 2 cols)
      NextMeetingCard.tsx  # Compte à rebours + barre de progression
      DefiLundi.tsx        # Système de défis hebdomadaires
      CroustiMessage.tsx   # Messagerie temps réel (bulle flottante)
supabase/migrations/       # SQL à exécuter manuellement dans le dashboard Supabase
```

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
| Colonne        | Type        | Notes                                              |
|----------------|-------------|----------------------------------------------------|
| id             | text PK     |                                                    |
| created_by     | text        | user.id                                            |
| creator_name   | text        | cache first_name                                   |
| title          | text        |                                                    |
| description    | text        | nullable                                           |
| difficulty     | text        | easy / medium / hard / legendary                   |
| status         | text        | pending / proof_submitted / validated / rejected / completed |
| proof_url      | text        | URL Supabase Storage                               |
| completed_by   | text        | user.id qui a soumis la preuve                     |
| completer_name | text        | cache first_name                                   |
| completed_at   | timestamptz |                                                    |
| deadline       | timestamptz | prochain lundi 23h59 depuis la création            |
| validated      | boolean     | true/false après décision du créateur              |
| validated_at   | timestamptz |                                                    |
| validated_by   | text        | user.id                                            |
| validator_name | text        | cache first_name                                   |
| created_at     | timestamptz |                                                    |

Storage : bucket `challenges`, chemin `{challenge_id}/{timestamp}.{ext}`.

Realtime : `postgres_changes` sur tous les events.

## Règles métier — Défi du Lundi

- **Création** : uniquement le lundi. Sinon, message "Rendez-vous lundi 📅".
- **Deadline** : prochain lundi à 23h59 depuis la date de création.
- **Flux de statuts** :
  1. `pending` — créé, en attente de preuve photo du destinataire
  2. `proof_submitted` — preuve soumise, le créateur doit valider
  3. `validated` / `rejected` — décision du créateur
- **Auto-validation** : si `proof_submitted` et deadline dépassée → `validated: true` automatiquement (géré côté client dans `fetchChallenges`)
- **Difficulté** : choisie à la création (Facile vert, Moyen bleu, Dur violet, Légendaire jaune-orange)
- **Défi hérité** : les défis sans `deadline` (créés avant la mise en place des règles) sont gérés normalement ; la deadline est fixée au prochain lundi au moment de la soumission de la preuve.

## Composants — points clés

### NextMeetingCard
- Lit `couple_settings` au montage (`.maybeSingle()`).
- Upsert avec `{ id: 1, ... }`.
- Affiche : jours restants, barre de progression entre `last_meeting_date` et `next_meeting_date`, date longue FR.
- Gestion d'erreur visible en cas d'échec de l'upsert.

### CroustiMessage
- **Bulle fixe** bas-droite (`fixed bottom-6 right-6 z-40`), ouvre une modale.
- Badge rouge animé : compte les messages reçus (`sender_id !== user.id`) depuis `lastSeen` (localStorage `nidou_messages_last_seen`).
- `lastSeen` mis à jour à l'ouverture de la modale.
- Scroll auto vers le bas à l'ouverture et à chaque nouveau message.

### DefiLundi
- Preview card cliquable → modale `85vh`.
- Lightbox intégrée pour les photos preuve.
- `fetchChallenges` est async et gère l'auto-validation avant de mettre à jour le state.

### HomePage
- Grille 2 colonnes (`max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2`) : NextMeetingCard + DefiLundi.
- `<CroustiMessage>` rendu hors grille (bulle fixed, peu importe la position dans le DOM).

## Migrations SQL en attente

À exécuter dans le dashboard Supabase → SQL Editor si ce n'est pas fait :

1. `supabase/migrations/20260507_couple_settings.sql` — crée la table + RLS
2. `supabase/migrations/20260507_challenges_rules.sql` — ajoute difficulty, deadline, validated, etc.

## Conventions

- Langue de l'UI : **français**
- Palette : rose/violet avec glassmorphisme
- Polices : Varela Round (titres), Nunito Sans (corps) — chargées depuis Google Fonts dans `index.html`
- Pas de librairie de state management (tout en state local)
- Noms dans les métadonnées user : `user.user_metadata.first_name`
- `creator_name`, `sender_name`, etc. sont des **caches** du first_name au moment de l'action (ne pas recalculer)
- Les `id` des messages/défis sont des UUID Supabase (text), pas des integers
