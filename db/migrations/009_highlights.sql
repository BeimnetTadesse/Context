-- A reader's verse highlights: one colour per verse, private to the reader (device or account).
-- Stored by verse, so a highlight shows in every version the reader compares.
create table highlights (
  user_id    integer not null references users(id) on delete cascade,
  ord        integer not null references verses(ord),
  color      text not null check (color in ('yellow', 'green', 'blue', 'pink')),
  created_at timestamptz not null default now(),
  primary key (user_id, ord)
);
