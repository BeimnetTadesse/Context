-- Context schema v1
-- Four groups: TEXT (imported, read-only) · KNOWLEDGE (the evidence graph) · USER · AUDIT.
-- Verse ranges are stored as global ordinals (Gen 1:1 = 1 … Rev 22:21 = last),
-- so "what touches Eph 3:1-13?" is integer overlap, not string parsing.

-- ───────────────────────── TEXT ─────────────────────────

create table books (
  id            smallint primary key,          -- canon order (1 = Genesis, 40 = Matthew)
  osis          text not null unique,          -- 'Eph' (OSIS / STEP / OpenBible id)
  usfm          text not null unique,          -- 'EPH' (eBible file id)
  name          text not null,                 -- 'Ephesians'
  slug          text not null unique,          -- 'ephesians' (URL)
  testament     text not null check (testament in ('OT', 'NT')),
  chapter_count smallint not null
);

create table verses (
  ord     integer primary key,                 -- global ordinal in canon order
  book_id smallint not null references books(id),
  chapter smallint not null,
  verse   smallint not null,
  unique (book_id, chapter, verse)
);
create index verses_book_chapter on verses (book_id, chapter);

create table sources (
  id          serial primary key,
  key         text not null unique,            -- short cite key shown in brackets: 'WEB', 'STEP-TAGNT'
  title       text not null,
  author      text,
  publisher   text,
  year        text,
  url         text,
  tier        smallint not null check (tier between 1 and 6),
  -- 1 primary text · 2 ancient witness · 3 academic · 4 translation/study data · 5 theological · 6 educational
  source_type text not null,                   -- 'Primary text · translation', 'Lexicon', 'Commentary', ...
  orientation text,                            -- 'critical', 'evangelical', 'catholic', ... (bias made visible)
  license     text not null,
  can_display boolean not null default false,  -- may we show its words, or only cite it?
  notes       text
);

create table translations (
  code       text primary key,                 -- 'WEB', 'AMH', 'SBLGNT'
  name       text not null,
  language   text not null,                    -- 'en', 'am', 'grc'
  source_id  integer not null references sources(id)
);

create table verse_texts (
  translation_code text not null references translations(code),
  ord              integer not null references verses(ord),
  end_ord          integer references verses(ord), -- set when a translation merges verses (Amharic 3:5-7)
  text             text not null,
  primary key (translation_code, ord)
);

create table lemmas (
  strongs    text primary key,                 -- 'G3466'
  lemma      text not null,                    -- 'μυστήριον'
  translit   text,
  gloss      text,                             -- short gloss: 'mystery'
  definition text,                             -- Abbott-Smith entry (HTML-ish, from STEP TBESG)
  source_id  integer not null references sources(id)
);

create table greek_words (
  ord      integer not null references verses(ord),
  position smallint not null,
  surface  text not null,                      -- 'σύσσωμα'
  translit text,
  gloss    text,                               -- contextual English: 'a joint-body'
  strongs  text,                               -- 'G4954' (may not exist in lemmas)
  morph    text,                               -- 'A-APN'
  primary key (ord, position)
);
create index greek_words_strongs on greek_words (strongs);

create table cross_refs (
  id         serial primary key,
  from_start integer not null,
  from_end   integer not null,
  to_start   integer not null,
  to_end     integer not null,
  votes      integer not null default 0,
  source_id  integer not null references sources(id)
);
create index cross_refs_from on cross_refs (from_start, from_end);

-- ─────────────────────── KNOWLEDGE ───────────────────────

-- The six labels from the design. One vocabulary, used everywhere.
create type claim_label as enum
  ('explicit', 'inference', 'historical', 'scholarly', 'tradition', 'personal');
create type claim_status as enum ('unverified', 'verified');
create type claim_origin as enum ('computed', 'ai_draft', 'human');

