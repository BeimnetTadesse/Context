-- Section headings from a published translation (the Berean Standard Bible's editors), for Observe's structure
-- and the book outline. Human-written and public domain, instead of AI-drafted sections.
-- (016 is the text-reports migration on its own branch.)
create table section_headings (
  id         serial primary key,
  source_id  integer not null references sources(id),
  book_id    smallint not null references books(id),
  chapter    smallint not null,
  start_ord  integer not null references verses(ord),  -- the verse the section begins with
  title      text not null
);
create index section_headings_book on section_headings (book_id, start_ord);
