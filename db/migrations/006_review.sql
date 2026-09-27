-- Second reader: an independent pass that checks each claim against the evidence it cites.
alter table claims add column review text check (review in ('supported', 'partial', 'unsupported'));
alter table claims add column review_note text;
alter table claims add column reviewed_at timestamptz;

-- Per-chapter summary of the audit (counts, dropped items), shown on the audit page.
alter table chapter_studies add column audit jsonb;
