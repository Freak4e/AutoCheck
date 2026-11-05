-- F02/F03. Run once, after schema.sql; never re-run the initial schema.
BEGIN;

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  registration_number varchar(20) NOT NULL UNIQUE
    CHECK (length(registration_number) > 0 AND registration_number = upper(regexp_replace(registration_number, '[[:space:]-]', '', 'g'))),
  manufacturer varchar(60) NOT NULL CHECK (length(btrim(manufacturer)) > 0),
  model varchar(60) NOT NULL CHECK (length(btrim(model)) > 0),
  year smallint NOT NULL CHECK (year >= 1900),
  vin varchar(17) NOT NULL UNIQUE CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{17}$')
);
CREATE INDEX vehicles_owner_idx ON public.vehicles(owner_id);

CREATE TABLE public.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL UNIQUE,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at = starts_at + interval '30 minutes'),
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL UNIQUE REFERENCES public.appointment_slots(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_customer_idx ON public.appointments(customer_id);
CREATE INDEX appointments_vehicle_idx ON public.appointments(vehicle_id);
CREATE UNIQUE INDEX appointments_one_open_vehicle ON public.appointments(vehicle_id) WHERE status IN ('BOOKED', 'IN_PROGRESS');
CREATE UNIQUE INDEX appointments_one_active_station ON public.appointments(status) WHERE status = 'IN_PROGRESS';

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicles, public.appointment_slots, public.appointments FROM anon, authenticated;

COMMIT;
