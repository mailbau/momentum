-- +goose Up
create type srl_stage as enum ('planning', 'monitoring', 'controlling', 'reflection');
create type difficulty as enum ('easy', 'medium', 'hard', 'expert');
create type priority as enum ('low', 'medium', 'high', 'critical');

create table courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table learning_strategies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id),
  strategy_id uuid references learning_strategies(id),
  title text not null,
  description text not null default '',
  stage srl_stage not null default 'planning',
  position double precision not null,
  difficulty difficulty not null default 'easy',
  priority priority not null default 'medium',
  pre_test numeric(5,2) check (pre_test is null or pre_test between 0 and 100),
  post_test numeric(5,2) check (post_test is null or post_test between 0 and 100),
  prior_knowledge text not null default '',
  notes text not null default '',
  rating smallint check (rating is null or rating between 1 and 5),
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_board_idx on cards (user_id, stage, position) where archived_at is null;

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null
);
create index on checklist_items (card_id, position);

create table card_links (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  url text not null,
  label text not null default ''
);
create index on card_links (card_id);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_open_session_per_user on study_sessions (user_id) where ended_at is null;
create index on study_sessions (card_id);

-- Seed: Information Technology courses + the six SRL-aligned learning strategies
-- used in the thesis evaluation.
insert into courses (program_id, code, name)
select id, code, name from (
  values
    ('CS101', 'Object Oriented Programming'),
    ('CS102', 'Linear Algebra'),
    ('CS142', 'Discrete Mathematics'),
    ('TIF140707', 'Mobile Application Development'),
    ('TIF160704', 'Data Warehouse'),
    ('TIF180701', 'Thesis'),
    ('TIF190101', 'Technical Writing')
) as c(code, name)
cross join (select id from programs where code = 'IT') p;

insert into learning_strategies (name, description) values
  ('Rehearsal Strategies - Pengulangan Materi', 'Repeating material through re-reading or practice to build recall.'),
  ('Elaboration Strategies - Membuat Ringkasan dengan Kata Sendiri', 'Summarizing material in your own words to deepen understanding.'),
  ('Organization Strategies - Membuat Mind Map dan Outline', 'Structuring material into mind maps or outlines to see relationships.'),
  ('Metacognitive Strategies - Evaluasi Hasil Belajar & Atur Strategi Belajar', 'Evaluating your own learning outcomes and adjusting strategy.'),
  ('Time Management Strategies - Teknik Pomodoro', 'Using timed work/break intervals to manage study sessions.'),
  ('Help-seeking Strategies - Belajar dengan AI & Platform Online', 'Seeking help from AI tools, forums, or online platforms when stuck.');

-- +goose Down
drop table study_sessions;
drop table card_links;
drop table checklist_items;
drop table cards;
drop table learning_strategies;
drop table courses;
drop type priority;
drop type difficulty;
drop type srl_stage;
