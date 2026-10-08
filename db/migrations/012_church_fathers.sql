-- Church Fathers: what the early church (to AD 750) said about each verse, in old public-domain translations.
-- Kept apart from the commentaries: these are tradition, quoted exactly, never generated or summarised.

create table fathers (
  id         serial primary key,
  name       text not null unique,
  year       smallint not null,       -- when they died or wrote (approximate), as the dataset gives it
  category   text not null,           -- 'Early Fathers (Pre-Nicaea)', 'Eastern & Byzantine Theology', ...
  condemned  boolean not null default false, -- condemned by a church council
  note       text,                    -- something readers should know before weighing this voice
  wiki_url   text
);

create table father_quotes (
  id          serial primary key,
  father_id   integer not null references fathers(id),
  book_id     smallint not null references books(id),
  chapter     smallint not null,
  start_ord   integer not null references verses(ord),
  end_ord     integer not null references verses(ord),
  text        text not null,
  work        text,                   -- 'Homily 10 on Ephesians'; null for the Catena Aurea
  via         text,                   -- 'Quoted in Aquinas’s Catena Aurea (1274)'
  translation text not null,          -- which public-domain translation the English comes from
  url         text,
  source_ref  text not null unique    -- the dataset's id, so re-imports stay stable
);
create index father_quotes_range on father_quotes (start_ord, end_ord);
create index father_quotes_chapter on father_quotes (book_id, chapter);
