-- US-11/US-12: run after changes 01 and 02.
BEGIN;
CREATE TABLE public.defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_item_id uuid NOT NULL REFERENCES public.inspection_items(id) ON DELETE RESTRICT,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  severity varchar(10) NOT NULL CHECK (severity IN ('MINOR', 'MAJOR'))
);
CREATE INDEX defects_item_idx ON public.defects(inspection_item_id);
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.defects FROM anon, authenticated;
COMMIT;
