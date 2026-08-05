-- Seed local UNIQUEMENT (jamais exécuté sur le projet distant).
-- Rejoué automatiquement à chaque `supabase start` / `supabase db reset`.
--
-- But : tester check-photo-game-push et notify-photo-game en local sans
-- jamais notifier le vrai partenaire. On crée 2 faux users, mais on
-- n'insère une ligne push_subscriptions QUE pour "moi" (ME_ID) — le
-- "partenaire" (PARTNER_ID) n'a donc aucun abonnement push et ne peut
-- physiquement rien recevoir, même s'il est ciblé par la logique.

-- 1) Deux faux comptes (nécessaires pour auth.admin.listUsers(), utilisé
--    par check-photo-game-push quand status = 'active').
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'moi@test.local', crypt('password123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Moi"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'partenaire@test.local', crypt('password123', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Partenaire"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- 2) Abonnement push RÉEL, mais SEULEMENT pour "moi".
--    Remplace la valeur ci-dessous par TA vraie subscription (colonne
--    `subscription` de ta ligne dans push_subscriptions en prod — copie,
--    ne modifie rien côté prod). Sans ça, la fonction tournera mais
--    n'enverra rien de recevable (webpush échouera silencieusement).
insert into push_subscriptions (user_id, endpoint, subscription)
values (
  '11111111-1111-1111-1111-111111111111',
  'https://COLLE-TON-ENDPOINT-ICI',
  '{"endpoint":"https://COLLE-TON-ENDPOINT-ICI","keys":{"p256dh":"...","auth":"..."}}'::jsonb
)
on conflict (endpoint) do nothing;

-- 3) État de la partie à tester — décommente UN SEUL bloc.
--    (started_at n'a aucun effet sur check-photo-game-push : le jour de
--    rappel dépend de l'horloge réelle, pas de cette colonne.)

-- Scénario A — personne n'a encore uploadé (statut 'active')
update photo_game set
  status = 'active',
  photo_1_url = null, photo_1_user_id = null,
  photo_2_url = null, photo_2_user_id = null,
  vote_1 = null, vote_2 = null
where id = 1;

-- Scénario B — "partenaire" a uploadé, "moi" doit encore uploader
-- update photo_game set
--   status = 'active',
--   photo_1_url = 'https://example.com/fake.jpg', photo_1_user_id = '22222222-2222-2222-2222-222222222222',
--   photo_2_url = null, photo_2_user_id = null,
--   vote_1 = null, vote_2 = null
-- where id = 1;

-- Scénario C — les 2 photos sont là, "moi" doit encore voter
-- update photo_game set
--   status = 'voting',
--   photo_1_url = 'https://example.com/fake1.jpg', photo_1_user_id = '11111111-1111-1111-1111-111111111111',
--   photo_2_url = 'https://example.com/fake2.jpg', photo_2_user_id = '22222222-2222-2222-2222-222222222222',
--   vote_1 = null, vote_2 = null
-- where id = 1;
