-- The translation a note was written on (e.g. 'KJV', 'AMH'), so it can say so and mark the words in that version.
-- Null for older notes and for replies (a reply belongs to its note).
alter table notes add column version text;
