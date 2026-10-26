-- Psalm titles ("A Psalm by David.") and similar chapter superscriptions, from the World English Bible.
-- They are part of the text (in the Hebrew Bible they count as verse 1), so Read shows them above the first verse.
create table chapter_titles (
  book_id   smallint not null references books(id),
  chapter   smallint not null,
  title     text not null,
  source_id integer not null references sources(id),
  primary key (book_id, chapter)
);
