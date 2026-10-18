-- Rich notes: the editor's document (ProseMirror/Tiptap JSON) beside the plain text.
-- body stays the source for search, export and counts; the server derives it from doc. Old notes keep doc null.
alter table notes add column doc jsonb;
alter table notes add column updated_at timestamptz;