create table claims (
  id          serial primary key,
  label       claim_label not null,
  statement   text not null,
  step        text not null,                   -- 'observe' | 'context' | 'language' | 'connections' | 'interpretations' | 'reflect'
  topic       text,                            -- 'author' | 'audience' | 'setting' | 'structure' | lemma key ...
  book_id     smallint not null references books(id),
  chapter     smallint,                        -- null = book-level (e.g. authorship)
  strongs     text,                            -- language claims point at a lemma, never at an English word
  status      claim_status not null default 'unverified',
  origin      claim_origin not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index claims_book_chapter on claims (book_id, chapter);

create table claim_anchors (
  claim_id  integer not null references claims(id) on delete cascade,
  start_ord integer not null,
  end_ord   integer not null,
  quote     text                               -- exact words in the WEB verse, for phrase underlines
);
create index claim_anchors_range on claim_anchors (start_ord, end_ord);

create table citations (
  id        serial primary key,
  claim_id  integer not null references claims(id) on delete cascade,
  source_id integer not null references sources(id),
  locator   text,                              -- 'Eph 3:6', 'p. 181', 'G4954'
  relation  text not null default 'supports' check (relation in ('supports', 'disputes', 'background')),
  quote     text,                              -- only when sources.can_display
  checked   boolean not null default false     -- a human actually opened this source
);

create table sections (                         -- Observe › Structure
  id        serial primary key,
  book_id   smallint not null references books(id),
  chapter   smallint not null,
  start_ord integer not null,
  end_ord   integer not null,
  title     text not null,
  summary   text,
  status    claim_status not null default 'unverified',
  origin    claim_origin not null
);

create table connections (                      -- Connections: a cross-ref with its relationship explained
  id         serial primary key,
  book_id    smallint not null references books(id),
  chapter    smallint not null,
  group_name text not null,                    -- 'The same idea elsewhere in Paul'
  relation   text not null,                    -- 'Shared wording', 'Thematic parallel', ...
  to_start   integer not null,
  to_end     integer not null,
  explanation text not null,
  claim_id   integer references claims(id) on delete set null,
  sort       smallint not null default 0
);

create table interp_questions (
  id            serial primary key,
  book_id       smallint not null references books(id),
  chapter       smallint not null,
  start_ord     integer not null,
  end_ord       integer not null,
  question      text not null,
  common_ground text,
  status        claim_status not null default 'unverified',
  origin        claim_origin not null,
  sort          smallint not null default 0
);

create table interpretations (
  id          serial primary key,
  question_id integer not null references interp_questions(id) on delete cascade,
  view_label  text not null,                   -- 'View A'
  holders     text,                            -- 'Most commentators' — only shown when verified
  title       text not null,
  sort        smallint not null default 0
);

create table interpretation_claims (
  interpretation_id integer not null references interpretations(id) on delete cascade,
  claim_id          integer not null references claims(id) on delete cascade,
  primary key (interpretation_id, claim_id)
);

create table reflection_items (                 -- Reflect: quiz statements and prompts
  id             serial primary key,
  book_id        smallint not null references books(id),
  chapter        smallint not null,
  kind           text not null check (kind in ('statement', 'prompt')),
  text           text not null,
  anchor_start   integer,
  anchor_end     integer,
  expected_label claim_label,                  -- statements only
  claim_id       integer references claims(id) on delete set null,
  sort           smallint not null default 0
);

create table chapter_studies (                  -- tracks AI generation per chapter
  book_id        smallint not null references books(id),
  chapter        smallint not null,
  status         text not null check (status in ('pending', 'ready', 'failed')),
  model          text,
  prompt_version text,
  generated_at   timestamptz,
  error          text,
  primary key (book_id, chapter)
);

-- Integrity rule: nothing becomes "verified" without a checked citation,
-- and scholarly / historical claims need a non-biblical source (tier 2–4).
create function enforce_claim_verification() returns trigger as $$
begin
  if new.status = 'verified' then
    if not exists (select 1 from citations c where c.claim_id = new.id and c.checked) then
      raise exception 'claim % cannot be verified without a checked citation', new.id;
    end if;
    if new.label in ('historical', 'scholarly') and not exists (
      select 1 from citations c join sources s on s.id = c.source_id
      where c.claim_id = new.id and c.checked and s.tier between 2 and 4
    ) then
      raise exception 'claim % (%) needs a checked tier 2–4 source', new.id, new.label;
    end if;
    new.verified_at := coalesce(new.verified_at, now());
  end if;
  return new;
end $$ language plpgsql;

create trigger claims_verification
  before insert or update of status on claims
  for each row execute function enforce_claim_verification();

-- ───────────────────────── USER ─────────────────────────

create table users (
  id         serial primary key,
  email      text unique,
  name       text,
  created_at timestamptz not null default now()
);

create table notes (
  id         serial primary key,
  user_id    integer not null references users(id) on delete cascade,
  book_id    smallint not null references books(id),
  chapter    smallint not null,
  start_ord  integer,
  end_ord    integer,
  kind       text not null check (kind in ('note', 'reflection', 'text_says', 'i_bring')),
  item_id    integer references reflection_items(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table assumption_guesses (
  user_id    integer not null references users(id) on delete cascade,
  item_id    integer not null references reflection_items(id) on delete cascade,
  guess      claim_label not null,
  correct    boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ───────────────────────── AUDIT ─────────────────────────

create table ai_runs (
  id                serial primary key,
  user_id           integer references users(id) on delete set null,
  kind              text not null,             -- 'ask' | 'assumption' | 'chapter_study'
  book_id           smallint,
  chapter           smallint,
  input             text,
  retrieved         jsonb,                     -- evidence ids handed to the model
  output            jsonb,
  validation        jsonb,                     -- what the validator dropped and why
  model             text,
  prompt_version    text,
  created_at        timestamptz not null default now()
);
