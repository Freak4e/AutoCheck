-- F01 only. Run once in the Supabase SQL Editor before the first login.
BEGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL CHECK (length(btrim(name)) > 0),
  role varchar(20) NOT NULL DEFAULT 'CUSTOMER'
    CHECK (role IN ('CUSTOMER', 'INSPECTOR', 'ADMIN')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Express accesses PostgreSQL through the server connection; public clients
-- cannot create or promote profiles even if Data API is accidentally enabled.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon, authenticated;

COMMIT;
