-- Problems found in source data, recorded instead of silently "fixed". Shown on the Sources page.
create table source_issues (
  id          serial primary key,
  source_id   integer not null references sources(id),
  book_id     smallint references books(id),
  chapter     smallint,
  kind        text not null,        -- 'mismatched_file' | 'missing' | 'encoding' | ...
  description text not null
);
