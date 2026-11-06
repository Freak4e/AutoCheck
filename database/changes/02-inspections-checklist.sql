-- US-08–US-10; run after schema.sql and change 01.
BEGIN;
CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE RESTRICT,
  inspector_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  final_result varchar(30) CHECK (final_result IN ('PASSED', 'FAILED', 'REINSPECTION_REQUIRED')),
  notes text,
  CHECK ((completed_at IS NULL) = (final_result IS NULL)),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX inspections_inspector_idx ON public.inspections(inspector_id);
CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(60) NOT NULL,
  name varchar(150) NOT NULL,
  sort_order integer NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE RESTRICT,
  template_item_id uuid NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE RESTRICT,
  category varchar(60) NOT NULL,
  name varchar(150) NOT NULL,
  sort_order integer NOT NULL,
  result varchar(20) NOT NULL DEFAULT 'NOT_CHECKED' CHECK (result IN ('NOT_CHECKED', 'PASS', 'FAIL')),
  notes text,
  UNIQUE (inspection_id, template_item_id)
);
CREATE INDEX inspection_items_inspection_idx ON public.inspection_items(inspection_id);
INSERT INTO public.checklist_template_items (category, name, sort_order) VALUES
 ('Zavore', 'Preveri delovanje zavor.', 1),
 ('Luči', 'Preveri delovanje in nastavitev luči.', 2),
 ('Pnevmatike', 'Preveri stanje in ustreznost pnevmatik.', 3),
 ('Krmiljenje', 'Preveri delovanje krmiljenja.', 4),
 ('Vzmetenje', 'Preveri stanje vzmetenja.', 5),
 ('Emisije', 'Preveri emisije vozila.', 6),
 ('Identifikacija vozila', 'Preveri VIN in registrsko oznako.', 7);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inspections, public.checklist_template_items, public.inspection_items FROM anon, authenticated;
COMMIT;
