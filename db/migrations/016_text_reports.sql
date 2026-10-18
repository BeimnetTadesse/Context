-- Reports of problems in a Bible text ("3:5–6 seem to be missing"), for the owner to check on /stats.
-- Their own table, not notes: a report is for Context, not the reader's notebook, and it stays (unlinked)
-- when the reader deletes their account.
create table text_reports (
  id          serial primary key,
  user_id     integer references users(id) on delete set null,
  book_id     smallint not null references books(id),
  chapter     smallint not null,
  translation text not null,         -- what was on screen: 'NASV', 'WEB / አማርኛ', 'Greek'
  body        text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index text_reports_open on text_reports (created_at desc) where resolved_at is null;

-- Earlier reports were saved as notes; move them over.
insert into text_reports (user_id, book_id, chapter, translation, body, created_at)
select user_id, book_id, chapter,
       coalesce(substring(body from '^\[([^\]]*)\]'), '?'),
       regexp_replace(body, '^\[[^\]]*\]\s*', ''), created_at
from notes where kind = 'text_issue';
delete from notes where kind = 'text_issue';

alter table notes drop constraint notes_kind_check;
alter table notes add constraint notes_kind_check check (kind in ('note', 'reflection', 'text_says', 'i_bring'));
