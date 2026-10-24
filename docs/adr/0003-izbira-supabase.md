# 0003 – PostgreSQL in Supabase Auth kot gostovani storitvi

**Status:** Sprejeto

## Kontekst in problem

[Podatkovni model](../03-podatkovni-model.md) vsebuje osem povezanih aplikacijskih tabel in zahteva transakcije. Uporabniki potrebujejo registracijo in prijavo. [Arhitektura](../04-arhitektura-in-tehnoloski-sklad.md#glavni-deli-sistema) določa lokalni frontend in backend ter gostovana PostgreSQL in Supabase Auth; lokalna baza in Docker nista del zasnove.

## Obravnavane možnosti

- **PostgreSQL in Auth na Supabase:** ena storitev zagotovi gostovano relacijsko bazo in prijavo; lokalno ni treba vzdrževati baze, potrebna pa je povezava do ponudnika.
- **Lokalni PostgreSQL in lastna prijava:** več nadzora in možnost lokalnega dela brez gostovane prijave, vendar več časa za namestitev, upravljanje gesel, sej in infrastrukture.
- **Gostovani PostgreSQL in ločen ponudnik prijave:** ohrani relacijski model, a za majhen MVP prinese usklajevanje dveh ponudnikov in več nastavitev brez dokumentirane potrebe.

## Odločitev

Izbrana možnost je **PostgreSQL in Supabase Auth na Supabase**, medtem ko aplikacijska procesa tečeta lokalno. Relacijska baza ustreza povezavam med vozili, termini, rezervacijami in ugotovitvami; gostovanje odstrani lokalno namestitev baze. Auth s knjižnico `@supabase/supabase-js` skrajša izvedbo prijave, ker projekt ne razvija lastnega shranjevanja gesel in izdajanja žetonov.

Aplikacijski profil je ločen zapis v `profiles`, povezan z `auth.users.id`; e-pošte in gesla ne podvajamo. Nov profil dobi `CUSTOMER`, začetna računa osebja pripravimo ročno. Povezovalni niz baze ostane v `backend/.env`; frontend dobi samo URL in javni ključ za Auth. Neposreden dostop do poslovnih podatkov ureja [ADR-0002](0002-izbira-express-api.md).

### Posledice

- Pozitivno: več časa ostane za potek pregledov; podatki ostanejo shranjeni po ustavitvi lokalne aplikacije.
- Pozitivno: razvoj ne potrebuje Dockerja, Supabase CLI ali lokalnega PostgreSQL.
- Negativno: razvoj in prijava sta odvisna od interneta ter razpoložljivosti ponudnika; to ni rešitev za delo brez povezave.
- Negativno: veljajo omejitve izbranega paketa, ob večji uporabi lahko nastanejo stroški. Zasnova ne predpostavlja neomejene brezplačne uporabe.
- Negativno: poznati je treba nastavitve Auth in povezave z bazo; morebitna menjava prijavnega ponudnika zahteva prilagoditve.
