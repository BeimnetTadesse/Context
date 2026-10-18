-- Replies: a reader can answer their own note. A reply is a note with a parent (same reader, chapter and verse);
-- threads are one level deep, and deleting a note deletes its replies.
alter table notes add column parent_id integer references notes(id) on delete cascade;
create index notes_parent on notes (parent_id) where parent_id is not null;
