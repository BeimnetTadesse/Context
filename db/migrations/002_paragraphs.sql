-- Paragraph starts come from the translation's own layout (USFM \p), so they live per translation.
alter table verse_texts add column para boolean not null default false;
