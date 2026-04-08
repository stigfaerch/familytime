-- FamilieTid Seed Data
-- Run this AFTER supabase-schema.sql.
-- Creates: 1 workspace, 4 persons, streaming platforms, 12 activities across all 5 categories,
-- ratings, viewings and one redo request.

-- ============================================================
-- Streaming Platforms
-- ============================================================
insert into streaming_platforms (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Netflix'),
  ('a0000000-0000-0000-0000-000000000002', 'Disney+'),
  ('a0000000-0000-0000-0000-000000000003', 'HBO Max'),
  ('a0000000-0000-0000-0000-000000000004', 'Viaplay'),
  ('a0000000-0000-0000-0000-000000000005', 'Apple TV+'),
  ('a0000000-0000-0000-0000-000000000006', 'Amazon Prime Video');

-- ============================================================
-- Workspace: Familien Jensen (all categories enabled = empty array)
-- ============================================================
insert into workspaces (id, name, rewatch_cooldown_months, enabled_categories) values
  ('b0000000-0000-0000-0000-000000000001', 'Familien Jensen', 6, '{}');

-- ============================================================
-- Persons
-- ============================================================
insert into persons (id, workspace_id, name, birth_date, is_workspace_admin) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Thomas',  '1982-03-15', true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Mette',   '1984-09-22', true),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Oliver',  '2013-06-10', false),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Freja',   '2016-12-01', false);

-- ============================================================
-- Workspace platform subscriptions (Netflix, Disney+, Viaplay)
-- ============================================================
insert into workspace_platforms (workspace_id, platform_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');

-- ============================================================
-- Platform editors (Thomas and Mette can tag films)
-- ============================================================
insert into workspace_platform_editors (workspace_id, person_id) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');

-- ============================================================
-- Activities — 5 films, 3 board games, 2 lege, 1 kreativ, 1 anden
-- category_id is looked up by slug so this works regardless of generated UUIDs.
-- ============================================================

-- Films
insert into activities (id, workspace_id, category_id, title, added_by, description, min_age, duration_minutes, image_url, info_url, tmdb_id) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'film'),
    'Soul', 'c0000000-0000-0000-0000-000000000001',
    'En jazzpianist havner i sjælenes verden og må finde tilbage til livet.',
    0, 100,
    'https://image.tmdb.org/t/p/w342/hm58Jw4Lw8OIeECIq5qyPYhAeRJ.jpg',
    null, 508442),

  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'film'),
    'Spider-Man: Into the Spider-Verse', 'c0000000-0000-0000-0000-000000000001',
    'Miles Morales bliver Spider-Man og møder helte fra parallelle universer.',
    7, 117,
    'https://image.tmdb.org/t/p/w342/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg',
    null, 324857),

  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'film'),
    'The Super Mario Bros. Movie', 'c0000000-0000-0000-0000-000000000002',
    'Mario og Luigi havner i svampekongeriget.',
    0, 92,
    'https://image.tmdb.org/t/p/w342/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
    null, 502356),

  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'film'),
    'Inside Out', 'c0000000-0000-0000-0000-000000000001',
    'Følelserne i hovedet på en lille pige tager kontrollen.',
    0, 95,
    'https://image.tmdb.org/t/p/w342/2H1TmgdfNtsKlU9jKdeNyYL5y8T.jpg',
    null, 150540),

  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'film'),
    'Dune', 'c0000000-0000-0000-0000-000000000001',
    'En ung adelsmand kæmper om kontrollen over en ørkenplanet.',
    11, 155,
    'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    null, 438631);

-- Board games
insert into activities (id, workspace_id, category_id, title, added_by, description, min_age, duration_minutes, image_url, info_url, bgg_id, min_players, max_players) values
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'braetspil'),
    'Catan', 'c0000000-0000-0000-0000-000000000001',
    'Klassisk handels- og bygningsspil for hele familien.',
    10, 90,
    'https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__original/img/xV7Lp8x3uFOUxhxLsUqr8M_jXcM=/0x0/filters:format(jpeg)/pic2419375.jpg',
    'https://www.catan.com/', 13, 3, 4),

  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'braetspil'),
    'Ticket to Ride: Europe', 'c0000000-0000-0000-0000-000000000002',
    'Byg togruter på tværs af Europa.',
    8, 60,
    'https://cf.geekdo-images.com/G1HbXUsh9qzCASRA6YkmvA__original/img/Trn_Lz9eJRoGCYg-iTyDk5_uHvk=/0x0/filters:format(png)/pic5301525.png',
    null, 14996, 2, 5),

  ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'braetspil'),
    'UNO', 'c0000000-0000-0000-0000-000000000004',
    'Hurtigt kortspil hvor man skal slippe af med alle sine kort først.',
    6, 30,
    'https://cf.geekdo-images.com/CKrEjI4N_ECnJ-vO6FRhHA__original/img/CMbqf-yc-8VgsjQc8YaolAaYXnY=/0x0/filters:format(jpeg)/pic5874146.jpg',
    null, 2223, 2, 10);

