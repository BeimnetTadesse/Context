-- Language step: one card per Greek term, with its claims linked via claims.strongs.
create table language_notes (
  id               serial primary key,
  book_id          smallint not null references books(id),
  chapter          smallint not null,
  strongs          text not null,
  meaning_here     text not null,
  translation_note text,
  caution          text,
  status           claim_status not null default 'unverified',
  origin           claim_origin not null,
  sort             smallint not null default 0
);

-- Reflect › Text or Assumption?: why the expected label is right (the evidence lives on claim_id).
alter table reflection_items add column explanation text;

-- Readers can flag problems in a source text (e.g. the Amharic e-text gap at Eph 3:5-6).
alter table notes drop constraint notes_kind_check;
alter table notes add constraint notes_kind_check
  check (kind in ('note', 'reflection', 'text_says', 'i_bring', 'text_issue'));

-- Anonymous, device-scoped identity until real sign-in exists.
alter table users add column device_id uuid unique;

create index claims_step on claims (book_id, chapter, step);
create index notes_user on notes (user_id, created_at desc);
