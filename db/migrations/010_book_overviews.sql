-- Book overview: an AI draft per book, made of ordinary claims (chapter null, step 'book') so they carry the
-- same labels, citations, checks and second-reader review as chapter claims. Themes give some of them a title.
create table book_overviews (
  book_id        smallint primary key references books(id),
  model          text,
  prompt_version text,
  generated_at   timestamptz not null default now()
);

create table book_themes (
  id       serial primary key,
  book_id  smallint not null references books(id),
  title    text not null,
  claim_id integer not null references claims(id) on delete cascade,
  sort     smallint not null default 0
);
create index book_themes_book on book_themes (book_id);