-- Lege
insert into activities (id, workspace_id, category_id, title, added_by, description, min_age, duration_minutes, image_url, indoor) values
  ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'lege'),
    'Skattejagt i haven', 'c0000000-0000-0000-0000-000000000002',
    'Lav små poster med opgaver rundt i haven og afslut med en skat.',
    4, 45,
    '',
    false),

  ('d0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'lege'),
    'Pude-fort', 'c0000000-0000-0000-0000-000000000004',
    'Byg et stort fort i stuen af alle puder og tæpper I kan finde.',
    3, 30,
    '',
    true);

-- Kreative
insert into activities (id, workspace_id, category_id, title, added_by, description, min_age, duration_minutes, image_url, info_url, indoor) values
  ('d0000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'kreative'),
    'Mal sten', 'c0000000-0000-0000-0000-000000000002',
    'Saml glatte sten på en gåtur og mal dem hjemme bagefter.',
    4, 60,
    '',
    'https://www.dr.dk/ramasjang/kreativt-til-boern',
    null);

-- Andre
insert into activities (id, workspace_id, category_id, title, added_by, description, min_age, duration_minutes, image_url) values
  ('d0000000-0000-0000-0000-000000000040', 'b0000000-0000-0000-0000-000000000001',
    (select id from activity_categories where slug = 'andre'),
    'Aftengåtur i skoven', 'c0000000-0000-0000-0000-000000000001',
    'En rolig tur i skoven inden sengetid.',
    0, 45,
    '');

-- ============================================================
-- Activity-platform availability (films only)
-- ============================================================
insert into activity_platforms (activity_id, platform_id, workspace_id) values
  -- Soul on Disney+
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  -- Spider-Verse on Netflix
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  -- Super Mario on Viaplay
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  -- Inside Out on Disney+
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
  -- Dune on Viaplay
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- Ratings
-- ============================================================
insert into ratings (activity_id, person_id, rating) values
  -- Soul: everyone loves it
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 5),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 5),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 4),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 3),

  -- Spider-Verse
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 5),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 3),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 5),

  -- Super Mario: kids love it
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 3),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 3),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 5),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 5),

  -- Inside Out
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 4),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 5),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 4),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 4),

  -- Dune (adults only)
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 5),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 4),

  -- Catan
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 5),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 4),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 4),

  -- Ticket to Ride
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 5),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 5),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000003', 4),

  -- UNO: everyone has played it
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 3),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 4),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000003', 5),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 5),

  -- Skattejagt
  ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000003', 5),
  ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 5),

  -- Pude-fort
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000003', 4),
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 5),

  -- Mal sten
  ('d0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000002', 5),
  ('d0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000004', 4),

  -- Aftengåtur
  ('d0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000001', 4),
  ('d0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000002', 4);

-- ============================================================
-- Viewings (some activities already done)
-- ============================================================
insert into viewings (activity_id, workspace_id, done_at, viewers) values
  -- Soul: watched by everyone on a Friday night
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-03-14 20:00:00+01',
    array['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004']::uuid[]),

  -- Inside Out: watched by everyone
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '2026-03-21 19:30:00+01',
    array['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004']::uuid[]),

  -- Dune: adults only
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', '2026-03-28 21:00:00+01',
    array['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002']::uuid[]),

  -- Catan: family game night
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', '2026-03-22 18:00:00+01',
    array['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003']::uuid[]),

  -- Skattejagt: kids did this on a Sunday
  ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001', '2026-03-29 14:00:00+02',
    array['c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004']::uuid[]);

-- ============================================================
-- Redo requests (Oliver wants to play Catan again, Thomas wants to rewatch Soul)
-- ============================================================
insert into redo_requests (activity_id, person_id, workspace_id) values
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- Summary of URLs for testing:
-- ============================================================
-- Admin:          /admin
-- Workspace:      /b0000000-0000-0000-0000-000000000001
-- Thomas:         /b0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000001
-- Mette:          /b0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000002
-- Oliver:         /b0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000003
-- Freja:          /b0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000004
-- Start/tonight:  /b0000000-0000-0000-0000-000000000001/start
-- Export:         /b0000000-0000-0000-0000-000000000001/export
