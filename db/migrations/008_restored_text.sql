-- A verse text row that came from a different copy than its translation's main source: e.g. Amharic 1962 verses
-- missing from the eBible.org e-text, restored from WordProject's copy of the same translation.
alter table verse_texts add column source_id integer references sources(id);
