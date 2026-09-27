-- Commentaries: public-domain and CC BY-SA commentators as first-class, citable sources.

-- When a source was written and which tradition it speaks from (so bias is visible).
alter table sources add column written text;       -- '1540s–1550s', '1871', '2022'
alter table sources add column tradition text;     -- 'Reformed', 'Methodist (Arminian)', ...

create table commentary_notes (
  id         serial primary key,
  source_id  integer not null references sources(id),
  book_id    smallint not null references books(id),
  chapter    smallint not null,
  start_ord  integer not null references verses(ord),
  end_ord    integer not null references verses(ord),  -- section notes (Henry, Calvin) cover ranges
  text       text not null,
  sort       smallint not null default 0
);
create index commentary_notes_range on commentary_notes (start_ord, end_ord);
create index commentary_notes_chapter on commentary_notes (book_id, chapter);

-- Book introductions (Tyndale, JFB): who, when, why — shown in the Context step.
create table book_intros (
  source_id integer not null references sources(id),
  book_id   smallint not null references books(id),
  text      text not null,
  primary key (source_id, book_id)
);

-- References found inside commentary text, resolved to verses (for links and the reference audit).
create table commentary_refs (
  note_id   integer not null references commentary_notes(id) on delete cascade,
  raw       text not null,          -- as written: 'Ti2 3:15-16'
  start_ord integer references verses(ord),
  end_ord   integer references verses(ord),
  resolved  boolean not null
);
create index commentary_refs_note on commentary_refs (note_id);
